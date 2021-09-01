import { formatAuthToken } from '../../../../aux-common';
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
    });
});
