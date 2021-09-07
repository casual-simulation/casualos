import { formatAuthToken } from '@casual-simulation/aux-common';
import { MemoryAuthProvider } from './AuthProvider';
import { MemoryRecordsStore } from './RecordsStore';
import { ServerlessRecordsManager } from './ServerlessRecordsManager';

describe('ServerlessRecordsManager', () => {
    let manager: ServerlessRecordsManager;
    let auth: MemoryAuthProvider;
    let store: MemoryRecordsStore;

    beforeEach(() => {
        auth = new MemoryAuthProvider();
        store = new MemoryRecordsStore();
        manager = new ServerlessRecordsManager(auth, store);
    });

    describe('publishRecord()', () => {
        const spaceCases = [
            ['tempGlobal', 'global', 'tempRecords'],
            ['permanentGlobal', 'global', 'permanentRecords'],
            ['tempRestricted', 'restricted', 'tempRecords'],
            ['permanentRestricted', 'restricted', 'permanentRecords'],
        ] as const;

        it.each(spaceCases)(
            'should be able to save %s records',
            async (space, expectedVisibility, recordList) => {
                auth.setTokenIssuer('myToken', 'myUser');

                const result = await manager.publishRecord({
                    token: formatAuthToken('myToken', 'myService'),
                    address: 'myAddress',
                    space: space,
                    record: {
                        special: true,
                    },
                });

                expect((<any>store)[recordList]).toEqual([
                    {
                        issuer: 'myUser',
                        address: 'myAddress',
                        visibility: expectedVisibility,
                        creationDate: expect.any(Number),
                        authorizedUsers: [
                            formatAuthToken('myUser', 'myService'),
                        ],
                        record: {
                            special: true,
                        },
                    },
                ]);
                expect(result).toEqual({
                    status: 200,
                    data: {
                        issuer: 'myUser',
                        address: 'myAddress',
                        space: space,
                    },
                });
            }
        );

        it('should return a 409 status code if the record already exists', async () => {
            auth.setTokenIssuer('myToken', 'myUser');

            await store.saveTemporaryRecord({
                issuer: 'myUser',
                address: 'myAddress',
                creationDate: 0,
                authorizedUsers: [],
                record: {},
                visibility: 'restricted',
            });

            const result = await manager.publishRecord({
                token: formatAuthToken('myToken', 'myService'),
                address: 'myAddress',
                space: 'tempRestricted',
                record: {
                    special: true,
                },
            });

            expect(store.tempRecords).toEqual([
                {
                    issuer: 'myUser',
                    address: 'myAddress',
                    creationDate: 0,
                    authorizedUsers: [],
                    record: {},
                    visibility: 'restricted',
                },
            ]);
            expect(result).toEqual({
                status: 409,
                message: 'Record already exists.',
            });
        });

        it('should return a 403 if the token is invalid', async () => {
            const result = await manager.publishRecord({
                token: formatAuthToken('myToken', 'myService'),
                address: 'myAddress',
                space: 'tempRestricted',
                record: {
                    special: true,
                },
            });

            expect(store.tempRecords).toEqual([]);
            expect(result).toEqual({
                status: 403,
                message: 'Invalid token.',
            });
        });

        it('should return a 400 if the token is missing', async () => {
            const result = await manager.publishRecord({
                token: undefined,
                address: 'myAddress',
                space: 'tempRestricted',
                record: {
                    special: true,
                },
            });

            expect(store.tempRecords).toEqual([]);
            expect(result).toEqual({
                status: 400,
                message: 'Invalid request. A auth token must be provided.',
            });
        });

        it('should return a 403 if the token is incorrectly formatted', async () => {
            const result = await manager.publishRecord({
                token: 'wrong',
                address: 'myAddress',
                space: 'tempRestricted',
                record: {
                    special: true,
                },
            });

            expect(store.tempRecords).toEqual([]);
            expect(result).toEqual({
                status: 403,
                message: 'Invalid token.',
            });
        });
    });

    describe('getRecords()', () => {
        beforeEach(async () => {
            for (let i = 1; i <= 4; i++) {
                await store.savePermanentRecord({
                    issuer: 'myUser',
                    address: 'record/' + i,
                    authorizedUsers: [formatAuthToken('myUser', 'myService')],
                    creationDate: 0,
                    record: {},
                    visibility: 'global',
                });
                await store.savePermanentRecord({
                    issuer: 'myUser',
                    address: 'record/' + (i + 4),
                    authorizedUsers: [formatAuthToken('myUser', 'myService')],
                    creationDate: 0,
                    record: {},
                    visibility: 'restricted',
                });
            }

            for (let i = 1; i <= 4; i++) {
                await store.saveTemporaryRecord({
                    issuer: 'myUser',
                    address: 'record/' + i,
                    authorizedUsers: [formatAuthToken('myUser', 'myService')],
                    creationDate: 0,
                    record: {},
                    visibility: 'global',
                });
                await store.saveTemporaryRecord({
                    issuer: 'myUser',
                    address: 'record/' + (i + 4),
                    authorizedUsers: [formatAuthToken('myUser', 'myService')],
                    creationDate: 0,
                    record: {},
                    visibility: 'restricted',
                });
            }

            auth.setTokenIssuer('myToken', 'myUser');
        });

        it('should be able to retrieve records based on user ID and address', async () => {
            const result = await manager.getRecords({
                token: formatAuthToken('myToken', 'myService'),
                issuer: 'myUser',
                address: 'record/1',
                space: 'permanentGlobal',
            });

            expect(result).toEqual({
                status: 200,
                data: {
                    hasMoreRecords: false,
                    totalCount: 1,
                    records: [
                        {
                            address: 'record/1',
                            authID: 'myUser',
                            data: {},
                            space: 'permanentGlobal',
                        },
                    ],
                },
            });
        });

        it('should be able to retrieve records based on space', async () => {
            const result = await manager.getRecords({
                token: formatAuthToken('myToken', 'myService'),
                issuer: 'myUser',
                address: 'record/1',
                space: 'tempGlobal',
            });

            expect(result).toEqual({
                status: 200,
                data: {
                    hasMoreRecords: false,
                    totalCount: 1,
                    records: [
                        {
                            address: 'record/1',
                            authID: 'myUser',
                            data: {},
                            space: 'tempGlobal',
                        },
                    ],
                },
            });
        });

        it('should be able to retrieve records by prefix', async () => {
            const result = await manager.getRecords({
                token: formatAuthToken('myToken', 'myService'),
                issuer: 'myUser',
                prefix: 'record/',
                space: 'permanentRestricted',
            });

            expect(result).toEqual({
                status: 200,
                data: {
                    cursor: JSON.stringify(2),
                    hasMoreRecords: true,
                    totalCount: 4,
                    records: [
                        {
                            address: 'record/5',
                            authID: 'myUser',
                            data: {},
                            space: 'permanentRestricted',
                        },
                        {
                            address: 'record/6',
                            authID: 'myUser',
                            data: {},
                            space: 'permanentRestricted',
                        },
                    ],
                },
            });
        });

        it('should be able to retrieve records by cursor', async () => {
            const result = await manager.getRecords({
                token: formatAuthToken('myToken', 'myService'),
                issuer: 'myUser',
                cursor: JSON.stringify(2),
                space: 'permanentRestricted',
            });

            expect(result).toEqual({
                status: 200,
                data: {
                    hasMoreRecords: false,
                    totalCount: 4,
                    records: [
                        {
                            address: 'record/7',
                            authID: 'myUser',
                            data: {},
                            space: 'permanentRestricted',
                        },
                        {
                            address: 'record/8',
                            authID: 'myUser',
                            data: {},
                            space: 'permanentRestricted',
                        },
                    ],
                },
            });
        });

        it('should return a 401 status if trying to load restricted space records without a token', async () => {
            const result = await manager.getRecords({
                issuer: 'myUser',
                address: 'record/5',
                space: 'permanentRestricted',
            });

            expect(result).toEqual({
                status: 401,
                message:
                    'An auth token must be provided when requesting records from a restricted space.',
            });
        });

        it('should return a 403 status if the given token is bad', async () => {
            const result = await manager.getRecords({
                issuer: 'myUser',
                address: 'record/5',
                token: formatAuthToken('badToken', 'myService'),
                space: 'permanentRestricted',
            });

            expect(result).toEqual({
                status: 403,
                message: 'Invalid token.',
            });
        });

        it('should return a 403 status if the given token is incorrectly formatted', async () => {
            const result = await manager.getRecords({
                issuer: 'myUser',
                address: 'record/5',
                token: 'badToken',
                space: 'permanentRestricted',
            });

            expect(result).toEqual({
                status: 403,
                message: 'Invalid token.',
            });
        });
    });

    describe('deleteRecord()', () => {
        beforeEach(async () => {
            for (let i = 1; i <= 4; i++) {
                await store.savePermanentRecord({
                    issuer: 'myUser',
                    address: 'record/' + i,
                    authorizedUsers: [formatAuthToken('myUser', 'myService')],
                    creationDate: 0,
                    record: {},
                    visibility: 'global',
                });
                await store.savePermanentRecord({
                    issuer: 'myUser',
                    address: 'record/' + (i + 4),
                    authorizedUsers: [formatAuthToken('myUser', 'myService')],
                    creationDate: 0,
                    record: {},
                    visibility: 'restricted',
                });
            }

            for (let i = 1; i <= 4; i++) {
                await store.saveTemporaryRecord({
                    issuer: 'myUser',
                    address: 'record/' + i,
                    authorizedUsers: [formatAuthToken('myUser', 'myService')],
                    creationDate: 0,
                    record: {},
                    visibility: 'global',
                });
                await store.saveTemporaryRecord({
                    issuer: 'myUser',
                    address: 'record/' + (i + 4),
                    authorizedUsers: [formatAuthToken('myUser', 'myService')],
                    creationDate: 0,
                    record: {},
                    visibility: 'restricted',
                });
            }

            auth.setTokenIssuer('myToken', 'myUser');
        });

        it('should be able to delete a record based on user ID and address', async () => {
            const result = await manager.deleteRecord({
                token: formatAuthToken('myToken', 'myService'),
                issuer: 'myUser',
                address: 'record/1',
                space: 'permanentGlobal',
            });

            expect(result).toEqual({
                status: 200,
            });
        });

        it('it should not allow deleting records with a token that will expire in more than a day', async () => {
            // 10 miliseconds older than 24 hours.
            auth.setTokenExpireTime(
                'myToken',
                Date.now() + (1000 * 60 * 60 * 24 + 10)
            );

            const result = await manager.deleteRecord({
                token: formatAuthToken('myToken', 'myService'),
                issuer: 'myUser',
                address: 'record/1',
                space: 'permanentGlobal',
            });

            expect(result).toEqual({
                status: 403,
                message: 'Permanent auth tokens cannot delete records.',
            });
        });
    });
});
