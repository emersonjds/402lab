# Prompts para o Google Stitch — 402Lab

Use um projeto do Stitch por prompt: **1 Landing (web)**, **2 Dashboard (web)**, **3 App (mobile)**. Gere, ajuste por conversa ("make the feed denser", "increase contrast") e exporte HTML/Tailwind + PNG para `docs/design/stitch/<web|mobile>/`.

---

## Design system (cole no início de cada prompt)

```
Brand: 402Lab — "Pocket money for AI agents". Product: a spending account where a human gives an AI agent a budget (allowance) and the agent pays APIs per call in USDC on Solana using HTTP 402. Audience: developers and crypto hackathon judges. Tone: precise, trustworthy, a little playful. English UI.

Visual direction: dark fintech terminal meets web3 — NOT generic purple gradients, NOT glassmorphism everywhere. Think Linear + Stripe dashboard + a block explorer.
Colors: background #0B0D10, surface #14171C, raised surface #1C2027, border #262B33, text #E8EAED, muted text #8A93A0, primary accent "signal lime" #B6F23A (money moving, primary buttons), secondary cyan #38D9F5 (links to Solscan, on-chain proof), warning amber #F5B83D, danger #FF5C5C, success uses lime.
Typography: Space Grotesk for headings, Inter for body, JetBrains Mono for amounts, addresses and transaction signatures (always tabular numbers).
Shapes: 12px radius cards, 1px borders, subtle inner glow on the active element only. Status pills: ACTIVE (lime), PAUSED (amber), SETTLED (lime), PENDING (muted), FAILED (red).
Money: always shown as USD with up to 4 decimals, e.g. "$0.005", "$0.0210". Addresses truncated "7xKp…9fQ2". Every on-chain item has a small "View on Solscan ↗" cyan link.
Accessibility: WCAG AA contrast, 44px minimum touch targets, form inputs 16px+, never color-only status (pill text + icon).
Badge "DEVNET" in amber in the header of every app screen.
```

---

## Prompt 1 — Landing page (web, desktop + mobile 375px)

```
[cole o design system acima]

Design a responsive marketing landing page for 402Lab (desktop 1440px and mobile 375px).

Sections, in order:
1. Nav: "402Lab" wordmark with a small "402" monospace badge, links (How it works, Pricing, Docs), button "Join waitlist" (lime).
2. Hero: headline "Pocket money for AI agents." Subheadline: "Give your agent a budget. It pays any API per call in USDC on Solana — no cards, no signups, no surprise bills." Primary CTA "Join the waitlist", secondary "Watch the 60s demo". Right side: an animated-looking terminal card showing an agent run:
   > GET /svc/ocr → 402 Payment Required ($0.005)
   > paid 0.005 USDC · sig 5Jt…xQ ✓ 412ms
   > GET /svc/translate → 402 ($0.002) → paid ✓
   > GET /svc/summarize → 402 ($0.010) → paid ✓
   > total $0.017 · card + IOF would cost $0.95
3. Problem strip, 3 stat cards: "3,003%" — "card fee on a $0.01 API call"; "3.5% IOF" — "on every international card purchase in Brazil"; "$5 minimum" — "prepaid credits that expire in a year".
4. How it works, 3 steps with icons: "1. Set an allowance — per-call and daily caps." "2. Your agent pays per call — HTTP 402 + USDC on Solana, settled in ~1s." "3. Providers get paid automatically — revenue split on-chain every 30 seconds."
5. Live proof panel: a mini table of recent payments (service, amount, time, "View on Solscan ↗") and a big counter "You saved $0.93 vs card + IOF".
6. For API providers: "Answer 402 with a price. Get paid per call." with a code snippet (Fastify route with a price "$0.002").
7. Waitlist form: email input + button, small print "Devnet demo. Mainnet after licensing."
8. Footer: "Built for Colosseum Crypto World's Fair · Solana", links GitHub, X, Docs.
```

---

## Prompt 2 — Dashboard (web app, desktop + mobile 375px)

