import { MenuContext } from "./MenuContext";
import { File, createFile, createCalculationContext, AuxObject, updateFile } from "@casual-simulation/aux-common";

describe('MenuContext', () => {
    it('should construct for specific context', () => {
        const menu = new MenuContext('my_super_cool_context');
        expect(menu.context).toEqual('my_super_cool_context');
    });

    it('should not allow invalid context name', () => {

        function createWith(context: any) {
            let inventory = new MenuContext(context);
        };

        expect( () => {createWith(null)} ).toThrow();
        expect( () => {createWith(undefined)} ).toThrow();
    });

    it('should add and remove files that are part of the context', () => {
        let context = 'my_inventory';
        let menu = new MenuContext(context);
        let files: File[] = [];

        // Add some files that are assigned to the context.
        for (let i = 0; i < 10; i++) {
            let file = createFile(`testId_${i}`);
            file.tags[context] = true;
            files.push(file);
        }

        const calc = createCalculationContext(files);

        for (let i = 0; i < files.length; i++) {
            menu.fileAdded(<AuxObject>files[i], calc);
        }

        // Make sure all files got added.
        expect(menu.files).toHaveLength(10);

        // Remove files 6,7,8.
        menu.fileRemoved('testId_6', calc);
        menu.fileRemoved('testId_7', calc);
        menu.fileRemoved('testId_8', calc);

        expect(menu.files).toHaveLength(7);
    });

    it('should ignore files that are not part of the context.', () => {
        let context = 'my_inventory';
        let menu = new MenuContext(context);
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
            menu.fileAdded(<AuxObject>files[i], calc);
        }

        expect(menu.files).toHaveLength(6);

        // Try removing file that is not part of the context.
        menu.fileRemoved('some_other_file', calc);
        expect(menu.files).toHaveLength(6);
    });

    it('should sort files based on index in context', () => {
        let context = 'my_inventory';
        let menu = new MenuContext(context);
        let files: File[] = [
            createFile('testId_4', { [context]: true, [`${context}.index`]: 0 }),
            createFile('testId_3', { [context]: true, [`${context}.index`]: 1 }),
            createFile('testId_2', { [context]: true, [`${context}.index`]: 2 }),
            createFile('testId_1', { [context]: true, [`${context}.index`]: 3 }),
            createFile('testId_0', { [context]: true, [`${context}.index`]: 4 }),
        ];
        const calc = createCalculationContext(files);

        for (let i = 0; i < files.length; i++) {
            menu.fileAdded(<AuxObject>files[i], calc);
        }
        
        // Should be empty.
        expect(menu.items).toEqual([]);

        menu.frameUpdate(calc);

        // Should not be empty.
        expect(menu.items).not.toEqual([]);
        expect(menu.items).toHaveLength(5);

        // Should be sorted like this: testId_4, testId_3, testId_2
        expect(menu.items[0].id).toEqual('testId_4');
        expect(menu.items[1].id).toEqual('testId_3');
        expect(menu.items[2].id).toEqual('testId_2');
        expect(menu.items[3].id).toEqual('testId_1');
        expect(menu.items[4].id).toEqual('testId_0');
    });

    it('should update items as expected after file is added and then moved to another slot.', () => {
        let context = 'my_inventory';
        let menu = new MenuContext(context);
        let files: File[] = [
            createFile('testId_0', { [context]: true, [`${context}.index`]: 0}),
            createFile('testId_1', { [context]: true, [`${context}.index`]: 1}),
        ];

        let calc = createCalculationContext(files);

        for (let i = 0; i < files.length; i++) {
            menu.fileAdded(<AuxObject>files[i], calc);
        }

        // Expected files in context.
        expect(menu.files).toHaveLength(2);
        expect(menu.files[0].id).toEqual('testId_0');
        expect(menu.files[1].id).toEqual('testId_1');

        menu.frameUpdate(calc);

        // items should be be in initial state.
        expect(menu.items[0].id).toEqual('testId_0');
        expect(menu.items[1].id).toEqual('testId_1');
        expect(menu.items[2]).toBeUndefined();
        expect(menu.items[3]).toBeUndefined();
        expect(menu.items[4]).toBeUndefined();

        // Now lets move testId_1 to the fourth slot.
        let file = files[1];
        file.tags[`${context}.index`] = 3;
        
        calc = createCalculationContext(files);
        menu.fileUpdated(<AuxObject>file, null, calc);
        menu.frameUpdate(calc);

        // Files should still be in original state.
        expect(menu.files).toHaveLength(2);
        expect(menu.files[0].id).toEqual('testId_0');
        expect(menu.files[1].id).toEqual('testId_1');

        // items should have updated accordingly.
        expect(menu.items[0].id).toEqual('testId_0');
        expect(menu.items[1].id).toEqual('testId_1');
        expect(menu.items[2]).toBeUndefined();
        expect(menu.items[3]).toBeUndefined();
        expect(menu.items[4]).toBeUndefined();
    });
});