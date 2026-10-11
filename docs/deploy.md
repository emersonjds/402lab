# Deploy

Everything runs on Solana **devnet**, in one Railway project (`402lab`):

| Service    | Built from                                               | Public URL                                      |
| ---------- | -------------------------------------------------------- | ----------------------------------------------- |
| `Postgres` | Railway PostgreSQL template                              | none (private network only)                     |
| `api`      | `apps/api/Dockerfile`                                    | https://api-production-570e4.up.railway.app     |
| `web`      | `apps/web/Dockerfile`                                    | https://web-production-1b5d1.up.railway.app     |
| `web-demo` | `apps/web/Dockerfile`, `NEXT_PUBLIC_API_MOCKING=enabled` | https://web-demo-production-0d9a.up.railway.app |
| Mobile app | Expo Go / EAS Update (`apps/mobile`)                     | —                                               |

Every service builds from the repository root; the variable `RAILWAY_DOCKERFILE_PATH` picks the
Dockerfile, so no dashboard setting is needed. Redeploy from the laptop with
`railway up --service <name> --detach`. The web services read `API_URL` and `NEXT_PUBLIC_*` as
Docker build args, so changing them needs a redeploy, not only a restart.

The sections below describe each piece; section 2 (Vercel) is the alternative host for the web.

## 1. API on Railway

The image runs the TypeScript sources through `tsx` (`@402lab/shared` ships as `.ts`), applies
the Drizzle migrations at boot and listens on `PORT` (Railway injects it). It needs the whole
monorepo as build context, so the service **root directory stays `/`** and the config file is
pointed at explicitly.

```sh
brew install railway            # or: npm i -g @railway/cli
railway login
railway init                    # project "402lab"
railway add --database postgres
railway add --repo <github-user>/402lab --branch main --service api
```

In the dashboard, service **api → Settings**:

- **Config as code → Railway config file**: `/apps/api/railway.json` (the config file does not
  follow the root directory; the absolute path is required). It selects the Dockerfile builder,
  `apps/api/Dockerfile`, a `/services` healthcheck, restart on failure and watch patterns so a
  web-only commit does not redeploy the API.
- **Networking → Generate domain** (or `railway domain`). This URL is `API_URL` everywhere below.

### Variables

Set them on the `api` service (dashboard **Variables**, or `railway variables --service api --set "KEY=value"`).
`DATABASE_URL` is a reference, so the database stays on the private network.

