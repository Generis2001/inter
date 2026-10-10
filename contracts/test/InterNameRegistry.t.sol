// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {InterNameRegistry} from "../InterNameRegistry.sol";
import {MockERC20} from "../test-helpers/MockERC20.sol";

/// @dev Handler contract for invariant testing — wraps state-changing calls so
///      the fuzzer can drive them through a typed interface.
contract RegistryHandler is Test {
    InterNameRegistry public registry;
    MockERC20 public usdc;

    address public actor = makeAddr("handler_actor");

    uint256 public totalFeesPaid;
    uint256 public totalFeesWithdrawn;

    uint256 internal constant ANNUAL_FEE = 500_000; // 0.50 USDC

    constructor(InterNameRegistry registry_, MockERC20 usdc_) {
        registry = registry_;
        usdc = usdc_;

        // Give the actor plenty of USDC and approve the registry.
        usdc.mint(actor, 1_000_000e6);
        vm.prank(actor);
        usdc.approve(address(registry), type(uint256).max);
    }

    /// @dev Register a name; track fees paid.
    function registerName(string calldata label, uint256 numYears) external {
        numYears = bound(numYears, 1, 10);

        // Only attempt if the name is available.
        try registry.isAvailable(label) returns (bool avail) {
            if (!avail) return;
        } catch {
            return;
        }

        uint256 fee = ANNUAL_FEE * numYears;

        vm.prank(actor);
        try registry.register(label, numYears, address(0)) {
            totalFeesPaid += fee;
        } catch {
            // Label validation revert — not an invariant violation.
        }
    }

    /// @dev Withdraw accumulated fees (called as owner).
    function withdrawFees(address owner_) external {
        uint256 balance = usdc.balanceOf(address(registry));
        vm.prank(owner_);
        try registry.withdraw() {
            totalFeesWithdrawn += balance;
        } catch {}
    }
}

