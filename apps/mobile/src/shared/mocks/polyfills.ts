// Side-effect module: imported before `msw` so its globals exist when msw's modules evaluate
// (ES imports run before the importing module's body, so these cannot live in start-server.ts).
import 'react-native-url-polyfill/auto';
import 'fast-text-encoding';

// msw's core references `EventTarget`, `Event`, `MessageEvent`, `EventSource` and (for its
// WebSocket support) `BroadcastChannel` at import time.
// Hermes has none of them and the phone never streams events (it polls REST), so inert stand-ins
// are enough. The web-only SSE handler lives in `@402lab/mocks/browser` and is never loaded here.
class InertEventTarget {
  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true;
  }
}

class InertEvent {
  constructor(readonly type: string) {}
}

class InertMessageEvent extends InertEvent {}

class InertBroadcastChannel extends InertEventTarget {
  constructor(readonly name: string) {
    super();
  }
  postMessage(): void {}
  close(): void {}
}

const missingGlobals = {
  EventTarget: InertEventTarget,
  Event: InertEvent,
  MessageEvent: InertMessageEvent,
  EventSource: InertEventTarget,
  BroadcastChannel: InertBroadcastChannel,
};

for (const [name, standIn] of Object.entries(missingGlobals)) {
  if (!(name in globalThis)) Object.assign(globalThis, { [name]: standIn });
}

// msw builds every mocked Response through `Headers.prototype.getSetCookie` and tags requests with
// `crypto.randomUUID`; Hermes ships neither. Mock traffic carries no cookies and ids only need to
// be unique within the session.
if (typeof Headers.prototype.getSetCookie !== 'function') {
  Headers.prototype.getSetCookie = function getSetCookie(this: Headers): string[] {
    const cookie = this.get('set-cookie');
    return cookie === null ? [] : [cookie];
  };
}

const randomHex = (length: number) =>
  Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const hasRandomUUID =
  'crypto' in globalThis && typeof Reflect.get(globalThis.crypto, 'randomUUID') === 'function';

if (!hasRandomUUID) {
  const randomUUID = (): `${string}-${string}-${string}-${string}-${string}` =>
    `${randomHex(8)}-${randomHex(4)}-4${randomHex(3)}-a${randomHex(3)}-${randomHex(12)}`;
  const existingCrypto: object = 'crypto' in globalThis ? globalThis.crypto : {};
  Object.assign(globalThis, { crypto: Object.assign(existingCrypto, { randomUUID }) });
}
