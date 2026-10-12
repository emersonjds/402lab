# 402Lab: project briefing

**One line.** A spending account for AI agents: a human sets an allowance, and the agent pays any
API per call in USDC on Solana through HTTP 402 (x402), inside those limits.

## Why it exists

Paid APIs were built for humans with cards. A card cannot charge one cent (2.9% + US$0.30 on a
US$0.01 call is a 3,003% fee), prepaid credit is locked per vendor and expires, and in Brazil
every international card purchase pays 3.5% IOF while about a quarter of the population has no
credit card. Agents need an account of their own, with limits a human controls.

Generic x402 gateways already exist (Cloudflare, Corbits, MCPay, Latinum). 402Lab is the layer
above them: **the account**, with caps, a live feed, a kill switch and a monthly statement.

## Who it is for

- **Developers** running agents that call paid APIs (OCR, translation, LLMs, speech, images).
- **API providers** who want to be paid per call without signups, keys or card fees.
- **Owners** who need to know, in real time, what their agents spend and stop them with one tap.

## How it works

1. The owner connects a Solana wallet and creates an allowance: a cap per call and a cap per day.
2. The agent (through the 402Lab MCP server) calls a paid route and receives `402 Payment
Required`.
3. Its session wallet signs a USDC `TransferChecked`; the x402.org facilitator pays the network
   fee and settles in about a second.
4. The allowance policy runs before settle, so a paused or over-cap agent never moves money.
5. Every 30 seconds one Solana transaction splits revenue: provider 85%, integrator 5%,
   platform 10%.
6. The owner watches every payment live on the web and the phone, pauses the agent, and gets one
   statement per month.

## What ships (Solana devnet)

| Surface           | Stack                                            | What it does                                                                                           |
| ----------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `apps/api`        | Fastify 5, `@x402/fastify`, Drizzle, Postgres 16 | Paid catalog (10 services, 9 providers), ledger, allowance policy, split worker, SIWS auth, SSE events |
| `apps/web`        | Next.js 16, `@solana/react`                      | Landing, owner dashboard, splits, statement, playground                                                |
| `apps/mobile`     | Expo SDK 57                                      | Live feed, pause, cap notifications, QR pairing                                                        |
| `packages/mcp`    | MCP SDK, `@x402/fetch`                           | Lets any MCP agent (Claude, etc.) pay with a session wallet                                            |
| `packages/shared` | TypeScript, Zod                                  | Money as `bigint`, split math, policy, catalog                                                         |

On-chain proof, live URLs and the APK are in the root `README.md`.

## Decisions that shape the code

- **Split after settle, in batches.** x402 `exact` pays one recipient; the splits extension is
  still an open PR. The worker sums payouts and sends one transaction with up to 8 transfers.
- **Policy in `onAfterVerify`.** A refusal aborts before the facilitator settles.
- **Money is `bigint`** in atomic USDC (6 decimals) end to end; JSON carries integer strings.
- **Devnet only.** Mainnet waits for licensed custody under Brazil's central-bank rules
  (BCB 519/520). Pix and invoices are simulated.
- **Mobile holds no keys.** It pairs with the dashboard by QR and only observes and pauses.

## Where to read next

- [`SDD.md`](SDD.md): how the project was specified, planned and built.
- [`specs/2026-10-10-402lab-allowance-design.md`](specs/2026-10-10-402lab-allowance-design.md):
  the design spec (problem, scope, domain, business rules).
- [`plans/2026-10-10-402lab-mvp.md`](plans/2026-10-10-402lab-mvp.md): the MVP plan, card by card.
- [`../agents/`](../agents/): the specialist agents used to build each area.