contract InterNameRegistryTest is Test {
    // ─── constants ───────────────────────────────────────────────────────────
    uint256 internal constant ANNUAL_FEE    = 500_000;  // 0.50 USDC (6 dec)
    uint256 internal constant MAX_ANNUAL_FEE = 1_000_000;
    uint256 internal constant YEAR         = 365 days;

    // ─── actors ──────────────────────────────────────────────────────────────
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob   = makeAddr("bob");

    // ─── contracts ───────────────────────────────────────────────────────────
    MockERC20         internal usdc;
    InterNameRegistry internal registry;

    // ─── setUp ───────────────────────────────────────────────────────────────
    function setUp() public {
        // 1. Deploy mock USDC.
        usdc = new MockERC20("Mock USDC", "mUSDC", 6);

        // 2. Deploy registry.
        registry = new InterNameRegistry(address(usdc), ANNUAL_FEE, owner);

        // 3. Fund alice & bob and grant allowances.
        usdc.mint(alice, 1_000_000e6);
        usdc.mint(bob,   1_000_000e6);
        vm.prank(alice);
        usdc.approve(address(registry), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(registry), type(uint256).max);

        // 4. Create invariant handler and target it.
        handler = new RegistryHandler(registry, usdc);
        targetContract(address(handler));
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    function test_Constructor_SetsFields() public view {
        assertEq(registry.usdc(),       address(usdc));
        assertEq(registry.annualFee(),  ANNUAL_FEE);
        assertEq(registry.owner(),      owner);
    }

    function test_Constructor_RevertZeroUsdc() public {
        vm.expectRevert(InterNameRegistry.InvalidUsdc.selector);
        new InterNameRegistry(address(0), ANNUAL_FEE, owner);
    }

    function test_Constructor_RevertEoaUsdc() public {
        address eoa = makeAddr("eoa");
        vm.expectRevert(InterNameRegistry.UsdcNotAContract.selector);
        new InterNameRegistry(eoa, ANNUAL_FEE, owner);
    }

    function test_Constructor_RevertFeeTooHigh() public {
        vm.expectRevert(InterNameRegistry.FeeTooHigh.selector);
        new InterNameRegistry(address(usdc), MAX_ANNUAL_FEE + 1, owner);
    }

    // =========================================================================
    // REGISTER — happy paths
    // =========================================================================

    function test_Register_BareLabel_1Year() public {
        uint256 balBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        registry.register("alice", 1, address(0));

        // Fee deducted
        assertEq(usdc.balanceOf(alice), balBefore - ANNUAL_FEE * 1);
        // Registry holds the fee
        assertEq(usdc.balanceOf(address(registry)), ANNUAL_FEE * 1);
        // Expiry is ~1 year from now
        uint64 expiry = registry.expiryOf("alice");
        assertApproxEqAbs(uint256(expiry), block.timestamp + YEAR, 5);
        // Owner set correctly
        assertEq(registry.ownerOf("alice"), alice);
    }

    function test_Register_BareLabel_2Years() public {
        uint256 balBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        registry.register("alice", 2, address(0));

        assertEq(usdc.balanceOf(alice), balBefore - ANNUAL_FEE * 2);
        uint64 expiry = registry.expiryOf("alice");
        assertApproxEqAbs(uint256(expiry), block.timestamp + 2 * YEAR, 5);
    }

    function test_Register_WithInterSuffix() public {
        // "alice.inter" should hash the same as "alice"
        vm.prank(alice);
        registry.register("alice.inter", 1, address(0));

        assertEq(registry.ownerOf("alice"), alice);
        assertEq(registry.ownerOf("alice.inter"), alice);
    }

    function test_Register_DefaultsResolvedToMsgSender() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        assertEq(registry.resolve("alice"), alice);
    }

    function test_Register_ExplicitResolvedTo() public {
        vm.prank(alice);
        registry.register("alice", 1, bob);

        assertEq(registry.resolve("alice"), bob);
    }

    function test_Register_EmitsNameRegistered() public {
        bytes32 labelHash = keccak256(bytes("alice"));
        uint64 expectedExpiry = uint64(block.timestamp + YEAR);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(registry));
        emit InterNameRegistry.NameRegistered(labelHash, "alice", alice, alice, expectedExpiry);
        registry.register("alice", 1, address(0));
    }

    function test_Register_CorrectExpiry_MaxYears() public {
        vm.prank(alice);
        registry.register("maxtest", 10, address(0));

        uint64 expiry = registry.expiryOf("maxtest");
        assertApproxEqAbs(uint256(expiry), block.timestamp + 10 * YEAR, 5);
    }

    // =========================================================================
    // REGISTER — revert paths
    // =========================================================================

    function test_Register_RevertNameUnavailable() public {
        vm.prank(alice);
        registry.register("taken", 1, address(0));

        vm.prank(bob);
        vm.expectRevert(InterNameRegistry.NameUnavailable.selector);
        registry.register("taken", 1, address(0));
    }

    function test_Register_RevertInvalidYears_Zero() public {
        vm.prank(alice);
        vm.expectRevert(InterNameRegistry.InvalidYears.selector);
        registry.register("alice", 0, address(0));
    }

    function test_Register_RevertInvalidYears_TooHigh() public {
        vm.prank(alice);
        vm.expectRevert(InterNameRegistry.InvalidYears.selector);
        registry.register("alice", 11, address(0));
    }

    function test_Register_RevertInvalidLabel_Empty() public {
        vm.prank(alice);
        vm.expectRevert(InterNameRegistry.InvalidLabel.selector);
        registry.register("", 1, address(0));
    }

    function test_Register_RevertInvalidLabel_LeadingHyphen() public {
        vm.prank(alice);
        vm.expectRevert(InterNameRegistry.InvalidLabel.selector);
        registry.register("-bad", 1, address(0));
    }

    function test_Register_RevertInvalidLabel_TrailingHyphen() public {
        vm.prank(alice);
        vm.expectRevert(InterNameRegistry.InvalidLabel.selector);
        registry.register("bad-", 1, address(0));
    }

    function test_Register_RevertInvalidLabel_NonAscii() public {
        // 0xC3 0xA9 = UTF-8 "é" — not [a-z0-9-]
        vm.prank(alice);
        vm.expectRevert(InterNameRegistry.InvalidLabel.selector);
        registry.register(unicode"café", 1, address(0));
    }

    // =========================================================================
    // RENEW — happy path
    // =========================================================================

    function test_Renew_ExtendsExpiry() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        uint64 expiryBefore = registry.expiryOf("alice");
        uint256 balBefore   = usdc.balanceOf(alice);

        vm.prank(alice);
        registry.renew("alice", 2);

        uint64 expiryAfter = registry.expiryOf("alice");
        assertEq(uint256(expiryAfter), uint256(expiryBefore) + 2 * YEAR);
        assertEq(usdc.balanceOf(alice), balBefore - ANNUAL_FEE * 2);
    }

    function test_Renew_EmitsNameRenewed() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        uint64 currentExpiry = registry.expiryOf("alice");
        uint64 expectedNewExpiry = uint64(uint256(currentExpiry) + YEAR);
        bytes32 labelHash = keccak256(bytes("alice"));

        vm.prank(alice);
        vm.expectEmit(true, true, false, true, address(registry));
        emit InterNameRegistry.NameRenewed(labelHash, alice, expectedNewExpiry);
        registry.renew("alice", 1);
    }

    // =========================================================================
    // RENEW — revert paths
    // =========================================================================

    function test_Renew_RevertNotNameOwner() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        vm.prank(bob);
        vm.expectRevert(InterNameRegistry.NotNameOwner.selector);
        registry.renew("alice", 1);
    }

    function test_Renew_RevertNameExpired() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        // Warp past expiry.
        vm.warp(block.timestamp + YEAR + 1);

        vm.prank(alice);
        vm.expectRevert(InterNameRegistry.NameExpired.selector);
        registry.renew("alice", 1);
    }

    function test_Renew_RevertInvalidYears_Zero() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        vm.prank(alice);
        vm.expectRevert(InterNameRegistry.InvalidYears.selector);
        registry.renew("alice", 0);
    }

    function test_Renew_RevertInvalidYears_TooHigh() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        vm.prank(alice);
        vm.expectRevert(InterNameRegistry.InvalidYears.selector);
        registry.renew("alice", 11);
    }

    // =========================================================================
    // TRANSFER — happy path
    // =========================================================================

    function test_Transfer_HappyPath() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        bytes32 labelHash = keccak256(bytes("alice"));

        vm.prank(alice);
        vm.expectEmit(true, true, true, false, address(registry));
        emit InterNameRegistry.NameTransferred(labelHash, alice, bob);
        registry.transfer("alice", bob);

        assertEq(registry.ownerOf("alice"), bob);
    }

    // =========================================================================
    // TRANSFER — revert paths
    // =========================================================================

    function test_Transfer_RevertZeroAddress() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        vm.prank(alice);
        vm.expectRevert(InterNameRegistry.ZeroAddress.selector);
        registry.transfer("alice", address(0));
    }

    function test_Transfer_RevertNotNameOwner() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        vm.prank(bob);
        vm.expectRevert(InterNameRegistry.NotNameOwner.selector);
        registry.transfer("alice", bob);
    }

    function test_Transfer_RevertNameExpired() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        vm.warp(block.timestamp + YEAR + 1);

        vm.prank(alice);
        vm.expectRevert(InterNameRegistry.NameExpired.selector);
        registry.transfer("alice", bob);
    }

    // =========================================================================
    // SET RESOLVED — happy path
    // =========================================================================

    function test_SetResolved_HappyPath() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        bytes32 labelHash = keccak256(bytes("alice"));

        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(registry));
        emit InterNameRegistry.ResolvedAddressSet(labelHash, bob);
        registry.setResolved("alice", bob);

        assertEq(registry.resolve("alice"), bob);
    }

    // =========================================================================
    // SET RESOLVED — revert paths
    // =========================================================================

    function test_SetResolved_RevertNotNameOwner() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        vm.prank(bob);
        vm.expectRevert(InterNameRegistry.NotNameOwner.selector);
        registry.setResolved("alice", bob);
    }

    function test_SetResolved_RevertNameExpired() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        vm.warp(block.timestamp + YEAR + 1);

        vm.prank(alice);
        vm.expectRevert(InterNameRegistry.NameExpired.selector);
        registry.setResolved("alice", bob);
    }

    // =========================================================================
    // SET PRIMARY NAME — happy path
    // =========================================================================

    function test_SetPrimaryName_HappyPath() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));
        // resolved defaults to alice, so alice can set primary.

        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(registry));
        emit InterNameRegistry.PrimaryNameSet(alice, "alice");
        registry.setPrimaryName("alice");

        assertEq(registry.lookupAddress(alice), "alice");
    }

    function test_SetPrimaryName_WithInterSuffix() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        vm.prank(alice);
        registry.setPrimaryName("alice.inter");

        // lookupAddress returns normalized label without suffix
        assertEq(registry.lookupAddress(alice), "alice");
    }

    // =========================================================================
    // SET PRIMARY NAME — revert paths
    // =========================================================================

    function test_SetPrimaryName_RevertNotResolvedAddress() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));
        // resolved = alice; bob tries to set primary.

        vm.prank(bob);
        vm.expectRevert(InterNameRegistry.NotResolvedAddress.selector);
        registry.setPrimaryName("alice");
    }

    function test_SetPrimaryName_RevertNameExpired() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        vm.warp(block.timestamp + YEAR + 1);

        vm.prank(alice);
        vm.expectRevert(InterNameRegistry.NameExpired.selector);
        registry.setPrimaryName("alice");
    }

    // =========================================================================
    // CLEAR PRIMARY NAME
    // =========================================================================

    function test_ClearPrimaryName_ClearsCorrectly() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));
        vm.prank(alice);
        registry.setPrimaryName("alice");

        assertEq(registry.lookupAddress(alice), "alice");

        vm.prank(alice);
        vm.expectEmit(true, false, false, false, address(registry));
        emit InterNameRegistry.PrimaryNameCleared(alice);
        registry.clearPrimaryName();

        assertEq(registry.lookupAddress(alice), "");
    }

    // =========================================================================
    // RESOLVE
    // =========================================================================

    function test_Resolve_ReturnsResolvedForActiveName() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        assertEq(registry.resolve("alice"), alice);
    }

    function test_Resolve_ReturnsZeroAfterExpiry() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        vm.warp(block.timestamp + YEAR + 1);

        assertEq(registry.resolve("alice"), address(0));
    }

    function test_Resolve_ReturnsZeroForUnregistered() public view {
        assertEq(registry.resolve("nonexistent"), address(0));
    }

    // =========================================================================
    // LOOKUP ADDRESS
    // =========================================================================

    function test_LookupAddress_ReturnCorrectLabel() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));
        vm.prank(alice);
        registry.setPrimaryName("alice");

        assertEq(registry.lookupAddress(alice), "alice");
    }

    function test_LookupAddress_ReturnsEmptyWhenPrimaryExpired() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));
        vm.prank(alice);
        registry.setPrimaryName("alice");

        vm.warp(block.timestamp + YEAR + 1);

        assertEq(registry.lookupAddress(alice), "");
    }

    function test_LookupAddress_ReturnsEmptyWhenNoPrimary() public view {
        assertEq(registry.lookupAddress(alice), "");
    }

    // =========================================================================
    // IS AVAILABLE
    // =========================================================================

    function test_IsAvailable_TrueBeforeRegister() public view {
        assertTrue(registry.isAvailable("fresh"));
    }

    function test_IsAvailable_FalseAfterRegister() public {
        vm.prank(alice);
        registry.register("fresh", 1, address(0));

        assertFalse(registry.isAvailable("fresh"));
    }

    function test_IsAvailable_TrueAfterExpiry() public {
        vm.prank(alice);
        registry.register("fresh", 1, address(0));

        vm.warp(block.timestamp + YEAR + 1);

        assertTrue(registry.isAvailable("fresh"));
    }

    // =========================================================================
    // SET ANNUAL FEE
    // =========================================================================

    function test_SetAnnualFee_OnlyOwner() public {
        vm.prank(owner);
        vm.expectEmit(false, false, false, true, address(registry));
        emit InterNameRegistry.AnnualFeeUpdated(ANNUAL_FEE, 100_000);
        registry.setAnnualFee(100_000);

        assertEq(registry.annualFee(), 100_000);
    }

    function test_SetAnnualFee_RevertNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();   // OwnableUnauthorizedAccount
        registry.setAnnualFee(100_000);
    }

    function test_SetAnnualFee_RevertFeeTooHigh() public {
        vm.prank(owner);
        vm.expectRevert(InterNameRegistry.FeeTooHigh.selector);
        registry.setAnnualFee(MAX_ANNUAL_FEE + 1);
    }

    function test_SetAnnualFee_CapsAtMaxFee() public {
        // MAX_ANNUAL_FEE itself should succeed
        vm.prank(owner);
        registry.setAnnualFee(MAX_ANNUAL_FEE);
        assertEq(registry.annualFee(), MAX_ANNUAL_FEE);
    }

    function test_SetAnnualFee_EmitsAnnualFeeUpdated() public {
        vm.prank(owner);
        vm.expectEmit(false, false, false, true, address(registry));
        emit InterNameRegistry.AnnualFeeUpdated(ANNUAL_FEE, 200_000);
        registry.setAnnualFee(200_000);
    }

    // =========================================================================
    // WITHDRAW
    // =========================================================================

    function test_Withdraw_SendsUsdcToOwner() public {
        // Alice registers, fees accumulate in registry.
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        uint256 ownerBalBefore  = usdc.balanceOf(owner);
        uint256 registryBalance = usdc.balanceOf(address(registry));
        assertEq(registryBalance, ANNUAL_FEE);

        vm.prank(owner);
        vm.expectEmit(true, false, false, true, address(registry));
        emit InterNameRegistry.FeesWithdrawn(owner, registryBalance);
        registry.withdraw();

        assertEq(usdc.balanceOf(owner),            ownerBalBefore + registryBalance);
        assertEq(usdc.balanceOf(address(registry)), 0);
    }

    function test_Withdraw_RevertNonOwner() public {
        vm.prank(alice);
        registry.register("alice", 1, address(0));

        vm.prank(alice);
        vm.expectRevert(); // OwnableUnauthorizedAccount
        registry.withdraw();
    }

    // =========================================================================
    // RENOUNCE OWNERSHIP
    // =========================================================================

    function test_RenounceOwnership_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(InterNameRegistry.RenounceOwnershipDisabled.selector);
        registry.renounceOwnership();
    }

    // =========================================================================
    // ETH REJECTION
    // =========================================================================

    function test_Receive_RevertsEther() public {
        vm.deal(alice, 1 ether);
        // No receive() declared — ETH transfers revert with no data.
        (bool ok,) = address(registry).call{value: 1 ether}("");
        assertFalse(ok, "ETH transfer should have failed");
    }

    // =========================================================================
    // FUZZ: register with various numYears and labels
    // =========================================================================

    /// @dev Verify fee = annualFee * numYears for all valid year values.
    function testFuzz_Register_FeeScalesWithYears(uint256 numYears) public {
        numYears = bound(numYears, 1, 10);

        uint256 balBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        registry.register("fuzzname", numYears, address(0));

        uint256 expectedFee = ANNUAL_FEE * numYears;
        assertEq(usdc.balanceOf(alice), balBefore - expectedFee);
        assertEq(usdc.balanceOf(address(registry)), expectedFee);
    }

    /// @dev Verify expiry = block.timestamp + numYears * 365 days.
    function testFuzz_Register_ExpiryIsCorrect(uint256 numYears) public {
        numYears = bound(numYears, 1, 10);

        vm.prank(alice);
        registry.register("fuzzexpiry", numYears, address(0));

        uint64 expiry = registry.expiryOf("fuzzexpiry");
        assertEq(uint256(expiry), block.timestamp + numYears * YEAR);
    }

    /// @dev Verify that valid lowercase labels (single ASCII letter) all succeed.
    function testFuzz_Register_ValidLabelCharacter(uint8 c) public {
        // Only test valid lowercase letters a-z.
        c = uint8(bound(c, 97, 122)); // 'a'..'z'
        string memory lbl = string(abi.encodePacked(bytes1(c)));

        // Use a unique user per character so names don't collide.
        address user = makeAddr(string(abi.encodePacked("user_", bytes1(c))));
        usdc.mint(user, 1_000e6);
        vm.prank(user);
        usdc.approve(address(registry), type(uint256).max);

        vm.prank(user);
        registry.register(lbl, 1, address(0));

        assertEq(registry.ownerOf(lbl), user);
    }

    /// @dev Verify that renew fee also scales: annualFee * additionalYears.
    function testFuzz_Renew_FeeScalesWithYears(uint256 addYears) public {
        addYears = bound(addYears, 1, 10);

        vm.prank(alice);
        registry.register("renewfuzz", 1, address(0));

        uint256 balBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        registry.renew("renewfuzz", addYears);

        assertEq(usdc.balanceOf(alice), balBefore - ANNUAL_FEE * addYears);
    }

    // =========================================================================
    // INVARIANT: USDC balance >= fees paid – fees withdrawn
    // =========================================================================

    RegistryHandler internal handler;

    function invariant_UsdcBalanceCoversAccumulatedFees() public view {
        uint256 contractBalance = usdc.balanceOf(address(registry));
        uint256 netFees = handler.totalFeesPaid() - handler.totalFeesWithdrawn();
        assertGe(contractBalance, netFees);
    }
}
