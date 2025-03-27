/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import asn1 from 'asn1.js';
import BN from 'bn.js';

// From https://stackoverflow.com/questions/39499040/generating-ecdsa-signature-with-node-js-crypto

const EcdsaDerSignature = asn1.define('ECPrivateKey', function () {
    return this.seq().obj(this.key('r').int(), this.key('s').int());
});

/**
 * Converts a signature from node.js's crypto format to a format that
 * is compatible with SubtleCrypto in web browsers. (ASN1/DER to Concatenated bytes)
 * @param buffer The buffer.
 */
export function nodeSignatureToWebSignature(buffer: Buffer): Buffer {
    const rsSig = EcdsaDerSignature.decode(buffer, 'der');
    return Buffer.concat([
        rsSig.r.toArrayLike(Buffer, 'be', 32),
        rsSig.s.toArrayLike(Buffer, 'be', 32),
    ]);
}

/**
 * Converts a signature from SubtleCrypto's format to a format that is compatible
 * with node.js. (Concatenated bytes to ASN1/DER)
 * @param buffer
 */
export function webSignatureToNodeSignature(buffer: Buffer): Buffer {
    const r = new BN(buffer.slice(0, 32).toString('hex'), 16, 'be');
    const s = new BN(buffer.slice(32).toString('hex'), 16, 'be');
    return EcdsaDerSignature.encode({ r, s }, 'der');
}
