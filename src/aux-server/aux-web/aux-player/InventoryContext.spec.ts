import { InventoryContext, DEFAULT_INVENTORY_COUNT } from "./InventoryContext";
import { File, createFile, createCalculationContext, AuxObject } from "@yeti-cgi/aux-common";

describe('InventoryContext', () => {
    it('should construct for specific context', () => {
        const inventory = new InventoryContext('my_super_cool_context');
        expect(inventory.context).toEqual('my_super_cool_context');
    });

    it('should not allow invalid context name', () => {

        function createWith(context: any) {
            let inventory = new InventoryContext(context);
        };

        expect( () => {createWith(null)} ).toThrow();
        expect( () => {createWith(undefined)} ).toThrow();
    });

    it('should contain default number of slots if none are specified', () => {
        let inventory = new InventoryContext('my_inventory');
        expect(inventory.getSlotCount()).toBe(DEFAULT_INVENTORY_COUNT);

        let inventory2 = new InventoryContext('my_inventory_2', null);
        expect(inventory2.getSlotCount()).toBe(DEFAULT_INVENTORY_COUNT);
    });

    it('should contain specified number of slots', () => {
        let inventory = new InventoryContext('my_inventory', 8);
        expect(inventory.getSlotCount()).toBe(8);
    });

    it('should allow adjustment of slot count after construction', () => {
        let inventory = new InventoryContext('my_inventory', 5);
        inventory.setSlotCount(11);

        expect(inventory.getSlotCount()).toBe(11);
    });

    it('should add and remove files that are part of the context', () => {
        let context = 'my_inventory';
        let inventory = new InventoryContext(context);
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
        let inventory = new InventoryContext(context);
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

    it('should sort files based on x position in context', () => {
        let context = 'my_inventory';
        let slotCount = 3;
        let inventory = new InventoryContext(context, slotCount);
        let files: File[] = [
            createFile('testId_4', { [context]: true, [`${context}.x`]: 0 }),
            createFile('testId_3', { [context]: true, [`${context}.x`]: 1 }),
            createFile('testId_2', { [context]: true, [`${context}.x`]: 2 }),
            createFile('testId_1', { [context]: true, [`${context}.x`]: 3 }),
            createFile('testId_0', { [context]: true, [`${context}.x`]: 4 }),
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
        expect(inventory.slots[0].id).toEqual('testId_4');
        expect(inventory.slots[1].id).toEqual('testId_3');
        expect(inventory.slots[2].id).toEqual('testId_2');
        expect(inventory.slots[3]).toBeUndefined();
    });

    it('should not sort files that have context y position greater or less than 0', () => {
        let context = 'my_inventory';
        let slotCount = 5;
        let inventory = new InventoryContext(context, slotCount);
        let files: File[] = [
            createFile('testId_4', { [context]: true, [`${context}.x`]: 0, [`${context}.y`]: 0 }),
            createFile('testId_3', { [context]: true, [`${context}.x`]: 1, [`${context}.y`]: -1 }),
            createFile('testId_2', { [context]: true, [`${context}.x`]: 2, [`${context}.y`]: 100 }),
            createFile('testId_1', { [context]: true, [`${context}.x`]: 3, [`${context}.y`]: 2 }),
            createFile('testId_0', { [context]: true, [`${context}.x`]: 4, [`${context}.y`]: 0 }),
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
        expect(inventory.slots[0].id).toEqual('testId_4');
        expect(inventory.slots[1]).toBeUndefined();
        expect(inventory.slots[2]).toBeUndefined();
        expect(inventory.slots[3]).toBeUndefined();
        expect(inventory.slots[4].id).toEqual('testId_0');
    });

    it('should not sort files that have context index greater than 0', () => {
        let context = 'my_inventory';
        let slotCount = 5;
        let inventory = new InventoryContext(context, slotCount);
        let files: File[] = [
            createFile('testId_4', { [context]: true, [`${context}.x`]: 0, [`${context}.y`]: 0, [`${context}.index`]: 1 }),
            createFile('testId_3', { [context]: true, [`${context}.x`]: 1, [`${context}.y`]: 0, [`${context}.index`]: 0 }),
            createFile('testId_2', { [context]: true, [`${context}.x`]: 2, [`${context}.y`]: 0, [`${context}.index`]: -1 }),
            createFile('testId_1', { [context]: true, [`${context}.x`]: 3, [`${context}.y`]: 0, [`${context}.index`]: 0 }),
            createFile('testId_0', { [context]: true, [`${context}.x`]: 4, [`${context}.y`]: 0, [`${context}.index`]: 0 }),
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
        expect(inventory.slots[1].id).toEqual('testId_3');
        expect(inventory.slots[2]).toBeUndefined();
        expect(inventory.slots[3].id).toEqual('testId_1');
        expect(inventory.slots[4].id).toEqual('testId_0');
    });


});