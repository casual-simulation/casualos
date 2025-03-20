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
import { keypair, sign, verify } from './Signatures';
import { toByteArray, fromByteArray } from 'base64-js';

describe('Signatures', () => {
    describe('keypair()', () => {
        it('should return a v1 keypair encrypted with the given password', () => {
            const key = keypair('password');
            const sections = key.split('.');
            const version = sections[0];

            expect(typeof key).toBe('string');
            expect(sections.length).toBe(3);
            expect(version).toBe('vK1');
        });
    });

    describe('sign()', () => {
        it('should sign the given message and return the signature', () => {
            const key = keypair('password');
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const signature = sign(key, 'password', dataBytes);
            const sections = signature.split('.');
            expect(sections.length).toBe(2);
            expect(sections[0]).toBe('vS1');
        });
    });

    describe('verify()', () => {
        it('should return true if the signature is valid', () => {
            const key = keypair('password');
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const signature = sign(key, 'password', dataBytes);
            const valid = verify(key, signature, dataBytes);
            expect(valid).toBe(true);
        });

        it('should return false if the signature was corrupted', () => {
            const key = keypair('password');
            const data = 'hello, world!';
            const encoder = new TextEncoder();
            const dataBytes = encoder.encode(data);
            const signature = sign(key, 'password', dataBytes);
            const [version, base64] = signature.split('.');
            const bytes = toByteArray(base64);
            bytes[bytes.length - 1] = bytes[bytes.length - 1] === 0 ? 1 : 0;
            const corrupted = `${version}.${fromByteArray(bytes)}`;
            const valid = verify(key, corrupted, dataBytes);
            expect(valid).toBe(false);
        });
    });
});
