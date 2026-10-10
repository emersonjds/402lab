import type { LiveEvent } from '@402lab/shared';
import { describe, expect, it } from 'vitest';

import { createEventsBus } from '../src/shared/events-bus.js';

const event: LiveEvent = {
  type: 'split.confirmed',
  batchId: 'batch-id',
  txSignature: 'split-signature',
};

describe('events bus', () => {
  it('delivers an event only to listeners of its owner', () => {
    const bus = createEventsBus();
    const ownerEvents: LiveEvent[] = [];
    const strangerEvents: LiveEvent[] = [];
    bus.subscribe('owner-address', (received) => ownerEvents.push(received));
    bus.subscribe('stranger-address', (received) => strangerEvents.push(received));

    bus.publish('owner-address', event);
    bus.publish(null, event);

    expect(ownerEvents).toEqual([event]);
    expect(strangerEvents).toEqual([]);
  });

  it('stops delivering to a listener after it unsubscribes, keeping the others', () => {
    const bus = createEventsBus();
    const leaving: LiveEvent[] = [];
    const staying: LiveEvent[] = [];
    const unsubscribeLeaving = bus.subscribe('owner-address', (live) => leaving.push(live));
    const unsubscribeStaying = bus.subscribe('owner-address', (live) => staying.push(live));

    unsubscribeLeaving();
    bus.publish('owner-address', event);
    unsubscribeStaying();
    bus.publish('owner-address', event);

    expect(leaving).toEqual([]);
    expect(staying).toEqual([event]);
  });

  it('keeps delivering to the other listeners when one throws', () => {
    const bus = createEventsBus();
    const received: LiveEvent[] = [];
    bus.subscribe('owner-address', () => {
      throw new Error('closed stream');
    });
    bus.subscribe('owner-address', (live) => received.push(live));

    expect(() => {
      bus.publish('owner-address', event);
    }).not.toThrow();
    expect(received).toEqual([event]);
  });
});
