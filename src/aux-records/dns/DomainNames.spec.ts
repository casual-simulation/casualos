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
import { normalizeDomainName } from './DomainNames';

describe('normalizeDomainName()', () => {
    it.each([
        ['example.com', 'example.com'],
        ['Bible.Church.org', 'bible.church.org'],
        ['bible.church.org.', 'bible.church.org'],
        ['  app.example.com  ', 'app.example.com'],
        ['my-app.example.co.uk', 'my-app.example.co.uk'],
        ['bücher.example', 'xn--bcher-kva.example'],
    ])('should normalize %s to %s', (given, expected) => {
        expect(normalizeDomainName(given)).toBe(expected);
    });

    it.each([
        [''],
        ['.'],
        ['localhost'],
        ['https://example.com'],
        ['example.com/path'],
        ['example.com:8080'],
        ['*.example.com'],
        ['user@example.com'],
        ['example.com?query'],
        ['example..com'],
        ['-example.com'],
        ['example-.com'],
        ['exa mple.com'],
        ['127.0.0.1'],
        ['[::1]'],
        ['a'.repeat(64) + '.com'],
        [('a'.repeat(60) + '.').repeat(5) + 'com'],
    ])('should reject %s', (given) => {
        expect(normalizeDomainName(given)).toBe(null);
    });
});
