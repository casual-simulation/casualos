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
    setupStory,
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
    unlockSpace,
    getPlayerCount,
    getStories,
    getPlayers,
    action,
    getStoryStatuses,
    exportGpioPin,
    unexportGpioPin,
    setGpioPin,
    getGpioPin,
    rpioInitPin,
    rpioExitPin,
    rpioOpenPin,
    rpioModePin,
    rpioReadPin,
    rpioReadSequencePin,
    rpioWritePin,
    rpioWriteSequencePin,
    rpioReadpadPin,
    rpioWritepadPin,
    rpioPudPin,
    rpioPollPin,
    rpioClosePin,
    rpioI2CBeginPin,
    rpioI2CSetSlaveAddressPin,
    rpioI2CSetBaudRatePin,
    rpioI2CSetClockDividerPin,
    rpioI2CReadPin,
    rpioI2CWritePin,
    // rpioI2CReadRegisterRestartPin,
    // rpioI2CWriteReadRestartPin,
    rpioI2CEndPin,
    rpioPWMSetClockDividerPin,
    rpioPWMSetRangePin,
    rpioPWMSetDataPin,
    rpioSPIBeginPin,
    rpioSPIChipSelectPin,
    rpioSPISetCSPolarityPin,
    rpioSPISetClockDividerPin,
    rpioSPISetDataModePin,
    rpioSPITransferPin,
    rpioSPIWritePin,
    rpioSPIEndPin,
    serialConnectPin,
    serialStreamPin,
    serialOpenPin,
    serialUpdatePin,
    serialWritePin,
    serialReadPin,
    serialClosePin,
    // serialSetPin,
    // serialGetPin,
    // serialFlushPin,
    // serialDrainPin,
    serialPausePin,
    serialResumePin,
    createCertificate,
    signTag,
    revokeCertificate,
    setSpacePassword,
    bufferSound,
    cancelSound,
    localPositionTween,
    localRotationTween,
    getAnchorPointOffset,
    calculateAnchorPointOffset,
    RuntimeBot,
    SET_TAG_MASK_SYMBOL,
    CLEAR_CHANGES_SYMBOL,
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
    testScriptBotInterface,
} from './test/TestScriptBotFactory';
import { RuntimeBatcher } from './RuntimeBot';
import { AuxVersion } from './AuxVersion';
import { AuxDevice } from './AuxDevice';
import { shuffle } from 'lodash';
import { decryptV1, keypair } from '@casual-simulation/crypto';
import { CERTIFIED_SPACE } from '../aux-format-2/AuxWeaveReducer';
import { del, edit, insert, preserve, tagValueHash } from '../aux-format-2';
import { RanOutOfEnergyError } from './AuxResults';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

