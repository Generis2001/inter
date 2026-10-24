# Inter Wallet — Security Patch Architecture & Overview

This document outlines the security architecture, hardening patches, and safeguards implemented in **Inter Wallet**.

---

## 1. Transaction PIN Verification Gate
- **Component**: [`src/components/shared/PinVerificationModal.tsx`](file:///C:/Users/hp/.gemini/antigravity-ide/scratch/inter/src/components/shared/PinVerificationModal.tsx) & [`src/utils/securitySettings.ts`](file:///C:/Users/hp/.gemini/antigravity-ide/scratch/inter/src/utils/securitySettings.ts)
- **Scope**: Outgoing transfers ([`SendSheet.tsx`](file:///C:/Users/hp/.gemini/antigravity-ide/scratch/inter/src/components/wallet/SendSheet.tsx)) and token swaps ([`SwapScreen.tsx`](file:///C:/Users/hp/.gemini/antigravity-ide/scratch/inter/src/components/wallet/SwapScreen.tsx)).
- **Mechanism**:
  - Requires the user to enter their 6-digit PIN before any transaction is signed or broadcasted.
  - Verification occurs directly against the PBKDF2/AES-GCM encrypted keystore vault.
  - Includes progressive lockout protection to thwart brute-force attempts.
  - Can be toggled on/off in Settings according to user security preference.

---

## 2. Exact-Amount Token Approvals
- **Files**: [`src/hooks/useTowerSwap.ts`](file:///C:/Users/hp/.gemini/antigravity-ide/scratch/inter/src/hooks/useTowerSwap.ts), [`src/hooks/useV4Swap.ts`](file:///C:/Users/hp/.gemini/antigravity-ide/scratch/inter/src/hooks/useV4Swap.ts)
- **Problem Solved**: Most Web3 interfaces request infinite (`uint256.max`) token spending allowances, leaving user funds vulnerable if a router or protocol contract is ever exploited.
- **Solution**:
  - Approvals default strictly to the **exact amount required** for the single execution.
  - After the trade completes, no lingering allowance remains for third-party contracts to drain.
  - Power users who want to avoid gas costs on repeat trades have an optional "Unlimited Approval" toggle with explicit warnings.

---

## 3. Approved Spenders & Allowance Revocation Manager
- **Component**: [`src/components/wallet/ApprovedSpendersModal.tsx`](file:///C:/Users/hp/.gemini/antigravity-ide/scratch/inter/src/components/wallet/ApprovedSpendersModal.tsx) & [`src/utils/allowances.ts`](file:///C:/Users/hp/.gemini/antigravity-ide/scratch/inter/src/utils/allowances.ts)
- **Features**:
  - Automatically indexes and monitors all third-party spenders (Tower Exchange, Uniswap v4 Permit2, Universal Router) that have active allowances on USDC and EURC.
  - Displays remaining spending limits in user-readable currency values.
  - Provides a single-click **Revoke** action (`approve(spender, 0)`) to cancel permissions at any time directly within the wallet settings.

---

## 4. Protected Recovery Phrase Reveal
- **File**: [`src/components/wallet/SettingsScreen.tsx`](file:///C:/Users/hp/.gemini/antigravity-ide/scratch/inter/src/components/wallet/SettingsScreen.tsx)
- **Mechanism**:
  - The 12-word mnemonic seed phrase is shielded behind mandatory PIN re-authentication.
  - Protects against shoulder surfing, unauthorized physical access, or unattended unlocked sessions.
  - Prevents clipboard scraping by requiring an intentional reveal gesture.

---

## 5. Account & Multi-Wallet Isolation
- **File**: [`src/hooks/useArcTransactions.ts`](file:///C:/Users/hp/.gemini/antigravity-ide/scratch/inter/src/hooks/useArcTransactions.ts)
- **Mechanism**:
  - Transaction histories and activity logs are strictly partitioned per wallet address (`inter_wallet_txs_<address>`).
  - Switching accounts instantly purges memory states to guarantee zero cross-wallet data bleed.
  - All sensitive keystore credentials remain isolated inside the encrypted browser vault.
