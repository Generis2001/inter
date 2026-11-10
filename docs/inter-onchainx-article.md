# Inter is uniting onchainX on Arc. Abating ambiguity.

Inter brings the essential activities of an onchain money life into one self-custodial wallet built around Arc. Holding USDC and EURC, sending a payment, exchanging currencies, finding a recipient by name, moving USDC between networks, and following transaction activity become parts of a connected experience. Each action has a place, a purpose, and a result the user can inspect.

For someone using onchain money, uncertainty often appears between actions. An address arrives without a network attached. A swap requires an approval whose meaning is unclear. A bridge confirms on the sending network while the funds are still unavailable on the receiving network. A transaction hash appears, but the person still needs to establish what happened and what to do next.

These are practical obstacles to using money. They affect whether someone can confidently receive a payment, exchange part of a balance, or move funds to the network where they intend to use them. Inter addresses them by connecting the actions and making the information needed for each decision visible.

In this framing, *onchainX* describes the range of activities people carry out onchain. Inter's contribution begins with the activities that make stablecoin money useful: ownership, payments, exchange, identity, and movement between networks. Bringing those activities together gives users a continuous path through their money's journey.

Arc provides a useful foundation for that path because its native gas currency is USDC. Inter can present an Arc payment and its network fee in the same familiar currency. Someone sending EURC still needs USDC for gas, and the wallet makes that requirement part of the transaction experience. Costs remain estimates until execution, but the unit in which the user understands them is straightforward.

Inter also brings dollars and euros into the same wallet through USDC and EURC. Those assets retain their separate currency meanings: USDC represents dollar value, while EURC represents euro value. Moving between them requires an exchange rate and an execution route. The wallet connects holding and exchanging these assets while keeping the selected token visible throughout the action.

The interface organizes that experience around familiar verbs: Send, Receive, Swap, and Bridge. Balances and recent activity provide the starting point. The user can move from seeing an asset to acting on it, then return to a record of the operation. The selected Arc network follows the experience through balances, token contracts, transactions, and explorer links.

Ownership is the foundation underneath those screens. Inter creates a wallet locally or imports one from a recovery phrase or private key. It encrypts the wallet's recovery material in a vault stored on the device and unlocks it with a PIN or password. Transactions are signed locally using the unlocked account; the network receives the signed transaction.

This makes the relationship between the user and the wallet clear. The user controls the account and its signing authority. The local unlock credential protects access to that device's vault, while the recovery phrase or private key remains the basis for restoring the account elsewhere. Inter also lets users enable an additional authorization check before transactions, adding a deliberate checkpoint before signing.

The transfer flow translates that ownership into a concrete payment. The user chooses USDC or EURC, enters a recipient and amount, reviews the transfer and its estimated gas fee, and authorizes it. Inter uses the token contract for the selected network and submits the transfer from the user's local account. The transaction appears in activity, with a hash that opens the relevant explorer.

Receiving carries the same attention to context. Inter presents the wallet address as text and as a QR code, with copy and share options. The selected asset and network appear alongside it. That pairing matters because the same address can exist across several networks, while a balance belongs to a particular asset on a particular chain. The receive screen gives the sender that context alongside the destination.

Names add a more recognizable way to address a payment. Inter integrates Arc Name Service, or ArcNS, to resolve `.arc` and `.circle` names to wallet addresses. A person can enter a name in the send flow, see the address it resolves to, and continue with the transfer. Inter refreshes the name lookup immediately before constructing the transaction, reducing reliance on an earlier lookup.

The wallet can also display a primary name returned by ArcNS's verified reverse-resolution service. This connects a readable identity with the account while preserving the underlying address. A name becomes useful because the wallet connects it to an actual payment destination.

Inter makes the scope of this integration visible too. Its current naming screen describes ArcNS contracts as live on testnet, with mainnet deployment pending an independent audit by the ArcNS team. Name lookup is integrated into Inter; registration is managed through the ArcNS website. The screen also explains that testnet registrations will need to be registered again when mainnet registration launches. That distinction helps users understand what a name represents in the environment they are using.

Exchange introduces another set of decisions. A USDC-to-EURC swap changes the currency the user holds. Inter's primary swap route requests a quote from Tower Exchange, and the interface also offers a direct Uniswap v4 route on mainnet. The selected route is visible, alongside the estimated output and slippage setting.

The review screen brings the trade's terms together: the amount being spent, the estimated amount received, the displayed minimum received, the route, and the network fee estimate. Slippage expresses how much movement from the quoted terms the user intends to accept. These details give the person something concrete to assess before authorizing an exchange. Displayed output remains based on the quote; the executed transaction establishes the result.

