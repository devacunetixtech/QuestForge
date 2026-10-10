# QuestForge

**Create quests. Complete missions. Earn on-chain.**

QuestForge is a BOT Chain quest platform. Creators fund a quest in native BOT, participants submit a URL or short text as proof, and creator approval pays the reward directly from the contract.

## Features

- Dedicated landing page with wallet-gated app access
- On-chain quest creation with funded per-winner rewards
- Live quest discovery and detail view
- URL/text proof submissions
- Creator approval and immediate BOT payout
- Wallet dashboard for created and submitted quests
- Personal completed-quest and reward history
- Friendly empty, pending, success, and error states
- BOT Chain Mainnet support (chain ID `677`)
- Matching favicon, SVG logo, and 1024×1024 social profile image in `public/`

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_QUESTFORGE_ADDRESS` only when overriding the address recorded by the deployment workflow.

No quest, wallet, submission, or transaction data is mocked. The interface reads from BOT Chain Mainnet and sends writes through the connected wallet.

## Contract tests

Install Foundry, then run `forge test --root contracts -vvv`.

## BOT Chain Mainnet deployment

Add `PRIVATE_KEY` and `BLOCKSCOUT_API_KEY` as GitHub Actions repository secrets, fund the deployer with mainnet BOT, then run **Deploy QuestForge to BOT Chain Mainnet** from the Actions tab. The workflow:

1. tests the contract;
2. confirms the RPC reports chain ID `677`;
3. deploys and verifies the contract on BOT Chain Blockscout;
4. commits the deployed address to `lib/deployment.ts`, which updates the application.

The private key may be saved with or without the `0x` prefix. Never commit private keys, `.env.local`, Foundry broadcast artifacts, build output, or generated wallet material.

## Six low-gas wallet interactions

After the mainnet deployment workflow succeeds, run **Create Six Mainnet Wallet Interactions**. It creates six one-use wallets, funds only their estimated proof-submission gas with a small safety buffer, and has each wallet submit a one-character proof to one minimal quest. It does not run the more expensive approval/payout calls.

The six public addresses and transaction links are written to the workflow summary and a downloadable `wallet-addresses` artifact. Private keys are masked and are never saved.

## Brand assets

- `public/favicon.svg` — browser favicon
- `public/logo.svg` — scalable social/profile logo
- `public/logo.png` — 1024×1024 social/profile logo

## Network

| Setting | Value |
| --- | --- |
| Network | BOT Chain Mainnet |
| Chain ID | `677` (`0x2a5`) |
| RPC | `https://rpc.botchain.ai` |
| Explorer | `https://scan.botchain.ai` |
| Native token | BOT |
