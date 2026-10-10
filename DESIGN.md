# DESIGN.md — 402Lab

Design system for every 402Lab surface (landing, web panel, mobile). AI agents and humans read this before touching UI. Base for the web panel: TailAdmin (Next.js 16 + Tailwind 4) recolored with these tokens.

## Product feel

"Pocket money for AI agents." A fintech terminal meets a block explorer: precise, calm, trustworthy, a little playful. Money is the hero; on-chain proof is always one click away.

Never: purple/blue gradients, glassmorphism everywhere, emoji as icons, stock 3D blobs, generic "AI startup" hero. Every decorative element must carry information.

## Color tokens

Dark is the default theme. Light exists only for the printable statement.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0B0D10` | page background |
| `surface` | `#14171C` | cards, sidebar, tables |
| `raised` | `#1C2027` | hover rows, inputs, popovers |
| `line` | `#262B33` | 1px borders, dividers |
| `text` | `#E8EAED` | primary text |
| `muted` | `#8A93A0` | secondary text, labels |
| `lime` (brand) | `#B6F23A` | primary action, money moving, success, ACTIVE/SETTLED |
| `cyan` | `#38D9F5` | on-chain links (Solscan), info |
| `amber` | `#F5B83D` | pause, warnings, DEVNET badge, PAUSED/PENDING |
| `red` | `#FF5C5C` | errors, FAILED, destructive |

Lime text on lime backgrounds uses `#0B0D10` for contrast. All text pairs meet WCAG AA.

TailAdmin mapping: `--color-brand-*` scale is regenerated around `#B6F23A` (brand-500), `success-*` around lime, `warning-*` around amber, `error-*` around red, `blue-light-*` around cyan, `gray-*` around the neutrals above; `dark` class on `<html>` by default.

## Typography

| Role | Font | Size / line height |
|---|---|---|
| Display (landing hero) | Space Grotesk 600 | 56/64 desktop, 40/48 mobile |
| Title | Space Grotesk 600 | 32/40, 24/32 |
| Body | Inter 400/500 | 16/24 (never below 16px in inputs) |
| Label | Inter 500 | 14/20, 12/18 uppercase tracking 0.04em for table heads |
| Numbers, addresses, signatures | JetBrains Mono 500 | tabular-nums, same size as context |

Money always `$0.005` style via `formatUsd` (no trailing zeros). Addresses `7xKp…9fQ2`. Signatures `5Jt…xQ`.

## Spacing, shape, motion

- 4px base grid: 4, 8, 12, 16, 24, 32, 48, 64.
- Radius: 12px cards, 8px inputs/buttons, full for pills.
- Borders 1px `line`; shadows only on popovers/modals.
- Motion 150–200ms ease-out; new feed rows slide + lime flash 600ms; respect `prefers-reduced-motion`.

## Components (reuse TailAdmin first)

| Need | Use |
|---|---|
| Buttons | TailAdmin `ui/button` — primary = lime bg + dark text; secondary = outline `line`; ghost |
| Status | TailAdmin `ui/badge` — ACTIVE/SETTLED lime, PAUSED/PENDING amber, FAILED red, always text + icon |
| KPI cards | TailAdmin `ecommerce/EcommerceMetrics` pattern |
| Spend chart | TailAdmin ApexCharts (`StatisticsChart`/`MonthlySalesChart`) recolored |
| Feed / payments / splits | TailAdmin `tables` / `RecentOrders` pattern |
| Forms | TailAdmin `form/input`, `Label`, `Form` |
| Modals (fund, pair phone) | TailAdmin `ui/modal` + `useModal` |
| Alerts / errors | TailAdmin `ui/alert` with fixed copy |
| Connect wallet | TailAdmin `(auth)/signin` layout, wallet list instead of email form |
| Layout | TailAdmin `AppSidebar`, `AppHeader`, `SidebarContext`, `ThemeContext` |

Create a new component only when no TailAdmin piece fits; put it in the same folder style.

## Interaction rules (Vercel Web Interface Guidelines)

- Everything keyboard-operable; visible `:focus-visible` ring (lime 2px offset 2px).
- Hit targets ≥ 44px on mobile, ≥ 24px desktop.
- Inputs ≥ 16px font; never block paste; correct `type`/`inputmode`/`autocomplete`.
- Loading buttons keep their label and show a spinner; skeletons over spinners for data.
- Optimistic updates for pause/resume, roll back with a fixed message.
- URL is state (selected allowance, month of statement).
- Errors are fixed copy — never render server, facilitator or RPC text.
- Destructive actions confirm (revoke devices).
- 375px first; no horizontal scroll; tables become stacked cards on mobile.

## Copy voice

English, short, concrete. Verbs on buttons ("Connect wallet", "Create allowance", "Pause agent"). Numbers before adjectives ("3 calls · $0.017"). Simulated things say so: "Pix (simulated — devnet)".
