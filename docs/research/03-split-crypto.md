# 03 — Split payments + cripto (foco Solana) para x402 SaaS

Data: 2026-10-10. Escopo revisto: hackathon Colosseum, **Solana obrigatória**, entrega 12/out/2026. Base/EVM ficou só como apêndice.
Legenda: [V] verificado nesta sessão (npm, RPC, curl, doc oficial) · [W] só busca web/blog · [NV] não verificado.

## Resumo

- x402 v2 roda em Solana devnet **hoje** no facilitator público `https://x402.org/facilitator`. Ele paga o fee em SOL, então o usuário só precisa de USDC devnet, sem SOL [V].
- O facilitator público aceita **um único `TransferChecked`** por pagamento (layout estático: 3 a 7 instruções). Split atômico dentro do pagamento x402 **não passa** no facilitator público. A extensão `extra.splits` (até 8 recebedores) existe só como PR aberto, sem merge [V].
- Split viável em 2 dias: **pay-in → split-out**.
  1. O x402 paga a tesouraria da plataforma (`payTo`).
  2. O hook `onAfterSettle` grava no ledger.
  3. Um worker manda **uma tx** com N `TransferChecked`: provedor, revendedor e taxa da plataforma ficam na tesouraria.
  4. A tx é atômica por lote e custa 5000 lamports por assinatura [V].
- Sem popup por requisição: **session wallet** (um keypair efêmero no cliente, recarregado com 1 tx no Phantom). Ela assina os pagamentos x402 sem UI, e o saldo dela é o teto de gasto. É mais simples e mais seguro de demonstrar que delegação SPL ou Swig.
- Brasil: as Res. BCB 519/520/521 (nov/2025) criam a SPSAV. A 519 e a 520 valem desde 02/02/2026; empresas que já operam têm até 30/10/2026 para pedir autorização. Stablecoin em pagamento internacional ou para autocustódia = câmbio. A Res. 561 (vigente desde 01/10/2026) proíbe ativo virtual como trilho de liquidação no eFX [W].

## 1. x402 na Solana — fatos

| Fato | Fonte | St |
|---|---|---|
| `GET x402.org/facilitator/supported` lista `x402Version 2, scheme exact, network solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` (devnet), `extra.feePayer CKPKJWNdJEqa81x7CkZ14BVPiY6y16Sxs7owznqtWYp5`, `features.smartWalletSupported:true`. Também tem v1 `solana-devnet` | https://x402.org/facilitator/supported | V |
| No facilitator público, `upto` e `batch-settlement` existem **só** para Base Sepolia (`eip155:84532`), não para Solana | idem | V |
| PayAI facilitator: v1 `solana-devnet` (feePayer `2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHDBg4`) e v2 Solana mainnet | https://facilitator.payai.network/supported | V |
| Fluxo SVM `exact`: o cliente monta e assina parcialmente a tx (sem a assinatura do feePayer), manda base64 no header, o server faz `/verify` e `/settle`, e o sponsor assina como feePayer e submete. O blockhash expira em ~60–90 s | https://github.com/x402-foundation/x402/blob/main/specs/schemes/exact/scheme_exact_svm.md | V |
| §1.4: **exatamente um** transfer que bate (mint, ATA de destino, amount ≥) é aceito. Mais de um é rejeitado | idem | V |
| §3.1 Path 1 (wallets padrão): 3–7 instruções, nesta ordem: SetComputeUnitLimit, SetComputeUnitPrice, `TransferChecked`, até 4 Lighthouse/Memo. Price ≤ 5 lamports/CU. Memo obrigatório (`extra.memo` ou nonce ≥16 bytes). Phantom injeta até 3 instruções Lighthouse | idem | V |
| §3.2 Path 2 (smart wallet: Squads, Swig) via simulação com CPI. Opt-in `enableSmartWalletVerification`, com allowlist de programa | idem | V |
| §2.1.1: o feePayer não pode aparecer em nenhuma conta de instrução. `feePayer == payTo` é permitido (o comerciante patrocina o próprio fee) | idem | V |
| PR #3221 "multi-payee splits" (`extra.splits`, até 8 recebedores, atômico): **open, merged_at null** | https://github.com/x402-foundation/x402/pull/3221 | V |
| `@x402/fastify` existe: `paymentMiddleware(app, routes, x402ResourceServer)`. O server registra `new ExactSvmScheme()` de `@x402/svm/exact/server` + `HTTPFacilitatorClient({url:"https://x402.org/facilitator"})`. Paywall HTML opcional via `@x402/paywall` | README npm @x402/fastify 2.28.0 | V |
| `@x402/core` server expõe os hooks `onBeforeVerify/onAfterVerify/onBeforeSettle/onAfterSettle` (assinatura exata não lida) | grep no dist @x402/core 2.28.0 | V (nomes) / NV (assinatura) |
| `@x402/svm` 2.28.0 traz os schemes `exact`, `upto` e `batch-settlement` (BatchChannelManager, payment channel) para SVM. Precisaria de facilitator próprio | dist do pacote | V (existe) / NV (funcional) |
| Cliente: `createKeyPairSignerFromBytes` (@solana/kit) → `new ExactSvmScheme(signer)` (`@x402/svm/exact/client`) → `x402Client().register("solana:*", …)` + `registerPolicy` (teto por chamada) → `wrapFetchWithPayment(fetch, client)` | https://solana.com/developers/guides/getstarted/intro-to-x402 + busca | W |
| Demo pública em devnet (08/10/2026): o agente pagou 4×402 em dUSDC, sem SOL, recusou chamada acima do teto | https://github.com/shoya-sue/solana-agent-pay | W |

