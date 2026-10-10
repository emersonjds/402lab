# 402Lab

**Pocket money for AI agents.** A human gives an agent an allowance — a cap per call and a cap
per day — and the agent pays every API call by itself in USDC on Solana through HTTP 402
([x402](https://x402.org)). Providers get their share by an automatic split, and the human
watches, pauses and gets one monthly statement.

Built for the Colosseum Crypto World's Fair (Solana track). Runs on **devnet**.

## The problem

An agent that needs a paid API (OCR, translation, an LLM) hits a flow built for humans: sign
up, type a card, buy prepaid credit, copy a key — once per provider.

- **Cards cannot charge cents.** 2.9% + US$0.30 on a US$0.01 request is a **3,003%** fee; the
  card fee only drops below 10% at about US$4.23 per ticket.
- **Prepaid credit is locked per vendor.** OpenAI: US$5 minimum, credit expires after one year,
  non-refundable. Every provider is another balance, account and key.
- **Brazil doubles the pain.** 3.5% IOF on every international card purchase (since
  2025-07-17), and about **25%** of Brazilians have no credit card at all (Serasa).
- **Agents are an afterthought.** Only 24% of teams design APIs with agents in mind, and 51%
  fear excessive or unauthorized agent calls (Postman, State of the API 2025).

On-chain, the same request costs a fraction of a cent, and x402 already settles it. What is
missing is the **account**: limits a human sets, an agent cannot exceed, and a statement at the
end of the month. Sources in [`docs/research/`](docs/research/).

## Demo in six steps

1. The human connects Phantom on the dashboard and creates a 5 USDC allowance for the agent
   "research-bot": US$0.02 per call, US$1 per day.
2. In Claude (through the 402Lab MCP server) they ask: _"extract the text from this image,
   translate it to English and summarize it"_.
3. The agent discovers the services, gets a 402, and pays three providers on its own — no
   popup. Dashboard and phone show each payment live, with its Solscan signature.
4. 30 s later one split transaction pays providers, integrator and platform — Solscan link.
5. On the phone the human taps **Pause**. The agent's next call is refused.
6. Counter: _"3 calls, US$0.017 paid; by card + IOF they would cost US$0.95"_.

## Architecture

```
402lab/
  apps/api        Fastify 5.12 + @x402/fastify 2.28 + Drizzle/Postgres
  apps/web        Next.js 16.4 (App Router, RSC) + @solana/kit 8.4 + @solana/react 8.4
  apps/mobile     Expo SDK 57
  packages/mcp    MCP server (@modelcontextprotocol/sdk 1.32 + @x402/fetch + @x402/svm)
  packages/shared Zod schemas and types shared by all (catalog, events, money, split, policy)
```

```
agent (MCP)                      apps/api                          x402.org facilitator      Solana devnet
session keypair ──GET /svc/ocr──▶ 402 PAYMENT-REQUIRED
                ◀──────────────── accepts[exact, devnet, USDC, payTo=TREASURY]
signs TransferChecked
──GET + PAYMENT-SIGNATURE──────▶ allowance policy ──verify──▶ ok
                                 runs the service
                                 settle ─────────────────────────▶ sends tx (pays the fee) ─▶ USDC → treasury
                                 writes payment to the ledger + event
◀──────── 200 + PAYMENT-RESPONSE
```

```
split worker (every 30 s) ── unbatched payments ── sum per recipient ── 1 tx with N TransferChecked ── Solscan
```

- The allowance policy (paused, per-call cap, daily cap) runs in the x402 `onAfterVerify` hook:
  a refusal never reaches the facilitator's `/settle`.
- Money is `bigint` atomic USDC (6 decimals) end to end; JSON carries integer strings.
- Split per payment: provider 85%, integrator 5% (both floored), platform keeps the rest.
- Each upstream has a live adapter (Azure AI Vision, AWS Translate, Anthropic
  `claude-haiku-4-5`) and a deterministic demo adapter; responses say `mode: live | demo`.

## Stack

Node 24, TypeScript, npm workspaces · Fastify 5, Zod 4, Drizzle ORM, Postgres 16 · x402 2.28
(`exact` scheme on Solana) · `@solana/kit` 8.4 · Next.js 16 · Expo SDK 57 · MCP SDK 1.32 ·
Vitest · Docker, Railway, Vercel.

## Run locally

Requirements: Node 24, npm 11, Docker.

```sh
npm install
npm run db:up                                    # Postgres 16 on localhost:5432
cp .env.example apps/api/.env                 # fill the wallet addresses (devnet)
npm run dev                                     # api on :8080 (migrations at boot) + web on :3000
npm run dev:mobile                               # scan with Expo Go
```

### Run the web panel on mock data

No devnet USDC, no Postgres, no API needed — the whole `/app` panel runs on `@402lab/mocks`
(MSW) fixtures, including a mock wallet so Connect wallet works without a real extension:

```sh
NEXT_PUBLIC_API_MOCKING=enabled npm run dev -w @402lab/web
```

Android APK for the pitch QR code:

```sh
cd apps/mobile && eas build -p android --profile preview          # cloud build, prints install link + QR
cd apps/mobile && eas build -p android --profile preview --local  # same APK built on this machine
```

`apps/api/.env` needs the treasury, the three provider wallets and the integrator (public base58
addresses), `JWT_SECRET` (32+ chars) and, for the split worker, `TREASURY_SECRET_KEY` (the
treasury's solana-keygen JSON). Upstream keys are optional: blank means demo mode. Every
variable is documented in [`.env.example`](.env.example).

### Let Claude pay

```sh
npm run build -w @402lab/mcp
node packages/mcp/dist/cli.js init            # creates ~/.402lab/session.json, prints the allowance link
claude mcp add 402lab -e API_URL=http://localhost:8080 -- node "$PWD/packages/mcp/dist/cli.js"
```

Fund the session wallet with devnet USDC (https://faucet.circle.com), create its allowance on
the dashboard, and ask Claude to use the `list_services`, `call_service` and `get_allowance`
tools.

### Checks

```sh
npm run typecheck && npm run lint
npm run e2e:devnet          # pays ocr, translate and summarize on devnet and waits for the split (manual)
```

## Deploy

API + Postgres on Railway (Docker), web on Vercel, mobile through Expo Go / EAS Update — step by
step in [`docs/deploy.md`](docs/deploy.md).

## Security

Every money and auth path went through an adversarial review before merging; the findings were
fixed on the same branch:

- **Concurrent daily cap** — calls verified at the same time could each see the old spend and
  together exceed the cap. Spend is now reserved per allowance between verify and settle, under
  a per-allowance lock, and released if settlement is aborted.
- **Idempotent split** — the batch, its payouts and the payment links are written in one DB
  transaction; the transaction signature is stored _before_ sending, and a retry checks the
  signature's status before anything is resent, so a crash cannot pay a provider twice.
- **Lagging RPC nodes** — a batch is released for retry only after its blockhash expiry is
  stable and the status really changed; RPC calls time out and pin commitment and preflight, so
  a stale node cannot trigger a double payout.
- **Auth** — Sign-In With Solana with single-use, expiring nonces; session JWT in an httpOnly
  cookie (`Secure` in production) served first-party through the web proxy; another owner's
  allowance answers 404, never 403; facilitator and upstream error text never reaches clients.
- Keys (treasury, JWT, upstreams) come only from environment variables and are never logged.

## Roadmap

- **Mainnet** with real money — holding treasury funds for ~30 s requires BCB authorization
  (Res. 519/520) or a licensed PSAV partner.
- **Real Pix** on-ramp (simulated and labeled in the demo).
- **NFS-e** tax invoices from the monthly statement.
- **Atomic split** inside the payment itself (x402 PR #3221) or an Anchor splitter program.
- **Proof of session possession** for the MCP's public allowance lookup.
- **Passkeys** for owners without a wallet.
