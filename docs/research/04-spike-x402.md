# 04 — Spike x402 ponta a ponta (card LAB-1, 2026-10-10)

Pacotes: `@x402/fastify|core|svm|fetch` 2.28.0, `fastify` 5.12.5, `@solana/kit` 8.4.0, Node 24.19.
Rota: `GET /svc/echo` em `apps/api/src/features/paid-services/routes.ts`, `price: "$0.001"`, `payTo` = tesouraria.
Cliente: `scripts/devnet-pay.ts` (`pnpm spike:pay [path]`), keypair de arquivo em `scripts/.wallets/` (gitignored).

Carteiras de teste (só endereço público; chave fica em `scripts/.wallets/`):

| Papel | Endereço |
|---|---|
| Pagador | `3Vp5E3DjqXhDJT3QuUGDhE4e6bnHxLgpnQY33oKtyUKQ` |
| Tesouraria | `5seMttZKNoYKNVhkwbqkLS8HPpymFmtEWej6XNb7deCj` |

Legenda: **[devnet]** = rodado contra x402.org e a devnet de verdade. **[local]** = rodado com o `@x402/fastify` real e um facilitator fake local (comportamento da biblioteca, não da rede). **[fonte]** = lido no código de `@x402/*` 2.28.0.

## Status

- Riscos 3 (`@x402/fastify` + Fastify 5.12) e 4 (cliente Node assina com keypair de arquivo): **confirmados [devnet]**.
- Perguntas 2, 3 e 4 do plano: **respondidas [local] + [fonte]**.
- Pergunta 1 (settle real de `$0.001` com assinatura no Solscan): **pendente**. O pagador não tem USDC devnet. O faucet SOL devnet respondeu 429 nas duas carteiras e o faucet da Circle exige humano. Precisa de ~2 USDC devnet (mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) no pagador e de uma conta de USDC (ATA) na tesouraria (qualquer envio de USDC pela Phantom cria).

## Facilitators que anunciam Solana devnet [devnet]

`curl -sL <facilitator>/supported`, filtrado por Solana:

```
== https://x402.org/facilitator
{'x402Version': 2, 'scheme': 'exact', 'network': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'extra': {'feePayer': 'CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5', 'features': {'smartWalletSupported': True}}}
{'x402Version': 1, 'scheme': 'exact', 'network': 'solana-devnet', 'extra': {'feePayer': 'CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5'}}
== https://facilitator.payai.network
{'x402Version': 2, 'scheme': 'exact', 'network': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'extra': {'feePayer': '2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4', ...}}
{'x402Version': 2, 'scheme': 'batch-settlement', 'network': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1', 'extra': {..., 'experimental': True, 'batchPolicy': {'asset': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', 'minInitialDeposit': '10000', ...}}}
```

## 1. O facilitator aceitou `$0.001`? [devnet, parcial]

O 402 da API com o x402.org como facilitator (header `payment-required` decodificado):

```json
{"x402Version":2,"error":"Payment required","resource":{"url":"http://localhost:8080/svc/echo","description":"spike","mimeType":""},"accepts":[{"scheme":"exact","network":"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1","amount":"1000","asset":"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU","payTo":"5seMttZKNoYKNVhkwbqkLS8HPpymFmtEWej6XNb7deCj","maxTimeoutSeconds":300,"extra":{"feePayer":"CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5"}}]}
```

`$0.001` vira `amount: "1000"` (unidades atômicas) e o asset default de devnet é o USDC da Circle, sem configurar nada.

Pagamento com o pagador ainda sem USDC (`pnpm spike:pay`):

```
payer 3Vp5E3DjqXhDJT3QuUGDhE4e6bnHxLgpnQY33oKtyUKQ -> GET http://localhost:8080/svc/echo
status 402
body {}
payment-response null
```

Log do servidor (hook `onAfterVerify`):

```json
{"result":{"isValid":false,"invalidReason":"invalid_exact_svm_transaction_simulation_failed","invalidMessage":"Simulation failed: {\"InstructionError\":[\"2\",\"InvalidAccountData\"]}","payer":"3Vp5E3DjqXhDJT3QuUGDhE4e6bnHxLgpnQY33oKtyUKQ"},"amount":"1000","msg":"x402 payment verified"}
```

O ciclo inteiro roda: 402 → cliente assina a tx com keypair de arquivo → x402.org simula. A simulação falha porque a ATA de USDC do pagador não existe. **Falta:** settle real e assinatura no Solscan.

## 2. `onAfterVerify`: `payer` e abort [local + fonte]

- `context.result.payer` vem preenchido, inclusive quando `isValid: false` (ver log [devnet] acima).
- **O hook roda também quando a verificação falhou.** A política precisa checar `result.isValid` antes de contar gasto. [fonte: `runAfterVerifyHooks` é chamado com qualquer `verifyResult`]
- Retornar `{ abort: true, reason, message }` responde **HTTP 402**, corpo `{}`, e um novo header `payment-required` com `error` = `reason`. O `message` não aparece na resposta. O facilitator recebe só o `/verify`; o `/settle` nunca é chamado, então nenhum dinheiro se move.
- Alternativa mais barata: `onBeforeVerify` com abort responde o mesmo 402 **sem chamar o facilitator**. Mas ali ainda não há `payer` verificado; seria preciso decodificar o `paymentPayload`.
- Exceção lançada dentro de um hook é engolida (vira `console.warn`) e o fluxo segue. Política que lança erro = pagamento aprovado. O hook de política precisa capturar erro e retornar abort. [fonte: `warnResourceServerHookFailure`]