## 2. Split na Solana — opções

| Opção | Atômico com o pagamento? | Esforço | Funciona c/ facilitator público? | Nota |
|---|---|---|---|---|
| **A. Pay-in → split-out (tesouraria + worker)** | Não. Atômico por lote de payout | Baixo (1 worker + tabela ledger) | Sim | Uma tx com N `TransferChecked` assinada pela tesouraria. Cada transfer cabe até o limite de 1232 bytes por tx (~15–20 transfers com contas distintas, estimativa [NV]). Push (envia) ou pull (acumula saldo, o provedor resgata) |
| B. Facilitator próprio, `feePayer == payTo` (tesouraria), verify customizado aceitando N transfers | Sim | Médio (fork do `ExactSvmScheme` facilitator ou Kora) | Não | Segue o rascunho do PR #3221. Cliente x402 padrão monta só 1 transfer, então o cliente também precisa ser custom |
| C. Programa Anchor splitter (PDA vault como `payTo`, `distribute` lê basis points) | Não (crank), ou sim se o cliente chamar o programa (cai no Path 2) | Alto para 2 dias | Path 2 exige programa na allowlist do facilitator → NV | `@anchor-lang/core` 1.2.1 (o `@coral-xyz/anchor` 0.32.1 parou em out/2025) [V] |
| D. Solana Pay *transaction request* (server monta a tx com N transfers, a wallet assina) | Sim | Baixo | Não é x402 (fluxo QR/link) | Útil para recarga/top-up. Transfer request = 1 recebedor (spec não reverificada, fetch falhou) [NV] |

