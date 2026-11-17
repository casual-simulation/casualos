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

import { AuthHandler } from './AuthHandler';
import { authManager } from '../shared/index';
import { formatV1SessionKey } from '@casual-simulation/aux-common';

jest.mock('../shared/index', () => ({
    authManager: {
        currentSessionKey: null as string | null,
        client: { getUserInfo: jest.fn(), createRecordKey: jest.fn() },
        replaceSession: jest.fn(),
        logout: jest.fn(),
        isLoggedIn: jest.fn(),
        loadUserInfo: jest.fn(),
        userInfoLoaded: false,
    },
}));
jest.mock('../../../../aux-vm-browser/html/IFrameHelpers', () => ({
    listenForChannels: jest.fn(),
}));

const manager = authManager as any;
const day = 24 * 60 * 60 * 1000;
describe('AuthHandler session reliability', () => {
    let handler: AuthHandler;
    const originalChannel = globalThis.BroadcastChannel;
    beforeEach(() => {
        jest.useFakeTimers({ now: 0 });
        jest.clearAllMocks();
        manager.client.createRecordKey.mockReset();
        manager.logout.mockReset();
        globalThis.BroadcastChannel = class {
            addEventListener() {}
        } as any;
        manager.currentSessionKey = formatV1SessionKey(
            'user',
            'session',
            'secret',
            day
        );
        manager.isLoggedIn.mockReturnValue(true);
        manager.userInfoLoaded = false;
        handler = new AuthHandler();
        (handler as any)._loginData = { userId: 'user' };
        (handler as any)._initPromise = Promise.resolve();
        (handler as any)._loggedIn = true;
    });
    afterEach(() => {
        jest.useRealTimers();
        globalThis.BroadcastChannel = originalChannel;
    });

    it.each([
        'not_logged_in',
        'unacceptable_session_key',
        'invalid_key',
        'session_expired',
    ])(
        'does not log out a newer session after a stale record-key failure (%s)',
        async (errorCode) => {
            let finish: (result: any) => void;
            let started: () => void;
            const requested = new Promise<void>(
                (resolve) => (started = resolve)
            );
            manager.client.createRecordKey.mockImplementation(() => {
                started();
                return new Promise((resolve) => (finish = resolve));
            });
            const login = jest.spyOn(handler, 'login');
            const pending = handler.createPublicRecordKey(
                'record',
                'subjectfull'
            );
            await requested;
            const newer = formatV1SessionKey(
                'user',
                'new-session',
                'secret',
                day
            );
            manager.currentSessionKey = newer;
            const failure = { success: false, errorCode };
            finish(failure);
            expect(await pending).toEqual(failure);
            expect(manager.logout).not.toHaveBeenCalled();
            expect(login).not.toHaveBeenCalled();
            expect(manager.currentSessionKey).toBe(newer);
            expect((handler as any)._loggedIn).toBe(true);
        }
    );

    it('still reauthenticates and retries a record-key failure for the current session', async () => {
        const success = { success: true, recordKey: 'key' };
        manager.client.createRecordKey
            .mockResolvedValueOnce({ success: false, errorCode: 'invalid_key' })
            .mockResolvedValueOnce(success);
        manager.logout.mockImplementation(async () => {
            manager.currentSessionKey = null;
        });
        const login = jest
            .spyOn(handler, 'login')
            .mockImplementation(async () => {
                manager.currentSessionKey = formatV1SessionKey(
                    'user',
                    'replacement',
                    'secret',
                    day
                );
                return null;
            });
        jest.spyOn(handler, 'isLoggedIn')
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(true);
        expect(
            await handler.createPublicRecordKey('record', 'subjectfull')
        ).toEqual(success);
        expect(manager.logout).toHaveBeenCalledWith(false);
        expect(login).toHaveBeenCalledTimes(1);
        expect(manager.client.createRecordKey).toHaveBeenCalledTimes(2);
    });

    it.each(['server_error', 'rate_limit_exceeded'])(
        'does not log out after transient relogin failure (%s)',
        async (errorCode) => {
            manager.client.getUserInfo.mockResolvedValue({
                success: false,
                errorCode,
            });
            expect(await handler.relogin()).toEqual({ userId: 'user' });
            expect(manager.logout).not.toHaveBeenCalled();
        }
    );

    it('logs out after an invalid session is confirmed', async () => {
        manager.client.getUserInfo.mockResolvedValue({
            success: false,
            errorCode: 'invalid_key',
        });
        const login = jest.spyOn(handler, 'login').mockResolvedValue(null);
        await handler.relogin();
        expect(manager.logout).toHaveBeenCalledWith(false);
        expect(login).toHaveBeenCalled();
    });

    it('retries metadata after an offline initialization', async () => {
        (handler as any)._loggedIn = false;
        manager.loadUserInfo.mockImplementation(async () => {
            manager.userInfoLoaded = true;
            return true;
        });
        manager.currentSessionKey = formatV1SessionKey(
            'user',
            'session',
            'secret',
            30 * day
        );
        expect(await handler.isLoggedIn()).toBe(true);
        expect(manager.loadUserInfo).toHaveBeenCalledTimes(1);
    });

    it('retries a failed refresh and schedules the next successful refresh', async () => {
        manager.replaceSession.mockRejectedValueOnce(
            new Error('network suspended')
        );
        await (handler as any)._refreshToken();
        expect(manager.logout).not.toHaveBeenCalled();
        manager.replaceSession.mockImplementationOnce(async () => {
            manager.currentSessionKey = formatV1SessionKey(
                'user',
                'next',
                'secret',
                30 * day
            );
            return { success: true };
        });
        await jest.advanceTimersByTimeAsync(60_000);
        expect(manager.replaceSession).toHaveBeenCalledTimes(2);
        expect(jest.getTimerCount()).toBe(1);
        await handler.logout();
        expect(jest.getTimerCount()).toBe(0);
    });

    it('clamps long timer delays without rotating a session early', async () => {
        manager.currentSessionKey = formatV1SessionKey(
            'user',
            'session',
            'secret',
            100 * day
        );
        const timer = jest.spyOn(globalThis, 'setTimeout');
        (handler as any)._queueTokenRefresh(manager.currentSessionKey);
        expect(timer).toHaveBeenLastCalledWith(
            expect.any(Function),
            2_147_483_647
        );
        await jest.advanceTimersByTimeAsync(2_147_483_647);
        expect(manager.replaceSession).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(1);
        timer.mockRestore();
    });
});
