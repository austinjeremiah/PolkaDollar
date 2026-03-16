# v0-design-brutalist-ai-saa-s

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_8TpuWUx50ueEUkhNLWoZQ7AylS69)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## XCM Bridge Page

The bridge UI is available at `/bridge`.

It uses two connections:

- MetaMask + `ethers` for EVM contract calls
- `@polkadot/api` WebSocket for SCALE XCM encoding

Create `frontend/.env.local` with:

```bash
NEXT_PUBLIC_EVM_RPC_URL="https://testnet-passet-hub-eth-rpc.polkadot.io"
NEXT_PUBLIC_WS_RPC_URL="wss://asset-hub-paseo-rpc.dwellir.com"
NEXT_PUBLIC_XCM_TRANSFER_ADDRESS="0xYourXcmTransferOrMockAddress"
```

Then run:

```bash
pnpm dev
```

Bridge flow:

1. Open `/bridge`
2. Connect MetaMask
3. Enter recipient SS58 + amount
4. Build XCM bytes
5. Send through `XCMTransfer` (or `MockXCMTransfer` fallback)

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.

<a href="https://v0.app/chat/api/kiro/clone/rajdesai17/v0-design-brutalist-ai-saa-s" alt="Open in Kiro"><img src="https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true" /></a>