Custos [V doc oficial https://solana.com/docs/core/fees]: base fee **5000 lamports por assinatura**, priority fee = `ceil(CU_price × CU_limit / 1e6)`, máximo de 1,4M CU/tx. Criar ATA de recebedor novo custa ~0,00204 SOL de rent [NV, valor de memória]. Valor em USD depende do preço do SOL [NV].

Recomendação: **A com push em lote** (ex.: a cada 30 s ou a cada R$X acumulado). Na demo, mostrar no explorer a tx de entrada (x402) e a tx de split (N transfers). Citar B/PR #3221 como roadmap atômico.

## 3. Pagar sem popup por requisição

| Mecanismo | Como | Prós | Contras | St |
|---|---|---|---|---|
| **Session wallet (prepaid)** | Keypair efêmero no cliente (localStorage / `expo-secure-store`). O usuário recarrega com 1 tx no Phantom (ou QR Solana Pay). O `ExactSvmScheme(signer)` assina cada 402 | Zero popup, zero SOL (facilitator paga), teto = saldo, encaixa no cliente x402 padrão | Chave quente no device. Revogar = sweep de volta | V (componentes) |
| SPL `ApproveChecked` (delegate) | O dono aprova um delegate com allowance. O delegate assina `TransferChecked` da ATA do dono | Fundos ficam na wallet do usuário | **1 delegate por token account** (um approve novo substitui o anterior) [V doc]. O cliente x402 padrão transfere da ATA do próprio signer → precisa de cliente custom. Facilitator aceitar authority=delegate: NV | parcial |
| Swig smart wallet (roles, session keys, spend limit recorrente/por destino) | `@swig-wallet/kit` 2.1.0 | Modelo "certo" de permissão | Pagamento vira CPI → Path 2 do facilitator (allowlist Swig NV). Curva de aprendizado | W |
| Privy embedded (Solana) | `signTransaction` com `uiOptions.showWalletUIs:false` assina sem modal | Login social, sem extensão | Dependência de conta Privy. Comportamento no Expo NV | W |
| x402 `batch-settlement` (canal) SVM | Depósito único + vouchers | Ideal p/ micro | Sem facilitator público em Solana. Exige rodar o seu | NV |

Fee sponsoring: **não precisa de Kora/Octane na demo**, porque o facilitator x402 já é o feePayer. Para a tx de split, a tesouraria paga o próprio fee em SOL (airdrop devnet). Kora (Solana Foundation, JSON-RPC paymaster, aceita fee em SPL, docs em https://solana.com/docs/tools/kora/getting-started, npm `@solana/kora` 0.2.1) entra só se o usuário precisar mandar tx fora do x402, ex. a recarga sem SOL [V/W]. Octane: status do repo não confirmado (API do GitHub não retornou) [NV]. Na prática, foi substituído pelo Kora.

## 4. Wallets / SDKs (Solana) — versões npm conferidas 2026-10-10

| SDK | Web (Next) | Expo/RN | Embedded/social | Sem popup / spend limit | Versão |
|---|---|---|---|---|---|
| `@solana/kit` (sucessor do web3.js v1) | sim | sim c/ `@solana/webcrypto-ed25519-polyfill` 8.4.0 | — | — | 8.4.0 [V] |
| `@solana/web3.js` v1 (branch de manutenção; o README aponta para kit) | sim | sim | — | — | 1.99.0 [V] |
| `@solana/react` (hooks Wallet Standard p/ kit) | sim | não | — | — | 8.4.0 [V] |
| `@wallet-ui/react` / `@wallet-ui/react-native-web3js` (usado pelo create-solana-dapp 4.8.5) | sim | sim (MWA) | — | — | 4.4.1 [V] |
| `@solana/wallet-adapter-react` + `-react-ui` (legado web3.js v1, Wallet Standard autodetect) | sim | não | — | — | 0.15.40 / 0.9.40 [V] |
| Mobile Wallet Adapter `@solana-mobile/mobile-wallet-adapter-protocol(-kit/-web3js)` | — | **Android only**, dev build | — | — | 3.0.1 [V]; iOS sem MWA [W] |
| Phantom Connect `@phantom/react-sdk` / `@phantom/react-native-sdk` / `@phantom/browser-sdk` | sim | sim (iOS+Android). **Não roda no Expo Go**, precisa de dev build. Peer deps: expo-secure-store, expo-web-browser, expo-auth-session, expo-router, react-native-svg, react-native-get-random-values | sim (embedded Solana mainnet/devnet) | NV | 2.0.4 [V]; docs https://docs.phantom.com/sdks/react-native-sdk [W] |
| Privy `@privy-io/react-auth` / `@privy-io/expo` | sim | sim | sim (Solana + EVM) | `showWalletUIs:false` (web) [W] | 3.48.1 / 0.76.2 [V] |
| Dynamic `@dynamic-labs/solana` / `@dynamic-labs/client` (RN) | sim | RN client existe; Solana em RN NV | sim | NV | 5.10.0 / 4.95.1 [V] |
| Reown `@reown/appkit-adapter-solana` / `@reown/appkit-react-native` | sim | RN existe; Solana em RN NV | parcial | não | 1.8.24 / 2.0.6 [V] |
| Coinbase CDP `@coinbase/cdp-react(-native)` / `cdp-hooks` | sim | sim | sim | Spend Permissions só EVM; Solana em CDP embedded NV | 0.0.127 [V] |
| Swig `@swig-wallet/kit` / `classic` | sim | NV | via Para | **session keys + spend limits on-chain** | 2.1.0 [V] |
| Crossmint `@crossmint/client-sdk-react-ui` | sim | NV | sim | NV | 4.9.1 [V] |
| Solana Pay `@solana/pay` | sim | sim (URL/QR) | — | — | 1.0.26 [V] |

x402 / infra: `@x402/core|svm|fastify|fetch|next|paywall` **2.28.0** (29/09/2026) [V]; `x402-solana` 3.0.1 (terceiro) [V]; `@payai/facilitator` 2.4.6 [V]; `@solana-program/token` 0.17.0, `@solana-program/system` 0.15.0, `@solana-program/compute-budget` 0.19.0, `@solana/spl-token` 0.4.15 [V]. Os pacotes x402 v1 (`x402`, `x402-fetch`, `x402-express`, `x402-next`) estão parados em 1.2.0 (abr/2026). Use `@x402/*` [V].

## 5. Devnet / testes

- USDC devnet mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`: `getTokenSupply` no devnet responde, `decimals: 6` [V]. Faucet: https://faucet.circle.com (rede Solana Devnet). Limite por pedido NV.
- SOL devnet (só para a tesouraria pagar o split): `solana airdrop` / https://faucet.solana.com [NV limites].
- CAIP-2 devnet `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`, mainnet `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` [V].
- USDC mainnet `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (Circle) [V].

## 6. Regulação Brasil 2026 (pitch/roadmap, não bloqueia demo)

- Res. BCB **519/520/521** (10/11/2025): autorização e funcionamento da SPSAV (intermediária, custodiante, corretora). Compra/venda/troca de stablecoin, pagamento internacional com cripto e transferência para/de autocustódia **= câmbio**. A 519 e a 520 vigoram desde 02/02/2026. Reporte de operações a partir de 04/05/2026. Quem já opera tem até **30/10/2026** para pedir autorização [W: https://lefosse.com/noticias/alerta/banco-central-regulamenta-o-uso-de-ativos-virtuais-e-o-funcionamento-das-prestadoras-de-servicos-de-ativos-virtuais/ , https://www.demarest.com.br/wp-content/uploads/2025/11/Demarest_BC_regulamenta_a_prestacao_de_servicos_de_ativos_virtuais.pdf].
- Limite de **US$ 100 mil por operação** em pagamento/transferência internacional com ativo virtual quando a contraparte não é instituição de câmbio [W: https://br.beincrypto.com/bc-propoe-limite-de-us-100-mil-para-transferencia-de-stablecoins-e-recebe-criticas/].
- Res. BCB **561** (30/04/2026, vigente desde **01/10/2026**): o eFX deve liquidar por câmbio ou conta de não residente em reais. **Vedado usar ativo virtual como trilho de liquidação** [W: https://www.legisweb.com.br/legislacao/?id=495246 , https://fcm.law/en/stablecoin-no-cambio-efx-bcb-561/blockchain-web3/].
- Proposta de retenção de até 24 h para stablecoin destinada a autocustódia/exterior acima de US$ 10 mil: proposta, status final NV [W].
- Drex: a plataforma DLT das fases 1–2 foi descontinuada em nov/2025. Em 2026 segue piloto restrito (garantias/gravames), sem data para o público [W: https://exame.com/future-of-money/drex-vai-ter-3a-fase-entenda-os-proximos-passos-do-piloto-do-banco-central/].
- BRL on-chain: BRZ (Transfero) existe em Solana. BRLA, BRL1 e cREAL em outras redes. Supply BRL total ~US$140M [W]. Mint BRZ Solana NV.
- Implicação para o produto: um SaaS que cobra em USDC de cliente BR e repassa a provedores **custodiando** fundos tende a ser SPSAV (custodiante/intermediária) e/ou câmbio. Para MVP: modelo não custodial (a tesouraria é do provedor ou de parceiro autorizado), ou rampa via PSAV parceira (on/off-ramp Pix↔USDC). Parecer jurídico NV.

## 7. Recomendação — stack Solana devnet ponta a ponta em 2 dias

```
Cliente (Next.js / Expo)                API Fastify                          Solana devnet
session keypair ──x402 fetch──▶  @x402/fastify paymentMiddleware ──▶ x402.org/facilitator (feePayer)
  ▲ recarga 1x via Phantom          payTo = TESOURARIA                    TransferChecked USDC → tesouraria
  │ (wallet-ui/@solana/react ou     onAfterSettle → ledger (Postgres/SQLite)
  │  @phantom/react-native-sdk)     worker 30s: 1 tx N×TransferChecked ──▶ provedor / revendedor
```

1. **API (Fastify)**: `@x402/fastify` + `@x402/svm/exact/server` + `HTTPFacilitatorClient({url:"https://x402.org/facilitator"})`. Rota `GET /svc/:id` com `price:"$0.001"`, `network:"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"`, `payTo: TREASURY`. A tabela `split_rules(service_id, recipient, bps)`, o hook `onAfterSettle` e o ledger ficam no app. O worker monta a tx com `@solana/kit` + `@solana-program/token` (`getTransferCheckedInstruction` ×N, cria ATA idempotente se faltar) e assina com a chave da tesouraria (env). Arredondamento: o resto vai para a plataforma.
2. **Web (Next.js)**: `@solana/kit` 8.4 + `@wallet-ui/react` (ou `@solana/react`) só para conectar o Phantom e fazer a **recarga** da session wallet. Os pagamentos usam `@x402/fetch` com `ExactSvmScheme(sessionSigner)` + `registerPolicy` com teto por chamada. Dashboard: saldo da sessão, chamadas pagas, payouts com link para o explorer `?cluster=devnet`.
3. **App (Expo)**: dev build (Expo Go não serve). Session keypair em `expo-secure-store`, `@solana/webcrypto-ed25519-polyfill` + `react-native-get-random-values`. Recarga: `@phantom/react-native-sdk` (iOS+Android) ou, mais barato, mostrar QR/URL Solana Pay do endereço da sessão e pagar do Phantom de outro device. MWA só se a demo for em Android.
4. **Pré-demo**: tesouraria com SOL (airdrop) + ATAs de recebedores criadas antes. Usuários de teste com USDC do faucet Circle.
5. **Fora do escopo de 2 dias** (citar como roadmap): split atômico (facilitator próprio com `extra.splits` / PR #3221), Swig spend limits, `batch-settlement` SVM, Kora para recarga sem SOL, Pix on-ramp via PSAV.

Riscos a testar no dia 1: (a) o facilitator público aceitar memo e preço `$0.001` (amount 1000) em devnet, (b) assinatura do hook `onAfterSettle` e acesso ao tx signature, (c) polyfill Ed25519 do kit no Hermes.

## Apêndice — fora do foco (EVM/fiat), mantido curto

- Base Sepolia no x402.org: `exact`, `upto` e `batch-settlement` (v2) [V]. Coinbase Spend Permissions = EVM smart account [W https://docs.cdp.coinbase.com/wallets/using-wallets/spend-permissions].
- 0xSplits v2: PushSplit/PullSplit com Warehouse, deployado em Base/Polygon/Arbitrum etc. [W https://docs.splits.org/core/split-v2]; `@0xsplits/splits-sdk` 6.7.0 [V]. Sem equivalente oficial na Solana.
- Superfluid `@superfluid-finance/sdk-core` 0.9.0 (EVM) [V].
- Versões EVM [V]: wagmi 3.7.7, viem 2.57.4, @rainbow-me/rainbowkit 2.2.11, connectkit 1.9.2, @reown/appkit 1.8.24, @coinbase/cdp-sdk 1.58.0, @coinbase/onchainkit 1.1.3, thirdweb 5.121.6, permissionless 0.4.1.
- Stripe Connect (destination charges + `application_fee_amount`) e Pix split (Efí, Asaas, Pagar.me, iugu): **não pesquisados nesta sessão** após a mudança de escopo [NV].
- Colosseum "Crypto World's Fair": 14/09 → 12/10/2026, trilha Solana US$100k (10×US$10k) [W https://colosseum.com/worldsfair].
