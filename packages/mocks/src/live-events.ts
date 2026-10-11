import { sse } from 'msw';

import { maybeAdvanceLiveFeed } from './fixtures.js';

const LIVE_FEED_INTERVAL_MS = 4_000;

/** `GET /api/events` stream for the web dashboard; msw's `sse()` needs browser globals Hermes lacks. */
export const liveEventsHandler = sse('*/api/events', ({ client, finalize }) => {
  const sendNextPayment = () => {
    const payment = maybeAdvanceLiveFeed();
    if (!payment) return;

    client.send({
      data: JSON.stringify({
        type: 'payment.settled',
        paymentId: payment.id,
        serviceId: payment.serviceId,
        allowanceId: payment.allowanceId,
        amount: payment.amount.toString(),
        txSignature: payment.txSignature,
        settledAt: payment.settledAt,
      }),
    });
  };

  const interval = setInterval(sendNextPayment, LIVE_FEED_INTERVAL_MS);
  finalize(() => {
    clearInterval(interval);
  });
});
