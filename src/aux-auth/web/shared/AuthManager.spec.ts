import {
    CompleteLoginSuccess,
    LoginRequestSuccess,
} from '@casual-simulation/aux-records/AuthController';
import { resourceUsage } from 'process';
import { AuthManager } from './AuthManager';

jest.mock('axios');

console.log = jest.fn();

describe('AuthManager', () => {
    let manager: AuthManager;

    beforeEach(() => {
        mockLocalStorage();
        manager = new AuthManager('http://myendpoint.localhost', 'v9.9.9-dev');
    });

    afterEach(() => {
        resetLocalStorage();
    });

    function setResponse(response: any) {
        require('axios').__setResponse(response);
    }

    function setNextResponse(response: any) {
        require('axios').__setNextResponse(response);
    }

    function getLastPost() {
        return require('axios').__getLastPost();
    }

    function getLastGet() {
        return require('axios').__getLastGet();
    }

    function getRequests() {
        return require('axios').__getRequests();
    }

    describe('loginWithEmail()', () => {
        it('should send a login request with the given email', async () => {
            setResponse({
                data: {
                    success: true,
                    userId: 'myuserid',
                    requestId: 'myrequestid',
                    address: 'myAddress',
                    addressType: 'email',
                    expireTimeMs: 1234,
                } as LoginRequestSuccess,
            });

            const response = await manager.loginWithEmail('myAddress');

            expect(response).toEqual({
                success: true,
                userId: 'myuserid',
                requestId: 'myrequestid',
                address: 'myAddress',
                addressType: 'email',
                expireTimeMs: 1234,
            });
            expect(getLastPost()).toEqual([
                'http://myendpoint.localhost/api/v2/login',
                { address: 'myAddress', addressType: 'email' },
                expect.any(Object),
            ]);
        });
    });

    describe('loginWithPhoneNumber()', () => {
        it('should send a login request with the given phone number', async () => {
            setResponse({
                data: {
                    success: true,
                    userId: 'myuserid',
                    requestId: 'myrequestid',
                    address: 'myAddress',
                    addressType: 'phone',
                    expireTimeMs: 1234,
                } as LoginRequestSuccess,
            });

            const response = await manager.loginWithPhoneNumber('myAddress');

            expect(response).toEqual({
                success: true,
                userId: 'myuserid',
                requestId: 'myrequestid',
                address: 'myAddress',
                addressType: 'phone',
                expireTimeMs: 1234,
            });
            expect(getLastPost()).toEqual([
                'http://myendpoint.localhost/api/v2/login',
                { address: 'myAddress', addressType: 'phone' },
                expect.any(Object),
            ]);
        });
    });

    describe('completeLogin()', () => {
        it('should send a complete login request with the given values', async () => {
            setResponse({
                data: {
                    success: true,
                    userId: 'myuserid',
                    requestId: 'myrequestid',
                    expireTimeMs: 1234,
                    sessionKey: 'sessionKey',
                } as CompleteLoginSuccess,
            });

            const response = await manager.completeLogin(
                'myuserid',
                'myrequestid',
                'mycode'
            );

            expect(response).toEqual({
                success: true,
                userId: 'myuserid',
                requestId: 'myrequestid',
                expireTimeMs: 1234,
                sessionKey: 'sessionKey',
            });
            expect(getLastPost()).toEqual([
                'http://myendpoint.localhost/api/v2/completeLogin',
                {
                    userId: 'myuserid',
                    requestId: 'myrequestid',
                    code: 'mycode',
                },
                expect.any(Object),
            ]);

            expect(manager.userId).toBe('myuserid');
            expect(globalThis.localStorage.getItem('sessionKey')).toEqual(
                'sessionKey'
            );
        });
    });

    describe('logout()', () => {
        it('should send a revoke token request', async () => {
            manager.savedSessionKey = 'mysessionkey';
            // @ts-expect-error 2341
            manager._userId = 'myuserid';

            await manager.logout();

            expect(getLastPost()).toEqual([
                'http://myendpoint.localhost/api/v2/revokeSession',
                {
                    sessionKey: 'mysessionkey',
                },
                {
                    headers: {
                        Authorization: 'Bearer mysessionkey',
                    },
                },
            ]);

            expect(manager.userId).toBe(null);
            expect(manager.savedSessionKey).toBe(null);
        });
    });
});

const originalLocalStorage = globalThis.localStorage;

function mockLocalStorage() {
    useLocalStorage(new LocalStorage());
}

function resetLocalStorage() {
    useLocalStorage(originalLocalStorage);
}

function useLocalStorage(storage: typeof globalThis.localStorage) {
    globalThis.localStorage = storage;
}

class LocalStorage {
    private _data = new Map<string, string>();

    get length() {
        return this._data.size;
    }

    key(index: number) {
        return [...this._data.keys()][index];
    }

    getItem(key: string): string {
        return this._data.get(key) || null;
    }

    setItem(key: string, data: string): void {
        this._data.set(key, data);
    }

    removeItem(key: string): void {
        this._data.delete(key);
    }

    clear() {
        this._data.clear();
    }

    use() {
        globalThis.localStorage = this;
    }
}

interface StorageEventInitDict extends EventInit {
    key: string;
    newValue: string;
    oldValue: string;
}

class StorageEvent {
    type: string;
    key: string;
    newValue: string;
    oldValue: string;

    constructor(type: string, eventInitDict: StorageEventInitDict) {
        this.type = type;
        this.key = eventInitDict.key;
        this.newValue = eventInitDict.newValue;
        this.oldValue = eventInitDict.oldValue;
    }
}

function sendStorageEvent(key: string, newValue: string, oldValue: string) {
    let event = new StorageEvent('storage', {
        key,
        newValue,
        oldValue,
    });

    for (let listener of storageListeners) {
        listener(event);
    }
}

let storageListeners = [] as any[];

function polyfillEventListenerFunctions() {
    if (typeof globalThis.addEventListener === 'undefined') {
        globalThis.addEventListener = (event: string, listener: any) => {
            if (event === 'storage') {
                storageListeners.push(listener);
            }
        };
    }

    if (typeof globalThis.removeEventListener === 'undefined') {
        globalThis.removeEventListener = (event: string, listener: any) => {
            if (event === 'storage') {
                let index = storageListeners.indexOf(listener);
                if (index >= 0) {
                    storageListeners.splice(index, 1);
                }
            }
        };
    }
}
