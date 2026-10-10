// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title InterNameRegistry
/// @notice Registers and resolves human-readable `.inter` names paid in USDC.
/// @dev Names are keyed by keccak256 hash of a normalized label (lowercase, [a-z0-9-], length 1..64).
contract InterNameRegistry is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_ANNUAL_FEE = 1_000_000; // 1.0 USDC (6 decimals)
    uint256 public constant MAX_REGISTRATION_YEARS = 10;

    uint256 private constant _YEAR = 365 days;
    uint256 private constant _INTER_SUFFIX_LENGTH = 6; // ".inter"

    struct Registration {
        address owner;
        address resolved;
        uint64 expiry; // unix timestamp
    }

    mapping(bytes32 => Registration) private _names;
    mapping(address => string) private _primary;

    uint256 public annualFee;
    address public immutable usdc;

    event NameRegistered(bytes32 indexed labelHash, string label, address indexed owner, address resolved, uint64 expiry);
    event NameRenewed(bytes32 indexed labelHash, address indexed owner, uint64 newExpiry);
    event NameTransferred(bytes32 indexed labelHash, address indexed from, address indexed to);
    event ResolvedAddressSet(bytes32 indexed labelHash, address indexed resolved);
    event PrimaryNameSet(address indexed addr, string label);
    event PrimaryNameCleared(address indexed addr);
    event AnnualFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address indexed to, uint256 amount);

    error InvalidUsdc();
    error InvalidInitialOwner();
    error FeeTooHigh();
    error InvalidYears();
    error InvalidLabel();
    error NameUnavailable();
    error NotNameOwner();
    error NameExpired();
    error ZeroAddress();
    error NotResolvedAddress();
    error RenounceOwnershipDisabled();
    error UsdcNotAContract();

    /// @notice Creates a new InterNameRegistry.
    /// @param usdc_ ERC-20 token used for fee payment (USDC).
    /// @param initialAnnualFee Initial annual fee in USDC base units (6 decimals).
    /// @param initialOwner Initial owner for Ownable2Step management.
    constructor(address usdc_, uint256 initialAnnualFee, address initialOwner) Ownable(initialOwner) {
        if (usdc_ == address(0)) revert InvalidUsdc();
        if (usdc_.code.length == 0) revert UsdcNotAContract();
        if (initialOwner == address(0)) revert InvalidInitialOwner();
        if (initialAnnualFee > MAX_ANNUAL_FEE) revert FeeTooHigh();

        usdc = usdc_;
        annualFee = initialAnnualFee;
    }

    /// @notice Registers a label for a given number of years.
    /// @dev Accepts either bare label (`generis`) or full name (`generis.inter`).
    ///      Applies CEI ordering and charges `annualFee * years` via USDC `transferFrom`.
    /// @param label Label or full name to register.
    /// @param numYears Number of years to register (1..10).
    /// @param resolvedTo Initial resolved address. If zero, defaults to caller.
    function register(string calldata label, uint256 numYears, address resolvedTo) external nonReentrant {
        if (numYears == 0 || numYears > MAX_REGISTRATION_YEARS) revert InvalidYears();

        (string memory normalizedLabel, bytes32 labelHash) = _normalizeAndHash(label);

        if (!_isAvailable(labelHash)) revert NameUnavailable();

        address resolved = resolvedTo == address(0) ? msg.sender : resolvedTo;
        uint64 expiry = _expiryFromNow(numYears);

        _names[labelHash] = Registration({owner: msg.sender, resolved: resolved, expiry: expiry});

        uint256 fee = annualFee * numYears;
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), fee);

        emit NameRegistered(labelHash, normalizedLabel, msg.sender, resolved, expiry);
    }

    /// @notice Renews an active registration by extending its expiry.
    /// @dev Caller must be the current owner of an unexpired registration.
    /// @param label Label or full name to renew.
    /// @param additionalYears Number of years to add (1..10).
    function renew(string calldata label, uint256 additionalYears) external nonReentrant {
        if (additionalYears == 0 || additionalYears > MAX_REGISTRATION_YEARS) revert InvalidYears();

        (, bytes32 labelHash) = _normalizeAndHash(label);
        Registration storage reg = _names[labelHash];

        if (reg.owner != msg.sender) revert NotNameOwner();
        if (reg.expiry <= block.timestamp) revert NameExpired();

        uint64 newExpiry = _extendExpiry(reg.expiry, additionalYears);
        reg.expiry = newExpiry;

        uint256 fee = annualFee * additionalYears;
        IERC20(usdc).safeTransferFrom(msg.sender, address(this), fee);

        emit NameRenewed(labelHash, msg.sender, newExpiry);
    }

    /// @notice Transfers ownership of an active name registration.
    /// @param label Label or full name to transfer.
    /// @param newOwner New owner address.
    function transfer(string calldata label, address newOwner) external {
        if (newOwner == address(0)) revert ZeroAddress();

        (, bytes32 labelHash) = _normalizeAndHash(label);
        Registration storage reg = _names[labelHash];

        if (reg.owner != msg.sender) revert NotNameOwner();
        if (reg.expiry <= block.timestamp) revert NameExpired();

        address from = reg.owner;
        reg.owner = newOwner;

        emit NameTransferred(labelHash, from, newOwner);
    }

    /// @notice Sets the resolved address of an active name.
    /// @param label Label or full name to update.
    /// @param addr New resolved address.
    function setResolved(string calldata label, address addr) external {
        (, bytes32 labelHash) = _normalizeAndHash(label);
        Registration storage reg = _names[labelHash];

        if (reg.owner != msg.sender) revert NotNameOwner();
        if (reg.expiry <= block.timestamp) revert NameExpired();

        reg.resolved = addr;

        emit ResolvedAddressSet(labelHash, addr);
    }

    /// @notice Sets caller's primary name.
    /// @dev Caller must be the current resolved address of the given unexpired name.
    /// @param label Label or full name to set as caller primary.
    function setPrimaryName(string calldata label) external {
        (string memory normalizedLabel, bytes32 labelHash) = _normalizeAndHash(label);
        Registration storage reg = _names[labelHash];

        if (reg.expiry <= block.timestamp) revert NameExpired();
        if (reg.resolved != msg.sender) revert NotResolvedAddress();

        _primary[msg.sender] = normalizedLabel;

        emit PrimaryNameSet(msg.sender, normalizedLabel);
    }

    /// @notice Clears caller's primary name.
    function clearPrimaryName() external {
        delete _primary[msg.sender];
        emit PrimaryNameCleared(msg.sender);
    }

    /// @notice Updates the annual registration fee.
    /// @param newFee New annual fee in USDC base units.
    function setAnnualFee(uint256 newFee) external onlyOwner {
        if (newFee > MAX_ANNUAL_FEE) revert FeeTooHigh();

        uint256 oldFee = annualFee;
        annualFee = newFee;

        emit AnnualFeeUpdated(oldFee, newFee);
    }

    /// @notice Withdraws all accumulated USDC fees to the owner.
    function withdraw() external onlyOwner nonReentrant {
        address to = owner();
        uint256 amount = IERC20(usdc).balanceOf(address(this));

        IERC20(usdc).safeTransfer(to, amount);

        emit FeesWithdrawn(to, amount);
    }

    /// @notice Resolves a `.inter` name to an address.
    /// @param nameWithSuffix Name or label to resolve.
    /// @return Resolved address, or zero address if unregistered/expired.
    function resolve(string calldata nameWithSuffix) external view returns (address) {
        (, bytes32 labelHash) = _normalizeAndHash(nameWithSuffix);
        Registration memory reg = _names[labelHash];

        if (reg.expiry <= block.timestamp) {
            return address(0);
        }

        return reg.resolved;
    }

    /// @notice Returns the primary name label for an address.
    /// @dev Returns empty string if no primary is set or if the stored primary is no longer valid.
    /// @param addr Address to query.
    /// @return Primary label (without `.inter`) or empty string.
    function lookupAddress(address addr) external view returns (string memory) {
        string memory label = _primary[addr];
        if (bytes(label).length == 0) {
            return "";
        }

        bytes32 labelHash = keccak256(bytes(label));
        Registration memory reg = _names[labelHash];

        if (reg.expiry <= block.timestamp || reg.resolved != addr) {
            return "";
        }

        return label;
    }

    /// @notice Returns whether a name is currently available to register.
    /// @param label Label or full name to check.
    function isAvailable(string calldata label) external view returns (bool) {
        (, bytes32 labelHash) = _normalizeAndHash(label);
        return _isAvailable(labelHash);
    }

    /// @notice Returns expiry timestamp of a name registration.
    /// @param label Label or full name to query.
    function expiryOf(string calldata label) external view returns (uint64) {
        (, bytes32 labelHash) = _normalizeAndHash(label);
        return _names[labelHash].expiry;
    }

    /// @notice Returns owner of an active name.
    /// @param label Label or full name to query.
    /// @return Name owner, or zero address if expired or unregistered.
    function ownerOf(string calldata label) external view returns (address) {
        (, bytes32 labelHash) = _normalizeAndHash(label);
        Registration memory reg = _names[labelHash];

        if (reg.expiry <= block.timestamp) {
            return address(0);
        }

        return reg.owner;
    }

    /// @notice Prevent ownership from being renounced.
    function renounceOwnership() public view override onlyOwner {
        revert RenounceOwnershipDisabled();
    }

    function _isAvailable(bytes32 labelHash) internal view returns (bool) {
        return _names[labelHash].expiry <= block.timestamp;
    }

    function _expiryFromNow(uint256 numYears_) internal view returns (uint64) {
        uint256 newExpiry = block.timestamp + (numYears_ * _YEAR);
        return uint64(newExpiry);
    }

    function _extendExpiry(uint64 currentExpiry, uint256 numYears_) internal pure returns (uint64) {
        uint256 newExpiry = uint256(currentExpiry) + (numYears_ * _YEAR);
        return uint64(newExpiry);
    }

    function _normalizeAndHash(string memory raw) internal pure returns (string memory normalizedLabel, bytes32 labelHash) {
        normalizedLabel = _normalize(raw);
        labelHash = keccak256(bytes(normalizedLabel));
    }

    function _normalize(string memory raw) internal pure returns (string memory normalizedLabel) {
        bytes memory input = bytes(raw);
        uint256 length = input.length;

        bool hasSuffix = _hasInterSuffix(input);
        uint256 labelLength = hasSuffix ? length - _INTER_SUFFIX_LENGTH : length;

        if (labelLength == 0 || labelLength > 64) revert InvalidLabel();

        bytes memory out = new bytes(labelLength);

        for (uint256 i = 0; i < labelLength; ++i) {
            uint8 c = uint8(input[i]);

            if (c >= 65 && c <= 90) {
                c += 32; // uppercase ASCII -> lowercase ASCII
            }

            bool isLower = c >= 97 && c <= 122;
            bool isDigit = c >= 48 && c <= 57;
            bool isHyphen = c == 45;

            if (!(isLower || isDigit || isHyphen)) revert InvalidLabel();
            if ((i == 0 || i == labelLength - 1) && isHyphen) revert InvalidLabel();

            out[i] = bytes1(c);
        }

        normalizedLabel = string(out);
    }

    function _hasInterSuffix(bytes memory input) internal pure returns (bool) {
        if (input.length < _INTER_SUFFIX_LENGTH) {
            return false;
        }

        uint256 start = input.length - _INTER_SUFFIX_LENGTH;

        return
            input[start] == bytes1(".") &&
            _toLower(input[start + 1]) == bytes1("i") &&
            _toLower(input[start + 2]) == bytes1("n") &&
            _toLower(input[start + 3]) == bytes1("t") &&
            _toLower(input[start + 4]) == bytes1("e") &&
            _toLower(input[start + 5]) == bytes1("r");
    }

    function _toLower(bytes1 b) internal pure returns (bytes1) {
        if (b >= bytes1("A") && b <= bytes1("Z")) {
            return bytes1(uint8(b) + 32);
        }
        return b;
    }
}