| Variable                                                   | Required | Value                                                                                                                       |
| ---------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                             | yes      | `${{Postgres.DATABASE_URL}}`                                                                                                |
| `NODE_ENV`                                                 | yes      | `production` (session cookie gets `Secure`)                                                                                 |
| `JWT_SECRET`                                               | yes      | `openssl rand -base64 48` — at least 32 chars                                                                               |
| `TRUST_PROXY_HOPS`                                         | yes      | `1` (Railway's edge proxy in front of the container)                                                                        |
| `TREASURY_ADDRESS`                                         | yes      | public key of the treasury (receives every x402 payment)                                                                    |
| `TREASURY_SECRET_KEY`                                      | yes      | the treasury keypair, solana-keygen JSON array of 64 bytes; signs the split worker and the demo on-ramp. Blank = worker off |
| `PROVIDER_OCR_ADDRESS`                                     | yes      | provider wallet for `ocr`                                                                                                   |
| `PROVIDER_TRANSLATE_ADDRESS`                               | yes      | provider wallet for `translate`                                                                                             |
| `PROVIDER_SUMMARIZE_ADDRESS`                               | yes      | provider wallet for `summarize`                                                                                             |
| `INTEGRATOR_ADDRESS`                                       | yes      | integrator wallet                                                                                                           |
| `SOLANA_RPC_URL`                                           | yes      | `https://api.devnet.solana.com` or a private devnet RPC (Helius, Triton…)                                                   |
| `FACILITATOR_URL`                                          | yes      | `https://x402.org/facilitator`                                                                                              |
| `LOG_LEVEL`                                                | no       | `info`                                                                                                                      |
| `SPLIT_WORKER_ENABLED`                                     | no       | `true`                                                                                                                      |
| `AZURE_VISION_ENDPOINT`, `AZURE_VISION_KEY`                | no       | OCR runs live; blank = demo mode                                                                                            |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | no       | Translate runs live; blank = demo mode                                                                                      |
| `ANTHROPIC_API_KEY`                                        | no       | Summarize runs live; blank = demo mode                                                                                      |

The API refuses to boot with a missing or malformed required variable and prints which one.
Each upstream answers `"mode": "demo"` until all of its keys are set; `GET /services` shows the
mode of each.

The treasury and the provider/integrator wallets need devnet SOL for the split transaction fee
and token-account rent (`solana airdrop 2 <address> --url devnet`) and the treasury needs devnet
USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, from https://faucet.circle.com) for the demo
on-ramp.

### Check

```sh
curl -s "$API_URL/services"                 # 200, three services
API_URL=https://<api-domain> \
OWNER_KEYPAIR_PATH=scripts/.wallets/owner.keypair.json \
  npm run e2e:devnet                           # pays ocr/translate/summarize, waits for split.confirmed
```

`npm run e2e:devnet` reads `PAYER_KEYPAIR_PATH` (default `scripts/.wallets/payer.keypair.json`, a
devnet wallet holding a few cents of devnet USDC) and, when `GET /splits` asks for a session,
signs in with `OWNER_KEYPAIR_PATH` (Sign-In With Solana). It prints every payment signature
with its Solscan link, waits up to 120 s for a new confirmed split batch and exits non-zero if
any step fails. It moves real devnet tokens, so it is manual and stays out of CI.

### Local image

```sh
docker build -f apps/api/Dockerfile -t 402lab-api .
docker run --rm -p 8080:8080 --env-file apps/api/.env \
  -e DATABASE_URL=postgres://lab:lab@host.docker.internal:5432/lab402 402lab-api
```

## 2. Web on Vercel

1. **Add New → Project**, import the repository, **Root Directory** `apps/web`. Vercel detects
   npm from the lockfile and Next.js from the app; keep "Include files outside the root
   directory" on — the app compiles `@402lab/shared` from `packages/shared`.
2. Environment variables (Production and Preview):

   | Variable               | Value                                  |
   | ---------------------- | -------------------------------------- |
   | `API_URL`              | the Railway API URL, no trailing slash |
   | `NEXT_PUBLIC_SITE_URL` | the Vercel URL (Open Graph metadata)   |
   | `NEXT_PUBLIC_DEMO_URL` | demo video URL, optional               |

3. Deploy.

The browser never talks to Railway directly: `next.config.ts` rewrites `/api/*` to `API_URL`,
so the `session` cookie set by `POST /auth/verify` lands on the dashboard's own origin and stays
first-party — no CORS, no third-party-cookie blocking.

## 3. Mobile

The app has no build-time API setting: the pairing QR on the dashboard carries the API URL and a
30-day mobile token, so the deployed API must be reachable from the phone (the Railway URL, not
`localhost`).

- **Expo Go** (stage demo): `npm run start -w @402lab/mobile`, scan the Metro QR with Expo Go,
  then scan the dashboard's pairing QR inside the app.
- **EAS Update** (share without Metro running): `npx eas-cli login`, `npx eas-cli init` once in
  `apps/mobile`, then `npx eas-cli update --branch demo --message "demo"` and open the update
  link in Expo Go.

## Secrets checklist

- [ ] `.env`, `*.keypair.json` and `scripts/.wallets/` are git-ignored and docker-ignored; run
      `git status` before every commit.
- [ ] `JWT_SECRET` generated fresh for production (never reused from local), sealed in Railway.
- [ ] `TREASURY_SECRET_KEY` only in Railway variables, sealed; it is a devnet key — never fund it
      on mainnet.
- [ ] Upstream keys (Azure, AWS, Anthropic) only in Railway variables, with spend limits on each
      provider console.
- [ ] `DATABASE_URL` uses the private reference, the Postgres service has no public TCP proxy.
- [ ] Vercel holds no secret: `API_URL` and `NEXT_PUBLIC_*` are public by design.
- [ ] Payer/owner keypairs used by `npm run e2e:devnet` stay in `scripts/.wallets/` on the laptop.
