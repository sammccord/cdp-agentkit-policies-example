# cdp-agentkit-policies

This repository demonstrates how you can use a CDP Wallet Policy in conjunction with Agentkit to enforce guardrails for your agent workflows.

## Tools Utilized

- [CDP SDK](https://github.com/coinbase/cdp-sdk)
- [Agentkit](https://github.com/coinbase/agentkit)
- [AI SDK](https://github.com/vercel/ai)
- [Bun](https://bun.sh/)

## Running the example

Setup environment variables:

```bash
cp .env.example .env
```

Head over to the [CDP Portal](https://portal.cdp.coinbase.com/), generate a new API key, and wallet secret.

To run the example, we'll need the following:

```bash
CDP_API_KEY_ID="YOUR_API_KEY_ID"
CDP_API_KEY_SECRET="YOUR_API_KEY_SECRET"
CDP_WALLET_SECRET="YOUR_WALLET_SECRET"
ANTHROPIC_API_KEY="YOUR_ANTHROPIC_API_KEY"
```

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```
