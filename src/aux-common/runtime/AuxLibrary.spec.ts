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
                expect(bots).toEqual([]);
            }
        );

        it.each(falsyCases)(
            'should return only the bots that match %s when using byTag()',
            (desc, val) => {
                bot1.tags.tag = 2;
                bot2.tags.tag = val;

                const bots = library.api.getBots(library.api.byTag('tag', val));

                expect(bots).toEqual([bot2]);
            }
        );
    });

    describe('byTag()', () => {
        let bot1: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');

            addToContext(context, bot1);
        });

        describe('just tag', () => {
            const cases = [
                [true, 'a bot has the given tag', 0],
                [false, 'a bot has null for the given tag', null],
                [false, 'a bot has undefined for the given tag', undefined],
            ];

            it.each(cases)(
                'should return a function that returns %s if %s',
                (expected, desc, val) => {
                    const filter = library.api.byTag('red');

                    bot1.tags.red = val;

                    expect(filter(bot1)).toEqual(expected);
                }
            );

            it('should support using a hashtag at the beginning of a tag', () => {
                const filter = library.api.byTag('#red');
                bot1.tags.red = 'abc';

                expect(filter(bot1)).toBe(true);
            });

            it('should support using a @ symbol at the beginning of a tag', () => {
                const filter = library.api.byTag('@red');
                bot1.tags.red = 'abc';

                expect(filter(bot1)).toBe(true);
            });
        });

        describe('tag + value', () => {
            it('should return a function that returns true when the value matches the tag', () => {
                const filter = library.api.byTag('red', 'abc');
                bot1.tags.red = 'abc';

                expect(filter(bot1)).toBe(true);
            });

            it('should return a function that returns false when the value does not match the tag', () => {
                const filter = library.api.byTag('red', 'abc');
                bot1.tags.red = 123;

                expect(filter(bot1)).toBe(false);
            });

            it.each(falsyCases)('should work with %s', (desc, val) => {
                const filter = library.api.byTag('red', val);
                bot1.tags.red = val;

                expect(filter(bot1)).toBe(true);

                bot1.tags.red = 5;
                expect(filter(bot1)).toBe(false);
            });

            it('should be able to match bots without the given tag using null', () => {
                const filter = library.api.byTag('red', null);
                bot1.tags.red = 'abc';

                expect(filter(bot1)).toBe(false);

                delete bot1.tags.red;
                expect(filter(bot1)).toBe(true);
            });
        });

        describe('tag + filter', () => {
            it('should return a function that returns true when the function returns true', () => {
                const filter = library.api.byTag(
                    'red',
                    tag => typeof tag === 'number'
                );

                bot1.tags.red = 123;
                expect(filter(bot1)).toBe(true);
            });

            it('should return a function that returns false when the function returns false', () => {
                const filter = library.api.byTag(
                    'red',
                    tag => typeof tag === 'number'
                );

                bot1.tags.red = 'abc';
                expect(filter(bot1)).toBe(false);
            });
        });
    });

    describe('byMod()', () => {
        let bot1: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');

            addToContext(context, bot1);
        });

        it('should match bots with all of the same tags and values', () => {
            const filter = library.api.byMod({
                auxColor: 'red',
                number: 123,
            });

            bot1.tags.auxColor = 'red';
            bot1.tags.number = 123;
            bot1.tags.other = true;

            expect(filter(bot1)).toEqual(true);
        });

        it('should not match bots with wrong tag values', () => {
            const filter = library.api.byMod({
                auxColor: 'red',
                number: 123,
            });

            bot1.tags.auxColor = 'red';
            bot1.tags.number = 999;
            bot1.tags.other = true;

            expect(filter(bot1)).toEqual(false);
        });

        it('should match tags using the given filter', () => {
            const filter = library.api.byMod({
                auxColor: (x: string) => x.startsWith('r'),
                number: 123,
            });

            bot1.tags.auxColor = 'rubble';
            bot1.tags.number = 123;
            bot1.tags.other = true;

            expect(filter(bot1)).toEqual(true);
        });

        it('should match tags with null', () => {
            const filter = library.api.byMod({
                auxColor: null,
                number: 123,
            });

            bot1.tags.number = 123;
            bot1.tags.other = true;

            expect(filter(bot1)).toEqual(true);

            bot1.tags.auxColor = 'red';

            expect(filter(bot1)).toEqual(false);
        });
    });

    describe('inDimension()', () => {
        let bot1: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');

            addToContext(context, bot1);
        });

        it('should return a function that returns true if the bot is in the given dimension', () => {
            const filter = library.api.inDimension('red');

            bot1.tags.red = true;
            expect(filter(bot1)).toEqual(true);
        });

        it('should return a function that returns false if the bot is not in the given dimension', () => {
            const filter = library.api.inDimension('red');
            expect(filter(bot1)).toEqual(false);
        });
    });

    describe('atPosition()', () => {
        let bot1: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');

            addToContext(context, bot1);
        });

        it('should return a function that returns true if the bot is at the given position', () => {
            const filter = library.api.atPosition('red', 1, 2);

            bot1.tags.red = true;
            bot1.tags.redX = 1;
            bot1.tags.redY = 2;

            expect(filter(bot1)).toEqual(true);
        });

        it('should return a function that returns false if the bot is not at the given position', () => {
            const filter = library.api.atPosition('red', 1, 2);

            bot1.tags.red = true;
            bot1.tags.redX = 1;
            bot1.tags.redY = 3;

            expect(filter(bot1)).toEqual(false);
        });

        it('should return a function that returns false if the bot is not in the given dimension', () => {
            const filter = library.api.atPosition('red', 1, 2);

            bot1.tags.red = false;
            bot1.tags.redX = 1;
            bot1.tags.redY = 2;

            expect(filter(bot1)).toEqual(false);
        });

        it('should return a function with a sort function that sorts the bots by their sort order', () => {
            const filter = library.api.atPosition('red', 1, 2);

            bot1.tags.red = false;
            bot1.tags.redX = 1;
            bot1.tags.redY = 2;
            bot1.tags.redSortOrder = 100;

            expect(typeof filter.sort).toBe('function');
            expect(filter.sort(bot1)).toBe(100);
        });

        it('should support sorting when the dimension tag starts with a hashtag', () => {
            const filter = library.api.atPosition('#red', 1, 2);

            bot1.tags.red = false;
            bot1.tags.redX = 1;
            bot1.tags.redY = 2;
            bot1.tags.redSortOrder = 100;

            expect(typeof filter.sort).toBe('function');
            expect(filter.sort(bot1)).toBe(100);
        });
    });

    describe('inStack()', () => {
        let bot1: ScriptBot;
        let bot2: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');
            bot2 = createDummyScriptBot('test2');

            addToContext(context, bot1, bot2);
        });

        it('should return a function that returns true if the bot is in the same stack as another bot', () => {
            bot1.tags.red = true;
            bot1.tags.redX = 1;
            bot1.tags.redY = 2;
            const filter = library.api.inStack(bot1, 'red');

            bot2.tags.red = true;
            bot2.tags.redX = 1;
            bot2.tags.redY = 2;

            expect(filter(bot2)).toEqual(true);
        });

        it('should return a function that returns false if the bot is not in the same stack as another bot', () => {
            bot1.tags.red = true;
            bot1.tags.redX = 1;
            bot1.tags.redY = 2;
            const filter = library.api.inStack(bot1, 'red');

            bot2.tags.red = true;
            bot2.tags.redX = 1;
            bot2.tags.redY = 3;

            expect(filter(bot2)).toEqual(false);
        });

        it('should return a function that returns false if the bot is not in the same dimension as another bot', () => {
            bot1.tags.red = true;
            bot1.tags.redX = 1;
            bot1.tags.redY = 2;
            const filter = library.api.inStack(bot1, 'red');

            bot2.tags.red = false;
            bot2.tags.redX = 1;
            bot2.tags.redY = 2;

            expect(filter(bot2)).toEqual(false);
        });

        it('should return a function with a sort function that sorts the bots by their sort order', () => {
            bot1.tags.red = true;
            bot1.tags.redX = 1;
            bot1.tags.redY = 2;
            const filter = library.api.inStack(bot1, 'red');

            bot2.tags.red = true;
            bot2.tags.redX = 1;
            bot2.tags.redY = 2;
            bot2.tags.redSortOrder = 100;

            expect(typeof filter.sort).toBe('function');
            expect(filter.sort(bot2)).toEqual(100);
        });

        it('should support sorting when the dimension tag starts with a hashtag', () => {
            bot1.tags.red = true;
            bot1.tags.redX = 1;
            bot1.tags.redY = 2;
            const filter = library.api.inStack(bot1, '#red');

            bot2.tags.red = true;
            bot2.tags.redX = 1;
            bot2.tags.redY = 2;
            bot2.tags.redSortOrder = 100;

            expect(typeof filter.sort).toBe('function');
            expect(filter.sort(bot2)).toEqual(100);
        });
    });

    describe('neighboring()', () => {
        let bot1: ScriptBot;
        let bot2: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');
            bot2 = createDummyScriptBot('test2');

            addToContext(context, bot1, bot2);
        });

        const directionCases = [
            ['front', 0, -1],
            ['back', 0, 1],
            ['left', 1, 0],
            ['right', -1, 0],
        ];

        describe.each(directionCases)('%s', (direction, x, y) => {
            it('should return a function that returns true if the given bot is at the correct position', () => {
                bot1.tags.red = true;
                bot1.tags.redX = 0;
                bot1.tags.redY = 0;
                const filter = library.api.neighboring(bot1, 'red', direction);

                bot2.tags.red = true;
                bot2.tags.redX = x;
                bot2.tags.redY = y;

                expect(filter(bot2)).toEqual(true);
            });

            it('should return a function that returns false if the given bot is not at the correct position', () => {
                bot1.tags.red = true;
                bot1.tags.redX = 0;
                bot1.tags.redY = 0;
                const filter = library.api.neighboring(bot1, 'red', direction);

                bot2.tags.red = true;
                bot2.tags.redX = -x;
                bot2.tags.redY = -y;

                expect(filter(bot2)).toEqual(false);
            });

            it('should return a function with a sort function that sorts the bots by their sort order', () => {
                bot1.tags.red = true;
                bot1.tags.redX = 0;
                bot1.tags.redY = 0;
                const filter = library.api.neighboring(bot1, 'red', direction);

                bot2.tags.red = true;
                bot2.tags.redX = x;
                bot2.tags.redY = y;
                bot2.tags.redSortOrder = 100;

                expect(typeof filter.sort).toEqual('function');
                expect(filter.sort(bot2)).toEqual(100);
            });
        });
    });

    describe('bySpace()', () => {
        let bot1: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');

            addToContext(context, bot1);
        });

        it('should return a function that returns true if the bot is in given space', () => {
            const filter = library.api.bySpace(<any>'test');

            bot1.tags.space = 'test';

            expect(filter(bot1)).toEqual(true);
        });
    });

    describe('byCreator()', () => {
        let bot1: ScriptBot;
        let bot2: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');
            bot2 = createDummyScriptBot('test2');

            addToContext(context, bot1, bot2);
        });

        it('should return a function that returns true if the bot is created by the given bot', () => {
            const filter = library.api.byCreator(bot1);

            bot2.tags.auxCreator = bot1.id;

            expect(filter(bot2)).toEqual(true);
        });

        it('should return a function that returns true if the bot is created by the given bot ID', () => {
            const filter = library.api.byCreator(bot1.id);

            bot2.tags.auxCreator = bot1.id;

            expect(filter(bot2)).toEqual(true);
        });

        it('should return a function that returns false if the bot not is created by the given bot ID', () => {
            const filter = library.api.byCreator(bot1.id);

            bot2.tags.auxCreator = 'other';

            expect(filter(bot2)).toEqual(false);
        });

        it('should return a function that returns false if the bot not is created by the given bot', () => {
            const filter = library.api.byCreator(bot1);

            bot2.tags.auxCreator = 'other';

            expect(filter(bot2)).toEqual(false);
        });
    });
});
