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

            const tempResult = await temp.getBranchByName(
                recordName,
                instName,
                branchName
            );

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
                branchSizeInBytes: 0,
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

            const result = await temp.getBranchByName(
                recordName,
                instName,
                'branch1'
            );
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

            const tempResult = await temp.getBranchByName(
                recordName,
                instName,
                branchName
            );

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
                branchSizeInBytes: 0,
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
                recordName,
                instName,
                branchName
            );
            expect(tempResult).toEqual({
                updates: ['test'],
                timestamps: [expect.any(Number)],
                instSizeInBytes: 4,
                branchSizeInBytes: 4,
            });
        });

        it('should return the updates from the temp store', async () => {
            // const key = temp.getBranchKey(recordName, instName, branchName);
            await temp.addUpdates(
                recordName,
                instName,
                branchName,
                ['test', 'abc'],
                7
            );

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

            const tempResult = await temp.getUpdates(
                recordName,
                instName,
                branchName
            );
            expect(tempResult).toEqual({
                updates: ['test', 'abc'],
                timestamps: [expect.any(Number), expect.any(Number)],
                instSizeInBytes: 7,
                branchSizeInBytes: 7,
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
            // const key = temp.getBranchKey(recordName, instName, branchName);
            await temp.addUpdates(
                recordName,
                instName,
                branchName,
                ['test', 'abc'],
                7
            );
            await temp.addUpdates(recordName, instName, branchName, ['def'], 3);

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

            const tempResult = await temp.getUpdates(
                recordName,
                instName,
                branchName
            );
            expect(tempResult).toEqual({
                updates: ['test', 'abc', 'def'],
                timestamps: [
                    expect.any(Number),
                    expect.any(Number),
                    expect.any(Number),
                ],
                instSizeInBytes: 10,
                branchSizeInBytes: 10,
            });
        });

        it('should merge the updates from the temp store and the permanent store', async () => {
            // const key = temp.getBranchKey(recordName, instName, branchName);
            await perm.addUpdate(recordName, instName, branchName, 'test', 4);
            await perm.addUpdate(recordName, instName, branchName, 'abc', 3);
            await temp.addUpdates(
                recordName,
                instName,
                branchName,
                ['test1', 'test2'],
                10
            );
            await temp.addUpdates(recordName, instName, branchName, ['abc'], 3);

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
                recordName,
                instName,
                branchName
                // temp.getBranchKey(recordName, instName, branchName)
            );
            expect(tempResult).toEqual({
                updates: ['test1', 'test2', 'abc'],
                timestamps: [
                    expect.any(Number),
                    expect.any(Number),
                    expect.any(Number),
                ],
                instSizeInBytes: 13,
                branchSizeInBytes: 13,
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
            await perm.addUpdate(recordName, instName, branchName, 'test', 4);
            await temp.setInstSize(recordName, instName, 10);

            const result = await store.getInstSize(recordName, instName);
            expect(result).toEqual(10);
        });

        it('should return the size from the permanent store if the temp store does not have a size', async () => {
            await perm.addUpdate(recordName, instName, branchName, 'test', 4);

            const result = await store.getInstSize(recordName, instName);
            expect(result).toEqual(4);
        });
    });

    describe('addUpdate()', () => {
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

        it('should add the update to the temp store', async () => {
            const result = await store.addUpdate(
                recordName,
                instName,
                branchName,
                'test',
                4
            );

            expect(result).toEqual({
                success: true,
                instSizeInBytes: 4,
            });

            const updates = await temp.getUpdates(
                recordName,
                instName,
                branchName
            );
            expect(updates).toEqual({
                updates: ['test'],
                timestamps: [expect.any(Number)],
                instSizeInBytes: 4,
                branchSizeInBytes: 4,
            });

            const size = await temp.getInstSize(recordName, instName);
            expect(size).toEqual(4);

            const permResult = await perm.getCurrentUpdates(
                recordName,
                instName,
                branchName
            );
            expect(permResult).toEqual({
                updates: [],
                timestamps: [],
                instSizeInBytes: 0,
            });
        });
    });

    describe('deleteBranch()', () => {
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

            await perm.saveBranch({
                branch: 'otherBranch',
                inst: instName,
                recordName,
                temporary: false,
            });
        });

        it('should remove the branch from the temp store', async () => {
            await temp.addUpdates(recordName, instName, branchName, ['abc'], 3);

            await store.deleteBranch(recordName, instName, branchName);

            const result = await temp.getUpdates(
                recordName,
                instName,
                branchName
            );
            expect(result).toBe(null);

            const size = await store.getInstSize(recordName, instName);
            expect(size).toBe(0);
        });

        it('should remove the branch from the permanent store', async () => {
            await perm.addUpdate(recordName, instName, branchName, 'abc', 3);

            await store.deleteBranch(recordName, instName, branchName);

            const result = await perm.getAllUpdates(
                recordName,
                instName,
                branchName
            );
            expect(result).toBe(null);

            const branch = await perm.getBranchByName(
                recordName,
                instName,
                branchName
            );
            expect(branch).toBe(null);

            const size = await store.getInstSize(recordName, instName);
            expect(size).toBe(0);
        });

        it('should remove only the branch data', async () => {
            await perm.addUpdate(recordName, instName, branchName, 'abc', 3);
            await temp.addUpdates(recordName, instName, branchName, ['abc'], 3);
            await perm.addUpdate(recordName, instName, 'otherBranch', 'def', 3);
            await temp.addUpdates(
                recordName,
                instName,
                'otherBranch',
                ['def'],
                3
            );

            await store.deleteBranch(recordName, instName, branchName);

            const result = await perm.getAllUpdates(
                recordName,
                instName,
                branchName
            );
            expect(result).toBe(null);

            const branch = await perm.getBranchByName(
                recordName,
                instName,
                branchName
            );
            expect(branch).toBe(null);

            const size = await store.getInstSize(recordName, instName);
            expect(size).toBe(3);

            const data = await perm.getAllUpdates(
                recordName,
                instName,
                'otherBranch'
            );
            expect(data).toEqual({
                updates: ['def'],
                timestamps: [expect.any(Number)],
                instSizeInBytes: 3,
            });

            const tempData = await temp.getUpdates(
                recordName,
                instName,
                'otherBranch'
            );
            expect(tempData).toEqual({
                updates: ['def'],
                timestamps: [expect.any(Number)],
                instSizeInBytes: 3,
                branchSizeInBytes: 3,
            });
        });
    });

    describe('replaceCurrentUpdates()', () => {
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

        it('should replace the updates in the temp store with the given update', async () => {
            await temp.addUpdates(
                recordName,
                instName,
                branchName,
                ['abc', 'def'],
                6
            );
            await perm.addUpdate(recordName, instName, branchName, 'abc', 3);
            await perm.addUpdate(recordName, instName, branchName, 'def', 3);

            await store.replaceCurrentUpdates(
                recordName,
                instName,
                branchName,
                'test',
                4
            );

            const result = await perm.getCurrentUpdates(
                recordName,
                instName,
                branchName
            );
            expect(result).toEqual({
                updates: ['test'],
                timestamps: [expect.any(Number)],
                instSizeInBytes: 10,
            });

            const tempResult = await temp.getUpdates(
                recordName,
                instName,
                branchName
            );
            expect(tempResult).toEqual({
                updates: ['test'],
                timestamps: [expect.any(Number)],
                instSizeInBytes: 10,
                branchSizeInBytes: 10,
            });

            const count = await temp.countBranchUpdates(
                recordName,
                instName,
                branchName
            );
            expect(count).toBe(1);

            const allUpdates = await perm.getAllUpdates(
                recordName,
                instName,
                branchName
            );
            expect(allUpdates).toEqual({
                updates: ['abc', 'def', 'test'],
                timestamps: [
                    expect.any(Number),
                    expect.any(Number),
                    expect.any(Number),
                ],
                instSizeInBytes: 10,
            });
        });
    });
});
