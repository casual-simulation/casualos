import {
    InventoryContextFlat,
    DEFAULT_INVENTORY_SLOTFLAT_COUNT,
    InventoryItem,
} from './InventoryContextFlat';
import {
    File,
    createFile,
    createCalculationContext,
    AuxObject,
    updateFile,
} from '@casual-simulation/aux-common';

describe('InventoryContextFlat', () => {
    it('should construct for specific context', () => {
        const inventory = new InventoryContextFlat(
            null,
            'my_super_cool_context'
        );
        expect(inventory.context).toEqual('my_super_cool_context');
    });

    it('should not allow invalid context name', () => {
        function createWith(context: any) {
            let inventory = new InventoryContextFlat(null, context);
        }

        expect(() => {
            createWith(null);
        }).toThrow();
        expect(() => {
            createWith(undefined);
        }).toThrow();
    });

    it('should contain default number of slots if none are specified', () => {
        let inventory = new InventoryContextFlat(null, 'my_inventory');
        expect(inventory.getSlotsCount()).toBe(
            DEFAULT_INVENTORY_SLOTFLAT_COUNT
        );

        let inventory2 = new InventoryContextFlat(null, 'my_inventory_2', null);
        expect(inventory2.getSlotsCount()).toBe(
            DEFAULT_INVENTORY_SLOTFLAT_COUNT
        );
    });

    it('should contain specified number of slots', () => {
        let inventory = new InventoryContextFlat(null, 'my_inventory', 8);
        expect(inventory.getSlotsCount()).toBe(8);
    });

    it('should allow adjustment of slot count after construction', () => {
        let inventory = new InventoryContextFlat(null, 'my_inventory', 5);
        inventory.setSlotsCount(11);
        expect(inventory.getSlotsCount()).toBe(11);
    });

    it('should add and remove files that are part of the context', () => {
        let context = 'my_inventory';
        let inventory = new InventoryContextFlat(null, context);
        let files: File[] = [];

        // Add some files that are assigned to the context.
        for (let i = 0; i < 10; i++) {
            let file = createFile(`testId_${i}`);
            file.tags[context] = true;
            files.push(file);
        }

        const calc = createCalculationContext(files);

        for (let i = 0; i < files.length; i++) {
            inventory.fileAdded(<AuxObject>files[i], calc);
        }

        // Make sure all files got added.
        expect(inventory.files).toHaveLength(10);

        // Remove files 6,7,8.
        inventory.fileRemoved('testId_6', calc);
        inventory.fileRemoved('testId_7', calc);
        inventory.fileRemoved('testId_8', calc);

        expect(inventory.files).toHaveLength(7);
    });

    it('should ignore files that are not part of the context.', () => {
        let context = 'my_inventory';
        let inventory = new InventoryContextFlat(null, context);
        let files: File[] = [];

        // Create files that are part of the context.
        for (let i = 0; i < 6; i++) {
            let file = createFile(`testId_${i}`);
            file.tags[context] = true;
            files.push(file);
        }

        // Create files that are not part of the context.
        for (let i = 6; i < 10; i++) {
            let file = createFile(`testId_${i}`);
            file.tags['some_other_context'] = true;
            files.push(file);
        }

        const calc = createCalculationContext(files);

        for (let i = 0; i < files.length; i++) {
            inventory.fileAdded(<AuxObject>files[i], calc);
        }

        expect(inventory.files).toHaveLength(6);

        // Try removing file that is not part of the context.
        inventory.fileRemoved('some_other_file', calc);
        expect(inventory.files).toHaveLength(6);
    });

    describe('flat slots', () => {
        it('should sort files into flat slots based on x position in context', () => {
            let context = 'my_inventory';
            let slotCount = 3;
            let inventory = new InventoryContextFlat(null, context, slotCount);
            let files: File[] = [
                createFile('testId_4', {
                    [context]: true,
                    [`${context}.x`]: 0,
                }),
                createFile('testId_3', {
                    [context]: true,
                    [`${context}.x`]: 1,
                }),
                createFile('testId_2', {
                    [context]: true,
                    [`${context}.x`]: 2,
                }),
                createFile('testId_1', {
                    [context]: true,
                    [`${context}.x`]: 3,
                }),
                createFile('testId_0', {
                    [context]: true,
                    [`${context}.x`]: 4,
                }),
            ];
            const calc = createCalculationContext(files);

            for (let i = 0; i < files.length; i++) {
                inventory.fileAdded(<AuxObject>files[i], calc);
            }

            // Should be empty.
            expect(inventory.slots).toEqual([]);

            inventory.frameUpdate(calc);

            // Should not be empty.
            expect(inventory.slots).not.toEqual([]);
            // Should have length of 3.
            expect(inventory.slots).toHaveLength(3);

            // Should be sorted like this: testId_4, testId_3, testId_2
            expect(inventory.slots[0].file.id).toEqual('testId_4');
            expect(inventory.slots[1].file.id).toEqual('testId_3');
            expect(inventory.slots[2].file.id).toEqual('testId_2');
            expect(inventory.slots[3]).toBeUndefined();
        });

        it('should not sort files into flat slots that have context y position greater or less than 0', () => {
            let context = 'my_inventory';
            let slotCount = 5;
            let inventory = new InventoryContextFlat(null, context, slotCount);
            let files: File[] = [
                createFile('testId_4', {
                    [context]: true,
                    [`${context}.x`]: 0,
                    [`${context}.y`]: 0,
                }),
                createFile('testId_3', {
                    [context]: true,
                    [`${context}.x`]: 1,
                    [`${context}.y`]: -1,
                }),
                createFile('testId_2', {
                    [context]: true,
                    [`${context}.x`]: 2,
                    [`${context}.y`]: 100,
                }),
                createFile('testId_1', {
                    [context]: true,
                    [`${context}.x`]: 3,
                    [`${context}.y`]: 2,
                }),
                createFile('testId_0', {
                    [context]: true,
                    [`${context}.x`]: 4,
                    [`${context}.y`]: 0,
                }),
            ];
            const calc = createCalculationContext(files);

            for (let i = 0; i < files.length; i++) {
                inventory.fileAdded(<AuxObject>files[i], calc);
            }

            // Should be empty.
            expect(inventory.slots).toEqual([]);

            inventory.frameUpdate(calc);

            // Should not be empty.
            expect(inventory.slots).not.toEqual([]);
            // Should have length of 5.
            expect(inventory.slots).toHaveLength(5);

            // Should be sorted like this: testId_4, undefined, undefined, undefined, testId_0
            expect(inventory.slots[0].file.id).toEqual('testId_4');
            expect(inventory.slots[1]).toBeUndefined();
            expect(inventory.slots[2]).toBeUndefined();
            expect(inventory.slots[3]).toBeUndefined();
            expect(inventory.slots[4].file.id).toEqual('testId_0');
        });

        it('should not sort files into flat slots that have context index greater than 0', () => {
            let context = 'my_inventory';
            let slotCount = 5;
            let inventory = new InventoryContextFlat(null, context, slotCount);
            let files: File[] = [
                createFile('testId_4', {
                    [context]: true,
                    [`${context}.x`]: 0,
                    [`${context}.y`]: 0,
                    [`${context}.index`]: 1,
                }),
                createFile('testId_3', {
                    [context]: true,
                    [`${context}.x`]: 1,
                    [`${context}.y`]: 0,
                    [`${context}.index`]: 0,
                }),
                createFile('testId_2', {
                    [context]: true,
                    [`${context}.x`]: 2,
                    [`${context}.y`]: 0,
                    [`${context}.index`]: -1,
                }),
                createFile('testId_1', {
                    [context]: true,
                    [`${context}.x`]: 3,
                    [`${context}.y`]: 0,
                    [`${context}.index`]: 0,
                }),
                createFile('testId_0', {
                    [context]: true,
                    [`${context}.x`]: 4,
                    [`${context}.y`]: 0,
                    [`${context}.index`]: 0,
                }),
            ];
            const calc = createCalculationContext(files);

            for (let i = 0; i < files.length; i++) {
                inventory.fileAdded(<AuxObject>files[i], calc);
            }

            // Should be empty.
            expect(inventory.slots).toEqual([]);

            inventory.frameUpdate(calc);

            // Should not be empty.
            expect(inventory.slots).not.toEqual([]);
            // Should have length of 5.
            expect(inventory.slots).toHaveLength(5);

            // Should be sorted like this: undefined, testId_3, undefined, testId_1, testId_0
            expect(inventory.slots[0]).toBeUndefined();
            expect(inventory.slots[1].file.id).toEqual('testId_3');
            expect(inventory.slots[2]).toBeUndefined();
            expect(inventory.slots[3].file.id).toEqual('testId_1');
            expect(inventory.slots[4].file.id).toEqual('testId_0');
        });

        it('should update flat slots as expected after file is added and then moved to another slot.', () => {
            let context = 'my_inventory';
            let slotCount = 5;
            let inventory = new InventoryContextFlat(null, context, slotCount);
            let files: File[] = [
                createFile('testId_0', {
                    [context]: true,
                    [`${context}.x`]: 0,
                }),
                createFile('testId_1', {
                    [context]: true,
                    [`${context}.x`]: 1,
                }),
            ];

            let calc = createCalculationContext(files);

            for (let i = 0; i < files.length; i++) {
                inventory.fileAdded(<AuxObject>files[i], calc);
            }

            // Expected files in context.
            expect(inventory.files).toHaveLength(2);
            expect(inventory.files[0].id).toEqual('testId_0');
            expect(inventory.files[1].id).toEqual('testId_1');

            inventory.frameUpdate(calc);

            // Slots should be be in initial state.
            expect(inventory.slots[0].file.id).toEqual('testId_0');
            expect(inventory.slots[1].file.id).toEqual('testId_1');
            expect(inventory.slots[2]).toBeUndefined();
            expect(inventory.slots[3]).toBeUndefined();
            expect(inventory.slots[4]).toBeUndefined();

            // Now lets move testId_1 to the fourth slot.
            let file = files[1];
            file.tags[`${context}.x`] = 3;

            calc = createCalculationContext(files);
            inventory.fileUpdated(<AuxObject>file, null, calc);
            inventory.frameUpdate(calc);

            // Files should still be in original state.
            expect(inventory.files).toHaveLength(2);
            expect(inventory.files[0].id).toEqual('testId_0');
            expect(inventory.files[1].id).toEqual('testId_1');

            // Slots should have updated accordingly.
            expect(inventory.slots[0].file.id).toEqual('testId_0');
            expect(inventory.slots[1]).toBeUndefined();
            expect(inventory.slots[2]).toBeUndefined();
            expect(inventory.slots[3].file.id).toEqual('testId_1');
            expect(inventory.slots[4]).toBeUndefined();
        });
    });

    // describe('grid slots', () => {
    //     it('should sort files into grid slots if the context position fits inside the slot grid dimensions', () => {
    //         let context = 'my_inventory';
    //         let gridSlotWidth = 5;
    //         let gridSlotHeight = 2;
    //         let inventory = new InventoryContextFlat(
    //             context,
    //             null
    //         );

    //         // Make files for every tile inside the slots grid.
    //         let files: File[] = [];
    //         let index: number = 0;
    //         for (let x = 0; x < gridSlotWidth; x++) {
    //             for (let y = 0; y < gridSlotHeight; y++) {
    //                 let file = createFile(`testId_${index}`, {
    //                     [context]: true,
    //                     [`${context}.x`]: x,
    //                     [`${context}.y`]: y,
    //                 });

    //                 files.push(file);
    //                 index++;
    //             }
    //         }

    //         // Should have one file for each grid tile.
    //         expect(files).toHaveLength(gridSlotWidth * gridSlotHeight);

    //         const calc = createCalculationContext(files);
    //         for (let i = 0; i < files.length; i++) {
    //             inventory.fileAdded(<AuxObject>files[i], calc);
    //         }

    //         // Should be empty.
    //         expect(inventory.gridSlots).toEqual([]);

    //         inventory.frameUpdate(calc);

    //         // Should not be empty.
    //         expect(inventory.gridSlots).not.toEqual([]);
    //         // Should have length of files.
    //         expect(inventory.gridSlots).toHaveLength(
    //             gridSlotWidth * gridSlotHeight
    //         );
    //     });

    //     it('should not sort files into grid slots if the context position is outside the slot grid dimensions', () => {
    //         let context = 'my_inventory';
    //         let gridSlotWidth = 5;
    //         let gridSlotHeight = 2;
    //         let inventory = new InventoryContextFlat(
    //             context,
    //             null
    //         );

    //         // Make files to add inside the inventory context.
    //         let files: File[] = [
    //             createFile(`testId_0`, {
    //                 [context]: true,
    //                 [`${context}.x`]: 0,
    //                 [`${context}.y`]: 0,
    //             }),
    //             createFile(`testId_1`, {
    //                 [context]: true,
    //                 [`${context}.x`]: 4,
    //                 [`${context}.y`]: 1,
    //             }),
    //             createFile(`testId_2`, {
    //                 [context]: true,
    //                 [`${context}.x`]: 5,
    //                 [`${context}.y`]: 3,
    //             }),
    //         ];

    //         const calc = createCalculationContext(files);
    //         for (let i = 0; i < files.length; i++) {
    //             inventory.fileAdded(<AuxObject>files[i], calc);
    //         }
    //         inventory.frameUpdate(calc);

    //         // All three files should be in the context.
    //         expect(inventory.files).toHaveLength(3);
    //         expect(inventory.files[0]).toEqual(files[0]);
    //         expect(inventory.files[1]).toEqual(files[1]);
    //         expect(inventory.files[2]).toEqual(files[2]);

    //         // File 0 and 1 should be in the grid slots, but file 2 should not be.
    //         expect(inventory.gridSlots).toHaveLength(2);

    //         let found: boolean;
    //         found = inventory.gridSlots.some(
    //             item => <File>item.file === files[0]
    //         );
    //         expect(found).toBe(true);

    //         found = inventory.gridSlots.some(
    //             item => <File>item.file === files[1]
    //         );
    //         expect(found).toBe(true);

    //         found = inventory.gridSlots.some(
    //             item => <File>item.file === files[2]
    //         );
    //         expect(found).toBe(false);
    //     });

    //     it('should update grid slots as expected after the removal of a file from the context', () => {
    //         let context = 'my_inventory';
    //         let gridSlotWidth = 5;
    //         let gridSlotHeight = 2;
    //         let inventory = new InventoryContextFlat(
    //             context,
    //             null
    //         );

    //         // Make files to add inside the inventory context.
    //         let files: File[] = [
    //             createFile(`testId_0`, {
    //                 [context]: true,
    //                 [`${context}.x`]: 0,
    //                 [`${context}.y`]: 0,
    //             }),
    //             createFile(`testId_1`, {
    //                 [context]: true,
    //                 [`${context}.x`]: 1,
    //                 [`${context}.y`]: 0,
    //             }),
    //             createFile(`testId_2`, {
    //                 [context]: true,
    //                 [`${context}.x`]: 2,
    //                 [`${context}.y`]: 0,
    //             }),
    //         ];

    //         const calc = createCalculationContext(files);
    //         for (let i = 0; i < files.length; i++) {
    //             inventory.fileAdded(<AuxObject>files[i], calc);
    //         }
    //         inventory.frameUpdate(calc);

    //         // All three files should be in the context.
    //         expect(inventory.files).toHaveLength(3);
    //         expect(inventory.files[0]).toEqual(files[0]);
    //         expect(inventory.files[1]).toEqual(files[1]);
    //         expect(inventory.files[2]).toEqual(files[2]);

    //         // All three files should be in the grid slots.
    //         expect(inventory.gridSlots).toHaveLength(3);

    //         let allFound = inventory.gridSlots.every(
    //             item =>
    //                 item.file === files[0] ||
    //                 item.file === files[1] ||
    //                 item.file === files[2]
    //         );
    //         expect(allFound).toBe(true);

    //         // Now lets remove the second file from the context.
    //         inventory.fileRemoved(files[1].id, calc);
    //         inventory.frameUpdate(calc);

    //         // Only two files should be in the context.
    //         expect(inventory.files).toHaveLength(2);
    //         expect(inventory.files[0]).toEqual(files[0]);
    //         expect(inventory.files[1]).toEqual(files[2]);

    //         // Only two files should be in the grid slots.
    //         expect(inventory.gridSlots).toHaveLength(2);
    //         allFound = inventory.gridSlots.every(
    //             item => item.file === files[0] || item.file === files[2]
    //         );
    //         expect(allFound).toBe(true);
    //     });
    // });
});
