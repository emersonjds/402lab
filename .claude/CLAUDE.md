# 402Lab

## O que é

Conta de consumo para agentes de IA: o humano dá uma allowance (tetos por chamada e por dia) e o agente paga cada chamada de API em USDC na Solana via HTTP 402 (x402), com split automático para provedores e extrato mensal. Hackathon Colosseum Crypto World's Fair, submissão até 12/out/2026 23:59 PDT — hackathons.

## Stack

Monorepo npm workspaces, Node 24, TypeScript. `apps/api` Fastify 5.12 + `@x402/fastify` 2.28 + Drizzle + Postgres 16 · `apps/web` Next.js 16.4 + `@solana/react` · `apps/mobile` Expo SDK 57 · `packages/mcp` MCP server pagador · `packages/shared` domínio puro (dinheiro, split, política, catálogo, eventos). Solana devnet, `@solana/kit` 8.4.

## Comandos (criados no card LAB-1)

```bash
docker compose up -d        # Postgres local
npm run dev -w @402lab/api
npm run dev -w @402lab/web
npm run start -w @402lab/mobile
# hackathon: sem testes unitários — verificar com typecheck + lint + build + smoke
npm run lint && npm run typecheck
npm run e2e:devnet             # paga os 3 serviços de verdade na devnet (manual)
```

## Convenções locais

- Dinheiro é `bigint` em unidades atômicas de USDC (6 decimais); no JSON vira string de inteiro. Helpers só em `@402lab/shared/money`.
- Split: provedor e integrador com `floor`, resto para a plataforma; máximo 8 transfers por tx; assinatura gravada antes do envio.
- Política da allowance roda no hook `onAfterVerify` do x402 — recusa nunca chega ao facilitator.
- Slice da API igual a `radarge-api/src/features/events/` (`routes.ts`, `schemas.ts`, `repository.ts`).
- Copy da UI em inglês. Pix e NFS-e são simulados e rotulados "simulated — devnet".
- Chaves (tesouraria, JWT, upstreams) só por env; `.env.example` documenta.
- Revisão adversarial (`adversarial-reviewer`) obrigatória em política, ledger, split, auth e on-ramp.

## Agents

Modelos: **opus** para tudo que vira código no repo — `api-fastify`, `web-next`, `mobile-expo`, `x402-micropayments`, `split-settlement`, `solana-payments`, `db-drizzle`, `adversarial-reviewer` · **sonnet** para UX/copy que só recomenda — `fintech-ux`, `mobile-ux` · **haiku** só para tarefa mecânica (mover, renomear, Jira), passado na chamada. Um agent opus de construção por vez; todos usam grafo antes de abrir arquivo, vault `Projects/402lab` para decisão, caveman lite, ponytail.

## Contexto operacional

- Briefing e guia de SDD: `.claude/docs/BRIEFING.md`, `.claude/docs/SDD.md` (com cópia da spec e do plano em `.claude/docs/`)
- Spec: `.claude/docs/specs/2026-10-10-402lab-allowance-design.md` · Plano: `.claude/docs/plans/2026-10-10-402lab-mvp.md` · Pesquisa: `.claude/docs/research/`
- Jira: projeto `LAB` em emersonsilvan.atlassian.net (cards = cards do plano)
- Repo: github.com/emersonjds/402lab. Gitflow global (branch por card a partir de `developer`, merge `--no-ff` em `developer`, micro commits sem rastro de LLM). **Push liberado em qualquer branch neste projeto, inclusive `main` e `developer`** (decisão do Emerson, 2026-10-10).
- Nota do vault: `second-brain/Projects/402lab.md`
- Grafo indexado no codebase-memory: sim (2026-10-10)
