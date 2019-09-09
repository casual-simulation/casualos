import { DirectoryService } from './DirectoryService';
import { DirectoryStore } from './DirectoryStore';
import { MemoryDirectoryStore } from './MemoryDirectoryStore';
import { DirectoryEntry } from './DirectoryEntry';

const dateNowMock = (Date.now = jest.fn());

describe('DirectoryService', () => {
    let service: DirectoryService;
    let store: DirectoryStore;

    beforeEach(() => {
        store = new MemoryDirectoryStore();
        service = new DirectoryService(store);
    });

    describe('update()', () => {
        it('should add the entry to the store', async () => {
            dateNowMock.mockReturnValue(123);

            const entry: DirectoryEntry = {
                hash: 'abc',
                ipAddress: '192.168.1.1',
                publicName: 'Test',
                lastUpdateTime: Date.now(),
            };

            await service.update(entry);

            const stored = await store.findByHash('abc');
            expect(stored).toEqual(entry);
        });

        it('should update the last update time', async () => {
            const entry: DirectoryEntry = {
                hash: 'abc',
                ipAddress: '192.168.1.1',
                publicName: 'Test',
                lastUpdateTime: 123,
            };

            dateNowMock.mockReturnValue(999);
            await service.update(entry);

            const stored = await store.findByHash('abc');
            expect(stored.lastUpdateTime).toBe(999);
        });
    });

    describe('findByIpAddress()', () => {
        beforeEach(async () => {
            await store.update({
                hash: 'abc 1',
                ipAddress: '192.168.1.1',
                lastUpdateTime: 123,
                publicName: 'Z Test',
            });
            await store.update({
                hash: 'abc 2',
                ipAddress: '192.168.1.2',
                lastUpdateTime: 123,
                publicName: 'Test 2',
            });
            await store.update({
                hash: 'abc 3',
                ipAddress: '10.0.0.1',
                lastUpdateTime: 123,
                publicName: 'Test 3',
            });
            await store.update({
                hash: 'abc 4',
                ipAddress: '192.168.1.1',
                lastUpdateTime: 123,
                publicName: 'Test 4',
            });
        });

        it('should return all the entries that match the given IP Address ordered by name', async () => {
            const entries = await service.findByIpAddress('192.168.1.1');

            expect(entries).toEqual([
                {
                    hash: 'abc 4',
                    ipAddress: '192.168.1.1',
                    lastUpdateTime: 123,
                    publicName: 'Test 4',
                },
                {
                    hash: 'abc 1',
                    ipAddress: '192.168.1.1',
                    lastUpdateTime: 123,
                    publicName: 'Z Test',
                },
            ]);
        });
    });

    describe('isInternal()', () => {
        const cases = [
            [
                true,
                'IP address matches the entry IP',
                '192.168.1.1',
                '192.168.1.1',
            ],
            [
                false,
                'IP address does not match the entry IP',
                '192.168.1.1',
                '192.168.1.2',
            ],
        ];

        it.each(cases)(
            'should return %s if the given %s',
            (expected, desc, entryIp, givenIp) => {
                const result = service.isInternal(
                    {
                        hash: 'abc',
                        publicName: 'Test',
                        lastUpdateTime: 456,
                        ipAddress: entryIp,
                    },
                    givenIp
                );

                expect(result).toBe(expected);
            }
        );
    });
});