describe('AuxLibrary', () => {
    let library: ReturnType<typeof createDefaultLibrary>;
    let context: MemoryGlobalContext;
    let version: AuxVersion;
    let device: AuxDevice;
    let notifier: RuntimeBatcher;

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
        notifier = {
            notifyChange: jest.fn(),
        };
        context = new MemoryGlobalContext(
            version,
            device,
            new TestScriptBotFactory(),
            notifier
        );
        library = createDefaultLibrary(context);
    });

    afterEach(() => {
        uuidMock.mockReset();
    });

    const falsyCases = [
        ['false', false],
        ['0', 0],
    ];
    const emptyCases = [
        ['null', null],
        ['empty string', ''],
    ];
    const numberCases = [
        ['0', 0],
        ['1', 1],
        ['true', true],
        ['false', false],
    ];
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

        const emptyCases = [
            ['null', null],
            ['empty string', ''],
        ];

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
                        (tag) => typeof tag === 'number'
                    );

                    bot1.tags.red = 123;
                    expect(filter(bot1)).toBe(true);
                });

                it('should return a function that returns false when the function returns false', () => {
                    const filter = library.api.byTag(
                        'red',
                        (tag) => typeof tag === 'number'
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
                    color: 'red',
                    number: 123,
                });

                bot1.tags.color = 'red';
                bot1.tags.number = 123;
                bot1.tags.other = true;

                expect(filter(bot1)).toEqual(true);
            });

            it('should not match bots with wrong tag values', () => {
                const filter = library.api.byMod({
                    color: 'red',
                    number: 123,
                });

                bot1.tags.color = 'red';
                bot1.tags.number = 999;
                bot1.tags.other = true;

                expect(filter(bot1)).toEqual(false);
            });

            it('should match tags using the given filter', () => {
                const filter = library.api.byMod({
                    color: (x: string) => x.startsWith('r'),
                    number: 123,
                });

                bot1.tags.color = 'rubble';
                bot1.tags.number = 123;
                bot1.tags.other = true;

                expect(filter(bot1)).toEqual(true);
            });

            it('should match tags with null', () => {
                const filter = library.api.byMod({
                    color: null,
                    number: 123,
                });

                bot1.tags.number = 123;
                bot1.tags.other = true;

                expect(filter(bot1)).toEqual(true);

                bot1.tags.color = 'red';

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

            describe('all directions', () => {
                let bot3: RuntimeBot;
                let bot4: RuntimeBot;
                let bot5: RuntimeBot;

                beforeEach(() => {
                    bot3 = createDummyRuntimeBot('test3');
                    bot4 = createDummyRuntimeBot('test4');
                    bot5 = createDummyRuntimeBot('test5');

                    addToContext(context, bot3, bot4, bot5);

                    bot1.tags.red = true;
                    bot1.tags.redX = 0;
                    bot1.tags.redY = 0;

                    bot2.tags.red = true;
                    bot2.tags.redX = 1;
                    bot2.tags.redY = 0;

                    bot3.tags.red = true;
                    bot3.tags.redX = -1;
                    bot3.tags.redY = 0;

                    bot4.tags.red = true;
                    bot4.tags.redX = 0;
                    bot4.tags.redY = 1;

                    bot5.tags.red = true;
                    bot5.tags.redX = 0;
                    bot5.tags.redY = -1;
                });

                it('should return a function that returns true if the given bot is at the correct position', () => {
                    const filter = library.api.neighboring(bot1, 'red');

                    expect(filter(bot2)).toEqual(true);
                    expect(filter(bot3)).toEqual(true);
                    expect(filter(bot4)).toEqual(true);
                    expect(filter(bot5)).toEqual(true);
                });

                it('should work when given null', () => {
                    const filter = library.api.neighboring(bot1, 'red', null);

                    expect(filter(bot2)).toEqual(true);
                    expect(filter(bot3)).toEqual(true);
                    expect(filter(bot4)).toEqual(true);
                    expect(filter(bot5)).toEqual(true);
                });

                it('should work when given undefined', () => {
                    const filter = library.api.neighboring(
                        bot1,
                        'red',
                        undefined
                    );

                    expect(filter(bot2)).toEqual(true);
                    expect(filter(bot3)).toEqual(true);
                    expect(filter(bot4)).toEqual(true);
                    expect(filter(bot5)).toEqual(true);
                });

                it('should not work when given a direction other than the supported ones', () => {
                    const filter = library.api.neighboring(
                        bot1,
                        'red',
                        <any>'wrong'
                    );

                    expect(filter(bot2)).toEqual(false);
                    expect(filter(bot3)).toEqual(false);
                    expect(filter(bot4)).toEqual(false);
                    expect(filter(bot5)).toEqual(false);
                });

                it('should return a function that returns false if the given bot is not at the correct position', () => {
                    const filter = library.api.neighboring(bot1, 'red');

                    bot2.tags.redX = 2;
                    bot3.tags.redX = -2;
                    bot4.tags.redY = 2;
                    bot5.tags.redY = -2;

                    expect(filter(bot2)).toEqual(false);
                    expect(filter(bot3)).toEqual(false);
                    expect(filter(bot4)).toEqual(false);
                    expect(filter(bot5)).toEqual(false);
                });

                it('should return a function without a sort function', () => {
                    const filter = library.api.neighboring(bot1, 'red');

                    expect(typeof filter.sort).toEqual('undefined');
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

                bot2.tags.creator = bot1.id;

                expect(filter(bot2)).toEqual(true);
            });

            it('should return a function that returns true if the bot is created by the given bot ID', () => {
                const filter = library.api.byCreator(bot1.id);

                bot2.tags.creator = bot1.id;

                expect(filter(bot2)).toEqual(true);
            });

            it('should return a function that returns false if the bot not is created by the given bot ID', () => {
                const filter = library.api.byCreator(bot1.id);

                bot2.tags.creator = 'other';

                expect(filter(bot2)).toEqual(false);
            });

            it('should return a function that returns false if the bot not is created by the given bot', () => {
                const filter = library.api.byCreator(bot1);

                bot2.tags.creator = 'other';

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
                const filter = library.api.either(
                    (b) => false,
                    (b) => true
                );
                expect(filter(bot1)).toEqual(true);
            });

            it('should return a function that returns false when all of the given functions return false', () => {
                const filter = library.api.either(
                    (b) => false,
                    (b) => false
                );
                expect(filter(bot1)).toEqual(false);
            });

            it('should return a function that doesnt have a sort function', () => {
                const filter = library.api.either(
                    (b) => false,
                    (b) => true
                );
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
                const filter = library.api.not((b) => b.id === 'test1');

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
                (b) => b === 'bob'
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

            it('should convert bots to copiable values', () => {
                let action = library.api.player.toast(bot1 as any);

                expect(action).toEqual(
                    toast({
                        id: bot1.id,
                        tags: {
                            ...bot1.tags,
                        },
                    } as any)
                );
            });

            it('should preserve null', () => {
                let action = library.api.player.toast(null);

                expect(action).toEqual(toast(null));
            });
        });

        describe('player.showJoinCode()', () => {
            it('should emit a ShowJoinCodeEvent', () => {
                const action = library.api.player.showJoinCode();
                expect(action).toEqual(showJoinCode());
                expect(context.actions).toEqual([showJoinCode()]);
            });

            it('should allow linking to a specific story and dimension', () => {
                const action = library.api.player.showJoinCode(
                    'story',
                    'dimension'
                );
                expect(action).toEqual(showJoinCode('story', 'dimension'));
                expect(context.actions).toEqual([
                    showJoinCode('story', 'dimension'),
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
                const action: any = library.api.player.run('abc');
                const expected = runScript('abc', context.tasks.size);
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
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

        describe('player.downloadStory()', () => {
            let bot3: RuntimeBot;
            let player: RuntimeBot;

            beforeEach(() => {
                bot3 = createDummyRuntimeBot('test3');
                player = createDummyRuntimeBot(
                    'player',
                    {
                        story: 'channel',
                    },
                    'tempLocal'
                );
                addToContext(context, bot3, player);
                context.playerBot = player;
            });

            it('should emit a DownloadAction with the current state and story name', () => {
                const action = library.api.player.downloadStory();
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
                const bot8 = createDummyRuntimeBot('test8', {}, 'admin');
                addToContext(context, bot4, bot5, bot6, bot7, bot8);

                const action = library.api.player.downloadStory();
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
                const action = library.api.player.showBarcode(
                    'hello',
                    <any>'format'
                );
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

        describe('player.loadStory()', () => {
            it('should emit a LoadStoryAction', () => {
                const action = library.api.player.loadStory('abc');
                expect(action).toEqual(loadSimulation('abc'));
                expect(context.actions).toEqual([loadSimulation('abc')]);
            });
        });

        describe('player.unloadStory()', () => {
            it('should emit a UnloadStoryAction', () => {
                const action = library.api.player.unloadStory('abc');
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
                        story: 'channel',
                    },
                    'tempLocal'
                );
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return true when pagePortal equals the given value', () => {
                player.tags.pagePortal = 'dimension';
                const result = library.api.player.isInDimension('dimension');
                expect(result).toEqual(true);
            });

            it('should return false when pagePortal does not equal the given value', () => {
                player.tags.pagePortal = 'dimension';
                const result = library.api.player.isInDimension('abc');
                expect(result).toEqual(false);
            });

            it('should return false when pagePortal is not set', () => {
                const result = library.api.player.isInDimension('dimension');
                expect(result).toEqual(false);
            });

            it.each(numberCases)(
                'should support "%s" when given %s',
                (expected, given) => {
                    player.tags.pagePortal = given;
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
                        story: 'channel',
                    },
                    'tempLocal'
                );
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return pagePortal', () => {
                player.tags.pagePortal = 'dimension';
                const result = library.api.player.getCurrentDimension();
                expect(result).toEqual('dimension');
            });

            it('should return undefined when pagePortal is not set', () => {
                const result = library.api.player.getCurrentDimension();
                expect(result).toBeUndefined();
            });

            it.each(numberCases)(
                'should return "%s" when given %s',
                (expected, given) => {
                    player.tags.pagePortal = given;
                    const result = library.api.player.getCurrentDimension();
                    expect(result).toEqual(expected);
                }
            );
        });

        describe('player.getCurrentStory()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return story', () => {
                player.tags.story = 'story';
                const result = library.api.player.getCurrentStory();
                expect(result).toEqual('story');
            });

            it('should return undefined when story is not set', () => {
                const result = library.api.player.getCurrentStory();
                expect(result).toBeUndefined();
            });

            it.each(numberCases)(
                'should return "%s" when given %s',
                (expected, given) => {
                    player.tags.story = given;
                    const result = library.api.player.getCurrentStory();
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

            it('should return the inventoryPortal tag from the user bot', () => {
                player.tags.inventoryPortal = 'abc';
                const result = library.api.player.getInventoryDimension();
                expect(result).toEqual('abc');
            });

            it.each(numberCases)(
                'should return "%s" when given %s',
                (expected, given) => {
                    player.tags.inventoryPortal = given;
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

            it('should return the menuPortal tag from the user bot', () => {
                player.tags.menuPortal = 'abc';
                const result = library.api.player.getMenuDimension();
                expect(result).toEqual('abc');
            });

            it.each(numberCases)(
                'should return "%s" when given %s',
                (expected, given) => {
                    player.tags.menuPortal = given;
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
                ['pagePortal', 'pageDimension'],
                ['inventory', 'inventoryDimension'],
                ['inventoryPortal', 'inventoryDimension'],
                ['menu', 'menuDimension'],
                ['menuPortal', 'menuDimension'],
                ['sheet', 'sheetDimension'],
                ['sheetPortal', 'sheetDimension'],
                ['missing', null],
                ['falsy', null],
            ];

            describe.each(cases)('%s', (portal, expectedDimension) => {
                it(`should get the dimension for the ${portal} portal`, () => {
                    player.tags.pagePortal = 'pageDimension';
                    player.tags.inventoryPortal = 'inventoryDimension';
                    player.tags.menuPortal = 'menuDimension';
                    player.tags.sheetPortal = 'sheetDimension';
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
                        player.tags.pagePortal = given;
                        player.tags.inventoryPortal = given;
                        player.tags.menuPortal = given;
                        player.tags.sheetPortal = given;
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

            const portalCases = [...KNOWN_PORTALS.map((p) => [p])];

            it.each(portalCases)(
                'should return 1 when the dimension is in the %s portal',
                (portal) => {
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
                    processingStory: 'channel2',
                });
                const expected = checkout({
                    publishableKey: 'key',
                    productId: 'ID1',
                    title: 'Product 1',
                    description: '$50.43',
                    processingStory: 'channel2',
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('player.playSound()', () => {
            it('should emit a PlaySoundEvent', () => {
                const promise: any = library.api.player.playSound('abc');
                const expected = playSound(
                    'abc',
                    context.tasks.size,
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('player.bufferSound()', () => {
            it('should emit a BufferSoundEvent', () => {
                const promise: any = library.api.player.bufferSound('abc');
                const expected = bufferSound('abc', context.tasks.size);
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('player.cancelSound()', () => {
            it('should emit a CancelSoundEvent', () => {
                const promise: any = library.api.player.cancelSound(1);
                const expected = cancelSound(1, context.tasks.size);
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should be able to take a PlaySoundEvent', () => {
                const event = {
                    [ORIGINAL_OBJECT]: playSound('abc', 1),
                };
                const promise: any = library.api.player.cancelSound(event);
                const expected = cancelSound(1, context.tasks.size);
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
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
                player.tags.inventoryPortal = 'abc';
                bot1.tags.abc = true;
                const result = library.api.player.hasBotInInventory(bot1);
                expect(result).toEqual(true);
            });

            it('should return true if all the given bots are in the users inventory dimension', () => {
                player.tags.inventoryPortal = 'abc';
                bot1.tags.abc = true;
                bot2.tags.abc = true;
                const result = library.api.player.hasBotInInventory([
                    bot1,
                    bot2,
                ]);
                expect(result).toEqual(true);
            });

            it('should return false if one of the given bots are not in the users inventory dimension', () => {
                player.tags.inventoryPortal = 'abc';
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

        describe('server.setupStory()', () => {
            it('should send a SetupChannelAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                bot1.tags.abc = true;
                const action: any = library.api.server.setupStory(
                    'channel',
                    bot1
                );
                const expected = remote(
                    setupStory('channel', createBot(bot1.id, bot1.tags)),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.setupStory('channel');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });

            it('should convert the given bot to a copiable value', () => {
                uuidMock.mockReturnValueOnce('task1');
                bot1.tags.abc = true;
                const action: any = library.api.server.setupStory('channel', {
                    botTag: bot1,
                });
                const expected = remote(
                    setupStory('channel', {
                        botTag: createBot(bot1.id, bot1.tags),
                    }),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.exportGpio()', () => {
            it('should send a ExportGpioPinAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.exportGpio(99, 'in');
                const expected = remote(
                    exportGpioPin(99, 'in'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.exportGpio(99, 'in');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.unexportGpio()', () => {
            it('should send a UnexportGpioPinAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.unexportGpio(99);
                const expected = remote(
                    unexportGpioPin(99),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.unexportGpio(99);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.setGpio()', () => {
            it('should send a SetGpioPinAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.setGpio(99, 1);
                const expected = remote(
                    setGpioPin(99, 1),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.setGpio(99, 1);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.getGpio()', () => {
            it('should send a GetGpioPinAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.getGpio(99);
                const expected = remote(
                    getGpioPin(99),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.getGpio(99);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioInit()', () => {
            it('should send a RpioInitAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                var options = {
                    gpiomem: true,
                };
                const action: any = library.api.server.rpioInit(options);
                const expected = remote(
                    rpioInitPin(options),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                var options = {
                    gpiomem: true,
                };
                library.api.server.rpioInit(options);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioExit()', () => {
            it('should send a RpioExitAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioExit();
                const expected = remote(
                    rpioExitPin(),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioExit();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioOpen()', () => {
            it('should send a RpioOpenAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioOpen(99, 'INPUT');
                const expected = remote(
                    rpioOpenPin(99, 'INPUT'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioOpen(99, 'INPUT');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioMode()', () => {
            it('should send a RpioModeAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioMode(99, 'INPUT');
                const expected = remote(
                    rpioModePin(99, 'INPUT'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioMode(99, 'INPUT');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioRead()', () => {
            it('should send a RpioReadAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioRead(99);
                const expected = remote(
                    rpioReadPin(99),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioRead(99);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioReadSequence()', () => {
            it('should send a RpioReadSequenceAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioReadSequence(99, 10);
                const expected = remote(
                    rpioReadSequencePin(99, 10),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioReadSequence(99, 10);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioWrite()', () => {
            it('should send a RpioWriteAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioWrite(99, 'HIGH');
                const expected = remote(
                    rpioWritePin(99, 'HIGH'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioWrite(99, 'HIGH');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioWriteSequence()', () => {
            it('should send a RpioWriteSequenceAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioWriteSequence(99, [
                    10,
                    10,
                ]);
                const expected = remote(
                    rpioWriteSequencePin(99, [10, 10]),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioWriteSequence(99, [10, 10]);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioReadpad()', () => {
            it('should send a RpioReadpadAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioReadpad(
                    'PAD_GROUP_0_27',
                    'slew'
                );
                const expected = remote(
                    rpioReadpadPin('PAD_GROUP_0_27', 'slew'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioReadpad('PAD_GROUP_0_27', 'slew');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioWritepad()', () => {
            it('should send a RpioWritepadAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioWritepad(
                    'PAD_GROUP_0_27',
                    undefined,
                    true,
                    2
                );
                const expected = remote(
                    rpioWritepadPin('PAD_GROUP_0_27', undefined, true, 2),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioWritepad(
                    'PAD_GROUP_0_27',
                    undefined,
                    true,
                    2
                );

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioPud()', () => {
            it('should send a RpioPudAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioPud(11, 'PULL_OFF');
                const expected = remote(
                    rpioPudPin(11, 'PULL_OFF'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioPud(11, 'PULL_OFF');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioPoll()', () => {
            it('should send a RpioPollAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioPoll(11, null);
                const expected = remote(
                    rpioPollPin(11, null),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioPoll(11, null);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioClose()', () => {
            it('should send a RpioCloseAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioClose(
                    99,
                    'PIN_RESET'
                );
                const expected = remote(
                    rpioClosePin(99, 'PIN_RESET'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioClose(99, 'PIN_RESET');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioI2CBegin()', () => {
            it('should send a RpioI2CBeginAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioI2CBegin();
                const expected = remote(
                    rpioI2CBeginPin(),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioI2CBegin();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioI2CSetSlaveAddress()', () => {
            it('should send a RpioI2CSetSlaveAddressAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioI2CSetSlaveAddress(
                    0xff
                );
                const expected = remote(
                    rpioI2CSetSlaveAddressPin(0xff),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioI2CSetSlaveAddress(0xff);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioI2CSetBaudRate()', () => {
            it('should send a RpioI2CSetBaudRateAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioI2CSetBaudRate(
                    100000
                );
                const expected = remote(
                    rpioI2CSetBaudRatePin(100000),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioI2CSetBaudRate(100000);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioI2CSetClockDivider()', () => {
            it('should send a RpioI2CSetClockDividerAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioI2CSetClockDivider(
                    2500
                );
                const expected = remote(
                    rpioI2CSetClockDividerPin(2500),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioI2CSetClockDivider(2500);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioI2CRead()', () => {
            it('should send a RpioI2CReadAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioI2CRead([32], 16);
                const expected = remote(
                    rpioI2CReadPin([32], 16),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioI2CRead([32], 16);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioI2CWrite()', () => {
            it('should send a RpioI2CWriteAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioI2CWrite([
                    0x0b,
                    0x0e,
                    0x0e,
                    0x0f,
                ]);
                const expected = remote(
                    rpioI2CWritePin([0x0b, 0x0e, 0x0e, 0x0f]),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioI2CWrite([0x0b, 0x0e, 0x0e, 0x0f]);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        // describe('server.rpioI2CReadRegisterRestart()', () => {
        //     it('should send a RpioI2CReadRegisterRestartAction in a RemoteAction', () => {
        //         uuidMock.mockReturnValueOnce('task1');
        //         const action: any = library.api.server.rpioI2CReadRegisterRestart();
        //         const expected = remote(
        //             rpioI2CReadRegisterRestartPin(),
        //             undefined,
        //             undefined,
        //             'task1'
        //         );
        //         expect(action[ORIGINAL_OBJECT]).toEqual(expected);
        //         expect(context.actions).toEqual([expected]);
        //     });

        //     it('should create tasks that can be resolved from a remote', () => {
        //         uuidMock.mockReturnValueOnce('uuid');
        //         library.api.server.rpioI2CReadRegisterRestart();

        //         const task = context.tasks.get('uuid');
        //         expect(task.allowRemoteResolution).toBe(true);
        //     });
        // });

        // describe('server.rpioI2CWriteReadRestart()', () => {
        //     it('should send a RpioI2CWriteReadRestartAction in a RemoteAction', () => {
        //         uuidMock.mockReturnValueOnce('task1');
        //         const action: any = library.api.server.rpioI2CWriteReadRestart();
        //         const expected = remote(
        //             rpioI2CWriteReadRestartPin(),
        //             undefined,
        //             undefined,
        //             'task1'
        //         );
        //         expect(action[ORIGINAL_OBJECT]).toEqual(expected);
        //         expect(context.actions).toEqual([expected]);
        //     });

        //     it('should create tasks that can be resolved from a remote', () => {
        //         uuidMock.mockReturnValueOnce('uuid');
        //         library.api.server.rpioI2CWriteReadRestart();

        //         const task = context.tasks.get('uuid');
        //         expect(task.allowRemoteResolution).toBe(true);
        //     });
        // });

        describe('server.rpioI2CEnd()', () => {
            it('should send a RpioI2CEndAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioI2CEnd();
                const expected = remote(
                    rpioI2CEndPin(),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioI2CEnd();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioPWMSetClockDivider()', () => {
            it('should send a RpioPWMSetClockDividerAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioPWMSetClockDivider(
                    64
                );
                const expected = remote(
                    rpioPWMSetClockDividerPin(64),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioPWMSetClockDivider(64);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioPWMSetRange()', () => {
            it('should send a RpioPWMSetRangeAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioPWMSetRange(
                    12,
                    1024
                );
                const expected = remote(
                    rpioPWMSetRangePin(12, 1024),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioPWMSetRange(12, 1024);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioPWMSetData()', () => {
            it('should send a RpioPWMSetDataAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioPWMSetData(12, 512);
                const expected = remote(
                    rpioPWMSetDataPin(12, 512),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioPWMSetData(12, 512);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioSPIBegin()', () => {
            it('should send a RpioSPIBeginAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioSPIBegin();
                const expected = remote(
                    rpioSPIBeginPin(),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioSPIBegin();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioSPIChipSelect()', () => {
            it('should send a RpioSPIChipSelectAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioSPIChipSelect(0);
                const expected = remote(
                    rpioSPIChipSelectPin(0),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioSPIChipSelect(0);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioSPISetCSPolarity()', () => {
            it('should send a RpioSPISetCSPolarityAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioSPISetCSPolarity(
                    0,
                    'HIGH'
                );
                const expected = remote(
                    rpioSPISetCSPolarityPin(0, 'HIGH'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioSPISetCSPolarity(0, 'HIGH');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioSPISetClockDivider()', () => {
            it('should send a RpioSPISetClockDividerAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioSPISetClockDivider(
                    128
                );
                const expected = remote(
                    rpioSPISetClockDividerPin(128),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioSPISetClockDivider(128);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioSPISetDataMode()', () => {
            it('should send a RpioSPISetDataModeAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioSPISetDataMode(0);
                const expected = remote(
                    rpioSPISetDataModePin(0),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioSPISetDataMode(0);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioSPITransfer()', () => {
            it('should send a RpioSPITransferAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioSPITransfer([1, 1]);
                const expected = remote(
                    rpioSPITransferPin([1, 1]),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioSPITransfer([1, 1]);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioSPIWrite()', () => {
            it('should send a RpioSPIWriteAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioSPIWrite([1, 1]);
                const expected = remote(
                    rpioSPIWritePin([1, 1]),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioSPIWrite([1, 1]);

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.rpioSPIEnd()', () => {
            it('should send a RpioSPIEndAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.rpioSPIEnd();
                const expected = remote(
                    rpioSPIEndPin(),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.rpioSPIEnd();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialConnect()', () => {
            it('should send a SerialConnectAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialConnect(
                    '/dev/ttyS0',
                    { baudRate: 9600 }
                );
                const expected = remote(
                    serialConnectPin('/dev/ttyS0', { baudRate: 9600 }),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialConnect('/dev/ttyS0', {
                    baudRate: 9600,
                });

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialStream()', () => {
            it('should send a SerialStreamAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialStream();
                const expected = remote(
                    serialStreamPin(),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialStream();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialOpen()', () => {
            it('should send a SerialOpenAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialOpen();
                const expected = remote(
                    serialOpenPin(),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialOpen();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialUpdate()', () => {
            it('should send a SerialUpdateAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialUpdate({
                    baudRate: 9600,
                });
                const expected = remote(
                    serialUpdatePin({ baudRate: 9600 }),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialUpdate({ baudRate: 9600 });

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialWrite()', () => {
            it('should send a SerialWriteAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialWrite(
                    'Hello World!',
                    'utf8'
                );
                const expected = remote(
                    serialWritePin('Hello World!', 'utf8'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialWrite('Hello World!', 'utf8');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialRead()', () => {
            it('should send a SerialReadAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialRead();
                const expected = remote(
                    serialReadPin(),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialRead();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialClose()', () => {
            it('should send a SerialCloseAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialClose();
                const expected = remote(
                    serialClosePin(),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialClose();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialPause()', () => {
            it('should send a SerialPauseAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialPause();
                const expected = remote(
                    serialPausePin(),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialPause();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialResume()', () => {
            it('should send a SerialResumeAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialResume();
                const expected = remote(
                    serialResumePin(),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialResume();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
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
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.markHistory({
                    message: 'testMark',
                });
                const expected = remote(
                    markHistory({
                        message: 'testMark',
                    }),
                    undefined,
                    false,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.markHistory({
                    message: 'test',
                });

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.browseHistory()', () => {
            it('should emit a browse_history event', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.browseHistory();
                const expected = remote(
                    browseHistory(),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.browseHistory();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.restoreHistoryMark()', () => {
            it('should emit a restore_history_mark event', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.restoreHistoryMark(
                    'mark'
                );
                const expected = remote(
                    restoreHistoryMark('mark'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.restoreHistoryMark('mark');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.restoreHistoryMarkToStory()', () => {
            it('should emit a restore_history_mark event', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.restoreHistoryMarkToStory(
                    'mark',
                    'story'
                );
                const expected = remote(
                    restoreHistoryMark('mark', 'story'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.restoreHistoryMarkToStory('mark', 'story');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.loadFile()', () => {
            it('should issue a LoadFileAction in a remote event', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.loadFile('path');
                const expected = remote(
                    loadFile({
                        path: 'path',
                    }),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.loadFile('path');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.saveFile()', () => {
            it('should issue a SaveFileAction in a remote event', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.saveFile('path', 'data');
                const expected = remote(
                    saveFile({
                        path: 'path',
                        data: 'data',
                    }),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.saveFile('path', 'data');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.destroyErrors()', () => {
            it('should issue a ClearSpaceAction', () => {
                const action: any = library.api.server.destroyErrors();
                const expected = clearSpace('error', context.tasks.size);
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.loadErrors()', () => {
            it('should issue a LoadBotsAction for the given tag and bot ID', () => {
                const action: any = library.api.server.loadErrors(
                    'test',
                    'abc'
                );
                const expected = loadBots(
                    'error',
                    [
                        {
                            tag: 'error',
                            value: true,
                        },
                        {
                            tag: 'errorBot',
                            value: 'test',
                        },
                        {
                            tag: 'errorTag',
                            value: 'abc',
                        },
                    ],
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support being passed a runtime bot', () => {
                const action: any = library.api.server.loadErrors(bot1, 'abc');
                const expected = loadBots(
                    'error',
                    [
                        {
                            tag: 'error',
                            value: true,
                        },
                        {
                            tag: 'errorBot',
                            value: bot1.id,
                        },
                        {
                            tag: 'errorTag',
                            value: 'abc',
                        },
                    ],
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('server.storyPlayerCount()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot(
                    'player',
                    {
                        story: 'channel',
                    },
                    'tempLocal'
                );
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should emit a remote action with a get_player_count action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.server.storyPlayerCount();
                const expected = remote(
                    getPlayerCount('channel'),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should accept a custom story ID', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.server.storyPlayerCount('test');
                const expected = remote(
                    getPlayerCount('test'),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.storyPlayerCount('test');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.totalPlayerCount()', () => {
            it('should emit a remote action with a get_player_count action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.server.totalPlayerCount();
                const expected = remote(
                    getPlayerCount(),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.totalPlayerCount();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.stories()', () => {
            it('should emit a remote action with a get_stories action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.server.stories();
                const expected = remote(
                    getStories(),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.stories();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.storyStatuses()', () => {
            it('should emit a remote action with a get_story_statuses action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.server.storyStatuses();
                const expected = remote(
                    getStoryStatuses(),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.storyStatuses();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.players()', () => {
            it('should emit a remote action with a get_players action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.server.players();
                const expected = remote(
                    getPlayers(),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.players();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
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

            it('should use the given player ID as the session ID', () => {
                const action = library.api.remote(
                    library.api.player.toast('abc'),
                    'abc'
                );
                const expected = remote(toast('abc'), {
                    sessionId: 'abc',
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should be able to broadcast to all players', () => {
                const action = library.api.remote(
                    library.api.player.toast('abc'),
                    {
                        broadcast: true,
                    }
                );
                const expected = remote(toast('abc'), {
                    broadcast: true,
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support multiple selectors to send the same event to multiple places', () => {
                const action = library.api.remote(
                    library.api.player.toast('abc'),
                    [
                        'abc',
                        {
                            session: 's',
                            username: 'u',
                            device: 'd',
                        },
                    ]
                );
                const expected = [
                    remote(toast('abc'), {
                        sessionId: 'abc',
                    }),
                    remote(toast('abc'), {
                        sessionId: 's',
                        username: 'u',
                        deviceId: 'd',
                    }),
                ];
                expect(action).toEqual(expected);
                expect(context.actions).toEqual(expected);
            });
        });

        describe('remoteWhisper()', () => {
            it('should send a remote action with a shout', () => {
                const actions = library.api.remoteWhisper(
                    'playerId',
                    'eventName'
                );

                const expected = remote(
                    action('eventName', null, null, undefined),
                    {
                        sessionId: 'playerId',
                    }
                );
                expect(actions).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support multiple player IDs', () => {
                const actions = library.api.remoteWhisper(
                    ['playerId1', 'playerId2'],
                    'eventName'
                );

                const expected = [
                    remote(action('eventName', null, null, undefined), {
                        sessionId: 'playerId1',
                    }),
                    remote(action('eventName', null, null, undefined), {
                        sessionId: 'playerId2',
                    }),
                ];
                expect(actions).toEqual(expected);
                expect(context.actions).toEqual(expected);
            });
        });

        describe('remoteShout()', () => {
            it('should send a remote action with a shout', () => {
                const actions = library.api.remoteShout('eventName');

                const expected = remote(
                    action('eventName', null, null, undefined),
                    {
                        broadcast: true,
                    }
                );
                expect(actions).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('webhook()', () => {
            it('should emit a SendWebhookAction', () => {
                const action: any = library.api.webhook({
                    method: 'POST',
                    url: 'https://example.com',
                    data: {
                        test: 'abc',
                    },
                    responseShout: 'test.response()',
                });
                const expected = webhook(
                    {
                        method: 'POST',
                        url: 'https://example.com',
                        data: {
                            test: 'abc',
                        },
                        responseShout: 'test.response()',
                    },
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('webhook.post()', () => {
            it('should emit a SendWebhookAction', () => {
                const action: any = library.api.webhook.post(
                    'https://example.com',
                    { test: 'abc' },
                    {
                        responseShout: 'test.response()',
                    }
                );
                const expected = webhook(
                    {
                        method: 'POST',
                        url: 'https://example.com',
                        data: {
                            test: 'abc',
                        },
                        responseShout: 'test.response()',
                    },
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('uuid()', () => {
            it('should return a UUID', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const guid = library.api.uuid();
                expect(guid).toBe('uuid');
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

        describe('adminSpace.unlock()', () => {
            it('should issue a unlock_space event with the given password', () => {
                const promise: any = library.api.adminSpace.unlock('password');
                const expected = unlockSpace(
                    'admin',
                    'password',
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('adminSpace.setPassword()', () => {
            it('should issue a set_space_password event with the given password', () => {
                const promise: any = library.api.adminSpace.setPassword(
                    'old',
                    'new'
                );
                const expected = setSpacePassword(
                    'admin',
                    'old',
                    'new',
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
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

        describe('experiment.localPositionTween()', () => {
            it('should emit a LocalPositionTweenAction', () => {
                const action: any = library.api.experiment.localPositionTween(
                    bot1,
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    {
                        easing: { type: 'quadratic', mode: 'inout' },
                    }
                );
                const expected = localPositionTween(
                    bot1.id,
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    { type: 'quadratic', mode: 'inout' },
                    undefined,
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support passing a bot ID directly', () => {
                const action: any = library.api.experiment.localPositionTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    {
                        easing: { type: 'quadratic', mode: 'inout' },
                    }
                );
                const expected = localPositionTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    { type: 'quadratic', mode: 'inout' },
                    undefined,
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should default the easing to linear inout', () => {
                const action: any = library.api.experiment.localPositionTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 }
                );
                const expected = localPositionTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    { type: 'linear', mode: 'inout' },
                    undefined,
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support a custom duration', () => {
                const action: any = library.api.experiment.localPositionTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    {
                        duration: 99,
                    }
                );
                const expected = localPositionTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    undefined,
                    99,
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should clamp the duration to 0 if it is negative', () => {
                const action: any = library.api.experiment.localPositionTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    {
                        duration: -1,
                    }
                );
                const expected = localPositionTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    { type: 'linear', mode: 'inout' },
                    0,
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should clamp the duration to 24 hours if it is too large', () => {
                const action: any = library.api.experiment.localPositionTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    {
                        duration: Infinity,
                    }
                );
                const expected = localPositionTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    { type: 'linear', mode: 'inout' },
                    60 * 60 * 24, // 24 hours in seconds
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('experiment.localRotationTween()', () => {
            it('should emit a LocalRotationTweenAction', () => {
                const action: any = library.api.experiment.localRotationTween(
                    bot1,
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    {
                        easing: { type: 'quadratic', mode: 'inout' },
                    }
                );
                const expected = localRotationTween(
                    bot1.id,
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    { type: 'quadratic', mode: 'inout' },
                    undefined,
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support passing a bot ID directly', () => {
                const action: any = library.api.experiment.localRotationTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    {
                        easing: { type: 'quadratic', mode: 'inout' },
                    }
                );
                const expected = localRotationTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    { type: 'quadratic', mode: 'inout' },
                    undefined,
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should default the easing to linear inout', () => {
                const action: any = library.api.experiment.localRotationTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 }
                );
                const expected = localRotationTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    { type: 'linear', mode: 'inout' },
                    undefined,
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support a custum duration', () => {
                const action: any = library.api.experiment.localRotationTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    {
                        duration: 99,
                    }
                );
                const expected = localRotationTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    { type: 'linear', mode: 'inout' },
                    99,
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should clamp the duration to 0 if it is negative', () => {
                const action: any = library.api.experiment.localRotationTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    {
                        duration: -1,
                    }
                );
                const expected = localRotationTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    { type: 'linear', mode: 'inout' },
                    0,
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should clamp the duration to 24 hours if it is too large', () => {
                const action: any = library.api.experiment.localRotationTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    {
                        duration: Infinity,
                    }
                );
                const expected = localRotationTween(
                    'abc',
                    'dim',
                    { x: 1, y: 2, z: 3 },
                    { type: 'linear', mode: 'inout' },
                    60 * 60 * 24, // 24 hours in seconds
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('experiment.getAnchorPointPosition()', () => {
            const cases = [
                ['top', 'top', { x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 0.5 }],
                [
                    'bottom',
                    'bottom',
                    { x: 1, y: 1, z: 1 },
                    { x: 1, y: 1, z: 1.5 },
                ],
                [
                    'center',
                    'center',
                    { x: 1, y: 1, z: 1 },
                    { x: 1, y: 1, z: 1 },
                ],
                [
                    'front',
                    'front',
                    { x: 1, y: 1, z: 1 },
                    { x: 1, y: 1.5, z: 1 },
                ],
                ['back', 'back', { x: 1, y: 1, z: 1 }, { x: 1, y: 0.5, z: 1 }],
                ['left', 'left', { x: 1, y: 1, z: 1 }, { x: 1.5, y: 1, z: 1 }],
                [
                    'right',
                    'right',
                    { x: 1, y: 1, z: 1 },
                    { x: 0.5, y: 1, z: 1 },
                ],
                [
                    '[1, 2, 3]',
                    [1, 2, 3],
                    { x: 1, y: 1, z: 1 },
                    { x: 0, y: 3, z: -2 },
                ],
            ];

            describe.each(cases)(
                'should support %s',
                (desc, anchorPoint, pos, expected) => {
                    it('should return the position of the given anchor point in world space', () => {
                        bot1.tags.homeX = pos.x;
                        bot1.tags.homeY = pos.y;
                        bot1.tags.homeZ = pos.z;

                        const position = library.api.experiment.getAnchorPointPosition(
                            bot1,
                            'home',
                            anchorPoint
                        );

                        expect(position).toEqual(expected);
                    });

                    it('should handle custom uniform scale', () => {
                        bot1.tags.homeX = pos.x;
                        bot1.tags.homeY = pos.y;
                        bot1.tags.homeZ = pos.z;
                        bot1.tags.scale = 2;

                        const position = library.api.experiment.getAnchorPointPosition(
                            bot1,
                            'home',
                            anchorPoint
                        );

                        const scaled = {
                            x: (expected.x - pos.x) * 2 + pos.x,
                            y: (expected.y - pos.y) * 2 + pos.y,
                            z: (expected.z - pos.z) * 2 + pos.z,
                        };

                        expect(position).toEqual(scaled);
                    });

                    it('should handle custom non-uniform scale', () => {
                        bot1.tags.homeX = pos.x;
                        bot1.tags.homeY = pos.y;
                        bot1.tags.homeZ = pos.z;
                        bot1.tags.scaleX = 2;
                        bot1.tags.scaleY = 3;
                        bot1.tags.scaleZ = 4;

                        const position = library.api.experiment.getAnchorPointPosition(
                            bot1,
                            'home',
                            anchorPoint
                        );

                        const scaled = {
                            x: (expected.x - pos.x) * 2 + pos.x,
                            y: (expected.y - pos.y) * 3 + pos.y,
                            z: (expected.z - pos.z) * 4 + pos.z,
                        };

                        expect(position).toEqual(scaled);
                    });
                }
            );
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

    describe('setTagMask()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);
        });

        it('should change the given tag mask on the given bot', () => {
            library.api.setTagMask(bot1, '#name', 'bob', 'local');
            expect(bot1.masks.name).toEqual('bob');
            expect(bot1.maskChanges).toEqual({
                local: {
                    name: 'bob',
                },
            });
        });

        it('should change the tag masks on the given bots', () => {
            library.api.setTagMask([bot1, bot2], '#name', 'bob', 'local');
            expect(bot1.masks.name).toEqual('bob');
            expect(bot2.masks.name).toEqual('bob');
            expect(bot1.maskChanges).toEqual({
                local: {
                    name: 'bob',
                },
            });
            expect(bot2.maskChanges).toEqual({
                local: {
                    name: 'bob',
                },
            });
        });

        it('should recursively set the tags on the given bots', () => {
            let bot3 = createDummyRuntimeBot('test3');
            let bot4 = createDummyRuntimeBot('test4');
            addToContext(context, bot3, bot4);

            library.api.setTagMask(
                [bot1, [bot3, bot4] as any, bot2],
                '#name',
                'bob',
                'local'
            );
            expect(bot1.masks.name).toEqual('bob');
            expect(bot2.masks.name).toEqual('bob');
            expect(bot3.masks.name).toEqual('bob');
            expect(bot4.masks.name).toEqual('bob');
            expect(bot1.maskChanges).toEqual({
                local: {
                    name: 'bob',
                },
            });
            expect(bot2.maskChanges).toEqual({
                local: {
                    name: 'bob',
                },
            });
            expect(bot3.maskChanges).toEqual({
                local: {
                    name: 'bob',
                },
            });
            expect(bot4.maskChanges).toEqual({
                local: {
                    name: 'bob',
                },
            });
        });

        it('should not allow setting the ID', () => {
            library.api.setTagMask(bot1, '#id', 'bob', 'local');
            expect(bot1.tags.id).not.toEqual('bob');
            expect(bot1.maskChanges).toEqual({});
        });

        it('should not allow setting the space', () => {
            library.api.setTagMask(bot1, '#space', 'bob', 'local');
            expect(bot1.tags.space).not.toEqual('bob');
            expect(bot1.maskChanges).toEqual({});
        });
    });

    describe('clearTagMasks()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);
        });

        it('should remove the tag masks from the given bot', () => {
            bot1[SET_TAG_MASK_SYMBOL]('name', 'bob', 'local');
            bot1[SET_TAG_MASK_SYMBOL]('other', 'bob', 'local');
            bot1[SET_TAG_MASK_SYMBOL]('final', 'bob', 'tempLocal');

            library.api.clearTagMasks(bot1);

            expect(bot1.masks.name).toEqual(null);
            expect(bot1.masks.other).toEqual(null);
            expect(bot1.masks.final).toEqual(null);
            expect(bot1.maskChanges).toEqual({
                local: {
                    name: null,
                    other: null,
                },
                tempLocal: {
                    final: null,
                },
            });
        });

        it('should do nothing if the bot does not have any tag masks', () => {
            library.api.clearTagMasks(bot1);
            expect(bot1.maskChanges).toEqual({});
        });

        it('should remove the tag masks from the given bot and space', () => {
            bot1[SET_TAG_MASK_SYMBOL]('name', 'bob', 'local');
            bot1[SET_TAG_MASK_SYMBOL]('other', 'bob', 'local');
            bot1[SET_TAG_MASK_SYMBOL]('final', 'bob', 'tempLocal');

            library.api.clearTagMasks(bot1, 'local');

            expect(bot1.masks.name).toEqual(null);
            expect(bot1.masks.other).toEqual(null);
            expect(bot1.masks.final).toEqual('bob');
            expect(bot1.maskChanges).toEqual({
                local: {
                    name: null,
                    other: null,
                },
                tempLocal: {
                    final: 'bob',
                },
            });
        });

        it('should recursively remove the tag masks on the given bots', () => {
            let bot3 = createDummyRuntimeBot('test3');
            let bot4 = createDummyRuntimeBot('test4');
            addToContext(context, bot3, bot4);

            bot1[SET_TAG_MASK_SYMBOL]('name', 'bob', 'local');
            bot1[SET_TAG_MASK_SYMBOL]('other', 'bob', 'local');
            bot1[SET_TAG_MASK_SYMBOL]('final', 'bob', 'tempLocal');

            bot2[SET_TAG_MASK_SYMBOL]('name', 'bob', 'local');
            bot2[SET_TAG_MASK_SYMBOL]('other', 'bob', 'local');
            bot2[SET_TAG_MASK_SYMBOL]('final', 'bob', 'tempLocal');

            bot3[SET_TAG_MASK_SYMBOL]('name', 'bob', 'local');
            bot3[SET_TAG_MASK_SYMBOL]('other', 'bob', 'local');
            bot3[SET_TAG_MASK_SYMBOL]('final', 'bob', 'tempLocal');

            bot4[SET_TAG_MASK_SYMBOL]('name', 'bob', 'local');
            bot4[SET_TAG_MASK_SYMBOL]('other', 'bob', 'local');
            bot4[SET_TAG_MASK_SYMBOL]('final', 'bob', 'tempLocal');

            library.api.clearTagMasks([bot1, [bot2, bot3] as any, bot4]);

            expect(bot1.masks.name).toEqual(null);
            expect(bot1.masks.other).toEqual(null);
            expect(bot1.masks.final).toEqual(null);
            expect(bot1.maskChanges).toEqual({
                local: {
                    name: null,
                    other: null,
                },
                tempLocal: {
                    final: null,
                },
            });

            expect(bot2.masks.name).toEqual(null);
            expect(bot2.masks.other).toEqual(null);
            expect(bot2.masks.final).toEqual(null);
            expect(bot2.maskChanges).toEqual({
                local: {
                    name: null,
                    other: null,
                },
                tempLocal: {
                    final: null,
                },
            });

            expect(bot3.masks.name).toEqual(null);
            expect(bot3.masks.other).toEqual(null);
            expect(bot3.masks.final).toEqual(null);
            expect(bot3.maskChanges).toEqual({
                local: {
                    name: null,
                    other: null,
                },
                tempLocal: {
                    final: null,
                },
            });

            expect(bot4.masks.name).toEqual(null);
            expect(bot4.masks.other).toEqual(null);
            expect(bot4.masks.final).toEqual(null);
            expect(bot4.maskChanges).toEqual({
                local: {
                    name: null,
                    other: null,
                },
                tempLocal: {
                    final: null,
                },
            });
        });

        it('should recursively remove the tag masks on the given bots in the given space', () => {
            let bot3 = createDummyRuntimeBot('test3');
            let bot4 = createDummyRuntimeBot('test4');
            addToContext(context, bot3, bot4);

            bot1[SET_TAG_MASK_SYMBOL]('name', 'bob', 'local');
            bot1[SET_TAG_MASK_SYMBOL]('other', 'bob', 'local');
            bot1[SET_TAG_MASK_SYMBOL]('final', 'bob', 'tempLocal');

            bot2[SET_TAG_MASK_SYMBOL]('name', 'bob', 'local');
            bot2[SET_TAG_MASK_SYMBOL]('other', 'bob', 'local');
            bot2[SET_TAG_MASK_SYMBOL]('final', 'bob', 'tempLocal');

            bot3[SET_TAG_MASK_SYMBOL]('name', 'bob', 'local');
            bot3[SET_TAG_MASK_SYMBOL]('other', 'bob', 'local');
            bot3[SET_TAG_MASK_SYMBOL]('final', 'bob', 'tempLocal');

            bot4[SET_TAG_MASK_SYMBOL]('name', 'bob', 'local');
            bot4[SET_TAG_MASK_SYMBOL]('other', 'bob', 'local');
            bot4[SET_TAG_MASK_SYMBOL]('final', 'bob', 'tempLocal');

            library.api.clearTagMasks(
                [bot1, [bot2, bot3] as any, bot4],
                'local'
            );

            expect(bot1.masks.name).toEqual(null);
            expect(bot1.masks.other).toEqual(null);
            expect(bot1.masks.final).toEqual('bob');
            expect(bot1.maskChanges).toEqual({
                local: {
                    name: null,
                    other: null,
                },
                tempLocal: {
                    final: 'bob',
                },
            });

            expect(bot2.masks.name).toEqual(null);
            expect(bot2.masks.other).toEqual(null);
            expect(bot2.masks.final).toEqual('bob');
            expect(bot2.maskChanges).toEqual({
                local: {
                    name: null,
                    other: null,
                },
                tempLocal: {
                    final: 'bob',
                },
            });

            expect(bot3.masks.name).toEqual(null);
            expect(bot3.masks.other).toEqual(null);
            expect(bot3.masks.final).toEqual('bob');
            expect(bot3.maskChanges).toEqual({
                local: {
                    name: null,
                    other: null,
                },
                tempLocal: {
                    final: 'bob',
                },
            });

            expect(bot4.masks.name).toEqual(null);
            expect(bot4.masks.other).toEqual(null);
            expect(bot4.masks.final).toEqual('bob');
            expect(bot4.maskChanges).toEqual({
                local: {
                    name: null,
                    other: null,
                },
                tempLocal: {
                    final: 'bob',
                },
            });
        });
    });

    describe('insertTagText()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);

            bot2.tags.abc = 'hello';
            bot2[CLEAR_CHANGES_SYMBOL]();
        });

        it('should create the tag with the given text if it does not exist', () => {
            const result = library.api.insertTagText(bot1, 'abc', 0, 'hello');

            expect(result).toEqual('hello');
            expect(bot1.tags.abc).toEqual('hello');
            expect(bot1.raw.abc).toEqual('hello');
            expect(bot1.changes).toEqual({
                abc: edit(
                    testScriptBotInterface.currentVersion.vector,
                    preserve(0),
                    insert('hello')
                ),
            });
        });

        it('should insert the text into the start of the given tag', () => {
            const result = library.api.insertTagText(bot2, 'abc', 0, '123');

            expect(result).toEqual('123hello');
            expect(bot2.tags.abc).toEqual('123hello');
            expect(bot2.raw.abc).toEqual('123hello');
            expect(bot2.changes).toEqual({
                abc: edit(
                    testScriptBotInterface.currentVersion.vector,
                    preserve(0),
                    insert('123')
                ),
            });
        });

        it('should insert the text into the middle of the given tag', () => {
            const result = library.api.insertTagText(bot2, 'abc', 2, '123');

            expect(result).toEqual('he123llo');
            expect(bot2.tags.abc).toEqual('he123llo');
            expect(bot2.raw.abc).toEqual('he123llo');
            expect(bot2.changes).toEqual({
                abc: edit(
                    testScriptBotInterface.currentVersion.vector,
                    preserve(2),
                    insert('123')
                ),
            });
        });

        it('should insert the text into the end of the given tag', () => {
            const result = library.api.insertTagText(bot2, 'abc', 5, '123');

            expect(result).toEqual('hello123');
            expect(bot2.tags.abc).toEqual('hello123');
            expect(bot2.raw.abc).toEqual('hello123');
            expect(bot2.changes).toEqual({
                abc: edit(
                    testScriptBotInterface.currentVersion.vector,
                    preserve(5),
                    insert('123')
                ),
            });
        });

        it('should allow negative numbers to insert from the end of the string', () => {
            const result = library.api.insertTagText(bot2, 'abc', -1, '123');

            expect(result).toEqual('hell123o');
            expect(bot2.tags.abc).toEqual('hell123o');
            expect(bot2.raw.abc).toEqual('hell123o');
            expect(bot2.changes).toEqual({
                abc: edit(
                    testScriptBotInterface.currentVersion.vector,
                    preserve(4),
                    insert('123')
                ),
            });
        });

        it('should allow negative numbers to insert from the end of the string when the current tag value is empty', () => {
            const result = library.api.insertTagText(bot1, 'abc', -1, '123');

            expect(result).toEqual('123');
            expect(bot1.tags.abc).toEqual('123');
            expect(bot1.raw.abc).toEqual('123');
            expect(bot1.changes).toEqual({
                abc: edit(
                    testScriptBotInterface.currentVersion.vector,
                    preserve(0),
                    insert('123')
                ),
            });
        });

        it('should clamp to the end of the string', () => {
            const result = library.api.insertTagText(bot2, 'abc', 7, '123');

            expect(result).toEqual('hello123');
            expect(bot2.tags.abc).toEqual('hello123');
            expect(bot2.raw.abc).toEqual('hello123');
            expect(bot2.changes).toEqual({
                abc: edit(
                    testScriptBotInterface.currentVersion.vector,
                    preserve(5),
                    insert('123')
                ),
            });
        });
    });

    describe('insertTagMaskText()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);

            library.api.setTagMask(bot2, 'abc', 'hello', 'local');
            bot2[CLEAR_CHANGES_SYMBOL]();
        });

        it('should create the tag with the given text if it does not exist', () => {
            const result = library.api.insertTagMaskText(
                bot1,
                'abc',
                0,
                'hello',
                'local'
            );

            expect(result).toEqual('hello');
            expect(bot1.masks.abc).toEqual('hello');
            expect(bot1.maskChanges).toEqual({
                local: {
                    abc: edit(
                        testScriptBotInterface.currentVersion.vector,
                        preserve(0),
                        insert('hello')
                    ),
                },
            });
        });

        it('should insert the text into the start of the given tag', () => {
            const result = library.api.insertTagMaskText(
                bot2,
                'abc',
                0,
                '123',
                'local'
            );

            expect(result).toEqual('123hello');
            expect(bot2.masks.abc).toEqual('123hello');
            expect(bot2.maskChanges).toEqual({
                local: {
                    abc: edit(
                        testScriptBotInterface.currentVersion.vector,
                        preserve(0),
                        insert('123')
                    ),
                },
            });
        });

        it('should insert the text into the middle of the given tag', () => {
            const result = library.api.insertTagMaskText(
                bot2,
                'abc',
                2,
                '123',
                'local'
            );

            expect(result).toEqual('he123llo');
            expect(bot2.masks.abc).toEqual('he123llo');
            expect(bot2.maskChanges).toEqual({
                local: {
                    abc: edit(
                        testScriptBotInterface.currentVersion.vector,
                        preserve(2),
                        insert('123')
                    ),
                },
            });
        });

        it('should insert the text into the end of the given tag', () => {
            const result = library.api.insertTagMaskText(
                bot2,
                'abc',
                5,
                '123',
                'local'
            );

            expect(result).toEqual('hello123');
            expect(bot2.masks.abc).toEqual('hello123');
            expect(bot2.maskChanges).toEqual({
                local: {
                    abc: edit(
                        testScriptBotInterface.currentVersion.vector,
                        preserve(5),
                        insert('123')
                    ),
                },
            });
        });

        it('should allow negative numbers to insert from the end of the string', () => {
            const result = library.api.insertTagMaskText(
                bot2,
                'abc',
                -1,
                '123',
                'local'
            );

            expect(result).toEqual('hell123o');
            expect(bot2.masks.abc).toEqual('hell123o');
            expect(bot2.maskChanges).toEqual({
                local: {
                    abc: edit(
                        testScriptBotInterface.currentVersion.vector,
                        preserve(4),
                        insert('123')
                    ),
                },
            });
        });

        it('should allow negative numbers to insert from the end of the string when the current tag value is empty', () => {
            const result = library.api.insertTagMaskText(
                bot1,
                'abc',
                -1,
                '123',
                'local'
            );

            expect(result).toEqual('123');
            expect(bot1.masks.abc).toEqual('123');
            expect(bot1.maskChanges).toEqual({
                local: {
                    abc: edit(
                        testScriptBotInterface.currentVersion.vector,
                        preserve(0),
                        insert('123')
                    ),
                },
            });
        });

        it('should clamp to the end of the string', () => {
            const result = library.api.insertTagMaskText(
                bot2,
                'abc',
                7,
                '123',
                'local'
            );

            expect(result).toEqual('hello123');
            expect(bot2.masks.abc).toEqual('hello123');
            expect(bot2.maskChanges).toEqual({
                local: {
                    abc: edit(
                        testScriptBotInterface.currentVersion.vector,
                        preserve(5),
                        insert('123')
                    ),
                },
            });
        });
    });

    describe('deleteTagText()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);

            bot2.tags.abc = 'hello';
            bot2[CLEAR_CHANGES_SYMBOL]();
        });

        it('should do nothing if the tag doesnt exist', () => {
            const result = library.api.deleteTagText(bot1, 'abc', 0, 2);

            expect(result).toEqual('');
            expect(bot1.tags.abc).toBeUndefined();
            expect(bot1.raw.abc).toBeUndefined();
            expect(bot1.changes).toEqual({});
        });

        it('should delete the text from the start of the given tag', () => {
            const result = library.api.deleteTagText(bot2, 'abc', 0, 2);

            expect(result).toEqual('llo');
            expect(bot2.tags.abc).toEqual('llo');
            expect(bot2.raw.abc).toEqual('llo');
            expect(bot2.changes).toEqual({
                abc: edit(
                    testScriptBotInterface.currentVersion.vector,
                    preserve(0),
                    del(2)
                ),
            });
        });

        it('should insert the text into the middle of the given tag', () => {
            const result = library.api.deleteTagText(bot2, 'abc', 2, 2);

            expect(result).toEqual('heo');
            expect(bot2.tags.abc).toEqual('heo');
            expect(bot2.raw.abc).toEqual('heo');
            expect(bot2.changes).toEqual({
                abc: edit(
                    testScriptBotInterface.currentVersion.vector,
                    preserve(2),
                    del(2)
                ),
            });
        });

        it('should delete the text from the end of the given tag', () => {
            const result = library.api.deleteTagText(bot2, 'abc', 3, 2);

            expect(result).toEqual('hel');
            expect(bot2.tags.abc).toEqual('hel');
            expect(bot2.raw.abc).toEqual('hel');
            expect(bot2.changes).toEqual({
                abc: edit(
                    testScriptBotInterface.currentVersion.vector,
                    preserve(3),
                    del(2)
                ),
            });
        });

        it('should allow negative numbers to delete from the end of the string', () => {
            const result = library.api.deleteTagText(bot2, 'abc', -2, 2);

            expect(result).toEqual('hel');
            expect(bot2.tags.abc).toEqual('hel');
            expect(bot2.raw.abc).toEqual('hel');
            expect(bot2.changes).toEqual({
                abc: edit(
                    testScriptBotInterface.currentVersion.vector,
                    preserve(3),
                    del(2)
                ),
            });
        });

        it('should do nothing when using negative numbers to delete from the end of the string when the current tag value is empty', () => {
            const result = library.api.deleteTagText(bot1, 'abc', -1, 1);

            expect(result).toEqual('');
            expect(bot1.tags.abc).toBeUndefined();
            expect(bot1.raw.abc).toBeUndefined();
            expect(bot1.changes).toEqual({});
        });

        it('should clamp to the end of the string', () => {
            const result = library.api.deleteTagText(bot2, 'abc', 7, 1);

            expect(result).toEqual('hello');
            expect(bot2.tags.abc).toEqual('hello');
            expect(bot2.raw.abc).toEqual('hello');
            expect(bot2.changes).toEqual({});
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

    describe('renameTag()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);
        });

        it('should rename the given tag on the given bot', () => {
            bot1.tags.abc = 123;
            bot2.tags.abc = 456;

            library.api.renameTag(bot1, 'abc', 'def');

            expect(bot1.tags.abc).toBe(null);
            expect(bot1.tags.def).toBe(123);
        });

        it('should rename the given tag on the given bots', () => {
            bot1.tags.abc = 123;
            bot2.tags.abc = 456;

            library.api.renameTag([bot1, bot2], 'abc', 'def');

            expect(bot1.tags.abc).toBe(null);
            expect(bot1.tags.def).toBe(123);

            expect(bot2.tags.abc).toBe(null);
            expect(bot2.tags.def).toBe(456);
        });

        it('should do nothing if the bot does not have the given tag', () => {
            bot1.tags.def = 123;

            library.api.renameTag([bot1, bot2], 'abc', 'def');

            expect(bot1.tags.abc).toBeUndefined();
            expect(bot1.tags.def).toBe(123);
        });

        it('should replace the existing tag value', () => {
            bot1.tags.abc = 'hello';
            bot1.tags.def = 123;

            library.api.renameTag([bot1, bot2], 'abc', 'def');

            expect(bot1.tags.abc).toBe(null);
            expect(bot1.tags.def).toBe('hello');
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
                    creator: 'creator',
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
                    creator: 'creator',
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
                masks: {},
                maskChanges: {},
                listeners: {},
                signatures: {},
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
                masks: {},
                maskChanges: {},
                changes: {},
                listeners: {
                    onCreate: expect.any(Function),
                },
                signatures: {},
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

        const listeningTagCases = ['auxListening', 'listening'];
        describe.each(listeningTagCases)('%s', (tag: string) => {
            it('should be able to shout to a new bot that is just now listening', () => {
                uuidMock.mockReturnValue('uuid');
                const abc = jest.fn();
                library.api.create(
                    { [tag]: false, abc: abc, test: true },
                    { [tag]: true }
                );
                library.api.shout('abc');

                expect(abc).toBeCalled();
            });
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

            let [] = library.api.shout('create');
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

        describe('creator', () => {
            let current: RuntimeBot;
            let bot1: RuntimeBot;

            beforeEach(() => {
                current = createDummyRuntimeBot('current');
                bot1 = createDummyRuntimeBot('bot1');
                addToContext(context, current, bot1);

                context.currentBot = current;
            });

            it('should set the creator to the given bot', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.api.create({ creator: bot1.id });
                expect(bot).toEqual(
                    createDummyRuntimeBot('uuid', {
                        creator: 'bot1',
                    })
                );
            });

            it('should be able to set the creator to null', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.api.create({ creator: null });
                expect(bot).toEqual(createDummyRuntimeBot('uuid'));
            });

            it('should set creator to null if it references a bot in a different space', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.api.create({
                    creator: bot1.id,
                    space: 'local',
                });
                expect(bot).toEqual(createDummyRuntimeBot('uuid', {}, 'local'));
            });

            it('should set creator to null if it references a bot that does not exist', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.api.create({ creator: 'missing' });
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

        it('should destroy and bots that have creator set to the bot ID', () => {
            bot3.tags.creator = 'test2';
            bot4.tags.creator = 'test2';

            library.api.destroy('test2');
            expect(context.bots).toEqual([bot1]);
        });

        it('should destroy and bots that have creator set to the bot ID', () => {
            bot3.tags.creator = 'test2';
            bot4.tags.creator = 'test2';

            library.api.destroy('test2');
            expect(context.bots).toEqual([bot1]);
        });

        it('should recursively destroy bots that have creator set to the bot ID', () => {
            bot3.tags.creator = 'test2';
            bot4.tags.creator = 'test3';

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
            bot2.tags.destroyable = false;
            library.api.destroy(context.bots.slice());
            expect(context.bots).toEqual([bot2]);
        });

        it('should short-circut destroying child bots', () => {
            bot2.tags.destroyable = false;
            bot3.tags.creator = 'test2';
            library.api.destroy([bot1, bot2, bot4]);
            expect(context.bots).toEqual([bot2, bot3]);
        });

        it('should be able to destroy a bot that was just created', () => {
            uuidMock.mockReturnValueOnce('uuid');
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

        it('should not destroy bots that have auxDestroyable set to false', () => {
            bot2.tags.auxDestroyable = false;
            library.api.destroy(bot2);

            const results = library.api.getBots();
            expect(results).toEqual([bot1, bot2, bot3, bot4]);
        });

        it('should not destroy bots that are not runtime bots but the real bot is not destroyable', () => {
            bot2.tags.destroyable = false;
            library.api.destroy({ id: bot2.id, tags: {} });

            const results = library.api.getBots();
            expect(results).toEqual([bot1, bot2, bot3, bot4]);
        });

        it('should not error when given null', () => {
            library.api.destroy(null);

            const results = library.api.getBots();
            expect(results).toEqual([bot1, bot2, bot3, bot4]);
        });

        it('should not destroy other bots when destroying a bot that was already removed', () => {
            library.api.destroy(bot2);
            library.api.destroy(bot2);

            const results = library.api.getBots();
            expect(results).toEqual([bot1, bot3, bot4]);
        });

        it('should not destroy all creator bots when given a non-bot object', () => {
            bot1.tags.creator = 'a';
            bot2.tags.creator = 'b';
            bot3.tags.creator = 'c';

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
            const sayHello1 = (bot1.listeners.sayHello = jest.fn((b3) => {
                b3.tags.hit1 = true;
            }));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn((b3) => {
                b3.tags.hit2 = true;
            }));

            library.api.shout('sayHello', bot3);
            expect(sayHello1).toBeCalled();
            expect(sayHello2).toBeCalled();
            expect(bot3.tags.hit1).toEqual(true);
            expect(bot3.tags.hit2).toEqual(true);
        });

        it('should handle bots nested in an object as an argument', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn((arg) => {
                arg.bot.tags.hit1 = true;
            }));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn((arg) => {
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

        const tagCases = ['auxListening', 'listening'];
        describe.each(tagCases)('%s', (tag: string) => {
            it('should ignore bots that are not listening', () => {
                const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => 1));
                const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => 2));
                bot2.tags[tag] = false;

                const results = library.api.shout('sayHello');
                expect(results).toEqual([1]);
                expect(sayHello1).toBeCalled();
                expect(sayHello2).not.toBeCalled();
            });
        });

        it('should ignore bots where either listening tag is false', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => 1));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => 2));

            bot2.tags.auxListening = true;
            bot2.tags.listening = false;

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

        it('should send a onListen whisper to all the listening bots', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => {
                throw new Error('abc');
            }));
            const sayHello3 = (bot3.listeners.sayHello = jest.fn());
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
                listeners: [bot1, bot2, bot3], // should exclude erroring listeners
            };
            expect(onListen1).toBeCalledWith(expected);
            expect(onListen2).toBeCalledWith(expected);
            expect(onListen3).toBeCalledWith(expected);
            expect(onListen4).not.toBeCalledWith(expected);
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
                responses: [
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                ] as any[],
                targets: [bot1, bot2, bot3, bot4],
                listeners: [bot1, bot2, bot3, bot4], // should exclude erroring listeners
            };
            expect(onAnyListen4).toBeCalledWith(expected);
        });

        it('should perform an energy check', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            context.energy = 1;
            expect(() => {
                library.api.shout('sayHello');
            }).toThrowError(new RanOutOfEnergyError());
        });

        it('should only take 1 energy for multiple listeners', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => {}));
            const sayHello3 = (bot3.listeners.sayHello = jest.fn(() => {}));
            context.energy = 2;
            library.api.shout('sayHello');
            expect(context.energy).toBe(1);
        });

        it('should not perform an energy check if there are no listeners', () => {
            context.energy = 1;
            library.api.shout('sayHello');
            expect(context.energy).toBe(1);
        });

        it('should run out of energy when listeners shout to each other', () => {
            const first = (bot1.listeners.first = jest.fn(() => {
                library.api.shout('second');
            }));
            const second = (bot2.listeners.second = jest.fn(() => {
                library.api.shout('first');
            }));
            context.energy = 20;
            expect(() => {
                library.api.shout('first');
            }).toThrowError(new RanOutOfEnergyError());
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

        const tagCases = ['auxListening', 'listening'];
        describe.each(tagCases)('%s', (tag: string) => {
            it('should ignore bots that are not listening', () => {
                const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => 1));
                const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => 2));
                bot2.tags[tag] = false;
                const sayHello3 = (bot3.listeners.sayHello = jest.fn(() => 3));

                const results = library.api.whisper([bot2, bot1], 'sayHello');
                expect(results).toEqual([1]);
                expect(sayHello1).toBeCalled();
                expect(sayHello2).not.toBeCalled();
                expect(sayHello3).not.toBeCalled();
            });
        });

        it('should ignore bots where either listening tag is false', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => 1));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => 2));
            bot2.tags.auxListening = true;
            bot2.tags.listening = false;
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
                listeners: [bot1, bot2], // should exclude erroring listeners
            };
            expect(onListen1).toBeCalledWith(expected);
            expect(onListen2).toBeCalledWith(expected);
            expect(onListen3).not.toBeCalledWith(expected);
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
                responses: [undefined, undefined, undefined] as any[],
                targets: [bot1, bot2, bot3],
                listeners: [bot1, bot2, bot3], // should exclude erroring listeners
            };
            expect(onAnyListen4).toBeCalledWith(expected);
        });

        it('should ignore null bots', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            library.api.whisper([bot1, null], 'sayHello');
            expect(sayHello1).toBeCalledTimes(1);
        });

        const nullCases = [
            ['null', null],
            ['empty string', ''],
            ['undefined', undefined],
        ];
        it.each(nullCases)(
            'should do nothing when given a %s bot',
            (desc, bot) => {
                const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
                const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => {}));
                const sayHello3 = (bot3.listeners.sayHello = jest.fn(() => {}));
                library.api.whisper(bot, 'sayHello');

                expect(sayHello1).not.toBeCalled();
                expect(sayHello2).not.toBeCalled();
                expect(sayHello3).not.toBeCalled();
            }
        );

        it('should perform an energy check', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            context.energy = 1;
            expect(() => {
                library.api.whisper(bot1, 'sayHello');
            }).toThrowError(new RanOutOfEnergyError());
        });

        it('should only take 1 energy for multiple listeners', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => {}));
            context.energy = 2;
            library.api.whisper([bot1, bot2], 'sayHello');
            expect(context.energy).toBe(1);
        });

        it('should not perform an energy check if there are no listeners', () => {
            context.energy = 1;
            library.api.whisper(bot1, 'sayHello');
            expect(context.energy).toBe(1);
        });

        it('should run out of energy when listeners shout to each other', () => {
            const first = (bot1.listeners.first = jest.fn(() => {
                library.api.whisper(bot2, 'second');
            }));
            const second = (bot2.listeners.second = jest.fn(() => {
                library.api.whisper(bot1, 'first');
            }));
            context.energy = 20;
            expect(() => {
                library.api.whisper(bot1, 'first');
            }).toThrowError(new RanOutOfEnergyError());
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
            player.tags.sheetPortal = 'sheet';

            expect(library.api.player.inSheet()).toBe(true);
        });

        it('should return false if the player bot does not have a sheet portal', () => {
            expect(library.api.player.inSheet()).toBe(false);
        });
    });

    describe('player.getCameraPosition()', () => {
        let player: RuntimeBot;

        beforeEach(() => {
            player = createDummyRuntimeBot(
                'player',
                {
                    pageCameraPositionX: 1,
                    pageCameraPositionY: 2,
                    pageCameraPositionZ: 3,
                    inventoryCameraPositionX: 4,
                    inventoryCameraPositionY: 5,
                    inventoryCameraPositionZ: 6,
                },
                'tempLocal'
            );
            addToContext(context, player);
            context.playerBot = player;
        });

        it('should return NaN for x, y, and z if the player bot is null', () => {
            context.playerBot = null;
            const result = library.api.player.getCameraPosition();

            expect(result).toEqual({
                x: NaN,
                y: NaN,
                z: NaN,
            });
        });

        it('should return the x, y, and z of the player camera for the page portal', () => {
            const result = library.api.player.getCameraPosition();

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });

        it('should be able to get the inventory camera position', () => {
            const result = library.api.player.getCameraPosition('inventory');

            expect(result).toEqual({
                x: 4,
                y: 5,
                z: 6,
            });
        });

        it('should be able to get the page camera position', () => {
            const result = library.api.player.getCameraPosition('page');

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });
    });

    describe('player.getCameraRotation()', () => {
        let player: RuntimeBot;

        beforeEach(() => {
            player = createDummyRuntimeBot(
                'player',
                {
                    pageCameraRotationX: 1,
                    pageCameraRotationY: 2,
                    pageCameraRotationZ: 3,
                    inventoryCameraRotationX: 4,
                    inventoryCameraRotationY: 5,
                    inventoryCameraRotationZ: 6,
                },
                'tempLocal'
            );
            addToContext(context, player);
            context.playerBot = player;
        });

        it('should return NaN for x, y, and z if the player bot is null', () => {
            context.playerBot = null;
            const result = library.api.player.getCameraRotation();

            expect(result).toEqual({
                x: NaN,
                y: NaN,
                z: NaN,
            });
        });

        it('should return the x, y, and z of the player camera for the page portal', () => {
            const result = library.api.player.getCameraRotation();

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });

        it('should be able to get the inventory camera rotation', () => {
            const result = library.api.player.getCameraRotation('inventory');

            expect(result).toEqual({
                x: 4,
                y: 5,
                z: 6,
            });
        });

        it('should be able to get the page camera rotation', () => {
            const result = library.api.player.getCameraRotation('page');

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });
    });

    describe('player.getPointerPosition()', () => {
        let player: RuntimeBot;

        beforeEach(() => {
            player = createDummyRuntimeBot(
                'player',
                {
                    leftPointerPositionX: 1,
                    leftPointerPositionY: 2,
                    leftPointerPositionZ: 3,
                    rightPointerPositionX: 4,
                    rightPointerPositionY: 5,
                    rightPointerPositionZ: 6,
                    mousePointerPositionX: 7,
                    mousePointerPositionY: 8,
                    mousePointerPositionZ: 9,
                },
                'tempLocal'
            );
            addToContext(context, player);
            context.playerBot = player;
        });

        it('should return NaN for x, y, and z if the player bot is null', () => {
            context.playerBot = null;
            const result = library.api.player.getPointerPosition();

            expect(result).toEqual({
                x: NaN,
                y: NaN,
                z: NaN,
            });
        });

        it('should return the x, y, and z of the player camera for the mouse', () => {
            const result = library.api.player.getPointerPosition();

            expect(result).toEqual({
                x: 7,
                y: 8,
                z: 9,
            });
        });

        it('should be able to get the left pointer position', () => {
            const result = library.api.player.getPointerPosition('left');

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });

        it('should be able to get the right pointer position', () => {
            const result = library.api.player.getPointerPosition('right');

            expect(result).toEqual({
                x: 4,
                y: 5,
                z: 6,
            });
        });

        it('should be able to get the mouse pointer position', () => {
            const result = library.api.player.getPointerPosition('mouse');

            expect(result).toEqual({
                x: 7,
                y: 8,
                z: 9,
            });
        });
    });

    describe('player.getPointerRotation()', () => {
        let player: RuntimeBot;

        beforeEach(() => {
            player = createDummyRuntimeBot(
                'player',
                {
                    leftPointerRotationX: 1,
                    leftPointerRotationY: 2,
                    leftPointerRotationZ: 3,
                    rightPointerRotationX: 4,
                    rightPointerRotationY: 5,
                    rightPointerRotationZ: 6,
                    mousePointerRotationX: 7,
                    mousePointerRotationY: 8,
                    mousePointerRotationZ: 9,
                },
                'tempLocal'
            );
            addToContext(context, player);
            context.playerBot = player;
        });

        it('should return NaN for x, y, and z if the player bot is null', () => {
            context.playerBot = null;
            const result = library.api.player.getPointerRotation();

            expect(result).toEqual({
                x: NaN,
                y: NaN,
                z: NaN,
            });
        });

        it('should return the x, y, and z of the player camera for the mouse', () => {
            const result = library.api.player.getPointerRotation();

            expect(result).toEqual({
                x: 7,
                y: 8,
                z: 9,
            });
        });

        it('should be able to get the left pointer position', () => {
            const result = library.api.player.getPointerRotation('left');

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });

        it('should be able to get the right pointer position', () => {
            const result = library.api.player.getPointerRotation('right');

            expect(result).toEqual({
                x: 4,
                y: 5,
                z: 6,
            });
        });

        it('should be able to get the mouse pointer position', () => {
            const result = library.api.player.getPointerRotation('mouse');

            expect(result).toEqual({
                x: 7,
                y: 8,
                z: 9,
            });
        });
    });

    describe('player.getPointerDirection()', () => {
        let player: RuntimeBot;

        beforeEach(() => {
            player = createDummyRuntimeBot(
                'player',
                {
                    leftPointerRotationX: 0,
                    leftPointerRotationY: 0,
                    leftPointerRotationZ: -Math.PI / 2,
                    rightPointerRotationX: -Math.PI / 2,
                    rightPointerRotationY: 0,
                    rightPointerRotationZ: 0,
                    mousePointerRotationX: 0,
                    mousePointerRotationY: 0,
                    mousePointerRotationZ: 0,
                },
                'tempLocal'
            );
            addToContext(context, player);
            context.playerBot = player;
        });

        it('should return NaN for x, y, and z if the player bot is null', () => {
            context.playerBot = null;
            const result = library.api.player.getPointerDirection();

            expect(result).toEqual({
                x: NaN,
                y: NaN,
                z: NaN,
            });
        });

        it('should return the x, y, and z of the player camera for the mouse', () => {
            const result = library.api.player.getPointerDirection();

            expect(result.x).toBeCloseTo(0);
            expect(result.y).toBeCloseTo(1);
            expect(result.z).toBeCloseTo(0);
        });

        it('should be able to get the left pointer position', () => {
            const result = library.api.player.getPointerDirection('left');

            expect(result.x).toBeCloseTo(1);
            expect(result.y).toBeCloseTo(0);
            expect(result.z).toBeCloseTo(0);
        });

        it('should be able to get the right pointer position', () => {
            const result = library.api.player.getPointerDirection('right');

            expect(result.x).toBeCloseTo(0);
            expect(result.y).toBeCloseTo(0);
            expect(result.z).toBeCloseTo(-1);
        });

        it('should be able to get the mouse pointer position', () => {
            const result = library.api.player.getPointerDirection('mouse');

            expect(result.x).toBeCloseTo(0);
            expect(result.y).toBeCloseTo(1);
            expect(result.z).toBeCloseTo(0);
        });
    });

    describe('player.getInputState()', () => {
        let player: RuntimeBot;

        beforeEach(() => {
            player = createDummyRuntimeBot('player', {}, 'tempLocal');
            addToContext(context, player);
            context.playerBot = player;
        });

        it('should return null if the player bot is null', () => {
            context.playerBot = null;
            const result = library.api.player.getInputState('keyboard', 'a');

            expect(result).toEqual(null);
        });

        const cases = [
            [
                'mousePointer',
                'left',
                {
                    mousePointer_left: 'down',
                },
                'down',
            ],
            ['mousePointer', 'left', {}, null],
            [
                'mousePointer',
                'right',
                {
                    mousePointer_right: 'held',
                },
                'held',
            ],
            [
                'leftPointer',
                'primary',
                {
                    leftPointer_primary: 'held',
                },
                'held',
            ],
            [
                'rightPointer',
                'primary',
                {
                    rightPointer_primary: 'down',
                },
                'down',
            ],
            [
                'keyboard',
                'a',
                {
                    keyboard_a: 'down',
                },
                'down',
            ],
            [
                'touch',
                '0',
                {
                    touch_0: 'down',
                },
                'down',
            ],
            [
                'touch',
                '1',
                {
                    touch_1: 'held',
                },
                'held',
            ],
        ];

        it.each(cases)(
            'should get the state from the %s %s button',
            (controller, button, state, expected) => {
                for (let tag in state) {
                    player.tags[tag] = state[tag];
                }

                const result = library.api.player.getInputState(
                    controller,
                    button
                );

                expect(result).toEqual(expected);
            }
        );
    });

    describe('player.getInputList()', () => {
        let player: RuntimeBot;

        beforeEach(() => {
            player = createDummyRuntimeBot(
                'player',
                {
                    inputList: ['abc', 'def', 'ghi'],
                },
                'tempLocal'
            );
            addToContext(context, player);
            context.playerBot = player;
        });

        it('should return an empty list if the player bot is null', () => {
            context.playerBot = null;
            const result = library.api.player.getInputList();

            expect(result).toEqual([]);
        });

        it('should return an empty list if the player bot has no input list tag', () => {
            player.tags.inputList = null;
            const result = library.api.player.getInputList();

            expect(result).toEqual([]);
        });

        it('should return the input list of the player', () => {
            const result = library.api.player.getInputList();

            expect(result).toEqual(['abc', 'def', 'ghi']);
        });
    });

    describe('math.getForwardDirection()', () => {
        it('should map no rotation to the forward direction', () => {
            let dir = library.api.math.getForwardDirection({
                x: 0,
                y: 0,
                z: 0,
            });

            expect(dir.x).toBeCloseTo(0);
            expect(dir.y).toBeCloseTo(1);
            expect(dir.z).toBeCloseTo(0);
        });

        it('should map a 90 degree yaw rotation to the right hand direction', () => {
            let dir = library.api.math.getForwardDirection({
                x: 0,
                y: 0,
                z: -Math.PI / 2,
            });

            expect(dir.x).toBeCloseTo(1);
            expect(dir.y).toBeCloseTo(0);
            expect(dir.z).toBeCloseTo(0);
        });

        it('should map a 90 degree pitch rotation to the down direction', () => {
            let dir = library.api.math.getForwardDirection({
                x: -Math.PI / 2,
                y: 0,
                z: 0,
            });

            expect(dir.x).toBeCloseTo(0);
            expect(dir.y).toBeCloseTo(0);
            expect(dir.z).toBeCloseTo(-1);
        });
    });

    describe('math.intersectPlane()', () => {
        // TODO: Add more tests
        it('should return the intersection point between a ground plane and the given ray', () => {
            // Pointing straight down
            let point = library.api.math.intersectPlane(
                { x: 0, y: 0, z: 1 },
                { x: 0, y: 0, z: -1 }
            );

            expect(point.x).toBeCloseTo(0);
            expect(point.y).toBeCloseTo(0);
            expect(point.z).toBeCloseTo(0);
        });
    });

    describe('math.getAnchorPointOffset()', () => {
        const cases = [
            ['center', { x: 0, y: -0, z: 0 }],
            ['front', { x: 0, y: 0.5, z: 0 }],
            ['back', { x: 0, y: -0.5, z: 0 }],
            ['bottom', { x: 0, y: -0, z: 0.5 }],
            ['top', { x: 0, y: -0, z: -0.5 }],
            ['left', { x: 0.5, y: -0, z: 0 }],
            ['right', { x: -0.5, y: -0, z: 0 }],

            // Should mirror the coordinates when using literals
            [[1, 2, 3], { x: -1, y: 2, z: -3 }],
        ];

        it.each(cases)('should support %s', (mode: any, expected: any) => {
            expect(library.api.math.getAnchorPointOffset(mode)).toEqual(
                expected
            );
        });
    });

    describe('crypto.sha256()', () => {
        const cases = [
            [
                ['hello'],
                '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
            ],
            [
                ['🙂'],
                'd06f1525f791397809f9bc98682b5c13318eca4c3123433467fd4dffda44fd14',
            ],
            [
                ['abc', 'def'],
                'bef57ec7f53a6d40beb640a780a639c83bc29ac8a9816f1fc6c5c6dcd93c4721',
            ],
            [
                [67],
                '49d180ecf56132819571bf39d9b7b342522a2ac6d23c1418d3338251bfe469c8',
            ],
            [
                [true],
                'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
            ],
            [
                [false],
                'fcbcf165908dd18a9e49f7ff27810176db8e9f63b4352213741664245224f8aa',
            ],
            [
                [Number.POSITIVE_INFINITY],
                'd0067cad9a63e0813759a2bb841051ca73570c0da2e08e840a8eb45db6a7a010',
            ],
            [
                [Number.NEGATIVE_INFINITY],
                'c64ddf11bcd45660f0cf66dd0c22d2b4570ef3d3fc6527a9a6f6c722aefa3c39',
            ],
            [
                [Number.NaN],
                'd5b592c05dc25b5032553f1b27f4139be95e881f73db33b02b05ab20c3f9981e',
            ],
            [
                [{ abc: 'def' }],
                '2c3fbda5f48b04e39d3a87f89e5bd00b48b6e5e3c4a093de65de0a87b8cc8b3b',
            ],
            [
                [{ zyx: '123', abc: 'def' }],
                'c7e4f397690dce3230846bd71f7d28b6d0fbd14763e58d41fb2713fc74015718',
            ],
            [
                [{ zyx: '123', abc: 'def' }],
                'c7e4f397690dce3230846bd71f7d28b6d0fbd14763e58d41fb2713fc74015718',
            ],
            [
                [null],
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            ],
            [
                [undefined],
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            ],
        ];

        it.each(cases)('should hash %s', (given, expected) => {
            expect(library.api.crypto.sha256(...given)).toBe(expected);
        });

        const objectCases = [
            [
                { zyx: '123', abc: 'def' },
                'c7e4f397690dce3230846bd71f7d28b6d0fbd14763e58d41fb2713fc74015718',
            ],
            [
                { abc: 'def', zyx: '123' },
                'c7e4f397690dce3230846bd71f7d28b6d0fbd14763e58d41fb2713fc74015718',
            ],
            [
                { '123': 'hello', '456': 'world' },
                '0540a6ab3ec4db750b5092cb479c4dd10c1a7ccfe9731cff1927df0e125648a5',
            ],
            [
                { '456': 'world', '123': 'hello' },
                '0540a6ab3ec4db750b5092cb479c4dd10c1a7ccfe9731cff1927df0e125648a5',
            ],
            [
                { '🙂': 'hello', '✌': 'world' },
                '83b4bdacd5dacdc99ede50fcf65f06989aaede20b002de17c9805a2d019054d5',
            ],
            [
                { '✌': 'world', '🙂': 'hello' },
                '83b4bdacd5dacdc99ede50fcf65f06989aaede20b002de17c9805a2d019054d5',
            ],
            [
                ['world', 'hello'],
                'be3181b8eb39bf890c9d366a0fd33daea5ab5486d537c44c52d9e85af8da96c2',
            ],
            [
                ['hello', 'world'],
                '94bedb26fb1cb9547b5b77902e89522f313c7f7fe2e9f0175cfb0a244878ee07',
            ],
        ];

        it.each(objectCases)('should hash %s consistently', (obj, expected) => {
            expect(library.api.crypto.sha256(obj)).toBe(expected);
        });

        it('should hash bots consistently', () => {
            let bot1 = createDummyRuntimeBot(
                'bot1',
                {
                    abc: 'def',
                    ghi: 'jkl',
                },
                'tempLocal'
            );
            let bot2 = createDummyRuntimeBot(
                'bot1',
                {
                    ghi: 'jkl',
                    abc: 'def',
                },
                'tempLocal'
            );
            let bot3 = createDummyRuntimeBot(
                'bot1',
                {
                    ghi: 'jkl',
                    abc: 'def',
                },
                'shared'
            );
            let bot4 = createDummyRuntimeBot(
                'bot4',
                {
                    ghi: 'jkl',
                    abc: 'def',
                },
                'tempLocal'
            );
            const hash = library.api.crypto.sha256(bot1);
            expect(hash).toMatchInlineSnapshot(
                `"8c9d0a8e3cb51e189048263d4b9ea98063dd056ca76275bed41a16f59239130a"`
            );
            expect(hash).toBe(library.api.crypto.sha256(bot2));
            expect(hash).not.toBe(library.api.crypto.sha256(bot3));
            expect(hash).not.toBe(library.api.crypto.sha256(bot4));
        });
    });

    describe('crypto.sha512()', () => {
        const cases = [
            [
                ['hello'],
                '9b71d224bd62f3785d96d46ad3ea3d73319bfbc2890caadae2dff72519673ca72323c3d99ba5c11d7c7acc6e14b8c5da0c4663475c2e5c3adef46f73bcdec043',
            ],
            [
                ['🙂'],
                '5bed63c241f2830e8eb29ac8d9fea5e9441e8bb9104768c593dd46f6c97f947a160def7ce58dcba5e9d33a88e2b75fc62802d67ab30460442d23f66403b415f4',
            ],
            [
                ['abc', 'def'],
                'e32ef19623e8ed9d267f657a81944b3d07adbb768518068e88435745564e8d4150a0a703be2a7d88b61e3d390c2bb97e2d4c311fdc69d6b1267f05f59aa920e7',
            ],
            [
                [67],
                'ce4dd661e4d69073c7999282048ea9ee91932db0d699f8b13b2db70fe532d987ac4a0aef309b82e1ad2aa6c2f2f60473093cd1e399a737cff3f9e70585d36be7',
            ],
            [
                [true],
                '9120cd5faef07a08e971ff024a3fcbea1e3a6b44142a6d82ca28c6c42e4f852595bcf53d81d776f10541045abdb7c37950629415d0dc66c8d86c64a5606d32de',
            ],
            [
                [false],
                '719fa67eef49c4b2a2b83f0c62bddd88c106aaadb7e21ae057c8802b700e36f81fe3f144812d8b05d66dc663d908b25645e153262cf6d457aa34e684af9e328d',
            ],
            [
                [Number.POSITIVE_INFINITY],
                '7de872ed1c41ce3901bb7f12f20b0c0106331fe5b5ecc5fbbcf3ce6c79df4da595ebb7e221ab8b7fc5d918583eac6890ade1c26436335d3835828011204b7679',
            ],
            [
                [Number.NEGATIVE_INFINITY],
                '280bcf3496f0fbe479df09e4e6e87f48179e6364a0065ae14d9eab5902f98a74e8e8919cf35b9d881a06562e8c3b11a04d073c03ddf393791e7619d8dc215d61',
            ],
            [
                [Number.NaN],
                '441dfabd0126a33e4677d76d73e4e340c5805efdf58fe84bf4a1f7815e676f0e159be74b2de6bed17d1ff766ff1d4915ca04cb781c0c5d045e1d14886eb1f31c',
            ],
            [
                [{ abc: 'def' }],
                '3f51fd341818ef13b5943ceb3fd0972a6a2be1c3453554261b9f2a7012f3d351b5e4a8a34fce35310bcd80f85afed4b9c4e615622ca52a3fa5ea586774ada743',
            ],
            [
                [{ zyx: '123', abc: 'def' }],
                '8f2534f5d8f10fe6f78abf70de8f2c70b2286aa19ef02df494ef8e0992cb29a1e5614cdf216719b1d33d2e266a1e873c04eb08ce421bee91c52b26a702a979fc',
            ],
            [
                [null],
                'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
            ],
            [
                [undefined],
                'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
            ],
        ];

        it.each(cases)('should hash %s', (given, expected) => {
            expect(library.api.crypto.sha512(...given)).toBe(expected);
        });

        const objectCases = [
            [
                { zyx: '123', abc: 'def' },
                '8f2534f5d8f10fe6f78abf70de8f2c70b2286aa19ef02df494ef8e0992cb29a1e5614cdf216719b1d33d2e266a1e873c04eb08ce421bee91c52b26a702a979fc',
            ],
            [
                { abc: 'def', zyx: '123' },
                '8f2534f5d8f10fe6f78abf70de8f2c70b2286aa19ef02df494ef8e0992cb29a1e5614cdf216719b1d33d2e266a1e873c04eb08ce421bee91c52b26a702a979fc',
            ],
            [
                { '123': 'hello', '456': 'world' },
                '82a6687d1edca06e611f569200cdac8e15451d8537066582aca318c6236beb602f0c1cffbc8da338ffe32f80c324badc3ba3e69f03d20ecee993910d60b9702f',
            ],
            [
                { '456': 'world', '123': 'hello' },
                '82a6687d1edca06e611f569200cdac8e15451d8537066582aca318c6236beb602f0c1cffbc8da338ffe32f80c324badc3ba3e69f03d20ecee993910d60b9702f',
            ],
            [
                { '🙂': 'hello', '✌': 'world' },
                'ef52465917f42013430afe76278a58657cf8de3c3f84b1709d0aacae3a88bee5e61a31e0f9f265b58672f6630bb8d5ea2384317c1b97e30fce3eaa4a646ff6c1',
            ],
            [
                { '✌': 'world', '🙂': 'hello' },
                'ef52465917f42013430afe76278a58657cf8de3c3f84b1709d0aacae3a88bee5e61a31e0f9f265b58672f6630bb8d5ea2384317c1b97e30fce3eaa4a646ff6c1',
            ],
            [
                ['world', 'hello'],
                'be00d2974eb4998e3e629e559067f04766bf91913f9f5ce10befd6e6c048d63603178f6cf7b4d353db15e032831c63f9647204812db09212d29df1114142b754',
            ],
            [
                ['hello', 'world'],
                'f3ea9708eb605ce26918a18a24e3ca6a5f00f0455966b6fb8c65d5fe637a19a60a47b12913d5493a72acda9789bccb725feaca3a8d66a5cf94d2963fbc0cf4e6',
            ],
        ];

        it.each(objectCases)('should hash %s consistently', (obj, expected) => {
            expect(library.api.crypto.sha512(obj)).toBe(expected);
        });

        it('should hash bots consistently', () => {
            let bot1 = createDummyRuntimeBot(
                'bot1',
                {
                    abc: 'def',
                    ghi: 'jkl',
                },
                'tempLocal'
            );
            let bot2 = createDummyRuntimeBot(
                'bot1',
                {
                    ghi: 'jkl',
                    abc: 'def',
                },
                'tempLocal'
            );
            let bot3 = createDummyRuntimeBot(
                'bot1',
                {
                    ghi: 'jkl',
                    abc: 'def',
                },
                'shared'
            );
            let bot4 = createDummyRuntimeBot(
                'bot4',
                {
                    ghi: 'jkl',
                    abc: 'def',
                },
                'tempLocal'
            );
            const hash = library.api.crypto.sha512(bot1);
            expect(hash).toMatchInlineSnapshot(
                `"4edbae64a27b3da8adce1da13c7a3dcd81ff9b05f19204f6f5b4266ebde6c8a91d0bc0b3ee1c2bf9a13cae86708462645654fa47c20f084861a3a834f54b1b2f"`
            );
            expect(hash).toBe(library.api.crypto.sha512(bot2));
            expect(hash).not.toBe(library.api.crypto.sha512(bot3));
            expect(hash).not.toBe(library.api.crypto.sha512(bot4));
        });
    });

    describe('crypto.hmacSha256()', () => {
        const cases = [
            [
                ['hello'],
                'key',
                '9307b3b915efb5171ff14d8cb55fbcc798c6c0ef1456d66ded1a6aa723a58b7b',
            ],
            [
                ['🙂'],
                'key',
                '79ec106e8106784f99972a5259331c1325d63514e3eec745ea9d44dbd884c29a',
            ],
            [
                ['abc', 'def'],
                'key',
                '4c5277d3e85316d1762c7e219862a9440546171f5ae5f1b29499ff9fbdd4c56a',
            ],
            [
                [67],
                'key',
                'ecc541509c57f9b9d47ed5354d112bb55b6a65f75365cf07833676f64461c8a8',
            ],
            [
                [true],
                'key',
                '205c94f3b0222e3b464c33da902a1ae1b3a04a4494dcf7145e4228ad23333258',
            ],
            [
                [false],
                'key',
                '2efa4359b49cb498c7ffdd1b1ad6920b9d52764bfee7a7a2ee64117237fdf23c',
            ],
            [
                [Number.POSITIVE_INFINITY],
                'key',
                '38c0a7feea67ce43c10292ff37a136743b962313f1b77486e68780ded5810402',
            ],
            [
                [Number.NEGATIVE_INFINITY],
                'key',
                '4e36d71a0d8a7bf596975426c22ed528d7ab2d41b58e6dc8ff3cf073c8746035',
            ],
            [
                [Number.NaN],
                'key',
                '7f5ef14748c13f8a903dcea8a0d22a25334be45d07371fc59cafaf0b776473ee',
            ],
            [
                [{ abc: 'def' }],
                'key',
                '12bb607ecb4f82ecda3cc248821267a24e253f02c90d39264f5125a504055d54',
            ],
            [
                [{ zyx: '123', abc: 'def' }],
                'key',
                '179c61a016c55c4e92525f84ff987a32e3fbd158555186b7386558931bca66cd',
            ],
            [
                [null],
                'key',
                '5d5d139563c95b5967b9bd9a8c9b233a9dedb45072794cd232dc1b74832607d0',
            ],
            [
                [undefined],
                'key',
                '5d5d139563c95b5967b9bd9a8c9b233a9dedb45072794cd232dc1b74832607d0',
            ],
        ];

        it.each(cases)('should hash %s', (given, key, expected) => {
            expect(library.api.crypto.hmacSha256(key, ...given)).toBe(expected);
        });

        const objectCases = [
            [
                { zyx: '123', abc: 'def' },
                'key',
                '179c61a016c55c4e92525f84ff987a32e3fbd158555186b7386558931bca66cd',
            ],
            [
                { abc: 'def', zyx: '123' },
                'key',
                '179c61a016c55c4e92525f84ff987a32e3fbd158555186b7386558931bca66cd',
            ],
            [
                { '123': 'hello', '456': 'world' },
                'key',
                'd22a7cc6eaaa04f29e382a829ae5404e623971036f0d8d1448d1c82564ed71ca',
            ],
            [
                { '456': 'world', '123': 'hello' },
                'key',
                'd22a7cc6eaaa04f29e382a829ae5404e623971036f0d8d1448d1c82564ed71ca',
            ],
            [
                { '🙂': 'hello', '✌': 'world' },
                'key',
                '2bffd8725c1d6583e2264fffebf5617d0eea6f71f258df9041ed5107379e8698',
            ],
            [
                { '✌': 'world', '🙂': 'hello' },
                'key',
                '2bffd8725c1d6583e2264fffebf5617d0eea6f71f258df9041ed5107379e8698',
            ],
            [
                ['world', 'hello'],
                'key',
                '153fc5c11827588a37808916ef8814d775f6e3a72f884530544860d476d2130a',
            ],
            [
                ['hello', 'world'],
                'key',
                '66fddc9dc92816d844d6c1fa2e6f123df58c3d5afb9387a34488a6828a60baef',
            ],
        ];

        it.each(objectCases)(
            'should hash %s consistently',
            (obj, key, expected) => {
                expect(library.api.crypto.hmacSha256(key, obj)).toBe(expected);
            }
        );

        it('should hash bots consistently', () => {
            let bot1 = createDummyRuntimeBot(
                'bot1',
                {
                    abc: 'def',
                    ghi: 'jkl',
                },
                'tempLocal'
            );
            let bot2 = createDummyRuntimeBot(
                'bot1',
                {
                    ghi: 'jkl',
                    abc: 'def',
                },
                'tempLocal'
            );
            let bot3 = createDummyRuntimeBot(
                'bot1',
                {
                    ghi: 'jkl',
                    abc: 'def',
                },
                'shared'
            );
            let bot4 = createDummyRuntimeBot(
                'bot4',
                {
                    ghi: 'jkl',
                    abc: 'def',
                },
                'tempLocal'
            );
            const hash = library.api.crypto.hmacSha256('key', bot1);
            expect(hash).toMatchInlineSnapshot(
                `"451d24ef601e8ff6dfc367f6ac19cbcac1d8e8db72c183cceb801815b55dc875"`
            );
            expect(hash).toBe(library.api.crypto.hmacSha256('key', bot2));
            expect(hash).not.toBe(library.api.crypto.hmacSha256('key', bot3));
            expect(hash).not.toBe(library.api.crypto.hmacSha256('key', bot4));
        });

        it('should fail when using an empty key', () => {
            expect(() => {
                library.api.crypto.hmacSha256('', 'hello');
            }).toThrow(
                new Error('The key must not be empty, null, or undefined')
            );

            expect(() => {
                library.api.crypto.hmacSha256(null, 'hello');
            }).toThrow(
                new Error('The key must not be empty, null, or undefined')
            );

            expect(() => {
                library.api.crypto.hmacSha256(undefined, 'hello');
            }).toThrow(
                new Error('The key must not be empty, null, or undefined')
            );
        });

        it('should fail when using a non-string key', () => {
            expect(() => {
                library.api.crypto.hmacSha256(<any>{}, 'hello');
            }).toThrow(new Error('The key must be a string'));

            expect(() => {
                library.api.crypto.hmacSha256(<any>[], 'hello');
            }).toThrow(new Error('The key must be a string'));

            expect(() => {
                library.api.crypto.hmacSha256(<any>false, 'hello');
            }).toThrow(new Error('The key must be a string'));

            expect(() => {
                library.api.crypto.hmacSha256(<any>true, 'hello');
            }).toThrow(new Error('The key must be a string'));

            expect(() => {
                library.api.crypto.hmacSha256(<any>0, 'hello');
            }).toThrow(new Error('The key must be a string'));

            expect(() => {
                library.api.crypto.hmacSha256(<any>1, 'hello');
            }).toThrow(new Error('The key must be a string'));
        });
    });

    describe('crypto.hmacSha512()', () => {
        const cases = [
            [
                ['hello'],
                'key',
                'ff06ab36757777815c008d32c8e14a705b4e7bf310351a06a23b612dc4c7433e7757d20525a5593b71020ea2ee162d2311b247e9855862b270122419652c0c92',
            ],
            [
                ['🙂'],
                'key',
                'bdc92de9e2218fdd4d55de8d98f624219479cad87c6a7b4d814f559c4bc2e175b1dc283668cab48edfc420cafbff1afdca5842857bf348e9f0b0e8ada532d648',
            ],
            [
                ['abc', 'def'],
                'key',
                'e97348dbd79dff60a3c8e89f4e248b230d8c89c6021615f492510270dd82cf8154b28461fb625ff5554649225a0c3709e42f7f5d405a6f5fbaa1184e59976826',
            ],
            [
                [67],
                'key',
                'd7fb21b12a486cfca737b567354334a8e97e0bac1e55bc0a6c647e2b5a3013f532069fc0a07f24892d525976a2ea0824953ca56608500556bfd28d9829299824',
            ],
            [
                [true],
                'key',
                '92a84cd18c579c1fa626fab2b0facdb960b727e3cac7f8f21cea543382fedd18d99a1948a771ba540e5a285529c18a15bf6c275131e11f5ba13065a92327ed03',
            ],
            [
                [false],
                'key',
                '9000cf009e127f9e69a2fb3c1c5f13db96a253b9e60c477ea2ae745d845226e56112e9d0dd569c9a0f1840122bd806dae21ff53c98c94b12f607c80275cd7ef2',
            ],
            [
                [Number.POSITIVE_INFINITY],
                'key',
                'ad03855ee09aa097fab9d33768ed5e420d2965c43810640f36b56bbd6815a971df96a3af535672f90458283be5ce6cd3fa230d261a69add1484f30d0138f00e9',
            ],
            [
                [Number.NEGATIVE_INFINITY],
                'key',
                'eab4848252a948f1e0ae4af937c1b00820ee5580512a05965c29013d523a3055353834bfa87f9d2e89fec95f361682970b611839b790313053b675b6a01c2335',
            ],
            [
                [Number.NaN],
                'key',
                '7c8698212d4dd6dc82443c02a202c737bc10db008f45d2c76e39d0a237c0355360b88aa580bfd85790c7f4b566f6adb87ba706c58935747b95056b87ca33087d',
            ],
            [
                [{ abc: 'def' }],
                'key',
                'bf358fbab3ee5dcb98521e68a8e2dd4c14fa907d3d524b34958a8ac00f87be421a9ea59a17ea77889ec510800ea18b341598cbb75397d8e74313ef6245122f9b',
            ],
            [
                [{ zyx: '123', abc: 'def' }],
                'key',
                '41db5a3c3855fbf4dd4b0b4883323c46bbef513edbb17aa8ea2bc2420c4e12c78e3f3c944dc86ec74e152bd3dfd4f358e704467bef4810d0aac43f5fcbb30ef2',
            ],
            [
                [null],
                'key',
                '84fa5aa0279bbc473267d05a53ea03310a987cecc4c1535ff29b6d76b8f1444a728df3aadb89d4a9a6709e1998f373566e8f824a8ca93b1821f0b69bc2a2f65e',
            ],
            [
                [undefined],
                'key',
                '84fa5aa0279bbc473267d05a53ea03310a987cecc4c1535ff29b6d76b8f1444a728df3aadb89d4a9a6709e1998f373566e8f824a8ca93b1821f0b69bc2a2f65e',
            ],
        ];

        it.each(cases)('should hash %s', (given, key, expected) => {
            expect(library.api.crypto.hmacSha512(key, ...given)).toBe(expected);
        });

        const objectCases = [
            [
                { zyx: '123', abc: 'def' },
                'key',
                '41db5a3c3855fbf4dd4b0b4883323c46bbef513edbb17aa8ea2bc2420c4e12c78e3f3c944dc86ec74e152bd3dfd4f358e704467bef4810d0aac43f5fcbb30ef2',
            ],
            [
                { abc: 'def', zyx: '123' },
                'key',
                '41db5a3c3855fbf4dd4b0b4883323c46bbef513edbb17aa8ea2bc2420c4e12c78e3f3c944dc86ec74e152bd3dfd4f358e704467bef4810d0aac43f5fcbb30ef2',
            ],
            [
                { '123': 'hello', '456': 'world' },
                'key',
                '3305ed6725612d54962de298fbdc7d60caa1c1638e424a147062ea42fa35ce19fc2dcfd5eecb16787068c0b05edec6847b3953161d2f8464803ba5fe13a94ad6',
            ],
            [
                { '456': 'world', '123': 'hello' },
                'key',
                '3305ed6725612d54962de298fbdc7d60caa1c1638e424a147062ea42fa35ce19fc2dcfd5eecb16787068c0b05edec6847b3953161d2f8464803ba5fe13a94ad6',
            ],
            [
                { '🙂': 'hello', '✌': 'world' },
                'key',
                '319ce31fa5ac3573c8dfc8423b5eb6af0b8ead7d10a571139c61d079c2f60cbe0120471aaf44279c20849b54add37d768b768c320d22cbfae559ed351ff77162',
            ],
            [
                { '✌': 'world', '🙂': 'hello' },
                'key',
                '319ce31fa5ac3573c8dfc8423b5eb6af0b8ead7d10a571139c61d079c2f60cbe0120471aaf44279c20849b54add37d768b768c320d22cbfae559ed351ff77162',
            ],
            [
                ['world', 'hello'],
                'key',
                'd988342d1941c41b2f599dddb1402870379e9bfe11dd32aca6a22f4c5ed1b7b0655f84e81d0d8b37fb3be15705fce0842ba92ddf6bc0f55b81d2693c1f7be024',
            ],
            [
                ['hello', 'world'],
                'key',
                'dd68ae93fad71176f9be8f97c2c6bddbadb6a021ffced6c37efa78628d6f7273afa72f431e1f4e4c20c79cfb6f056bb7672fd359fb355be4cdf9e08b8349b533',
            ],
        ];

        it.each(objectCases)(
            'should hash %s consistently',
            (obj, key, expected) => {
                expect(library.api.crypto.hmacSha512(key, obj)).toBe(expected);
            }
        );

        it('should hash bots consistently', () => {
            let bot1 = createDummyRuntimeBot(
                'bot1',
                {
                    abc: 'def',
                    ghi: 'jkl',
                },
                'tempLocal'
            );
            let bot2 = createDummyRuntimeBot(
                'bot1',
                {
                    ghi: 'jkl',
                    abc: 'def',
                },
                'tempLocal'
            );
            let bot3 = createDummyRuntimeBot(
                'bot1',
                {
                    ghi: 'jkl',
                    abc: 'def',
                },
                'shared'
            );
            let bot4 = createDummyRuntimeBot(
                'bot4',
                {
                    ghi: 'jkl',
                    abc: 'def',
                },
                'tempLocal'
            );
            const hash = library.api.crypto.hmacSha512('key', bot1);
            expect(hash).toMatchInlineSnapshot(
                `"e4da2e78fe0f3762c17fd68eb9816fd43a6a11bfb65d9281b273888ce559831b2b664be9c41a58d98f452bab19f9ee70a9d22ddc0f9d8cf9d356067ed3b51e23"`
            );
            expect(hash).toBe(library.api.crypto.hmacSha512('key', bot2));
            expect(hash).not.toBe(library.api.crypto.hmacSha512('key', bot3));
            expect(hash).not.toBe(library.api.crypto.hmacSha512('key', bot4));
        });

        it('should fail when using an empty key', () => {
            expect(() => {
                library.api.crypto.hmacSha512('', 'hello');
            }).toThrow(
                new Error('The key must not be empty, null, or undefined')
            );

            expect(() => {
                library.api.crypto.hmacSha512(null, 'hello');
            }).toThrow(
                new Error('The key must not be empty, null, or undefined')
            );

            expect(() => {
                library.api.crypto.hmacSha512(undefined, 'hello');
            }).toThrow(
                new Error('The key must not be empty, null, or undefined')
            );
        });

        it('should fail when using a non-string key', () => {
            expect(() => {
                library.api.crypto.hmacSha512(<any>{}, 'hello');
            }).toThrow(new Error('The key must be a string'));

            expect(() => {
                library.api.crypto.hmacSha512(<any>[], 'hello');
            }).toThrow(new Error('The key must be a string'));

            expect(() => {
                library.api.crypto.hmacSha512(<any>false, 'hello');
            }).toThrow(new Error('The key must be a string'));

            expect(() => {
                library.api.crypto.hmacSha512(<any>true, 'hello');
            }).toThrow(new Error('The key must be a string'));

            expect(() => {
                library.api.crypto.hmacSha512(<any>0, 'hello');
            }).toThrow(new Error('The key must be a string'));

            expect(() => {
                library.api.crypto.hmacSha512(<any>1, 'hello');
            }).toThrow(new Error('The key must be a string'));
        });
    });

    describe('crypto.encrypt()', () => {
        it('should encrypt the given string with the given password', () => {
            const result = library.api.crypto.encrypt('password', 'data');
            const decrypted = decryptV1('password', result);

            const decoder = new TextDecoder();
            const final = decoder.decode(decrypted);
            expect(final).toEqual('data');
        });
    });

    describe('crypto.decrypt()', () => {
        it('should be able to decrypt the given encrypted data', () => {
            const encrypted = library.api.crypto.encrypt('password', 'data');
            const result = library.api.crypto.decrypt('password', encrypted);
            expect(result).toEqual('data');
        });

        it('should return null if the data was not able to be decrypted', () => {
            const result = library.api.crypto.decrypt('password', 'wrong');
            expect(result).toBe(null);
        });
    });

    describe('crypto.keypair()', () => {
        it('should create and return a keypair', () => {
            const result = library.api.crypto.keypair('password');
            expect(typeof result).toEqual('string');
        });
    });

    describe('crypto.sign()', () => {
        it('should create and return a signature for the given data', () => {
            const keypair = library.api.crypto.keypair('password');
            const signature = library.api.crypto.sign(
                keypair,
                'password',
                'abc'
            );
            const valid = library.api.crypto.verify(keypair, signature, 'abc');
            expect(typeof signature).toBe('string');
            expect(valid).toBe(true);
        });

        it('should throw if the wrong password was given', () => {
            const keypair = library.api.crypto.keypair('password');
            expect(() => {
                library.api.crypto.sign(keypair, 'wrong', 'abc');
            }).toThrow();
        });
    });

    describe('crypto.verify()', () => {
        it('should create and return a signature for the given data', () => {
            const keypair = library.api.crypto.keypair('password');
            const signature = library.api.crypto.sign(
                keypair,
                'password',
                'abc'
            );
            const valid = library.api.crypto.verify(keypair, signature, 'abc');
            expect(typeof signature).toBe('string');
            expect(valid).toBe(true);
        });

        it('should throw if the wrong password was given', () => {
            const keypair = library.api.crypto.keypair('password');
            expect(() => {
                library.api.crypto.verify(keypair, 'wrong', 'abc');
            }).toThrow();
        });
    });

    const keypair1 =
        'vK1.X9EJQT0znVqXj7D0kRyLSF1+F5u2bT7xKunF/H/SUxU=.djEueE1FL0VkOU1VanNaZGEwUDZ3cnlicjF5bnExZFptVzcubkxrNjV4ckdOTlM3Si9STGQzbGUvbUUzUXVEdmlCMWQucWZocVJQT21KeEhMbXVUWThORGwvU0M0dGdOdUVmaDFlcFdzMndYUllHWWxRZWpJRWthb1dJNnVZdXdNMFJVUTFWamkyc3JwMUpFTWJobk5sZ2Y2d01WTzRyTktDaHpwcUZGbFFnTUg0ZVU9';
    describe('crypto.createCertificate()', () => {
        it('should emit a CreateCertificateAction for self-signed certs', () => {
            const promise: any = library.api.crypto.createCertificate(
                null,
                'password',
                keypair1
            );

            const expected = createCertificate(
                {
                    keypair: keypair1,
                    signingPassword: 'password',
                },
                context.tasks.size
            );
            expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
            expect(context.actions).toEqual([expected]);
        });

        it('should emit a CreateCertificateAction for normal certs', () => {
            const cert = createDummyRuntimeBot('test1', {}, CERTIFIED_SPACE);
            addToContext(context, cert);
            const promise: any = library.api.crypto.createCertificate(
                cert,
                'password',
                keypair1
            );

            const expected = createCertificate(
                {
                    keypair: keypair1,
                    signingBotId: 'test1',
                    signingPassword: 'password',
                },
                context.tasks.size
            );
            expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
            expect(context.actions).toEqual([expected]);
        });

        it('should be able to be given a bot ID', () => {
            const promise: any = library.api.crypto.createCertificate(
                'test1',
                'password',
                keypair1
            );

            const expected = createCertificate(
                {
                    keypair: keypair1,
                    signingBotId: 'test1',
                    signingPassword: 'password',
                },
                context.tasks.size
            );
            expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
            expect(context.actions).toEqual([expected]);
        });
    });

    describe('crypto.signTag()', () => {
        let bot1: RuntimeBot;
        let cert: RuntimeBot;
        beforeEach(() => {
            cert = createDummyRuntimeBot('test1', {}, CERTIFIED_SPACE);
            bot1 = createDummyRuntimeBot('bot1', {
                abc: 'def',
            });
            addToContext(context, bot1, cert);
        });

        it('should emit a SignTagAction', () => {
            const promise: any = library.api.crypto.signTag(
                'test1',
                'password',
                'bot1',
                'abc'
            );

            const expected = signTag(
                'test1',
                'password',
                'bot1',
                'abc',
                'def',
                context.tasks.size
            );
            expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
            expect(context.actions).toEqual([expected]);
        });

        it('should support using an # symbol at the beginning of a tag', () => {
            const promise: any = library.api.crypto.signTag(
                'test1',
                'password',
                'bot1',
                '#abc'
            );

            const expected = signTag(
                'test1',
                'password',
                'bot1',
                'abc',
                'def',
                context.tasks.size
            );
            expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
            expect(context.actions).toEqual([expected]);
        });

        it('should support using an @ symbol at the beginning of a tag', () => {
            const promise: any = library.api.crypto.signTag(
                'test1',
                'password',
                'bot1',
                '@abc'
            );

            const expected = signTag(
                'test1',
                'password',
                'bot1',
                'abc',
                'def',
                context.tasks.size
            );
            expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
            expect(context.actions).toEqual([expected]);
        });

        it('should be able to be given bots', () => {
            const promise: any = library.api.crypto.signTag(
                cert,
                'password',
                bot1,
                'abc'
            );

            const expected = signTag(
                'test1',
                'password',
                'bot1',
                'abc',
                'def',
                context.tasks.size
            );
            expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
            expect(context.actions).toEqual([expected]);
        });
    });

    describe('crypto.verifyTag()', () => {
        let bot1: RuntimeBot;
        beforeEach(() => {
            bot1 = createDummyRuntimeBot(
                'bot1',
                {
                    abc: 'def',
                },
                undefined,
                {
                    [tagValueHash('bot1', 'abc', 'def')]: 'abc',
                }
            );
            addToContext(context, bot1);
        });

        it('should return true if the bot has a signature for the given tag', () => {
            const result = library.api.crypto.verifyTag(bot1, 'abc');
            expect(result).toBe(true);
        });

        it('should return false if the bot does not have a signature for the given tag', () => {
            const result = library.api.crypto.verifyTag(bot1, 'missing');
            expect(result).toBe(false);
        });

        it('should return false if the bot has a signature for the given tag but the value is different', () => {
            bot1.tags.abc = 'different';
            const result = library.api.crypto.verifyTag(bot1, 'abc');
            expect(result).toBe(false);
        });

        it('should support using an # symbol at the beginning of a tag', () => {
            const result = library.api.crypto.verifyTag(bot1, '#abc');
            expect(result).toBe(true);
        });

        it('should support using an @ symbol at the beginning of a tag', () => {
            const result = library.api.crypto.verifyTag(bot1, '@abc');
            expect(result).toBe(true);
        });
    });

    describe('crypto.revokeCertificate()', () => {
        let bot1: RuntimeBot;
        let cert: RuntimeBot;
        beforeEach(() => {
            cert = createDummyRuntimeBot('test1', {}, CERTIFIED_SPACE);
            bot1 = createDummyRuntimeBot('bot1', {
                abc: 'def',
            });
            addToContext(context, bot1, cert);
        });

        it('should emit a RevokeCertificateAction', () => {
            const promise: any = library.api.crypto.revokeCertificate(
                'test1',
                'password',
                'bot1'
            );

            const expected = revokeCertificate(
                'bot1',
                'password',
                'test1',
                context.tasks.size
            );
            expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
            expect(context.actions).toEqual([expected]);
        });

        it('should be able to be given bots', () => {
            const promise: any = library.api.crypto.revokeCertificate(
                cert,
                'password',
                bot1
            );

            const expected = revokeCertificate(
                'bot1',
                'password',
                'test1',
                context.tasks.size
            );
            expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
            expect(context.actions).toEqual([expected]);
        });

        it('should be able to be given a single bot', () => {
            const promise: any = library.api.crypto.revokeCertificate(
                cert,
                'password'
            );

            const expected = revokeCertificate(
                'test1',
                'password',
                'test1',
                context.tasks.size
            );
            expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
            expect(context.actions).toEqual([expected]);
        });
    });
});
