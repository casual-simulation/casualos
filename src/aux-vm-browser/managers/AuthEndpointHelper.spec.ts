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
import { AuthEndpointHelper } from './AuthEndpointHelper';

describe('AuthEndpointHelper provider logout', () => {
    const originalWindow = globalThis.window;

    afterEach(() => {
        globalThis.window = originalWindow;
    });

    it.each([undefined, 'https://idp.example.com/logout'])(
        'handles protocol 13 logout URL %s without a popup',
        async (logoutUrl) => {
            const open = jest.fn();
            globalThis.window = {
                location: { href: 'http://player.local/' },
                open,
            } as any;
            const logoutWithRedirect = jest.fn().mockResolvedValue(logoutUrl);
            const logout = jest.fn();
            const helper = Object.create(AuthEndpointHelper.prototype) as any;
            helper._protocolVersion = 13;
            helper._proxy = { logoutWithRedirect, logout };

            await helper._logoutCore();

            expect(logoutWithRedirect).toHaveBeenCalledTimes(1);
            expect(logout).not.toHaveBeenCalled();
            expect(open).not.toHaveBeenCalled();
            expect(window.location.href).toBe(
                logoutUrl ?? 'http://player.local/'
            );
        }
    );

    it('preserves logout compatibility with older auth endpoints', async () => {
        const logout = jest.fn().mockResolvedValue(undefined);
        const logoutWithRedirect = jest.fn();
        const helper = Object.create(AuthEndpointHelper.prototype) as any;
        helper._protocolVersion = 12;
        helper._proxy = { logout, logoutWithRedirect };

        await helper._logoutCore();

        expect(logout).toHaveBeenCalledTimes(1);
        expect(logoutWithRedirect).not.toHaveBeenCalled();
    });
});
