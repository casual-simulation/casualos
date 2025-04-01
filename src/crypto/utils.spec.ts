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
import {
    formatPublicPEMKey,
    formatPrivatePEMKey,
    parsePrivatePEMKey,
    parsePublicPEMKey,
} from './utils';

describe('crypto', () => {
    describe('utils', () => {
        describe('formatPublicPEMKey()', () => {
            it('should include the public key header and footer', () => {
                const val = 'hello';
                const buffer = Buffer.from(val);
                const pem = formatPublicPEMKey(buffer);

                expect(pem).toMatch(/^-----BEGIN PUBLIC KEY-----/);
                expect(pem).toMatch(/\naGVsbG8=\n/);
                expect(pem).toMatch(/-----END PUBLIC KEY-----$/);
            });
        });

        describe('formatPrivatePEMKey()', () => {
            it('should include the private key header and footer', () => {
                const val = 'hello';
                const buffer = Buffer.from(val);
                const pem = formatPrivatePEMKey(buffer);

                expect(pem).toMatch(/^-----BEGIN PRIVATE KEY-----/);
                expect(pem).toMatch(/\naGVsbG8=\n/);
                expect(pem).toMatch(/-----END PRIVATE KEY-----$/);
            });
        });

        describe('parsePrivatePEMKey()', () => {
            it('should parse the basic private key in PEM format', () => {
                const pem = `-----BEGIN PRIVATE KEY-----\naGVsbG8=\n-----END PRIVATE KEY-----`;
                const key = parsePrivatePEMKey(pem);
                const buffer = Buffer.from(key);
                const val = buffer.toString('utf8');

                expect(val).toBe('hello');
            });

            it('should parse the private key with extra whitespace', () => {
                const pem = ` -----BEGIN PRIVATE KEY-----\naGVsbG8=\n-----END PRIVATE KEY-----\n`;
                const key = parsePrivatePEMKey(pem);
                const buffer = Buffer.from(key);
                const val = buffer.toString('utf8');

                expect(val).toBe('hello');
            });

            it('should parse the private key with extra lines in the key', () => {
                const pem = ` -----BEGIN PRIVATE KEY-----\naGVs\nbG8=\n-----END PRIVATE KEY-----\n`;
                const key = parsePrivatePEMKey(pem);
                const buffer = Buffer.from(key);
                const val = buffer.toString('utf8');

                expect(val).toBe('hello');
            });
        });

        describe('parsePublicPEMKey()', () => {
            it('should parse the basic public key in PEM format', () => {
                const pem = `-----BEGIN PUBLIC KEY-----\naGVsbG8=\n-----END PUBLIC KEY-----`;
                const key = parsePublicPEMKey(pem);
                const buffer = Buffer.from(key);
                const val = buffer.toString('utf8');

                expect(val).toBe('hello');
            });

            it('should parse the public key with extra whitespace', () => {
                const pem = ` -----BEGIN PUBLIC KEY-----\naGVsbG8=\n-----END PUBLIC KEY-----\n`;
                const key = parsePublicPEMKey(pem);
                const buffer = Buffer.from(key);
                const val = buffer.toString('utf8');

                expect(val).toBe('hello');
            });

            it('should parse the public key with extra lines in the key', () => {
                const pem = ` -----BEGIN PUBLIC KEY-----\naGVs\nbG8=\n-----END PUBLIC KEY-----\n`;
                const key = parsePublicPEMKey(pem);
                const buffer = Buffer.from(key);
                const val = buffer.toString('utf8');

                expect(val).toBe('hello');
            });
        });
    });
});
