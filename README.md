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
- BOT Chain Testnet support (chain ID `968`)
- Matching favicon, SVG logo, and 1024×1024 social profile image in `public/`

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set `NEXT_PUBLIC_QUESTFORGE_ADDRESS` after deploying the contract.

No quest, wallet, submission, or transaction data is mocked. The interface reads from BOT Chain Testnet and sends writes through the connected wallet.

## Contract tests

Install Foundry, then run `forge test --root contracts -vvv`.

## BOT Chain Testnet deployment

Fund the deployer from [the BOT Chain faucet](https://faucet.botchain.ai), add its private key to your local environment with a `0x` prefix, then run:

```bash
set -a
source .env.local
set +a
forge script contracts/script/DeployBotchain.s.sol:DeployBotchain \
  --root contracts \
  --rpc-url "$BOTCHAIN_RPC_URL" \
  --broadcast \
  --verify \
  --verifier blockscout \
  --verifier-url "$BOTCHAIN_VERIFIER_URL" \
  --slow
```

Copy the deployed address into `NEXT_PUBLIC_QUESTFORGE_ADDRESS` and rebuild the frontend. Never commit `.env.local`, private keys, broadcast artifacts, or build output.

### GitHub Actions deployment

Add `PRIVATE_KEY` and `BLOCKSCOUT_API_KEY` as GitHub Actions repository secrets, then run **Deploy QuestForge to BOT Chain Testnet** from the Actions tab. The workflow tests the contract, deploys and verifies it, and commits the deployed address to `lib/deployment.ts`. The private key may include the `0x` prefix; if yours does not, add it when saving the secret.

## Brand assets

- `public/favicon.svg` — browser favicon
- `public/logo.svg` — scalable social/profile logo
- `public/logo.png` — 1024×1024 social/profile logo

## Network

| Setting | Value |
| --- | --- |
| Network | BOT Chain Testnet |
| Chain ID | `968` |
| RPC | `https://rpc.bohr.life` |
| Explorer | `https://scan.bohr.life` |
| Native token | BOT |
