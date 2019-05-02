import { SimulationContext } from './SimulationContext';
import {
    File,
    createFile,
    createCalculationContext,
    AuxObject,
    updateFile,
} from '@casual-simulation/aux-common';

describe('SimulationContext', () => {
    it('should construct for specific context', () => {
        const sim = new SimulationContext(null, 'my_super_cool_context');
        expect(sim.context).toEqual('my_super_cool_context');
    });

    it('should not allow invalid context name', () => {
        function createWith(context: any) {
            let inventory = new SimulationContext(null, context);
        }

        expect(() => {
            createWith(null);
        }).toThrow();
        expect(() => {
            createWith(undefined);
        }).toThrow();
    });

    it('should add and remove files that are part of the context', () => {
        let context = 'my_inventory';
        let sim = new SimulationContext(null, context);
        let files: File[] = [];

        // Add some files that are assigned to the context.
        for (let i = 0; i < 10; i++) {
            let file = createFile(`testId_${i}`);
            file.tags[context] = true;
            file.tags['aux.simulation'] = 'a';
            files.push(file);
        }

        const calc = createCalculationContext(files);

        for (let i = 0; i < files.length; i++) {
            sim.fileAdded(<AuxObject>files[i], calc);
        }

        // Make sure all files got added.
        expect(sim.files).toHaveLength(10);

        // Remove files 6,7,8.
        sim.fileRemoved('testId_6', calc);
        sim.fileRemoved('testId_7', calc);
        sim.fileRemoved('testId_8', calc);

        expect(sim.files).toHaveLength(7);
    });

    it('should ignore files that are not part of the context.', () => {
        let context = 'my_inventory';
        let sim = new SimulationContext(null, context);
        let files: File[] = [];

        // Create files that are part of the context.
        for (let i = 0; i < 6; i++) {
            let file = createFile(`testId_${i}`);
            file.tags[context] = true;
            file.tags['aux.simulation'] = 'a';
            files.push(file);
        }

        // Create files that are not part of the context.
        for (let i = 6; i < 10; i++) {
            let file = createFile(`testId_${i}`);
            file.tags['some_other_context'] = true;
            file.tags['aux.simulation'] = 'a';
            files.push(file);
        }

        const calc = createCalculationContext(files);

        for (let i = 0; i < files.length; i++) {
            sim.fileAdded(<AuxObject>files[i], calc);
        }

        expect(sim.files).toHaveLength(6);

        // Try removing file that is not part of the context.
        sim.fileRemoved('some_other_file', calc);
        expect(sim.files).toHaveLength(6);
    });

    it('should ignore files that dont have aux.simulation set to something', () => {
        let context = 'my_inventory';
        let sim = new SimulationContext(null, context);
        let files: File[] = [];

        // Create files that are part of the context.
        for (let i = 0; i < 6; i++) {
            let file = createFile(`testId_${i}`);
            file.tags[context] = true;
            file.tags['aux.simulation'] = 'abc';
            files.push(file);
        }

        // Create files that are not part of the context.
        for (let i = 6; i < 10; i++) {
            let file = createFile(`testId_${i}`);
            file.tags[context] = true;
            files.push(file);
        }

        const calc = createCalculationContext(files);

        for (let i = 0; i < files.length; i++) {
            sim.fileAdded(<AuxObject>files[i], calc);
        }

        expect(sim.files).toHaveLength(6);

        // Try removing file that is not part of the context.
        sim.fileRemoved('some_other_file', calc);
        expect(sim.files).toHaveLength(6);
    });

    it('should sort files based on index in context', () => {
        let context = 'my_inventory';
        let sim = new SimulationContext(null, context);
        let files: File[] = [
            createFile('testId_4', {
                [context]: true,
                [`${context}.index`]: 0,
                'aux.simulation': 'a',
            }),
            createFile('testId_3', {
                [context]: true,
                [`${context}.index`]: 1,
                'aux.simulation': 'a',
            }),
            createFile('testId_2', {
                [context]: true,
                [`${context}.index`]: 2,
                'aux.simulation': 'a',
            }),
            createFile('testId_1', {
                [context]: true,
                [`${context}.index`]: 3,
                'aux.simulation': 'a',
            }),
            createFile('testId_0', {
                [context]: true,
                [`${context}.index`]: 4,
                'aux.simulation': 'a',
            }),
        ];
        const calc = createCalculationContext(files);

        for (let i = 0; i < files.length; i++) {
            sim.fileAdded(<AuxObject>files[i], calc);
        }

        // Should be empty.
        expect(sim.items).toEqual([]);

        sim.frameUpdate(calc);

        // Should not be empty.
        expect(sim.items).not.toEqual([]);
        expect(sim.items).toHaveLength(5);

        // Should be sorted like this: testId_4, testId_3, testId_2
        expect(sim.items[0].file.id).toEqual('testId_4');
        expect(sim.items[1].file.id).toEqual('testId_3');
        expect(sim.items[2].file.id).toEqual('testId_2');
        expect(sim.items[3].file.id).toEqual('testId_1');
        expect(sim.items[4].file.id).toEqual('testId_0');
    });

    it('should update items as expected after file is added and then moved to another slot.', () => {
        let context = 'my_inventory';
        let sim = new SimulationContext(null, context);
        let files: File[] = [
            createFile('testId_0', {
                [context]: true,
                [`${context}.index`]: 0,
                'aux.simulation': 'a',
            }),
            createFile('testId_1', {
                [context]: true,
                [`${context}.index`]: 1,
                'aux.simulation': 'a',
            }),
        ];

        let calc = createCalculationContext(files);

        for (let i = 0; i < files.length; i++) {
            sim.fileAdded(<AuxObject>files[i], calc);
        }

        // Expected files in context.
        expect(sim.files).toHaveLength(2);
        expect(sim.files[0].id).toEqual('testId_0');
        expect(sim.files[1].id).toEqual('testId_1');

        sim.frameUpdate(calc);

        // items should be be in initial state.
        expect(sim.items[0].file.id).toEqual('testId_0');
        expect(sim.items[1].file.id).toEqual('testId_1');
        expect(sim.items[2]).toBeUndefined();
        expect(sim.items[3]).toBeUndefined();
        expect(sim.items[4]).toBeUndefined();

        // Now lets move testId_1 to the fourth slot.
        let file = files[1];
        file.tags[`${context}.index`] = 3;

        calc = createCalculationContext(files);
        sim.fileUpdated(<AuxObject>file, null, calc);
        sim.frameUpdate(calc);

        // Files should still be in original state.
        expect(sim.files).toHaveLength(2);
        expect(sim.files[0].id).toEqual('testId_0');
        expect(sim.files[1].id).toEqual('testId_1');

        // items should have updated accordingly.
        expect(sim.items[0].file.id).toEqual('testId_0');
        expect(sim.items[1].file.id).toEqual('testId_1');
        expect(sim.items[2]).toBeUndefined();
        expect(sim.items[3]).toBeUndefined();
        expect(sim.items[4]).toBeUndefined();
    });
});
