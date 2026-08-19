const { webcrypto } = require('node:crypto');
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  globalThis.crypto = webcrypto;
}