```
[cole o design system acima]

Design the logged-in web app for 402Lab. Left sidebar on desktop (Allowances, Payments, Splits, Statement, Playground, Settings), bottom tab bar on mobile 375px. Header: "DEVNET" amber badge, connected wallet pill "7xKp…9fQ2" with Phantom icon.

Screens:
1. Connect wallet: centered card "Sign in with your Solana wallet", button "Connect Phantom", note "We'll ask you to sign a message. No transaction, no fee."
2. Allowances list: cards per agent — name "research-bot", status pill ACTIVE, "Spent today $0.42 / $1.00" with progress bar, "Per call cap $0.02", "Wallet balance 4.58 USDC", buttons "Open" and "Pause". Empty state: "No agents yet. Create an allowance to let your agent pay for APIs."
3. New allowance (2-step wizard): Step 1 form — Agent name, Session wallet address (prefilled, monospace), Per-call cap ($), Daily cap ($). Step 2 Fund — amount input "5.00 USDC", two options as large selectable cards: "Pay with Phantom (USDC)" and "Pix (simulated — devnet)" with a fake QR code and the label "Simulated for the demo". Success state with Solscan link.
4. Allowance detail (the hero screen of the demo): top KPIs — Spent today $0.017 / $1.00, Calls today 3, Saved vs card + IOF $0.93, Balance 4.983 USDC. Big "Pause agent" button (amber outline) top right. Live feed table that updates in real time, newest on top: time, service (OCR / Translate / Summarize with small provider logos Azure / AWS / Anthropic), amount, card+IOF equivalent struck-through, status pill SETTLED, "View on Solscan ↗". A highlighted new row sliding in. Right column: "Revenue splits" — last batch card "Batch #12 · 3 payouts · confirmed" listing Provider 85% $0.0144, Integrator 5% $0.0008, Platform 10% $0.0018, and "View on Solscan ↗". A card "Pair your phone" with a QR code.
5. Monthly statement (print-friendly, white background variant): header 402Lab, month "October 2026", agent name, totals by service and by provider, table of payments with signatures, total network fees "$0.00 (sponsored)", comparison row "Card + IOF equivalent $X". Button "Print / Save PDF".
6. Playground: left panel input "Image URL" and button "Run agent"; right panel a step timeline: OCR → 402 → paid → result; Translate → 402 → paid → result; Summarize → 402 → paid → result; each step with amount and signature; final summary card.
```

---

## Prompt 3 — Mobile companion app (iOS/Android, 375×812)

```
[cole o design system acima]

Design a mobile companion app for 402Lab (375×812, iOS-first but platform neutral). The app has NO wallet; it pairs with the web dashboard and lets the human watch and stop their AI agents. Bottom area thumb-friendly, 44px+ targets.

Screens:
1. Welcome / pair: illustration of a phone scanning a QR, title "Pair with your dashboard", text "Open 402Lab on your computer → Allowance → Pair your phone.", primary button "Scan QR code". Permission priming sheet before the camera: "We use the camera only to scan the pairing code."
2. Scanner: full-screen camera with a rounded scanning frame, hint "Point at the QR on your dashboard", error toast variant "That's not a 402Lab code. Try again."
3. Agents list: header "Your agents" + DEVNET badge; cards per agent: name, status pill, circular progress "Spent today $0.42 of $1.00", last payment "Translate · $0.002 · 12s ago".
4. Agent detail (demo hero): big spend ring at top ($0.017 of $1.00 today), giant full-width "Pause agent" button (amber, 56px tall) — paused state shows "Agent paused. Payments will be refused." and a lime "Resume" button. Below: live feed list, each row: service icon, name, amount in monospace, time ago, chevron to details. Pull to refresh.
5. Payment detail bottom sheet: service, provider, amount, card + IOF equivalent, split (Provider / Integrator / Platform amounts), signature in monospace with copy button, "View on Solscan ↗".
6. Notification (lock screen mockup): "402Lab · research-bot hit its daily cap ($1.00). Further calls are refused." and a second variant "research-bot paused from your phone."
7. Error/offline state: "Can't reach 402Lab. Retrying…" with a retry button.
```
