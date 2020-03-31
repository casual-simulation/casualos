import { AuxLibrary, createDefaultLibrary } from './AuxLibrary';
import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
    AuxVersion,
    AuxDevice,
} from './AuxGlobalContext';
import { createDummyScriptBot } from './DummyScriptBot';
import {
    ScriptBot,
    toast,
    showJoinCode,
    requestFullscreen,
    exitFullscreen,
    html,
    hideHtml,
    setClipboard,
    tweenTo,
    showChat,
    hideChat,
    runScript,
    enableAR,
    disableAR,
    enableVR,
    disableVR,
    download,
    showUploadAuxFile,
} from '../bots';
import { possibleTagNameCases } from '../bots/test/BotTestHelpers';

describe('AuxLibrary', () => {
    let library: ReturnType<typeof createDefaultLibrary>;
    let context: MemoryGlobalContext;
    let version: AuxVersion;
    let device: AuxDevice;

    beforeEach(() => {
        version = {
            hash: 'hash',
            version: 'v1.2.3',
            major: 1,
            minor: 2,
            patch: 3,
        };
        device = {
            supportsAR: true,
            supportsVR: false,
        };
        context = new MemoryGlobalContext(version, device);
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

        it('should support emoji tag names', () => {
            bot1.tags['🎶🎉🦊'] = 1;
            bot2.tags['🎶🎉🦊'] = '=2';
            bot3.tags['🎶🎉🦊'] = 3;

            const bots = library.api.getBots('🎶🎉🦊');

            expect(bots).toEqual([bot1, bot2, bot3]);
        });

        it('should support emoji tag names with predicates', () => {
            bot1.tags['🎶🎉🦊'] = 1;
            bot2.tags['🎶🎉🦊'] = 2;
            bot3.tags['🎶🎉🦊'] = 3;

            const bots = library.api.getBots(
                '🎶🎉🦊',
                (num: number) => num >= 2
            );

            expect(bots).toEqual([bot2, bot3]);
        });

        it('should support filtering on values that contain arrays with elements that dont exist', () => {
            bot1.tags.arr = [1];

            const bots = library.api.getBots(
                'arr',
                (x: number[]) => x && x[0] === 1 && x[1] === 2
            );

            expect(bots).toEqual([]);
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

    describe('getBot()', () => {
        let bot1: ScriptBot;
        let bot2: ScriptBot;
        let bot3: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');
            bot2 = createDummyScriptBot('test2');
            bot3 = createDummyScriptBot('test3');

            addToContext(context, bot1, bot2, bot3);
        });

        it('should get the first bot with the given tag', () => {
            bot1.tags.name = 'bob';
            bot2.tags.name = 'alice';

            const bot = library.api.getBot('#name');

            expect(bot).toEqual(bot1);
        });

        it('should get the first bot matching the given value', () => {
            bot1.tags.name = 'bob';
            bot2.tags.name = 'alice';
            bot3.tags.name = 'bob';

            const bot = library.api.getBot('#name', 'bob');

            expect(bot).toEqual(bot1);
        });

        it('should remove the first hashtag but not the second', () => {
            bot1.tags['#name'] = 'bob';
            bot2.tags['#name'] = 'bob';

            const bot = library.api.getBot('##name', 'bob');

            expect(bot).toEqual(bot1);
        });

        it('should allow using @ symbols when getting bots by tags', () => {
            bot1.tags.name = 'bob';
            bot2.tags.name = 'bob';

            const bot = library.api.getBot('@name', 'bob');

            expect(bot).toEqual(bot1);
        });

        it('should remove the first @ symbol but not the second', () => {
            bot1.tags['@name'] = 'bob';
            bot2.tags['@name'] = 'bob';

            const bot = library.api.getBot('@@name', 'bob');

            expect(bot).toEqual(bot1);
        });

        it('should get the first bot matching the given filter function', () => {
            bot1.tags.name = 'bob';
            bot2.tags.name = 'alice';
            bot3.tags.name = 'bob';

            const bot = library.api.getBot('#name', (x: string) => x === 'bob');

            expect(bot).toEqual(bot1);
        });

        it('should return the first bot matching the given filter function', () => {
            bot1.tags.name = 'bob';
            bot2.tags.name = 'alice';
            bot3.tags.name = 'bob';

            const bot = library.api.getBot(
                (b: ScriptBot) => b.tags.name === 'bob'
            );

            expect(bot).toEqual(bot1);
        });

        it('should return the first bot bot matching all the given filter functions', () => {
            bot1.tags.name = 'bob';
            bot2.tags.name = 'alice';
            bot3.tags.name = 'bob';
            bot3.tags.abc = true;

            const bot = library.api.getBot(
                (b: ScriptBot) => b.tags.name === 'bob',
                (b: ScriptBot) => b.tags.abc === true
            );

            expect(bot).toEqual(bot3);
        });

        it('should return the first bot if no arguments are provdided', () => {
            bot1.tags.name = 'bob';
            bot2.tags.name = 'alice';
            bot3.tags.name = 'bob';

            const bot = library.api.getBot();

            expect(bot).toEqual(bot1);
        });

        const emptyCases = [['null', null], ['empty string', '']];

        it.each(emptyCases)(
            'should return undefined if a %s tag is provided',
            (desc, val) => {
                bot1.tags.name = 'bob';
                bot2.tags.name = 'alice';
                bot3.tags.name = 'bob';

                const bot = library.api.getBot(val);

                expect(bot).toEqual(undefined);
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

    describe('either()', () => {
        let bot1: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');

            addToContext(context, bot1);
        });

        it('should return a function that returns true when any of the given functions return true', () => {
            const filter = library.api.either(b => false, b => true);
            expect(filter(bot1)).toEqual(true);
        });

        it('should return a function that returns false when all of the given functions return false', () => {
            const filter = library.api.either(b => false, b => false);
            expect(filter(bot1)).toEqual(false);
        });

        it('should return a function that doesnt have a sort function', () => {
            const filter = library.api.either(b => false, b => true);
            expect(typeof filter.sort).toEqual('undefined');
        });
    });

    describe('not()', () => {
        let bot1: ScriptBot;
        let bot2: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');
            bot2 = createDummyScriptBot('test2');

            addToContext(context, bot1, bot2);
        });

        it('should return a function which negates the given function results', () => {
            const filter = library.api.not(b => b.id === 'test1');

            expect(filter(bot1)).toEqual(false);
            expect(filter(bot2)).toEqual(true);
        });
    });

    describe('getID()', () => {
        let bot1: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');

            addToContext(context, bot1);
        });

        it('should get the ID of the given bot', () => {
            const id = library.api.getID(bot1);
            expect(id).toEqual(bot1.id);
        });

        it('should return the given ID', () => {
            const id = library.api.getID('haha');
            expect(id).toEqual('haha');
        });

        it('should handle null values', () => {
            const id = library.api.getID(null);
            expect(id).toEqual(null);
        });
    });

    describe('getJSON()', () => {
        let bot1: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');

            addToContext(context, bot1);
        });

        it('should convert objects to JSON', () => {
            const json = library.api.getJSON({ abc: 'def' });

            expect(json).toEqual(
                JSON.stringify({
                    abc: 'def',
                })
            );
        });

        it('should convert bots to JSON', () => {
            bot1.tags.abc = 'def';

            const json = library.api.getJSON(bot1);
            expect(json).toEqual(JSON.stringify(bot1));
        });
    });

    describe('getTag()', () => {
        let bot1: ScriptBot;
        let bot2: ScriptBot;
        let bot3: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');
            bot2 = createDummyScriptBot('test2');
            bot3 = createDummyScriptBot('test3');

            addToContext(context, bot1, bot2, bot3);
        });

        it('should get the specified tag value', () => {
            bot1.tags.name = 'bob';
            const value = library.api.getTag(bot1, '#name');

            expect(value).toEqual('bob');
        });

        it('should support using an @ symbol at the beginning of a tag', () => {
            bot1.tags.name = 'bob';
            const value = library.api.getTag(bot1, '@name');

            expect(value).toEqual('bob');
        });

        it('should be able to get a chain of tags', () => {
            bot1.tags.bot = bot2;
            bot2.tags.bot = bot3;
            bot3.tags.name = 'bob';
            const value = library.api.getTag(bot1, '#bot', '#bot', '#name');

            expect(value).toEqual('bob');
        });
    });

    describe('getBotTagValues()', () => {
        let bot1: ScriptBot;
        let bot2: ScriptBot;
        let bot3: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');
            bot2 = createDummyScriptBot('test2');
            bot3 = createDummyScriptBot('test3');

            addToContext(context, bot1, bot2, bot3);
        });

        it('should get the list of values with the given tag', () => {
            bot1.tags.name = 'bob';
            bot2.tags.name = 'alice';
            bot3.tags.name = 'bob';
            const values = library.api.getBotTagValues('#name');

            expect(values).toEqual(['bob', 'alice', 'bob']);
        });

        it('should support using an @ symbol at the beginning of a tag', () => {
            bot1.tags.name = 'bob';
            bot2.tags.name = 'alice';
            bot3.tags.name = 'bob';
            const values = library.api.getBotTagValues('@name');

            expect(values).toEqual(['bob', 'alice', 'bob']);
        });

        it('should get the list of bots with the given tag matching the given value', () => {
            bot1.tags.name = 'bob';
            bot2.tags.name = 'alice';
            bot3.tags.name = 'bob';
            const values = library.api.getBotTagValues('#name', 'bob');

            expect(values).toEqual(['bob', 'bob']);
        });

        it('should get the list of bots with the given tag matching the given predicate', () => {
            bot1.tags.name = 'bob';
            bot2.tags.name = 'alice';
            bot3.tags.name = 'bob';
            const values = library.api.getBotTagValues(
                '#name',
                b => b === 'bob'
            );

            expect(values).toEqual(['bob', 'bob']);
        });

        it('should ignore bots that dont have the given tag', () => {
            bot1.tags.name = 'bob';
            bot3.tags.name = 'bob';
            const values = library.api.getBotTagValues('#name');

            expect(values).toEqual(['bob', 'bob']);
        });
    });

    describe('actions', () => {
        let bot1: ScriptBot;
        let bot2: ScriptBot;

        beforeEach(() => {
            bot1 = createDummyScriptBot('test1');
            bot2 = createDummyScriptBot('test2');

            addToContext(context, bot1, bot2);
        });

        describe('player.toast()', () => {
            it('should emit a ShowToastAction', () => {
                let action = library.api.player.toast('hello, world!');

                expect(action).toEqual(toast('hello, world!'));
                expect(context.actions).toEqual([toast('hello, world!')]);
            });
        });

        describe('player.showJoinCode()', () => {
            it('should emit a ShowJoinCodeEvent', () => {
                const action = library.api.player.showJoinCode();
                expect(action).toEqual(showJoinCode());
                expect(context.actions).toEqual([showJoinCode()]);
            });

            it('should allow linking to a specific universe and dimension', () => {
                const action = library.api.player.showJoinCode(
                    'universe',
                    'dimension'
                );
                expect(action).toEqual(showJoinCode('universe', 'dimension'));
                expect(context.actions).toEqual([
                    showJoinCode('universe', 'dimension'),
                ]);
            });
        });

        describe('player.requestFullscreenMode()', () => {
            it('should issue a request_fullscreen action', () => {
                const action = library.api.player.requestFullscreenMode();
                expect(action).toEqual(requestFullscreen());
                expect(context.actions).toEqual([requestFullscreen()]);
            });
        });

        describe('player.exitFullscreenMode()', () => {
            it('should issue a exit_fullscreen_mode action', () => {
                const action = library.api.player.exitFullscreenMode();
                expect(action).toEqual(exitFullscreen());
                expect(context.actions).toEqual([exitFullscreen()]);
            });
        });

        describe('player.showHtml()', () => {
            it('should issue a show_html action', () => {
                const action = library.api.player.showHtml('hello, world!');
                expect(action).toEqual(html('hello, world!'));
                expect(context.actions).toEqual([html('hello, world!')]);
            });
        });

        describe('player.hideHtml()', () => {
            it('should issue a hide_html action', () => {
                const action = library.api.player.hideHtml();
                expect(action).toEqual(hideHtml());
                expect(context.actions).toEqual([hideHtml()]);
            });
        });

        describe('player.setClipboard()', () => {
            it('should emit a SetClipboardEvent', () => {
                const action = library.api.player.setClipboard('test');
                expect(action).toEqual(setClipboard('test'));
                expect(context.actions).toEqual([setClipboard('test')]);
            });
        });

        describe('player.tweenTo()', () => {
            it('should emit a TweenToAction', () => {
                const action = library.api.player.tweenTo('test');
                expect(action).toEqual(tweenTo('test'));
                expect(context.actions).toEqual([tweenTo('test')]);
            });

            it('should handle bots', () => {
                const action = library.api.player.tweenTo(bot1);
                expect(action).toEqual(tweenTo(bot1.id));
                expect(context.actions).toEqual([tweenTo(bot1.id)]);
            });

            it('should support specifying a duration', () => {
                const action = library.api.player.tweenTo(
                    'test',
                    undefined,
                    undefined,
                    undefined,
                    10
                );
                expect(action).toEqual(
                    tweenTo('test', undefined, undefined, undefined, 10)
                );
                expect(context.actions).toEqual([
                    tweenTo('test', undefined, undefined, undefined, 10),
                ]);
            });
        });

        describe('player.moveTo()', () => {
            it('should emit a TweenToAction with the duration set to 0', () => {
                const action = library.api.player.moveTo('test');
                expect(action).toEqual({
                    type: 'tween_to',
                    botId: 'test',
                    zoomValue: null,
                    rotationValue: null,
                    duration: 0,
                });
                expect(context.actions).toEqual([
                    {
                        type: 'tween_to',
                        botId: 'test',
                        zoomValue: null,
                        rotationValue: null,
                        duration: 0,
                    },
                ]);
            });
        });

        describe('player.showChat()', () => {
            it('should emit a ShowChatBarAction', () => {
                const action = library.api.player.showChat();
                expect(action).toEqual(showChat());
                expect(context.actions).toEqual([showChat()]);
            });

            it('should emit a ShowChatBarAction with the given prefill', () => {
                const action = library.api.player.showChat('test');
                expect(action).toEqual(
                    showChat({
                        placeholder: 'test',
                    })
                );
                expect(context.actions).toEqual([
                    showChat({
                        placeholder: 'test',
                    }),
                ]);
            });

            it('should emit a ShowChatBarAction with the given options', () => {
                const action = library.api.player.showChat({
                    placeholder: 'abc',
                    prefill: 'def',
                });
                expect(action).toEqual(
                    showChat({
                        placeholder: 'abc',
                        prefill: 'def',
                    })
                );
                expect(context.actions).toEqual([
                    showChat({
                        placeholder: 'abc',
                        prefill: 'def',
                    }),
                ]);
            });
        });

        describe('player.hideChat()', () => {
            it('should emit a ShowChatBarAction', () => {
                const action = library.api.player.hideChat();
                expect(action).toEqual(hideChat());
                expect(context.actions).toEqual([hideChat()]);
            });
        });

        describe('player.run()', () => {
            it('should emit a RunScriptAction', () => {
                const action = library.api.player.run('abc');
                expect(action).toEqual(runScript('abc'));
                expect(context.actions).toEqual([runScript('abc')]);
            });
        });

        describe('player.version()', () => {
            it('should return an object with version information', () => {
                const v = library.api.player.version();
                expect(v).toEqual(version);
            });
        });

        describe('player.device()', () => {
            it('should return an object with device information', () => {
                const d = library.api.player.device();
                expect(d).toEqual(device);
            });

            it('should return info with null values if not specified', () => {
                context.device = null;
                const d = library.api.player.device();
                expect(d).toEqual({
                    supportsAR: null,
                    supportsVR: null,
                });
            });
        });

        describe('player.enableAR()', () => {
            it('should issue an EnableARAction', () => {
                const action = library.api.player.enableAR();
                expect(action).toEqual(enableAR());
                expect(context.actions).toEqual([enableAR()]);
            });
        });

        describe('player.disableAR()', () => {
            it('should issue an EnableVRAction', () => {
                const action = library.api.player.disableAR();
                expect(action).toEqual(disableAR());
                expect(context.actions).toEqual([disableAR()]);
            });
        });

        describe('player.enableVR()', () => {
            it('should issue an EnableVRAction', () => {
                const action = library.api.player.enableVR();
                expect(action).toEqual(enableVR());
                expect(context.actions).toEqual([enableVR()]);
            });
        });

        describe('player.disableVR()', () => {
            it('should issue an EnableVRAction', () => {
                const action = library.api.player.disableVR();
                expect(action).toEqual(disableVR());
                expect(context.actions).toEqual([disableVR()]);
            });
        });

        describe('player.downloadBots()', () => {
            it('should emit a DownloadAction with the given bots formatted as JSON', () => {
                const action = library.api.player.downloadBots(
                    [bot1, bot2],
                    'test'
                );
                const expected = download(
                    JSON.stringify({
                        version: 1,
                        state: {
                            [bot1.id]: bot1,
                            [bot2.id]: bot2,
                        },
                    }),
                    'test.aux',
                    'application/json'
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support specifying the .aux extension manually', () => {
                const action = library.api.player.downloadBots(
                    [bot1, bot2],
                    'test.aux'
                );
                const expected = download(
                    JSON.stringify({
                        version: 1,
                        state: {
                            [bot1.id]: bot1,
                            [bot2.id]: bot2,
                        },
                    }),
                    'test.aux',
                    'application/json'
                );
            });
        });

        describe('player.showUploadAuxFile()', () => {
            it('should emit a showUploadAuxFileAction', () => {
                const action = library.api.player.showUploadAuxFile();
                expect(action).toEqual(showUploadAuxFile());
                expect(context.actions).toEqual([showUploadAuxFile()]);
            });
        });
    });
});
