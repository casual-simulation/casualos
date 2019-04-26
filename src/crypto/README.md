# Crypto

![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/crypto.svg)

A common set of crypto helpers.

Defines a common interface for crypto implementations between web browsers and Node.js. (Currently only signing/verification and SHA-256 hashing is implemented)

## Installation

```
npm install @casual-simulation/crypto
```

## Usage

```js
// ES6-style imports are required.
// If you are running in an environment that does not support ES Modules,
// then use Webpack or Babel to transpile to the format you want. (like CommonJS)
import { getHash, parsePublicPEMKey } from '@casual-simulation/crypto';

let myHash = getHash('Hello, World');

console.log('Hash: ', myHash);
// Hash: 03675ac53ff9cd1535ccc7dfcdfa2c458c5218371f418dc136f2d19ac1fbe8a5

let publicKeyPEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAryQICCl6NZ5gDKrnSztO
3Hy8PEUcuyvg/ikC+VcIo2SFFSf18a3IMYldIugqqqZCs4/4uVW3sbdLs/6PfgdX
7O9D22ZiFWHPYA2k2N744MNiCD1UE+tJyllUhSblK48bn+v1oZHCM0nYQ2NqUkvS
j+hwUU3RiWl7x3D2s9wSdNt7XUtW05a/FXehsPSiJfKvHJJnGOX0BgTvkLnkAOTd
OrUZ/wK69Dzu4IvrN4vs9Nes8vbwPa/ddZEzGR0cQMt0JBkhk9kU/qwqUseP1QRJ
5I1jR4g8aYPL/ke9K35PxZWuDp3U0UPAZ3PjFAh+5T+fc7gzCs9dPzSHloruU+gl
FQIDAQAB
-----END PUBLIC KEY-----`;

let publicKeyBytes = parsePublicPEMKey(publicKeyPEM);
console.log(publicKeyBytes.byteLength);
```
