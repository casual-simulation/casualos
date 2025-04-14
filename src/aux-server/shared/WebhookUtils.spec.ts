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
import type { BotsState } from '@casual-simulation/aux-common';
import { createBot } from '@casual-simulation/aux-common';
import { createStaticHtml } from './WebhookUtils';
import { JSDOM } from 'jsdom';

console.error = jest.fn();

describe('createStaticHtml()', () => {
    const originalFetch = global.fetch;
    let fetch: jest.Mock<
        Promise<{
            status: number;
            ok: boolean;
            text: () => Promise<string>;
        }>
    >;
    let state: BotsState;

    beforeEach(() => {
        fetch = global.fetch = jest.fn();
        global.DOMParser = new JSDOM().window.DOMParser;

        state = {
            test1: createBot('test1', {
                abc: 'def',
            }),
            test2: createBot('test2', {
                ghi: 'jkl',
            }),
        };
    });

    afterAll(() => {
        global.fetch = originalFetch;
        delete (global as any).DOMParser;
    });

    it('should create a static HTML string from the given bots', async () => {
        fetch.mockResolvedValue({
            status: 200,
            ok: true,
            text: async () => `<html><body>test</body></html>`,
        });

        const result = await createStaticHtml(
            state,
            'https://auxplayer.com/static.html'
        );
        const json = JSON.stringify({
            version: 1,
            state,
        });
        expect(result).toEqual(
            `<!DOCTYPE html>\n<html><head></head><body>test<script type="text/aux">${json}</script></body></html>`
        );
        expect(fetch).toHaveBeenCalledWith('https://auxplayer.com/static.html');
    });

    it('should use the given URL', async () => {
        fetch.mockResolvedValue({
            status: 200,
            ok: true,
            text: async () => `<html><body>test</body></html>`,
        });

        const result = await createStaticHtml(
            state,
            'https://auxplayer.com/static2.html'
        );

        const json = JSON.stringify({
            version: 1,
            state,
        });
        expect(result).toEqual(
            `<!DOCTYPE html>\n<html><head></head><body>test<script type="text/aux">${json}</script></body></html>`
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://auxplayer.com/static2.html'
        );
    });

    it('should return null if the fetch fails', async () => {
        fetch.mockResolvedValue({
            status: 200,
            ok: false,
            text: async () => `<html><body>test</body></html>`,
        });

        const result = await createStaticHtml(
            state,
            'https://auxplayer.com/static.html'
        );

        expect(result).toBe(null);
        expect(fetch).toHaveBeenCalledWith('https://auxplayer.com/static.html');
    });
});
