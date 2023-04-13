import { MemoryUpdatesStore } from './MemoryUpdatesStore';

describe('MemoryUpdatesStore', () => {
    let subject: MemoryUpdatesStore;

    beforeEach(() => {
        subject = new MemoryUpdatesStore();
    });

    describe('getUpdates()', () => {
        it('should return an empty array by default', async () => {
            expect(await subject.getUpdates('test')).toEqual({
                updates: [],
                timestamps: [],
            });
        });

        it('should return the added updates', async () => {
            await subject.addUpdates('test', ['abc', 'def']);
            expect(await subject.getUpdates('test')).toEqual({
                updates: ['abc', 'def'],
                timestamps: [expect.any(Number), expect.any(Number)],
            });
        });
    });

    describe('clearUpdates()', () => {
        it('should clear the updates for a branch', async () => {
            await subject.addUpdates('test', ['abc', 'def']);
            await subject.clearUpdates('test');
            expect(await subject.getUpdates('test')).toEqual({
                updates: [],
                timestamps: [],
            });
        });
    });
});
