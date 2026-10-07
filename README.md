# inter

> Non-custodial crypto wallet for Arc (USDC and EURC supported).

## Features

- **Non-Custodial Wallet**: Full ownership and security over your keys and assets.
- **Arc Network Native**: Optimized for Arc blockchain with support for USDC & EURC.
- **Modern Web3 Stack**: Built with React 18, Vite, TypeScript, Tailwind CSS, wagmi v2, viem v2, and ConnectKit.
- **Smart Contracts**: Foundry-based smart contracts with full test suites in Solidity.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (or Node.js >= 18)
- [Foundry](https://book.getfoundry.sh/) (for smart contract builds and tests)

### Installation

```bash
bun install
```

### Development

```bash
bun run dev
```

### Smart Contracts

```bash
# Build contracts
bun run contracts:build

# Run tests
bun run contracts:test
```

## License

MIT
