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
import { getFinalUrl, getFinalProtocol, isSecureProtocol } from './UrlHelpers';

describe('UrlHelpers', () => {
    describe('getFinalUrl()', () => {
        it('should use the default URL if no override is provided', () => {
            expect(getFinalUrl('http://example.com', null)).toEqual(
                'http://example.com'
            );
        });

        it('should use the given override host if provided', () => {
            expect(
                getFinalUrl('http://example.com', 'http://different.com')
            ).toEqual('http://different.com');
        });

        it('should use the protocol from the default if it is more secure', () => {
            expect(
                getFinalUrl('https://example.com', 'http://different.com')
            ).toEqual('https://different.com');
        });

        it('should use the protocol from the override if it is more secure', () => {
            expect(
                getFinalUrl('http://example.com', 'https://different.com')
            ).toEqual('https://different.com');
        });
    });

    describe('getFinalProtocol()', () => {
        const cases = [
            ['http:', 'http:', 'http:'],
            ['https:', 'http:', 'https:'],
            ['http:', 'https:', 'https:'],
            ['https:', 'https:', 'https:'],
        ];
        it.each(cases)(
            'should use the most secure protocol [%s, %s, %s]',
            (first, second, expected) => {
                expect(getFinalProtocol(first, second)).toEqual(expected);
            }
        );
    });

    describe('isSecureProtocol()', () => {
        const cases = [['http:', false] as const, ['https:', true] as const];
        it.each(cases)('should map %s to %s', (protocol, expected) => {
            expect(isSecureProtocol(protocol)).toBe(expected);
        });
    });
});
