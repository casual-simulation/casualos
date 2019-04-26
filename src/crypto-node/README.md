# Crypto Node

![npm (scoped)](https://img.shields.io/npm/v/@casual-simulation/crypto-node.svg)

An implementation of the `@casual-simulation/crypto` package for Node.js.

## Installation

```
npm install @casual-simulation/crypto-node
```

## Usage

```js
// ES6-style imports are required.
// If you are running in an environment that does not support ES Modules,
// then use Webpack or Babel to transpile to the format you want. (like CommonJS)
import { NodeSigningCryptoImpl } from '@casual-simulation/crypto-node';

// Async is optional. Every method returns a promise.
async function demo() {
    // Currently ECDSA-SHA256-NISTP256 is the only supported
    // algorithm.
    let algorithm = 'ECDSA-SHA256-NISTP256';
    let crypto = new NodeSigningCryptoImpl(algorithm);

    console.log('Crypto Supported: ', crypto.supported());

    // Generate a public-private key pair.
    let [publicKey, privateKey] = await crypto.generateKeyPair();

    // You can export the public and private keys to
    // share them with other devices. (But really only share the public key)
    let exportedPubKey = await crypto.exportKey(publicKey);
    let exportedPrivateKey = await crypto.exportKey(privateKey);

    // You can import keys that were exported using exportKey()
    // via the importPrivateKey() and importPublicKey() methods.

    console.log('Public Key: ', exportedPubKey);
    console.log('Private Key: ', exportedPrivateKey);
    // TODO: Save/share keys

    // Any ArrayBuffer will work
    let data = new Int32Array(100);

    // If you're using webpack, enable the Buffer polyfil.
    // This will let you convert strings to ArrayBuffer compatible
    // objects using Buffer.from(str).
    // Read More: https://webpack.js.org/configuration/node/

    // Fill with pseudo-random data.
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.floor(Math.random() * 100);
    }

    // Sign the data
    let signature = crypto.sign(privateKey, data);

    // TODO: Send or store the signature and data

    // Verify the signature.
    // Note that the data must be provided as well.
    // This is because the signature does not store the data
    // in a usable format.
    let valid = crypto.verify(publicKey, signature, data);
    console.log('Valid: ', valid);
}

demo();
```
