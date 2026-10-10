# 402Lab — conta de consumo de agentes de IA (design)

> Marca: 402Lab (empresa e produto no hackathon). Pacotes npm no escopo `@402lab/*`. Domínio alvo: 402lab.xyz.

- Data: 2026-10-10
- Hackathon: Colosseum Crypto World's Fair — submissão até 12/out/2026 23:59 PDT, track Solana
- Pesquisa base: `docs/research/00..03`

## 1. Problema

Um agente de IA que precisa usar uma API paga (tradução, OCR, LLM) esbarra em cadastro, cartão e crédito pré-pago por fornecedor. No Brasil a dor dobra: IOF de 3,5% em compra internacional no cartão, ~25% da população sem cartão de crédito, crédito pré-pago que expira (OpenAI: mínimo US$5, validade de 1 ano). Cartão não cobra centavos: 2,9% + US$0,30 sobre um request de US$0,01 é 3.003% de taxa.

Infra x402 genérica e gateway 402 genérico já existem e já foram premiados (MCPay, Latinum, Cloudflare Monetization Gateway, Corbits). O recorte deste projeto é outro: **a conta de consumo do agente**. O humano dá ao agente uma mesada (allowance) com teto e regras; o agente paga cada chamada em USDC na Solana via HTTP 402; o provedor recebe sua parte por split automático; o humano acompanha, pausa e recebe um extrato consolidado do mês.

## 2. Momento de palco

1. Humano conecta o Phantom no dashboard, cria uma allowance de 5 USDC para o agente "research-bot", teto de US$0,02 por chamada e US$1 por dia.
2. No Claude (via MCP server), pede: "extraia o texto desta imagem, traduza para inglês e resuma".
3. O agente descobre os serviços, recebe 402, paga três provedores sozinho, sem popup. O dashboard e o app mostram cada pagamento ao vivo, com assinatura no Solscan.
4. 30 s depois, uma única transação de split distribui os valores para provedores, integrador e plataforma — link no Solscan.
5. No app, o humano toca "Pausar". A próxima chamada do agente é recusada.
6. Contador: "3 chamadas, US$0,017 pagos; no cartão + IOF custariam US$0,95".

## 3. Escopo

### Dentro (entregue até 12/out, Solana devnet)

- API Fastify com catálogo de 3 serviços pagos via x402 (`exact`, devnet), ledger, políticas da allowance, worker de split, extrato mensal, eventos ao vivo, lista de espera.
- MCP server npm para qualquer agente MCP pagar os serviços com a carteira de sessão.
- Web Next.js: landing + lista de espera, login com carteira, criação e recarga de allowance, dashboard ao vivo, extrato imprimível, playground (plano B da demo).
- App Expo: pareamento por QR, feed de pagamentos, pausar/retomar, notificação local ao bater o teto diário.

### Fora (roadmap, citado no pitch)

