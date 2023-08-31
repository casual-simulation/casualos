import { MemoryInstRecordsStore } from './MemoryInstRecordsStore';
import { SplitInstRecordsStore } from './SplitInstRecordsStore';
import { TemporaryInstRecordsStore } from './TemporaryInstRecordsStore';
import { MemoryTempInstRecordsStore } from './MemoryTempInstRecordsStore';
import { PUBLIC_READ_MARKER } from '../PolicyPermissions';

describe('SplitInstRecordsStore', () => {
    let store: SplitInstRecordsStore;
    let temp: TemporaryInstRecordsStore;
    let perm: MemoryInstRecordsStore;

    const recordName = 'recordName';
    const instName = 'instName';
    const branchName = 'branchName';

    beforeEach(() => {
        perm = new MemoryInstRecordsStore();
        temp = new MemoryTempInstRecordsStore();
        store = new SplitInstRecordsStore(temp, perm);
    });

    describe('getBranchByName()', () => {
        it('should return the branch from the permanent store if it exists', async () => {
            await perm.saveInst({
                recordName,
                inst: instName,
                markers: [PUBLIC_READ_MARKER],
            });
            await perm.saveBranch({
                recordName,
                inst: instName,
                branch: branchName,
                temporary: false,
            });

            const result = await store.getBranchByName(
                recordName,
                instName,
                branchName
            );

            expect(result).toEqual({
                recordName,
                inst: instName,
                branch: branchName,
                temporary: false,
                linkedInst: {
                    recordName,
                    inst: instName,
                    markers: [PUBLIC_READ_MARKER],
                },
            });

            const key = temp.getBranchKey(recordName, instName, branchName);
            const tempResult = await temp.getBranchByName(key);

            expect(tempResult).toEqual({
                recordName,
                inst: instName,
                branch: branchName,
                temporary: false,
                linkedInst: {
                    recordName,
                    inst: instName,
                    markers: [PUBLIC_READ_MARKER],
                },
            });
        });

        it('should return the branch info from the temp store if it exists', async () => {
            await temp.saveBranchInfo({
                recordName,
                inst: instName,
                branch: branchName,
                linkedInst: {
                    recordName,
                    inst: instName,
                    markers: [PUBLIC_READ_MARKER],
                },
                temporary: false,
            });

            const result = await store.getBranchByName(
                recordName,
                instName,
                branchName
            );

            expect(result).toEqual({
                recordName,
                inst: instName,
                branch: branchName,
                temporary: false,
                linkedInst: {
                    recordName,
                    inst: instName,
                    markers: [PUBLIC_READ_MARKER],
                },
            });
        });

        it('should return null if the branch does not exist', async () => {
            const result = await store.getBranchByName(
                recordName,
                instName,
                branchName
            );
            expect(result).toBeNull();
        });
    });

    describe('saveInst()', () => {
        it('should create the inst in the permanent store', async () => {
            await store.saveInst({
                recordName,
                inst: instName,
                markers: ['test'],
            });

            const result = await perm.getInstByName(recordName, instName);
            expect(result).toEqual({
                recordName,
                inst: instName,
                markers: ['test'],
            });
        });

        it('should update the inst in the permanent store', async () => {
            await perm.saveInst({
                recordName,
                inst: instName,
                markers: ['wrong'],
            });

            await store.saveInst({
                recordName,
                inst: instName,
                markers: ['test'],
            });

            const result = await perm.getInstByName(recordName, instName);
            expect(result).toEqual({
                recordName,
                inst: instName,
                markers: ['test'],
            });
        });

        it('should delete all the branches for the inst in the temp store', async () => {
            await temp.saveBranchInfo({
                recordName,
                inst: instName,
                branch: 'branch1',
                linkedInst: {
                    recordName,
                    inst: instName,
                    markers: ['wrong'],
                },
                temporary: false,
            });

            await perm.saveInst({
                recordName,
                inst: instName,
                markers: ['wrong'],
            });

            await perm.saveBranch({
                recordName,
                inst: instName,
                branch: 'branch1',
                temporary: false,
            });

            await store.saveInst({
                recordName,
                inst: instName,
                markers: [PUBLIC_READ_MARKER],
            });

            const key = temp.getBranchKey(recordName, instName, 'branch1');
            const result = await temp.getBranchByName(key);
            expect(result).toBeNull();
        });

        it('should return the correct inst info with the branch after updating the inst', async () => {
            await temp.saveBranchInfo({
                recordName,
                inst: instName,
                branch: 'branch1',
                linkedInst: {
                    recordName,
                    inst: instName,
                    markers: ['wrong'],
                },
                temporary: false,
            });

            await perm.saveInst({
                recordName,
                inst: instName,
                markers: ['wrong'],
            });

            await perm.saveBranch({
                recordName,
                inst: instName,
                branch: 'branch1',
                temporary: false,
            });

            await store.saveInst({
                recordName,
                inst: instName,
                markers: [PUBLIC_READ_MARKER],
            });

            const result = await store.getBranchByName(
                recordName,
                instName,
                'branch1'
            );
            expect(result).toEqual({
                recordName,
                inst: instName,
                branch: 'branch1',
                temporary: false,
                linkedInst: {
                    recordName,
                    inst: instName,
                    markers: [PUBLIC_READ_MARKER],
                },
            });
        });
    });

    describe('saveBranch()', () => {
        it('should save the branch to the permanent and temp store', async () => {
            await perm.saveInst({
                recordName,
                inst: instName,
                markers: ['test'],
            });
            await store.saveBranch({
                recordName,
                inst: instName,
                branch: branchName,
                temporary: false,
            });

            const result = await perm.getBranchByName(
                recordName,
                instName,
                branchName
            );
            expect(result).toEqual({
                recordName,
                inst: instName,
                branch: branchName,
                temporary: false,
                linkedInst: {
                    recordName,
                    inst: instName,
                    markers: ['test'],
                },
            });

            const branchKey = temp.getBranchKey(
                recordName,
                instName,
                branchName
            );
            const tempResult = await temp.getBranchByName(branchKey);

            expect(tempResult).toEqual({
                recordName,
                inst: instName,
                branch: branchName,
                temporary: false,
                linkedInst: {
                    recordName,
                    inst: instName,
                    markers: ['test'],
                },
            });
        });
    });

    describe('getInstByName()', () => {
        it('should return null if the inst does not exist', async () => {
            const result = await store.getInstByName(recordName, instName);
            expect(result).toBeNull();
        });

        it('should return the inst', async () => {
            perm.saveInst({
                recordName,
                inst: instName,
                markers: [PUBLIC_READ_MARKER],
            });

            const result = await store.getInstByName(recordName, instName);
            expect(result).toEqual({
                recordName,
                inst: instName,
                markers: [PUBLIC_READ_MARKER],
            });
        });
    });

    describe('getCurrentUpdates()', () => {
        beforeEach(async () => {
            await perm.saveInst({
                recordName,
                inst: instName,
                markers: [PUBLIC_READ_MARKER],
            });

            await perm.saveBranch({
                branch: branchName,
                inst: instName,
                recordName,
                temporary: false,
            });
        });

        it('should return the most recent update from the permanent store when there are no updates in the temp store', async () => {
            await perm.addUpdate(recordName, instName, branchName, 'test', 4);

            const result = await store.getCurrentUpdates(
                recordName,
                instName,
                branchName
            );

            expect(result).toEqual({
                updates: ['test'],
                timestamps: [expect.any(Number)],
                instSizeInBytes: 4,
            });

            const tempResult = await temp.getUpdates(
                temp.getBranchKey(recordName, instName, branchName)
            );
            expect(tempResult).toEqual({
                updates: ['test'],
                timestamps: [expect.any(Number)],
                instSizeInBytes: 4,
            });
        });

        it('should return the updates from the temp store', async () => {
            const key = temp.getBranchKey(recordName, instName, branchName);
            await temp.addUpdates(key, ['test', 'abc'], 7);

            const result = await store.getCurrentUpdates(
                recordName,
                instName,
                branchName
            );

            expect(result).toEqual({
                updates: ['test', 'abc'],
                timestamps: [expect.any(Number), expect.any(Number)],
                instSizeInBytes: 7,
            });

            const tempResult = await temp.getUpdates(key);
            expect(tempResult).toEqual({
                updates: ['test', 'abc'],
                timestamps: [expect.any(Number), expect.any(Number)],
                instSizeInBytes: 7,
            });
        });
    });

    describe('getAllUpdates()', () => {
        beforeEach(async () => {
            await perm.saveInst({
                recordName,
                inst: instName,
                markers: [PUBLIC_READ_MARKER],
            });

            await perm.saveBranch({
                branch: branchName,
                inst: instName,
                recordName,
                temporary: false,
            });
        });

        it('should return the updates from the temp store', async () => {
            const key = temp.getBranchKey(recordName, instName, branchName);
            await temp.addUpdates(key, ['test', 'abc'], 7);
            await temp.addUpdates(key, ['def'], 3);

            const result = await store.getAllUpdates(
                recordName,
                instName,
                branchName
            );

            expect(result).toEqual({
                updates: ['test', 'abc', 'def'],
                timestamps: [
                    expect.any(Number),
                    expect.any(Number),
                    expect.any(Number),
                ],
            });

            const tempResult = await temp.getUpdates(key);
            expect(tempResult).toEqual({
                updates: ['test', 'abc', 'def'],
                timestamps: [
                    expect.any(Number),
                    expect.any(Number),
                    expect.any(Number),
                ],
                instSizeInBytes: 10,
            });
        });

        it('should merge the updates from the temp store and the permanent store', async () => {
            const key = temp.getBranchKey(recordName, instName, branchName);
            await perm.addUpdate(recordName, instName, branchName, 'test', 4);
            await perm.addUpdate(recordName, instName, branchName, 'abc', 3);
            await temp.addUpdates(key, ['test1', 'test2'], 10);
            await temp.addUpdates(key, ['abc'], 3);

            const result = await store.getAllUpdates(
                recordName,
                instName,
                branchName
            );

            expect(result).toEqual({
                updates: ['test', 'abc', 'test1', 'test2'],
                timestamps: [
                    expect.any(Number),
                    expect.any(Number),
                    expect.any(Number),
                    expect.any(Number),
                ],
            });

            const tempResult = await temp.getUpdates(
                temp.getBranchKey(recordName, instName, branchName)
            );
            expect(tempResult).toEqual({
                updates: ['test1', 'test2', 'abc'],
                timestamps: [
                    expect.any(Number),
                    expect.any(Number),
                    expect.any(Number),
                ],
                instSizeInBytes: 13,
            });
        });
    });

    describe('getInstSize()', () => {
        beforeEach(async () => {
            await perm.saveInst({
                recordName,
                inst: instName,
                markers: [PUBLIC_READ_MARKER],
            });

            await perm.saveBranch({
                branch: branchName,
                inst: instName,
                recordName,
                temporary: false,
            });
        });

        it('should return the size from the temp store first', async () => {
            const key = temp.getBranchKey(recordName, instName, branchName);
            await perm.addUpdate(recordName, instName, branchName, 'test', 4);
            await temp.setUpdatesSize(key, 10);

            const result = await store.getInstSize(recordName, instName);

            expect(result).toEqual(10);
        });

        it('should return the size from the permanent store if the temp store does not have a size', async () => {
            await perm.addUpdate(recordName, instName, branchName, 'test', 4);

            const result = await store.getInstSize(recordName, instName);

            expect(result).toEqual(4);
        });
    });
});
