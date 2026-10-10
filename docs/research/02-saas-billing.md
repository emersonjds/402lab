# 02 — Billing SaaS/cloud e micropagamentos (pesquisa 2026-10-10)

Legenda: [V] conferido na fonte primária (doc oficial lida). [S] fonte secundária (blog/notícia/agregador). [NV] não verificado / divergente.

## Resumo

- Cloud (AWS/GCP/Azure) = pós-pago mensal: consumo acumula, cobra cartão/invoice no dia 1–5 do mês seguinte. Conta, cartão e KYC antes do 1º request.
- APIs de IA (OpenAI/Anthropic) = pré-pago de créditos: mínimo US$5, crédito expira em 1 ano, não reembolsável, cartão internacional obrigatório e recusa frequente fora dos EUA.
- Marketplaces (AWS/Azure/GCP) cobram 3% (SaaS público) e exigem que o vendedor meça e reporte uso de hora em hora via API proprietária, cada uma diferente.
- Metering/billing consolidou: Stripe comprou Metronome (US$1B, fechou jan/2026), Adyen comprou Orb (US$335M, jun/2026), Kong comprou OpenMeter (set/2025). Todos fazem agregação + fatura periódica, não liquidação por request.
- Cartão não fecha conta abaixo de ~US$4: 2,9% + US$0,30 sobre US$0,01 = 3.003% de taxa. On-chain (Base/Solana) custa US$0,0003–0,02 por tx; x402 facilitator Coinbase US$0,001 após 1.000/mês grátis.
- Brasil: IOF 3,5% em compra internacional no cartão (desde 17/07/2025) + spread; ~25% dos brasileiros sem cartão de crédito; Pix PF grátis, mas Pix PJ cobra 0,99–1,45% com mínimo R$1 → também não serve para micro.
- Gateway HTTP 402 encaixa como camada de liquidação por request: agente/humano paga sem conta nem chave por fornecedor, fornecedor recebe sem montar metering hora a hora. x402 (Coinbase/Linux Foundation) e Stripe MPP/x402 já são o padrão emergente — diferencial do hackathon tem que estar no agregador multi-provedor e no on-ramp BRL/Pix, não no protocolo.

## 1. Como hyperscalers cobram hoje

| Item | Fato | Fonte |
|---|---|---|
| AWS ciclo | Fatura fechada no início do mês; cobra método padrão entre dia 1 e 5 pelo uso do mês anterior | [S] https://repost.aws/knowledge-center/monthly-aws-billing |
| GCP ciclo | Mensal: cobra dia 2 pelo mês anterior. "Threshold billing": cobra ao atingir limite automático + saldo no dia 1 | [S] https://cloud.google.com/billing/docs/how-to/billing-cycle |
| Azure ciclo | PAYG faturado mensal; planos SaaS mensais/anuais; VM/container por hora, faturado mensal | [V] https://learn.microsoft.com/en-us/partner-center/marketplace-offers/marketplace-commercial-transaction-capabilities-and-considerations |
| AWS Brasil | AWS Serviços Brasil (SBL) emite NFS-e em BRL; aceita cartão BRL (inclui Elo); invoice só via TED | [S] https://aws.amazon.com/legal/aws-sbl/ |
| Mínimos | Nenhum mínimo mensal nos hyperscalers para PAYG [NV — não achei doc explícita]; mínimos aparecem em contratos (EDP/commit) | — |

### Marketplaces e metering

