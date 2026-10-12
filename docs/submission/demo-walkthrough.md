# 402Lab: live walkthrough script (about 2:30)

Record on the real app, https://web-production-1b5d1.up.railway.app, with Phantom on Solana
Devnet and the three agents already paying in the background (`npm run traffic:devnet`). Read the
quoted lines while you do the action written above them. Speak calmly; pauses are cut in editing.

## 1. Landing (0:00 to 0:15)

Open the landing page and scroll once.

> This is 402Lab, the spending account for AI agents. Your agents pay for any API, one call at a
> time, in USDC on Solana, and you set the limits.

## 2. Connect (0:15 to 0:35)

Click **Launch Agent**, then **Phantom**, then **Sign message**.

> I sign in with my Solana wallet. It is only a signature: no transaction and no fee. Every
> service on the right can be paid this way, per request, by an agent.

## 3. Overview (0:35 to 1:00)

Wait on the overview for a few seconds so new payments arrive.

> This is the owner's view. I have three agents running right now on devnet. Spend in the last
> 24 hours, calls by provider, and the live settlement stream. Each line is a real USDC payment
> that an agent made by itself through HTTP 402.

## 4. One agent (1:00 to 1:30)

Open **Agents**, then **research-bot**. Click **View on Solscan** on the newest payment.

> Each agent has an allowance: two cents per call and one dollar per day. Here is what this
> agent spent today and every payment it made. And this is the same payment on Solscan: a real
> transfer of USDC on Solana devnet, settled in about a second, with the network fee paid by the
> facilitator, not by the agent.

## 5. Splits (1:30 to 1:50)

Open **Splits**.

> Providers get paid automatically. Every 30 seconds one Solana transaction splits the revenue:
> 85% to the provider, 5% to the integrator and 10% to the platform. Here is what each provider
> earned today.

## 6. Pause (1:50 to 2:10)

Back on **research-bot**, click **Pause agent**. Wait a few seconds.

> If something looks wrong, I pause the agent with one click, on the web or on my phone. Its next
> call is refused before any money moves, and the other agents keep working.

Click **Resume** afterwards.

## 7. Statement and close (2:10 to 2:30)

Open **Statement**.

> At the end of the month I get one statement per agent, with what the same calls would have
> cost on a card plus IOF. 402Lab: the spending account for AI agents.

## Before you hit record

- Phantom in Testnet mode on Solana Devnet, already approved for the site.
- Traffic running, so the overview and the agent page keep moving.
- Browser at 100% or 110% zoom, full screen, notifications off.
- Record screen and microphone together (Loom, or `Cmd+Shift+5` with the microphone on).