- Mainnet e dinheiro real: custódia da tesouraria por ~30 s exige autorização (Res. BCB 519/520) ou PSAV parceira.
- Pix real: a recarga via Pix é **simulada** na demo e rotulada como tal.
- NFS-e real: entregamos o extrato consolidado; emissão fiscal é roadmap.
- Split atômico no próprio pagamento (PR x402 #3221) e programa Anchor splitter.
- Carteira dentro do app mobile (SDK do Phantom exige dev build).
- Cadastro self-service de APIs de terceiros: o catálogo é semeado por nós.
- Esquemas `upto`/`batch-settlement`: sem facilitator público na Solana.

## 4. Arquitetura

Monorepo pnpm:

```
402lab/
  apps/api        Fastify 5.12 + @x402/fastify 2.28 + Drizzle/Postgres
  apps/web        Next.js 16.4 (App Router, RSC) + @solana/kit 8.4 + @solana/react 8.4
  apps/mobile     Expo SDK 57
  packages/mcp    MCP server (@modelcontextprotocol/sdk 1.32 + @x402/fetch + @x402/svm)
  packages/shared schemas Zod e tipos compartilhados (catálogo, eventos, allowance)
```

`packages/shared` existe porque API, web, mobile e MCP consomem os mesmos tipos de evento e de catálogo. Tipos nascem de Zod (`z.infer<>`).

### Fluxo de pagamento

```
agente (MCP)                     apps/api                          facilitator x402.org      Solana devnet
session keypair ──GET /svc/ocr──▶ 402 PAYMENT-REQUIRED
                ◀──────────────── accepts[exact, devnet, USDC, payTo=TREASURY]
assina TransferChecked
──GET + PAYMENT-SIGNATURE──────▶ política da allowance ──verify──▶ ok
                                 executa o serviço
                                 settle ─────────────────────────▶ envia tx (paga o fee) ─▶ USDC → tesouraria
                                 grava payment no ledger + evento
◀──────── 200 + PAYMENT-RESPONSE
```

```
split worker (a cada 30 s) ── lê payments sem lote ── agrega por recebedor ── 1 tx com N TransferChecked ── Solscan
```

- Rede: `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` (devnet). USDC devnet mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, 6 decimais.
- Facilitator: `https://x402.org/facilitator` (paga o fee; usuário não precisa de SOL). Reserva: PayAI.
- `payTo` = tesouraria da plataforma (chave em variável de ambiente, nunca no repo).

## 5. Domínio

Valores monetários sempre em unidades atômicas de USDC (`bigint`, 6 decimais). Nunca `number` para dinheiro.

| Entidade | Campos | Regras |
|---|---|---|
| `Service` | `id`, `name`, `description`, `upstream` (`aws-translate`, `azure-ocr`, `anthropic-summary`), `price`, `splits[]` | Semeado em código. `splits` = `{recipient, role: provider\|integrator\|platform, bps}`; soma de bps = 10000 (validado no boot). |
| `Owner` | `address` | Humano, identificado pela carteira. |
| `Allowance` | `id`, `ownerAddress`, `agentName`, `sessionAddress` (único), `perCallCap`, `dailyCap`, `status` (`active`\|`paused`), `createdAt` | Pertence a um owner. |
| `Payment` | `id`, `serviceId`, `payerAddress`, `allowanceId?`, `amount`, `txSignature` (único), `upstreamStatus` (`ok`\|`failed`), `settledAt`, `splitBatchId?` | Gravado só após settle com sucesso. `allowanceId` nulo = pagador avulso (gateway aceita qualquer cliente x402). |
| `SplitBatch` | `id`, `txSignature`, `status` (`pending`\|`confirmed`\|`failed`), `createdAt` | |
| `Payout` | `batchId`, `recipient`, `role`, `amount` | |
| `WaitlistEntry` | `email` (único), `createdAt` | |

Catálogo inicial (preços de demo):

| id | upstream | preço | split |
|---|---|---|---|
| `ocr` | Azure AI Vision Read | US$0,005 | provedor 85% / integrador 5% / plataforma 10% |
| `translate` | AWS Translate | US$0,002 | idem |
| `summarize` | Anthropic `claude-haiku-4-5` | US$0,010 | idem |

Cada upstream tem adaptador real (ativado quando a credencial existe no ambiente) e adaptador de demonstração determinístico. A resposta informa `mode: "live" | "demo"` e o dashboard exibe isso — nada de fingir chamada real.

## 6. Regras de negócio

### Política da allowance (servidor, antes do verify)

O pagador é a authority do `TransferChecked` (a carteira de sessão). Se ela pertence a uma allowance:

1. `status = paused` → recusa.
2. `price > perCallCap` → recusa.
3. soma de `Payment.amount` do dia (UTC) + `price` > `dailyCap` → recusa e emite evento `allowance.cap_reached`.

Recusa responde 402 com motivo legível (`allowance_paused`, `per_call_cap_exceeded`, `daily_cap_exceeded`) e não chama o facilitator. Pagador sem allowance segue o fluxo normal.

O teto por chamada também é aplicado no cliente (`registerPolicy` no MCP). O saldo da carteira de sessão é o teto absoluto.

### Split

- Por lote, agrega `Payment` sem `splitBatchId`; para cada pagamento aplica `floor(amount × bps / 10000)` a provedor e integrador; o resto (incluindo arredondamento) fica com a plataforma, que já está na tesouraria e não gera transfer.
- Até 8 transfers por transação; acima disso, mais de um lote.
- Idempotência (dinheiro, revisão adversarial obrigatória):
  1. Numa transação de banco: cria `SplitBatch(pending)`, grava `Payout`s e marca os `Payment`s com o `batchId`.
  2. Monta e assina a tx; grava `txSignature` no lote **antes** de enviar.
  3. Envia e confirma. Sucesso → `confirmed` + evento `split.confirmed`.
  4. Falha ou timeout → na próxima rodada, consulta o status da assinatura antes de qualquer reenvio. Confirmada → `confirmed`. Expirada (blockhash vencido) e não confirmada → `failed`, libera os `Payment`s (`splitBatchId = null`).
- Recebedor sem conta USDC: instrução `CreateAssociatedTokenIdempotent` paga pela tesouraria.

### Autenticação

- Web: Sign-In With Solana. `GET /auth/nonce` → owner assina a mensagem → `POST /auth/verify` → JWT em cookie httpOnly.
- Mobile: o dashboard gera um token de pareamento (JWT com escopo `mobile`, mesmo owner) exibido em QR; o app guarda em `expo-secure-store`.
- Allowance de outro owner responde **404**, nunca 403.
- MCP server não autentica: ele só paga (x402) e lê o catálogo, que é público.

### Extrato

`GET /allowances/:id/statement?month=YYYY-MM` → totais por serviço e por provedor, lista de pagamentos com assinatura, total de fees de rede, comparativo com cartão + IOF. Web renderiza versão imprimível (CSS de impressão → PDF do navegador).

### Comparativo de economia

Por pagamento: `cartão = amount × 1,029 + US$0,30`, `+ IOF 3,5%`. Custo real de rede: fee da transação (pago pelo facilitator; exibido como custo absorvido). Constantes ficam num módulo único com a fonte citada.

## 7. Componentes

### apps/api (vertical slices)

| Slice | Rotas |
|---|---|
| `catalog` | `GET /services` |
| `paid-services` | `GET\|POST /svc/:id` atrás do `paymentMiddleware` |
| `allowances` | `POST /allowances`, `GET /allowances`, `GET /allowances/:id`, `PATCH /allowances/:id` (pausar/retomar, tetos), `GET /allowances/:id/statement`, `GET /allowances/by-session/:address` (público: só tetos, status e gasto do dia — usado pelo MCP) |
| `auth` | `GET /auth/nonce`, `POST /auth/verify`, `POST /auth/pair` |
| `events` | `GET /events` (SSE, filtrado pelo owner) e `GET /allowances/:id/payments?after=` (polling do mobile) |
| `splits` | worker + `GET /splits` |
| `waitlist` | `POST /waitlist` |
| `demo-onramp` | `POST /onramp/simulate` — tesouraria envia USDC devnet à carteira de sessão; desligado fora da devnet |

OpenAPI gerado do schema Zod de cada rota (`@fastify/swagger`), sempre em dia. Eventos em memória (EventEmitter). `ponytail:` instância única; Redis pub/sub quando houver mais de uma.

### packages/mcp

- `npx @402lab/mcp init` gera a carteira de sessão em `~/.402lab/session.json` (permissão 600) e imprime o endereço e o link para criar a allowance no dashboard.
- Tools: `list_services`, `call_service({serviceId, input})`, `get_allowance` (saldo on-chain + gasto do dia via API pública por endereço de sessão).
- Paga via `wrapFetchWithPayment` com `ExactSvmScheme(signer)` e `registerPolicy` (teto por chamada).

### apps/web

- `/` landing: problema com números, como funciona, demo em vídeo, lista de espera. Estética web3, mobile first (375 px).
- `/app` dashboard (autenticado): allowances, criar allowance (endereço de sessão + tetos), recarregar (transferência USDC assinada no Phantom, ou Pix simulado), feed ao vivo (SSE), splits com link Solscan `?cluster=devnet`, pausar, QR de pareamento, extrato.
- `/playground`: carteira de sessão no navegador executa OCR → tradução → resumo com um clique (plano B se o MCP falhar no palco).
- RSC por padrão; cliente só na carteira, feed e formulários.

### apps/mobile

- Pareamento por QR (`expo-camera`), token em `expo-secure-store`.
- Feed por polling a cada 3 s (`ponytail:` fetch do RN não faz streaming; SSE quando houver lib).
- Pausar/retomar.
- Notificação local (`expo-notifications`) quando o feed traz `allowance.cap_reached` — funciona no Expo Go, sem push remoto.

## 8. Erros

- Toda falha mostra texto nosso e fixo ao usuário; resposta de servidor, facilitator ou RPC nunca é interpolada na UI.
- Settle falhou → serviço não é cobrado no ledger e a resposta não é entregue (o middleware x402 só libera após settle).
- Upstream falhou depois do pagamento → registra `Payment` com `upstreamStatus = failed` e o extrato marca para estorno manual. `ponytail:` estorno automático é roadmap.
- Worker de split falhou → lote `failed`, pagamentos voltam à fila, evento `split.failed` no dashboard.
- Parse na borda: toda entrada HTTP validada por Zod; endereço Solana validado com `isAddress` do `@solana/kit`.

## 9. Testes e qualidade

- TDD por fatia (skill `tdd`), vermelho e verde reportados.
- Vitest em api, mcp, shared e web; `jest-expo` + Testing Library no mobile. Cobertura > 90% nas 4 métricas, limiar travado por pacote.
- Facilitator, RPC e upstreams substituídos por fakes nos testes unitários. Um script `pnpm e2e:devnet` paga um serviço real na devnet e confere o ledger (manual, fora do CI).
- Revisão adversarial obrigatória: política da allowance, worker de split, auth/pareamento.
- Gitflow: `main` + `developer`; uma branch por card.

## 10. Riscos a validar no card 1 (bloqueiam o resto)

1. Facilitator público aceita `$0.001`–`$0.01` em devnet com memo.
2. Hook `onBeforeVerify`/`onAfterSettle` do `@x402/core` 2.28: assinatura real, se dá para recusar no `onBeforeVerify` e se o `onAfterSettle` expõe pagador e assinatura da tx. Plano B: `preHandler` do Fastify decodifica `PAYMENT-SIGNATURE` para a política, e o ledger lê o `PAYMENT-RESPONSE`.
3. `@x402/fastify` compatível com Fastify 5.12.
4. Cliente x402 em Node (MCP) assina com keypair de arquivo.

Se 1 ou 3 falharem: trocar facilitator para PayAI; em último caso, verificação própria via RPC.

## 11. Ordem de entrega (um card = uma branch)

1. Fundação + spike: monorepo, `packages/shared`, rota paga ponta a ponta na devnet com teste, riscos da seção 10 respondidos.
2. Ledger + política da allowance + auth.
3. Worker de split.
4. Catálogo com 3 adaptadores (real + demo).
5. MCP server.
6. Web: landing + dashboard + playground.
7. Mobile.
8. Deploy (API + Postgres, web) e roteiro de demo.

Cards 4, 5 e 6 rodam em paralelo depois do 2. Card 7 depois do 2.