| Marketplace | Fee | Metering | Fonte |
|---|---|---|---|
| AWS Marketplace | SaaS público 3%; servidor (AMI/container/ML) 20%; privado <US$1M 3%, US$1–10M 2%, ≥US$10M 1,5%, renovações 1,5%; CPPO +0,5%; Coreia do Sul +1% | `BatchMeterUsage`, recomendado de hora em hora, lotes de até 25; dedup por produto/cliente/hora/dimensão; retry com quantidade diferente fatura a original; unsubscribe dá 1h para mandar uso pendente | [V] https://docs.aws.amazon.com/marketplace/latest/userguide/listing-fees.html · [V] https://docs.aws.amazon.com/marketplace/latest/userguide/metering-for-usage.html |
| Microsoft Marketplace | 3% store service fee padrão (publisher recebe 97%) | Marketplace Metering Service API; dimensões custom (banda, tickets, emails), máx 30 por oferta; cobra contra assinatura Microsoft ou cartão | [V] learn.microsoft.com (link acima) · fee [S] https://clazar.io/blog/microsoft-marketplace-fees |
| Google Cloud Marketplace | 3% padrão (modelo variável desde 21/04/2025); 2%/1,5% privados grandes; 1,5% renovação/migração. Era 20% até 2021 | Service Control API (`services.check` + `services.report`), `usageReportingId` por entitlement, report horário | [V] https://docs.cloud.google.com/marketplace/docs/partners/integrated-saas/configure-usage-reports · fee [S] https://www.suger.io/resources/guides/gcp-marketplace/ · [S] https://www.cnbc.com/2021/09/26/google-lowers-its-cloud-marketplace-revenue-share-to-3percent-from-20percent.html |

Leitura: 3 APIs de metering diferentes, todas batch horário + fatura mensal. Vendedor multi-cloud mantém 3 integrações.

## 2. Plataformas de usage-based billing

| Plataforma | Status 2026 | Metering/agregação | Preço | Fonte |
|---|---|---|---|---|
| Stripe Billing (Meters) | Ativa; Billing 0,7% do volume (unificado jul/2024) + taxa do cartão | Agregações sum, count, last; 1.000 ev/s (v1), 10.000 ev/s (v2 meter event stream), até 200k sob contrato; processamento assíncrono; token de sessão v2 dura 15 min | [S] https://docs.stripe.com/api/v2/billing-meter · [S] https://usagebox.com/articles/stripe-billing-fees-2026-the-07-percent-math |
| Metronome | Adquirida pela Stripe (~US$1B, anunciado dez/2025, fechou 14/01/2026). Clientes: OpenAI, Anthropic, Databricks, NVIDIA | Ingestão de bilhões de eventos/dia, saldo de crédito em tempo real | [S] https://stripe.com/blog/metronome-stripe-building-the-future-of-billing · [S] https://www.pymnts.com/acquisitions/2025/stripe-acquires-metronome-to-enhance-metered-pricing-capabilities-for-ai-companies/ |
| Orb | Adquirida pela Adyen (US$335M, anúncio 11/06/2026, fechamento ~01/07/2026) | Metering + rating SQL-like sobre eventos | [S] https://getlago.com/blog/orb-adyen-acquisition-lago-alternative |
| OpenMeter | Adquirida pela Kong (03/09/2025), integrada ao Kong Konnect | Metering em tempo real p/ APIs, eventos, IA | [S] https://konghq.com/blog/news/kong-acquires-openmeter |
| Lago | Independente, open source | `count_agg`, `sum_agg`, `max_agg`, `unique_count_agg`, `latest_agg`, `weighted_sum_agg`, `custom_agg`; wallets/créditos pré-pagos | [S] https://docs.getlago.com/guide/billable-metrics/aggregation-types/overview |
| Amberflo | Independente | Metering + atribuição de custo IA + AI Gateway | [S] https://www.withorb.com/blog/amberflo-reviews |
| Paddle | MoR; 5% + US$0,50 por transação (inclui imposto, fraude) — inviável abaixo de ~US$10 | Não é engine de metering | [S] https://dodopayments.com/blogs/paddle-review |

Padrão comum: evento → agregação por período → fatura → cobrança no cartão. Liquidação é sempre periódica; nenhuma liquida por request.

## 3. Economia do micropagamento

