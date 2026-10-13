# Spec-driven development in 402Lab

Every feature here went through the same path: **spec → plan → card → branch → review → release**.
The spec decides _what_ to build, the plan decides _in what order and where_, and nothing is coded
before both exist.

## 1. Spec

One design spec per product decision, written before any code:
[`specs/2026-10-10-402lab-allowance-design.md`](specs/2026-10-10-402lab-allowance-design.md).

It fixes the problem, the stage moment of the demo, what is in and out of scope, the domain
(allowance, payment, split batch, payout), and the business rules (policy, split, auth,
statement). Market research behind it lives in `.claude/docs/research/`.

## 2. Plan

The spec becomes an implementation plan split into cards:
[`plans/2026-10-10-402lab-mvp.md`](plans/2026-10-10-402lab-mvp.md).

Each card names its branch, its dependencies, the model file to copy ("do it like
`<existing file>`, changing X"), the edge cases, and how it is verified. The order is explicit:

```
LAB-1 foundation + x402 spike
  └─ LAB-2 shared domain ── LAB-3 ledger, policy, auth ─┬─ LAB-4 split worker
                                                         ├─ LAB-5 catalog ── LAB-6 MCP server
                                                         ├─ LAB-7 web
                                                         └─ LAB-8 mobile
LAB-9 deploy, demo and submission (after all)
```

## 3. Cards and branches

Cards live in Jira (project `LAB`). One card is one branch from `developer`
(`feat|fix|chore|docs/LAB-n-summary`), small commits in Conventional Commits, and a `--no-ff`
merge back into `developer`. `main` only moves through a release pull request.

## 4. Specialist agents

Each area has its own agent in [`../agents/`](../agents/), so the person orchestrating hands a
card to the agent that knows that stack:

| Agent                     | Area                                              |
| ------------------------- | ------------------------------------------------- |
| `api-fastify`             | API routes, hooks, adapters, OpenAPI              |
| `x402-micropayments`      | x402 protocol, facilitator, payment hooks         |
| `solana-payments`         | keys, transactions, SIWS, devnet                  |
| `split-settlement`        | split math, payout batching, idempotency          |
| `db-drizzle`              | schema, migrations, queries                       |
| `web-next`                | Next.js dashboard and landing                     |
| `mobile-expo`             | Expo companion app                                |
| `fintech-ux`, `mobile-ux` | UX direction and copy (recommend, never code)     |
| `adversarial-reviewer`    | mandatory review of money, policy, auth and split |

## 5. Verification and release

- **Hackathon mode:** typecheck, lint, build and smoke tests instead of unit tests, plus a real
  end-to-end run on devnet (`npm run e2e:devnet`).
- **Adversarial review** is mandatory for anything that moves money or touches auth.
- **CI** on every pull request: typecheck, lint, OpenAPI contract drift, Docker images.
- **CD** on `main`: deploy API, web and demo web to Railway, then smoke-test production.
- **Releases** bump the version and regenerate `openapi.json` in the same commit.