```
### /svc/abort/weather            (onAfterVerify -> { abort: true, reason: 'allowance_exceeded', message: 'Daily cap reached' })
status 402
body {}
facilitator calls ["POST /verify"]
payment-required.error "allowance_exceeded"
payment-response null

### /svc/before-abort             (onBeforeVerify -> { abort: true, reason: 'allowance_exceeded_before' })
status 402
body {}
facilitator calls []
payment-required.error "allowance_exceeded_before"
payment-response null
```

## 3. `onAfterSettle`: `transaction`, `payer` e formato do `transportContext` [local]

- `context.result` = `{ success, payer, transaction, network }`. `payer` e `transaction` vêm preenchidos.
- `context.transportContext` é `{ request, responseBody, responseHeaders }` no settle e `{ request }` no verify.
- `request` é o `HTTPRequestContext` do x402, não o request do Fastify: `{ adapter, path, decodedPath, method, paymentHeader, routePattern? }`.
  - `routePattern` só vem no verify; no settle não vem.
  - O request do Fastify fica em `adapter.request`. Em runtime ele existe, mas o campo é `private` no `.d.ts`; acessar daria cast. Para o ledger, usar `path`/`decodedPath`, ou guardar o que precisar no verify (por exemplo num `WeakMap` chaveado pelo `paymentHeader`).
- `responseBody` é o Buffer da resposta do handler. Dá para gravar o resultado junto do pagamento.

```
onAfterVerify {"result":{"isValid":true,"payer":"3Vp5…yUKQ"},"amount":"1000","transport":{"keys":["request"],"requestKeys":["adapter","path","decodedPath","method","paymentHeader","routePattern"],"path":"/svc/abort/weather","method":"GET","routePattern":"/svc/abort/:id","adapterClass":"FastifyAdapter","fastifyRequestViaAdapter":{"id":"req-4","params":{"id":"weather"},"routeUrl":"/svc/abort/:id"}}}
onAfterSettle {"result":{"success":true,"payer":"3Vp5…yUKQ","transaction":"FAKE_SIG","network":"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"},"amount":"1000","transport":{"keys":["request","responseBody","responseHeaders"],"requestKeys":["adapter","path","decodedPath","method","paymentHeader"],"path":"/svc/echo","method":"GET","adapterClass":"FastifyAdapter","fastifyRequestViaAdapter":{"id":"req-2","params":{},"routeUrl":"/svc/echo"},"responseBody":"{\"ok\":true}","responseHeaderKeys":["content-type"]}}
```

## 4. Handler 5xx: o settle acontece? [local + fonte]

**Não.** Com `reply.statusCode >= 400` no `onSend`, o middleware cancela o pagamento (`cancellationDispatcher.cancel({ reason: "handler_failed" })`) e não chama `/settle`. Handler que lança erro: o `onError` cancela com `handler_threw`. O caso "serviço caiu depois de pagar" não existe com `exact` (o settle acontece depois do handler).

```
### /svc/fail     (handler -> reply.code(502))
status 502
body {"error":"upstream down"}
facilitator calls ["POST /verify"]
payment-response null

### /svc/throw    (handler -> throw)
status 500
body {"statusCode":500,"error":"Internal Server Error","message":"boom"}
facilitator calls ["POST /verify"]
payment-response null
```

Consequência inversa [fonte]: se o handler responde 2xx e o settle falha, o cliente recebe erro (402; 502 se o facilitator falhar) e o corpo do handler é descartado. O serviço rodou e não foi pago. O x402 assume esse risco do lado do vendedor.

## Para os próximos cards

- **LAB-2/LAB-3 (política):** usar `onAfterVerify` (tem `payer`); checar `result.isValid`; envolver em try/catch e retornar abort no erro; o motivo vai em `payment-required.error`. Plano B (decodificar `PAYMENT-SIGNATURE` no `preHandler`) não é necessário.
- **LAB-3 (ledger):** gravar no `onAfterSettle` com `result.transaction` como chave única. O id do serviço sai de `transportContext.request.path` (no settle não há `routePattern`).
- **LAB-6 (MCP):** `x402Client` já tem teto embutido, `DEFAULT_MAX_AMOUNT_PER_PAYMENT = "$1"` (`SpendControls` em `@x402/core/client`). O cap por chamada da allowance pode usar isso além do `registerPolicy`.
- **Tesouraria:** precisa de ATA de USDC antes do primeiro pagamento; o cliente `exact` faz só `TransferChecked`, não cria a conta de destino.
- **Peers:** `@solana-program/token@0.9` declara peer `@solana/kit ^5` e o projeto usa 8.4 (aviso do pnpm). O fluxo [devnet] acima já roda com 8.4.
