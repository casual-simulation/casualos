import { AuxLibrary, createDefaultLibrary } from './AuxLibrary';
import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
} from './AuxGlobalContext';
import {
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
    openQRCodeScanner,
    showQRCode,
    openBarcodeScanner,
    showBarcode,
    loadSimulation,
    unloadSimulation,
    importAUX,
    addState,
    BotsState,
    showInputForTag,
    KNOWN_PORTALS,
    replaceDragBot,
    createBot,
    goToDimension,
    goToURL,
    openURL,
    openConsole,
    checkout,
    playSound,
    setupUniverse,
    shell,
    backupToGithub,
    backupAsDownload,
    finishCheckout,
    markHistory,
    browseHistory,
    restoreHistoryMark,
    loadFile,
    saveFile,
    reject,
    ORIGINAL_OBJECT,
    webhook,
    superShout,
    botRemoved,
    botAdded,
    clearSpace,
    loadBots,
    localFormAnimation,
    showInput,
    share,
} from '../bots';
import { types } from 'util';
import {
    possibleTagNameCases,
    possibleTagValueCases,
} from '../bots/test/BotTestHelpers';
import { remote } from '@casual-simulation/causal-trees';
import uuid from 'uuid/v4';
import {
    TestScriptBotFactory,
    createDummyRuntimeBot,
} from './test/TestScriptBotFactory';
import { RuntimeBot } from './RuntimeBot';
import { AuxVersion } from './AuxVersion';
import { AuxDevice } from './AuxDevice';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

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
        context = new MemoryGlobalContext(
            version,
            device,
            new TestScriptBotFactory()
        );
        library = createDefaultLibrary(context);
    });

    const falsyCases = [['false', false], ['0', 0]];
    const emptyCases = [['null', null], ['empty string', '']];
    const numberCases = [['0', 0], ['1', 1], ['true', true], ['false', false]];
    const trimEventCases = [
        ['parenthesis', 'sayHello()'],
        ['hashtag', '#sayHello'],
        ['hashtag and parenthesis', '#sayHello()'],
        ['@ symbol', '@sayHello'],
        ['@ symbol and parenthesis', '@sayHello()'],
    ];

    describe('getBots()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;
        let bot3: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');
            bot3 = createDummyRuntimeBot('test3');

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
                (b: RuntimeBot) => b.tags.hello === false,
                (b: RuntimeBot) => b.tags.num > 50
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

            let filter = (b: RuntimeBot) => {
                return b.tags.hello === false;
            };
            (<any>filter).sort = (b: RuntimeBot) => b.tags.num;

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
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;
        let bot3: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');
            bot3 = createDummyRuntimeBot('test3');

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
                (b: RuntimeBot) => b.tags.name === 'bob'
            );

            expect(bot).toEqual(bot1);
        });

        it('should return the first bot bot matching all the given filter functions', () => {
            bot1.tags.name = 'bob';
            bot2.tags.name = 'alice';
            bot3.tags.name = 'bob';
            bot3.tags.abc = true;

            const bot = library.api.getBot(
                (b: RuntimeBot) => b.tags.name === 'bob',
                (b: RuntimeBot) => b.tags.abc === true
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

    describe('filters', () => {
        describe('byTag()', () => {
            let bot1: RuntimeBot;

            beforeEach(() => {
                bot1 = createDummyRuntimeBot('test1');

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
            let bot1: RuntimeBot;

            beforeEach(() => {
                bot1 = createDummyRuntimeBot('test1');

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
            let bot1: RuntimeBot;

            beforeEach(() => {
                bot1 = createDummyRuntimeBot('test1');

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
            let bot1: RuntimeBot;

            beforeEach(() => {
                bot1 = createDummyRuntimeBot('test1');

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
            let bot1: RuntimeBot;
            let bot2: RuntimeBot;

            beforeEach(() => {
                bot1 = createDummyRuntimeBot('test1');
                bot2 = createDummyRuntimeBot('test2');

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
            let bot1: RuntimeBot;
            let bot2: RuntimeBot;

            beforeEach(() => {
                bot1 = createDummyRuntimeBot('test1');
                bot2 = createDummyRuntimeBot('test2');

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
                    const filter = library.api.neighboring(
                        bot1,
                        'red',
                        direction
                    );

                    bot2.tags.red = true;
                    bot2.tags.redX = x;
                    bot2.tags.redY = y;

                    expect(filter(bot2)).toEqual(true);
                });

                it('should return a function that returns false if the given bot is not at the correct position', () => {
                    bot1.tags.red = true;
                    bot1.tags.redX = 0;
                    bot1.tags.redY = 0;
                    const filter = library.api.neighboring(
                        bot1,
                        'red',
                        direction
                    );

                    bot2.tags.red = true;
                    bot2.tags.redX = -x;
                    bot2.tags.redY = -y;

                    expect(filter(bot2)).toEqual(false);
                });

                it('should return a function with a sort function that sorts the bots by their sort order', () => {
                    bot1.tags.red = true;
                    bot1.tags.redX = 0;
                    bot1.tags.redY = 0;
                    const filter = library.api.neighboring(
                        bot1,
                        'red',
                        direction
                    );

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
            let bot1: RuntimeBot;

            beforeEach(() => {
                bot1 = createDummyRuntimeBot('test1', undefined, <any>'test');

                addToContext(context, bot1);
            });

            it('should return a function that returns true if the bot is in given space', () => {
                const filter = library.api.bySpace(<any>'test');
                expect(filter(bot1)).toEqual(true);
            });
        });

        describe('byCreator()', () => {
            let bot1: RuntimeBot;
            let bot2: RuntimeBot;

            beforeEach(() => {
                bot1 = createDummyRuntimeBot('test1');
                bot2 = createDummyRuntimeBot('test2');

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
            let bot1: RuntimeBot;

            beforeEach(() => {
                bot1 = createDummyRuntimeBot('test1');

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
            let bot1: RuntimeBot;
            let bot2: RuntimeBot;

            beforeEach(() => {
                bot1 = createDummyRuntimeBot('test1');
                bot2 = createDummyRuntimeBot('test2');

                addToContext(context, bot1, bot2);
            });

            it('should return a function which negates the given function results', () => {
                const filter = library.api.not(b => b.id === 'test1');

                expect(filter(bot1)).toEqual(false);
                expect(filter(bot2)).toEqual(true);
            });
        });
    });

    describe('getID()', () => {
        let bot1: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');

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
        let bot1: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');

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
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;
        let bot3: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');
            bot3 = createDummyRuntimeBot('test3');

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
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;
        let bot3: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');
            bot3 = createDummyRuntimeBot('test3');

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

    describe('getMod()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);
        });

        it('should create a diff that applies the given tags from the given bot', () => {
            bot1.tags.val = true;
            bot1.tags.testA = 'abc';
            bot1.tags.testB = 123;
            bot1.tags.missing = false;

            const mod = library.api.getMod(bot1, 'val', /test.+/);
            expect(mod).toEqual({
                val: true,
                testA: 'abc',
                testB: 123,
            });
        });

        it('should create a diff with all tags if no filters are given', () => {
            bot1.tags.val = true;
            bot1.tags.testA = 'abc';
            bot1.tags.testB = 123;
            bot1.tags.missing = false;

            const mod = library.api.getMod(bot1);
            expect(mod).toEqual({
                val: true,
                testA: 'abc',
                testB: 123,
                missing: false,
            });
        });

        it('should create a diff from another diff', () => {
            const mod = library.api.getMod(
                {
                    abc: true,
                    val: 123,
                },
                'val'
            );
            expect(mod).toEqual({
                val: 123,
            });
        });

        it('should create a diff from JSON', () => {
            const mod = library.api.getMod(
                JSON.stringify({
                    abc: true,
                    val: 123,
                }),
                'val'
            );
            expect(mod).toEqual({
                val: 123,
            });
        });
    });

    describe('actions', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

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

        describe('player.downloadUniverse()', () => {
            let bot3: RuntimeBot;
            let player: RuntimeBot;

            beforeEach(() => {
                bot3 = createDummyRuntimeBot('test3');
                player = createDummyRuntimeBot(
                    'player',
                    {
                        auxUniverse: 'channel',
                    },
                    'tempLocal'
                );
                addToContext(context, bot3, player);
                context.playerBot = player;
            });

            it('should emit a DownloadAction with the current state and universe name', () => {
                const action = library.api.player.downloadUniverse();
                const expected = download(
                    JSON.stringify({
                        version: 1,
                        state: {
                            [bot1.id]: bot1,
                            [bot2.id]: bot2,
                            [bot3.id]: bot3,
                        },
                    }),
                    'channel.aux',
                    'application/json'
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should only include bots in the shared space', () => {
                const bot4 = createDummyRuntimeBot('test4', {}, 'history');
                const bot5 = createDummyRuntimeBot('test5', {}, 'local');
                const bot6 = createDummyRuntimeBot('test6', {}, 'tempLocal');
                const bot7 = createDummyRuntimeBot('test7', {}, 'error');
                addToContext(context, bot4, bot5, bot6, bot7);

                const action = library.api.player.downloadUniverse();
                const expected = download(
                    JSON.stringify({
                        version: 1,
                        state: {
                            [bot1.id]: bot1,
                            [bot2.id]: bot2,
                            [bot3.id]: bot3,
                        },
                    }),
                    'channel.aux',
                    'application/json'
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('player.showUploadAuxFile()', () => {
            it('should emit a showUploadAuxFileAction', () => {
                const action = library.api.player.showUploadAuxFile();
                expect(action).toEqual(showUploadAuxFile());
                expect(context.actions).toEqual([showUploadAuxFile()]);
            });
        });

        describe('player.openQRCodeScanner()', () => {
            it('should emit a OpenQRCodeScannerAction', () => {
                const action = library.api.player.openQRCodeScanner();
                expect(action).toEqual(openQRCodeScanner(true));
                expect(context.actions).toEqual([openQRCodeScanner(true)]);
            });

            it('should use the given camera type', () => {
                const action = library.api.player.openQRCodeScanner('front');
                expect(action).toEqual(openQRCodeScanner(true, 'front'));
                expect(context.actions).toEqual([
                    openQRCodeScanner(true, 'front'),
                ]);
            });
        });

        describe('player.closeQRCodeScanner()', () => {
            it('should emit a OpenQRCodeScannerAction', () => {
                const action = library.api.player.closeQRCodeScanner();
                expect(action).toEqual(openQRCodeScanner(false));
                expect(context.actions).toEqual([openQRCodeScanner(false)]);
            });
        });

        describe('player.showQRCode()', () => {
            it('should emit a ShowQRCodeAction', () => {
                const action = library.api.player.showQRCode('abc');
                expect(action).toEqual(showQRCode(true, 'abc'));
                expect(context.actions).toEqual([showQRCode(true, 'abc')]);
            });
        });

        describe('player.hideQRCode()', () => {
            it('should emit a ShowQRCodeAction', () => {
                const action = library.api.player.hideQRCode();
                expect(action).toEqual(showQRCode(false));
                expect(context.actions).toEqual([showQRCode(false)]);
            });
        });

        describe('player.openBarcodeScanner()', () => {
            it('should emit a OpenBarcodeScannerAction', () => {
                const action = library.api.player.openBarcodeScanner();
                expect(action).toEqual(openBarcodeScanner(true));
                expect(context.actions).toEqual([openBarcodeScanner(true)]);
            });

            it('should use the given camera type', () => {
                const action = library.api.player.openBarcodeScanner('front');
                expect(action).toEqual(openBarcodeScanner(true, 'front'));
                expect(context.actions).toEqual([
                    openBarcodeScanner(true, 'front'),
                ]);
            });
        });

        describe('player.closeBarcodeScanner()', () => {
            it('should emit a OpenBarcodeScannerAction', () => {
                const action = library.api.player.closeBarcodeScanner();
                expect(action).toEqual(openBarcodeScanner(false));
                expect(context.actions).toEqual([openBarcodeScanner(false)]);
            });
        });

        describe('player.showBarcode()', () => {
            it('should emit a ShowBarcodeAction', () => {
                const action = library.api.player.showBarcode('hello');
                expect(action).toEqual(showBarcode(true, 'hello'));
                expect(context.actions).toEqual([showBarcode(true, 'hello')]);
            });

            it('should include the given format', () => {
                const action = library.api.player.showBarcode('hello', <any>(
                    'format'
                ));
                expect(action).toEqual(
                    showBarcode(true, 'hello', <any>'format')
                );
                expect(context.actions).toEqual([
                    showBarcode(true, 'hello', <any>'format'),
                ]);
            });
        });

        describe('player.hideBarcode()', () => {
            it('should emit a ShowBarcodeAction', () => {
                const action = library.api.player.hideBarcode();
                expect(action).toEqual(showBarcode(false));
                expect(context.actions).toEqual([showBarcode(false)]);
            });
        });

        describe('player.loadUniverse()', () => {
            it('should emit a LoadUniverseAction', () => {
                const action = library.api.player.loadUniverse('abc');
                expect(action).toEqual(loadSimulation('abc'));
                expect(context.actions).toEqual([loadSimulation('abc')]);
            });
        });

        describe('player.unloadUniverse()', () => {
            it('should emit a UnloadUniverseAction', () => {
                const action = library.api.player.unloadUniverse('abc');
                expect(action).toEqual(unloadSimulation('abc'));
                expect(context.actions).toEqual([unloadSimulation('abc')]);
            });
        });

        describe('player.importAUX()', () => {
            it('should emit a ImportAUXEvent', () => {
                const action = library.api.player.importAUX('abc');
                expect(action).toEqual(importAUX('abc'));
                expect(context.actions).toEqual([importAUX('abc')]);
            });

            it('should emit a AddStateEvent if given JSON', () => {
                const uploadState: BotsState = {
                    uploadBot: {
                        id: 'uploadBot',
                        tags: {
                            abc: 'def',
                        },
                    },
                };
                const json = JSON.stringify({
                    version: 1,
                    state: uploadState,
                });
                const action = library.api.player.importAUX(json);
                expect(action).toEqual(addState(uploadState));
                expect(context.actions).toEqual([addState(uploadState)]);
            });
        });

        describe('player.replaceDragBot()', () => {
            it('should send a replace_drag_bot event', () => {
                const action = library.api.player.replaceDragBot(bot1);
                expect(action).toEqual(
                    replaceDragBot({
                        id: bot1.id,
                        tags: bot1.tags,
                        space: bot1.space,
                    })
                );
                expect(context.actions).toEqual([
                    replaceDragBot({
                        id: bot1.id,
                        tags: bot1.tags,
                        space: bot1.space,
                    }),
                ]);
            });

            it('should return a copiable bot', () => {
                const action = library.api.player.replaceDragBot(bot1);
                const bot = action.bot as any;
                expect(bot).not.toBe(bot1);
                for (let key in bot) {
                    expect(types.isProxy(bot[key])).toBe(false);
                }
            });
        });

        describe('player.getBot()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should get the current users bot', () => {
                const bot = library.api.player.getBot();
                expect(bot).toBe(player);
            });
        });

        describe('player.isInDimension()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot(
                    'player',
                    {
                        auxUniverse: 'channel',
                    },
                    'tempLocal'
                );
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return true when auxPagePortal equals the given value', () => {
                player.tags.auxPagePortal = 'dimension';
                const result = library.api.player.isInDimension('dimension');
                expect(result).toEqual(true);
            });

            it('should return false when auxPagePortal does not equal the given value', () => {
                player.tags.auxPagePortal = 'dimension';
                const result = library.api.player.isInDimension('abc');
                expect(result).toEqual(false);
            });

            it('should return false when auxPagePortal is not set', () => {
                const result = library.api.player.isInDimension('dimension');
                expect(result).toEqual(false);
            });

            it.each(numberCases)(
                'should support "%s" when given %s',
                (expected, given) => {
                    player.tags.auxPagePortal = given;
                    const result = library.api.player.isInDimension(expected);
                    expect(result).toEqual(true);
                }
            );
        });

        describe('player.getCurrentDimension()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot(
                    'player',
                    {
                        auxUniverse: 'channel',
                    },
                    'tempLocal'
                );
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return auxPagePortal', () => {
                player.tags.auxPagePortal = 'dimension';
                const result = library.api.player.getCurrentDimension();
                expect(result).toEqual('dimension');
            });

            it('should return undefined when auxPagePortal is not set', () => {
                const result = library.api.player.getCurrentDimension();
                expect(result).toBeUndefined();
            });

            it.each(numberCases)(
                'should return "%s" when given %s',
                (expected, given) => {
                    player.tags.auxPagePortal = given;
                    const result = library.api.player.getCurrentDimension();
                    expect(result).toEqual(expected);
                }
            );
        });

        describe('player.getCurrentUniverse()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return auxUniverse', () => {
                player.tags.auxUniverse = 'universe';
                const result = library.api.player.getCurrentUniverse();
                expect(result).toEqual('universe');
            });

            it('should return undefined when auxUniverse is not set', () => {
                const result = library.api.player.getCurrentUniverse();
                expect(result).toBeUndefined();
            });

            it.each(numberCases)(
                'should return "%s" when given %s',
                (expected, given) => {
                    player.tags.auxUniverse = given;
                    const result = library.api.player.getCurrentUniverse();
                    expect(result).toEqual(expected);
                }
            );
        });

        describe('player.getInventoryDimension()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return the auxInventoryPortal tag from the user bot', () => {
                player.tags.auxInventoryPortal = 'abc';
                const result = library.api.player.getInventoryDimension();
                expect(result).toEqual('abc');
            });

            it.each(numberCases)(
                'should return "%s" when given %s',
                (expected, given) => {
                    player.tags.auxInventoryPortal = given;
                    const result = library.api.player.getInventoryDimension();
                    expect(result).toEqual(expected);
                }
            );
        });

        describe('player.getMenuDimension()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return the auxMenuPortal tag from the user bot', () => {
                player.tags.auxMenuPortal = 'abc';
                const result = library.api.player.getMenuDimension();
                expect(result).toEqual('abc');
            });

            it.each(numberCases)(
                'should return "%s" when given %s',
                (expected, given) => {
                    player.tags.auxMenuPortal = given;
                    const result = library.api.player.getMenuDimension();
                    expect(result).toEqual(expected);
                }
            );
        });

        describe('player.getPortalDimension()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            const cases = [
                ['page', 'pageDimension'],
                ['auxPagePortal', 'pageDimension'],
                ['inventory', 'inventoryDimension'],
                ['auxInventoryPortal', 'inventoryDimension'],
                ['menu', 'menuDimension'],
                ['auxMenuPortal', 'menuDimension'],
                ['sheet', 'sheetDimension'],
                ['auxSheetPortal', 'sheetDimension'],
                ['missing', null],
                ['falsy', null],
            ];

            describe.each(cases)('%s', (portal, expectedDimension) => {
                it(`should get the dimension for the ${portal} portal`, () => {
                    player.tags.auxPagePortal = 'pageDimension';
                    player.tags.auxInventoryPortal = 'inventoryDimension';
                    player.tags.auxMenuPortal = 'menuDimension';
                    player.tags.auxSheetPortal = 'sheetDimension';
                    player.tags.falsy = false;
                    player.tags.number = 0;
                    const result = library.api.player.getPortalDimension(
                        portal
                    );
                    expect(result).toEqual(expectedDimension);
                });

                it.each(numberCases)(
                    'should return "%s" when given %s',
                    (expected, given) => {
                        player.tags.auxPagePortal = given;
                        player.tags.auxInventoryPortal = given;
                        player.tags.auxMenuPortal = given;
                        player.tags.auxSheetPortal = given;
                        player.tags.falsy = false;
                        player.tags.number = 0;
                        const result = library.api.player.getPortalDimension(
                            portal
                        );

                        if (expectedDimension) {
                            expect(result).toEqual(expected);
                        } else {
                            expect(result).toEqual(null);
                        }
                    }
                );
            });
        });

        describe('player.getDimensionalDepth()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return 0 when the bot is in the given dimension', () => {
                player.tags.dimension = true;
                const result = library.api.player.getDimensionalDepth(
                    'dimension'
                );
                expect(result).toEqual(0);
            });

            const portalCases = [...KNOWN_PORTALS.map(p => [p])];

            it.each(portalCases)(
                'should return 1 when the dimension is in the %s portal',
                portal => {
                    player.tags[portal] = 'dimension';
                    const result = library.api.player.getDimensionalDepth(
                        'dimension'
                    );
                    expect(result).toEqual(1);
                }
            );

            it('should return -1 otherwise', () => {
                const result = library.api.player.getDimensionalDepth(
                    'dimension'
                );
                expect(result).toEqual(-1);
            });
        });

        describe('player.showInputForTag()', () => {
            it('should emit a ShowInputForTagAction', () => {
                const action = library.api.player.showInputForTag(bot1, 'abc');
                expect(action).toEqual(showInputForTag(bot1.id, 'abc'));
                expect(context.actions).toEqual([
                    showInputForTag(bot1.id, 'abc'),
                ]);
            });

            it('should support passing a bot ID', () => {
                const action = library.api.player.showInputForTag(
                    'test',
                    'abc'
                );
                expect(action).toEqual(showInputForTag('test', 'abc'));
                expect(context.actions).toEqual([
                    showInputForTag('test', 'abc'),
                ]);
            });

            it('should trim the first hash from the tag', () => {
                const first = library.api.player.showInputForTag(
                    'test',
                    '##abc'
                );
                expect(first).toEqual(showInputForTag('test', '#abc'));
                const second = library.api.player.showInputForTag(
                    'test',
                    '#abc'
                );
                expect(second).toEqual(showInputForTag('test', 'abc'));
                expect(context.actions).toEqual([
                    showInputForTag('test', '#abc'),
                    showInputForTag('test', 'abc'),
                ]);
            });

            it('should support extra options', () => {
                const action = library.api.player.showInputForTag(
                    'test',
                    'abc',
                    {
                        backgroundColor: 'red',
                        foregroundColor: 'green',
                    }
                );
                expect(action).toEqual(
                    showInputForTag('test', 'abc', {
                        backgroundColor: 'red',
                        foregroundColor: 'green',
                    })
                );
                expect(context.actions).toEqual([
                    showInputForTag('test', 'abc', {
                        backgroundColor: 'red',
                        foregroundColor: 'green',
                    }),
                ]);
            });
        });

        describe('player.showInput()', () => {
            it('should emit a ShowInputAction', () => {
                const promise: any = library.api.player.showInput();
                const expected = showInput(
                    undefined,
                    undefined,
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support passing the current value', () => {
                const promise: any = library.api.player.showInput('abc');
                const expected = showInput(
                    'abc',
                    undefined,
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support passing extra options', () => {
                const promise: any = library.api.player.showInput('abc', {
                    backgroundColor: 'red',
                    foregroundColor: 'green',
                });
                const expected = showInput(
                    'abc',
                    {
                        backgroundColor: 'red',
                        foregroundColor: 'green',
                    },
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('player.goToDimension()', () => {
            it('should issue a GoToDimension event', () => {
                const action = library.api.player.goToDimension('abc');
                expect(action).toEqual(goToDimension('abc'));
                expect(context.actions).toEqual([goToDimension('abc')]);
            });

            it('should ignore extra parameters', () => {
                const action = (<any>library.api.player.goToDimension)(
                    'abc',
                    'def'
                );
                expect(action).toEqual(goToDimension('abc'));
                expect(context.actions).toEqual([goToDimension('abc')]);
            });
        });

        describe('player.goToURL()', () => {
            it('should issue a GoToURL event', () => {
                const action = library.api.player.goToURL('abc');
                expect(action).toEqual(goToURL('abc'));
                expect(context.actions).toEqual([goToURL('abc')]);
            });
        });

        describe('player.openURL()', () => {
            it('should issue a OpenURL event', () => {
                const action = library.api.player.openURL('abc');
                expect(action).toEqual(openURL('abc'));
                expect(context.actions).toEqual([openURL('abc')]);
            });
        });

        describe('player.openDevConsole()', () => {
            it('should issue a OpenConsole event', () => {
                const action = library.api.player.openDevConsole();
                expect(action).toEqual(openConsole());
                expect(context.actions).toEqual([openConsole()]);
            });
        });

        describe('player.checkout()', () => {
            it('should emit a start checkout event', () => {
                const action = library.api.player.checkout({
                    publishableKey: 'key',
                    productId: 'ID1',
                    title: 'Product 1',
                    description: '$50.43',
                    processingUniverse: 'channel2',
                });
                const expected = checkout({
                    publishableKey: 'key',
                    productId: 'ID1',
                    title: 'Product 1',
                    description: '$50.43',
                    processingUniverse: 'channel2',
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('player.playSound()', () => {
            it('should emit a PlaySoundEvent', () => {
                const action = library.api.player.playSound('abc');
                expect(action).toEqual(playSound('abc'));
                expect(context.actions).toEqual([playSound('abc')]);
            });
        });

        describe('player.hasBotInInventory()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return true if the given bot is in the users inventory dimension', () => {
                player.tags.auxInventoryPortal = 'abc';
                bot1.tags.abc = true;
                const result = library.api.player.hasBotInInventory(bot1);
                expect(result).toEqual(true);
            });

            it('should return true if all the given bots are in the users inventory dimension', () => {
                player.tags.auxInventoryPortal = 'abc';
                bot1.tags.abc = true;
                bot2.tags.abc = true;
                const result = library.api.player.hasBotInInventory([
                    bot1,
                    bot2,
                ]);
                expect(result).toEqual(true);
            });

            it('should return false if one of the given bots are not in the users inventory dimension', () => {
                player.tags.auxInventoryPortal = 'abc';
                bot1.tags.abc = false;
                bot2.tags.abc = true;
                const result = library.api.player.hasBotInInventory([
                    bot1,
                    bot2,
                ]);
                expect(result).toEqual(false);
            });

            it('should return false if the player does not have an inventory', () => {
                bot1.tags.abc = true;
                bot2.tags.abc = true;
                const result = library.api.player.hasBotInInventory([
                    bot1,
                    bot2,
                ]);
                expect(result).toEqual(false);
            });
        });

        describe('player.share()', () => {
            it('should return a ShareAction', () => {
                const promise: any = library.api.player.share({
                    url: 'http://example.com',
                    title: 'Example',
                });
                const expected = share(
                    {
                        url: 'http://example.com',
                        title: 'Example',
                    },
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.setupUniverse()', () => {
            it('should send a SetupChannelAction in a RemoteAction', () => {
                bot1.tags.abc = true;
                const action = library.api.server.setupUniverse(
                    'channel',
                    bot1
                );
                const expected = remote(
                    setupUniverse('channel', createBot(bot1.id, bot1.tags))
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.shell()', () => {
            it('should emit a remote shell event', () => {
                const action = library.api.server.shell('abc');
                expect(action).toEqual(remote(shell('abc')));
                expect(context.actions).toEqual([remote(shell('abc'))]);
            });
        });

        describe('server.backupToGithub()', () => {
            it('should emit a remote backup to github event', () => {
                const action = library.api.server.backupToGithub('abc');
                expect(action).toEqual(remote(backupToGithub('abc')));
                expect(context.actions).toEqual([
                    remote(backupToGithub('abc')),
                ]);
            });
        });

        describe('server.backupAsDownload()', () => {
            it('should emit a remote backup as download event', () => {
                const action = library.api.server.backupAsDownload({
                    username: 'abc',
                    device: '123',
                    session: 'def',
                });
                const expected = remote(
                    backupAsDownload({
                        username: 'abc',
                        deviceId: '123',
                        sessionId: 'def',
                    })
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.finishCheckout()', () => {
            it('should emit a finish checkout event', () => {
                const action = library.api.server.finishCheckout({
                    secretKey: 'key',
                    token: 'token1',
                    description: 'Test',
                    amount: 100,
                    currency: 'usd',
                });
                const expected = finishCheckout(
                    'key',
                    'token1',
                    100,
                    'usd',
                    'Test'
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should include extra info', () => {
                const action = library.api.server.finishCheckout({
                    secretKey: 'key',
                    token: 'token1',
                    description: 'Test',
                    amount: 100,
                    currency: 'usd',
                    extra: {
                        abc: 'def',
                    },
                });
                const expected = finishCheckout(
                    'key',
                    'token1',
                    100,
                    'usd',
                    'Test',
                    {
                        abc: 'def',
                    }
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.markHistory()', () => {
            it('should emit a mark_history event', () => {
                const action = library.api.server.markHistory({
                    message: 'testMark',
                });
                const expected = remote(
                    markHistory({
                        message: 'testMark',
                    }),
                    undefined,
                    false
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.browseHistory()', () => {
            it('should emit a browse_history event', () => {
                const action = library.api.server.browseHistory();
                const expected = remote(browseHistory());
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.restoreHistoryMark()', () => {
            it('should emit a restore_history_mark event', () => {
                const action = library.api.server.restoreHistoryMark('mark');
                const expected = remote(restoreHistoryMark('mark'));
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.restoreHistoryMarkToUniverse()', () => {
            it('should emit a restore_history_mark event', () => {
                const action = library.api.server.restoreHistoryMarkToUniverse(
                    'mark',
                    'universe'
                );
                const expected = remote(restoreHistoryMark('mark', 'universe'));
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.loadFile()', () => {
            it('should issue a LoadFileAction in a remote event', () => {
                const action = library.api.server.loadFile('path');
                const expected = remote(
                    loadFile({
                        path: 'path',
                    })
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.saveFile()', () => {
            it('should issue a SaveFileAction in a remote event', () => {
                const action = library.api.server.saveFile('path', 'data');
                const expected = remote(
                    saveFile({
                        path: 'path',
                        data: 'data',
                    })
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.destroyErrors()', () => {
            it('should issue a ClearSpaceAction', () => {
                const action = library.api.server.destroyErrors();
                const expected = clearSpace('error');
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.loadErrors()', () => {
            it('should issue a LoadBotsAction for the given tag and bot ID', () => {
                const action = library.api.server.loadErrors('test', 'abc');
                const expected = loadBots('error', [
                    {
                        tag: 'auxError',
                        value: true,
                    },
                    {
                        tag: 'auxErrorBot',
                        value: 'test',
                    },
                    {
                        tag: 'auxErrorTag',
                        value: 'abc',
                    },
                ]);
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support being passed a runtime bot', () => {
                const action = library.api.server.loadErrors(bot1, 'abc');
                const expected = loadBots('error', [
                    {
                        tag: 'auxError',
                        value: true,
                    },
                    {
                        tag: 'auxErrorBot',
                        value: bot1.id,
                    },
                    {
                        tag: 'auxErrorTag',
                        value: 'abc',
                    },
                ]);
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('remote()', () => {
            it('should replace the original event in the queue', () => {
                const action = library.api.remote(
                    library.api.player.toast('abc')
                );
                library.api.player.showChat();
                expect(action).toEqual(remote(toast('abc')));
                expect(context.actions).toEqual([
                    remote(toast('abc')),
                    showChat(),
                ]);
            });

            it('should send the right selector', () => {
                const action = library.api.remote(
                    library.api.player.toast('abc'),
                    {
                        session: 's',
                        username: 'u',
                        device: 'd',
                    }
                );
                const expected = remote(toast('abc'), {
                    sessionId: 's',
                    username: 'u',
                    deviceId: 'd',
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('webhook()', () => {
            it('should emit a SendWebhookAction', () => {
                const action = library.api.webhook({
                    method: 'POST',
                    url: 'https://example.com',
                    data: {
                        test: 'abc',
                    },
                    responseShout: 'test.response()',
                });
                const expected = webhook({
                    method: 'POST',
                    url: 'https://example.com',
                    data: {
                        test: 'abc',
                    },
                    responseShout: 'test.response()',
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('webhook.post()', () => {
            it('should emit a SendWebhookAction', () => {
                const action = library.api.webhook.post(
                    'https://example.com',
                    { test: 'abc' },
                    {
                        responseShout: 'test.response()',
                    }
                );
                const expected = webhook({
                    method: 'POST',
                    url: 'https://example.com',
                    data: {
                        test: 'abc',
                    },
                    responseShout: 'test.response()',
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('action.perform()', () => {
            it('should add the given event to the list', () => {
                const action = library.api.action.perform({
                    type: 'test',
                    message: 'abc',
                });
                const expected = {
                    type: 'test',
                    message: 'abc',
                };
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should add the action even if it is already going to be performed', () => {
                const action = library.api.action.perform(
                    library.api.player.toast('abc')
                );
                const expected = toast('abc');
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected, expected]);
            });

            it('should should add the action if it has been rejected', () => {
                const action = library.api.player.toast('abc');
                library.api.action.reject(action);
                library.api.action.perform(action);
                expect(context.actions).toEqual([
                    toast('abc'),
                    reject(toast('abc')),
                    toast('abc'),
                ]);
            });
        });

        describe('action.reject()', () => {
            it('should emit a reject action', () => {
                const action = library.api.action.reject({
                    type: 'test',
                    message: 'abc',
                });
                const expected = reject(<any>{
                    type: 'test',
                    message: 'abc',
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should resolve the original action', () => {
                const original = toast('abc');
                const action = library.api.action.reject({
                    type: 'show_toast',
                    message: 'abc',
                    [ORIGINAL_OBJECT]: original,
                });
                const expected = reject(original);
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
                expect(action.action).toBe(original);
            });
        });

        describe('experiment.localFormAnimation()', () => {
            it('should emit a LocalFormAnimationAction', () => {
                const action = library.api.experiment.localFormAnimation(
                    bot1,
                    'test'
                );
                const expected = localFormAnimation(bot1.id, 'test');
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support passing a bot ID directly', () => {
                const action = library.api.experiment.localFormAnimation(
                    'abc',
                    'test'
                );
                const expected = localFormAnimation('abc', 'test');
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });
    });

    describe('setTag()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);
        });

        it('should change the given tag on the given bot', () => {
            library.api.setTag(bot1, '#name', 'bob');
            expect(bot1.tags.name).toEqual('bob');
        });

        it('should change the given tag on the given mod', () => {
            let mod: any = {};
            library.api.setTag(mod, '#name', 'bob');
            expect(mod.name).toEqual('bob');
        });

        it('should change the tags on the given bots', () => {
            library.api.setTag([bot1, bot2], '#name', 'bob');
            expect(bot1.tags.name).toEqual('bob');
            expect(bot2.tags.name).toEqual('bob');
        });

        it('should recursively set the tags on the given bots', () => {
            let bot3 = createDummyRuntimeBot('test3');
            let bot4 = createDummyRuntimeBot('test4');
            addToContext(context, bot3, bot4);

            library.api.setTag([bot1, [bot3, bot4], bot2], '#name', 'bob');
            expect(bot1.tags.name).toEqual('bob');
            expect(bot2.tags.name).toEqual('bob');
            expect(bot3.tags.name).toEqual('bob');
            expect(bot4.tags.name).toEqual('bob');
        });

        it('should not allow setting the ID', () => {
            library.api.setTag(bot1, '#id', 'bob');
            expect(bot1.tags.id).not.toEqual('bob');
        });

        it('should not allow setting the space', () => {
            library.api.setTag(bot1, '#space', 'bob');
            expect(bot1.tags.space).not.toEqual('bob');
        });

        it('should not allow setting the space on another mod', () => {
            let mod: any = {};
            library.api.setTag(mod, '#space', 'bob');
            expect(mod.space).not.toEqual('bob');
        });

        it('should not allow setting the id on another mod', () => {
            let mod: any = {};
            library.api.setTag(mod, '#id', 'bob');
            expect(mod.id).not.toEqual('bob');
        });
    });

    describe('removeTags()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);
        });

        it('should remove the given tag sections on the given bot', () => {
            bot1.tags.name = 'bob';
            bot1.tags.nameX = 1;
            bot1.tags.nameY = 2;
            bot1.tags.other = true;
            library.api.removeTags(bot1, 'name');
            expect(bot1.tags.name).toEqual(null);
            expect(bot1.tags.nameX).toEqual(null);
            expect(bot1.tags.nameY).toEqual(null);
            expect(bot1.tags.other).toEqual(true);
        });

        it('should remove the given tags from the given array of bots', () => {
            bot1.tags.name = 'bob';
            bot1.tags.nameX = 1;
            bot1.tags.nameY = 2;
            bot1.tags.other = true;
            bot2.tags.name = 'bob';
            bot2.tags.nameX = 1;
            bot2.tags.nameY = 2;
            bot2.tags.other = true;
            library.api.removeTags([bot1, bot2], 'name');
            expect(bot1.tags.name).toEqual(null);
            expect(bot1.tags.nameX).toEqual(null);
            expect(bot1.tags.nameY).toEqual(null);
            expect(bot1.tags.other).toEqual(true);
            expect(bot2.tags.name).toEqual(null);
            expect(bot2.tags.nameX).toEqual(null);
            expect(bot2.tags.nameY).toEqual(null);
            expect(bot2.tags.other).toEqual(true);
        });
    });

    describe('applyMod()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);
        });

        it('should update the given bot with the given diff', () => {
            library.api.applyMod(bot1, { abc: 'def', ghi: true, num: 1 });
            expect(bot1.tags).toEqual({
                abc: 'def',
                ghi: true,
                num: 1,
            });
        });

        it('should support multiple mods', () => {
            library.api.applyMod(
                bot1,
                { abc: 'def', ghi: true, num: 1 },
                { abc: 'xyz' }
            );
            expect(bot1.tags).toEqual({
                abc: 'xyz',
                ghi: true,
                num: 1,
            });
        });

        it('should support merging mods into mods', () => {
            let mod: any = {};
            library.api.applyMod(
                mod,
                { abc: 'def', ghi: true, num: 1 },
                { abc: 'xyz' }
            );
            expect(mod).toEqual({
                abc: 'xyz',
                ghi: true,
                num: 1,
            });
        });
    });

    describe('subtractMods()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);
        });

        it('should set the tags from the given mod to null', () => {
            bot1.tags.abc = 'def';
            bot1.tags.num = 123;
            library.api.subtractMods(bot1, {
                abc: 'different',
            });

            expect(bot1.tags.abc).toEqual(null);
            expect(bot1.tags.num).toEqual(123);
        });
    });

    describe('create()', () => {
        it('should return the created bot', () => {
            uuidMock.mockReturnValue('uuid');
            const bot = library.api.create({
                abc: 'def',
            });
            expect(bot).toEqual(
                createDummyRuntimeBot('uuid', {
                    abc: 'def',
                })
            );
        });
        it('should automatically set the creator to the current bot ID', () => {
            const creator = createDummyRuntimeBot('creator');
            addToContext(context, creator);
            context.currentBot = creator;

            uuidMock.mockReturnValue('uuid');
            const bot = library.api.create({
                abc: 'def',
            });
            expect(bot).toEqual(
                createDummyRuntimeBot('uuid', {
                    auxCreator: 'creator',
                    abc: 'def',
                })
            );
        });
        it('should ignore strings because they are no longer used to set the creator ID', () => {
            const creator = createDummyRuntimeBot('creator');
            addToContext(context, creator);
            context.currentBot = creator;

            uuidMock.mockReturnValue('uuid');
            const bot = library.api.create('otherBot' as any, {
                abc: 'def',
            });
            expect(bot).toEqual(
                createDummyRuntimeBot('uuid', {
                    auxCreator: 'creator',
                    abc: 'def',
                })
            );
        });
        it('should support multiple arguments', () => {
            uuidMock.mockReturnValue('uuid');
            const bot = library.api.create(
                {
                    abc: 'def',
                },
                { ghi: 123 }
            );
            expect(bot).toEqual(
                createDummyRuntimeBot('uuid', {
                    abc: 'def',
                    ghi: 123,
                })
            );
        });
        it('should support bots as arguments', () => {
            const other = createDummyRuntimeBot('other');
            addToContext(context, other);

            other.tags.abc = 'def';
            other.tags.num = 1;

            uuidMock.mockReturnValue('uuid');
            const bot = library.api.create(other);
            expect(bot).toEqual(
                createDummyRuntimeBot('uuid', {
                    abc: 'def',
                    num: 1,
                })
            );
        });

        it('should support modifying the returned bot', () => {
            uuidMock.mockReturnValue('uuid');
            const bot = library.api.create({ abc: 'def' }) as RuntimeBot;
            bot.tags.fun = true;

            expect(bot).toEqual({
                id: 'uuid',
                tags: {
                    abc: 'def',
                    fun: true,
                },
                raw: {
                    abc: 'def',
                    fun: true,
                },
                changes: {
                    fun: true,
                },
                listeners: {},
            });
        });
        it('should add the new bot to the context', () => {
            uuidMock.mockReturnValue('uuid');
            const bot = library.api.create({ abc: 'def' });

            const bots = library.api.getBots('abc', 'def');
            expect(bots[0]).toBe(bot);
        });
        it('should trigger onCreate() on the created bot.', () => {
            uuidMock.mockReturnValue('uuid');
            const callback = jest.fn();
            const bot = library.api.create({ abc: 'def', onCreate: callback });

            expect(callback).toBeCalled();
            expect(bot).toEqual({
                id: 'uuid',
                tags: {
                    abc: 'def',
                    onCreate: callback,
                },
                raw: {
                    abc: 'def',
                    onCreate: callback,
                },
                changes: {},
                listeners: {
                    onCreate: expect.any(Function),
                },
            });
        });

        it('should trigger onAnyCreate() with the created bot as a parameter', () => {
            uuidMock.mockReturnValue('uuid');
            const bot1 = createDummyRuntimeBot('test1');
            addToContext(context, bot1);

            const onAnyCreate1 = (bot1.listeners.onAnyCreate = jest.fn());

            const bot = library.api.create({ abc: 'def' });

            expect(onAnyCreate1).toBeCalledWith({
                bot: bot,
            });
        });
        it('should support arrays of diffs as arguments', () => {
            uuidMock.mockReturnValueOnce('uuid1').mockReturnValueOnce('uuid2');
            const bots = library.api.create([{ abc: 'def' }, { abc: 123 }]);

            expect(bots).toEqual([
                createDummyRuntimeBot('uuid1', {
                    abc: 'def',
                }),
                createDummyRuntimeBot('uuid2', {
                    abc: 123,
                }),
            ]);
        });
        it('should create every combination of diff', () => {
            let num = 1;
            uuidMock.mockImplementation(() => `uuid-${num++}`);
            const bots = library.api.create(
                [{ hello: true }, { hello: false }],
                { abc: 'def' },
                [{ wow: 1 }, { oh: 'haha' }, { test: 'a' }]
            );

            expect(bots).toEqual([
                createDummyRuntimeBot('uuid-1', {
                    hello: true,
                    abc: 'def',
                    wow: 1,
                }),
                createDummyRuntimeBot('uuid-2', {
                    hello: false,
                    abc: 'def',
                    wow: 1,
                }),
                createDummyRuntimeBot('uuid-3', {
                    hello: true,
                    abc: 'def',
                    oh: 'haha',
                }),
                createDummyRuntimeBot('uuid-4', {
                    hello: false,
                    abc: 'def',
                    oh: 'haha',
                }),
                createDummyRuntimeBot('uuid-5', {
                    hello: true,
                    abc: 'def',
                    test: 'a',
                }),
                createDummyRuntimeBot('uuid-6', {
                    hello: false,
                    abc: 'def',
                    test: 'a',
                }),
            ]);
        });
        it('should duplicate each of the bots in the list', () => {
            const first = createDummyRuntimeBot('first', {
                abc: 'def',
            });
            const second = createDummyRuntimeBot('second', {
                num: 123,
            });
            addToContext(context, first, second);

            uuidMock.mockReturnValueOnce('uuid1').mockReturnValueOnce('uuid2');
            const bots = library.api.create([first, second]);

            expect(bots).toEqual([
                createDummyRuntimeBot('uuid1', {
                    abc: 'def',
                }),
                createDummyRuntimeBot('uuid2', {
                    num: 123,
                }),
            ]);
        });
        it('should copy the space of another bot', () => {
            const other = createDummyRuntimeBot(
                'other',
                {
                    abc: 'def',
                },
                <any>'test'
            );
            addToContext(context, other);

            uuidMock.mockReturnValueOnce('uuid1');
            const bots = library.api.create([other]);
            expect(bots).toEqual(
                createDummyRuntimeBot(
                    'uuid1',
                    {
                        abc: 'def',
                    },
                    <any>'test'
                )
            );
        });

        it('should not pollute the original bot', () => {
            const other = createDummyRuntimeBot(
                'other',
                {
                    abc: 'def',
                },
                <any>'test'
            );
            addToContext(context, other);

            uuidMock.mockReturnValueOnce('uuid1');
            const bots = library.api.create([other]) as RuntimeBot;
            bots.tags.hello = true;
            expect(other).toEqual(
                createDummyRuntimeBot(
                    'other',
                    {
                        abc: 'def',
                    },
                    <any>'test'
                )
            );
        });

        it('should be able to shout to a new bot', () => {
            uuidMock.mockReturnValue('uuid');
            const abc = jest.fn();
            library.api.create({ abc: abc, test: true });
            library.api.shout('abc');

            expect(abc).toBeCalled();
        });

        it('should be able to shout to a new bot that is just now listening', () => {
            uuidMock.mockReturnValue('uuid');
            const abc = jest.fn();
            library.api.create(
                { auxListening: false, abc: abc, test: true },
                { auxListening: true }
            );
            library.api.shout('abc');

            expect(abc).toBeCalled();
        });

        it('should be able to shout to a bot that was created during another shout', () => {
            uuidMock.mockReturnValue('uuid');
            const bot1 = createDummyRuntimeBot('test1', {});
            addToContext(context, bot1);

            const abc = jest.fn();
            bot1.listeners.create = jest.fn(() => {
                library.api.create({ test: true, abc: abc });
            });

            library.api.shout('create');
            library.api.shout('abc');

            expect(abc).toBeCalledTimes(1);
        });

        it('should be able to shout multiple times to a bot that was created during another shout', () => {
            uuidMock.mockReturnValue('uuid');
            const bot1 = createDummyRuntimeBot('test1', {});
            addToContext(context, bot1);

            const abc = jest.fn();
            const def = jest.fn();
            bot1.listeners.create = jest.fn(() => {
                library.api.create({ test: true, abc, def, space: 'custom' });
            });

            library.api.shout('create');
            library.api.shout('abc');
            library.api.shout('def');

            expect(abc).toBeCalledTimes(1);
            expect(def).toBeCalledTimes(1);
        });

        it('should be able to whisper to a bot that was created during another shout', () => {
            uuidMock.mockReturnValue('uuid');
            const bot1 = createDummyRuntimeBot('test1', {});
            addToContext(context, bot1);

            const abc = jest.fn();
            bot1.listeners.create = jest.fn(() => {
                return library.api.create({ test: true, abc });
            });

            let [newBot] = library.api.shout('create');
            library.api.whisper(newBot, 'abc');

            expect(abc).toBeCalledTimes(1);
        });

        it('should be able to whisper to itself after being created', () => {
            uuidMock.mockReturnValue('uuid');
            const bot1 = createDummyRuntimeBot('test1', {});
            addToContext(context, bot1);

            const abc = jest.fn(() => {
                library.api.whisper('uuid', 'def');
            });
            const def = jest.fn();
            bot1.listeners.create = jest.fn(() => {
                return library.api.create({ test: true, abc, def });
            });

            let [newBot] = library.api.shout('create');
            library.api.shout('abc');

            expect(abc).toBeCalledTimes(1);
            expect(def).toBeCalledTimes(1);
        });

        it('should support complicated setup expressions', () => {
            uuidMock.mockReturnValue('uuid');
            const bot1 = createDummyRuntimeBot('test1', {});
            addToContext(context, bot1);

            const setup = jest.fn(() => {
                library.api.whisper('uuid', 'otherPart');
            });
            const otherPart = jest.fn();
            const ensureCreated = (bot1.listeners.ensureCreated = jest.fn(
                () => {
                    let b = library.api.getBot(
                        library.api.byTag('test', true),
                        library.api.bySpace('custom')
                    );
                    if (!b) {
                        b = library.api.create(
                            {
                                test: true,
                                otherPart,
                                setup,
                            },
                            { space: 'custom' }
                        ) as RuntimeBot;
                        library.api.whisper(b, 'setup');
                    }

                    return b;
                }
            ));

            library.api.shout('ensureCreated');
            library.api.shout('ensureCreated');

            expect(ensureCreated).toBeCalledTimes(2);
            expect(setup).toBeCalledTimes(1);
            expect(otherPart).toBeCalledTimes(1);
        });

        describe('space', () => {
            it('should set the space of the bot', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.api.create({ space: 'local' });
                expect(bot).toEqual(createDummyRuntimeBot('uuid', {}, 'local'));
            });

            it('should use the last space', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.api.create(
                    { space: 'tempLocal' },
                    { space: 'local' }
                );
                expect(bot).toEqual(createDummyRuntimeBot('uuid', {}, 'local'));
            });

            it('should use the last space even if it is null', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.api.create(
                    { space: 'tempLocal' },
                    { space: null }
                );
                expect(bot).toEqual(createDummyRuntimeBot('uuid'));
            });

            const normalCases = [
                ['null', null],
                ['undefined', undefined],
                ['(empty string)', ''],
            ];

            it.each(normalCases)(
                'should treat %s as the default type',
                (desc, value) => {
                    uuidMock.mockReturnValueOnce('uuid');
                    const bot = library.api.create({ space: value });
                    expect(bot).toEqual(createDummyRuntimeBot('uuid'));
                }
            );
        });

        describe('auxCreator', () => {
            let current: RuntimeBot;
            let bot1: RuntimeBot;

            beforeEach(() => {
                current = createDummyRuntimeBot('current');
                bot1 = createDummyRuntimeBot('bot1');
                addToContext(context, current, bot1);

                context.currentBot = current;
            });

            it('should set the auxCreator to the given bot', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.api.create({ auxCreator: bot1.id });
                expect(bot).toEqual(
                    createDummyRuntimeBot('uuid', {
                        auxCreator: 'bot1',
                    })
                );
            });

            it('should be able to set the auxCreator to null', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.api.create({ auxCreator: null });
                expect(bot).toEqual(createDummyRuntimeBot('uuid'));
            });

            it('should set auxCreator to null if it references a bot in a different space', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.api.create({
                    auxCreator: bot1.id,
                    space: 'local',
                });
                expect(bot).toEqual(createDummyRuntimeBot('uuid', {}, 'local'));
            });

            it('should set auxCreator to null if it references a bot that does not exist', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.api.create({ auxCreator: 'missing' });
                expect(bot).toEqual(createDummyRuntimeBot('uuid'));
            });
        });
    });

    describe('destroy()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;
        let bot3: RuntimeBot;
        let bot4: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');
            bot3 = createDummyRuntimeBot('test3');
            bot4 = createDummyRuntimeBot('test4');

            addToContext(context, bot1, bot2, bot3, bot4);
        });

        it('should remove the given bot from the context', () => {
            library.api.destroy(bot2);
            expect(context.bots).toEqual([bot1, bot3, bot4]);
        });

        it('should remove the bot with the given ID from the context', () => {
            library.api.destroy('test2');
            expect(context.bots).toEqual([bot1, bot3, bot4]);
        });

        it('should destroy and bots that have auxCreator set to the bot ID', () => {
            bot3.tags.auxCreator = 'test2';
            bot4.tags.auxCreator = 'test2';

            library.api.destroy('test2');
            expect(context.bots).toEqual([bot1]);
        });

        it('should recursively destroy bots that have auxCreator set to the bot ID', () => {
            bot3.tags.auxCreator = 'test2';
            bot4.tags.auxCreator = 'test3';

            library.api.destroy('test2');
            expect(context.bots).toEqual([bot1]);
        });

        it('should support an array of bots to destroy', () => {
            library.api.destroy([bot1, bot2, bot3]);
            expect(context.bots).toEqual([bot4]);
        });

        it('should support an array of bot IDs to destroy', () => {
            library.api.destroy(['test1', 'test2', 'test3']);
            expect(context.bots).toEqual([bot4]);
        });

        it('should support an array of bots and bot IDs to destroy', () => {
            library.api.destroy(['test1', bot2, 'test3']);
            expect(context.bots).toEqual([bot4]);
        });

        it('should trigger onDestroy()', () => {
            const onDestroy1 = (bot1.listeners.onDestroy = jest.fn());

            library.api.destroy(['test1']);

            expect(onDestroy1).toBeCalledTimes(1);
        });

        it('should not destroy bots that are not destroyable', () => {
            bot2.tags.auxDestroyable = false;
            library.api.destroy(context.bots.slice());
            expect(context.bots).toEqual([bot2]);
        });

        it('should short-circut destroying child bots', () => {
            bot2.tags.auxDestroyable = false;
            bot3.tags.auxCreator = 'test2';
            library.api.destroy([bot1, bot2, bot4]);
            expect(context.bots).toEqual([bot2, bot3]);
        });

        it('should be able to destroy a bot that was just created', () => {
            const newBot = library.api.create();
            library.api.destroy(newBot);
            expect(context.bots).not.toContain(newBot);
        });

        it('should remove the destroyed bot from searches', () => {
            library.api.destroy('test2');
            const results = library.api.getBots();
            expect(results).toEqual([bot1, bot3, bot4]);
        });

        it('should not error when destroying something that is not a bot', () => {
            library.api.destroy(<any>{
                abc: 'def',
                ghi: 'jfk',
            });
            const results = library.api.getBots();
            expect(results).toEqual([bot1, bot2, bot3, bot4]);
        });

        it('should destroy bots that are not runtime bots', () => {
            library.api.destroy(<any>{ id: bot2.id, tags: {} });
            const results = library.api.getBots();
            expect(results).toEqual([bot1, bot3, bot4]);
        });

        it('should not destroy bots that are not runtime bots but the real bot is not destroyable', () => {
            bot2.tags.auxDestroyable = false;
            library.api.destroy({ id: bot2.id, tags: {} });

            const results = library.api.getBots();
            expect(results).toEqual([bot1, bot2, bot3, bot4]);
        });

        it('should not error when given null', () => {
            library.api.destroy(null);

            const results = library.api.getBots();
            expect(results).toEqual([bot1, bot2, bot3, bot4]);
        });

        it('should not destroy all auxCreator bots when given a non-bot object', () => {
            bot1.tags.auxCreator = 'a';
            bot2.tags.auxCreator = 'b';
            bot3.tags.auxCreator = 'c';

            library.api.destroy(<any>{
                abc: 'def',
            });

            const results = library.api.getBots();
            expect(results).toEqual([bot1, bot2, bot3, bot4]);
        });
    });

    describe('changeState()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);
        });

        it('should set the state tag to the given value', () => {
            library.api.changeState(bot1, 'abc');

            expect(bot1.tags).toEqual({
                state: 'abc',
            });
        });

        it('should send an @onEnter whisper to the bot', () => {
            const enter = (bot1.listeners.stateAbcOnEnter = jest.fn());
            library.api.changeState(bot1, 'Abc');

            expect(enter).toBeCalledTimes(1);
        });

        it('should send an @onExit whisper to the bot', () => {
            const exit = (bot1.listeners.stateXyzOnExit = jest.fn());
            bot1.tags.state = 'Xyz';
            library.api.changeState(bot1, 'Abc');

            expect(exit).toBeCalledTimes(1);
        });

        it('should use the given group name', () => {
            const enter = (bot1.listeners.funAbcOnEnter = jest.fn());
            const exit = (bot1.listeners.funXyzOnExit = jest.fn());
            bot1.tags.fun = 'Xyz';
            library.api.changeState(bot1, 'Abc', 'fun');

            expect(enter).toBeCalledTimes(1);
            expect(exit).toBeCalledTimes(1);
        });

        it('should do nothing if the state does not change', () => {
            const enter = (bot1.listeners.stateAbcOnEnter = jest.fn());
            const exit = (bot1.listeners.stateXyzOnExit = jest.fn());
            bot1.tags.state = 'Xyz';
            library.api.changeState(bot1, 'Xyz');

            expect(enter).not.toBeCalled();
            expect(exit).not.toBeCalled();
        });
    });

    describe('superShout()', () => {
        it('should emit a super_shout local event', () => {
            const action = library.api.superShout('sayHello');
            expect(action).toEqual(superShout('sayHello'));
            expect(context.actions).toEqual([superShout('sayHello')]);
        });

        it.each(trimEventCases)(
            'should handle %s in the event name.',
            (desc, eventName) => {
                const action = library.api.superShout(eventName);
                expect(action).toEqual(superShout('sayHello'));
                expect(context.actions).toEqual([superShout('sayHello')]);
            }
        );
    });

    describe('shout()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;
        let bot3: RuntimeBot;
        let bot4: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');
            bot3 = createDummyRuntimeBot('test3');
            bot4 = createDummyRuntimeBot('test4');

            addToContext(context, bot1, bot2, bot3, bot4);
        });

        it('should run the event on every bot', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn());
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());

            library.api.shout('sayHello');
            expect(sayHello1).toBeCalled();
            expect(sayHello2).toBeCalled();
        });

        it('should set the given argument as the first variable', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn());
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());

            library.api.shout('sayHello', { hi: 'test' });
            expect(sayHello1).toBeCalledWith({ hi: 'test' });
            expect(sayHello2).toBeCalledWith({ hi: 'test' });
        });

        it('should handle passing bots as arguments', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn());
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());

            library.api.shout('sayHello', bot3);
            expect(sayHello1).toBeCalledWith(bot3);
            expect(sayHello2).toBeCalledWith(bot3);
        });

        it('should be able to modify bots that are arguments', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(b3 => {
                b3.tags.hit1 = true;
            }));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(b3 => {
                b3.tags.hit2 = true;
            }));

            library.api.shout('sayHello', bot3);
            expect(sayHello1).toBeCalled();
            expect(sayHello2).toBeCalled();
            expect(bot3.tags.hit1).toEqual(true);
            expect(bot3.tags.hit2).toEqual(true);
        });

        it('should handle bots nested in an object as an argument', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(arg => {
                arg.bot.tags.hit1 = true;
            }));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(arg => {
                arg.bot.tags.hit2 = true;
            }));

            library.api.shout('sayHello', { bot: bot3 });
            expect(sayHello1).toBeCalledWith({ bot: bot3 });
            expect(sayHello2).toBeCalledWith({ bot: bot3 });
            expect(bot3.tags.hit1).toEqual(true);
            expect(bot3.tags.hit2).toEqual(true);
        });

        it('should handle primitive values', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn());
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());

            library.api.shout('sayHello', true);
            expect(sayHello1).toBeCalledWith(true);
            expect(sayHello2).toBeCalledWith(true);
        });

        it('should return an array of results from the other formulas', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => 1));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => 2));

            const results = library.api.shout('sayHello');
            expect(results).toEqual([1, 2]);
        });

        it('should ignore bots that are not listening', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => 1));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => 2));
            bot2.tags.auxListening = false;

            const results = library.api.shout('sayHello');
            expect(results).toEqual([1]);
            expect(sayHello1).toBeCalled();
            expect(sayHello2).not.toBeCalled();
        });

        it('should handle when a bot in the shout list is deleted', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => {
                library.api.destroy([bot1, bot4]);
            }));
            const sayHello3 = (bot3.listeners.sayHello = jest.fn());
            const sayHello4 = (bot4.listeners.sayHello = jest.fn());

            library.api.shout('sayHello');
            expect(sayHello1).toBeCalled();
            expect(sayHello2).toBeCalled();
            expect(sayHello3).toBeCalled();
            expect(sayHello4).not.toBeCalled();
            expect(context.actions).toEqual([
                botRemoved('test1'),
                botRemoved('test4'),
            ]);
        });

        it('should handle when a bot is created during a shout', () => {
            uuidMock.mockReturnValueOnce('test0').mockReturnValueOnce('test5');
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {
                library.api.create({
                    num: 1,
                });
                library.api.create({
                    num: 2,
                });
            }));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());
            const sayHello3 = (bot3.listeners.sayHello = jest.fn());
            const sayHello4 = (bot4.listeners.sayHello = jest.fn());

            library.api.shout('sayHello');

            expect(sayHello1).toBeCalled();
            expect(sayHello2).toBeCalled();
            expect(sayHello3).toBeCalled();
            expect(sayHello4).toBeCalled();
            expect(context.actions).toEqual([
                botAdded(
                    createBot('test0', {
                        num: 1,
                    })
                ),
                botAdded(
                    createBot('test5', {
                        num: 2,
                    })
                ),
            ]);
        });

        it.each(trimEventCases)(
            'should handle %s in the event name.',
            (desc, eventName) => {
                const sayHello1 = (bot1.listeners.sayHello = jest.fn());
                const sayHello2 = (bot2.listeners.sayHello = jest.fn());

                library.api.shout(eventName);
                expect(sayHello1).toBeCalled();
                expect(sayHello2).toBeCalled();
            }
        );

        it('should handle exceptions on an individual bot basis', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => {
                throw new Error('abc');
            }));
            const sayHello3 = (bot3.listeners.sayHello = jest.fn());
            const sayHello4 = (bot4.listeners.sayHello = jest.fn());

            library.api.shout('sayHello');
            expect(sayHello1).toBeCalled();
            expect(sayHello2).toBeCalled();
            expect(sayHello3).toBeCalled();
            expect(sayHello4).toBeCalled();
            expect(context.errors).toEqual([new Error('abc')]);
        });

        it('should send a onListen whisper to all the targeted bots', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => {
                throw new Error('abc');
            }));
            const sayHello3 = (bot3.listeners.sayHello = jest.fn());
            const sayHello4 = (bot4.listeners.sayHello = jest.fn());

            const onListen1 = (bot1.listeners.onListen = jest.fn(() => {}));
            const onListen2 = (bot2.listeners.onListen = jest.fn(() => {}));
            const onListen3 = (bot3.listeners.onListen = jest.fn());
            const onListen4 = (bot4.listeners.onListen = jest.fn());

            library.api.shout('sayHello', 123);
            const expected = {
                name: 'sayHello',
                that: 123,
                responses: [undefined, undefined, undefined] as any[],
                targets: [bot1, bot2, bot3, bot4],
                listeners: [bot1, bot3, bot4], // should exclude erroring listeners
            };
            expect(onListen1).toBeCalledWith(expected);
            expect(onListen2).toBeCalledWith(expected);
            expect(onListen3).toBeCalledWith(expected);
            expect(onListen4).toBeCalledWith(expected);
        });

        it('should send a onAnyListen shout', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => {
                throw new Error('abc');
            }));
            const sayHello3 = (bot3.listeners.sayHello = jest.fn());
            const sayHello4 = (bot4.listeners.sayHello = jest.fn());

            const onAnyListen4 = (bot4.listeners.onAnyListen = jest.fn());

            library.api.shout('sayHello', 123);
            const expected = {
                name: 'sayHello',
                that: 123,
                responses: [undefined, undefined, undefined] as any[],
                targets: [bot1, bot2, bot3, bot4],
                listeners: [bot1, bot3, bot4], // should exclude erroring listeners
            };
            expect(onAnyListen4).toBeCalledWith(expected);
        });
    });

    describe('whisper()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;
        let bot3: RuntimeBot;
        let bot4: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');
            bot3 = createDummyRuntimeBot('test3');
            bot4 = createDummyRuntimeBot('test4');

            addToContext(context, bot1, bot2, bot3, bot4);
        });

        it('should send an event only to the given bot', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn());
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());

            library.api.whisper(bot1, 'sayHello');
            expect(sayHello1).toBeCalled();
            expect(sayHello2).not.toBeCalled();
        });

        it('should send an event only to the given list of bots', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn());
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());
            const sayHello3 = (bot3.listeners.sayHello = jest.fn());

            library.api.whisper([bot1, bot2], 'sayHello');
            expect(sayHello1).toBeCalled();
            expect(sayHello2).toBeCalled();
            expect(sayHello3).not.toBeCalled();
        });

        it('should return an array of results from the other formulas ordered by how they were given', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => 1));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => 2));
            const sayHello3 = (bot3.listeners.sayHello = jest.fn(() => 3));

            const results = library.api.whisper([bot2, bot1], 'sayHello');
            expect(results).toEqual([2, 1]);
            expect(sayHello1).toBeCalled();
            expect(sayHello2).toBeCalled();
            expect(sayHello3).not.toBeCalled();
        });

        it('should ignore bots that are not listening', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => 1));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => 2));
            bot2.tags.auxListening = false;
            const sayHello3 = (bot3.listeners.sayHello = jest.fn(() => 3));

            const results = library.api.whisper([bot2, bot1], 'sayHello');
            expect(results).toEqual([1]);
            expect(sayHello1).toBeCalled();
            expect(sayHello2).not.toBeCalled();
            expect(sayHello3).not.toBeCalled();
        });

        it.each(trimEventCases)(
            'should handle %s in the event name.',
            (desc, eventName) => {
                const sayHello1 = (bot1.listeners.sayHello = jest.fn());
                const sayHello2 = (bot2.listeners.sayHello = jest.fn());
                const sayHello3 = (bot3.listeners.sayHello = jest.fn());

                library.api.whisper([bot2, bot1], eventName);
                expect(sayHello1).toBeCalled();
                expect(sayHello2).toBeCalled();
                expect(sayHello3).not.toBeCalled();
            }
        );

        it('should handle exceptions on an individual bot basis', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => {
                throw new Error('abc');
            }));
            const sayHello3 = (bot3.listeners.sayHello = jest.fn());
            const sayHello4 = (bot4.listeners.sayHello = jest.fn());

            library.api.whisper([bot1, bot2, bot3], 'sayHello');
            expect(sayHello1).toBeCalled();
            expect(sayHello2).toBeCalled();
            expect(sayHello3).toBeCalled();
            expect(sayHello4).not.toBeCalled();
            expect(context.errors).toEqual([new Error('abc')]);
        });

        it('should send a onListen whisper to all the targeted bots', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => {
                throw new Error('abc');
            }));
            const sayHello3 = (bot3.listeners.sayHello = jest.fn());
            const sayHello4 = (bot4.listeners.sayHello = jest.fn());

            const onListen1 = (bot1.listeners.onListen = jest.fn(() => {}));
            const onListen2 = (bot2.listeners.onListen = jest.fn(() => {}));
            const onListen3 = (bot3.listeners.onListen = jest.fn());
            const onListen4 = (bot4.listeners.onListen = jest.fn());

            library.api.whisper([bot1, bot2, bot3], 'sayHello', 123);
            const expected = {
                name: 'sayHello',
                that: 123,
                responses: [undefined, undefined] as any[],
                targets: [bot1, bot2, bot3],
                listeners: [bot1, bot3], // should exclude erroring listeners
            };
            expect(onListen1).toBeCalledWith(expected);
            expect(onListen2).toBeCalledWith(expected);
            expect(onListen3).toBeCalledWith(expected);
            expect(onListen4).not.toBeCalled();
        });

        it('should send a onAnyListen shout', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => {
                throw new Error('abc');
            }));
            const sayHello3 = (bot3.listeners.sayHello = jest.fn());
            const sayHello4 = (bot4.listeners.sayHello = jest.fn());

            const onAnyListen4 = (bot4.listeners.onAnyListen = jest.fn());

            library.api.whisper([bot1, bot2, bot3], 'sayHello', 123);
            const expected = {
                name: 'sayHello',
                that: 123,
                responses: [undefined, undefined] as any[],
                targets: [bot1, bot2, bot3],
                listeners: [bot1, bot3], // should exclude erroring listeners
            };
            expect(onAnyListen4).toBeCalledWith(expected);
        });

        it('should ignore null bots', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            library.api.whisper([bot1, null], 'sayHello');
            expect(sayHello1).toBeCalledTimes(1);
        });
    });

    describe('player.inSheet()', () => {
        let player: RuntimeBot;

        beforeEach(() => {
            player = createDummyRuntimeBot('player', {}, 'tempLocal');
            addToContext(context, player);
            context.playerBot = player;
        });

        it('should return true if the player bot has a sheet portal', () => {
            player.tags.auxSheetPortal = 'sheet';

            expect(library.api.player.inSheet()).toBe(true);
        });

        it('should return false if the player bot does not have a sheet portal', () => {
            expect(library.api.player.inSheet()).toBe(false);
        });
    });
});
