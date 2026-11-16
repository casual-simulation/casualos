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
import { logoutSession } from './logout';

describe('CLI logout', () => {
    it('revokes before clearing and opening provider logout', async () => {
        const order: string[] = [];
        const revokeSession = jest.fn(async () => {
            order.push('revoke');
            return { success: true, logoutUrl: 'https://idp.example/logout' };
        });
        const clear = jest.fn(() => {
            order.push('clear');
        });
        const open = jest.fn(async () => {
            order.push('open');
        });
        await logoutSession({ revokeSession } as any, 'test-key', clear, open);
        expect(revokeSession).toHaveBeenCalledWith(
            { sessionKey: 'test-key' },
            { sessionKey: 'test-key' }
        );
        expect(order).toEqual(['revoke', 'clear', 'open']);
        expect(open).toHaveBeenCalledWith('https://idp.example/logout');
    });
    it.each([false, true])(
        'retains credentials when revocation fails (throws=%s)',
        async (throws) => {
            const revokeSession = jest.fn(async () => {
                if (throws) throw new Error('sensitive upstream error');
                return { success: false };
            });
            const clear = jest.fn();
            const open = jest.fn();
            await expect(
                logoutSession({ revokeSession } as any, 'test-key', clear, open)
            ).rejects.toThrow('saved login was retained');
            expect(clear).not.toHaveBeenCalled();
            expect(open).not.toHaveBeenCalled();
        }
    );
    it('reports provider navigation failure after local revocation', async () => {
        const clear = jest.fn();
        await expect(
            logoutSession(
                {
                    revokeSession: jest.fn(async () => ({
                        success: true,
                        logoutUrl: 'https://idp.example/logout',
                    })),
                } as any,
                'key',
                clear,
                async () => {
                    throw new Error('failed');
                }
            )
        ).rejects.toThrow('session was revoked');
        expect(clear).toHaveBeenCalledTimes(1);
    });
    it('handles already logged out clients without a request', async () => {
        const revokeSession = jest.fn();
        const clear = jest.fn();
        const open = jest.fn();
        await logoutSession({ revokeSession } as any, null, clear, open);
        expect(clear).toHaveBeenCalledTimes(1);
        expect(revokeSession).not.toHaveBeenCalled();
        expect(open).not.toHaveBeenCalled();
    });
});
