// Single entry point for the WebExtension APIs, so one source tree runs on both
// engines.
//
// Chrome and Brave expose `chrome`; Firefox exposes `browser`. Firefox does also
// provide a `chrome` alias, but only its `browser` namespace is reliably
// promise-based — and every call in this extension is awaited. Chrome's own
// `chrome.*` returns promises under MV3 when no callback is passed, so
// preferring `browser` and falling back to `chrome` gives promises on both.
//
// Import this instead of touching the globals directly:
//   import { browserApi } from '../shared/browserApi.js';
//   await browserApi.storage.sync.get(...)
export const browserApi = globalThis.browser ?? globalThis.chrome;