| Trilho | Custo | Fonte |
|---|---|---|
| Stripe cartão EUA | 2,9% + US$0,30 | [S] https://stripe.com/pricing |
| Interchange small-ticket | Visa CPS small ticket ~1,65% + US$0,04; MC ~1,95% + US$0,02 (só interchange, sem adquirente) | [S] https://merchantcostconsulting.com/lower-credit-card-processing-fees/visa-interchange-rates/ |
| Stripe stablecoin | 1,5% flat | [S] https://eco.com/support/en/articles/15083174-stripe-stablecoin-payments-2026 |
| Base (L2) transfer USDC | ~US$0,001–0,02 (exemplo real US$0,017) | [S] https://chaincost.app/guides/base-network-fees/ · [NV — faixas divergem entre fontes] |
| Solana | taxa base ~US$0,00025; ~US$0,0023 com priority fee | [S] https://solanatransactionfee.com/index.html |
| x402 CDP Facilitator | 1.000 settlements/mês grátis, depois US$0,001; protocolo sem fee; settle ~1s; redes: Base, Polygon, Arbitrum, World, Solana | [V] https://docs.cdp.coinbase.com/x402/support/faq · fee [S] https://www.kucoin.com/news/flash/coinbase-x402-facilitator-to-charge-0-001-per-settlement-starting-january-2026 |
| Pix PF | Grátis por regra (Res. BCB 19/2020) | [S] https://www.infomoney.com.br/minhas-financas/pix-pessoas-fisicas-e-empresarios-individuais-nao-serao-cobrados-para-usar-servico-mas-bc-define-duas-excecoes/ |
| Pix PJ recebimento | 0,99–1,45% com mínimo R$1 / máx R$10 (ex.: BB); varia por banco; PSPs digitais cobram fixo | [S] https://www.infomoney.com.br/consumo/pix-pj-pessoa-juridica-taxas-bb-banco-do-brasil-santander-caixa-bancos/ |
| Pix Automático | Lançado 16/06/2025; obrigatório p/ débito automático interbancário (Res. BCB 505) até 01/01/2026; grátis p/ pagador PF; recebedor paga tarifa do PSP (ex.: Efí R$3,50/liquidação; ITP R$0,20–0,50) | [S] https://agenciagov.ebc.com.br/noticias/202506/pix-automatico-chega-em-16-de-junho · [S] https://sejaefi.com.br/blog/qual-custo-do-pix · [NV — tarifas por PSP não conferidas na tabela oficial] |
| Pix escala | ~80 bi tx em 2025, R$35,3 tri, 148M pessoas (86% adultos), 12,8M empresas (Relatório de Gestão BCB, 10/08/2026) | [S] https://agenciabrasil.ebc.com.br/en/node/1699268 |

Conta-chave (cálculo próprio):
- Request de US$0,01 no cartão Stripe: taxa US$0,3003 = 3.003% do valor.
- Ticket mínimo para taxa de cartão ≤10%: 0,30 / (0,10 − 0,029) ≈ US$4,23.
- Mesmo request via x402 em Base: ~US$0,001 facilitator + gas absorvido pelo facilitator → ~10% de US$0,01; a US$0,10 fica ~1%.
- Pix PJ com mínimo R$1 por recebimento mata micro → Pix só serve como on-ramp de saldo (top-up), não por request.

## 4. Dores de quem consome APIs (ranqueadas)

