import {
    AuxLibrary,
    createDefaultLibrary,
    GetRecordsResult,
    TagSpecificApiOptions,
} from './AuxLibrary';
import {
    AuxGlobalContext,
    addToContext,
    MemoryGlobalContext,
    SET_INTERVAL_ANIMATION_FRAME_TIME,
    WatchBotTimer,
    DEBUG_STRING,
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
    setupServer,
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
    getRemoteCount,
    getServers,
    getRemotes,
    action,
    getServerStatuses,
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
    serialFlushPin,
    serialDrainPin,
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
    RuntimeBot,
    SET_TAG_MASK_SYMBOL,
    CLEAR_CHANGES_SYMBOL,
    animateTag,
    showUploadFiles,
    registerPrefix,
    circleWipe,
    animateToPosition,
    beginAudioRecording,
    endAudioRecording,
    cancelAnimation,
    addDropSnap,
    beginRecording,
    endRecording,
    speakText,
    getVoices,
    getGeolocation,
    enablePOV,
    disablePOV,
    botUpdated,
    enableCustomDragging,
    registerCustomApp,
    setAppOutput,
    unregisterCustomApp,
    requestAuthData,
    AuthData,
    defineGlobalBot,
    Bot,
    TEMPORARY_BOT_PARTITION_ID,
    publishRecord,
    getRecords,
    GetRecordsActionResult,
    requestPermanentAuthToken,
    deleteRecord,
    TEMPORARY_SHARED_PARTITION_ID,
    COOKIE_BOT_PARTITION_ID,
    PartialBotsState,
} from '../bots';
import { types } from 'util';
import {
    possibleTagNameCases,
    possibleTagValueCases,
} from '../bots/test/BotTestHelpers';
import { remote } from '@casual-simulation/causal-trees';
import { v4 as uuid } from 'uuid';
import {
    TestScriptBotFactory,
    createDummyRuntimeBot,
    testScriptBotInterface,
} from './test/TestScriptBotFactory';
import { RuntimeBatcher } from './RuntimeBot';
import { AuxVersion } from './AuxVersion';
import { AuxDevice } from './AuxDevice';
import { shuffle } from 'lodash';
import {
    asymmetricDecryptV1,
    asymmetricKeypairV1,
    decryptV1,
    keypair,
} from '@casual-simulation/crypto';
import { CERTIFIED_SPACE } from '../aux-format-2/AuxWeaveReducer';
import {
    del,
    edit,
    insert,
    preserve,
    remoteEdit,
    tagValueHash,
} from '../aux-format-2';
import { RanOutOfEnergyError } from './AuxResults';
import { Subscription, SubscriptionLike } from 'rxjs';
import { waitAsync } from '../test/TestHelpers';
import { embedBase64InPdf, formatAuthToken } from './Utils';
import { fromByteArray, toByteArray } from 'base64-js';
import { Fragment } from 'preact';
import fastJsonStableStringify from '@casual-simulation/fast-json-stable-stringify';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

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
            isCollaborative: true,
            ab1BootstrapUrl: 'bootstrapURL',
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

    const falsyCases = [['false', false] as const, ['0', 0] as const];
    const emptyCases = [
        ['null', null as any] as const,
        ['empty string', ''] as const,
    ];
    const numberCases = [
        ['0', 0] as const,
        ['1', 1] as const,
        ['true', true] as const,
        ['false', false] as const,
    ];
    const trimEventCases = [
        ['parenthesis', 'sayHello()'] as const,
        ['hashtag', '#sayHello'] as const,
        ['hashtag and parenthesis', '#sayHello()'] as const,
        ['@ symbol', '@sayHello'] as const,
        ['@ symbol and parenthesis', '@sayHello()'] as const,
    ];

    describe('<mock func>.mask().returns()', () => {
        beforeEach(() => {
            context.mockAsyncActions = true;
            library = createDefaultLibrary(context);
        });

        it('should setup a mock for the given arguments that returns the given value', () => {
            library.api.webhook.mask('hello').returns('world');

            const value = context.getNextMockReturn(
                library.api.webhook,
                'webhook',
                ['hello']
            );
            expect(value).toBe('world');
        });
    });

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

        it('should be able to get a bot by ID', () => {
            const bots = library.api.getBots('id', bot1.id);
            expect(bots).toEqual([bot1]);
        });
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
            ['null', null as any] as const,
            ['empty string', ''] as const,
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

        it('should be able to get a bot by ID', () => {
            const bot = library.api.getBot('id', bot1.id);
            expect(bot).toEqual(bot1);
        });
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

                it('should only match exactly when no IDs are in the link', () => {
                    const filter = library.api.byTag('link', `🔗`);

                    bot1.tags.link = '🔗';
                    expect(filter(bot1)).toBe(true);

                    bot1.tags.link = '🔗a';
                    expect(filter(bot1)).toBe(false);
                });

                it('should support when given value is a bot link and the tag links to that bot', () => {
                    const filter = library.api.byTag('link', `🔗id2`);

                    bot1.tags.link = '🔗id1';
                    expect(filter(bot1)).toBe(false);

                    bot1.tags.link = '🔗';
                    expect(filter(bot1)).toBe(false);

                    bot1.tags.link = '🔗id1,id2';
                    expect(filter(bot1)).toBe(true);

                    bot1.tags.link = '🔗id2';
                    expect(filter(bot1)).toBe(true);
                });

                it('should support when the given value is a bot link and the tag has that bot ID', () => {
                    const filter = library.api.byTag('link', `🔗id2`);

                    bot1.tags.link = 'id1';
                    expect(filter(bot1)).toBe(false);

                    bot1.tags.link = 'id2';
                    expect(filter(bot1)).toBe(true);
                });

                it('should support when the given value links to multiple bots and the tag links to those bots', () => {
                    const filter = library.api.byTag('link', `🔗id2,id1`);

                    bot1.tags.link = '🔗id1';
                    expect(filter(bot1)).toBe(false);

                    bot1.tags.link = '🔗id2';
                    expect(filter(bot1)).toBe(false);

                    bot1.tags.link = '🔗id1,id2';
                    expect(filter(bot1)).toBe(true);

                    bot1.tags.link = '🔗id2,id1';
                    expect(filter(bot1)).toBe(true);

                    bot1.tags.link = '🔗id1,id2,id3';
                    expect(filter(bot1)).toBe(true);

                    bot1.tags.link = '🔗id3,id2,id1';
                    expect(filter(bot1)).toBe(true);

                    bot1.tags.link = '🔗id1,id3,id2';
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

        describe('byID()', () => {
            let bot1: RuntimeBot;

            beforeEach(() => {
                bot1 = createDummyRuntimeBot('test1');

                addToContext(context, bot1);
            });

            it('should return true if the bot has the given ID', () => {
                const filter = library.api.byID('test1');
                expect(filter(bot1)).toBe(true);
            });

            it('should return false if the bot has a different ID', () => {
                const filter = library.api.byID('wrong');
                expect(filter(bot1)).toBe(false);
            });

            it('should contain a toJSON() function that returns the record filter object', () => {
                const result: any = library.api.byID('myID');

                expect(result.toJSON).toBeInstanceOf(Function);
                expect(result[DEBUG_STRING]).toBe('byID("myID")');
                expect(result.toJSON()).toEqual({
                    recordFilter: true,
                    id: 'myID',
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

            it('should return true for bots that are close to the target position', () => {
                const filter = library.api.atPosition('#red', 1.001, 2.001);

                bot1.tags.red = true;
                bot1.tags.redX = 1;
                bot1.tags.redY = 2;
                bot1.tags.redSortOrder = 100;

                expect(filter(bot1)).toBe(true);
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

            it('should return true for bots that are close to each other', () => {
                bot1.tags.red = true;
                bot1.tags.redX = 1;
                bot1.tags.redY = 2;
                const filter = library.api.inStack(bot1, '#red');

                bot2.tags.red = true;
                bot2.tags.redX = 1.001;
                bot2.tags.redY = 2.003;
                bot2.tags.redSortOrder = 100;

                expect(filter(bot2)).toBe(true);
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
                ['front', 0, -1] as const,
                ['back', 0, 1] as const,
                ['left', 1, 0] as const,
                ['right', -1, 0] as const,
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

        it('should use the original object', () => {
            const obj = {
                abc: 'def',
                [ORIGINAL_OBJECT]: {
                    something: 'else',
                },
            };

            const json = library.api.getJSON(obj);
            expect(json).toEqual(JSON.stringify(obj[ORIGINAL_OBJECT]));
        });

        const commonCases: [string, any][] = [
            ['object', { abc: 'def' }],
            ['array', ['abc', 'def']],
            ['number', 123],
            ['string', 'abc'],
            ['boolean', true],
            ['null', null],
        ];

        it.each(commonCases)('should support %s', (type, value) => {
            const json = library.api.getJSON(value);
            expect(json).toEqual(JSON.stringify(value));
        });
    });

    describe('getFormattedJSON()', () => {
        let bot1: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');

            addToContext(context, bot1);
        });

        it('should convert objects to JSON', () => {
            const json = library.api.getFormattedJSON({ abc: 'def' });

            expect(json).toEqual(
                fastJsonStableStringify(
                    {
                        abc: 'def',
                    },
                    { space: 2 }
                )
            );
        });

        it('should convert bots to JSON', () => {
            bot1.tags.abc = 'def';

            const json = library.api.getFormattedJSON(bot1);
            expect(json).toEqual(fastJsonStableStringify(bot1, { space: 2 }));
        });

        it('should use the original object', () => {
            const obj = {
                abc: 'def',
                [ORIGINAL_OBJECT]: {
                    something: 'else',
                },
            };

            const json = library.api.getFormattedJSON(obj);
            expect(json).toEqual(
                fastJsonStableStringify(obj[ORIGINAL_OBJECT], { space: 2 })
            );
        });

        const commonCases: [string, any][] = [
            ['object', { abc: 'def' }],
            ['array', ['abc', 'def']],
            ['number', 123],
            ['string', 'abc'],
            ['boolean', true],
            ['null', null],
        ];

        it.each(commonCases)('should support %s', (type, value) => {
            const json = library.api.getFormattedJSON(value);
            expect(json).toEqual(fastJsonStableStringify(value, { space: 2 }));
        });
    });

    describe('getSnapshot()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;
        let bot3: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');
            bot3 = createDummyRuntimeBot('test3', {}, 'tempLocal');

            addToContext(context, bot1, bot2, bot3);
        });

        it('should return an object that contains the bots state of the given bot', () => {
            bot1.tags.abc = 'def';
            bot2.tags.b = true;
            const snapshot = library.api.getSnapshot(bot1);

            expect(snapshot).toEqual({
                test1: {
                    id: 'test1',
                    tags: {
                        abc: 'def',
                    },
                },
            });
        });

        it('should return an object that contains the bots state of the given bots', () => {
            bot1.tags.abc = 'def';
            bot2.tags.b = true;
            const snapshot = library.api.getSnapshot([bot1, bot2]);

            expect(snapshot).toEqual({
                test1: {
                    id: 'test1',
                    tags: {
                        abc: 'def',
                    },
                },
                test2: {
                    id: 'test2',
                    tags: {
                        b: true,
                    },
                },
            });
        });

        it('should return an object that contains tag masks', () => {
            bot1.tags.abc = 'def';
            bot2.tags.b = true;
            library.api.setTagMask(
                bot2,
                'abc',
                'tempLocal',
                TEMPORARY_BOT_PARTITION_ID
            );
            library.api.setTagMask(
                bot2,
                'abc',
                'tempShared',
                TEMPORARY_SHARED_PARTITION_ID
            );
            const snapshot = library.api.getSnapshot([bot1, bot2]);

            expect(snapshot).toEqual({
                test1: {
                    id: 'test1',
                    tags: {
                        abc: 'def',
                    },
                },
                test2: {
                    id: 'test2',
                    tags: {
                        b: true,
                    },
                    masks: {
                        tempLocal: {
                            abc: 'tempLocal',
                        },
                        tempShared: {
                            abc: 'tempShared',
                        },
                    },
                },
            });
        });

        it('should include the space that the bots are in', () => {
            bot1.tags.abc = 'def';
            const snapshot = library.api.getSnapshot([bot1, bot3]);

            expect(snapshot).toEqual({
                test1: {
                    id: 'test1',
                    tags: {
                        abc: 'def',
                    },
                },
                test3: {
                    id: 'test3',
                    space: 'tempLocal',
                    tags: {},
                },
            });
        });

        it('should return a copy of the bot tags', () => {
            bot1.tags.abc = 'def';
            const snapshot = library.api.getSnapshot([bot1]);
            bot1.tags.abc = 123;

            expect(snapshot).toEqual({
                test1: {
                    id: 'test1',
                    tags: {
                        abc: 'def',
                    },
                },
            });
        });

        it('should return a copy of the bot tag masks', () => {
            bot1.tags.abc = 'def';
            bot2.tags.b = true;
            library.api.setTagMask(
                bot2,
                'abc',
                'tempLocal',
                TEMPORARY_BOT_PARTITION_ID
            );
            library.api.setTagMask(
                bot2,
                'abc',
                'tempShared',
                TEMPORARY_SHARED_PARTITION_ID
            );
            const snapshot = library.api.getSnapshot([bot1, bot2]);

            library.api.setTagMask(
                bot2,
                'abc',
                'wrong',
                TEMPORARY_BOT_PARTITION_ID
            );
            library.api.setTagMask(
                bot2,
                'abc',
                'wrong',
                TEMPORARY_SHARED_PARTITION_ID
            );

            expect(snapshot).toEqual({
                test1: {
                    id: 'test1',
                    tags: {
                        abc: 'def',
                    },
                },
                test2: {
                    id: 'test2',
                    tags: {
                        b: true,
                    },
                    masks: {
                        tempLocal: {
                            abc: 'tempLocal',
                        },
                        tempShared: {
                            abc: 'tempShared',
                        },
                    },
                },
            });
        });

        it('should not include tag masks if they are all set to null', () => {
            bot1.tags.abc = 'def';
            bot2.tags.b = true;
            library.api.setTagMask(
                bot2,
                'abc',
                null,
                TEMPORARY_BOT_PARTITION_ID
            );
            library.api.setTagMask(
                bot2,
                'abc',
                null,
                TEMPORARY_SHARED_PARTITION_ID
            );
            const snapshot = library.api.getSnapshot([bot1, bot2]);

            expect(snapshot).toEqual({
                test1: {
                    id: 'test1',
                    tags: {
                        abc: 'def',
                    },
                },
                test2: {
                    id: 'test2',
                    tags: {
                        b: true,
                    },
                },
            });
        });
    });

    describe('diffSnapshots()', () => {
        it('should return an object that contains diff between the two given states', () => {
            let state1: BotsState = {
                bot1: createBot('bot1', {
                    abc: 'def',
                }),
                bot2: createBot('bot2', {
                    num: 123,
                }),
                bot3: createBot('bot3', {
                    bool: true,
                }),
                bot4: {
                    id: 'bot4',
                    tags: {},
                    masks: {
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            value: 'yes',
                        },
                    },
                },
                bot5: createBot('bot5'),
                bot6: {
                    id: 'bot6',
                    tags: {},
                    masks: {
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            value: 'yes',
                        },
                        [COOKIE_BOT_PARTITION_ID]: {
                            num: 789,
                        },
                    },
                },
            };
            let state2: BotsState = {
                bot1: createBot('bot1', {
                    abc: 'def',
                }),
                bot2: createBot('bot2', {
                    num: 456,
                }),
                bot3: createBot('bot3', {}),
                bot4: {
                    id: 'bot4',
                    tags: {},
                    masks: {
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            newValue: {},
                            value: 'different',
                        },
                    },
                },
                bot6: {
                    id: 'bot6',
                    tags: {},
                },
            };

            let diff: PartialBotsState = library.api.diffSnapshots(
                state1,
                state2
            );

            expect(diff).toEqual({
                bot2: {
                    tags: {
                        num: 456,
                    },
                },
                bot3: {
                    tags: {
                        bool: null,
                    },
                },
                bot4: {
                    masks: {
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            newValue: {},
                            value: 'different',
                        },
                    },
                },
                bot5: null,
                bot6: {
                    masks: {
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            value: null,
                        },
                        [COOKIE_BOT_PARTITION_ID]: {
                            num: null,
                        },
                    },
                },
            });
        });
    });

    describe('applyDiffToSnapshot()', () => {
        it('should be able to add bots to a snapshot', () => {
            const state1: BotsState = {
                bot1: createBot(
                    'bot1',
                    {
                        abc: 'def',
                    },
                    'tempLocal'
                ),
            };

            const diff: PartialBotsState = {
                bot2: createBot('bot2', {
                    newBot: true,
                }),
            };

            expect(library.api.applyDiffToSnapshot(state1, diff)).toEqual({
                bot1: createBot(
                    'bot1',
                    {
                        abc: 'def',
                    },
                    'tempLocal'
                ),
                bot2: createBot('bot2', {
                    newBot: true,
                }),
            });
        });

        it('should be able to update a tag on a bot', () => {
            const state1: BotsState = {
                bot1: createBot('bot1', {
                    abc: 'def',
                }),
            };

            const diff: PartialBotsState = {
                bot1: {
                    tags: {
                        abc: 'different',
                    },
                },
            };

            expect(library.api.applyDiffToSnapshot(state1, diff)).toEqual({
                bot1: createBot('bot1', {
                    abc: 'different',
                }),
            });
        });

        it('should be able to delete a tag on a bot', () => {
            const state1: BotsState = {
                bot1: createBot('bot1', {
                    abc: 'def',
                }),
            };

            const diff: PartialBotsState = {
                bot1: {
                    tags: {
                        abc: null,
                    },
                },
            };

            expect(library.api.applyDiffToSnapshot(state1, diff)).toEqual({
                bot1: createBot('bot1', {}),
            });
        });

        it('should be able to update a tag mask on a bot', () => {
            const state1: BotsState = {
                bot1: createBot('bot1', {
                    abc: 'def',
                }),
            };

            const diff: PartialBotsState = {
                bot1: {
                    masks: {
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            abc: 'different',
                        },
                    },
                },
            };

            expect(library.api.applyDiffToSnapshot(state1, diff)).toEqual({
                bot1: {
                    id: 'bot1',
                    tags: {
                        abc: 'def',
                    },
                    masks: {
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            abc: 'different',
                        },
                    },
                },
            });
        });

        it('should be able to delete a tag mask on a bot', () => {
            const state1: BotsState = {
                bot1: {
                    id: 'bot1',
                    tags: {},
                    masks: {
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            abc: 'def',
                        },
                    },
                },
            };

            const diff: PartialBotsState = {
                bot1: {
                    masks: {
                        [TEMPORARY_BOT_PARTITION_ID]: {
                            abc: null,
                        },
                    },
                },
            };

            expect(library.api.applyDiffToSnapshot(state1, diff)).toEqual({
                bot1: {
                    id: 'bot1',
                    tags: {},
                },
            });
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

        it('should get the original object', () => {
            const mod = library.api.getMod({
                abc: true,
                val: 123,
                [ORIGINAL_OBJECT]: {
                    something: 'else',
                },
            });
            expect(mod).toEqual({
                something: 'else',
            });
        });
    });

    describe('getBotPosition()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);
        });

        it('should return the position of the bot in the given dimension', () => {
            bot1.tags.homeX = 5;
            bot1.tags.homeY = 1;
            bot1.tags.homeZ = 9;
            const position = library.api.getBotPosition(bot1, 'home');

            expect(position).toEqual({
                x: 5,
                y: 1,
                z: 9,
            });
        });

        it('should support bot IDs', () => {
            bot1.tags.homeX = 5;
            bot1.tags.homeY = 1;
            bot1.tags.homeZ = 9;
            const position = library.api.getBotPosition(bot1.id, 'home');

            expect(position).toEqual({
                x: 5,
                y: 1,
                z: 9,
            });
        });

        it('should throw an error if given null', () => {
            expect(() => {
                library.api.getBotPosition(null, 'home');
            }).toThrow();
        });

        it('should throw an error if given a missing bot ID', () => {
            expect(() => {
                library.api.getBotPosition('missing', 'home');
            }).toThrow();
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

        describe('os.toast()', () => {
            it('should emit a ShowToastAction', () => {
                let action = library.api.os.toast('hello, world!');

                expect(action).toEqual(toast('hello, world!'));
                expect(context.actions).toEqual([toast('hello, world!')]);
            });

            it('should convert bots to copiable values', () => {
                let action = library.api.os.toast(bot1 as any);

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
                let action = library.api.os.toast(null);

                expect(action).toEqual(toast(null));
            });

            const cases: [any, any][] = [
                ['abc', 'abc'],
                [0, 0],
                [
                    new Date('16 Nov 2021 14:32:14 GMT'),
                    new Date('16 Nov 2021 14:32:14 GMT'),
                ],
                [{ abc: 'def' }, { abc: 'def' }],
            ];

            it.each(cases)('should convert %s to %s', (given, expected) => {
                expect(library.api.os.toast(given)).toEqual(toast(expected));
            });
        });

        describe('os.showJoinCode()', () => {
            it('should emit a ShowJoinCodeEvent', () => {
                const action = library.api.os.showJoinCode();
                expect(action).toEqual(showJoinCode());
                expect(context.actions).toEqual([showJoinCode()]);
            });

            it('should allow linking to a specific inst and dimension', () => {
                const action = library.api.os.showJoinCode(
                    'server',
                    'dimension'
                );
                expect(action).toEqual(showJoinCode('server', 'dimension'));
                expect(context.actions).toEqual([
                    showJoinCode('server', 'dimension'),
                ]);
            });
        });

        describe('os.requestFullscreenMode()', () => {
            it('should issue a request_fullscreen action', () => {
                const action = library.api.os.requestFullscreenMode();
                expect(action).toEqual(requestFullscreen());
                expect(context.actions).toEqual([requestFullscreen()]);
            });
        });

        describe('os.exitFullscreenMode()', () => {
            it('should issue a exit_fullscreen_mode action', () => {
                const action = library.api.os.exitFullscreenMode();
                expect(action).toEqual(exitFullscreen());
                expect(context.actions).toEqual([exitFullscreen()]);
            });
        });

        describe('os.showHtml()', () => {
            it('should issue a show_html action', () => {
                const action = library.api.os.showHtml('hello, world!');
                expect(action).toEqual(html('hello, world!'));
                expect(context.actions).toEqual([html('hello, world!')]);
            });
        });

        describe('os.hideHtml()', () => {
            it('should issue a hide_html action', () => {
                const action = library.api.os.hideHtml();
                expect(action).toEqual(hideHtml());
                expect(context.actions).toEqual([hideHtml()]);
            });
        });

        describe('os.setClipboard()', () => {
            it('should emit a SetClipboardEvent', () => {
                const action = library.api.os.setClipboard('test');
                expect(action).toEqual(setClipboard('test'));
                expect(context.actions).toEqual([setClipboard('test')]);
            });
        });

        describe('os.tweenTo()', () => {
            it('should emit a FocusOnBotAction', () => {
                const action = library.api.os.tweenTo('test');
                expect(action).toEqual(tweenTo('test'));
                expect(context.actions).toEqual([tweenTo('test')]);
            });

            it('should handle bots', () => {
                const action = library.api.os.tweenTo(bot1);
                expect(action).toEqual(tweenTo(bot1.id));
                expect(context.actions).toEqual([tweenTo(bot1.id)]);
            });

            it('should support specifying a duration', () => {
                const action = library.api.os.tweenTo(
                    'test',
                    undefined,
                    undefined,
                    undefined,
                    10
                );
                expect(action).toEqual(tweenTo('test', { duration: 10 }));
                expect(context.actions).toEqual([
                    tweenTo('test', { duration: 10 }),
                ]);
            });

            it('should convert the rotation values to radians', () => {
                const action = library.api.os.tweenTo(
                    'test',
                    undefined,
                    60,
                    180,
                    10
                );
                const expected = tweenTo('test', {
                    duration: 10,
                    rotation: {
                        x: Math.PI / 3,
                        y: Math.PI,
                    },
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.moveTo()', () => {
            it('should emit a FocusOnBotAction with the duration set to 0', () => {
                const action = library.api.os.moveTo('test');
                expect(action).toEqual(tweenTo('test', { duration: 0 }));
                expect(context.actions).toEqual([
                    tweenTo('test', { duration: 0 }),
                ]);
            });
        });

        describe('os.focusOn()', () => {
            it('should emit a FocusOnBotAction', () => {
                const action: any = library.api.os.focusOn('test');
                const expected = tweenTo(
                    'test',
                    {
                        duration: 1,
                        easing: 'quadratic',
                    },
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should handle bots', () => {
                const action: any = library.api.os.focusOn(bot1);
                const expected = tweenTo(
                    bot1.id,
                    {
                        duration: 1,
                        easing: 'quadratic',
                    },
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support specifying custom options', () => {
                const action: any = library.api.os.focusOn('test', {
                    duration: 10,
                    rotation: {
                        x: 5,
                        y: 6,
                    },
                    zoom: 9,
                    easing: 'linear',
                });
                const expected = tweenTo(
                    'test',
                    {
                        duration: 10,
                        rotation: {
                            x: 5,
                            y: 6,
                        },
                        zoom: 9,
                        easing: 'linear',
                    },
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should emit a FocusOnPositionAction if given a position', () => {
                const action: any = library.api.os.focusOn({
                    x: 20,
                    y: 10,
                });
                const expected = animateToPosition(
                    { x: 20, y: 10 },
                    {
                        duration: 1,
                        easing: 'quadratic',
                    },
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should emit a CancelAnimationAction if given null', () => {
                const action: any = library.api.os.focusOn(null);
                const expected = cancelAnimation(context.tasks.size);
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should throw if given undefined', () => {
                expect(() => {
                    library.api.os.focusOn(undefined);
                }).toThrow();
            });
        });

        describe('os.showChat()', () => {
            it('should emit a ShowChatBarAction', () => {
                const action = library.api.os.showChat();
                expect(action).toEqual(showChat());
                expect(context.actions).toEqual([showChat()]);
            });

            it('should emit a ShowChatBarAction with the given prefill', () => {
                const action = library.api.os.showChat('test');
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
                const action = library.api.os.showChat({
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

        describe('os.hideChat()', () => {
            it('should emit a ShowChatBarAction', () => {
                const action = library.api.os.hideChat();
                expect(action).toEqual(hideChat());
                expect(context.actions).toEqual([hideChat()]);
            });
        });

        describe('os.run()', () => {
            it('should emit a RunScriptAction', () => {
                const action: any = library.api.os.run('abc');
                const expected = runScript('abc', context.tasks.size);
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.version()', () => {
            it('should return an object with version information', () => {
                const v = library.api.os.version();
                expect(v).toEqual(version);
            });
        });

        describe('os.device()', () => {
            it('should return an object with device information', () => {
                const d = library.api.os.device();
                expect(d).toEqual(device);
            });

            it('should return info with null values if not specified', () => {
                context.device = null;
                const d = library.api.os.device();
                expect(d).toEqual({
                    supportsAR: null,
                    supportsVR: null,
                    isCollaborative: null,
                    ab1BootstrapUrl: null,
                });
            });
        });

        describe('os.isCollaborative()', () => {
            it('should return true when the device is collaborative', () => {
                device.isCollaborative = true;
                const d = library.api.os.isCollaborative();
                expect(d).toEqual(true);
            });

            it('should return false when the device is not collaborative', () => {
                device.isCollaborative = false;
                const d = library.api.os.isCollaborative();
                expect(d).toEqual(false);
            });

            it('should return true when no device is available', () => {
                version = {
                    hash: 'hash',
                    version: 'v1.2.3',
                    major: 1,
                    minor: 2,
                    patch: 3,
                };
                device = null;
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

                const d = library.api.os.isCollaborative();
                expect(d).toEqual(true);
            });
        });

        describe('os.getAB1BootstrapURL()', () => {
            it('should return the device bootstrap URL', () => {
                device.ab1BootstrapUrl = 'bootstrap';
                const d = library.api.os.getAB1BootstrapURL();
                expect(d).toEqual('bootstrap');
            });

            it('should return https://bootstrap.casualos.com/ab1.aux when no device is available', () => {
                version = {
                    hash: 'hash',
                    version: 'v1.2.3',
                    major: 1,
                    minor: 2,
                    patch: 3,
                };
                device = null;
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

                const d = library.api.os.getAB1BootstrapURL();
                expect(d).toEqual('https://bootstrap.casualos.com/ab1.aux');
            });
        });

        describe('os.enableAR()', () => {
            it('should issue an EnableARAction', () => {
                const action = library.api.os.enableAR();
                expect(action).toEqual(enableAR());
                expect(context.actions).toEqual([enableAR()]);
            });
        });

        describe('os.disableAR()', () => {
            it('should issue an EnableVRAction', () => {
                const action = library.api.os.disableAR();
                expect(action).toEqual(disableAR());
                expect(context.actions).toEqual([disableAR()]);
            });
        });

        describe('os.enableVR()', () => {
            it('should issue an EnableVRAction', () => {
                const action = library.api.os.enableVR();
                expect(action).toEqual(enableVR());
                expect(context.actions).toEqual([enableVR()]);
            });
        });

        describe('os.disableVR()', () => {
            it('should issue an EnableVRAction', () => {
                const action = library.api.os.disableVR();
                expect(action).toEqual(disableVR());
                expect(context.actions).toEqual([disableVR()]);
            });
        });

        describe('os.enablePointOfView()', () => {
            it('should issue an EnablePOVAction', () => {
                const action = library.api.os.enablePointOfView({
                    x: 0,
                    y: 1,
                    z: 2,
                });
                const expected = enablePOV({
                    x: 0,
                    y: 1,
                    z: 2,
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should default the center to 0,0,0', () => {
                const action = library.api.os.enablePointOfView();
                const expected = enablePOV({
                    x: 0,
                    y: 0,
                    z: 0,
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should be able to specify using the IMU', () => {
                const action = library.api.os.enablePointOfView(
                    undefined,
                    true
                );
                const expected = enablePOV(
                    {
                        x: 0,
                        y: 0,
                        z: 0,
                    },
                    true
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.disablePointOfView()', () => {
            it('should issue an EnablePOVAction', () => {
                const action = library.api.os.disablePointOfView();
                expect(action).toEqual(disablePOV());
                expect(context.actions).toEqual([disablePOV()]);
            });
        });

        describe('os.download()', () => {
            it('should emit a DownloadAction with the string data', () => {
                const action = library.api.os.download('abcdef', 'test.txt');
                const expected = download('abcdef', 'test.txt', 'text/plain');
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should download objects as JSON', () => {
                const action = library.api.os.download(
                    { abc: 'def' },
                    'test.json'
                );
                const expected = download(
                    JSON.stringify({ abc: 'def' }),
                    'test.json',
                    'application/json'
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should download array buffers as binary', () => {
                const action = library.api.os.download(
                    new ArrayBuffer(20),
                    'test.zip'
                );
                const expected = download(
                    new ArrayBuffer(20),
                    'test.zip',
                    'application/zip'
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should download blobs as whatever they are', () => {
                const action = library.api.os.download(
                    new Blob([], { type: 'my-type' }),
                    'test.zip'
                );
                const expected = download(
                    new Blob([], { type: 'my-type' }),
                    'test.zip',
                    'my-type'
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should allow specifying a custom content type', () => {
                const action = library.api.os.download(
                    'my XML',
                    'test.xml',
                    'application/xml'
                );
                const expected = download(
                    'my XML',
                    'test.xml',
                    'application/xml'
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            const extensionCases = [
                ['.xml', 'application/xml'],
                ['.mp4', 'video/mp4'],
                ['.mkv', 'video/x-matroska'],
                ['.txt', 'text/plain'],
                ['.js', 'application/javascript'],
                ['.json', 'application/json'],
            ];

            it.each(extensionCases)(
                'should add %s for %s MIME types',
                (extension, mimeType) => {
                    const action = library.api.os.download(
                        new Blob(['abc'], {
                            type: mimeType,
                        }),
                        'file'
                    );
                    const expected = download(
                        new Blob(['abc'], {
                            type: mimeType,
                        }),
                        'file' + extension,
                        mimeType
                    );
                    expect(action).toEqual(expected);
                    expect(context.actions).toEqual([expected]);
                }
            );

            it('should not add an extension for unknown MIME types', () => {
                const action = library.api.os.download(
                    new Blob(['abc'], {
                        type: 'unknown',
                    }),
                    'file'
                );
                const expected = download(
                    new Blob(['abc'], {
                        type: 'unknown',
                    }),
                    'file',
                    'unknown'
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should allow manually specifying a different extension', () => {
                const action = library.api.os.download(
                    new Blob(['abc'], {
                        type: 'text/plain',
                    }),
                    'file.json'
                );
                const expected = download(
                    new Blob(['abc'], {
                        type: 'text/plain',
                    }),
                    'file.json',
                    'text/plain'
                );
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.downloadBots()', () => {
            it('should emit a DownloadAction with the given bots formatted as JSON', () => {
                const action = library.api.os.downloadBots(
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
                const action = library.api.os.downloadBots(
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

                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create a PDF if the .pdf extension is used', () => {
                const action = library.api.os.downloadBots(
                    [bot1, bot2],
                    'test.pdf'
                );
                const json = JSON.stringify({
                    version: 1,
                    state: {
                        [bot1.id]: bot1,
                        [bot2.id]: bot2,
                    },
                });
                const encoder = new TextEncoder();
                const bytes = encoder.encode(json);
                const base64 = fromByteArray(bytes);

                const expected = download(
                    embedBase64InPdf(base64),
                    'test.pdf',
                    'application/pdf'
                );

                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create PDFs that can be parsed', () => {
                const action = library.api.os.downloadBots(
                    [bot1, bot2],
                    'test.pdf'
                );

                const bots = library.api.os.parseBotsFromData(action.data);

                expect(bots).toEqual([
                    createBot(bot1.id, bot1.tags),
                    createBot(bot2.id, bot2.tags),
                ]);
            });
        });

        describe('os.downloadServer()', () => {
            let bot3: RuntimeBot;
            let player: RuntimeBot;

            beforeEach(() => {
                bot3 = createDummyRuntimeBot('test3');
                player = createDummyRuntimeBot(
                    'player',
                    {
                        inst: 'channel',
                    },
                    'tempLocal'
                );
                addToContext(context, bot3, player);
                context.playerBot = player;
            });

            it('should emit a DownloadAction with the current state and server name', () => {
                const action = library.api.os.downloadServer();
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
                const bot7 = createDummyRuntimeBot('test7', {}, 'admin');
                addToContext(context, bot4, bot5, bot6, bot7);
                const action = library.api.os.downloadServer();
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

        describe('os.showUploadAuxFile()', () => {
            it('should emit a showUploadAuxFileAction', () => {
                const action = library.api.os.showUploadAuxFile();
                expect(action).toEqual(showUploadAuxFile());
                expect(context.actions).toEqual([showUploadAuxFile()]);
            });
        });

        describe('os.showUploadFiles()', () => {
            it('should emit a ShowUploadFileAction', () => {
                const promise: any = library.api.os.showUploadFiles();
                const expected = showUploadFiles(context.tasks.size);
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.openQRCodeScanner()', () => {
            it('should emit a OpenQRCodeScannerAction', () => {
                const action = library.api.os.openQRCodeScanner();
                expect(action).toEqual(openQRCodeScanner(true));
                expect(context.actions).toEqual([openQRCodeScanner(true)]);
            });

            it('should use the given camera type', () => {
                const action = library.api.os.openQRCodeScanner('front');
                expect(action).toEqual(openQRCodeScanner(true, 'front'));
                expect(context.actions).toEqual([
                    openQRCodeScanner(true, 'front'),
                ]);
            });
        });

        describe('os.closeQRCodeScanner()', () => {
            it('should emit a OpenQRCodeScannerAction', () => {
                const action = library.api.os.closeQRCodeScanner();
                expect(action).toEqual(openQRCodeScanner(false));
                expect(context.actions).toEqual([openQRCodeScanner(false)]);
            });
        });

        describe('os.showQRCode()', () => {
            it('should emit a ShowQRCodeAction', () => {
                const action = library.api.os.showQRCode('abc');
                expect(action).toEqual(showQRCode(true, 'abc'));
                expect(context.actions).toEqual([showQRCode(true, 'abc')]);
            });
        });

        describe('os.hideQRCode()', () => {
            it('should emit a ShowQRCodeAction', () => {
                const action = library.api.os.hideQRCode();
                expect(action).toEqual(showQRCode(false));
                expect(context.actions).toEqual([showQRCode(false)]);
            });
        });

        describe('os.openBarcodeScanner()', () => {
            it('should emit a OpenBarcodeScannerAction', () => {
                const action = library.api.os.openBarcodeScanner();
                expect(action).toEqual(openBarcodeScanner(true));
                expect(context.actions).toEqual([openBarcodeScanner(true)]);
            });

            it('should use the given camera type', () => {
                const action = library.api.os.openBarcodeScanner('front');
                expect(action).toEqual(openBarcodeScanner(true, 'front'));
                expect(context.actions).toEqual([
                    openBarcodeScanner(true, 'front'),
                ]);
            });
        });

        describe('os.closeBarcodeScanner()', () => {
            it('should emit a OpenBarcodeScannerAction', () => {
                const action = library.api.os.closeBarcodeScanner();
                expect(action).toEqual(openBarcodeScanner(false));
                expect(context.actions).toEqual([openBarcodeScanner(false)]);
            });
        });

        describe('os.showBarcode()', () => {
            it('should emit a ShowBarcodeAction', () => {
                const action = library.api.os.showBarcode('hello');
                expect(action).toEqual(showBarcode(true, 'hello'));
                expect(context.actions).toEqual([showBarcode(true, 'hello')]);
            });

            it('should include the given format', () => {
                const action = library.api.os.showBarcode(
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

        describe('os.hideBarcode()', () => {
            it('should emit a ShowBarcodeAction', () => {
                const action = library.api.os.hideBarcode();
                expect(action).toEqual(showBarcode(false));
                expect(context.actions).toEqual([showBarcode(false)]);
            });
        });

        describe('os.loadServer()', () => {
            it('should emit a LoadServerAction', () => {
                const action = library.api.os.loadServer('abc');
                expect(action).toEqual(loadSimulation('abc'));
                expect(context.actions).toEqual([loadSimulation('abc')]);
            });
        });

        describe('os.unloadServer()', () => {
            it('should emit a UnloadServerAction', () => {
                const action = library.api.os.unloadServer('abc');
                expect(action).toEqual(unloadSimulation('abc'));
                expect(context.actions).toEqual([unloadSimulation('abc')]);
            });
        });

        describe('os.importAUX()', () => {
            it('should emit a ImportAUXEvent', () => {
                const action = library.api.os.importAUX('abc');
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
                const action = library.api.os.importAUX(json);
                expect(action).toEqual(addState(uploadState));
                expect(context.actions).toEqual([addState(uploadState)]);
            });

            it('should be able to parse PDF files', () => {
                const uploadState: BotsState = {
                    [bot1.id]: createBot(bot1.id, bot1.tags),
                };
                const downloadAction = library.api.os.downloadBots(
                    [bot1],
                    'test.pdf'
                );
                const action = library.api.os.importAUX(downloadAction.data);
                expect(action).toEqual(addState(uploadState));
                expect(context.actions.slice(1)).toEqual([
                    addState(uploadState),
                ]);
            });
        });

        describe('os.parseBotsFromData()', () => {
            it('should return the list of bots that are in the given JSON', () => {
                const json = JSON.stringify({
                    version: 1,
                    state: {
                        [bot1.id]: bot1,
                        [bot2.id]: bot2,
                    },
                });

                const bots = library.api.os.parseBotsFromData(json);

                expect(bots).toEqual([
                    createBot(bot1.id, bot1.tags),
                    createBot(bot2.id, bot2.tags),
                ]);
            });

            it('should return the list of bots that are in the given PDF', () => {
                const json = JSON.stringify({
                    version: 1,
                    state: {
                        [bot1.id]: bot1,
                        [bot2.id]: bot2,
                    },
                });
                const encoder = new TextEncoder();
                const bytes = encoder.encode(json);
                const base64 = fromByteArray(bytes);
                const pdf = embedBase64InPdf(base64);

                const bots = library.api.os.parseBotsFromData(pdf);

                expect(bots).toEqual([
                    createBot(bot1.id, bot1.tags),
                    createBot(bot2.id, bot2.tags),
                ]);
            });

            it('should return null if the data is not JSON or a PDF', () => {
                const bots = library.api.os.parseBotsFromData('abcdef');
                expect(bots).toEqual(null);
            });

            it('should return null if the data in the PDF is not bots', () => {
                const pdf = embedBase64InPdf('abcdefghijfk');

                const bots = library.api.os.parseBotsFromData(pdf);

                expect(bots).toEqual(null);
            });
        });

        describe('os.replaceDragBot()', () => {
            it('should send a replace_drag_bot event', () => {
                const action = library.api.os.replaceDragBot(bot1);
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
                const action = library.api.os.replaceDragBot(bot1);
                const bot = action.bot as any;
                expect(bot).not.toBe(bot1);
                for (let key in bot) {
                    expect(types.isProxy(bot[key])).toBe(false);
                }
            });
        });

        describe('os.isInDimension()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot(
                    'player',
                    {
                        inst: 'channel',
                    },
                    'tempLocal'
                );
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return true when gridPortal equals the given value', () => {
                player.tags.gridPortal = 'dimension';
                const result = library.api.os.isInDimension('dimension');
                expect(result).toEqual(true);
            });

            it('should return false when gridPortal does not equal the given value', () => {
                player.tags.gridPortal = 'dimension';
                const result = library.api.os.isInDimension('abc');
                expect(result).toEqual(false);
            });

            it('should return false when gridPortal is not set', () => {
                const result = library.api.os.isInDimension('dimension');
                expect(result).toEqual(false);
            });

            it.each(numberCases)(
                'should support "%s" when given %s',
                (expected, given) => {
                    player.tags.gridPortal = given;
                    const result = library.api.os.isInDimension(expected);
                    expect(result).toEqual(true);
                }
            );
        });

        describe('os.getCurrentDimension()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot(
                    'player',
                    {
                        inst: 'channel',
                    },
                    'tempLocal'
                );
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return gridPortal', () => {
                player.tags.gridPortal = 'dimension';
                const result = library.api.os.getCurrentDimension();
                expect(result).toEqual('dimension');
            });

            it('should return undefined when gridPortal is not set', () => {
                const result = library.api.os.getCurrentDimension();
                expect(result).toBeUndefined();
            });

            it.each(numberCases)(
                'should return "%s" when given %s',
                (expected, given) => {
                    player.tags.gridPortal = given;
                    const result = library.api.os.getCurrentDimension();
                    expect(result).toEqual(expected);
                }
            );
        });

        describe('os.getCurrentServer()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return inst', () => {
                player.tags.inst = 'server';
                const result = library.api.os.getCurrentServer();
                expect(result).toEqual('server');
            });

            it('should return undefined when inst is not set', () => {
                const result = library.api.os.getCurrentServer();
                expect(result).toBeUndefined();
            });

            it.each(numberCases)(
                'should return "%s" when given %s',
                (expected, given) => {
                    player.tags.inst = given;
                    const result = library.api.os.getCurrentServer();
                    expect(result).toEqual(expected);
                }
            );
        });

        describe('os.getCurrentInst()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return inst', () => {
                player.tags.inst = 'inst';
                const result = library.api.os.getCurrentInst();
                expect(result).toEqual('inst');
            });

            it('should return undefined when inst is not set', () => {
                const result = library.api.os.getCurrentInst();
                expect(result).toBeUndefined();
            });

            it.each(numberCases)(
                'should return "%s" when given %s',
                (expected, given) => {
                    player.tags.inst = given;
                    const result = library.api.os.getCurrentInst();
                    expect(result).toEqual(expected);
                }
            );
        });

        describe('os.getMiniPortalDimension()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return the miniGridPortal tag from the user bot', () => {
                player.tags.miniGridPortal = 'abc';
                const result = library.api.os.getMiniPortalDimension();
                expect(result).toEqual('abc');
            });

            it.each(numberCases)(
                'should return "%s" when given %s',
                (expected, given) => {
                    player.tags.miniGridPortal = given;
                    const result = library.api.os.getMiniPortalDimension();
                    expect(result).toEqual(expected);
                }
            );
        });

        describe('os.getMenuDimension()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return the menuPortal tag from the user bot', () => {
                player.tags.menuPortal = 'abc';
                const result = library.api.os.getMenuDimension();
                expect(result).toEqual('abc');
            });

            it.each(numberCases)(
                'should return "%s" when given %s',
                (expected, given) => {
                    player.tags.menuPortal = given;
                    const result = library.api.os.getMenuDimension();
                    expect(result).toEqual(expected);
                }
            );
        });

        describe('os.getPortalDimension()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            const cases = [
                ['grid', 'gridDimension'],
                ['gridPortal', 'gridDimension'],
                ['inventory', 'inventoryDimension'],
                ['inventoryPortal', 'inventoryDimension'],
                ['miniGrid', 'miniDimension'],
                ['miniGridPortal', 'miniDimension'],
                ['menu', 'menuDimension'],
                ['menuPortal', 'menuDimension'],
                ['sheet', 'sheetDimension'],
                ['sheetPortal', 'sheetDimension'],
                ['missing', null],
                ['falsy', null],
            ];

            describe.each(cases)('%s', (portal, expectedDimension) => {
                it(`should get the dimension for the ${portal} portal`, () => {
                    player.tags.gridPortal = 'gridDimension';
                    player.tags.inventoryPortal = 'inventoryDimension';
                    player.tags.miniGridPortal = 'miniDimension';
                    player.tags.menuPortal = 'menuDimension';
                    player.tags.sheetPortal = 'sheetDimension';
                    player.tags.falsy = false;
                    player.tags.number = 0;
                    const result = library.api.os.getPortalDimension(portal);
                    expect(result).toEqual(expectedDimension);
                });

                it.each(numberCases)(
                    'should return "%s" when given %s',
                    (expected, given) => {
                        player.tags.gridPortal = given;
                        player.tags.inventoryPortal = given;
                        player.tags.miniGridPortal = given;
                        player.tags.menuPortal = given;
                        player.tags.sheetPortal = given;
                        player.tags.falsy = false;
                        player.tags.number = 0;
                        const result =
                            library.api.os.getPortalDimension(portal);

                        if (expectedDimension) {
                            expect(result).toEqual(expected);
                        } else {
                            expect(result).toEqual(null);
                        }
                    }
                );
            });
        });

        describe('os.getDimensionalDepth()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return 0 when the bot is in the given dimension', () => {
                player.tags.dimension = true;
                const result = library.api.os.getDimensionalDepth('dimension');
                expect(result).toEqual(0);
            });

            const portalCases = [...KNOWN_PORTALS.map((p) => [p])];

            it.each(portalCases)(
                'should return 1 when the dimension is in the %s portal',
                (portal) => {
                    player.tags[portal] = 'dimension';
                    const result =
                        library.api.os.getDimensionalDepth('dimension');
                    expect(result).toEqual(1);
                }
            );

            it('should return -1 otherwise', () => {
                const result = library.api.os.getDimensionalDepth('dimension');
                expect(result).toEqual(-1);
            });
        });

        describe('os.showInputForTag()', () => {
            it('should emit a ShowInputForTagAction', () => {
                const action = library.api.os.showInputForTag(bot1, 'abc');
                expect(action).toEqual(showInputForTag(bot1.id, 'abc'));
                expect(context.actions).toEqual([
                    showInputForTag(bot1.id, 'abc'),
                ]);
            });

            it('should support passing a bot ID', () => {
                const action = library.api.os.showInputForTag('test', 'abc');
                expect(action).toEqual(showInputForTag('test', 'abc'));
                expect(context.actions).toEqual([
                    showInputForTag('test', 'abc'),
                ]);
            });

            it('should trim the first hash from the tag', () => {
                const first = library.api.os.showInputForTag('test', '##abc');
                expect(first).toEqual(showInputForTag('test', '#abc'));
                const second = library.api.os.showInputForTag('test', '#abc');
                expect(second).toEqual(showInputForTag('test', 'abc'));
                expect(context.actions).toEqual([
                    showInputForTag('test', '#abc'),
                    showInputForTag('test', 'abc'),
                ]);
            });

            it('should support extra options', () => {
                const action = library.api.os.showInputForTag('test', 'abc', {
                    backgroundColor: 'red',
                    foregroundColor: 'green',
                });
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

        describe('os.showInput()', () => {
            it('should emit a ShowInputAction', () => {
                const promise: any = library.api.os.showInput();
                const expected = showInput(
                    undefined,
                    undefined,
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support passing the current value', () => {
                const promise: any = library.api.os.showInput('abc');
                const expected = showInput(
                    'abc',
                    undefined,
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support passing extra options', () => {
                const promise: any = library.api.os.showInput('abc', {
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

            describe('mock', () => {
                beforeEach(() => {
                    context.mockAsyncActions = true;
                    library = createDefaultLibrary(context);
                });

                it('should return the mocked value when setup to mock', () => {
                    library.api.os.showInput.mask('test').returns('mocked');
                    const result: any = library.api.os.showInput('test');

                    expect(result).toEqual('mocked');
                });
            });
        });

        describe('os.goToDimension()', () => {
            it('should issue a GoToDimension event', () => {
                const action = library.api.os.goToDimension('abc');
                expect(action).toEqual(goToDimension('abc'));
                expect(context.actions).toEqual([goToDimension('abc')]);
            });

            it('should ignore extra parameters', () => {
                const action = (<any>library.api.os.goToDimension)(
                    'abc',
                    'def'
                );
                expect(action).toEqual(goToDimension('abc'));
                expect(context.actions).toEqual([goToDimension('abc')]);
            });
        });

        describe('os.goToURL()', () => {
            it('should issue a GoToURL event', () => {
                const action = library.api.os.goToURL('abc');
                expect(action).toEqual(goToURL('abc'));
                expect(context.actions).toEqual([goToURL('abc')]);
            });
        });

        describe('os.openURL()', () => {
            it('should issue a OpenURL event', () => {
                const action = library.api.os.openURL('abc');
                expect(action).toEqual(openURL('abc'));
                expect(context.actions).toEqual([openURL('abc')]);
            });
        });

        describe('os.openDevConsole()', () => {
            it('should issue a OpenConsole event', () => {
                const action = library.api.os.openDevConsole();
                expect(action).toEqual(openConsole());
                expect(context.actions).toEqual([openConsole()]);
            });
        });

        describe('os.checkout()', () => {
            it('should emit a start checkout event', () => {
                const action = library.api.os.checkout({
                    publishableKey: 'key',
                    productId: 'ID1',
                    title: 'Product 1',
                    description: '$50.43',
                    processingInst: 'channel2',
                });
                const expected = checkout({
                    publishableKey: 'key',
                    productId: 'ID1',
                    title: 'Product 1',
                    description: '$50.43',
                    processingInst: 'channel2',
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.playSound()', () => {
            it('should emit a PlaySoundEvent', () => {
                const promise: any = library.api.os.playSound('abc');
                const expected = playSound(
                    'abc',
                    context.tasks.size,
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.bufferSound()', () => {
            it('should emit a BufferSoundEvent', () => {
                const promise: any = library.api.os.bufferSound('abc');
                const expected = bufferSound('abc', context.tasks.size);
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.cancelSound()', () => {
            it('should emit a CancelSoundEvent', () => {
                const promise: any = library.api.os.cancelSound(1);
                const expected = cancelSound(1, context.tasks.size);
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should be able to take a PlaySoundEvent', () => {
                const event = {
                    [ORIGINAL_OBJECT]: playSound('abc', 1),
                };
                const promise: any = library.api.os.cancelSound(event);
                const expected = cancelSound(1, context.tasks.size);
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.hasBotInMiniPortal()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot('player', {}, 'tempLocal');
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should return true if the given bot is in the users miniGridPortal dimension', () => {
                player.tags.miniGridPortal = 'abc';
                bot1.tags.abc = true;
                const result = library.api.os.hasBotInMiniPortal(bot1);
                expect(result).toEqual(true);
            });

            it('should return true if all the given bots are in the users miniGridPortal dimension', () => {
                player.tags.miniGridPortal = 'abc';
                bot1.tags.abc = true;
                bot2.tags.abc = true;
                const result = library.api.os.hasBotInMiniPortal([bot1, bot2]);
                expect(result).toEqual(true);
            });

            it('should return false if one of the given bots are not in the users miniGridPortal dimension', () => {
                player.tags.miniGridPortal = 'abc';
                bot1.tags.abc = false;
                bot2.tags.abc = true;
                const result = library.api.os.hasBotInMiniPortal([bot1, bot2]);
                expect(result).toEqual(false);
            });

            it('should return false if the player does not have an miniGridPortal', () => {
                bot1.tags.abc = true;
                bot2.tags.abc = true;
                const result = library.api.os.hasBotInMiniPortal([bot1, bot2]);
                expect(result).toEqual(false);
            });
        });

        describe('os.share()', () => {
            it('should return a ShareAction', () => {
                const promise: any = library.api.os.share({
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

        describe('os.closeCircleWipe()', () => {
            it('should return a OpenCircleWipeAction', () => {
                const promise: any = library.api.os.closeCircleWipe({
                    color: 'green',
                    duration: 5,
                });
                const expected = circleWipe(
                    false,
                    {
                        color: 'green',
                        duration: 5,
                    },
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should have reasonable defaults', () => {
                const promise: any = library.api.os.closeCircleWipe();
                const expected = circleWipe(
                    false,
                    {
                        color: 'black',
                        duration: 1,
                    },
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.openCircleWipe()', () => {
            it('should return a OpenCircleWipeAction', () => {
                const promise: any = library.api.os.openCircleWipe({
                    color: 'green',
                    duration: 5,
                });
                const expected = circleWipe(
                    true,
                    {
                        color: 'green',
                        duration: 5,
                    },
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should have reasonable defaults', () => {
                const promise: any = library.api.os.openCircleWipe();
                const expected = circleWipe(
                    true,
                    {
                        color: 'black',
                        duration: 1,
                    },
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.addDropSnap()', () => {
            it('should return a AddDropSnapTargetAction', () => {
                const action = library.api.os.addDropSnap('grid');
                const expected = addDropSnap(null, ['grid']);
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should accept a list of targets', () => {
                const action = library.api.os.addDropSnap('grid', 'face', {
                    position: {
                        x: 1,
                        y: 2,
                        z: 3,
                    },
                    distance: 1,
                });
                const expected = addDropSnap(null, [
                    'grid',
                    'face',
                    {
                        position: {
                            x: 1,
                            y: 2,
                            z: 3,
                        },
                        distance: 1,
                    },
                ]);
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.addBotDropSnap()', () => {
            it('should return a AddDropSnapTargetAction', () => {
                const action = library.api.os.addBotDropSnap('test', 'grid');
                const expected = addDropSnap('test', ['grid']);
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should accept a bot', () => {
                const action = library.api.os.addBotDropSnap(bot1, 'grid');
                const expected = addDropSnap(bot1.id, ['grid']);
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should accept a list of targets', () => {
                const action = library.api.os.addBotDropSnap(
                    bot1,
                    'grid',
                    'face',
                    {
                        position: {
                            x: 1,
                            y: 2,
                            z: 3,
                        },
                        distance: 1,
                    }
                );
                const expected = addDropSnap(bot1.id, [
                    'grid',
                    'face',
                    {
                        position: {
                            x: 1,
                            y: 2,
                            z: 3,
                        },
                        distance: 1,
                    },
                ]);
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.enableCustomDragging()', () => {
            it('should return a EnableCustomDraggingAction', () => {
                const action = library.api.os.enableCustomDragging();
                const expected = enableCustomDragging();
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.log()', () => {
            let logMock: jest.Mock<any>;
            let consoleLog: any;

            beforeEach(() => {
                consoleLog = console.log;
                logMock = console.log = jest.fn();
            });

            afterEach(() => {
                console.log = consoleLog;
            });

            it('should pipe everything to console.log', () => {
                library.api.os.log('This', 'is', 'a', 'test');
                expect(logMock).toBeCalledWith('This', 'is', 'a', 'test');
            });
        });

        describe('os.getGeolocation()', () => {
            it('should return a GetGeolocationAction action', () => {
                const promise: any = library.api.os.getGeolocation();
                const expected = getGeolocation(context.tasks.size);
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('portal.registerPrefix()', () => {
            it('should return a RegisterPrefix action', () => {
                const promise: any = library.api.portal.registerPrefix('test');
                const expected = registerPrefix(
                    'test',
                    {
                        language: 'javascript',
                    },
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support custom options', () => {
                const promise: any = library.api.portal.registerPrefix('test', {
                    language: 'jsx',
                });
                const expected = registerPrefix(
                    'test',
                    {
                        language: 'jsx',
                    },
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.registerTagPrefix()', () => {
            it('should return a RegisterPrefix action', () => {
                const promise: any = library.api.os.registerTagPrefix('test');
                const expected = registerPrefix(
                    'test',
                    {
                        language: 'javascript',
                    },
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support custom options', () => {
                const promise: any = library.api.os.registerTagPrefix('test', {
                    language: 'jsx',
                });
                const expected = registerPrefix(
                    'test',
                    {
                        language: 'jsx',
                    },
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.registerApp()', () => {
            it('should return a RegisterCustomPortal action', () => {
                const promise: any = library.api.os.registerApp(
                    'testPortal',
                    bot1
                );
                const expected = registerCustomApp(
                    'testPortal',
                    bot1.id,
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.unregisterApp()', () => {
            it('should return a UnregisterCustomPortal action', () => {
                const promise: any = library.api.os.unregisterApp('testPortal');
                const expected = unregisterCustomApp(
                    'testPortal',
                    context.tasks.size
                );
                expect(promise[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.compileApp()', () => {
            it('should return a SetPortalOutput action', () => {
                const promise: any = library.api.os.compileApp(
                    'testPortal',
                    'hahaha'
                );
                const expected = setAppOutput('testPortal', 'hahaha');
                expect(promise).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('os.requestAuthBot()', () => {
            it('should send a RequestAuthDataAction', () => {
                const promise: any = library.api.os.requestAuthBot();
                const expected = requestAuthData(context.tasks.size);

                expect(context.actions).toEqual([expected]);
            });

            it('should create a bot with the given resolved data', async () => {
                const promise = library.api.os.requestAuthBot();

                let resultBot: Bot;
                promise.then((bot) => {
                    resultBot = bot;
                });

                const expected = requestAuthData(context.tasks.size);

                expect(context.actions).toEqual([expected]);

                // Resolve RequestAuthDataAction
                context.resolveTask(
                    1,
                    {
                        userId: 'myUserId',
                        service: 'myService',
                        token: 'myToken',
                        avatarUrl: 'myAvatarUrl',
                        name: 'name',
                    } as AuthData,
                    false
                );

                await waitAsync();

                // Resolve DefineGlobalBotAction
                context.resolveTask(2, null, false);

                await waitAsync();

                expect(resultBot.id).toEqual('myUserId');
                expect(resultBot.tags.authToken).toEqual(
                    formatAuthToken('myToken', 'myService')
                );
                expect(resultBot.tags.authBundle).toEqual('myService');
                expect(resultBot.tags.avatarAddress).toEqual('myAvatarUrl');
                expect(resultBot.tags.name).toEqual('name');
            });

            it('should emit a DefineGlobalBotAction', async () => {
                const promise: any = library.api.os.requestAuthBot();

                const expected = requestAuthData(context.tasks.size);

                expect(context.actions).toEqual([expected]);

                context.resolveTask(
                    1,
                    {
                        userId: 'myUserId',
                        service: 'myService',
                        token: 'myToken',
                        avatarUrl: 'myAvatarUrl',
                        name: 'name',
                    },
                    false
                );

                await waitAsync();

                expect(context.actions).toEqual([
                    expected,
                    botAdded(
                        createBot(
                            'myUserId',
                            {
                                authToken: formatAuthToken(
                                    'myToken',
                                    'myService'
                                ),
                                authBundle: 'myService',
                                avatarAddress: 'myAvatarUrl',
                                name: 'name',
                            },
                            TEMPORARY_BOT_PARTITION_ID
                        )
                    ),
                    defineGlobalBot('auth', 'myUserId', 2),
                ]);
            });

            it('should reuse the existing authBot if the User ID is the same.', async () => {
                const promise = library.api.os.requestAuthBot();

                let resultBot: Bot;
                promise.then((bot) => {
                    resultBot = bot;
                });

                const expected = requestAuthData(context.tasks.size);

                expect(context.actions).toEqual([expected]);

                // Resolve RequestAuthDataAction
                context.resolveTask(
                    1,
                    {
                        userId: 'myUserId',
                        service: 'myService',
                        token: 'myToken',
                        avatarUrl: 'myAvatarUrl',
                        name: 'name',
                    } as AuthData,
                    false
                );

                await waitAsync();

                // Resolve DefineGlobalBotAction
                context.resolveTask(2, null, false);

                await waitAsync();

                expect(resultBot.id).toEqual('myUserId');
                expect(resultBot.tags.authToken).toEqual(
                    formatAuthToken('myToken', 'myService')
                );
                expect(resultBot.tags.authBundle).toEqual('myService');
                expect(resultBot.tags.avatarAddress).toEqual('myAvatarUrl');
                expect(resultBot.tags.name).toEqual('name');

                const promise2 = library.api.os.requestAuthBot();

                let resultBot2: Bot;
                promise2.then((bot) => {
                    resultBot2 = bot;
                });

                // Resolve RequestAuthDataAction
                context.resolveTask(
                    3,
                    {
                        userId: 'myUserId',
                        service: 'myService',
                        token: 'myToken',
                        avatarUrl: 'myAvatarUrl',
                        name: 'name',
                    } as AuthData,
                    false
                );

                await waitAsync();

                // Resolve DefineGlobalBotAction
                context.resolveTask(4, null, false);

                await waitAsync();

                expect(resultBot2).toBe(resultBot);
            });
        });

        describe('os.requestPermanentAuthToken()', () => {
            it('should send a RequestPermanentAuthTokenAction', () => {
                const promise: any = library.api.os.requestPermanentAuthToken();
                const expected = requestPermanentAuthToken(context.tasks.size);

                expect(context.actions).toEqual([expected]);
            });

            it('should resolve with a formatted auth token', async () => {
                let result: string;
                library.api.os
                    .requestPermanentAuthToken()
                    .then((r) => (result = r));

                expect(
                    context.resolveTask(
                        context.tasks.size,
                        {
                            token: 'abc',
                            service: 'def',
                        },
                        false
                    )
                ).toBe(true);

                await waitAsync();

                expect(result).toBe('abc.def');
            });

            describe('mock', () => {
                beforeEach(() => {
                    context.mockAsyncActions = true;
                    library = createDefaultLibrary(context);
                });

                it('should return the mocked value when setup to mock', () => {
                    library.api.os.requestPermanentAuthToken
                        .mask()
                        .returns('mocked');
                    const result: any =
                        library.api.os.requestPermanentAuthToken();

                    expect(result).toEqual('mocked');
                });
            });
        });

        describe('os.publishRecord()', () => {
            it('should send a PublishRecordAction', () => {
                const action: any = library.api.os.publishRecord({
                    space: 'tempRestricted',
                    address: 'myAddress',
                    record: {
                        test1: true,
                    },
                    authToken: 'myToken',
                });
                const expected = publishRecord(
                    'myToken',
                    'myAddress',
                    {
                        test1: true,
                    },
                    'tempRestricted',
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should default to tempRestricted space', () => {
                const action: any = library.api.os.publishRecord({
                    address: 'myAddress',
                    record: {
                        test1: true,
                    },
                    authToken: 'myToken',
                });
                const expected = publishRecord(
                    'myToken',
                    'myAddress',
                    {
                        test1: true,
                    },
                    'tempRestricted',
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should use the authToken tag in the auth bot by default', () => {
                context.global.authBot = createBot('authBot', {
                    authToken: 'myToken',
                });
                const action: any = library.api.os.publishRecord({
                    space: 'tempRestricted',
                    address: 'myAddress',
                    record: {
                        test1: true,
                    },
                });
                const expected = publishRecord(
                    'myToken',
                    'myAddress',
                    {
                        test1: true,
                    },
                    'tempRestricted',
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should throw an error if no token is specified and there is no auth bot', () => {
                expect(() => {
                    library.api.os.publishRecord({
                        space: 'tempRestricted',
                        address: 'myAddress',
                        record: {
                            test1: true,
                        },
                    });
                }).toThrowError();
            });

            it('should support prefixed records', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.os.publishRecord({
                    prefix: 'myPrefix',
                    record: {
                        test1: true,
                    },
                    authToken: 'myToken',
                });
                const expected = publishRecord(
                    'myToken',
                    'myPrefix-uuid',
                    {
                        test1: true,
                    },
                    'tempRestricted',
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support a custom prefix and ID', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.os.publishRecord({
                    prefix: 'myPrefix',
                    id: 'test',
                    record: {
                        test1: true,
                    },
                    authToken: 'myToken',
                });
                const expected = publishRecord(
                    'myToken',
                    'myPrefix-test',
                    {
                        test1: true,
                    },
                    'tempRestricted',
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should use a UUID if no prefix or address is specified', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.os.publishRecord({
                    record: {
                        test1: true,
                    },
                    authToken: 'myToken',
                });
                const expected = publishRecord(
                    'myToken',
                    'uuid',
                    {
                        test1: true,
                    },
                    'tempRestricted',
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should throw an error if a null prefix is specified with an ID', () => {
                expect(() => {
                    library.api.os.publishRecord({
                        prefix: null,
                        id: 'test',
                        record: {
                            test1: true,
                        },
                        authToken: 'myToken',
                    });
                }).toThrowError();
            });

            it('should throw an error if a null address is specified', () => {
                expect(() => {
                    library.api.os.publishRecord({
                        address: null,
                        record: {
                            test1: true,
                        },
                        authToken: 'myToken',
                    });
                }).toThrowError();
            });

            it('should throw an error if a null record is specified', () => {
                expect(() => {
                    library.api.os.publishRecord({
                        address: 'myAddress',
                        record: null,
                        authToken: 'myToken',
                    });
                }).toThrowError();
            });

            describe('mock', () => {
                beforeEach(() => {
                    context.mockAsyncActions = true;
                    library = createDefaultLibrary(context);
                });

                it('should return the mocked value when setup to mock', () => {
                    library.api.os.publishRecord
                        .mask({
                            address: 'myAddress',
                            record: null,
                            authToken: 'myToken',
                        })
                        .returns('mocked');
                    const result: any = library.api.os.publishRecord({
                        address: 'myAddress',
                        record: null,
                        authToken: 'myToken',
                    });

                    expect(result).toEqual('mocked');
                });
            });
        });

        describe('os.getRecords()', () => {
            describe('byAuthID()', () => {
                it('should return an object that has the given address', () => {
                    const result: any = library.api.byAuthID('myAuthID');

                    expect(result).toEqual({
                        recordFilter: true,
                        authID: 'myAuthID',
                        [DEBUG_STRING]: 'byAuthID("myAuthID")',
                    });
                });
            });

            describe('bySpace()', () => {
                it('should return a function that has the specified space', () => {
                    const result1: any = library.api.bySpace('mySpace');
                    const result2: any = library.api.bySpace('myOtherSpace');

                    expect(result2).toBeInstanceOf(Function);
                    expect(result2.recordFilter).toBe(true);
                    expect(result2.space).toBe('myOtherSpace');

                    expect(result1).toBeInstanceOf(Function);
                    expect(result1.recordFilter).toBe(true);
                    expect(result1.space).toBe('mySpace');
                });

                it('should contain a toJSON() function that returns the record filter object', () => {
                    const result: any = library.api.bySpace('mySpace');

                    expect(result[DEBUG_STRING]).toBe('bySpace("mySpace")');
                    expect(result.toJSON).toBeInstanceOf(Function);
                    expect(result.toJSON()).toEqual({
                        recordFilter: true,
                        space: 'mySpace',
                    });
                });
            });

            describe('byAddress()', () => {
                it('should return an object that has the given address', () => {
                    const result: any = library.api.byAddress('byAddress');

                    expect(result).toEqual({
                        recordFilter: true,
                        address: 'byAddress',
                        [DEBUG_STRING]: 'byAddress("byAddress")',
                    });
                });
            });

            describe('withAuthToken()', () => {
                it('should return an object that has the given auth token', () => {
                    const result: any = library.api.withAuthToken('myToken');

                    expect(result).toEqual({
                        recordFilter: true,
                        authToken: 'myToken',
                        [DEBUG_STRING]: 'withAuthToken("myToken")',
                    });
                });
            });

            describe('byPrefix()', () => {
                it('should return an object that has the given address', () => {
                    const result: any = library.api.byPrefix('myPrefix');

                    expect(result).toEqual({
                        recordFilter: true,
                        prefix: 'myPrefix',
                        [DEBUG_STRING]: 'byPrefix("myPrefix")',
                    });
                });
            });

            it('should send a GetRecordsAction', () => {
                const action: any = library.api.os.getRecords(
                    library.api.withAuthToken('myToken'),
                    library.api.byAuthID('myID'),
                    library.api.bySpace('permanentGlobal'),
                    library.api.byAddress('myAddress')
                );
                const expected = getRecords(
                    'myToken',
                    'myID',
                    'permanentGlobal',
                    {
                        address: 'myAddress',
                    },
                    context.tasks.size
                );
                expect(context.actions).toEqual([expected]);
            });

            it('should be able to filter by prefix', () => {
                const action: any = library.api.os.getRecords(
                    library.api.withAuthToken('myToken'),
                    library.api.byAuthID('myID'),
                    library.api.bySpace('permanentGlobal'),
                    library.api.byPrefix('myPrefix')
                );
                const expected = getRecords(
                    'myToken',
                    'myID',
                    'permanentGlobal',
                    {
                        prefix: 'myPrefix',
                    },
                    context.tasks.size
                );
                expect(context.actions).toEqual([expected]);
            });

            it('should be able to filter by ID', () => {
                const action: any = library.api.os.getRecords(
                    library.api.withAuthToken('myToken'),
                    library.api.byAuthID('myID'),
                    library.api.bySpace('permanentGlobal'),
                    library.api.byID('myTestID')
                );
                const expected = getRecords(
                    'myToken',
                    'myID',
                    'permanentGlobal',
                    {
                        address: 'myTestID',
                    },
                    context.tasks.size
                );
                expect(context.actions).toEqual([expected]);
            });

            it('should be able to filter by record reference', () => {
                const action: any = library.api.os.getRecords(
                    library.api.withAuthToken('myToken'),
                    {
                        authID: 'myID',
                        address: 'myAddress',
                        space: 'permanentGlobal',
                    }
                );
                const expected = getRecords(
                    'myToken',
                    'myID',
                    'permanentGlobal',
                    {
                        address: 'myAddress',
                    },
                    context.tasks.size
                );
                expect(context.actions).toEqual([expected]);
            });

            it('should prefer address over prefix when both are specified', () => {
                const action: any = library.api.os.getRecords(
                    library.api.withAuthToken('myToken'),
                    library.api.byAuthID('myID'),
                    library.api.bySpace('permanentGlobal'),
                    library.api.byAddress('myAddress'),
                    library.api.byPrefix('myPrefix')
                );
                const expected = getRecords(
                    'myToken',
                    'myID',
                    'permanentGlobal',
                    {
                        address: 'myAddress',
                    },
                    context.tasks.size
                );
                expect(context.actions).toEqual([expected]);
            });

            it('should specify an address when both a prefix and ID are given', () => {
                const action: any = library.api.os.getRecords(
                    library.api.withAuthToken('myToken'),
                    library.api.byAuthID('myID'),
                    library.api.bySpace('permanentGlobal'),
                    library.api.byPrefix('myPrefix'),
                    library.api.byID('myID')
                );
                const expected = getRecords(
                    'myToken',
                    'myID',
                    'permanentGlobal',
                    {
                        address: 'myPrefixmyID',
                    },
                    context.tasks.size
                );
                expect(context.actions).toEqual([expected]);
            });

            it('should prefer address even when both a prefix and ID are given', () => {
                const action: any = library.api.os.getRecords(
                    library.api.withAuthToken('myToken'),
                    library.api.byAuthID('myID'),
                    library.api.bySpace('permanentGlobal'),
                    library.api.byPrefix('myPrefix'),
                    library.api.byID('myID'),
                    library.api.byAddress('myAddress')
                );
                const expected = getRecords(
                    'myToken',
                    'myID',
                    'permanentGlobal',
                    {
                        address: 'myAddress',
                    },
                    context.tasks.size
                );
                expect(context.actions).toEqual([expected]);
            });

            it('should filter by the tempRestricted space by default', () => {
                const action: any = library.api.os.getRecords(
                    library.api.withAuthToken('myToken'),
                    library.api.byAuthID('myID'),
                    library.api.byAddress('myAddress')
                );
                const expected = getRecords(
                    'myToken',
                    'myID',
                    'tempRestricted',
                    {
                        address: 'myAddress',
                    },
                    context.tasks.size
                );
                expect(context.actions).toEqual([expected]);
            });

            it('should throw an error when no auth ID is specified', () => {
                expect(() => {
                    library.api.os.getRecords(
                        library.api.withAuthToken('myToken'),
                        library.api.byAddress('myAddress')
                    );
                }).toThrowError();
            });

            it('should throw an error when no address or prefix is specified', () => {
                expect(() => {
                    library.api.os.getRecords(library.api.byAuthID('myID'));
                }).toThrowError();
            });

            it('should be able to emit an action when no auth token is specified and there is no auth bot', () => {
                const action: any = library.api.os.getRecords(
                    library.api.byAuthID('myID'),
                    library.api.byAddress('myAddress')
                );
                const expected = getRecords(
                    null,
                    'myID',
                    'tempRestricted',
                    {
                        address: 'myAddress',
                    },
                    context.tasks.size
                );
                expect(context.actions).toEqual([expected]);
            });

            it('should default the auth token to the token from the auth bot', () => {
                context.global.authBot = createBot('authBot', {
                    authToken: 'authToken',
                });
                const action: any = library.api.os.getRecords(
                    library.api.byAuthID('myID'),
                    library.api.byAddress('myAddress')
                );
                const expected = getRecords(
                    'authToken',
                    'myID',
                    'tempRestricted',
                    {
                        address: 'myAddress',
                    },
                    context.tasks.size
                );
                expect(context.actions).toEqual([expected]);
            });

            it('should default the auth ID to the ID of the auth bot', () => {
                context.global.authBot = createBot('authBotID', {
                    authToken: 'authToken',
                });
                const action: any = library.api.os.getRecords(
                    library.api.byAddress('myAddress')
                );
                const expected = getRecords(
                    'authToken',
                    'authBotID',
                    'tempRestricted',
                    {
                        address: 'myAddress',
                    },
                    context.tasks.size
                );
                expect(context.actions).toEqual([expected]);
            });

            it('should resolve with an object that can make additional requests', async () => {
                context.global.authBot = createBot('authBot', {
                    authToken: 'authToken',
                });
                let result: GetRecordsResult;
                library.api.os
                    .getRecords(
                        library.api.byAuthID('myID'),
                        library.api.byAddress('myAddress')
                    )
                    .then((r) => (result = r));

                expect(context.actions).toEqual([
                    getRecords(
                        'authToken',
                        'myID',
                        'tempRestricted',
                        { address: 'myAddress' },
                        1
                    ),
                ]);

                context.resolveTask(
                    1,
                    {
                        records: [
                            {
                                authID: 'authId',
                                address: 'address1',
                                data: { ghi: 'jfk' },
                                space: 'tempRestricted',
                            },
                        ],
                        totalCount: 5,
                        cursor: 'myCursor',
                        hasMoreRecords: true,
                    } as GetRecordsActionResult,
                    false
                );

                await waitAsync();

                expect(result.hasMoreRecords).toBe(true);
                expect(result.records).toEqual([
                    {
                        authID: 'authId',
                        address: 'address1',
                        data: { ghi: 'jfk' },
                        space: 'tempRestricted',
                    },
                ]);
                expect(result.totalCount).toBe(5);

                let otherResult: GetRecordsResult;
                result.getMoreRecords().then((r) => (otherResult = r));

                expect(context.actions.slice(1)).toEqual([
                    getRecords(
                        'authToken',
                        'myID',
                        'tempRestricted',
                        { address: 'myAddress', cursor: 'myCursor' },
                        2
                    ),
                ]);

                context.resolveTask(
                    2,
                    {
                        records: [
                            {
                                authID: 'authId',
                                address: 'address2',
                                data: { abc: 'def' },
                                space: 'tempRestricted',
                            },
                        ],
                        totalCount: 5,
                        hasMoreRecords: false,
                    } as GetRecordsActionResult,
                    false
                );

                await waitAsync();

                expect(otherResult.hasMoreRecords).toBe(false);
                expect(otherResult.totalCount).toBe(5);
                expect(otherResult.records).toEqual([
                    {
                        authID: 'authId',
                        address: 'address2',
                        data: { abc: 'def' },
                        space: 'tempRestricted',
                    },
                ]);
            });

            describe('mock', () => {
                beforeEach(() => {
                    context.mockAsyncActions = true;
                    library = createDefaultLibrary(context);
                });

                it('should return the mocked value when setup to mock', () => {
                    library.api.os.getRecords
                        .mask(
                            library.api.withAuthToken('myToken'),
                            library.api.byAuthID('myID'),
                            library.api.bySpace('permanentGlobal'),
                            library.api.byPrefix('myPrefix'),
                            library.api.byID('id'),
                            library.api.byAddress('address')
                        )
                        .returns('mocked');
                    const result: any = library.api.os.getRecords(
                        { recordFilter: true, authToken: 'myToken' },
                        { recordFilter: true, authID: 'myID' },
                        { recordFilter: true, space: 'permanentGlobal' } as any,
                        { recordFilter: true, prefix: 'myPrefix' },
                        { recordFilter: true, id: 'id' } as any,
                        { recordFilter: true, address: 'address' }
                    );

                    expect(result).toEqual('mocked');
                });
            });
        });

        describe('os.destroyRecord()', () => {
            it('should send a DeleteRecordAction', () => {
                const action: any = library.api.os.destroyRecord({
                    space: 'tempRestricted',
                    address: 'myAddress',
                    authToken: 'myToken',
                });
                const expected = deleteRecord(
                    'myToken',
                    'myAddress',
                    'tempRestricted',
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should use the authToken tag in the auth bot by default', () => {
                context.global.authBot = createBot('authBot', {
                    authToken: 'myToken',
                });
                const action: any = library.api.os.destroyRecord({
                    space: 'tempRestricted',
                    address: 'myAddress',
                });
                const expected = deleteRecord(
                    'myToken',
                    'myAddress',
                    'tempRestricted',
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should be able to use a record reference', () => {
                context.global.authBot = createBot('authBot', {
                    authToken: 'myToken',
                });
                const action: any = library.api.os.destroyRecord(<any>{
                    authID: 'myID',
                    address: 'myAddress',
                    space: 'permanentGlobal',
                });
                const expected = deleteRecord(
                    'myToken',
                    'myAddress',
                    'permanentGlobal',
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            describe('mock', () => {
                beforeEach(() => {
                    context.mockAsyncActions = true;
                    library = createDefaultLibrary(context);
                });

                it('should return the mocked value when setup to mock', () => {
                    library.api.os.destroyRecord
                        .mask({
                            space: 'tempRestricted',
                            address: 'myAddress',
                            authToken: 'myToken',
                        })
                        .returns('mocked');
                    const result: any = library.api.os.destroyRecord({
                        space: 'tempRestricted',
                        address: 'myAddress',
                        authToken: 'myToken',
                    });

                    expect(result).toEqual('mocked');
                });
            });
        });

        describe('server.setupServer()', () => {
            it('should send a SetupChannelAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                bot1.tags.abc = true;
                const action: any = library.api.server.setupServer(
                    'channel',
                    bot1
                );
                const expected = remote(
                    setupServer('channel', createBot(bot1.id, bot1.tags)),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.setupServer('channel');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });

            it('should convert the given bot to a copiable value', () => {
                uuidMock.mockReturnValueOnce('task1');
                bot1.tags.abc = true;
                const action: any = library.api.server.setupServer('channel', {
                    botTag: bot1,
                });
                const expected = remote(
                    setupServer('channel', {
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

        describe('os.setupInst()', () => {
            it('should send a SetupChannelAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                bot1.tags.abc = true;
                const action: any = library.api.os.setupInst('channel', bot1);
                const expected = remote(
                    setupServer('channel', createBot(bot1.id, bot1.tags)),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.os.setupInst('channel');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });

            it('should convert the given bot to a copiable value', () => {
                uuidMock.mockReturnValueOnce('task1');
                bot1.tags.abc = true;
                const action: any = library.api.os.setupInst('channel', {
                    botTag: bot1,
                });
                const expected = remote(
                    setupServer('channel', {
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
                const action: any = library.api.server.rpioWriteSequence(
                    99,
                    [10, 10]
                );
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
                const action: any =
                    library.api.server.rpioI2CSetSlaveAddress(0xff);
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
                const action: any =
                    library.api.server.rpioI2CSetBaudRate(100000);
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
                const action: any =
                    library.api.server.rpioI2CSetClockDivider(2500);
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
                    0x0b, 0x0e, 0x0e, 0x0f,
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
                const action: any =
                    library.api.server.rpioPWMSetClockDivider(64);
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
                const action: any =
                    library.api.server.rpioSPISetClockDivider(128);
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
                    'Brush01',
                    '/dev/ttyS0',
                    'AA:BB:CC:DD:EE',
                    1,
                    { baudRate: 9600 }
                );
                const expected = remote(
                    serialConnectPin(
                        'Brush01',
                        '/dev/ttyS0',
                        'AA:BB:CC:DD:EE',
                        1,
                        { baudRate: 9600 }
                    ),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialConnect(
                    'Brush01',
                    '/dev/ttyS0',
                    'AA:BB:CC:DD:EE',
                    1,
                    { baudRate: 9600 }
                );

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialStream()', () => {
            it('should send a SerialStreamAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialStream(
                    '1a2b3',
                    'Brush01'
                );
                const expected = remote(
                    serialStreamPin('1a2b3', 'Brush01'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialStream('1a2b3', 'Brush01');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialOpen()', () => {
            it('should send a SerialOpenAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialOpen('Brush01');
                const expected = remote(
                    serialOpenPin('Brush01'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialOpen('Brush01');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialUpdate()', () => {
            it('should send a SerialUpdateAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialUpdate('Brush01', {
                    baudRate: 9600,
                });
                const expected = remote(
                    serialUpdatePin('Brush01', { baudRate: 9600 }),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialUpdate('Brush01', { baudRate: 9600 });

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialWrite()', () => {
            it('should send a SerialWriteAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialWrite(
                    'Brush01',
                    'Hello World!',
                    'utf8'
                );
                const expected = remote(
                    serialWritePin('Brush01', 'Hello World!', 'utf8'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialWrite(
                    'Brush01',
                    'Hello World!',
                    'utf8'
                );

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialRead()', () => {
            it('should send a SerialReadAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialRead('Brush01');
                const expected = remote(
                    serialReadPin('Brush01'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialRead('Brush01');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialClose()', () => {
            it('should send a SerialCloseAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialClose(
                    'Brush01',
                    '/dev/rfcomm0'
                );
                const expected = remote(
                    serialClosePin('Brush01', '/dev/rfcomm0'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialClose('Brush01', '/dev/rfcomm0');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialFlush()', () => {
            it('should send a SerialFlushAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialFlush('Brush01');
                const expected = remote(
                    serialFlushPin('Brush01'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialFlush('Brush01');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialDrain()', () => {
            it('should send a SerialDrainAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialDrain('Brush01');
                const expected = remote(
                    serialDrainPin('Brush01'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialDrain('Brush01');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialPause()', () => {
            it('should send a SerialPauseAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialPause('Brush01');
                const expected = remote(
                    serialPausePin('Brush01'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialPause('Brush01');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serialResume()', () => {
            it('should send a SerialResumeAction in a RemoteAction', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.serialResume('Brush01');
                const expected = remote(
                    serialResumePin('Brush01'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serialResume('Brush01');

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
                const action: any =
                    library.api.server.restoreHistoryMark('mark');
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

        describe('server.restoreHistoryMarkToServer()', () => {
            it('should emit a restore_history_mark event', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any =
                    library.api.server.restoreHistoryMarkToServer(
                        'mark',
                        'server'
                    );
                const expected = remote(
                    restoreHistoryMark('mark', 'server'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.restoreHistoryMarkToServer('mark', 'server');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.restoreHistoryMarkToInst()', () => {
            it('should emit a restore_history_mark event', () => {
                uuidMock.mockReturnValueOnce('task1');
                const action: any = library.api.server.restoreHistoryMarkToInst(
                    'mark',
                    'inst'
                );
                const expected = remote(
                    restoreHistoryMark('mark', 'inst'),
                    undefined,
                    undefined,
                    'task1'
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.restoreHistoryMarkToInst('mark', 'inst');

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

        describe('server.serverRemoteCount()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot(
                    'player',
                    {
                        inst: 'channel',
                    },
                    'tempLocal'
                );
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should emit a remote action with a get_remote_count action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.server.serverRemoteCount();
                const expected = remote(
                    getRemoteCount('channel'),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should accept a custom server ID', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any =
                    library.api.server.serverRemoteCount('test');
                const expected = remote(
                    getRemoteCount('test'),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serverRemoteCount('test');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('os.remoteCount()', () => {
            let player: RuntimeBot;

            beforeEach(() => {
                player = createDummyRuntimeBot(
                    'player',
                    {
                        inst: 'channel',
                    },
                    'tempLocal'
                );
                addToContext(context, player);
                context.playerBot = player;
            });

            it('should emit a remote action with a get_remote_count action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.os.remoteCount();
                const expected = remote(
                    getRemoteCount('channel'),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should accept a custom server ID', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.os.remoteCount('test');
                const expected = remote(
                    getRemoteCount('test'),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.os.remoteCount('test');

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.totalRemoteCount()', () => {
            it('should emit a remote action with a get_remote_count action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.server.totalRemoteCount();
                const expected = remote(
                    getRemoteCount(),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.totalRemoteCount();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('os.totalRemoteCount()', () => {
            it('should emit a remote action with a get_remote_count action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.os.totalRemoteCount();
                const expected = remote(
                    getRemoteCount(),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.os.totalRemoteCount();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.servers()', () => {
            it('should emit a remote action with a get_servers action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.server.servers();
                const expected = remote(
                    getServers(),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.servers();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('os.instances()', () => {
            it('should emit a remote action with a get_servers action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.os.instances();
                const expected = remote(
                    getServers(),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.os.instances();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.serverStatuses()', () => {
            it('should emit a remote action with a get_server_statuses action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.server.serverStatuses();
                const expected = remote(
                    getServerStatuses(),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.serverStatuses();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('os.instStatuses()', () => {
            it('should emit a remote action with a get_server_statuses action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.os.instStatuses();
                const expected = remote(
                    getServerStatuses(),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.os.instStatuses();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('server.remotes()', () => {
            it('should emit a remote action with a get_remotes action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.server.remotes();
                const expected = remote(
                    getRemotes(),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.server.remotes();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('os.remotes()', () => {
            it('should emit a remote action with a get_remotes action', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const action: any = library.api.os.remotes();
                const expected = remote(
                    getRemotes(),
                    undefined,
                    undefined,
                    'uuid'
                );

                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should create tasks that can be resolved from a remote', () => {
                uuidMock.mockReturnValueOnce('uuid');
                library.api.os.remotes();

                const task = context.tasks.get('uuid');
                expect(task.allowRemoteResolution).toBe(true);
            });
        });

        describe('remote()', () => {
            it('should replace the original event in the queue', () => {
                const action = library.api.remote(library.api.os.toast('abc'));
                library.api.os.showChat();
                expect(action).toEqual(remote(toast('abc')));
                expect(context.actions).toEqual([
                    remote(toast('abc')),
                    showChat(),
                ]);
            });

            it('should send the right selector', () => {
                const action = library.api.remote(library.api.os.toast('abc'), {
                    session: 's',
                    username: 'u',
                    device: 'd',
                });
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
                    library.api.os.toast('abc'),
                    'abc'
                );
                const expected = remote(toast('abc'), {
                    sessionId: 'abc',
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should be able to broadcast to all players', () => {
                const action = library.api.remote(library.api.os.toast('abc'), {
                    broadcast: true,
                });
                const expected = remote(toast('abc'), {
                    broadcast: true,
                });
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support multiple selectors to send the same event to multiple places', () => {
                const action = library.api.remote(library.api.os.toast('abc'), [
                    'abc',
                    {
                        session: 's',
                        username: 'u',
                        device: 'd',
                    },
                ]);
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

        describe('sendRemoteData()', () => {
            it('should send a remote action with a shout', () => {
                const actions = library.api.sendRemoteData(
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
                const actions = library.api.sendRemoteData(
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

        describe('web.get()', () => {
            it('should emit a SendWebhookAction', () => {
                const action: any = library.api.web.get('https://example.com', {
                    responseShout: 'test.response()',
                });
                const expected = webhook(
                    {
                        method: 'GET',
                        url: 'https://example.com',
                        responseShout: 'test.response()',
                    },
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            describe('mock', () => {
                beforeEach(() => {
                    context.mockAsyncActions = true;
                    library = createDefaultLibrary(context);
                });

                it('should return the mocked value when setup to mock', () => {
                    library.api.web.get
                        .mask('https://example.com')
                        .returns('masked');
                    const result: any = library.api.web.get(
                        'https://example.com'
                    );

                    expect(result).toEqual('masked');
                });
            });
        });

        describe('web.post()', () => {
            it('should emit a SendWebhookAction', () => {
                const action: any = library.api.web.post(
                    'https://example.com',
                    { data: true },
                    {
                        responseShout: 'test.response()',
                    }
                );
                const expected = webhook(
                    {
                        method: 'POST',
                        url: 'https://example.com',
                        data: { data: true },
                        responseShout: 'test.response()',
                    },
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            describe('mock', () => {
                beforeEach(() => {
                    context.mockAsyncActions = true;
                    library = createDefaultLibrary(context);
                });

                it('should return the mocked value when setup to mock', () => {
                    library.api.web.post
                        .mask(
                            'https://example.com',
                            { data: true },
                            {
                                responseShout: 'test.response()',
                            }
                        )
                        .returns('masked');

                    const result: any = library.api.web.post(
                        'https://example.com',
                        { data: true },
                        {
                            responseShout: 'test.response()',
                        }
                    );

                    expect(result).toEqual('masked');
                });
            });
        });

        describe('web.hook()', () => {
            it('should emit a SendWebhookAction', () => {
                const action: any = library.api.web.hook({
                    method: 'TEST',
                    data: { myData: 'abc' },
                    url: 'https://example.com',
                    responseShout: 'test.response()',
                });
                const expected = webhook(
                    {
                        method: 'TEST',
                        url: 'https://example.com',
                        data: { myData: 'abc' },
                        responseShout: 'test.response()',
                    },
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            describe('mock', () => {
                beforeEach(() => {
                    context.mockAsyncActions = true;
                    library = createDefaultLibrary(context);
                });

                it('should return the mocked value when setup to mock', () => {
                    library.api.web.hook
                        .mask({
                            method: 'TEST',
                            data: { myData: 'abc' },
                            url: 'https://example.com',
                            responseShout: 'test.response()',
                        })
                        .returns('masked');
                    const result: any = library.api.web.hook({
                        method: 'TEST',
                        data: { myData: 'abc' },
                        url: 'https://example.com',
                        responseShout: 'test.response()',
                    });

                    expect(result).toEqual('masked');
                });
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

            describe('mock', () => {
                beforeEach(() => {
                    context.mockAsyncActions = true;
                    library = createDefaultLibrary(context);
                });

                it('should return the mocked value when setup to mock', () => {
                    library.api.webhook
                        .mask({
                            method: 'POST',
                            url: 'https://example.com',
                            data: {
                                test: 'abc',
                            },
                            responseShout: 'test.response()',
                        })
                        .returns('masked');

                    const result: any = library.api.webhook({
                        method: 'POST',
                        url: 'https://example.com',
                        data: {
                            test: 'abc',
                        },
                        responseShout: 'test.response()',
                    });

                    expect(result).toEqual('masked');
                });
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

            describe('mock', () => {
                beforeEach(() => {
                    context.mockAsyncActions = true;
                    library = createDefaultLibrary(context);
                });

                it('should return the mocked value when setup to mock', () => {
                    library.api.webhook.post
                        .mask(
                            'https://example.com',
                            { test: 'abc' },
                            {
                                responseShout: 'test.response()',
                            }
                        )
                        .returns('masked');
                    const result: any = library.api.webhook.post(
                        'https://example.com',
                        { test: 'abc' },
                        {
                            responseShout: 'test.response()',
                        }
                    );

                    expect(result).toEqual('masked');
                });
            });
        });

        describe('uuid()', () => {
            it('should return a UUID', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const guid = library.api.uuid();
                expect(guid).toBe('uuid');
            });
        });

        describe('animateTag()', () => {
            let sub: SubscriptionLike;
            beforeEach(() => {
                jest.useFakeTimers('modern');
            });

            afterEach(() => {
                jest.clearAllTimers();
                if (sub) {
                    sub.unsubscribe();
                }
            });

            afterAll(() => {
                jest.useRealTimers();
            });

            it('should animate the given tag to the given value over the duration', async () => {
                bot1.tags.abc = 0;
                const promise = library.api.animateTag(bot1, 'abc', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });

                let resolved = false;

                promise.then(() => {
                    resolved = true;
                });

                sub = context.startAnimationLoop();

                jest.advanceTimersByTime(
                    500 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                await Promise.resolve();

                expect(resolved).toBe(true);
                expect(bot1.masks.abc).toEqual(10);
                expect(bot1.maskChanges).toEqual({
                    tempLocal: {
                        abc: 10,
                    },
                });
                expect(bot1.raw.abc).toEqual(0);
            });

            it('should require the duration to be specified', async () => {
                bot1.tags.abc = 0;

                expect(() => {
                    library.api.animateTag(bot1, 'abc', {
                        fromValue: 0,
                        toValue: 10,
                        easing: {
                            type: 'quadratic',
                            mode: 'inout',
                        },
                        duration: null,
                        tagMaskSpace: 'tempLocal',
                    });
                }).toThrow();
            });

            it('should remove # symbols from tag names', async () => {
                bot1.tags.abc = 0;
                const promise = library.api.animateTag(bot1, '#abc', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });

                let resolved = false;

                promise.then(() => {
                    resolved = true;
                });

                sub = context.startAnimationLoop();

                jest.advanceTimersByTime(
                    500 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                await Promise.resolve();

                expect(resolved).toBe(true);
                expect(bot1.masks.abc).toEqual(10);
                expect(bot1.maskChanges).toEqual({
                    tempLocal: {
                        abc: 10,
                    },
                });
                expect(bot1.raw.abc).toEqual(0);
            });

            it('should use tempLocal space by default', async () => {
                bot1.tags.abc = 0;
                const promise = library.api.animateTag(bot1, 'abc', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                });

                let resolved = false;

                promise.then(() => {
                    resolved = true;
                });

                sub = context.startAnimationLoop();

                jest.advanceTimersByTime(
                    500 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                await Promise.resolve();

                expect(resolved).toBe(true);
                expect(bot1.masks.abc).toEqual(10);
                expect(bot1.maskChanges).toEqual({
                    tempLocal: {
                        abc: 10,
                    },
                });
                expect(bot1.raw.abc).toEqual(0);
            });

            it('should animate the tag directly on the bot if given false for tagMaskSpace', async () => {
                bot1.tags.abc = 0;
                const promise = library.api.animateTag(bot1, 'abc', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: false,
                });

                let resolved = false;

                promise.then(() => {
                    resolved = true;
                });

                sub = context.startAnimationLoop();

                jest.advanceTimersByTime(
                    500 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                await Promise.resolve();

                expect(resolved).toBe(true);
                expect(bot1.tags.abc).toEqual(10);
                expect(bot1.changes).toEqual({
                    abc: 10,
                });
                expect(bot1.masks.abc).toBeUndefined();
                expect(bot1.raw.abc).toEqual(10);
            });

            it('should start with the current value if fromValue is omitted', async () => {
                bot1.tags.abc = 5;
                const promise = library.api.animateTag(bot1, 'abc', {
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });

                let resolved = false;

                promise.then(() => {
                    resolved = true;
                });

                sub = context.startAnimationLoop();

                jest.runOnlyPendingTimers();

                expect(resolved).toBe(false);
                expect(bot1.masks.abc).toBeCloseTo(5, 1);

                jest.advanceTimersByTime(
                    500 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                await Promise.resolve();

                expect(resolved).toBe(true);
                expect(bot1.masks.abc).toEqual(10);
                expect(bot1.maskChanges).toEqual({
                    tempLocal: {
                        abc: 10,
                    },
                });
                expect(bot1.tags.abc).toEqual(5);
                expect(bot1.raw.abc).toEqual(5);
            });

            it('should use linear easing by default', async () => {
                bot1.tags.abc = 5;
                const promise = library.api.animateTag(bot1, 'abc', {
                    fromValue: 0,
                    toValue: 1,
                    duration: 1,
                    tagMaskSpace: 'tempLocal',
                });

                let resolved = false;

                promise.then(() => {
                    resolved = true;
                });

                sub = context.startAnimationLoop();

                jest.runOnlyPendingTimers();

                expect(resolved).toBe(false);

                // 16ms per frame, 1 frame has been executed, duration is 1000ms, final value is 1
                expect(bot1.masks.abc).toBeCloseTo(
                    ((SET_INTERVAL_ANIMATION_FRAME_TIME * 1) / 1000) * 1
                );

                jest.runOnlyPendingTimers();

                expect(resolved).toBe(false);

                // 16ms per frame, 1 frames have been executed, duration is 1000ms, final value is 1
                expect(bot1.masks.abc).toBeCloseTo(
                    ((SET_INTERVAL_ANIMATION_FRAME_TIME * 2) / 1000) * 1
                );

                jest.advanceTimersByTime(
                    1000 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                await Promise.resolve();

                expect(resolved).toBe(true);
                expect(bot1.masks.abc).toEqual(1);
                expect(bot1.maskChanges).toEqual({
                    tempLocal: {
                        abc: 1,
                    },
                });
                expect(bot1.tags.abc).toEqual(5);
                expect(bot1.raw.abc).toEqual(5);
            });

            it('should animate multiple bots at a time', async () => {
                bot1.tags.abc = 0;
                bot2.tags.abc = 0;
                const promise = library.api.animateTag([bot1, bot2], 'abc', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });

                let resolved = false;

                promise.then(() => {
                    resolved = true;
                });

                sub = context.startAnimationLoop();

                jest.advanceTimersByTime(
                    500 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                await Promise.resolve();
                await Promise.resolve();

                expect(resolved).toBe(true);
                expect(bot1.masks.abc).toEqual(10);
                expect(bot1.maskChanges).toEqual({
                    tempLocal: {
                        abc: 10,
                    },
                });
                expect(bot1.raw.abc).toEqual(0);
                expect(bot2.masks.abc).toEqual(10);
                expect(bot2.maskChanges).toEqual({
                    tempLocal: {
                        abc: 10,
                    },
                });
                expect(bot2.raw.abc).toEqual(0);
            });

            it('should support using null options to cancel an animation', async () => {
                bot1.tags.abc = 0;
                bot2.tags.abc = 0;
                const promise = library.api.animateTag([bot1, bot2], 'abc', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });

                let errored = false;
                let resolved = false;

                promise.catch(() => {
                    errored = true;
                });

                sub = context.startAnimationLoop();

                let promise2 = library.api.animateTag(
                    [bot1, bot2],
                    'abc',
                    null
                );

                promise2.then(() => {
                    resolved = true;
                });

                jest.advanceTimersByTime(
                    500 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                await Promise.resolve();
                await Promise.resolve();

                expect(errored).toBe(true);
                expect(resolved).toBe(true);
                expect(bot1.masks.abc).toBeUndefined();
                expect(bot1.raw.abc).toEqual(0);
                expect(bot2.masks.abc).toBeUndefined();
                expect(bot2.raw.abc).toEqual(0);
            });

            it('should support animating multiple tags at once', async () => {
                bot1.tags.abc = 0;
                bot1.tags.def = 1;
                const promise = library.api.animateTag(bot1, {
                    fromValue: {
                        abc: 0,
                        def: 1,
                    },
                    toValue: {
                        abc: 10,
                        def: 11,
                    },
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });

                let resolved = false;

                promise.then(() => {
                    resolved = true;
                });

                sub = context.startAnimationLoop();

                jest.advanceTimersByTime(
                    500 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                for (let i = 0; i < 5; i++) {
                    await Promise.resolve();
                }

                expect(resolved).toBe(true);
                expect(bot1.masks.abc).toEqual(10);
                expect(bot1.masks.def).toEqual(11);
                expect(bot1.maskChanges).toEqual({
                    tempLocal: {
                        abc: 10,
                        def: 11,
                    },
                });
                expect(bot1.raw.abc).toEqual(0);
                expect(bot1.raw.def).toEqual(1);
            });

            it('should require the duration to be specified when animating multiple tags at once', async () => {
                bot1.tags.abc = 0;

                await expect(async () => {
                    await library.api.animateTag(bot1, {
                        fromValue: {
                            abc: 1,
                        },
                        toValue: {
                            abc: 4,
                        },
                        easing: {
                            type: 'quadratic',
                            mode: 'inout',
                        },
                        duration: null,
                        tagMaskSpace: 'tempLocal',
                    });
                }).rejects.toThrow();
            });
        });

        describe('clearAnimations()', () => {
            let sub: SubscriptionLike;
            beforeEach(() => {
                jest.useFakeTimers('modern');
            });

            afterEach(() => {
                jest.clearAllTimers();
                if (sub) {
                    sub.unsubscribe();
                }
            });

            afterAll(() => {
                jest.useRealTimers();
            });

            it('should stop all the animations for the given bot', async () => {
                bot1.tags.abc = 0;
                const promise1 = library.api.animateTag(bot1, 'abc', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });
                const promise2 = library.api.animateTag(bot1, 'other', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });

                let errored = false;

                promise1.catch(() => {
                    errored = true;
                });
                promise2.catch(() => {
                    errored = true;
                });

                sub = context.startAnimationLoop();

                library.api.clearAnimations(bot1);

                jest.advanceTimersByTime(
                    500 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                await Promise.resolve();

                expect(errored).toBe(true);
                expect(bot1.masks.abc).toBeUndefined();
                expect(bot1.masks.other).toBeUndefined();
                expect(bot1.raw.abc).toEqual(0);
            });

            it('should stop animations for multiple bots', async () => {
                bot1.tags.abc = 0;
                bot2.tags.abc = 0;
                const promise1 = library.api.animateTag([bot1, bot2], 'abc', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });
                const promise2 = library.api.animateTag([bot1, bot2], 'other', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });

                let errored = false;

                promise1.catch(() => {
                    errored = true;
                });
                promise2.catch(() => {
                    errored = true;
                });

                sub = context.startAnimationLoop();

                library.api.clearAnimations([bot1, bot2]);

                jest.advanceTimersByTime(
                    500 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                await Promise.resolve();
                await Promise.resolve();

                expect(errored).toBe(true);
                expect(bot1.masks.abc).toBeUndefined();
                expect(bot1.masks.other).toBeUndefined();
                expect(bot1.raw.abc).toEqual(0);
                expect(bot2.masks.abc).toBeUndefined();
                expect(bot2.masks.other).toBeUndefined();
                expect(bot2.raw.abc).toEqual(0);
            });

            it('should stop animations for the specified tag', async () => {
                bot1.tags.abc = 0;
                const promise1 = library.api.animateTag(bot1, 'abc', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });
                const promise2 = library.api.animateTag(bot1, 'other', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });

                let errored = false;
                let resolved = false;

                promise1.catch(() => {
                    errored = true;
                });
                promise2.then(() => {
                    resolved = true;
                });

                sub = context.startAnimationLoop();

                library.api.clearAnimations(bot1, 'abc');

                jest.advanceTimersByTime(
                    500 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                await Promise.resolve();
                await Promise.resolve();

                expect(errored).toBe(true);
                expect(resolved).toBe(true);
                expect(bot1.masks.abc).toBeUndefined();
                expect(bot1.masks.other).toEqual(10);
                expect(bot1.raw.abc).toEqual(0);
            });

            it('should stop animations for the specified tag', async () => {
                bot1.tags.abc = 0;
                bot1.tags.other = 0;
                const promise1 = library.api.animateTag(bot1, 'abc', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });
                const promise2 = library.api.animateTag(bot1, 'other', {
                    fromValue: 0,
                    toValue: 10,
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });

                let errored1 = false;
                let errored2 = false;

                promise1.catch(() => {
                    errored1 = true;
                });
                promise2.catch(() => {
                    errored2 = true;
                });

                sub = context.startAnimationLoop();

                library.api.clearAnimations(bot1, ['abc', 'other']);

                jest.advanceTimersByTime(
                    500 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                await Promise.resolve();
                await Promise.resolve();

                expect(errored1).toBe(true);
                expect(errored2).toBe(true);
                expect(bot1.masks.abc).toBeUndefined();
                expect(bot1.masks.other).toBeUndefined();
                expect(bot1.raw.abc).toEqual(0);
                expect(bot1.raw.other).toEqual(0);
            });

            it('should cancel all animations in a group if one of them is canceled', async () => {
                bot1.tags.abc = 0;
                bot1.tags.def = 0;
                bot1.tags.ghi = 0;
                uuidMock.mockReturnValueOnce('group1');
                const promise1 = library.api.animateTag(bot1, {
                    fromValue: {
                        abc: 0,
                        def: 0,
                        ghi: 0,
                    },
                    toValue: {
                        abc: 10,
                        def: 10,
                        ghi: 10,
                    },
                    easing: {
                        type: 'quadratic',
                        mode: 'inout',
                    },
                    duration: 0.5,
                    tagMaskSpace: 'tempLocal',
                });

                let errored = false;

                promise1.catch(() => {
                    errored = true;
                });

                sub = context.startAnimationLoop();

                library.api.clearAnimations(bot1, 'abc');

                jest.advanceTimersByTime(
                    500 + SET_INTERVAL_ANIMATION_FRAME_TIME
                );
                for (let i = 0; i < 5; i++) {
                    await Promise.resolve();
                }

                expect(errored).toBe(true);
                expect(bot1.masks.abc).toBeUndefined();
                expect(bot1.masks.def).toBeUndefined();
                expect(bot1.masks.ghi).toBeUndefined();
                expect(bot1.raw.abc).toEqual(0);
                expect(bot1.raw.def).toEqual(0);
                expect(bot1.raw.ghi).toEqual(0);
            });

            it('should do nothing if given a null bot', async () => {
                library.api.clearAnimations(null);
            });

            it('should do nothing if given a bot with no animations', async () => {
                library.api.clearAnimations(bot1);
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
                    library.api.os.toast('abc')
                );
                const expected = toast('abc');
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected, expected]);
            });

            it('should add the action if it has been rejected', () => {
                const action = library.api.os.toast('abc');
                library.api.action.reject(action);
                library.api.action.perform(action);
                expect(context.actions).toEqual([
                    toast('abc'),
                    reject(toast('abc')),
                    toast('abc'),
                ]);
            });

            it('should convert tag edits to remote tag edits', () => {
                const action = botUpdated('test', {
                    tags: {
                        abc: edit({}, insert('abc')),
                    },
                });

                library.api.action.perform(action);
                expect(context.actions).toEqual([
                    botUpdated('test', {
                        tags: {
                            abc: remoteEdit({}, insert('abc')),
                        },
                    }),
                ]);
            });

            it('should convert tag mask edits to remote tag edits', () => {
                const action = botUpdated('test', {
                    masks: {
                        tempLocal: {
                            abc: edit({}, insert('abc')),
                        },
                    },
                });

                library.api.action.perform(action);
                expect(context.actions).toEqual([
                    botUpdated('test', {
                        masks: {
                            tempLocal: {
                                abc: remoteEdit({}, insert('abc')),
                            },
                        },
                    }),
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
                expect(action.actions).toEqual([original]);
            });

            it('should be able to reject multiple original actions', () => {
                const original1 = toast('abc');
                const original2 = toast('def');
                const action = library.api.action.reject({
                    type: 'show_toast',
                    message: 'abc',
                    [ORIGINAL_OBJECT]: [original1, original2],
                });
                const expected = reject(original1, original2);
                expect(action).toEqual(expected);
                expect(context.actions).toEqual([expected]);
                expect(action.actions).toEqual([original1, original2]);
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
                [
                    'top',
                    'top',
                    { x: 1, y: 1, z: 1 },
                    { x: 1, y: 1, z: 0.5 },
                ] as const,
                [
                    'bottom',
                    'bottom',
                    { x: 1, y: 1, z: 1 },
                    { x: 1, y: 1, z: 1.5 },
                ] as const,
                [
                    'center',
                    'center',
                    { x: 1, y: 1, z: 1 },
                    { x: 1, y: 1, z: 1 },
                ] as const,
                [
                    'front',
                    'front',
                    { x: 1, y: 1, z: 1 },
                    { x: 1, y: 1.5, z: 1 },
                ] as const,
                [
                    'back',
                    'back',
                    { x: 1, y: 1, z: 1 },
                    { x: 1, y: 0.5, z: 1 },
                ] as const,
                [
                    'left',
                    'left',
                    { x: 1, y: 1, z: 1 },
                    { x: 1.5, y: 1, z: 1 },
                ] as const,
                [
                    'right',
                    'right',
                    { x: 1, y: 1, z: 1 },
                    { x: 0.5, y: 1, z: 1 },
                ] as const,
                [
                    '[1, 2, 3]',
                    [1, 2, 3],
                    { x: 1, y: 1, z: 1 },
                    { x: 0, y: 3, z: -2 },
                ] as const,
            ];

            describe.each(cases)(
                'should support %s',
                (desc, anchorPoint, pos, expected) => {
                    it('should return the position of the given anchor point in world space', () => {
                        bot1.tags.homeX = pos.x;
                        bot1.tags.homeY = pos.y;
                        bot1.tags.homeZ = pos.z;

                        const position =
                            library.api.experiment.getAnchorPointPosition(
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

                        const position =
                            library.api.experiment.getAnchorPointPosition(
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

                        const position =
                            library.api.experiment.getAnchorPointPosition(
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

        describe('experiment.beginAudioRecording()', () => {
            it('should emit a BeginAudioRecordingAction', () => {
                const action: any =
                    library.api.experiment.beginAudioRecording();
                const expected = beginAudioRecording(context.tasks.size);
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('experiment.endAudioRecording()', () => {
            it('should emit a EndAudioRecordingAction', () => {
                const action: any = library.api.experiment.endAudioRecording();
                const expected = endAudioRecording(context.tasks.size);
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('experiment.beginRecording()', () => {
            it('should emit a BeginRecordingAction', () => {
                const action: any = library.api.experiment.beginRecording();
                const expected = beginRecording(
                    {
                        audio: true,
                        video: true,
                        screen: false,
                    },
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support custom options', () => {
                const action: any = library.api.experiment.beginRecording({
                    audio: false,
                    video: false,
                    screen: true,
                });
                const expected = beginRecording(
                    {
                        audio: false,
                        video: false,
                        screen: true,
                    },
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('experiment.endRecording()', () => {
            it('should emit a EndRecordingAction', () => {
                const action: any = library.api.experiment.endRecording();
                const expected = endRecording(context.tasks.size);
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('experiment.speakText()', () => {
            it('should emit a SpeakTextAction', () => {
                const action: any = library.api.experiment.speakText('abcdef');
                const expected = speakText('abcdef', {}, context.tasks.size);
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should support custom options', () => {
                const action: any = library.api.experiment.speakText('abcdef', {
                    rate: 2,
                    pitch: 3,
                    voice: 'test',
                });
                const expected = speakText(
                    'abcdef',
                    {
                        rate: 2,
                        pitch: 3,
                        voice: 'test',
                    },
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });

            it('should convert synthetic voice objects to a name', () => {
                const action: any = library.api.experiment.speakText('abcdef', {
                    rate: 2,
                    pitch: 3,
                    voice: {
                        default: true,
                        language: 'abc',
                        name: 'def',
                    },
                });
                const expected = speakText(
                    'abcdef',
                    {
                        rate: 2,
                        pitch: 3,
                        voice: 'def',
                    },
                    context.tasks.size
                );
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
                expect(context.actions).toEqual([expected]);
            });
        });

        describe('experiment.getVoices()', () => {
            it('should emit a GetVoicesAction', () => {
                const action: any = library.api.experiment.getVoices();
                const expected = getVoices(context.tasks.size);
                expect(action[ORIGINAL_OBJECT]).toEqual(expected);
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

        it('should error if trying to set a tag to a bot', () => {
            expect(() => {
                library.api.setTag(bot1, '#name', bot2);
            }).toThrow();
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
                abc: remoteEdit(
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
                abc: remoteEdit(
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
                abc: remoteEdit(
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
                abc: remoteEdit(
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
                abc: remoteEdit(
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
                abc: remoteEdit(
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
                abc: remoteEdit(
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
                    abc: remoteEdit(
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
                    abc: remoteEdit(
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
                    abc: remoteEdit(
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
                    abc: remoteEdit(
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
                    abc: remoteEdit(
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
                    abc: remoteEdit(
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
                    abc: remoteEdit(
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
                abc: remoteEdit(
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
                abc: remoteEdit(
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
                abc: remoteEdit(
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
                abc: remoteEdit(
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

    describe('deleteTagMaskText()', () => {
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);

            library.api.setTagMask(bot2, 'abc', 'hello', 'local');
            bot2[CLEAR_CHANGES_SYMBOL]();
        });

        it('should do nothing if the tag doesnt exist', () => {
            const result = library.api.deleteTagMaskText(
                bot1,
                'abc',
                0,
                2,
                'local'
            );

            expect(result).toEqual('');
            expect(bot1.masks.abc).toBeUndefined();
            expect(bot1.maskChanges).toEqual({});
        });

        it('should delete the text from the start of the given tag', () => {
            const result = library.api.deleteTagMaskText(
                bot2,
                'abc',
                0,
                2,
                'local'
            );

            expect(result).toEqual('llo');
            expect(bot2.masks.abc).toEqual('llo');
            expect(bot2.maskChanges).toEqual({
                local: {
                    abc: remoteEdit(
                        testScriptBotInterface.currentVersion.vector,
                        preserve(0),
                        del(2)
                    ),
                },
            });
        });

        it('should insert the text into the middle of the given tag', () => {
            const result = library.api.deleteTagMaskText(
                bot2,
                'abc',
                2,
                2,
                'local'
            );

            expect(result).toEqual('heo');
            expect(bot2.masks.abc).toEqual('heo');
            expect(bot2.maskChanges).toEqual({
                local: {
                    abc: remoteEdit(
                        testScriptBotInterface.currentVersion.vector,
                        preserve(2),
                        del(2)
                    ),
                },
            });
        });

        it('should delete the text from the end of the given tag', () => {
            const result = library.api.deleteTagMaskText(
                bot2,
                'abc',
                3,
                2,
                'local'
            );

            expect(result).toEqual('hel');
            expect(bot2.masks.abc).toEqual('hel');
            expect(bot2.maskChanges).toEqual({
                local: {
                    abc: remoteEdit(
                        testScriptBotInterface.currentVersion.vector,
                        preserve(3),
                        del(2)
                    ),
                },
            });
        });

        it('should allow negative numbers to delete from the end of the string', () => {
            const result = library.api.deleteTagMaskText(
                bot2,
                'abc',
                -2,
                2,
                'local'
            );

            expect(result).toEqual('hel');
            expect(bot2.masks.abc).toEqual('hel');
            expect(bot2.maskChanges).toEqual({
                local: {
                    abc: remoteEdit(
                        testScriptBotInterface.currentVersion.vector,
                        preserve(3),
                        del(2)
                    ),
                },
            });
        });

        it('should be able to delete from the specified space when a higher priority tag is available', () => {
            library.api.setTagMask(bot2, 'abc', 'wrong', 'tempLocal');
            bot2[CLEAR_CHANGES_SYMBOL]();

            const result = library.api.deleteTagMaskText(
                bot2,
                'abc',
                3,
                2,
                'local'
            );

            expect(result).toEqual('wrong');
            expect(bot2.masks.abc).toEqual('wrong');
            expect(bot2.maskChanges).toEqual({
                local: {
                    abc: remoteEdit(
                        testScriptBotInterface.currentVersion.vector,
                        preserve(3),
                        del(2)
                    ),
                },
            });
        });

        it('should do nothing when using negative numbers to delete from the end of the string when the current tag value is empty', () => {
            const result = library.api.deleteTagMaskText(
                bot1,
                'abc',
                -1,
                1,
                'local'
            );

            expect(result).toEqual('');
            expect(bot1.masks.abc).toBeUndefined();
            expect(bot1.maskChanges).toEqual({});
        });

        it('should clamp to the end of the string', () => {
            const result = library.api.deleteTagMaskText(
                bot2,
                'abc',
                7,
                1,
                'local'
            );

            expect(result).toEqual('hello');
            expect(bot2.masks.abc).toEqual('hello');
            expect(bot2.maskChanges).toEqual({});
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
            expect(bot1.tags.name).toBeUndefined();
            expect(bot1.tags.nameX).toBeUndefined();
            expect(bot1.tags.nameY).toBeUndefined();
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
            expect(bot1.tags.name).toBeUndefined();
            expect(bot1.tags.nameX).toBeUndefined();
            expect(bot1.tags.nameY).toBeUndefined();
            expect(bot1.tags.other).toEqual(true);
            expect(bot2.tags.name).toBeUndefined();
            expect(bot2.tags.nameX).toBeUndefined();
            expect(bot2.tags.nameY).toBeUndefined();
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

            expect(bot1.tags.abc).toBeUndefined();
            expect(bot1.tags.def).toBe(123);
        });

        it('should rename the given tag on the given bots', () => {
            bot1.tags.abc = 123;
            bot2.tags.abc = 456;

            library.api.renameTag([bot1, bot2], 'abc', 'def');

            expect(bot1.tags.abc).toBeUndefined();
            expect(bot1.tags.def).toBe(123);

            expect(bot2.tags.abc).toBeUndefined();
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

            expect(bot1.tags.abc).toBeUndefined();
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

        it('should error when adding a bot to a mod', () => {
            const other = createDummyRuntimeBot('other');
            addToContext(context, other);

            let mod: any = {};
            expect(() => {
                library.api.applyMod(mod, { myBot: other });
            }).toThrow();
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

            expect(bot1.tags.abc).toBeUndefined();
            expect(bot1.tags.num).toEqual(123);
        });
    });

    describe('create()', () => {
        let tagContext: TagSpecificApiOptions;

        beforeEach(() => {
            tagContext = {
                bot: null,
                config: null,
                creator: null,
                tag: null,
            };
        });

        it('should return the created bot', () => {
            uuidMock.mockReturnValue('uuid');
            const bot = library.tagSpecificApi.create(tagContext)({
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
            tagContext.bot = creator;

            uuidMock.mockReturnValue('uuid');
            const bot = library.tagSpecificApi.create(tagContext)({
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
            tagContext.bot = creator;

            uuidMock.mockReturnValue('uuid');
            const bot = library.tagSpecificApi.create(tagContext)(
                'otherBot' as any,
                {
                    abc: 'def',
                }
            );
            expect(bot).toEqual(
                createDummyRuntimeBot('uuid', {
                    creator: 'creator',
                    abc: 'def',
                })
            );
        });
        it('should support multiple arguments', () => {
            uuidMock.mockReturnValue('uuid');
            const bot = library.tagSpecificApi.create(tagContext)(
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
            const bot = library.tagSpecificApi.create(tagContext)(other);
            expect(bot).toEqual(
                createDummyRuntimeBot('uuid', {
                    abc: 'def',
                    num: 1,
                })
            );
        });

        it('should error when setting a bot to a tag', () => {
            const other = createDummyRuntimeBot('other');
            addToContext(context, other);

            other.tags.abc = 'def';
            other.tags.num = 1;

            uuidMock.mockReturnValue('uuid');
            const create = library.tagSpecificApi.create(tagContext);
            expect(() => {
                create({
                    myTag: other,
                });
            }).toThrow();
        });

        it('should support modifying the returned bot', () => {
            uuidMock.mockReturnValue('uuid');
            const bot = library.tagSpecificApi.create(tagContext)({
                abc: 'def',
            }) as RuntimeBot;
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
                links: {},
                listeners: {},
                signatures: {},
            });
        });
        it('should add the new bot to the context', () => {
            uuidMock.mockReturnValue('uuid');
            const bot = library.tagSpecificApi.create(tagContext)({
                abc: 'def',
            });

            const bots = library.api.getBots('abc', 'def');
            expect(bots[0]).toBe(bot);
        });
        it('should trigger onCreate() on the created bot.', () => {
            uuidMock.mockReturnValue('uuid');
            const callback = jest.fn();
            const bot = library.tagSpecificApi.create(tagContext)({
                abc: 'def',
                onCreate: callback,
            });

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
                links: {},
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
            context.recordListenerPresense(bot1.id, 'onAnyCreate', true);

            const bot = library.tagSpecificApi.create(tagContext)({
                abc: 'def',
            });

            expect(onAnyCreate1).toBeCalledWith({
                bot: bot,
            });
        });
        it('should support arrays of diffs as arguments', () => {
            uuidMock.mockReturnValueOnce('uuid1').mockReturnValueOnce('uuid2');
            const bots = library.tagSpecificApi.create(tagContext)([
                { abc: 'def' },
                { abc: 123 },
            ]);

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
            const bots = library.tagSpecificApi.create(tagContext)(
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
            const bots = library.tagSpecificApi.create(tagContext)([
                first,
                second,
            ]);

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
            const bots = library.tagSpecificApi.create(tagContext)([other]);
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
            const bots = library.tagSpecificApi.create(tagContext)([
                other,
            ]) as RuntimeBot;
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
            library.tagSpecificApi.create(tagContext)({ abc: abc, test: true });
            library.api.shout('abc');

            expect(abc).toBeCalled();
        });

        const listeningTagCases = ['auxListening', 'listening'];
        describe.each(listeningTagCases)('%s', (tag: string) => {
            it('should be able to shout to a new bot that is just now listening', () => {
                uuidMock.mockReturnValue('uuid');
                const abc = jest.fn();
                library.tagSpecificApi.create(tagContext)(
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
                library.tagSpecificApi.create(tagContext)({
                    test: true,
                    abc: abc,
                });
            });
            context.recordListenerPresense(bot1.id, 'create', true);

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
                library.tagSpecificApi.create(tagContext)({
                    test: true,
                    abc,
                    def,
                    space: 'custom',
                });
            });
            context.recordListenerPresense(bot1.id, 'create', true);

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
                return library.tagSpecificApi.create(tagContext)({
                    test: true,
                    abc,
                });
            });
            context.recordListenerPresense(bot1.id, 'create', true);

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
                return library.tagSpecificApi.create(tagContext)({
                    test: true,
                    abc,
                    def,
                });
            });
            context.recordListenerPresense(bot1.id, 'create', true);

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
                        b = library.tagSpecificApi.create(tagContext)(
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
            context.recordListenerPresense(bot1.id, 'ensureCreated', true);

            library.api.shout('ensureCreated');
            library.api.shout('ensureCreated');

            expect(ensureCreated).toBeCalledTimes(2);
            expect(setup).toBeCalledTimes(1);
            expect(otherPart).toBeCalledTimes(1);
        });

        it('should ignore null mods', () => {
            uuidMock.mockReturnValue('uuid');
            const bot = library.tagSpecificApi.create(tagContext)(null, {
                abc: 'def',
            });

            expect(bot).toEqual(
                createDummyRuntimeBot('uuid', {
                    abc: 'def',
                })
            );
        });

        it('should throw an error if creating a bot with no tags', () => {
            uuidMock.mockReturnValue('uuid');
            expect(() => {
                library.tagSpecificApi.create(tagContext)({});
            }).toThrow();
        });

        it('should be able to create a bot that has tags but is given a mod with no tags', () => {
            uuidMock.mockReturnValue('uuid');
            const bot = library.tagSpecificApi.create(tagContext)(
                {
                    abc: 'def',
                },
                {}
            );
            expect(bot).toEqual(
                createDummyRuntimeBot('uuid', {
                    abc: 'def',
                })
            );
        });

        it('should throw an error if given an array with a mod that has no tags', () => {
            uuidMock.mockReturnValue('uuid');
            expect(() => {
                library.tagSpecificApi.create(tagContext)([{}]);
            }).toThrow();
        });

        describe('space', () => {
            it('should set the space of the bot', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.tagSpecificApi.create(tagContext)({
                    space: 'local',
                    abc: 'def',
                });
                expect(bot).toEqual(
                    createDummyRuntimeBot('uuid', { abc: 'def' }, 'local')
                );
            });

            it('should use the last space', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.tagSpecificApi.create(tagContext)(
                    { space: 'tempLocal' },
                    { space: 'local' },
                    { abc: 'def' }
                );
                expect(bot).toEqual(
                    createDummyRuntimeBot(
                        'uuid',
                        {
                            abc: 'def',
                        },
                        'local'
                    )
                );
            });

            it('should use the last space even if it is null', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.tagSpecificApi.create(tagContext)(
                    { space: 'tempLocal' },
                    { space: null },
                    { abc: 'def' }
                );
                expect(bot).toEqual(
                    createDummyRuntimeBot('uuid', {
                        abc: 'def',
                    })
                );
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
                    const bot = library.tagSpecificApi.create(tagContext)({
                        space: value,
                        abc: 'def',
                    });
                    expect(bot).toEqual(
                        createDummyRuntimeBot('uuid', {
                            abc: 'def',
                        })
                    );
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

                tagContext.bot = bot1;
            });

            it('should set the creator to the given bot', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.tagSpecificApi.create(tagContext)({
                    creator: bot1.id,
                });
                expect(bot).toEqual(
                    createDummyRuntimeBot('uuid', {
                        creator: 'bot1',
                    })
                );
            });

            it('should be able to set the creator to null', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.tagSpecificApi.create(tagContext)({
                    creator: null,
                    abc: 'def',
                });
                expect(bot).toEqual(
                    createDummyRuntimeBot('uuid', {
                        abc: 'def',
                    })
                );
            });

            it('should set creator to null if it references a bot in a different space', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.tagSpecificApi.create(tagContext)({
                    creator: bot1.id,
                    space: 'local',
                    abc: 'def',
                });
                expect(bot).toEqual(
                    createDummyRuntimeBot(
                        'uuid',
                        {
                            abc: 'def',
                        },
                        'local'
                    )
                );
            });

            it('should set creator to null if it references a bot that does not exist', () => {
                uuidMock.mockReturnValueOnce('uuid');
                const bot = library.tagSpecificApi.create(tagContext)({
                    creator: 'missing',
                    abc: 'def',
                });
                expect(bot).toEqual(
                    createDummyRuntimeBot('uuid', {
                        abc: 'def',
                    })
                );
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

        it('should support destroying bots that have creator set to a bot link', () => {
            bot3.tags.creator = '🔗test2';
            bot4.tags.creator = '🔗test2';

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
            context.recordListenerPresense(bot1.id, 'onDestroy', true);

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
            const newBot = library.tagSpecificApi.create({
                bot: null,
                config: null,
                creator: null,
                tag: null,
            })({
                abc: 'def',
            });
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
            context.recordListenerPresense(bot1.id, 'stateAbcOnEnter', true);
            library.api.changeState(bot1, 'Abc');

            expect(enter).toBeCalledTimes(1);
        });

        it('should send an @onExit whisper to the bot', () => {
            const exit = (bot1.listeners.stateXyzOnExit = jest.fn());
            context.recordListenerPresense(bot1.id, 'stateXyzOnExit', true);
            bot1.tags.state = 'Xyz';
            library.api.changeState(bot1, 'Abc');

            expect(exit).toBeCalledTimes(1);
        });

        it('should use the given group name', () => {
            const enter = (bot1.listeners.funAbcOnEnter = jest.fn());
            const exit = (bot1.listeners.funXyzOnExit = jest.fn());
            context.recordListenerPresense(bot1.id, 'funAbcOnEnter', true);
            context.recordListenerPresense(bot1.id, 'funXyzOnExit', true);

            bot1.tags.fun = 'Xyz';
            library.api.changeState(bot1, 'Abc', 'fun');

            expect(enter).toBeCalledTimes(1);
            expect(exit).toBeCalledTimes(1);
        });

        it('should do nothing if the state does not change', () => {
            const enter = (bot1.listeners.stateAbcOnEnter = jest.fn());
            const exit = (bot1.listeners.stateXyzOnExit = jest.fn());
            context.recordListenerPresense(bot1.id, 'stateAbcOnEnter', true);
            context.recordListenerPresense(bot1.id, 'stateXyzOnExit', true);

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

    describe('priorityShout()', () => {
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

        function recordListeners() {
            for (let bot of [bot1, bot2, bot3, bot4]) {
                for (let key in bot.listeners) {
                    context.recordListenerPresense(bot.id, key, true);
                }
            }
        }

        it('should run the event on every bot', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn());
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());

            recordListeners();

            library.api.priorityShout(['sayHello']);
            expect(sayHello1).toBeCalled();
            expect(sayHello2).toBeCalled();
        });

        it('should not run the event on the second bot if the first bot returns a value', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest
                .fn()
                .mockImplementation(() => 123));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());

            recordListeners();

            library.api.priorityShout(['sayHello']);
            expect(sayHello1).toBeCalled();
            expect(sayHello2).not.toBeCalled();
        });

        it('should run the next shout if nothing returns a value', () => {
            const abc1 = (bot1.listeners.abc = jest.fn());
            const abc2 = (bot2.listeners.abc = jest.fn());

            const def1 = (bot1.listeners.def = jest.fn());
            const def2 = (bot2.listeners.def = jest.fn());

            recordListeners();

            library.api.priorityShout(['abc', 'def']);
            expect(abc1).toBeCalled();
            expect(abc2).toBeCalled();

            expect(def1).toBeCalled();
            expect(def2).toBeCalled();
        });

        it('should return undefined if there are no listeners', () => {
            recordListeners();

            expect(library.api.priorityShout(['abc', 'def'])).toBeUndefined();
        });

        it('should return the first returned value', () => {
            const abc1 = (bot1.listeners.abc = jest.fn(() => 123));
            const abc2 = (bot2.listeners.abc = jest.fn(() => 456));

            const def1 = (bot1.listeners.def = jest.fn(() => 789));
            const def2 = (bot2.listeners.def = jest.fn(() => 10));

            recordListeners();

            let result = library.api.priorityShout(['abc', 'def']);
            expect(result).toBe(123);
            expect(abc1).toBeCalled();
            expect(abc2).not.toBeCalled();

            expect(def1).not.toBeCalled();
            expect(def2).not.toBeCalled();
        });

        it('should short circuit when null is returned', () => {
            const abc1 = (bot1.listeners.abc = jest.fn(() => null));
            const abc2 = (bot2.listeners.abc = jest.fn(() => 456));

            const def1 = (bot1.listeners.def = jest.fn(() => 789));
            const def2 = (bot2.listeners.def = jest.fn(() => 10));

            recordListeners();

            let result = library.api.priorityShout(['abc', 'def']);
            expect(result).toBe(null);
            expect(abc1).toBeCalled();
            expect(abc2).not.toBeCalled();

            expect(def1).not.toBeCalled();
            expect(def2).not.toBeCalled();
        });

        it('should use the given argument', () => {
            const abc1 = (bot1.listeners.abc = jest.fn());
            const abc2 = (bot2.listeners.abc = jest.fn());

            const def1 = (bot1.listeners.def = jest.fn());
            const def2 = (bot2.listeners.def = jest.fn());

            recordListeners();

            let arg = {};
            library.api.priorityShout(['abc', 'def'], arg);
            expect(abc1).toBeCalledWith(arg);
            expect(abc2).toBeCalledWith(arg);
            expect(def1).toBeCalledWith(arg);
            expect(def2).toBeCalledWith(arg);
        });
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

        function recordListeners() {
            for (let bot of [bot1, bot2, bot3, bot4]) {
                for (let key in bot.listeners) {
                    context.recordListenerPresense(bot.id, key, true);
                }
            }
        }

        it('should run the event on every bot', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn());
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());

            recordListeners();

            library.api.shout('sayHello');
            expect(sayHello1).toBeCalled();
            expect(sayHello2).toBeCalled();
        });

        it('should set the given argument as the first variable', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn());
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());

            recordListeners();

            library.api.shout('sayHello', { hi: 'test' });
            expect(sayHello1).toBeCalledWith({ hi: 'test' });
            expect(sayHello2).toBeCalledWith({ hi: 'test' });
        });

        it('should handle passing bots as arguments', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn());
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());

            recordListeners();

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
            recordListeners();

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
            recordListeners();

            library.api.shout('sayHello', { bot: bot3 });
            expect(sayHello1).toBeCalledWith({ bot: bot3 });
            expect(sayHello2).toBeCalledWith({ bot: bot3 });
            expect(bot3.tags.hit1).toEqual(true);
            expect(bot3.tags.hit2).toEqual(true);
        });

        it('should handle primitive values', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn());
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());
            recordListeners();

            library.api.shout('sayHello', true);
            expect(sayHello1).toBeCalledWith(true);
            expect(sayHello2).toBeCalledWith(true);
        });

        it('should return an array of results from the other formulas', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => 1));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => 2));
            recordListeners();

            const results = library.api.shout('sayHello');
            expect(results).toEqual([1, 2]);
        });

        const tagCases = ['auxListening', 'listening'];
        describe.each(tagCases)('%s', (tag: string) => {
            it('should ignore bots that are not listening', () => {
                const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => 1));
                const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => 2));
                recordListeners();

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
            recordListeners();

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
            recordListeners();

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
            const tagContext: TagSpecificApiOptions = {
                bot: null,
                config: null,
                creator: null,
                tag: null,
            };
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {
                library.tagSpecificApi.create(tagContext)({
                    num: 1,
                });
                library.tagSpecificApi.create(tagContext)({
                    num: 2,
                });
            }));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());
            const sayHello3 = (bot3.listeners.sayHello = jest.fn());
            const sayHello4 = (bot4.listeners.sayHello = jest.fn());
            recordListeners();

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
                recordListeners();

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
            recordListeners();

            library.api.shout('sayHello');
            expect(sayHello1).toBeCalled();
            expect(sayHello2).toBeCalled();
            expect(sayHello3).toBeCalled();
            expect(sayHello4).toBeCalled();
            expect(context.errors).toEqual([new Error('abc')]);
        });

        it('should handle exceptions on async listeners on a per-bot basis', async () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(
                async () => {}
            ));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(async () => {
                throw new Error('abc');
            }));
            const sayHello3 = (bot3.listeners.sayHello = jest.fn());
            const sayHello4 = (bot4.listeners.sayHello = jest.fn());
            recordListeners();

            library.api.shout('sayHello');

            await waitAsync();

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
            recordListeners();

            library.api.shout('sayHello', 123);
            const expected = {
                name: 'sayHello',
                that: 123,
                responses: [undefined, undefined, undefined] as any[],
                targets: [bot1, bot2, bot3],
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
            recordListeners();

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
            recordListeners();

            context.energy = 1;
            expect(() => {
                library.api.shout('sayHello');
            }).toThrowError(new RanOutOfEnergyError());
        });

        it('should only take 1 energy for multiple listeners', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => {}));
            const sayHello3 = (bot3.listeners.sayHello = jest.fn(() => {}));
            recordListeners();

            context.energy = 2;
            library.api.shout('sayHello');
            expect(context.energy).toBe(1);
        });

        it('should not perform an energy check if there are no listeners', () => {
            recordListeners();

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
            recordListeners();

            context.energy = 20;
            expect(() => {
                library.api.shout('first');
            }).toThrowError(new RanOutOfEnergyError());
        });

        describe('timers', () => {
            let now: jest.Mock<number>;
            let oldNow: typeof performance.now;

            beforeAll(() => {
                oldNow = globalThis.performance.now;
                globalThis.performance.now = now = jest.fn();
            });

            afterAll(() => {
                globalThis.performance.now = oldNow;
            });

            it('should use performance.now() to track the amount of time the shout takes', () => {
                now.mockReturnValueOnce(1) // sayHello start
                    .mockReturnValueOnce(10) // sayHello end
                    .mockReturnValueOnce(12) // onListen start
                    .mockReturnValueOnce(15) // onListen end
                    .mockReturnValueOnce(16) // onAnyListen end
                    .mockReturnValueOnce(20); // onAnyListen end

                const sayHello1 = (bot1.listeners.sayHello = jest.fn());
                const sayHello2 = (bot2.listeners.sayHello = jest.fn());
                recordListeners();

                library.api.shout('sayHello');

                const timers = context.getShoutTimers();

                expect(timers).toEqual([
                    {
                        tag: 'sayHello',
                        timeMs: 9,
                    },
                    {
                        tag: 'onAnyListen',
                        timeMs: 4,
                    },
                    {
                        tag: 'onListen',
                        timeMs: 3,
                    },
                ]);
            });
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

        function recordListeners() {
            for (let bot of [bot1, bot2, bot3, bot4]) {
                for (let key in bot.listeners) {
                    context.recordListenerPresense(bot.id, key, true);
                }
            }
        }

        it('should send an event only to the given bot', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn());
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());
            recordListeners();

            library.api.whisper(bot1, 'sayHello');
            expect(sayHello1).toBeCalled();
            expect(sayHello2).not.toBeCalled();
        });

        it('should send an event only to the given list of bots', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn());
            const sayHello2 = (bot2.listeners.sayHello = jest.fn());
            const sayHello3 = (bot3.listeners.sayHello = jest.fn());
            recordListeners();

            library.api.whisper([bot1, bot2], 'sayHello');
            expect(sayHello1).toBeCalled();
            expect(sayHello2).toBeCalled();
            expect(sayHello3).not.toBeCalled();
        });

        it('should return an array of results from the other formulas ordered by how they were given', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => 1));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => 2));
            const sayHello3 = (bot3.listeners.sayHello = jest.fn(() => 3));
            recordListeners();

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
                recordListeners();

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
            recordListeners();

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
                recordListeners();

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
            recordListeners();

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
            recordListeners();

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
            recordListeners();

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
            recordListeners();

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
                recordListeners();

                library.api.whisper(bot, 'sayHello');

                expect(sayHello1).not.toBeCalled();
                expect(sayHello2).not.toBeCalled();
                expect(sayHello3).not.toBeCalled();
            }
        );

        it('should perform an energy check', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            recordListeners();

            context.energy = 1;
            expect(() => {
                library.api.whisper(bot1, 'sayHello');
            }).toThrowError(new RanOutOfEnergyError());
        });

        it('should only take 1 energy for multiple listeners', () => {
            const sayHello1 = (bot1.listeners.sayHello = jest.fn(() => {}));
            const sayHello2 = (bot2.listeners.sayHello = jest.fn(() => {}));
            recordListeners();

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
            recordListeners();

            context.energy = 20;
            expect(() => {
                library.api.whisper(bot1, 'first');
            }).toThrowError(new RanOutOfEnergyError());
        });
    });

    describe('setTimeout()', () => {
        let tagContext: TagSpecificApiOptions;
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeAll(() => {
            jest.useFakeTimers('modern');
        });

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);

            tagContext = {
                bot: bot1,
                config: null,
                creator: null,
                tag: null,
            };
        });

        afterEach(() => {
            jest.clearAllTimers();
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        it('should add a timer to the list of timers for the current bot', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.setTimeout(tagContext)(
                fn,
                500
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'timeout',
                },
            ]);
        });

        it('should clear the timer when the timeout is finished', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.setTimeout(tagContext)(
                fn,
                500
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'timeout',
                },
            ]);

            jest.advanceTimersByTime(500);

            expect(fn).toBeCalledTimes(1);
            expect(context.getBotTimers(bot1.id)).toEqual([]);
        });

        it('should clear the timer when the bot is destroyed', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.setTimeout(tagContext)(
                fn,
                500
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'timeout',
                },
            ]);

            library.api.destroy(bot1);

            expect(context.getBotTimers(bot1.id)).toEqual([]);

            jest.advanceTimersByTime(500);

            expect(fn).toBeCalledTimes(0);
            expect(context.getBotTimers(bot1.id)).toEqual([]);
        });

        it('should be able to clear the timer with clearTimeout()', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.setTimeout(tagContext)(
                fn,
                500
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'timeout',
                },
            ]);

            library.api.clearTimeout(timeoutId);

            expect(context.getBotTimers(bot1.id)).toEqual([]);

            jest.advanceTimersByTime(500);

            expect(fn).toBeCalledTimes(0);
            expect(context.getBotTimers(bot1.id)).toEqual([]);
        });

        it('should be able to clear the timer with clearInterval()', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.setTimeout(tagContext)(
                fn,
                500
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'timeout',
                },
            ]);

            library.api.clearInterval(timeoutId);

            expect(context.getBotTimers(bot1.id)).toEqual([]);

            jest.advanceTimersByTime(500);

            expect(fn).toBeCalledTimes(0);
            expect(context.getBotTimers(bot1.id)).toEqual([]);
        });

        it('clearTimeout() should not error if there are no timers for the bot', () => {
            library.api.clearTimeout(99);
        });
    });

    describe('setInterval()', () => {
        let tagContext: TagSpecificApiOptions;
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;

        beforeAll(() => {
            jest.useFakeTimers('modern');
        });

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);

            tagContext = {
                bot: bot1,
                config: null,
                creator: null,
                tag: null,
            };
        });

        afterEach(() => {
            jest.clearAllTimers();
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        it('should add a timer to the list of timers for the current bot', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.setInterval(tagContext)(
                fn,
                500
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'interval',
                },
            ]);
        });

        it('should not clear the timer when the interval has run', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.setInterval(tagContext)(
                fn,
                500
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'interval',
                },
            ]);

            jest.advanceTimersByTime(500);

            expect(fn).toBeCalledTimes(1);

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'interval',
                },
            ]);

            jest.advanceTimersByTime(500);
            expect(fn).toBeCalledTimes(2);
        });

        it('should clear the timer when the bot is destroyed', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.setInterval(tagContext)(
                fn,
                500
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'interval',
                },
            ]);

            library.api.destroy(bot1);

            expect(context.getBotTimers(bot1.id)).toEqual([]);

            jest.advanceTimersByTime(500);

            expect(fn).toBeCalledTimes(0);
            expect(context.getBotTimers(bot1.id)).toEqual([]);
        });

        it('should clear the timer with clearInterval()', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.setInterval(tagContext)(
                fn,
                500
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'interval',
                },
            ]);

            library.api.clearInterval(timeoutId);

            expect(context.getBotTimers(bot1.id)).toEqual([]);

            jest.advanceTimersByTime(500);

            expect(fn).toBeCalledTimes(0);
            expect(context.getBotTimers(bot1.id)).toEqual([]);
        });

        it('should clear the timer with clearTimeout()', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.setInterval(tagContext)(
                fn,
                500
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'interval',
                },
            ]);

            library.api.clearTimeout(timeoutId);

            expect(context.getBotTimers(bot1.id)).toEqual([]);

            jest.advanceTimersByTime(500);

            expect(fn).toBeCalledTimes(0);
            expect(context.getBotTimers(bot1.id)).toEqual([]);
        });

        it('clearInterval() should not error if there are no timers for the bot', () => {
            library.api.clearInterval(99);
        });
    });

    describe('assert()', () => {
        it('should throw an error if the given condition is false', () => {
            expect(() => {
                library.api.assert(false);
            }).toThrowError('Assertion failed.');
        });

        it('should not throw an error if the given condition is true', () => {
            expect(() => {
                library.api.assert(true);
            }).not.toThrowError('Assertion failed.');
        });

        it('should throw errors with the given message', () => {
            expect(() => {
                library.api.assert(false, 'Failed with reason.');
            }).toThrowError('Assertion failed. Failed with reason.');
        });
    });

    describe('assertEqual()', () => {
        it('should throw an error if the given values are not equal', () => {
            // expect(true).toEqual(false);
            expect(() => {
                library.api.assertEqual(true, false);
            }).toThrowErrorMatchingSnapshot();
        });

        it('should pretty print objects', () => {
            expect(() => {
                library.api.assertEqual({ abc: 123 }, { def: 456 });
            }).toThrowErrorMatchingSnapshot();
        });

        const noThrowCases: [string, any, any][] = [
            ['objects', { abc: 123 }, { abc: 123 }],
            ['arrays', [1, 2, 3], [1, 2, 3]],
            ['numbers', 123, 123],
            ['booleans', true, true],
            ['nulls', null, null],
        ];

        it.each(noThrowCases)(
            'should not throw when %s serialize to the same value',
            (name, value1, value2) => {
                expect(() => {
                    library.api.assertEqual(value1, value2);
                }).not.toThrowError();
            }
        );

        it('should support bots', () => {
            let bot1 = createDummyRuntimeBot('test1');
            let bot2 = createDummyRuntimeBot('test1');
            let bot3 = createDummyRuntimeBot('test3');

            bot1.tags.abc = 'def';
            bot2.tags.abc = 'def';
            bot3.tags.abc = 'def';

            expect(() => {
                library.api.assertEqual(bot1, bot2);
            }).not.toThrow();
            expect(() => {
                library.api.assertEqual(bot1, bot3);
            }).toThrow();
        });

        it('should support errors', () => {
            expect(() => {
                library.api.assertEqual(new Error('abc'), new Error('abc'));
            }).not.toThrow();
            expect(() => {
                library.api.assertEqual(new Error('abc'), new Error('def'));
            }).toThrow();
        });
    });

    describe('os.watchBot()', () => {
        let tagContext: TagSpecificApiOptions;
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;
        let bot3: RuntimeBot;

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');
            bot3 = createDummyRuntimeBot('test3');

            addToContext(context, bot1, bot2, bot3);

            tagContext = {
                bot: bot1,
                config: null,
                creator: null,
                tag: null,
            };
        });

        it('should add a timer to the list of timers for the current bot', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.watchBot(tagContext)(
                bot2,
                fn
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'watch_bot',
                    botId: bot2.id,
                    tag: null,
                    handler: expect.any(Function),
                },
            ]);
        });

        it('should support passing bot IDs directly', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.watchBot(tagContext)(
                'testBot',
                fn
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'watch_bot',
                    botId: 'testBot',
                    tag: null,
                    handler: expect.any(Function),
                },
            ]);
        });

        it('should add a timer for each bot in the given list', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.watchBot(tagContext)(
                [bot2, bot3.id],
                fn
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'watch_bot',
                    botId: bot2.id,
                    tag: null,
                    handler: expect.any(Function),
                },
                {
                    timerId: timeoutId,
                    type: 'watch_bot',
                    botId: bot3.id,
                    tag: null,
                    handler: expect.any(Function),
                },
            ]);
        });

        it('should call the given function when the handler is called', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.watchBot(tagContext)(
                'testBot',
                fn
            );

            const timer = context.getBotTimers(bot1.id)[0] as WatchBotTimer;
            timer.handler();

            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should clear the timer if the bot is destroyed', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.watchBot(tagContext)(
                'testBot',
                fn
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'watch_bot',
                    botId: 'testBot',
                    tag: null,
                    handler: expect.any(Function),
                },
            ]);

            library.api.destroy(bot1);

            expect(context.getBotTimers(bot1.id)).toEqual([]);
        });

        it('should be able to clear the timer by calling clearWatchBot()', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.watchBot(tagContext)(
                'testBot',
                fn
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'watch_bot',
                    botId: 'testBot',
                    tag: null,
                    handler: expect.any(Function),
                },
            ]);

            library.api.clearWatchBot(timeoutId);

            expect(context.getBotTimers(bot1.id)).toEqual([]);
        });

        it('should be able to all watchers for a timeout ID when calling clearWatchBot()', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.watchBot(tagContext)(
                [bot2, 'testBot'],
                fn
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'watch_bot',
                    botId: bot2.id,
                    tag: null,
                    handler: expect.any(Function),
                },
                {
                    timerId: timeoutId,
                    type: 'watch_bot',
                    botId: 'testBot',
                    tag: null,
                    handler: expect.any(Function),
                },
            ]);

            library.api.clearWatchBot(timeoutId);

            expect(context.getBotTimers(bot1.id)).toEqual([]);
        });

        it('should enqueue errors that are thrown by the handler', () => {
            const fn = jest.fn();
            fn.mockImplementation(() => {
                throw new Error('abc');
            });
            let timeoutId = library.tagSpecificApi.watchBot(tagContext)(
                'testBot',
                fn
            );

            const timer = context.getBotTimers(bot1.id)[0] as WatchBotTimer;

            const result = timer.handler();

            expect(result).toBeUndefined();
            expect(context.dequeueErrors()).toEqual([new Error('abc')]);
        });
    });

    describe('os.watchPortal()', () => {
        let tagContext: TagSpecificApiOptions;
        let bot1: RuntimeBot;
        let bot2: RuntimeBot;
        let bot3: RuntimeBot;

        beforeAll(() => {
            jest.useFakeTimers('modern');
        });

        beforeEach(() => {
            bot1 = createDummyRuntimeBot('test1');
            bot2 = createDummyRuntimeBot('test2');
            bot3 = createDummyRuntimeBot('test3');

            addToContext(context, bot1, bot2, bot3);

            tagContext = {
                bot: bot1,
                config: null,
                creator: null,
                tag: null,
            };
        });

        afterEach(() => {
            jest.clearAllTimers();
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        it('should add a timer to the list of timers for the current bot', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.watchPortal(tagContext)(
                'testPortal',
                fn
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'watch_portal',
                    portalId: 'testPortal',
                    tag: null,
                    handler: fn,
                },
            ]);
        });

        it('should clear the timer if the bot is destroyed', () => {
            const fn = jest.fn();
            let timeoutId = library.tagSpecificApi.watchPortal(tagContext)(
                'testPortal',
                fn
            );

            expect(context.getBotTimers(bot1.id)).toEqual([
                {
                    timerId: timeoutId,
                    type: 'watch_portal',
                    portalId: 'testPortal',
                    tag: null,
                    handler: fn,
                },
            ]);

            library.api.destroy(bot1);

            expect(context.getBotTimers(bot1.id)).toEqual([]);
        });
    });

    describe('os.inSheet()', () => {
        let player: RuntimeBot;

        beforeEach(() => {
            player = createDummyRuntimeBot('player', {}, 'tempLocal');
            addToContext(context, player);
            context.playerBot = player;
        });

        it('should return true if the player bot has a sheet portal', () => {
            player.tags.sheetPortal = 'sheet';

            expect(library.api.os.inSheet()).toBe(true);
        });

        it('should return false if the player bot does not have a sheet portal', () => {
            expect(library.api.os.inSheet()).toBe(false);
        });
    });

    describe('os.getCameraPosition()', () => {
        let gridPortal: RuntimeBot;
        let miniGridPortal: RuntimeBot;

        beforeEach(() => {
            gridPortal = createDummyRuntimeBot(
                'gridPortal',
                {
                    cameraPositionX: 1,
                    cameraPositionY: 2,
                    cameraPositionZ: 3,
                },
                'tempLocal'
            );
            miniGridPortal = createDummyRuntimeBot(
                'miniGridPortal',
                {
                    cameraPositionX: 4,
                    cameraPositionY: 5,
                    cameraPositionZ: 6,
                },
                'tempLocal'
            );
            addToContext(context, gridPortal, miniGridPortal);

            context.global = {
                gridPortalBot: gridPortal,
                miniGridPortalBot: miniGridPortal,
            };
        });

        it('should return NaN for x, y, and z if the grid portal bot is null', () => {
            context.global.gridPortalBot = null;
            const result = library.api.os.getCameraPosition();

            expect(result).toEqual({
                x: NaN,
                y: NaN,
                z: NaN,
            });
        });

        it('should return the x, y, and z of the camera for the grid portal', () => {
            const result = library.api.os.getCameraPosition();

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });

        it('should be able to get the mini camera position', () => {
            const result = library.api.os.getCameraPosition('miniGrid');

            expect(result).toEqual({
                x: 4,
                y: 5,
                z: 6,
            });
        });

        it('should be able to get the bot camera position', () => {
            const result = library.api.os.getCameraPosition('grid');

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });
    });

    describe('os.getCameraRotation()', () => {
        let gridPortal: RuntimeBot;
        let miniGridPortal: RuntimeBot;

        beforeEach(() => {
            gridPortal = createDummyRuntimeBot(
                'gridPortal',
                {
                    cameraRotationX: 1,
                    cameraRotationY: 2,
                    cameraRotationZ: 3,
                },
                'tempLocal'
            );
            miniGridPortal = createDummyRuntimeBot(
                'miniGridPortal',
                {
                    cameraRotationX: 4,
                    cameraRotationY: 5,
                    cameraRotationZ: 6,
                },
                'tempLocal'
            );
            addToContext(context, gridPortal, miniGridPortal);

            context.global = {
                gridPortalBot: gridPortal,
                miniGridPortalBot: miniGridPortal,
            };
        });

        it('should return NaN for x, y, and z if the grid portal bot is null', () => {
            delete context.global.gridPortalBot;
            const result = library.api.os.getCameraRotation();

            expect(result).toEqual({
                x: NaN,
                y: NaN,
                z: NaN,
            });
        });

        it('should return the x, y, and z of the player camera for the grid portal', () => {
            const result = library.api.os.getCameraRotation();

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });

        it('should be able to get the miniGridPortal camera rotation', () => {
            const result = library.api.os.getCameraRotation('miniGrid');

            expect(result).toEqual({
                x: 4,
                y: 5,
                z: 6,
            });
        });

        it('should be able to get the grid camera rotation', () => {
            const result = library.api.os.getCameraRotation('grid');

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });
    });

    describe('os.getFocusPoint()', () => {
        let gridPortal: RuntimeBot;
        let miniGridPortal: RuntimeBot;

        beforeEach(() => {
            gridPortal = createDummyRuntimeBot(
                'gridPortal',
                {
                    cameraFocusX: 1,
                    cameraFocusY: 2,
                    cameraFocusZ: 3,
                },
                'tempLocal'
            );
            miniGridPortal = createDummyRuntimeBot(
                'miniGridPortal',
                {
                    cameraFocusX: 4,
                    cameraFocusY: 5,
                    cameraFocusZ: 6,
                },
                'tempLocal'
            );
            addToContext(context, gridPortal, miniGridPortal);

            context.global = {
                gridPortalBot: gridPortal,
                miniGridPortalBot: miniGridPortal,
            };
        });

        it('should return NaN for x, y, and z if the grid portal bot is null', () => {
            delete context.global.gridPortalBot;
            const result = library.api.os.getFocusPoint();

            expect(result).toEqual({
                x: NaN,
                y: NaN,
                z: NaN,
            });
        });

        it('should return the x, y, and z of the player camera for the grid portal', () => {
            const result = library.api.os.getFocusPoint();

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });

        it('should be able to get the miniGridPortal camera rotation', () => {
            const result = library.api.os.getFocusPoint('miniGrid');

            expect(result).toEqual({
                x: 4,
                y: 5,
                z: 6,
            });
        });

        it('should be able to get the grid camera rotation', () => {
            const result = library.api.os.getFocusPoint('grid');

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });
    });

    describe('os.getPointerPosition()', () => {
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
            const result = library.api.os.getPointerPosition();

            expect(result).toEqual({
                x: NaN,
                y: NaN,
                z: NaN,
            });
        });

        it('should return the x, y, and z of the player camera for the mouse', () => {
            const result = library.api.os.getPointerPosition();

            expect(result).toEqual({
                x: 7,
                y: 8,
                z: 9,
            });
        });

        it('should be able to get the left pointer position', () => {
            const result = library.api.os.getPointerPosition('left');

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });

        it('should be able to get the right pointer position', () => {
            const result = library.api.os.getPointerPosition('right');

            expect(result).toEqual({
                x: 4,
                y: 5,
                z: 6,
            });
        });

        it('should be able to get the mouse pointer position', () => {
            const result = library.api.os.getPointerPosition('mouse');

            expect(result).toEqual({
                x: 7,
                y: 8,
                z: 9,
            });
        });
    });

    describe('os.getPointerRotation()', () => {
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
            const result = library.api.os.getPointerRotation();

            expect(result).toEqual({
                x: NaN,
                y: NaN,
                z: NaN,
            });
        });

        it('should return the x, y, and z of the player camera for the mouse', () => {
            const result = library.api.os.getPointerRotation();

            expect(result).toEqual({
                x: 7,
                y: 8,
                z: 9,
            });
        });

        it('should be able to get the left pointer position', () => {
            const result = library.api.os.getPointerRotation('left');

            expect(result).toEqual({
                x: 1,
                y: 2,
                z: 3,
            });
        });

        it('should be able to get the right pointer position', () => {
            const result = library.api.os.getPointerRotation('right');

            expect(result).toEqual({
                x: 4,
                y: 5,
                z: 6,
            });
        });

        it('should be able to get the mouse pointer position', () => {
            const result = library.api.os.getPointerRotation('mouse');

            expect(result).toEqual({
                x: 7,
                y: 8,
                z: 9,
            });
        });
    });

    describe('os.getPointerDirection()', () => {
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
            const result = library.api.os.getPointerDirection();

            expect(result).toEqual({
                x: NaN,
                y: NaN,
                z: NaN,
            });
        });

        it('should return the x, y, and z of the player camera for the mouse', () => {
            const result = library.api.os.getPointerDirection();

            expect(result.x).toBeCloseTo(0);
            expect(result.y).toBeCloseTo(1);
            expect(result.z).toBeCloseTo(0);
        });

        it('should be able to get the left pointer position', () => {
            const result = library.api.os.getPointerDirection('left');

            expect(result.x).toBeCloseTo(1);
            expect(result.y).toBeCloseTo(0);
            expect(result.z).toBeCloseTo(0);
        });

        it('should be able to get the right pointer position', () => {
            const result = library.api.os.getPointerDirection('right');

            expect(result.x).toBeCloseTo(0);
            expect(result.y).toBeCloseTo(0);
            expect(result.z).toBeCloseTo(-1);
        });

        it('should be able to get the mouse pointer position', () => {
            const result = library.api.os.getPointerDirection('mouse');

            expect(result.x).toBeCloseTo(0);
            expect(result.y).toBeCloseTo(1);
            expect(result.z).toBeCloseTo(0);
        });
    });

    describe('os.getInputState()', () => {
        let player: RuntimeBot;

        beforeEach(() => {
            player = createDummyRuntimeBot('player', {}, 'tempLocal');
            addToContext(context, player);
            context.playerBot = player;
        });

        it('should return null if the player bot is null', () => {
            context.playerBot = null;
            const result = library.api.os.getInputState('keyboard', 'a');

            expect(result).toEqual(null);
        });

        const cases = [
            [
                'mousePointer',
                'left',
                {
                    mousePointer_left: 'down',
                } as any,
                'down',
            ] as const,
            ['mousePointer', 'left', {} as any, null as any] as const,
            [
                'mousePointer',
                'right',
                {
                    mousePointer_right: 'held',
                } as any,
                'held',
            ] as const,
            [
                'leftPointer',
                'primary',
                {
                    leftPointer_primary: 'held',
                } as any,
                'held',
            ] as const,
            [
                'rightPointer',
                'primary',
                {
                    rightPointer_primary: 'down',
                } as any,
                'down',
            ] as const,
            [
                'keyboard',
                'a',
                {
                    keyboard_a: 'down',
                } as any,
                'down',
            ] as const,
            [
                'touch',
                '0',
                {
                    touch_0: 'down',
                } as any,
                'down',
            ] as const,
            [
                'touch',
                '1',
                {
                    touch_1: 'held',
                } as any,
                'held',
            ] as const,
        ];

        it.each(cases)(
            'should get the state from the %s %s button',
            (controller, button, state, expected) => {
                for (let tag in state) {
                    player.tags[tag] = state[tag];
                }

                const result = library.api.os.getInputState(controller, button);

                expect(result).toEqual(expected);
            }
        );
    });

    describe('os.getInputList()', () => {
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
            const result = library.api.os.getInputList();

            expect(result).toEqual([]);
        });

        it('should return an empty list if the player bot has no input list tag', () => {
            player.tags.inputList = null;
            const result = library.api.os.getInputList();

            expect(result).toEqual([]);
        });

        it('should return the input list of the player', () => {
            const result = library.api.os.getInputList();

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
            ['center', { x: 0, y: -0, z: 0 }] as const,
            ['front', { x: 0, y: 0.5, z: 0 }] as const,
            ['back', { x: 0, y: -0.5, z: 0 }] as const,
            ['bottom', { x: 0, y: -0, z: 0.5 }] as const,
            ['top', { x: 0, y: -0, z: -0.5 }] as const,
            ['left', { x: 0.5, y: -0, z: 0 }] as const,
            ['right', { x: -0.5, y: -0, z: 0 }] as const,

            // Should mirror the coordinates when using literals
            [[1, 2, 3], { x: -1, y: 2, z: -3 }] as const,
        ];

        it.each(cases)('should support %s', (mode: any, expected: any) => {
            expect(library.api.math.getAnchorPointOffset(mode)).toEqual(
                expected
            );
        });
    });

    describe('math.addVectors()', () => {
        const cases = [
            [
                'zeroes',
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: 0 },
            ] as const,
            [
                'numbers',
                { x: 1, y: 2, z: 3 },
                { x: 4, y: 5, z: 6 },
                { x: 5, y: 7, z: 9 },
            ] as const,
            [
                'strings',
                { x: 'a', y: 'b', z: 'c' },
                { x: 'd', y: 'e', z: 'f' },
                { x: 'ad', y: 'be', z: 'cf' },
            ] as const,

            [
                'negative numbers',
                { x: -1, y: -2, z: -3 },
                { x: 4, y: 5, z: 6 },
                { x: 3, y: 3, z: 3 },
            ] as const,

            [
                'objects with separate properties',
                { x: -1, y: -2, z: -3 },
                { a: 4, b: 5, c: 6 },
                { x: -1, y: -2, z: -3, a: 4, b: 5, c: 6 },
            ] as const,

            ['empty objects', {}, {}, {}] as const,

            ['null objects', null as any, null as any, {}] as const,
        ];

        it.each(cases)(
            'should add %s together',
            (desc, first, second, expected) => {
                expect(
                    library.api.math.addVectors(first, second as any)
                ).toEqual(expected);
            }
        );
    });

    describe('math.subtractVectors()', () => {
        const cases = [
            [
                'zeroes',
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 0, z: 0 },
            ] as const,
            [
                'numbers',
                { x: 1, y: 2, z: 3 },
                { x: 4, y: 5, z: 6 },
                { x: -3, y: -3, z: -3 },
            ] as const,
            [
                'strings',
                { x: 'a', y: 'b', z: 'c' },
                { x: 'd', y: 'e', z: 'f' },
                { x: NaN, y: NaN, z: NaN },
            ] as const,

            [
                'negative numbers',
                { x: -1, y: -2, z: -3 },
                { x: 4, y: 5, z: 6 },
                { x: -5, y: -7, z: -9 },
            ] as const,

            [
                'objects with separate properties',
                { x: -1, y: -2, z: -3 },
                { a: 4, b: 5, c: 6 },
                { x: -1, y: -2, z: -3, a: 4, b: 5, c: 6 },
            ] as const,

            ['empty objects', {}, {}, {}] as const,

            ['null objects', null as any, null as any, {}] as const,
        ];

        it.each(cases)(
            'should subtract %s from each other',
            (desc, first, second, expected) => {
                expect(
                    library.api.math.subtractVectors(first, second as any)
                ).toEqual(expected);
            }
        );
    });

    describe('math.negateVector()', () => {
        const cases = [
            ['zeroes', { x: 0, y: 0, z: 0 }, { x: -0, y: -0, z: -0 }] as const,

            ['numbers', { x: 1, y: 2, z: 3 }, { x: -1, y: -2, z: -3 }] as const,

            [
                'strings',
                { x: 'a', y: 'b', z: 'c' },
                { x: NaN, y: NaN, z: NaN },
            ] as const,

            [
                'negative numbers',
                { x: -1, y: -2, z: -3 },
                { x: 1, y: 2, z: 3 },
            ] as const,

            ['empty objects', {}, {}] as const,

            ['null objects', null as any, null as any] as const,
        ];

        it.each(cases)('should negate %s', (desc, first, expected) => {
            expect(library.api.math.negateVector(first)).toEqual(expected);
        });
    });

    describe('math.normalizeVector()', () => {
        const cases = [
            ['zeroes', { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }] as const,

            [
                'already normalized',
                { x: 1, y: 0, z: 0 },
                { x: 1, y: 0, z: 0 },
            ] as const,
            [
                'normalized',
                { x: 1, y: 2, z: 3 },
                {
                    x: 0.2672612419124244,
                    y: 0.5345224838248488,
                    z: 0.8017837257372732,
                },
            ] as const,

            [
                'strings',
                { x: 'a', y: 'b', z: 'c' },
                { x: NaN, y: NaN, z: NaN },
            ] as const,

            ['empty objects', {}, {}] as const,

            ['null objects', null as any, null as any] as const,
        ];

        it.each(cases)('should normalize %s', (desc, first, expected) => {
            expect(library.api.math.normalizeVector(first)).toEqual(expected);
        });
    });

    describe('math.vectorLength()', () => {
        const cases = [
            ['zeroes', { x: 0, y: 0, z: 0 }, 0] as const,

            ['already normalized', { x: 1, y: 0, z: 0 }, 1] as const,
            [
                'not normalized',
                { x: 1, y: 2, z: 3 },
                3.7416573867739413,
            ] as const,
            [
                'normalized',
                {
                    x: 0.2672612419124244,
                    y: 0.5345224838248488,
                    z: 0.8017837257372732,
                },
                1,
            ] as const,

            ['strings', { x: 'a', y: 'b', z: 'c' }, NaN] as const,

            ['empty objects', {}, 0] as const,

            ['null objects', null as any, null as any] as const,
        ];

        it.each(cases)('should calculate %s', (desc, first, expected) => {
            expect(library.api.math.vectorLength(first)).toEqual(expected);
        });
    });

    describe('math.scaleVector()', () => {
        const cases = [
            ['zeroes', { x: 0, y: 0, z: 0 }, 5, { x: 0, y: 0, z: 0 }] as const,
            ['numbers', { x: 1, y: 2, z: 3 }, 2, { x: 2, y: 4, z: 6 }] as const,
            [
                'negative numbers',
                { x: -1, y: -2, z: -3 },
                3,
                { x: -3, y: -6, z: -9 },
            ] as const,

            [
                'objects with separate properties',
                { a: 4, b: 5, c: 6 },
                2,
                { a: 8, b: 10, c: 12 },
            ] as const,

            ['empty objects', {}, 11, {}] as const,

            ['null objects', null as any, 3, null as any] as const,
        ];

        it.each(cases)(
            'should subtract %s from each other',
            (desc, first, second, expected) => {
                expect(
                    library.api.math.scaleVector(first, second as any)
                ).toEqual(expected);
            }
        );
    });

    describe('math.areClose()', () => {
        const cases = [
            [false, 1, 2],
            [true, 1, 1],
            [true, 1, 1.001],
            [false, 1, 1.009],
            [true, 1, 1.005],
            [false, 1, 1.01],
            [false, 1, 0.99],
            [false, 1, 0.991],
            [true, 1, 0.996],
            [true, 1, 0.9951],
        ] as const;

        it.each(cases)(
            'should return %s for %s == %s',
            (expected, first, second) => {
                expect(library.api.math.areClose(first, second)).toBe(expected);
            }
        );
    });

    describe('mod.cameraPositionOffset()', () => {
        it('should return a camera position offset mod for the given x,y,z mod', () => {
            expect(
                library.api.mod.cameraPositionOffset({
                    x: 1,
                    y: 2,
                    z: 3,
                })
            ).toEqual({
                cameraPositionOffsetX: 1,
                cameraPositionOffsetY: 2,
                cameraPositionOffsetZ: 3,
            });
        });
        const cases = [
            ['x', { y: 2, z: 3 }, 'cameraPositionOffsetX'] as const,
            ['y', { x: 2, z: 3 }, 'cameraPositionOffsetY'] as const,
            ['z', { x: 2, y: 3 }, 'cameraPositionOffsetZ'] as const,
        ];

        it.each(cases)(
            'should exclude %s if not included in the point',
            (desc, point, tag) => {
                const result = library.api.mod.cameraPositionOffset(point);
                expect(tag in result).toBe(false);
            }
        );

        it('should return an empty object if given an empty object', () => {
            expect(library.api.mod.cameraPositionOffset({})).toEqual({});
        });
    });

    describe('mod.cameraRotationOffset()', () => {
        it('should return a camera rotation offset mod for the given x,y,z mod', () => {
            expect(
                library.api.mod.cameraRotationOffset({
                    x: 1,
                    y: 2,
                    z: 3,
                })
            ).toEqual({
                cameraRotationOffsetX: 1,
                cameraRotationOffsetY: 2,
                cameraRotationOffsetZ: 3,
            });
        });

        const cases = [
            ['x', { y: 2, z: 3 }, 'cameraRotationOffsetX'] as const,
            ['y', { x: 2, z: 3 }, 'cameraRotationOffsetY'] as const,
            ['z', { x: 2, y: 3 }, 'cameraRotationOffsetZ'] as const,
        ];

        it.each(cases)(
            'should exclude %s if not included in the point',
            (desc, point, tag) => {
                const result = library.api.mod.cameraRotationOffset(point);
                expect(tag in result).toBe(false);
            }
        );

        it('should return an empty object if given an empty object', () => {
            expect(library.api.mod.cameraRotationOffset({})).toEqual({});
        });
    });

    describe('crypto.sha256()', () => {
        const cases = [
            [
                ['hello'],
                '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
            ] as const,
            [
                ['🙂'],
                'd06f1525f791397809f9bc98682b5c13318eca4c3123433467fd4dffda44fd14',
            ] as const,
            [
                ['abc', 'def'],
                'bef57ec7f53a6d40beb640a780a639c83bc29ac8a9816f1fc6c5c6dcd93c4721',
            ] as const,
            [
                [67],
                '49d180ecf56132819571bf39d9b7b342522a2ac6d23c1418d3338251bfe469c8',
            ] as const,
            [
                [true],
                'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
            ] as const,
            [
                [false],
                'fcbcf165908dd18a9e49f7ff27810176db8e9f63b4352213741664245224f8aa',
            ] as const,
            [
                [Number.POSITIVE_INFINITY],
                'd0067cad9a63e0813759a2bb841051ca73570c0da2e08e840a8eb45db6a7a010',
            ] as const,
            [
                [Number.NEGATIVE_INFINITY],
                'c64ddf11bcd45660f0cf66dd0c22d2b4570ef3d3fc6527a9a6f6c722aefa3c39',
            ] as const,
            [
                [Number.NaN],
                'd5b592c05dc25b5032553f1b27f4139be95e881f73db33b02b05ab20c3f9981e',
            ] as const,
            [
                [{ abc: 'def' }],
                '2c3fbda5f48b04e39d3a87f89e5bd00b48b6e5e3c4a093de65de0a87b8cc8b3b',
            ] as const,
            [
                [{ zyx: '123', abc: 'def' }],
                'c7e4f397690dce3230846bd71f7d28b6d0fbd14763e58d41fb2713fc74015718',
            ] as const,
            [
                [{ zyx: '123', abc: 'def' }],
                'c7e4f397690dce3230846bd71f7d28b6d0fbd14763e58d41fb2713fc74015718',
            ] as const,
            [
                [null as any],
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            ] as const,
            [
                [undefined as any],
                'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            ] as const,
        ];

        it.each(cases)('should hash %s', (given, expected) => {
            expect(library.api.crypto.sha256(...given)).toBe(expected);
        });

        const objectCases = [
            [
                { zyx: '123', abc: 'def' },
                'c7e4f397690dce3230846bd71f7d28b6d0fbd14763e58d41fb2713fc74015718',
            ] as const,
            [
                { abc: 'def', zyx: '123' },
                'c7e4f397690dce3230846bd71f7d28b6d0fbd14763e58d41fb2713fc74015718',
            ] as const,
            [
                { '123': 'hello', '456': 'world' },
                '0540a6ab3ec4db750b5092cb479c4dd10c1a7ccfe9731cff1927df0e125648a5',
            ] as const,
            [
                { '456': 'world', '123': 'hello' },
                '0540a6ab3ec4db750b5092cb479c4dd10c1a7ccfe9731cff1927df0e125648a5',
            ] as const,
            [
                { '🙂': 'hello', '✌': 'world' },
                '83b4bdacd5dacdc99ede50fcf65f06989aaede20b002de17c9805a2d019054d5',
            ] as const,
            [
                { '✌': 'world', '🙂': 'hello' },
                '83b4bdacd5dacdc99ede50fcf65f06989aaede20b002de17c9805a2d019054d5',
            ] as const,
            [
                ['world', 'hello'],
                'be3181b8eb39bf890c9d366a0fd33daea5ab5486d537c44c52d9e85af8da96c2',
            ] as const,
            [
                ['hello', 'world'],
                '94bedb26fb1cb9547b5b77902e89522f313c7f7fe2e9f0175cfb0a244878ee07',
            ] as const,
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
            ] as const,
            [
                ['🙂'],
                '5bed63c241f2830e8eb29ac8d9fea5e9441e8bb9104768c593dd46f6c97f947a160def7ce58dcba5e9d33a88e2b75fc62802d67ab30460442d23f66403b415f4',
            ] as const,
            [
                ['abc', 'def'],
                'e32ef19623e8ed9d267f657a81944b3d07adbb768518068e88435745564e8d4150a0a703be2a7d88b61e3d390c2bb97e2d4c311fdc69d6b1267f05f59aa920e7',
            ] as const,
            [
                [67],
                'ce4dd661e4d69073c7999282048ea9ee91932db0d699f8b13b2db70fe532d987ac4a0aef309b82e1ad2aa6c2f2f60473093cd1e399a737cff3f9e70585d36be7',
            ] as const,
            [
                [true],
                '9120cd5faef07a08e971ff024a3fcbea1e3a6b44142a6d82ca28c6c42e4f852595bcf53d81d776f10541045abdb7c37950629415d0dc66c8d86c64a5606d32de',
            ] as const,
            [
                [false],
                '719fa67eef49c4b2a2b83f0c62bddd88c106aaadb7e21ae057c8802b700e36f81fe3f144812d8b05d66dc663d908b25645e153262cf6d457aa34e684af9e328d',
            ] as const,
            [
                [Number.POSITIVE_INFINITY],
                '7de872ed1c41ce3901bb7f12f20b0c0106331fe5b5ecc5fbbcf3ce6c79df4da595ebb7e221ab8b7fc5d918583eac6890ade1c26436335d3835828011204b7679',
            ] as const,
            [
                [Number.NEGATIVE_INFINITY],
                '280bcf3496f0fbe479df09e4e6e87f48179e6364a0065ae14d9eab5902f98a74e8e8919cf35b9d881a06562e8c3b11a04d073c03ddf393791e7619d8dc215d61',
            ] as const,
            [
                [Number.NaN],
                '441dfabd0126a33e4677d76d73e4e340c5805efdf58fe84bf4a1f7815e676f0e159be74b2de6bed17d1ff766ff1d4915ca04cb781c0c5d045e1d14886eb1f31c',
            ] as const,
            [
                [{ abc: 'def' }],
                '3f51fd341818ef13b5943ceb3fd0972a6a2be1c3453554261b9f2a7012f3d351b5e4a8a34fce35310bcd80f85afed4b9c4e615622ca52a3fa5ea586774ada743',
            ] as const,
            [
                [{ zyx: '123', abc: 'def' }],
                '8f2534f5d8f10fe6f78abf70de8f2c70b2286aa19ef02df494ef8e0992cb29a1e5614cdf216719b1d33d2e266a1e873c04eb08ce421bee91c52b26a702a979fc',
            ] as const,
            [
                [null as any],
                'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
            ] as const,
            [
                [undefined as any],
                'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
            ] as const,
        ];

        it.each(cases)('should hash %s', (given, expected) => {
            expect(library.api.crypto.sha512(...given)).toBe(expected);
        });

        const objectCases = [
            [
                { zyx: '123', abc: 'def' },
                '8f2534f5d8f10fe6f78abf70de8f2c70b2286aa19ef02df494ef8e0992cb29a1e5614cdf216719b1d33d2e266a1e873c04eb08ce421bee91c52b26a702a979fc',
            ] as const,
            [
                { abc: 'def', zyx: '123' },
                '8f2534f5d8f10fe6f78abf70de8f2c70b2286aa19ef02df494ef8e0992cb29a1e5614cdf216719b1d33d2e266a1e873c04eb08ce421bee91c52b26a702a979fc',
            ] as const,
            [
                { '123': 'hello', '456': 'world' },
                '82a6687d1edca06e611f569200cdac8e15451d8537066582aca318c6236beb602f0c1cffbc8da338ffe32f80c324badc3ba3e69f03d20ecee993910d60b9702f',
            ] as const,
            [
                { '456': 'world', '123': 'hello' },
                '82a6687d1edca06e611f569200cdac8e15451d8537066582aca318c6236beb602f0c1cffbc8da338ffe32f80c324badc3ba3e69f03d20ecee993910d60b9702f',
            ] as const,
            [
                { '🙂': 'hello', '✌': 'world' },
                'ef52465917f42013430afe76278a58657cf8de3c3f84b1709d0aacae3a88bee5e61a31e0f9f265b58672f6630bb8d5ea2384317c1b97e30fce3eaa4a646ff6c1',
            ] as const,
            [
                { '✌': 'world', '🙂': 'hello' },
                'ef52465917f42013430afe76278a58657cf8de3c3f84b1709d0aacae3a88bee5e61a31e0f9f265b58672f6630bb8d5ea2384317c1b97e30fce3eaa4a646ff6c1',
            ] as const,
            [
                ['world', 'hello'],
                'be00d2974eb4998e3e629e559067f04766bf91913f9f5ce10befd6e6c048d63603178f6cf7b4d353db15e032831c63f9647204812db09212d29df1114142b754',
            ] as const,
            [
                ['hello', 'world'],
                'f3ea9708eb605ce26918a18a24e3ca6a5f00f0455966b6fb8c65d5fe637a19a60a47b12913d5493a72acda9789bccb725feaca3a8d66a5cf94d2963fbc0cf4e6',
            ] as const,
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
            ] as const,
            [
                ['🙂'],
                'key',
                '79ec106e8106784f99972a5259331c1325d63514e3eec745ea9d44dbd884c29a',
            ] as const,
            [
                ['abc', 'def'],
                'key',
                '4c5277d3e85316d1762c7e219862a9440546171f5ae5f1b29499ff9fbdd4c56a',
            ] as const,
            [
                [67],
                'key',
                'ecc541509c57f9b9d47ed5354d112bb55b6a65f75365cf07833676f64461c8a8',
            ] as const,
            [
                [true],
                'key',
                '205c94f3b0222e3b464c33da902a1ae1b3a04a4494dcf7145e4228ad23333258',
            ] as const,
            [
                [false],
                'key',
                '2efa4359b49cb498c7ffdd1b1ad6920b9d52764bfee7a7a2ee64117237fdf23c',
            ] as const,
            [
                [Number.POSITIVE_INFINITY],
                'key',
                '38c0a7feea67ce43c10292ff37a136743b962313f1b77486e68780ded5810402',
            ] as const,
            [
                [Number.NEGATIVE_INFINITY],
                'key',
                '4e36d71a0d8a7bf596975426c22ed528d7ab2d41b58e6dc8ff3cf073c8746035',
            ] as const,
            [
                [Number.NaN],
                'key',
                '7f5ef14748c13f8a903dcea8a0d22a25334be45d07371fc59cafaf0b776473ee',
            ] as const,
            [
                [{ abc: 'def' }],
                'key',
                '12bb607ecb4f82ecda3cc248821267a24e253f02c90d39264f5125a504055d54',
            ] as const,
            [
                [{ zyx: '123', abc: 'def' }],
                'key',
                '179c61a016c55c4e92525f84ff987a32e3fbd158555186b7386558931bca66cd',
            ] as const,
            [
                [null as any],
                'key',
                '5d5d139563c95b5967b9bd9a8c9b233a9dedb45072794cd232dc1b74832607d0',
            ] as const,
            [
                [undefined as any],
                'key',
                '5d5d139563c95b5967b9bd9a8c9b233a9dedb45072794cd232dc1b74832607d0',
            ] as const,
        ];

        it.each(cases)('should hash %s', (given, key, expected) => {
            expect(library.api.crypto.hmacSha256(key, ...given)).toBe(expected);
        });

        const objectCases = [
            [
                { zyx: '123', abc: 'def' },
                'key',
                '179c61a016c55c4e92525f84ff987a32e3fbd158555186b7386558931bca66cd',
            ] as const,
            [
                { abc: 'def', zyx: '123' },
                'key',
                '179c61a016c55c4e92525f84ff987a32e3fbd158555186b7386558931bca66cd',
            ] as const,
            [
                { '123': 'hello', '456': 'world' },
                'key',
                'd22a7cc6eaaa04f29e382a829ae5404e623971036f0d8d1448d1c82564ed71ca',
            ] as const,
            [
                { '456': 'world', '123': 'hello' },
                'key',
                'd22a7cc6eaaa04f29e382a829ae5404e623971036f0d8d1448d1c82564ed71ca',
            ] as const,
            [
                { '🙂': 'hello', '✌': 'world' },
                'key',
                '2bffd8725c1d6583e2264fffebf5617d0eea6f71f258df9041ed5107379e8698',
            ] as const,
            [
                { '✌': 'world', '🙂': 'hello' },
                'key',
                '2bffd8725c1d6583e2264fffebf5617d0eea6f71f258df9041ed5107379e8698',
            ] as const,
            [
                ['world', 'hello'],
                'key',
                '153fc5c11827588a37808916ef8814d775f6e3a72f884530544860d476d2130a',
            ] as const,
            [
                ['hello', 'world'],
                'key',
                '66fddc9dc92816d844d6c1fa2e6f123df58c3d5afb9387a34488a6828a60baef',
            ] as const,
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
            ] as const,
            [
                ['🙂'],
                'key',
                'bdc92de9e2218fdd4d55de8d98f624219479cad87c6a7b4d814f559c4bc2e175b1dc283668cab48edfc420cafbff1afdca5842857bf348e9f0b0e8ada532d648',
            ] as const,
            [
                ['abc', 'def'],
                'key',
                'e97348dbd79dff60a3c8e89f4e248b230d8c89c6021615f492510270dd82cf8154b28461fb625ff5554649225a0c3709e42f7f5d405a6f5fbaa1184e59976826',
            ] as const,
            [
                [67],
                'key',
                'd7fb21b12a486cfca737b567354334a8e97e0bac1e55bc0a6c647e2b5a3013f532069fc0a07f24892d525976a2ea0824953ca56608500556bfd28d9829299824',
            ] as const,
            [
                [true],
                'key',
                '92a84cd18c579c1fa626fab2b0facdb960b727e3cac7f8f21cea543382fedd18d99a1948a771ba540e5a285529c18a15bf6c275131e11f5ba13065a92327ed03',
            ] as const,
            [
                [false],
                'key',
                '9000cf009e127f9e69a2fb3c1c5f13db96a253b9e60c477ea2ae745d845226e56112e9d0dd569c9a0f1840122bd806dae21ff53c98c94b12f607c80275cd7ef2',
            ] as const,
            [
                [Number.POSITIVE_INFINITY],
                'key',
                'ad03855ee09aa097fab9d33768ed5e420d2965c43810640f36b56bbd6815a971df96a3af535672f90458283be5ce6cd3fa230d261a69add1484f30d0138f00e9',
            ] as const,
            [
                [Number.NEGATIVE_INFINITY],
                'key',
                'eab4848252a948f1e0ae4af937c1b00820ee5580512a05965c29013d523a3055353834bfa87f9d2e89fec95f361682970b611839b790313053b675b6a01c2335',
            ] as const,
            [
                [Number.NaN],
                'key',
                '7c8698212d4dd6dc82443c02a202c737bc10db008f45d2c76e39d0a237c0355360b88aa580bfd85790c7f4b566f6adb87ba706c58935747b95056b87ca33087d',
            ] as const,
            [
                [{ abc: 'def' }],
                'key',
                'bf358fbab3ee5dcb98521e68a8e2dd4c14fa907d3d524b34958a8ac00f87be421a9ea59a17ea77889ec510800ea18b341598cbb75397d8e74313ef6245122f9b',
            ] as const,
            [
                [{ zyx: '123', abc: 'def' }],
                'key',
                '41db5a3c3855fbf4dd4b0b4883323c46bbef513edbb17aa8ea2bc2420c4e12c78e3f3c944dc86ec74e152bd3dfd4f358e704467bef4810d0aac43f5fcbb30ef2',
            ] as const,
            [
                [null as any],
                'key',
                '84fa5aa0279bbc473267d05a53ea03310a987cecc4c1535ff29b6d76b8f1444a728df3aadb89d4a9a6709e1998f373566e8f824a8ca93b1821f0b69bc2a2f65e',
            ] as const,
            [
                [undefined as any],
                'key',
                '84fa5aa0279bbc473267d05a53ea03310a987cecc4c1535ff29b6d76b8f1444a728df3aadb89d4a9a6709e1998f373566e8f824a8ca93b1821f0b69bc2a2f65e',
            ] as const,
        ];

        it.each(cases)('should hash %s', (given, key, expected) => {
            expect(library.api.crypto.hmacSha512(key, ...given)).toBe(expected);
        });

        const objectCases = [
            [
                { zyx: '123', abc: 'def' },
                'key',
                '41db5a3c3855fbf4dd4b0b4883323c46bbef513edbb17aa8ea2bc2420c4e12c78e3f3c944dc86ec74e152bd3dfd4f358e704467bef4810d0aac43f5fcbb30ef2',
            ] as const,
            [
                { abc: 'def', zyx: '123' },
                'key',
                '41db5a3c3855fbf4dd4b0b4883323c46bbef513edbb17aa8ea2bc2420c4e12c78e3f3c944dc86ec74e152bd3dfd4f358e704467bef4810d0aac43f5fcbb30ef2',
            ] as const,
            [
                { '123': 'hello', '456': 'world' },
                'key',
                '3305ed6725612d54962de298fbdc7d60caa1c1638e424a147062ea42fa35ce19fc2dcfd5eecb16787068c0b05edec6847b3953161d2f8464803ba5fe13a94ad6',
            ] as const,
            [
                { '456': 'world', '123': 'hello' },
                'key',
                '3305ed6725612d54962de298fbdc7d60caa1c1638e424a147062ea42fa35ce19fc2dcfd5eecb16787068c0b05edec6847b3953161d2f8464803ba5fe13a94ad6',
            ] as const,
            [
                { '🙂': 'hello', '✌': 'world' },
                'key',
                '319ce31fa5ac3573c8dfc8423b5eb6af0b8ead7d10a571139c61d079c2f60cbe0120471aaf44279c20849b54add37d768b768c320d22cbfae559ed351ff77162',
            ] as const,
            [
                { '✌': 'world', '🙂': 'hello' },
                'key',
                '319ce31fa5ac3573c8dfc8423b5eb6af0b8ead7d10a571139c61d079c2f60cbe0120471aaf44279c20849b54add37d768b768c320d22cbfae559ed351ff77162',
            ] as const,
            [
                ['world', 'hello'],
                'key',
                'd988342d1941c41b2f599dddb1402870379e9bfe11dd32aca6a22f4c5ed1b7b0655f84e81d0d8b37fb3be15705fce0842ba92ddf6bc0f55b81d2693c1f7be024',
            ] as const,
            [
                ['hello', 'world'],
                'key',
                'dd68ae93fad71176f9be8f97c2c6bddbadb6a021ffced6c37efa78628d6f7273afa72f431e1f4e4c20c79cfb6f056bb7672fd359fb355be4cdf9e08b8349b533',
            ] as const,
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

    describe('crypto.isEncrypted()', () => {
        it('should return true if given some encrypted data', () => {
            const encrypted = library.api.crypto.encrypt('password', 'data');
            const result = library.api.crypto.isEncrypted(encrypted);
            expect(result).toBe(true);
        });

        it('should return false if not given encrypted data', () => {
            const result = library.api.crypto.isEncrypted('vA1.abc.def');
            expect(result).toBe(false);
        });
    });

    describe('crypto.asymmetric.keypair()', () => {
        it('should create and return a keypair', () => {
            const result = library.api.crypto.asymmetric.keypair('password');
            expect(typeof result).toEqual('string');
        });
    });

    describe('crypto.asymmetric.isKeypair()', () => {
        it('should return true if given a keypair', () => {
            const keypair = library.api.crypto.asymmetric.keypair('password');
            const result = library.api.crypto.asymmetric.isKeypair(keypair);
            expect(result).toBe(true);
        });

        it('should return false if not given a keypair', () => {
            const result =
                library.api.crypto.asymmetric.isKeypair('v1.abc.def');
            expect(result).toBe(false);
        });
    });

    describe('crypto.asymmetric.encrypt()', () => {
        it('should encrypt the given string with the given password', () => {
            const keypair = asymmetricKeypairV1('password');
            const result = library.api.crypto.asymmetric.encrypt(
                keypair,
                'data'
            );
            const decrypted = asymmetricDecryptV1(keypair, 'password', result);

            const decoder = new TextDecoder();
            const final = decoder.decode(decrypted);
            expect(final).toEqual('data');
        });
    });

    describe('crypto.asymmetric.decrypt()', () => {
        it('should be able to decrypt the given encrypted data', () => {
            const keypair = asymmetricKeypairV1('password');
            const encrypted = library.api.crypto.asymmetric.encrypt(
                keypair,
                'data'
            );
            const result = library.api.crypto.asymmetric.decrypt(
                keypair,
                'password',
                encrypted
            );
            expect(result).toEqual('data');
        });

        it('should return null if the data was not able to be decrypted', () => {
            const keypair = asymmetricKeypairV1('password');
            const result = library.api.crypto.asymmetric.decrypt(
                keypair,
                'password',
                'wrong'
            );
            expect(result).toBe(null);
        });
    });

    describe('crypto.asymmetric.isEncrypted()', () => {
        it('should return true if given some encrypted data', () => {
            const keypair = asymmetricKeypairV1('password');
            const encrypted = library.api.crypto.asymmetric.encrypt(
                keypair,
                'data'
            );
            const result = library.api.crypto.asymmetric.isEncrypted(encrypted);
            expect(result).toBe(true);
        });

        it('should return false if not given encrypted data', () => {
            const result =
                library.api.crypto.asymmetric.isEncrypted('v1.abc.def');
            expect(result).toBe(false);
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

    describe('perf.getStats()', () => {
        let getShoutTimers: jest.Mock<{}>;

        beforeEach(() => {
            context.getShoutTimers = getShoutTimers = jest.fn();
        });

        it('should return the number of bots in the runtime', () => {
            const bot1 = createDummyRuntimeBot('test1');
            const bot2 = createDummyRuntimeBot('test2');
            const bot3 = createDummyRuntimeBot('test3');
            const bot4 = createDummyRuntimeBot('test4');

            addToContext(context, bot1, bot2, bot3);

            const result = library.api.perf.getStats();

            // only counts the bots in the context
            expect(result.numberOfBots).toEqual(3);
        });

        it('should return an object with timers', () => {
            const bot1 = createDummyRuntimeBot('test1');
            const bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);

            getShoutTimers.mockReturnValueOnce([
                { tag: 'abc', timeMs: 99 },
                { tag: 'def', timeMs: 123 },
                { tag: 'haha', timeMs: 999 },
            ]);

            const result = library.api.perf.getStats();

            // only counts the bots in the context
            expect(result.shoutTimes).toEqual([
                { tag: 'abc', timeMs: 99 },
                { tag: 'def', timeMs: 123 },
                { tag: 'haha', timeMs: 999 },
            ]);
        });

        it('should include the total number of interval and timeout timers', () => {
            const bot1 = createDummyRuntimeBot('test1');
            const bot2 = createDummyRuntimeBot('test2');

            addToContext(context, bot1, bot2);

            context.recordBotTimer(bot1.id, {
                timerId: 1,
                type: 'timeout',
            });

            context.recordBotTimer(bot2.id, {
                timerId: 4,
                type: 'timeout',
            });

            const result = library.api.perf.getStats();

            // only counts the bots in the context
            expect(result.numberOfActiveTimers).toBe(2);
        });
    });

    describe('html', () => {
        let bot1: RuntimeBot;
        beforeEach(() => {
            bot1 = createDummyRuntimeBot('bot1', {
                abc: 'def',
            });
            addToContext(context, bot1);
        });

        it('should return a HTML VDOM element', () => {
            const result = library.api.html`
                <h1>Hello, World!</h1>
            `;

            expect(result).toMatchSnapshot();
        });

        describe('h()', () => {
            it('should return a HTML VDOM element', () => {
                const result = library.api.html.h('h1', null, 'Hello, World!');
                expect(result).toMatchSnapshot();
            });
        });

        describe('f', () => {
            it('should be the Fragment element type', () => {
                expect(library.api.html.f).toBe(Fragment);
            });
        });
    });

    describe('expect()', () => {
        describe('toBe()', () => {
            it('should throw an error if the values are not the same', () => {
                expect(() => {
                    library.api.expect(true).toBe(false);
                }).toThrow();
            });

            it('should throw an error if the bots are not the same', () => {
                const bot1 = createDummyRuntimeBot('test1');
                const alsoBot1 = createDummyRuntimeBot('test1');
                library.api.setTagMask(
                    bot1,
                    'abc',
                    'def',
                    TEMPORARY_BOT_PARTITION_ID
                );
                library.api.setTagMask(
                    alsoBot1,
                    'abc',
                    'def',
                    TEMPORARY_BOT_PARTITION_ID
                );

                // TODO: Make this print a more accurate error message for bots.
                expect(() => {
                    library.api.expect(bot1).toBe(alsoBot1);
                }).toThrowErrorMatchingSnapshot();
            });
        });

        describe('toEqual()', () => {
            let bot1: RuntimeBot;
            let bot2: RuntimeBot;
            let alsoBot1: RuntimeBot;

            beforeEach(() => {
                bot1 = createDummyRuntimeBot('test1');
                bot2 = createDummyRuntimeBot('test2');
                alsoBot1 = createDummyRuntimeBot('test1');

                addToContext(context, bot1, bot2);
            });

            it('should throw when bots have different tags', () => {
                bot1.tags.abc = 'def';
                expect(() => {
                    library.api.expect(bot1).toEqual(alsoBot1);
                }).toThrowErrorMatchingSnapshot();
            });

            it('should throw when bots have different IDs', () => {
                expect(() => {
                    library.api.expect(bot1).toEqual(bot2);
                }).toThrowErrorMatchingSnapshot();
            });

            it('should not throw when the bots are the same', () => {
                bot1.tags.abc = 'def';
                alsoBot1.tags.abc = 'def';
                expect(() => {
                    library.api.expect(bot1).toEqual(alsoBot1);
                }).not.toThrow();
            });

            it('should not throw when bots are in an equal object', () => {
                bot1.tags.abc = 'def';
                alsoBot1.tags.abc = 'def';
                expect(() => {
                    library.api
                        .expect({
                            bot: bot1,
                        })
                        .toEqual({
                            bot: alsoBot1,
                        });
                }).not.toThrow();
            });

            it('should throw when bots have the same tag mask but in a different space', () => {
                library.api.setTagMask(
                    bot1,
                    'abc',
                    'def',
                    TEMPORARY_BOT_PARTITION_ID
                );
                library.api.setTagMask(
                    alsoBot1,
                    'abc',
                    'def',
                    COOKIE_BOT_PARTITION_ID
                );
                expect(() => {
                    library.api
                        .expect({
                            bot: bot1,
                        })
                        .toEqual({
                            bot: alsoBot1,
                        });
                }).toThrowErrorMatchingSnapshot();
            });

            it('should not throw when bots have the same tag masks but one has changes and the other does not', () => {
                library.api.setTagMask(
                    bot1,
                    'abc',
                    'def',
                    TEMPORARY_BOT_PARTITION_ID
                );
                library.api.setTagMask(
                    alsoBot1,
                    'abc',
                    'def',
                    TEMPORARY_BOT_PARTITION_ID
                );
                bot1[CLEAR_CHANGES_SYMBOL]();
                expect(() => {
                    library.api
                        .expect({
                            bot: bot1,
                        })
                        .toEqual({
                            bot: alsoBot1,
                        });
                }).not.toThrow();
            });
        });
    });
});
