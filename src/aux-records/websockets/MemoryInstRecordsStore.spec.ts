import { PUBLIC_READ_MARKER } from '../PolicyPermissions';
import { MemoryInstRecordsStore } from './MemoryInstRecordsStore';

describe('MemoryInstRecordsStore', () => {
    let subject: MemoryInstRecordsStore;

    beforeEach(() => {
        subject = new MemoryInstRecordsStore();
    });

    describe('getAllUpdates()', () => {
        it('should return an null by default', async () => {
            expect(
                await subject.getAllUpdates('recordName', 'inst', 'test')
            ).toEqual(null);
        });

        it('should return the added updates', async () => {
            await subject.saveInst({
                recordName: 'recordName',
                inst: 'inst',
                markers: [PUBLIC_READ_MARKER],
            });
            await subject.addUpdates('recordName', 'inst', 'test', ['def'], 3);
            expect(
                await subject.getAllUpdates('recordName', 'inst', 'test')
            ).toEqual({
                updates: ['def'],
                timestamps: [expect.any(Number)],
                instSizeInBytes: 3,
            });
        });
    });

    describe('clearUpdates()', () => {
        it('should clear the updates for a branch', async () => {
            await subject.saveInst({
                recordName: 'recordName',
                inst: 'inst',
                markers: [PUBLIC_READ_MARKER],
            });
            await subject.addUpdates('recordName', 'inst', 'test', ['abc'], 3);
            await subject.deleteBranch('recordName', 'inst', 'test');
            expect(
                await subject.getAllUpdates('recordName', 'inst', 'test')
            ).toEqual(null);
        });
    });
});
