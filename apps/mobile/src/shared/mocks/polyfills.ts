// Side-effect module: imported before `msw` so its globals exist when msw's modules evaluate
// (ES imports run before the importing module's body, so these cannot live in start-server.ts).
import 'react-native-url-polyfill/auto';
import 'fast-text-encoding';

// `@402lab/mocks` builds one `sse()` handler for the web dashboard's live feed, and msw touches
// `EventTarget`, `Event`, `MessageEvent` and `EventSource` at import time. Hermes has none of them;
// the phone polls REST and never opens that stream, so inert stand-ins are enough.
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

const missingGlobals = {
  EventTarget: InertEventTarget,
  Event: InertEvent,
  MessageEvent: InertMessageEvent,
  EventSource: InertEventTarget,
};

for (const [name, standIn] of Object.entries(missingGlobals)) {
  if (!(name in globalThis)) Object.assign(globalThis, { [name]: standIn });
}