1. **Pré-pago fragmentado por fornecedor** — OpenAI: mínimo US$5, crédito expira em 1 ano, não reembolsável, tiers de rate limit por gasto acumulado (Tier 1 US$5 → Tier 5 US$1.000). Anthropic: créditos pré-pagos no Console. Cada provedor = saldo travado + conta + chave. [V] https://help.openai.com/en/articles/8264644-setting-up-and-managing-prepaid-api-billing · tiers [S] https://benchlm.ai/blog/posts/api-credits-explained
2. **Agente não consegue se cadastrar/pagar** — fluxo assume humano: criar conta, digitar cartão, copiar chave. Coinbase descreve exatamente isso como motivo do x402. Postman 2025: só 24% desenham APIs pensando em agentes; 51% temem chamadas excessivas/não autorizadas de agentes. [V] https://docs.cdp.coinbase.com/x402/support/faq · [S] https://www.postman.com/state-of-api/2025/
3. **Cartão internacional recusado / Brasil** — issues abertas no repo do Claude Code com cartões recusados (Filipinas etc.); prepaid/virtual frequentemente recusado; lista de países suportados. ~24,9% dos brasileiros sem cartão de crédito (Serasa); baixa renda 40% com cartão (Quaest 2024). [S] https://github.com/anthropics/claude-code/issues/65984 · [S] https://diariodopara.com.br/seu-bolso/quase-25-dos-brasileiros-nao-tem-cartao-de-credito-aponta-estudo-da-serasa/ · [NV — % de devs BR sem cartão internacional: sem dado]
4. **IOF 3,5%** em compra internacional no cartão (crédito/débito/pré-pago) desde 17/07/2025 (Decreto 12.499/2025 restabelecido pelo STF); cronograma de redução até 2028 suspenso. + spread cambial do emissor (~4–6%, [NV]). [S] https://www.barbieriadvogados.com/iof-2025-guia-completo-das-aliquotas-apos-decisao-do-stf-analise-juridica/ · [S] https://wise.com/br/blog/iof-cartao-internacional
5. **Pós-pago = risco de surpresa** — hyperscalers cobram depois; GCP alerta testar metering com <US$100 "to avoid large unexpected charges". [V] gcp-usage (link seção 1)
6. **Lock-in / N integrações** — vendedor: 3 APIs de metering + 3% fee por marketplace; comprador: N chaves, N faturas, N saldos.

## 5. Tamanho de mercado

| Métrica | Número | Fonte |
|---|---|---|
| Agentic commerce global 2030 (McKinsey) | US$3–5 tri de volume orquestrado; EUA B2C US$0,9–1 tri. Cenário, só bens, exclui B2B/serviços | [S] https://www.digitalcommerce360.com/2025/10/20/mckinsey-forecast-5-trillion-agentic-commerce-sales-2030/ |
| Gartner B2B 2028 | Agentes intermediando >US$15 tri de compras B2B | [V] https://www.digitalcommerce360.com/2025/11/28/gartner-ai-agents-15-trillion-in-b2b-purchases-by-2028/ |
| Gartner decisões | ≥15% das decisões de trabalho autônomas por agentes até 2028; 33% do software enterprise com agentic AI | [S] https://www.mescomputing.com/news/ai/5-predictions-about-agentic-ai-from-gartner |
| API management 2030 | US$7–47 bi conforme instituto (Polaris US$26,4 bi; TechSci US$21,35 bi). Dispersão grande = número fraco | [S] https://www.polarismarketresearch.com/press-releases/api-management-market · [S] https://www.techsciresearch.com/report/api-management-market/3894.html |
| API economy 2033 | US$45,3 bi, CAGR 23,5% [NV — instituto original não identificado] | [S] https://www.sci-tech-today.com/stats/api-economy-statistics/ |
| x402 tração real | >100M tx em Base até Q1/2026 (Chainalysis); ~165M tx / ~US$50M volume / 69k agentes ativos (abr/2026); início mar/2026 ~131k tx/dia, ~US$28k/dia, ticket médio US$0,20; ~metade teste/farm (meme PING) | [V] https://www.chainalysis.com/blog/x402-agentic-payments-adoption/ · [S] https://workos.com/blog/x402-vs-stripe-mpp-how-to-choose-payment-infrastructure-for-ai-agents-and-mcp-tools-in-2026 · [S] https://presenc.ai/research/x402-protocol-adoption-tracker-2026 |

