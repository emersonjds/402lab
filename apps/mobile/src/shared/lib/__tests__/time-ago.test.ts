import { timeAgo } from '../time-ago';

const NOW = Date.parse('2026-10-10T12:00:00.000Z');

describe('timeAgo', () => {
  it.each([
    ['2026-10-10T12:00:00.000Z', '0s ago'],
    ['2026-10-10T12:00:05.000Z', '0s ago'],
    ['2026-10-10T11:59:48.000Z', '12s ago'],
    ['2026-10-10T11:57:00.000Z', '3m ago'],
    ['2026-10-10T10:00:00.000Z', '2h ago'],
    ['2026-10-08T12:00:00.000Z', '2d ago'],
  ])('%s → %s', (iso, expected) => {
    expect(timeAgo(iso, NOW)).toBe(expected);
  });
});
