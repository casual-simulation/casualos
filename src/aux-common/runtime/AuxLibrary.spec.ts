import { AuxLibrary, createDefaultLibrary } from './AuxLibrary';
import { AuxGlobalContext, addToContext } from './AuxGlobalContext';
import { createDummyScriptBot } from './DummyScriptBot';
import { ScriptBot } from '../bots';

describe('AuxLibrary', () => {
    let library: ReturnType<typeof createDefaultLibrary>;
    let context: AuxGlobalContext;

    beforeEach(() => {
        context = {
            allowsEditing: true,
            bots: [],
        };

        library = createDefaultLibrary(context);
    });

    const falsyCases = [['false', false], ['0', 0]];
    const emptyCases = [['null', null], ['empty string', '']];

    describe('getBots()', () => {
        let bot1: ScriptBot;
        let bot2: ScriptBot;
        let bot3: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');
            bot2 = createDummyScriptBot('test2');
            bot3 = createDummyScriptBot('test3');

            addToContext(context, bot1, bot2, bot3);
        });

        it('should get all the bots in the context', () => {
            const bots = library.api.getBots();

            expect(bots).toEqual([bot1, bot2, bot3]);
        });

        it('should get all the bots with the given tag', () => {
            bot1.tags.hello = true;
            bot3.tags.hello = false;
            const bots = library.api.getBots('#hello');

            expect(bots).toEqual([bot1, bot3]);
        });

        it('should get all the bots with the given tag and value', () => {
            bot1.tags.hello = true;
            bot3.tags.hello = false;
            bot2.tags.hello = false;
            const bots = library.api.getBots('#hello', false);

            expect(bots).toEqual([bot2, bot3]);
        });

        it('should use strict equality for value matches', () => {
            bot1.tags.hello = '1';
            bot2.tags.hello = 1;
            bot3.tags.hello = true;
            const bots = library.api.getBots('#hello', true);

            expect(bots).toEqual([bot3]);
        });

        it('should get all the bots that match the given tag and value predicate', () => {
            bot1.tags.hello = true;
            bot3.tags.hello = false;
            bot2.tags.hello = false;
            const bots = library.api.getBots(
                '#hello',
                (val: boolean) => val === true
            );

            expect(bots).toEqual([bot1]);
        });

        it('should get all the bots that match the given predicate functions', () => {
            bot1.tags.hello = true;
            bot1.tags.num = 25;
            bot2.tags.hello = false;
            bot2.tags.num = 50;
            bot3.tags.hello = false;
            bot3.tags.num = 100;
            const bots = library.api.getBots(
                (b: ScriptBot) => b.tags.hello === false,
                (b: ScriptBot) => b.tags.num > 50
            );

            expect(bots).toEqual([bot3]);
        });

        it('should include zeroes in results', () => {
            bot1.tags.num = 0;
            bot2.tags.num = 1;
            bot3.tags.num = 2;
            const bots = library.api.getBots('#num');

            expect(bots).toEqual([bot1, bot2, bot3]);
        });

        it('should include NaN in results', () => {
            bot1.tags.num = NaN;
            bot2.tags.num = 1;
            bot3.tags.num = 2;
            const bots = library.api.getBots('#num');

            expect(bots).toEqual([bot1, bot2, bot3]);
        });

        it('should not include empty strings in results', () => {
            bot1.tags.num = '';
            bot2.tags.num = 1;
            bot3.tags.num = 2;
            const bots = library.api.getBots('#num');

            expect(bots).toEqual([bot2, bot3]);
        });

        it('should not include null in results', () => {
            bot1.tags.num = null;
            bot2.tags.num = 1;
            bot3.tags.num = 2;
            const bots = library.api.getBots('#num');

            expect(bots).toEqual([bot2, bot3]);
        });

        it('should sort bots using the given sort function in the predicate functions', () => {
            bot1.tags.hello = true;
            bot1.tags.num = 25;
            bot2.tags.hello = false;
            bot2.tags.num = 100;
            bot3.tags.hello = false;
            bot3.tags.num = 50;

            let filter = (b: ScriptBot) => {
                return b.tags.hello === false;
            };
            (<any>filter).sort = (b: ScriptBot) => b.tags.num;

            const bots = library.api.getBots(filter);

            expect(bots).toEqual([bot3, bot2]);
        });

        

                it.each(falsyCases)(
                    'should return only the bots that match %s',
                    (desc, val) => {
                        bot1.tags.tag = val;
                        bot2.tags.tag = val;

                        const bots = library.api.getBots('tag', val);

                        expect(bots).toEqual([bot1, bot2]);
                    }
                );

                it.each(emptyCases)(
                    'should return an empty array if a %s tag is provided',
                    (desc, val) => {
                        const bots = library.api.getBots(val);
                        expect(bots).toEqual([]);;
                    }
                );

                // it.each(falsyCases)(
                //     'should return only the bots that match %s when using byTag()',
                //     (desc, val) => {
                //         const bot = createBot('test', {
                //             formula: `=getBots(byTag("tag", ${val}))`,
                //         });

                //         const bot2 = createBot('test2', {
                //             tag: 2,
                //         });

                //         const bot3 = createBot('test3', {
                //             tag: val,
                //         });

                //         const context = createCalculationContext([
                //             bot,
                //             bot2,
                //             bot3,
                //         ]);
                //         const value = calculateBotValue(
                //             context,
                //             bot,
                //             'formula'
                //         );

                //         expect(value).toMatchObject([bot3]);
                //     }
                // );
    });


});