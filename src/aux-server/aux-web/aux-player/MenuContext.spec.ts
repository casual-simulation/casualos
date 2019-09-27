import { MenuContext } from './MenuContext';
import {
    Bot,
    createBot,
    createCalculationContext,
    AuxObject,
    updateBot,
} from '@casual-simulation/aux-common';

describe('MenuContext', () => {
    it('should construct for specific context', () => {
        const menu = new MenuContext(null, 'my_super_cool_context');
        expect(menu.context).toEqual('my_super_cool_context');
    });

    it('should not allow invalid context name', () => {
        function createWith(context: any) {
            let inventory = new MenuContext(null, context);
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
        let menu = new MenuContext(null, context);
        let bots: Bot[] = [];

        // Add some bots that are assigned to the context.
        for (let i = 0; i < 10; i++) {
            let bot = createBot(`testId_${i}`);
            bot.tags[context] = true;
            bots.push(bot);
        }

        const calc = createCalculationContext(bots);

        for (let i = 0; i < bots.length; i++) {
            menu.botAdded(<AuxObject>bots[i], calc);
        }

        // Make sure all bots got added.
        expect(menu.bots).toHaveLength(10);

        // Remove bots 6,7,8.
        menu.botRemoved('testId_6', calc);
        menu.botRemoved('testId_7', calc);
        menu.botRemoved('testId_8', calc);

        expect(menu.bots).toHaveLength(7);
    });

    it('should ignore bots that are not part of the context.', () => {
        let context = 'my_inventory';
        let menu = new MenuContext(null, context);
        let bots: Bot[] = [];

        // Create bots that are part of the context.
        for (let i = 0; i < 6; i++) {
            let bot = createBot(`testId_${i}`);
            bot.tags[context] = true;
            bots.push(bot);
        }

        // Create bots that are not part of the context.
        for (let i = 6; i < 10; i++) {
            let bot = createBot(`testId_${i}`);
            bot.tags['some_other_context'] = true;
            bots.push(bot);
        }

        const calc = createCalculationContext(bots);

        for (let i = 0; i < bots.length; i++) {
            menu.botAdded(<AuxObject>bots[i], calc);
        }

        expect(menu.bots).toHaveLength(6);

        // Try removing bot that is not part of the context.
        menu.botRemoved('some_other_file', calc);
        expect(menu.bots).toHaveLength(6);
    });

    it('should sort bots based on index in context', () => {
        let context = 'my_inventory';
        let menu = new MenuContext(null, context);
        let bots: Bot[] = [
            createBot('testId_4', {
                [context]: true,
                [`${context}.sortOrder`]: 0,
            }),
            createBot('testId_3', {
                [context]: true,
                [`${context}.sortOrder`]: 1,
            }),
            createBot('testId_2', {
                [context]: true,
                [`${context}.sortOrder`]: 2,
            }),
            createBot('testId_1', {
                [context]: true,
                [`${context}.sortOrder`]: 3,
            }),
            createBot('testId_0', {
                [context]: true,
                [`${context}.sortOrder`]: 4,
            }),
        ];
        const calc = createCalculationContext(bots);

        for (let i = 0; i < bots.length; i++) {
            menu.botAdded(<AuxObject>bots[i], calc);
        }

        // Should be empty.
        expect(menu.items).toEqual([]);

        menu.frameUpdate(calc);

        // Should not be empty.
        expect(menu.items).not.toEqual([]);
        expect(menu.items).toHaveLength(5);

        // Should be sorted like this: testId_4, testId_3, testId_2
        expect(menu.items[0].bot.id).toEqual('testId_4');
        expect(menu.items[1].bot.id).toEqual('testId_3');
        expect(menu.items[2].bot.id).toEqual('testId_2');
        expect(menu.items[3].bot.id).toEqual('testId_1');
        expect(menu.items[4].bot.id).toEqual('testId_0');
    });

    it('should update items as expected after bot is added and then moved to another slot.', () => {
        let context = 'my_inventory';
        let menu = new MenuContext(null, context);
        let bots: Bot[] = [
            createBot('testId_0', {
                [context]: true,
                [`${context}.sortOrder`]: 0,
            }),
            createBot('testId_1', {
                [context]: true,
                [`${context}.sortOrder`]: 1,
            }),
        ];

        let calc = createCalculationContext(bots);

        for (let i = 0; i < bots.length; i++) {
            menu.botAdded(<AuxObject>bots[i], calc);
        }

        // Expected bots in context.
        expect(menu.bots).toHaveLength(2);
        expect(menu.bots[0].id).toEqual('testId_0');
        expect(menu.bots[1].id).toEqual('testId_1');

        menu.frameUpdate(calc);

        // items should be be in initial state.
        expect(menu.items[0].bot.id).toEqual('testId_0');
        expect(menu.items[1].bot.id).toEqual('testId_1');
        expect(menu.items[2]).toBeUndefined();
        expect(menu.items[3]).toBeUndefined();
        expect(menu.items[4]).toBeUndefined();

        // Now lets move testId_1 to the fourth slot.
        let bot = bots[1];
        bot.tags[`${context}.sortOrder`] = 3;

        calc = createCalculationContext(bots);
        menu.botUpdated(<AuxObject>bot, null, calc);
        menu.frameUpdate(calc);

        // Files should still be in original state.
        expect(menu.bots).toHaveLength(2);
        expect(menu.bots[0].id).toEqual('testId_0');
        expect(menu.bots[1].id).toEqual('testId_1');

        // items should have updated accordingly.
        expect(menu.items[0].bot.id).toEqual('testId_0');
        expect(menu.items[1].bot.id).toEqual('testId_1');
        expect(menu.items[2]).toBeUndefined();
        expect(menu.items[3]).toBeUndefined();
        expect(menu.items[4]).toBeUndefined();
    });
});