Inter also gives token approvals a visible meaning. An approval grants a contract permission to spend a token. When a new swap approval is required, the default is to approve the amount needed for that swap. The user can explicitly select an unlimited approval for future swaps, with the choice shown in the review screen. The bridge uses an exact-amount approval when one is needed.

That visibility continues in Settings. Inter's approved-spender view reads allowances for supported tokens and known contracts, shows the permissions it finds, and lets the user revoke them. This gives permissions a place in the wallet's ongoing experience. A person can review the authority they have granted after the transaction that originally required it.

Bridging extends the journey into and out of Arc. Inter supports USDC movement between Arc and Base on mainnet, and between Arc Testnet and Base Sepolia on testnet. These routes stay within the same environment. The source funds must be held at the user's Inter address, and the bridge sends them to that same address on the destination network.

The bridge uses Circle's Cross-Chain Transfer Protocol V2, commonly called CCTP. Tower RPC provides the service through which Inter reads blockchain data and submits signed bridge transactions. CCTP burns USDC on the source network and, after Circle supplies an attestation confirming the burn message, allows the corresponding USDC to be minted on the destination. Inter signs the required transactions locally and follows the operation through both stages.

Before starting, the user reviews the source network, destination network, USDC amount, and gas estimates for both sides. Inter checks the configured route against the networks and CCTP contracts and checks Circle's fee data. Its supported standard settlement flow requires a zero protocol fee. Gas remains payable: USDC on Arc and ETH on Base, or the corresponding testnet currencies. Inter checks that gas is available on both networks.

The receiving stage requires the user's attention. Once settlement is ready, Inter presents a Receive USDC action. The user reviews the receiving network's gas estimate and confirms the destination transaction. The wallet distinguishes confirming the source transaction, waiting for settlement, being ready to receive, and confirming receipt. Each state tells the user where the operation stands and whether another action is needed.

Recovery is especially important here because a lost network response can leave someone unsure whether a transaction was submitted. Inter saves each signed bridge transaction and its computed hash before broadcasting it. If the response is lost, the wallet retains the identity of the transaction it attempted to send.

The retry action resends those same signed bytes. It continues the existing operation without constructing another burn. Saved bridge progress survives reloads, and unsettled operations are retained when older completed history is trimmed. This recovery record is stored locally, so preserving the app or extension's storage remains part of preserving a pending bridge's recovery path.

Inter checks the settlement message against the saved operation before signing the receiving transaction. The checks include the route, token, amount, sender, recipient, fee, and required finality. It also simulates bridge contract calls and checks prepared transaction fees against the reviewed budget. Completion requires evidence from the destination: a successful receiving transaction receipt or an onchain check showing that the validated CCTP message has already been used to complete the mint.

Together, these choices reduce the uncertainty surrounding a bridge. The user has a saved operation to return to, explicit stages to follow, a receiving action when it becomes available, and links to inspect the relevant transactions. The app connects the protocol's sequence to the person's goal of making USDC available on another network.

Activity brings the different actions back into one readable record. Inter classifies transfers, swaps, approvals, bridges, and other contract interactions. Token logos and labels help distinguish what moved and what kind of action occurred. Filters let users focus on sent funds, received funds, swaps, bridges, pending operations, or failures. Explorer links connect the wallet's presentation with the corresponding onchain transaction.

The records are scoped to both the wallet address and the actual chain ID. Mainnet and testnet activity stay separate, and delayed responses from a previous wallet or network are prevented from updating the active history. This gives the selected environment meaning throughout the app. A testnet action remains a testnet action when the user switches back to mainnet.

Consider a freelancer who holds USDC at their Inter address on Base and wants to use part of it on Arc. With gas available on both networks, they can review a bridge into Arc, follow settlement, and confirm receipt. They can then quote an exchange into EURC, review the route and approval, and authorize the swap. A later payment starts from the same wallet, with its recipient, currency, and fee visible before signing. The resulting activity connects those steps into a traceable journey.

That example illustrates what uniting onchainX means in practice. The user carries the same account and a consistent set of decisions across several activities. The wallet provides continuity from holding money to moving it, exchanging it, paying with it, and checking what happened.

Inter's web interface also forms the core of its Chrome extension popup and side panel, with an Android project for mobile builds. These formats bring the same wallet model and principal actions into different settings. The browser side panel, for example, keeps the wallet accessible alongside the page where a person is working.

Abating ambiguity is an ongoing product discipline. Currency, network, recipient, spending permission, fee, and settlement state all need clear meanings at the moment they affect a decision. Inter builds those meanings into connected flows, giving users a way to act and a record to return to afterward.

As more activity moves onchain, that continuity becomes increasingly valuable. A person should be able to understand what they hold, where it is, what they are authorizing, and what still needs their attention. Inter brings those questions into one Arc wallet, making the next action easier to understand and its result easier to follow.
