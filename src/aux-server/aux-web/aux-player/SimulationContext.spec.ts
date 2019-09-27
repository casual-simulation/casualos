import { SimulationContext } from './SimulationContext';
import {
    Bot,
    createBot,
    createCalculationContext,
    AuxObject,
    updateBot,
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

    it('should add and remove bots that are part of the context', () => {
        let context = 'my_inventory';
        let sim = new SimulationContext(null, context);
        let bots: Bot[] = [];

        // Add some bots that are assigned to the context.
        for (let i = 0; i < 10; i++) {
            let file = createBot(`testId_${i}`);
            file.tags[context] = true;
            file.tags['aux.channel'] = 'a';
            bots.push(file);
        }

        const calc = createCalculationContext(bots);

        for (let i = 0; i < bots.length; i++) {
            sim.botAdded(<AuxObject>bots[i], calc);
        }

        // Make sure all bots got added.
        expect(sim.bots).toHaveLength(10);

        // Remove bots 6,7,8.
        sim.botRemoved('testId_6', calc);
        sim.botRemoved('testId_7', calc);
        sim.botRemoved('testId_8', calc);

        expect(sim.bots).toHaveLength(7);
    });

    it('should ignore bots that are not part of the context.', () => {
        let context = 'my_inventory';
        let sim = new SimulationContext(null, context);
        let bots: Bot[] = [];

        // Create bots that are part of the context.
        for (let i = 0; i < 6; i++) {
            let file = createBot(`testId_${i}`);
            file.tags[context] = true;
            file.tags['aux.channel'] = 'a';
            bots.push(file);
        }

        // Create bots that are not part of the context.
        for (let i = 6; i < 10; i++) {
            let file = createBot(`testId_${i}`);
            file.tags['some_other_context'] = true;
            file.tags['aux.channel'] = 'a';
            bots.push(file);
        }

        const calc = createCalculationContext(bots);

        for (let i = 0; i < bots.length; i++) {
            sim.botAdded(<AuxObject>bots[i], calc);
        }

        expect(sim.bots).toHaveLength(6);

        // Try removing file that is not part of the context.
        sim.botRemoved('some_other_file', calc);
        expect(sim.bots).toHaveLength(6);
    });

    it('should ignore bots that dont have aux.channel set to something', () => {
        let context = 'my_inventory';
        let sim = new SimulationContext(null, context);
        let bots: Bot[] = [];

        // Create bots that are part of the context.
        for (let i = 0; i < 6; i++) {
            let file = createBot(`testId_${i}`);
            file.tags[context] = true;
            file.tags['aux.channel'] = 'abc';
            bots.push(file);
        }

        // Create bots that are not part of the context.
        for (let i = 6; i < 10; i++) {
            let file = createBot(`testId_${i}`);
            file.tags[context] = true;
            bots.push(file);
        }

        const calc = createCalculationContext(bots);

        for (let i = 0; i < bots.length; i++) {
            sim.botAdded(<AuxObject>bots[i], calc);
        }

        expect(sim.bots).toHaveLength(6);

        // Try removing file that is not part of the context.
        sim.botRemoved('some_other_file', calc);
        expect(sim.bots).toHaveLength(6);
    });

    it('should sort bots based on index in context', () => {
        let context = 'my_inventory';
        let sim = new SimulationContext(null, context);
        let bots: Bot[] = [
            createBot('testId_4', {
                [context]: true,
                [`${context}.sortOrder`]: 0,
                'aux.channel': 'a',
            }),
            createBot('testId_3', {
                [context]: true,
                [`${context}.sortOrder`]: 1,
                'aux.channel': 'a',
            }),
            createBot('testId_2', {
                [context]: true,
                [`${context}.sortOrder`]: 2,
                'aux.channel': 'a',
            }),
            createBot('testId_1', {
                [context]: true,
                [`${context}.sortOrder`]: 3,
                'aux.channel': 'a',
            }),
            createBot('testId_0', {
                [context]: true,
                [`${context}.sortOrder`]: 4,
                'aux.channel': 'a',
            }),
        ];
        const calc = createCalculationContext(bots);

        for (let i = 0; i < bots.length; i++) {
            sim.botAdded(<AuxObject>bots[i], calc);
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
        let bots: Bot[] = [
            createBot('testId_0', {
                [context]: true,
                [`${context}.sortOrder`]: 0,
                'aux.channel': 'a',
            }),
            createBot('testId_1', {
                [context]: true,
                [`${context}.sortOrder`]: 1,
                'aux.channel': 'a',
            }),
        ];

        let calc = createCalculationContext(bots);

        for (let i = 0; i < bots.length; i++) {
            sim.botAdded(<AuxObject>bots[i], calc);
        }

        // Expected bots in context.
        expect(sim.bots).toHaveLength(2);
        expect(sim.bots[0].id).toEqual('testId_0');
        expect(sim.bots[1].id).toEqual('testId_1');

        sim.frameUpdate(calc);

        // items should be be in initial state.
        expect(sim.items[0].file.id).toEqual('testId_0');
        expect(sim.items[1].file.id).toEqual('testId_1');
        expect(sim.items[2]).toBeUndefined();
        expect(sim.items[3]).toBeUndefined();
        expect(sim.items[4]).toBeUndefined();

        // Now lets move testId_1 to the fourth slot.
        let file = bots[1];
        file.tags[`${context}.sortOrder`] = 3;

        calc = createCalculationContext(bots);
        sim.botUpdated(<AuxObject>file, null, calc);
        sim.frameUpdate(calc);

        // Files should still be in original state.
        expect(sim.bots).toHaveLength(2);
        expect(sim.bots[0].id).toEqual('testId_0');
        expect(sim.bots[1].id).toEqual('testId_1');

        // items should have updated accordingly.
        expect(sim.items[0].file.id).toEqual('testId_0');
        expect(sim.items[1].file.id).toEqual('testId_1');
        expect(sim.items[2]).toBeUndefined();
        expect(sim.items[3]).toBeUndefined();
        expect(sim.items[4]).toBeUndefined();
    });
});
