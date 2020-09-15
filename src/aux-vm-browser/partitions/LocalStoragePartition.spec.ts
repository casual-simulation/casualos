import { testPartitionImplementation } from '@casual-simulation/aux-common/partitions/test/PartitionTests';
import { LocalStoragePartitionImpl } from './LocalStoragePartition';
import { Bot, botAdded, createBot } from '@casual-simulation/aux-common';

describe('LocalStoragePartition', () => {
    beforeAll(() => {
        polyfillEventListenerFunctions();
    });

    beforeEach(() => {
        mockLocalStorage();
    });

    afterEach(() => {
        resetLocalStorage();
    });

    testPartitionImplementation(async () => {
        return new LocalStoragePartitionImpl({
            type: 'local_storage',
            namespace: 'namespace',
        });
    });

    describe('connect', () => {
        it('should send an onBotsAdded event for all the bots in the partition on init', async () => {
            const mem = new LocalStoragePartitionImpl({
                type: 'local_storage',
                namespace: 'namespace',
            });

            await mem.applyEvents([
                botAdded(createBot('test')),
                botAdded(createBot('test2')),
            ]);

            let added: Bot[] = [];
            mem.onBotsAdded.subscribe((e) => added.push(...e));

            expect(added).toEqual([createBot('test'), createBot('test2')]);
        });

        it('should return immediate for the editStrategy', () => {
            const mem = new LocalStoragePartitionImpl({
                type: 'local_storage',
                namespace: 'namespace',
            });

            expect(mem.realtimeStrategy).toEqual('immediate');
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

function polyfillEventListenerFunctions() {
    if (typeof globalThis.addEventListener === 'undefined') {
        globalThis.addEventListener = () => {};
    }

    if (typeof globalThis.removeEventListener === 'undefined') {
        globalThis.removeEventListener = () => {};
    }
}
