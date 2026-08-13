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
import { shouldForwardEmbedMessage } from './PlayerApp.embedMessages';

describe('shouldForwardEmbedMessage()', () => {
    it('should return true for a message from the actual parent window', () => {
        const parentWindow = {};

        const result = shouldForwardEmbedMessage(
            { source: parentWindow, origin: 'https://example.com' },
            parentWindow,
            true,
            'https://auth.example.com'
        );

        expect(result).toBe(true);
    });

    it('should return false when the message source is not the parent window', () => {
        const parentWindow = {};
        const otherSource = {};

        const result = shouldForwardEmbedMessage(
            { source: otherSource, origin: 'https://example.com' },
            parentWindow,
            true,
            'https://auth.example.com'
        );

        expect(result).toBe(false);
    });

    it('should return false when the message origin matches the auth origin', () => {
        const parentWindow = {};

        const result = shouldForwardEmbedMessage(
            { source: parentWindow, origin: 'https://auth.example.com' },
            parentWindow,
            true,
            'https://auth.example.com'
        );

        expect(result).toBe(false);
    });

    it('should return false when the page is not embedded', () => {
        const parentWindow = {};

        const result = shouldForwardEmbedMessage(
            { source: parentWindow, origin: 'https://example.com' },
            parentWindow,
            false,
            'https://auth.example.com'
        );

        expect(result).toBe(false);
    });

    it('should return true when no auth origin is configured', () => {
        const parentWindow = {};

        const result = shouldForwardEmbedMessage(
            { source: parentWindow, origin: 'https://example.com' },
            parentWindow,
            true,
            null
        );

        expect(result).toBe(true);
    });
});
