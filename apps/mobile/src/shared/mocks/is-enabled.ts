/** `EXPO_PUBLIC_API_MOCKING=enabled` runs the whole app on `@402lab/mocks` (MSW) fixtures — the stage demo needs no devnet API reachable from the judge's phone. */
export const MOCKING_ENABLED = process.env.EXPO_PUBLIC_API_MOCKING === 'enabled';

// `/api` so the path mocks register (e.g. `/api/allowances`) match once appended to `connection.api`.
// msw matches an origin-less handler URL against the pathname alone, so the host is a placeholder.
export const DEMO_PAIRING = { api: 'http://mock.402lab.local/api', token: 'demo-pairing-token' };
