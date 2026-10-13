# 402Lab: submission form answers

Copy each field as is. Replace the two YouTube links after uploading.

## Basics

- **Project name:** 402Lab
- **One-liner:** The spending account for AI agents: agents pay any API per call in USDC on Solana, inside limits a human sets.
- **Track:** Solana
- **Category:** Payments / AI agents / Infrastructure
- **Repository:** https://github.com/emersonjds/402lab
- **Live app:** https://web-production-1b5d1.up.railway.app
- **Demo panel (no wallet needed):** https://web-demo-production-0d9a.up.railway.app/app
- **API docs:** https://api-production-570e4.up.railway.app/docs
- **Android app:** https://github.com/emersonjds/402lab/releases/download/v1.2.1/402lab-live.apk
- **Pitch video:** https://youtu.be/-d2uFvVrVgs
- **Technical demo video:** https://youtu.be/QJJrjnDbFy8

## Description

AI agents can already do real work, but paying for an API is still built for humans: a signup, a card and prepaid credit for every provider. Cards cannot charge cents (2.9% plus $0.30 on a $0.01 call is a 3,003% fee), prepaid credit expires, and in Brazil every international card purchase pays 3.5% IOF while about a quarter of people have no credit card.

402Lab gives each agent an allowance with a cap per call and per day. The agent pays every API call by itself in USDC on Solana through HTTP 402 (x402), with no popup and no SOL for gas. Every 30 seconds one Solana transaction splits the revenue: 85% to the provider, 5% to the integrator and 10% to the platform. The owner watches every payment live on the web and on the phone, pauses an agent with one tap, and gets one statement a month.

## How it uses Solana

- Payments are USDC transfers on Solana devnet, settled in about a second through the x402 `exact` scheme; the facilitator pays the network fee, so agents never hold SOL.
- The allowance policy runs before settlement, so a paused or over-cap agent never moves money.
- A split worker batches payouts into one Solana transaction with up to 8 `TransferChecked` instructions, with the signature saved before sending so a crash cannot pay twice.
- Owners sign in with Sign-In With Solana; every payment links to Solscan.

## What was built during the hackathon

Monorepo in TypeScript: Fastify API with x402 and a Postgres ledger, Next.js dashboard, Expo mobile app, an MCP server that lets any agent (Claude and others) pay, and shared domain code. Integration tests cover the API, the domain and the web (125 tests), with CI and automatic deploys to Railway.

## Team

**Emerson Silva**, founder. Tech lead at Porto Seguro in São Paulo. Ten years building web and mobile products for startups and companies like Santander, Sem Parar and Dotz. Focused on AI and agents. 6 hackathon wins.

## Prior work disclosure

The repository was created on 2026-10-10, during the hackathon, and all code in it was written then. Before that there was only an early pay-per-call prototype on Base Sepolia, which is not part of this repository. Open-source libraries (x402, @solana/kit, Fastify, Next.js, Expo) are used as dependencies.

## Business model and next steps

We earn 10% of every paid call. Next: mainnet with a licensed custody partner, Pix on-ramp for people without a card, and an on-chain splitter program so the split is atomic with the payment.