Leitura: TAM de agentic commerce é enorme mas é projeção de cenário; volume real de pagamento máquina-a-máquina hoje é pequeno (dezenas de US$M acumulados). Pitch honesto: infraestrutura antes da demanda, com tração inicial mensurável.

## 6. Concorrência direta (HTTP 402 / agent payments)

- **x402** (Coinbase → x402 Foundation / Linux Foundation, 40+ membros). Data de lançamento da fundação diverge: doc Coinbase diz abril/2026, outras fontes julho/2026 [NV]. https://docs.cdp.coinbase.com/x402/support/faq
- **Stripe machine payments**: x402 + USDC em Base via PaymentIntents (preview fev/2026); exemplo de US$0,01/request; CLI `purl`. https://www.theblock.co/post/389352/stripe-adds-x402-integration-usdc-agent-payments
- **Stripe/Tempo MPP** (Machine Payments Protocol), lançado 18/03/2026; parceiros citados: Anthropic, OpenAI, Visa, Mastercard, Nubank, Shopify [S] workos (link acima).
- **ACP** (OpenAI+Stripe, set/2025, Shared Payment Token), **AP2** (Google, 60+ firmas), **Visa Intelligent Commerce Connect** (abr/2026, aceita TAP/MPP/ACP/UCP), **Mastercard Agent Pay** (agentic tokens). Foco: checkout de bens, não request de API. https://www.digitalcommerce360.com/2026/04/02/visa-mastercard-in-agentic-commerce/
- Cloudflare Agents SDK com x402 em produção [S] presenc.ai.

## 7. Onde o gateway HTTP 402 encaixa

Lacuna: billing de API hoje = conta + chave + crédito pré-pago (IA) ou pós-pago mensal (cloud), com metering batch horário. Nada liquida por request para quem não tem conta.

Encaixe proposto:
1. **Proxy 402 multi-provedor**: uma carteira/saldo → chama OpenAI, Anthropic, Gemini, AWS Bedrock etc. Gateway detém as chaves upstream e revende por request com markup; cliente (humano ou agente) não abre conta em ninguém. Resolve dores 1, 2, 6.
2. **On-ramp BRL**: top-up de saldo via Pix (1 Pix grande, não 1 por request) convertido para USDC/saldo interno → elimina IOF 3,5% do cartão e a recusa de cartão internacional. Dores 3, 4. [Atenção: câmbio/cripto no Brasil tem regulação própria (Lei 14.478/2022, normas BCB de VASP) e pode incidir IOF câmbio — NV, validar antes do pitch.]
3. **Liquidação por request ou por lote**: x402 nativo (Base/Solana) por request; para tickets < ~US$0,001 agregar off-chain (saldo/canal) e liquidar em lote — mesma lógica de metering, mas pré-pago e sem fatura.
4. **Para o vendedor**: substitui `BatchMeterUsage`/Service Control/Metering API por "responda 402 com preço" — sem marketplace 3%, sem fatura, sem inadimplência (pago antes de servir).
5. **Guarda-chuva de gasto para agentes**: limite por agente/sessão/endpoint — atende o medo nº1 do Postman (chamadas excessivas).

Riscos: x402/Stripe já ocupam o protocolo; volume real ainda baixo e metade especulativo; revenda de API de terceiros pode violar ToS dos provedores (OpenAI/Anthropic) [NV — conferir termos]; regulação cripto/câmbio BR.

## Não verificado / lacunas

- Mínimo mensal nos hyperscalers PAYG (assumido inexistente).
- Faixa exata de gas USDC em Base (fontes variam US$0,001–0,10).
- Tarifas Pix Automático por PSP; limite Pix noturno (não confirmado nesta pesquisa).
- % de devs brasileiros sem cartão internacional — sem dado público achado.
- Spread cambial típico do cartão no Brasil.
- Data da x402 Foundation (abr vs jul/2026).
- Fonte primária do "API economy US$45,3 bi 2033".
- Termos de uso de OpenAI/Anthropic sobre revenda/proxy de API.
