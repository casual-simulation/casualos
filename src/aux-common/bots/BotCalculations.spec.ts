import {
    isFormula,
    isNumber,
    isTaggedString,
    createBot,
    calculateBotValue,
    validateTag,
    botTags,
    isHiddenTag,
    getActiveObjects,
    doBotsAppearEqual,
    isTagWellKnown,
    calculateStateDiff,
    tagsOnBot,
    isBot,
    createDimensionId,
    formatValue,
    parseSimulationId,
    SimulationIdParseSuccess,
    simulationIdToString,
    normalizeAUXBotURL,
    cleanBot,
    isScript,
    parseScript,
    getBotTag,
    getPortalTag,
    getUploadState,
    botHasLOD,
    calculateBotLOD,
    getTagMaskSpaces,
    getTagMask,
    tagMasksOnBot,
    getTagValueForSpace,
    getSpaceForTag,
    getUpdateForTagAndSpace,
    hasMaskForTag,
    parseNewTag,
    convertToString,
    getShortId,
    hasValue,
    isBotLink,
    parseBotLink,
    createBotLink,
    calculateBotIds,
    createPrecalculatedBot,
    getBotTransformer,
    isBotDate,
    parseBotDate,
    formatBotDate,
    parseTaggedString,
    parseNumber,
    parseTaggedNumber,
} from './BotCalculations';
import { Bot, BotsState, DNA_TAG_PREFIX } from './Bot';
import { v4 as uuid } from 'uuid';
import { botCalculationContextTests } from './test/BotCalculationContextTests';
import { BotLookupTableHelper } from './BotLookupTableHelper';
import { BotCalculationContext } from './BotCalculationContext';
import { createPrecalculatedContext } from './BotCalculationContextFactory';
import { DateTime, FixedOffsetZone, Zone } from 'luxon';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

const originalDateNow = Date.now;
const dateNowMock = (Date.now = jest.fn());

describe('BotCalculations', () => {
    describe('isFormula()', () => {
        it('should be true when value starts with a "🧬" sign', () => {
            expect(isFormula(DNA_TAG_PREFIX)).toBeTruthy();
            expect(isFormula(`a${DNA_TAG_PREFIX}`)).toBeFalsy();
        });

        it('should be false when value does not start with a "🧬" sign', () => {
            expect(isFormula('abc')).toBeFalsy();
        });
    });

    describe('isScript()', () => {
        it('should be true when value starts with a "@" sign', () => {
            expect(isScript('@')).toBeTruthy();
            expect(isScript('a@')).toBeFalsy();
        });

        it('should be false when value does not start with a "@" sign', () => {
            expect(isScript('abc')).toBeFalsy();
        });
    });

    describe('parseScript()', () => {
        it('should return the script when value starts with a "@" sign', () => {
            expect(parseScript('@')).toBe('');
            expect(parseScript('@abc')).toBe('abc');
        });

        it('should return null when the value does not start with an "@" sign', () => {
            expect(parseScript('abc')).toBe(null);
        });
    });

    describe('isBotLink()', () => {
        it('should be true when value starts with a "🔗" sign', () => {
            expect(isBotLink('🔗')).toBeTruthy();
            expect(isBotLink('a🔗')).toBeFalsy();
        });

        it('should be false when value does not start with a "🔗" sign', () => {
            expect(isBotLink('abc')).toBeFalsy();
        });
    });

    describe('parseBotLink()', () => {
        it('should return a list of bot IDs if the value is a link', () => {
            expect(parseBotLink('🔗')).toEqual([]);
            expect(parseBotLink('🔗abc')).toEqual(['abc']);
            expect(parseBotLink('🔗abc,def,ghi-432')).toEqual([
                'abc',
                'def',
                'ghi-432',
            ]);
            expect(parseBotLink('🔗,,newId')).toEqual(['newId']);
        });

        it('should return null if the value is not a link', () => {
            expect(parseBotLink('abc')).toBe(null);
        });
    });

    describe('createBotLink()', () => {
        it('should return a bot link for the given IDs', () => {
            expect(parseBotLink(createBotLink(['abc', 'def']))).toEqual([
                'abc',
                'def',
            ]);
            expect(parseBotLink(createBotLink(['abc']))).toEqual(['abc']);
            expect(parseBotLink(createBotLink([]))).toEqual([]);
        });
    });

    describe('isBotDate()', () => {
        it('should be true when the value starts with a 📅 symbol', () => {
            expect(isBotDate('📅')).toBeTruthy();
            expect(isBotDate('a📅')).toBeFalsy();
        });
    });

    describe('parseBotDate()', () => {
        beforeEach(() => {
            Date.now = originalDateNow;
        });

        afterEach(() => {
            Date.now = dateNowMock;
        });

        it('should parse the given date into a DateTime value', () => {
            // Parse as UTC if not specified
            expect(parseBotDate('📅2022')).toEqual(DateTime.utc(2022, 1, 1));
            expect(parseBotDate('📅2022-02')).toEqual(DateTime.utc(2022, 2, 1));
            expect(parseBotDate('📅2022-02-03')).toEqual(
                DateTime.utc(2022, 2, 3)
            );
            expect(parseBotDate('📅2022-02-03T04')).toEqual(
                DateTime.utc(2022, 2, 3, 4)
            );
            expect(parseBotDate('📅2022-02-03T04:05')).toEqual(
                DateTime.utc(2022, 2, 3, 4, 5)
            );
            expect(parseBotDate('📅2022-02-03T04:05:06')).toEqual(
                DateTime.utc(2022, 2, 3, 4, 5, 6)
            );
            expect(parseBotDate('📅2022-02-03T04:05:06.007')).toEqual(
                DateTime.utc(2022, 2, 3, 4, 5, 6, 7)
            );
            expect(parseBotDate('📅2022-01-01T00:00:00Z')).toEqual(
                DateTime.utc(2022, 1, 1)
            );
            expect(parseBotDate('📅2022-01-01T14:32:12Z')).toEqual(
                DateTime.utc(2022, 1, 1, 14, 32, 12)
            );
            expect(parseBotDate('📅2022-01-01T14:32:12.234Z')).toEqual(
                DateTime.utc(2022, 1, 1, 14, 32, 12, 234)
            );

            // Parse with Time Zone
            expect(parseBotDate('📅2022 America/New_York')).toEqual(
                DateTime.fromObject(
                    { year: 2022, month: 1, day: 1 },
                    { zone: 'America/New_York' }
                )
            );
            expect(parseBotDate('📅2022-02 America/New_York')).toEqual(
                DateTime.fromObject(
                    { year: 2022, month: 2, day: 1 },
                    { zone: 'America/New_York' }
                )
            );
            expect(parseBotDate('📅2022-02-03 America/New_York')).toEqual(
                DateTime.fromObject(
                    { year: 2022, month: 2, day: 3 },
                    { zone: 'America/New_York' }
                )
            );
            expect(parseBotDate('📅2022-02-03T04 America/New_York')).toEqual(
                DateTime.fromObject(
                    { year: 2022, month: 2, day: 3, hour: 4 },
                    { zone: 'America/New_York' }
                )
            );
            expect(parseBotDate('📅2022-02-03T04:05 America/New_York')).toEqual(
                DateTime.fromObject(
                    { year: 2022, month: 2, day: 3, hour: 4, minute: 5 },
                    { zone: 'America/New_York' }
                )
            );
            expect(
                parseBotDate('📅2022-02-03T04:05:06 America/New_York')
            ).toEqual(
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 2,
                        day: 3,
                        hour: 4,
                        minute: 5,
                        second: 6,
                    },
                    { zone: 'America/New_York' }
                )
            );
            expect(
                parseBotDate('📅2022-02-03T04:05:06.007 America/New_York')
            ).toEqual(
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 2,
                        day: 3,
                        hour: 4,
                        minute: 5,
                        second: 6,
                        millisecond: 7,
                    },
                    { zone: 'America/New_York' }
                )
            );

            // Parse as local
            expect(parseBotDate('📅2022 local')).toEqual(
                DateTime.fromObject(
                    { year: 2022, month: 1, day: 1 },
                    { zone: 'local' }
                )
            );
            expect(parseBotDate('📅2022-02 local')).toEqual(
                DateTime.fromObject(
                    { year: 2022, month: 2, day: 1 },
                    { zone: 'local' }
                )
            );
            expect(parseBotDate('📅2022-02-03 local')).toEqual(
                DateTime.fromObject(
                    { year: 2022, month: 2, day: 3 },
                    { zone: 'local' }
                )
            );
            expect(parseBotDate('📅2022-02-03T04 local')).toEqual(
                DateTime.fromObject(
                    { year: 2022, month: 2, day: 3, hour: 4 },
                    { zone: 'local' }
                )
            );
            expect(parseBotDate('📅2022-02-03T04:05 local')).toEqual(
                DateTime.fromObject(
                    { year: 2022, month: 2, day: 3, hour: 4, minute: 5 },
                    { zone: 'local' }
                )
            );
            expect(parseBotDate('📅2022-02-03T04:05:06 local')).toEqual(
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 2,
                        day: 3,
                        hour: 4,
                        minute: 5,
                        second: 6,
                    },
                    { zone: 'local' }
                )
            );
            expect(parseBotDate('📅2022-02-03T04:05:06.007 local')).toEqual(
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 2,
                        day: 3,
                        hour: 4,
                        minute: 5,
                        second: 6,
                        millisecond: 7,
                    },
                    { zone: 'local' }
                )
            );

            // Time offset
            expect(parseBotDate('📅2022-01-01T14:32:12-05:00')).toEqual(
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 1,
                        day: 1,
                        hour: 14,
                        minute: 32,
                        second: 12,
                    },
                    { zone: FixedOffsetZone.parseSpecifier('UTC-05:00') }
                )
            );
            expect(parseBotDate('📅2022-01-01T14:32:12.234-05:00')).toEqual(
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 1,
                        day: 1,
                        hour: 14,
                        minute: 32,
                        second: 12,
                        millisecond: 234,
                    },
                    { zone: FixedOffsetZone.parseSpecifier('UTC-05:00') }
                )
            );

            // With Time Zone
            expect(
                parseBotDate('📅2022-01-01T14:32:12.234 America/New_York')
            ).toEqual(
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 1,
                        day: 1,
                        hour: 14,
                        minute: 32,
                        second: 12,
                        millisecond: 234,
                    },
                    { zone: 'America/New_York' }
                )
            );

            // With offset plus Time zone
            // (i.e. Parse as given offset, convert to time zone)
            expect(
                parseBotDate('📅2022-01-01T14:32:12.234-05:00 America/New_York')
            ).toEqual(
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 1,
                        day: 1,
                        hour: 14,
                        minute: 32,
                        second: 12,
                        millisecond: 234,
                    },
                    { zone: 'America/New_York' }
                )
            );
            expect(
                parseBotDate('📅2022-01-01T14:32:12.234+05:00 America/New_York')
            ).toEqual(
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 1,
                        day: 1,
                        hour: 4,
                        minute: 32,
                        second: 12,
                        millisecond: 234,
                    },
                    { zone: 'America/New_York' }
                )
            );

            // UTC + Time zone
            // (i.e. parse as UTC, convert to time zone)
            expect(
                parseBotDate('📅2022-01-01T14:32:12.234Z America/New_York')
            ).toEqual(
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 1,
                        day: 1,
                        hour: 9,
                        minute: 32,
                        second: 12,
                        millisecond: 234,
                    },
                    { zone: 'America/New_York' }
                )
            );

            // UTC + local time
            // (i.e. parse as UTC, convert to local)
            expect(parseBotDate('📅2022-01-01T14:32:12.234Z local')).toEqual(
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 1,
                        day: 1,
                        hour: 14,
                        minute: 32,
                        second: 12,
                        millisecond: 234,
                    },
                    { zone: 'utc' }
                ).setZone('local')
            );
        });

        it('should return null if given an invalid date', () => {
            expect(parseBotDate('📅2022-02-29')).toBe(null);
            expect(parseBotDate('📅Tuesday 11 Jan 2021')).toBe(null);
        });
    });

    describe('formatBotDate()', () => {
        beforeEach(() => {
            Date.now = originalDateNow;
        });

        afterEach(() => {
            Date.now = dateNowMock;
        });

        Date.now = originalDateNow;

        const cases = [
            // Format as UTC
            [DateTime.utc(2022, 1, 1), '📅2022-01-01T00:00:00Z'] as const,
            [DateTime.utc(2022, 2, 1), '📅2022-02-01T00:00:00Z'] as const,
            [DateTime.utc(2022, 2, 3), '📅2022-02-03T00:00:00Z'] as const,
            [DateTime.utc(2022, 2, 3, 4), '📅2022-02-03T04:00:00Z'] as const,
            [DateTime.utc(2022, 2, 3, 4, 5), '📅2022-02-03T04:05:00Z'] as const,
            [
                DateTime.utc(2022, 2, 3, 4, 5, 6),
                '📅2022-02-03T04:05:06Z',
            ] as const,
            [
                DateTime.utc(2022, 2, 3, 4, 5, 6, 7),
                '📅2022-02-03T04:05:06.007Z',
            ] as const,
            [
                DateTime.utc(2022, 1, 1, 14, 32, 12),
                '📅2022-01-01T14:32:12Z',
            ] as const,
            [
                DateTime.utc(2022, 1, 1, 14, 32, 12, 234),
                '📅2022-01-01T14:32:12.234Z',
            ] as const,

            // // Format with Time Zone
            [
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 1,
                        day: 1,
                        hour: 14,
                        minute: 32,
                        second: 12,
                        millisecond: 234,
                    },
                    { zone: 'America/New_York' }
                ),
                '📅2022-01-01T14:32:12.234-05:00 America/New_York',
            ] as const,
            [
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 1,
                        day: 1,
                        hour: 14,
                        minute: 32,
                        second: 12,
                        millisecond: 234,
                    },
                    { zone: 'utc' }
                ),
                '📅2022-01-01T14:32:12.234Z',
            ] as const,

            // Format with local time
            [
                DateTime.fromObject(
                    {
                        year: 2022,
                        month: 1,
                        day: 1,
                        hour: 14,
                        minute: 32,
                        second: 12,
                        millisecond: 234,
                    },
                    { zone: 'local' }
                ),
                `📅${DateTime.fromObject(
                    {
                        year: 2022,
                        month: 1,
                        day: 1,
                        hour: 14,
                        minute: 32,
                        second: 12,
                        millisecond: 234,
                    },
                    { zone: 'local' }
                ).toISO()} local`,
            ] as const,
            [
                DateTime.fromObject({
                    year: 2022,
                    month: 1,
                    day: 1,
                    hour: 14,
                    minute: 32,
                    second: 12,
                    millisecond: 234,
                }),
                `📅${DateTime.fromObject({
                    year: 2022,
                    month: 1,
                    day: 1,
                    hour: 14,
                    minute: 32,
                    second: 12,
                    millisecond: 234,
                })} local`,
            ] as const,
        ];

        Date.now = dateNowMock;

        describe.each(cases)('%s - %s', (date, expected) => {
            it('should support formatting', () => {
                const formatted = formatBotDate(date);
                expect(formatted).toEqual(expected);
                expect(parseBotDate(formatted)).toEqual(date);
            });
        });
    });

    describe('isNumber()', () => {
        const cases = [
            [true, '123'] as const,
            [true, '0'] as const,
            [true, '-12'] as const,
            [true, '19.325'] as const,
            [true, '-27.981'] as const,
            [true, '27.0'] as const,
            [true, '2.70E10'] as const,
            [false, '1.'] as const,
            [true, '.01'] as const,
            [true, '.567'] as const,
            [true, 'infinity'] as const,
            [true, 'Infinity'] as const,
            [true, 'InFIniTy'] as const,
            [true, '-InFIniTy'] as const,
            [false, '$123'] as const,
            [false, 'abc'] as const,
            [false, '.'] as const,
            [false, '-'] as const,
        ];

        const prefixCases = [
            [true, '🔢123'] as const,
            [true, '🔢0'] as const,
            [true, '🔢-12'] as const,
            [true, '🔢19.325'] as const,
            [true, '🔢-27.981'] as const,
            [true, '🔢27.0'] as const,
            [false, '🔢1.'] as const,
            [true, '🔢.01'] as const,
            [true, '🔢.567'] as const,
            [true, '🔢infinity'] as const,
            [true, '🔢Infinity'] as const,
            [true, '🔢InFIniTy'] as const,
            [true, '🔢-InFIniTy'] as const,
            [false, '🔢$123'] as const,
            [false, '🔢abc'] as const,
            [false, '🔢.'] as const,
            [false, '🔢-'] as const,

            // Scientific notation
            [true, '🔢1.02E10'] as const,
            [true, '🔢1.02e10'] as const,
            [true, '🔢1.02E-10'] as const,
            [true, '🔢1.02e-10'] as const,
            [true, '🔢-1.02E10'] as const,
            [true, '🔢-1.02e10'] as const,
            [true, '🔢-1.02E-10'] as const,
            [true, '🔢-1.02e-10'] as const,
            [false, '🔢-1.02e-10.23'] as const,
            [true, '1.02E10'] as const,
            [true, '1.02e10'] as const,
            [false, '1.02e10.23'] as const,
            [true, '1.02E-10'] as const,
            [true, '1.02e-10'] as const,
            [true, '-1.02E10'] as const,
            [true, '-1.02E-10'] as const,
            [true, '-1.02e10'] as const,
            [true, '-1.02e-10'] as const,
        ];

        it.each(cases)(
            'be %s when given %s',
            (expected: boolean, value: string) => {
                expect(isNumber(value)).toBe(expected);
            }
        );

        it.each(prefixCases)('be %s when given %s', (expected: boolean, value: string) => {
            expect(isNumber(value)).toBe(expected);
        });
    });

    describe('parseNumber()', () => {
        const parseCases = [
            [123, '123'] as const,
            [0, '0'] as const,
            [-12, '-12'] as const,
            [19.325, '19.325'] as const,
            [-27.981, '-27.981'] as const,
            [27, '27.0'] as const,
            [.01, '.01'] as const,
            [.567, '.567'] as const,
            [Infinity, 'infinity'] as const,
            [Infinity, 'Infinity'] as const,
            [Infinity, 'InFIniTy'] as const,
            [-Infinity, '-InFIniTy'] as const,

            [123, '🔢123'] as const,
            [0, '🔢0'] as const,
            [-12, '🔢-12'] as const,
            [19.325, '🔢19.325'] as const,
            [-27.981, '🔢-27.981'] as const,
            [27, '🔢27.0'] as const,
            [.01, '🔢.01'] as const,
            [.567, '🔢.567'] as const,
            [Infinity, '🔢infinity'] as const,
            [Infinity, '🔢Infinity'] as const,
            [Infinity, '🔢InFIniTy'] as const,
            [-Infinity, '🔢-InFIniTy'] as const,

            // Scientific notation
            [1.02E10, '🔢1.02E10'] as const,
            [1.02E10, '🔢1.02e10'] as const,
            [1.02E-10, '🔢1.02E-10'] as const,
            [1.02E-10, '🔢1.02e-10'] as const,
            [-1.02E10, '🔢-1.02E10'] as const,
            [-1.02E10, '🔢-1.02e10'] as const,
            [-1.02E-10, '🔢-1.02E-10'] as const,
            [-1.02E-10, '🔢-1.02e-10'] as const,
            [-123.02E-10, '🔢-123.02e-10'] as const,

            [NaN, 'NaN'] as const,
            [NaN, 'abc'] as const,
            [NaN, '🔢abc'] as const,
            [NaN, '🔢NaN'] as const,
        ];

        it.each(parseCases)('parse %s from %s', (expected: number, given: string) => {
            expect(parseNumber(given)).toBe(expected);
        });
    });

    describe('parseTaggedNumber()', () => {
        const cases = [
            ['🔢123', '123'],
            ['123', '123'],
            ['🔢abc', 'abc'],
        ];

        it.each(cases)('it should map %s to %s', (given, expected) => {
            expect(parseTaggedNumber(given)).toBe(expected);
        });
    });

    describe('isTaggedString()', () => {
        const cases = [
            [true, '📝123'] as const,
            [false, '123'] as const,
        ];

        it.each(cases)(
            'be %s when given %s',
            (expected: boolean, value: string) => {
                expect(isTaggedString(value)).toBe(expected);
            }
        );
    });

    describe('parseTaggedString()', () => {
        const cases = [
            ['📝123', '123'] as const,
            ['123', '123'] as const,
        ];

        it.each(cases)(
            'map %s to %s',
            (value: string, expected: string) => {
                expect(parseTaggedString(value)).toBe(expected);
            }
        );
    });

    describe('isBot()', () => {
        it('should return true if the object has an ID and tags', () => {
            expect(
                isBot({
                    id: 'test',
                    tags: {},
                })
            ).toBe(true);

            expect(
                isBot({
                    id: 'false',
                    tags: {
                        test: 'abc',
                    },
                })
            ).toBe(true);

            expect(
                isBot({
                    id: '',
                    tags: {},
                })
            ).toBe(false);

            expect(isBot(null)).toBe(false);
            expect(isBot({})).toBe(false);
        });
    });

    describe('calculateBotIds()', () => {
        it('should return null if the tag is a number', () => {
            const bot = createPrecalculatedBot('test', {
                tag: 123.145,
            });
            const value = calculateBotIds(bot, 'tag');

            expect(value).toBe(null);
        });

        it('should wrap strings in an array', () => {
            const bot = createPrecalculatedBot('test', {
                tag: 'id',
            });
            const value = calculateBotIds(bot, 'tag');

            expect(value).toEqual(['id']);
        });

        it('should return arrays', () => {
            const bot = createPrecalculatedBot('test', {
                tag: ['id1', 'id2'],
            });
            const value = calculateBotIds(bot, 'tag');

            expect(value).toEqual(['id1', 'id2']);
        });

        it('should return the IDs stored in a bot link', () => {
            const bot = createPrecalculatedBot('test', {
                tag: '🔗id1,id2',
            });
            const value = calculateBotIds(bot, 'tag');

            expect(value).toEqual(['id1', 'id2']);
        });

        it('should return the ID of the bot stored in the tag', () => {
            const other = createPrecalculatedBot('id1');
            const bot = createPrecalculatedBot('test', {
                tag: other,
            });
            const value = calculateBotIds(bot, 'tag');

            expect(value).toEqual(['id1']);
        });

        it('should return the IDs of the bots stored in the tag', () => {
            const other1 = createPrecalculatedBot('id1');
            const other2 = createPrecalculatedBot('id2');
            const bot = createPrecalculatedBot('test', {
                tag: [other1, other2],
            });
            const value = calculateBotIds(bot, 'tag');

            expect(value).toEqual(['id1', 'id2']);
        });
    });

    describe('getBotTag()', () => {
        it('should return the bot ID', () => {
            const bot = createBot('test');

            expect(getBotTag(bot, 'id')).toEqual('test');
        });

        it('should return the bot space', () => {
            const bot = createBot('test', {}, <any>'abc');

            expect(getBotTag(bot, 'space')).toEqual('abc');
        });

        it('should return the given tag', () => {
            const bot = createBot('test', {
                abc: 'def',
            });

            expect(getBotTag(bot, 'abc')).toEqual('def');
        });
    });

    describe('getPortalTag()', () => {
        const cases = [
            ['page', 'pagePortal'],
            ['grid', 'gridPortal'],
            ['inventory', 'inventoryPortal'],
            ['miniGrid', 'miniGridPortal'],
            ['menu', 'menuPortal'],
            ['sheet', 'sheetPortal'],
            ['other', 'otherPortal'],
            ['pagePortal', 'pagePortal'],
            ['gridPortal', 'gridPortal'],
            ['inventoryPortal', 'inventoryPortal'],
            ['miniGridPortal', 'miniGridPortal'],
            ['menuPortal', 'menuPortal'],
            ['sheetPortal', 'sheetPortal'],
            ['auxOtherPortal', 'auxOtherPortal'],
        ];
        it.each(cases)(
            'should return the corresponding tag for the portal type',
            (type, expected) => {
                const tag = getPortalTag(type);
                expect(tag).toBe(expected);
            }
        );
    });

    describe('botHasLOD()', () => {
        const lodListeners = [
            ['onMaxLODEnter'],
            ['onMaxLODExit'],
            ['onMinLODEnter'],
            ['onMinLODExit'],
            ['auxMaxLODThreshold'],
            ['auxMinLODThreshold'],
            ['maxLODThreshold'],
            ['minLODThreshold'],
        ];

        describe.each(lodListeners)('%s', (tag: string) => {
            it('should return true if the bot has a script', () => {
                const bot = createBot('test', {
                    [tag]: '@abc',
                });

                const calc = createPrecalculatedContext([bot]);
                const hasLod = botHasLOD(calc, bot);

                expect(hasLod).toBe(true);
            });

            it('should return false if it does not have a script', () => {
                const bot = createBot('test', {
                    [tag]: 'abc',
                });

                const calc = createPrecalculatedContext([bot]);
                const hasLod = botHasLOD(calc, bot);

                expect(hasLod).toBe(false);
            });
        });
    });

    describe('hasValue()', () => {
        const cases: [any, boolean][] = [
            ['', false],
            [null, false],
            [undefined, false],
            [true, true],
            [false, true],
            [0, true],
            [-0, true],
            [-Infinity, true],
            [Infinity, true],
            [NaN, true],
            ['abc', true],
            [{}, true],
        ];

        it.each(cases)('should map %s to %s', (given, expected) => {
            expect(hasValue(given)).toBe(expected);
        });
    });

    describe('convertToString()', () => {
        const cases: [any, string][] = [
            ['', ''],
            [null, ''],
            [undefined, ''],
            [true, 'true'],
            [false, 'false'],
            [0, '0'],
            [-0, '0'],
            [-Infinity, '-Infinity'],
            [Infinity, 'Infinity'],
            [NaN, 'NaN'],
            ['abc', 'abc'],
            [new Date('16 Nov 2021 14:32:14 GMT'), '2021-11-16T14:32:14.000Z'],
        ];

        it.each(cases)('should map %s to %s', (given, expected) => {
            expect(convertToString(given)).toBe(expected);
        });
    });

    describe('calculateBotLOD()', () => {
        it('should return normal when the virtual distance is between the min and max', () => {
            expect(calculateBotLOD(0.5, 0.1, 0.9)).toBe('normal');
        });

        it('should return max when the virtual distance is above the max', () => {
            expect(calculateBotLOD(1, 0.1, 0.9)).toBe('max');
        });

        it('should return min when the virtual distance is below the min', () => {
            expect(calculateBotLOD(0, 0.1, 0.9)).toBe('min');
        });
    });

    describe('calculateStateDiff()', () => {
        it('should return no changes', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedBots.length).toBe(0);
            expect(result.removedBots.length).toBe(0);
            expect(result.updatedBots.length).toBe(0);
        });

        it('should detect that a bot was added', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
            };
            const currState: BotsState = {
                new: {
                    id: 'new',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
                test: prevState['test'],
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.removedBots.length).toBe(0);
            expect(result.updatedBots.length).toBe(0);
            expect(result.addedBots.length).toBe(1);
            expect(result.addedBots[0]).toBe(currState['new']);
        });

        it('should detect that a bot was removed', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
            };
            const currState: BotsState = {};

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedBots.length).toBe(0);
            expect(result.updatedBots.length).toBe(0);
            expect(result.removedBots.length).toBe(1);
            expect(result.removedBots[0]).toBe('test');
        });

        it('should detect that a bot was updated', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                    },
                },
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedBots.length).toBe(0);
            expect(result.removedBots.length).toBe(0);
            expect(result.updatedBots.length).toBe(1);
            expect(result.updatedBots[0]).toBe(currState['updated']);
        });

        it('should use deep equality for updates', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedBots.length).toBe(0);
            expect(result.removedBots.length).toBe(0);
            expect(result.updatedBots.length).toBe(0);
        });

        it('should handle multiple changes at once', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                removed: {
                    id: 'removed',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 2,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                    },
                },
                new: {
                    id: 'new',
                    tags: {
                        _position: { x: 1, y: 0, z: 3 },
                        _workspace: null,
                    },
                },
                new2: {
                    id: 'new',
                    tags: {
                        _position: { x: 1, y: 15, z: 3 },
                        _workspace: 'test',
                    },
                },
            };

            const result = calculateStateDiff(prevState, currState);

            expect(result.addedBots.length).toBe(2);
            expect(result.addedBots[0]).toBe(currState['new']);
            expect(result.addedBots[1]).toBe(currState['new2']);
            expect(result.removedBots.length).toBe(1);
            expect(result.removedBots[0]).toBe('removed');
            expect(result.updatedBots.length).toBe(1);
            expect(result.updatedBots[0]).toBe(currState['updated']);
        });

        it.skip('should short-circut when a add_bot event is given', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
                new: {
                    id: 'new',
                    tags: {
                        _position: { x: 1, y: 0, z: 3 },
                        _workspace: null,
                    },
                },
            };

            // const result = calculateStateDiff(prevState, currState, {
            //     type: 'add_bot',
            //     creation_time: new Date(),
            //     bot: currState['new'],
            //     id: 'new'
            // });

            // expect(result.removedBots.length).toBe(0);
            // expect(result.updatedBots.length).toBe(0);
            // expect(result.addedBots.length).toBe(1);
            // expect(result.addedBots[0]).toBe(currState['new']);
        });

        it.skip('should short-circut when a remove_bot event is given', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                old: {
                    id: 'old',
                    tags: {
                        _position: { x: 1, y: 0, z: 3 },
                        _workspace: null,
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
            };

            // const result = calculateStateDiff(prevState, currState, {
            //     type: 'remove_bot',
            //     creation_time: new Date(),
            //     id: 'old'
            // });

            // expect(result.addedBots.length).toBe(0);
            // expect(result.updatedBots.length).toBe(0);
            // expect(result.removedBots.length).toBe(1);
            // expect(result.removedBots[0]).toBe(prevState['old']);
        });

        it.skip('should short-circut when a update_bot event is given', () => {
            const prevState: BotsState = {
                updated: {
                    id: 'updated',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
            };
            const currState: BotsState = {
                updated: {
                    id: 'updated',
                    tags: {
                        position: { x: 2, y: 1, z: 3 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
            };

            // const result = calculateStateDiff(prevState, currState, {
            //     type: 'update_bot',
            //     creation_time: new Date(),
            //     id: 'updated',
            //     update: {
            //         position: {x:2, y:1, z:3},
            //     }
            // });

            // expect(result.addedBots.length).toBe(0);
            // expect(result.removedBots.length).toBe(0);
            // expect(result.updatedBots.length).toBe(1);
            // expect(result.updatedBots[0]).toBe(currState['updated']);
        });

        it.skip('should not short-circut when a action event is given', () => {
            const prevState: BotsState = {
                test: {
                    id: 'test',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                removed: {
                    id: 'removed',
                    tags: {
                        position: { x: 0, y: 0, z: 0 },
                        size: 2,
                        grid: {},
                        scale: 0.5,
                        defaultHeight: 0.1,
                        gridScale: 0.2,
                        color: '#999999',
                    },
                },
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
            };
            const currState: BotsState = {
                test: prevState['test'],
                updated: {
                    id: 'updated',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                    },
                },
                new: {
                    id: 'new',
                    tags: {
                        _position: { x: 1, y: 0, z: 3 },
                        _workspace: null,
                    },
                },
                new2: {
                    id: 'new',
                    tags: {
                        _position: { x: 1, y: 15, z: 3 },
                        _workspace: 'test',
                    },
                },
            };

            // const result = calculateStateDiff(prevState, currState, {
            //     type: 'transaction',
            //     creation_time: new Date(),
            //     events: []
            // });

            // expect(result.addedBots.length).toBe(2);
            // expect(result.addedBots[0]).toBe(currState['new']);
            // expect(result.addedBots[1]).toBe(currState['new2']);
            // expect(result.removedBots.length).toBe(1);
            // expect(result.removedBots[0]).toBe(prevState['removed']);
            // expect(result.updatedBots.length).toBe(1);
            // expect(result.updatedBots[0]).toBe(currState['updated']);
        });
    });

    describe('calculateBotValue()', () => {
        it('should return the raw tag when evaluating a formula with a context without a sandbox', () => {
            const bot1 = createBot('test');
            const bot2 = createBot('test2', {
                abc: 'def',
                formula: '="haha"',
            });
            const context: BotCalculationContext = {
                objects: [bot1, bot2],
                cache: new Map(),
                lookup: new BotLookupTableHelper(),
            };

            const result = calculateBotValue(context, bot2, 'formula');

            expect(result).toEqual('="haha"');
        });

        it('should return the raw tag when a formula with a null context', () => {
            const bot1 = createBot('test');
            const bot2 = createBot('test2', {
                abc: 'def',
                formula: '="haha"',
            });

            const result = calculateBotValue(null, bot2, 'formula');

            expect(result).toEqual('="haha"');
        });

        it('should fallback to the prefix-less tag name when getting an AUX tag', () => {
            const bot1 = createBot('test', {
                abc: 'def',
            });
            const bot2 = createBot('test2', {
                auxAbc: '123',
            });

            const result1 = calculateBotValue(null, bot1, 'auxAbc');
            const result2 = calculateBotValue(null, bot2, 'auxAbc');
            expect(result1).toEqual('def');
            expect(result2).toEqual(123);
        });

        it('should handle fallback with characters that are surrogate pairs', () => {
            const bot1 = createBot('test1', {
                '😀': '123',
            });

            const result1 = calculateBotValue(null, bot1, 'aux😀');
            expect(result1).toEqual(123);
        });
    });

    describe('tagsOnBot()', () => {
        it('should return the tag names that are on objects', () => {
            expect(tagsOnBot(createBot('test'))).toEqual([]);

            expect(
                tagsOnBot(
                    createBot('test', {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: null,
                        test: 123,
                        abc: undefined,
                    })
                )
            ).toEqual(['_position', '_workspace', 'test', 'abc']);
        });

        it('should include tag names from tag masks', () => {
            expect(
                tagsOnBot({
                    id: 'test',
                    tags: {
                        abc: 123,
                    },
                    masks: {
                        shared: {
                            abc: 456,
                            fun: 'yes',
                        },
                        other: {
                            def: 'ghi',
                        },
                    },
                })
            ).toEqual(['abc', 'fun', 'def']);
        });
    });

    describe('getActiveObjects()', () => {
        it('should return only objects', () => {
            const state: BotsState = {
                first: {
                    id: 'first',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
                second: {
                    id: 'second',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'test',
                    },
                },
                workspace: {
                    id: 'workspace',
                    tags: {
                        defaultHeight: 1,
                        grid: {},
                        gridScale: 1,
                        position: { x: 0, y: 0, z: 0 },
                        size: 1,
                        scale: 1,
                        color: '#999999',
                    },
                },
            };

            const objects = getActiveObjects(state);

            expect(objects).toEqual([
                state['first'],
                state['second'],
                state['workspace'],
            ]);
        });
    });

    describe('isTagWellKnown()', () => {
        uuidMock.mockReturnValue('test');

        const builtinTagCases = [
            ['abc._index'],
            ['_hidden'],
            ['aux._lastEditedBy'],
            ['abc._lastActiveTime'],
            ['aux._context_test'],
            ['aux._context_ something else'],
            ['aux._context_ 😊😜😢'],
            ['_context_test'],
            ['_context_ something else'],
            ['_context_ 😊😜😢'],
        ];
        it.each(builtinTagCases)(
            'should return true for some hidden tag %s',
            (tag) => {
                expect(isTagWellKnown(tag)).toBe(true);
            }
        );

        const contextCases = [[createDimensionId()]];
        it.each(contextCases)(
            'should return false for autogenerated dimension tag %s',
            (tag) => {
                expect(isTagWellKnown(tag)).toBe(false);
            }
        );

        const selectionCases = [
            ['_auxSelection09a1ee66-bb0f-4f9e-81d2-d8d4da5683b8'],
            ['_auxSelection6a7aa1c5-807c-4390-9982-ff8b2dd5b54e'],
            ['_auxSelection83e80481-13a1-439e-94e6-f3b73942288f'],
        ];
        it.each(selectionCases)(
            'should return true for selection tag %s',
            (tag) => {
                expect(isTagWellKnown(tag)).toBe(true);
            }
        );

        const normalCases = [
            [false, 'auxDraggable'] as const,
            [false, 'auxStackable'] as const,
            [false, 'auxColor'] as const,
            [false, 'auxLabelColor'] as const,
            [false, 'aux.line'] as const,
            [false, 'auxScaleX'] as const,
            [false, 'auxScaleY'] as const,
            [false, 'auxScaleZ'] as const,
            [false, 'auxScale'] as const,
            [true, 'aux._hidden'] as const,
            [false, '+(#tag:"value")'] as const,
            [false, 'onCombine(#tag:"value")'] as const,
            [true, '_context_test'] as const,
            [true, '_context_ something else'] as const,
            [true, '_context_ 😊😜😢'] as const,
            [true, '_selection_09a1ee66-bb0f-4f9e-81d2-d8d4da5683b8'] as const,
            [false, '📦'] as const,
        ];
        it.each(normalCases)(
            'should return %s for %',
            (expected: boolean, tag: string) => {
                expect(isTagWellKnown(tag)).toBe(expected);
            }
        );
    });

    describe('doBotsAppearEqual()', () => {
        it('should return true if both null', () => {
            const result = doBotsAppearEqual(null, null);

            expect(result).toBe(true);
        });

        it('should return false if one null', () => {
            expect(doBotsAppearEqual(createBot(), null)).toBe(false);
            expect(doBotsAppearEqual(null, createBot())).toBe(false);
        });

        it('should ignore IDs if theyre not the same', () => {
            let first = createBot('id1');
            let second = createBot('id2');

            const result = doBotsAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should ignore selection tags by default', () => {
            let first = createBot('id1');
            let second = createBot('id2');

            first.tags['_auxSelection83e80481-13a1-439e-94e6-f3b73942288f'] =
                'a';
            second.tags['_auxSelection83e80481-13a1-439e-94e6-f3b73942288f'] =
                'b';

            const result = doBotsAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should ignore dimension tags', () => {
            let first = createBot('id1');
            let second = createBot('id2');

            first.tags['aux._context_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'a';
            second.tags['aux._context_83e80481-13a1-439e-94e6-f3b73942288f'] =
                'b';

            const result = doBotsAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should ignore selection tags', () => {
            let first = createBot('id1');
            let second = createBot('id2');

            first.tags['_auxSelection83e80481-13a1-439e-94e6-f3b73942288f'] =
                'a';
            second.tags['_auxSelection83e80481-13a1-439e-94e6-f3b73942288f'] =
                'b';

            const result = doBotsAppearEqual(first, second);

            expect(result).toBe(true);
        });

        it('should use the ignoreId option for checking bot IDs', () => {
            let first = createBot('testID');
            let second = createBot('testID');

            first.tags.a = true;
            second.tags.a = false;

            // Defaults to using the ID as a shortcut
            expect(doBotsAppearEqual(first, second)).toBe(true);

            expect(doBotsAppearEqual(first, second, { ignoreId: true })).toBe(
                false
            );
        });

        it('should should ignore default hidden tags', () => {
            let first = createBot('id1');
            let second = createBot('id2');

            first.tags['aux._context_AX'] = 1;
            second.tags['aux._context_BX'] = 0;

            const result = doBotsAppearEqual(first, second);

            expect(result).toBe(true);
        });
    });

    describe('cleanBot()', () => {
        it('should remove null and undefined tags', () => {
            let bot = createBot('test', {
                testTag: 'abcdefg',
                other: 0,
                falsy: false,
                truthy: true,
                _workspace: null,
                _test: undefined,
            });

            const result = cleanBot(bot);

            expect(result).toEqual({
                id: 'test',
                tags: {
                    testTag: 'abcdefg',
                    other: 0,
                    falsy: false,
                    truthy: true,
                },
            });
        });

        it('should not modify the given bot', () => {
            let bot = createBot('test', {
                testTag: 'abcdefg',
                other: 0,
                falsy: false,
                truthy: true,
                _workspace: null,
                _test: undefined,
            });

            const result = cleanBot(bot);

            expect(bot).toEqual({
                id: 'test',
                tags: {
                    testTag: 'abcdefg',
                    other: 0,
                    falsy: false,
                    truthy: true,
                    _workspace: null,
                    _test: undefined,
                },
            });
        });
    });

    describe('parseSimulationId()', () => {
        it('should default to filling the channel ID', () => {
            let result = parseSimulationId('abc');
            expect(result).toEqual({
                success: true,
                channel: 'abc',
            });

            result = parseSimulationId('!@#$%');
            expect(result).toEqual({
                success: true,
                channel: '!@#$%',
            });

            result = parseSimulationId('.test');
            expect(result).toEqual({
                success: true,
                channel: '.test',
            });

            result = parseSimulationId('test.');
            expect(result).toEqual({
                success: true,
                channel: 'test.',
            });
        });

        it('should not fill in the dimension', () => {
            let result = parseSimulationId('abc/def');
            expect(result).toEqual({
                success: true,
                channel: 'abc/def',
            });

            result = parseSimulationId('!@#$%/@@a*987');
            expect(result).toEqual({
                success: true,
                channel: '!@#$%/@@a*987',
            });

            result = parseSimulationId('abc/def/ghi/');
            expect(result).toEqual({
                success: true,
                channel: 'abc/def/ghi/',
            });

            result = parseSimulationId('abc/def/ghi/.hello');
            expect(result).toEqual({
                success: true,
                channel: 'abc/def/ghi/.hello',
            });
        });

        it('should not fill in the host when given an incomplete URL', () => {
            let result = parseSimulationId('auxplayer.com/abc/def');
            expect(result).toEqual({
                success: true,
                channel: 'auxplayer.com/abc/def',
            });

            result = parseSimulationId('abc.test.local/!@#$%/@@a*987');
            expect(result).toEqual({
                success: true,
                channel: 'abc.test.local/!@#$%/@@a*987',
            });

            result = parseSimulationId('.local/!@#$%/@@a*987');
            expect(result).toEqual({
                success: true,
                channel: '.local/!@#$%/@@a*987',
            });

            result = parseSimulationId('.local/!@#$%/@@a*987');
            expect(result).toEqual({
                success: true,
                channel: '.local/!@#$%/@@a*987',
            });
        });

        it('should use the given URL', () => {
            let result = parseSimulationId('https://example.com');
            expect(result).toEqual({
                success: true,
                host: 'https://example.com',
            });

            result = parseSimulationId('https://example.com/sim');
            expect(result).toEqual({
                success: true,
                host: 'https://example.com',
            });

            result = parseSimulationId('https://example.com?server=sim');
            expect(result).toEqual({
                success: true,
                host: 'https://example.com',
                channel: 'sim',
            });

            result = parseSimulationId(
                'https://example.com:3000?server=sim/dimension'
            );
            expect(result).toEqual({
                success: true,
                host: 'https://example.com:3000',
                channel: 'sim/dimension',
            });

            result = parseSimulationId(
                'https://example.com:3000?inst=sim/dimension'
            );
            expect(result).toEqual({
                success: true,
                host: 'https://example.com:3000',
                channel: 'sim/dimension',
            });

            result = parseSimulationId(
                'https://example.com:3000?server=sim&inst=different/dimension'
            );
            expect(result).toEqual({
                success: true,
                host: 'https://example.com:3000',
                channel: 'different/dimension',
            });
        });
    });

    describe('simulationIdToString()', () => {
        it('should encode the channel', () => {
            const id: SimulationIdParseSuccess = {
                success: true,
                channel: 'test',
            };

            expect(simulationIdToString(id)).toBe('test');
        });

        it('should encode the channel without the dimension', () => {
            const id: SimulationIdParseSuccess = {
                success: true,
                channel: 'test',
            };

            expect(simulationIdToString(id)).toBe('test');
        });

        it('should encode the host', () => {
            const id: SimulationIdParseSuccess = {
                success: true,
                host: 'https://example.com',
                channel: 'test/abc',
            };

            expect(simulationIdToString(id)).toBe(
                `https://example.com?inst=${encodeURIComponent('test/abc')}`
            );
        });

        it('should support the host without a channel', () => {
            const id: SimulationIdParseSuccess = {
                success: true,
                host: 'https://example.com',
            };

            expect(simulationIdToString(id)).toBe(`https://example.com`);
        });
    });

    describe('normalizeAUXBotURL()', () => {
        const cases = [
            ['http://example.com/path', 'http://example.com/path.aux'],
            ['http://example.com/', 'http://example.com/.aux'],
            ['http://example.com', 'http://example.com/.aux'],
            ['https://example.com/*/test', 'https://example.com/*/test.aux'],
            [
                'http://example.com/dimension/channel',
                'http://example.com/dimension/channel.aux',
            ],
            [
                'http://example.com/dimension/channel.aux',
                'http://example.com/dimension/channel.aux',
            ],
            ['http://example.com/.aux', 'http://example.com/.aux'],
        ];

        it.each(cases)('should map %s to %s', (given, expected) => {
            expect(normalizeAUXBotURL(given)).toBe(expected);
        });
    });

    describe('validateTag()', () => {
        it('should return invalid when tag is empty or null', () => {
            let errors = validateTag('');
            expect(errors).toEqual({
                valid: false,
                'tag.required': {},
            });

            errors = validateTag(null);
            expect(errors).toEqual({
                valid: false,
                'tag.required': {},
            });

            errors = validateTag('  \t\n');
            expect(errors).toEqual({
                valid: false,
                'tag.required': {},
            });
        });

        it('should return invalid when tag contains #', () => {
            let errors = validateTag('#');
            expect(errors).toEqual({
                valid: false,
                'tag.invalidChar': { char: '#' },
            });

            errors = validateTag('abc#');
            expect(errors).toEqual({
                valid: false,
                'tag.invalidChar': { char: '#' },
            });

            errors = validateTag(' #def');
            expect(errors).toEqual({
                valid: false,
                'tag.invalidChar': { char: '#' },
            });
        });

        it('should not allow # when it is a filter', () => {
            let errors = validateTag('onCombine()');
            expect(errors).toEqual({
                valid: true,
            });

            errors = validateTag('onCombine(');
            expect(errors).toEqual({
                valid: true,
            });

            errors = validateTag('onCombine(#');
            expect(errors).toEqual({
                'tag.invalidChar': { char: '#' },
                valid: false,
            });

            errors = validateTag('onCombine(#tag:"###test');
            expect(errors).toEqual({
                'tag.invalidChar': { char: '#' },
                valid: false,
            });

            errors = validateTag('onCombine(#tag:"###test")');
            expect(errors).toEqual({
                'tag.invalidChar': { char: '#' },
                valid: false,
            });
        });

        it('should be valid when tag is fine', () => {
            let errors = validateTag('abcdef');
            expect(errors).toEqual({
                valid: true,
            });

            errors = validateTag('  abcdef');
            expect(errors).toEqual({
                valid: true,
            });

            errors = validateTag('abcdef  ');
            expect(errors).toEqual({
                valid: true,
            });
        });
    });

    describe('isHiddenTag()', () => {
        it('should be true for tags that start with underscores', () => {
            expect(isHiddenTag('_')).toBe(true);
            expect(isHiddenTag('__')).toBe(true);
            expect(isHiddenTag('_abc')).toBe(true);
            expect(isHiddenTag('_position')).toBe(true);
            expect(isHiddenTag('_workspace')).toBe(true);
            expect(isHiddenTag('_ test')).toBe(true);
            expect(isHiddenTag('_+abc')).toBe(true);

            expect(isHiddenTag('lalala_')).toBe(false);
            expect(isHiddenTag('a_')).toBe(false);
            expect(isHiddenTag('in_middle')).toBe(false);
            expect(isHiddenTag(' _underscored')).toBe(false);
            expect(isHiddenTag('+tag')).toBe(false);
        });

        it('should be true for tags that start with underscores after dots', () => {
            expect(isHiddenTag('aux._')).toBe(true);
            expect(isHiddenTag('aux._context_')).toBe(true);
            expect(isHiddenTag('_auxSelection')).toBe(true);
            expect(isHiddenTag('domain._hidden')).toBe(true);

            expect(isHiddenTag('._')).toBe(false);
            expect(isHiddenTag('-._')).toBe(false);
            expect(isHiddenTag('\\._')).toBe(false);
            expect(isHiddenTag('abc,_context_')).toBe(false);
            expect(isHiddenTag('aux.test_')).toBe(false);
        });
    });

    describe('botTags()', () => {
        it('should return the list of tags that the bots have', () => {
            const bots: Bot[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                    },
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello',
                    },
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again',
                    },
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag',
                    },
                },
            ];

            const tags = botTags(bots, [], []);

            expect(tags).toEqual([
                { tag: '_position', space: null },
                { tag: '_workspace', space: null },
                { tag: 'tag', space: null },
                { tag: 'other', space: null },
            ]);
        });

        it('should include tag masks', () => {
            const bots: Bot[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                    },
                    masks: {
                        tempLocal: {
                            tag2: 1,
                        },
                    },
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello',
                    },
                    masks: {
                        shared: {
                            tag3: 1,
                        },
                    },
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again',
                    },
                    masks: {
                        tempShared: {
                            tag4: 1,
                        },
                    },
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag',
                    },
                },
            ];

            const tags = botTags(bots, [], []);

            expect(tags).toEqual([
                { tag: '_position', space: null },
                { tag: '_workspace', space: null },
                { tag: 'tag', space: null },
                { tag: 'other', space: null },
                { tag: 'tag2', space: 'tempLocal' },
                { tag: 'tag3', space: 'shared' },
                { tag: 'tag4', space: 'tempShared' },
            ]);
        });

        it('should preserve the order of the current tags', () => {
            const bots: Bot[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                    },
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello',
                    },
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again',
                    },
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag',
                    },
                },
            ];

            const tags = botTags(bots, ['other', 'tag'], []);

            expect(tags).toEqual([
                { tag: 'other', space: null },
                { tag: 'tag', space: null },
                { tag: '_position', space: null },
                { tag: '_workspace', space: null },
            ]);
        });

        it('should include the given extra tags', () => {
            const bots: Bot[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                    },
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello',
                    },
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again',
                    },
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag',
                    },
                },
            ];

            const tags = botTags(bots, [], ['abc', '_position']);

            expect(tags).toEqual([
                { tag: '_position', space: null },
                { tag: '_workspace', space: null },
                { tag: 'tag', space: null },
                { tag: 'other', space: null },
                { tag: 'abc', space: null },
            ]);
        });

        it('should not include extra tags that are given in the currrentTags array', () => {
            const bots: Bot[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                    },
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello',
                    },
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again',
                    },
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag',
                    },
                },
            ];

            const tags = botTags(bots, ['notIncluded'], []);

            expect(tags).toEqual([
                { tag: '_position', space: null },
                { tag: '_workspace', space: null },
                { tag: 'tag', space: null },
                { tag: 'other', space: null },
            ]);
        });

        it('should include hidden tags if specified', () => {
            const bots: Bot[] = [
                {
                    id: 'test',
                    tags: {
                        _hiddenTag1: 'abc',
                    },
                },
                {
                    id: 'test2',
                    tags: {
                        _hiddenTag2: 'abc',
                        tag: 'hello',
                    },
                },
                {
                    id: 'test3',
                    tags: {
                        _hiddenTag3: 'abc',
                        tag: 'again',
                    },
                },
                {
                    id: 'test4',
                    tags: {
                        _hiddenTag4: 'abc',
                        other: 'tag',
                    },
                },
            ];

            const tags = botTags(bots, ['notIncluded'], []);

            expect(tags).toEqual([
                { tag: '_hiddenTag1', space: null },
                { tag: '_hiddenTag2', space: null },
                { tag: 'tag', space: null },
                { tag: '_hiddenTag3', space: null },
                { tag: '_hiddenTag4', space: null },
                { tag: 'other', space: null },
            ]);
        });

        it('should only exclude tags not in the allowed tags list', () => {
            const bots: Bot[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                    },
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello',
                    },
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again',
                    },
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag',
                    },
                },
            ];

            const tags = botTags(bots, [], [], ['tag', 'other']);

            expect(tags).toEqual([
                { tag: 'tag', space: null },
                { tag: 'other', space: null },
            ]);
        });

        it('should not include extra tags if theyre not in the allowed tags list', () => {
            const bots: Bot[] = [
                {
                    id: 'test',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                    },
                },
                {
                    id: 'test2',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'hello',
                    },
                },
                {
                    id: 'test3',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        tag: 'again',
                    },
                },
                {
                    id: 'test4',
                    tags: {
                        _position: { x: 0, y: 0, z: 0 },
                        _workspace: 'abc',
                        other: 'tag',
                    },
                },
            ];

            const tags = botTags(bots, [], ['_position'], ['tag', 'other']);

            expect(tags).toEqual([
                { tag: 'tag', space: null },
                { tag: 'other', space: null },
            ]);
        });
    });

    describe('createContextId()', () => {
        const cases = [['abcdefghi', 'abcdefgh']];
        it.each(cases)('should convert %s to %s', (uuid, id) => {
            uuidMock.mockReturnValue(uuid);
            expect(createDimensionId()).toBe(id);
        });
    });

    describe('formatValue()', () => {
        it('should format bots to a short ID', () => {
            const bot = createBot('abcdefghijklmnopqrstuvwxyz');
            expect(formatValue(bot)).toBe('abcde');
        });

        it('should handle objects that have non string IDs', () => {
            const obj = {
                id: 123,
            };
            expect(formatValue(obj)).toBe(JSON.stringify(obj));
        });

        it('should format bot arrays', () => {
            const bot1 = createBot('abcdefghijklmnopqrstuvwxyz');
            const bot2 = createBot('zyxwvutsrqponmlkjighfedcba');
            expect(formatValue([bot1, bot2])).toBe('[abcde,zyxwv]');
        });

        it('should convert errors to strings', () => {
            const error = new Error('test');
            expect(formatValue(error)).toBe(error.toString());
        });

        const cases: [any, string][] = [
            [true, 'true'],
            [false, 'false'],
            ['', ''],
            ['abc', 'abc'],
            [0, '0'],
            [-0, '0'],
            [1.123, '1.123'],
            [-1.123, '-1.123'],
            [Infinity, 'Infinity'],
            [-Infinity, '-Infinity'],
            [NaN, 'NaN'],
            [new Date('16 Nov 2021 14:32:14 GMT'), '2021-11-16T14:32:14.000Z'],
            [null, null],
            [undefined, undefined],
            [{ abc: 'def' }, '{"abc":"def"}'],
        ];

        it.each(cases)('should format %s as %s', (given, expected) => {
            expect(formatValue(given)).toBe(expected);
        });
    });

    describe('getShortId()', () => {
        it('should get the short ID of the given bot', () => {
            const bot = createBot('abcdefghijklmnopqrstuvwxyz');
            expect(getShortId(bot)).toBe('abcde');
        });

        it('should handle objects that have non string IDs', () => {
            const obj = {
                id: 123,
            };
            expect(getShortId(<any>obj)).toBe('123');
        });

        it('should support using a string directly', () => {
            expect(getShortId('abcdefghijklmnopqrstuvwxyz')).toBe('abcde');
        });
    });

    describe('getUploadState()', () => {
        it('should support aux files that are just bot state', () => {
            const data = {
                test: createBot('test'),
                test2: createBot('test2'),
            };

            const result = getUploadState(data);

            expect(result).toEqual(data);
        });

        it('should support aux files that contain a version number', () => {
            const data = {
                version: 1,
                state: {
                    test: createBot('test'),
                    test2: createBot('test2'),
                },
            };

            const result = getUploadState(data);

            expect(result).toEqual(data.state);
        });
    });

    describe('getTagMaskSpaces()', () => {
        it('should return an empty array if the bot has no masks', () => {
            const b = createBot('test1');
            const spaces = getTagMaskSpaces(b, 'abc');

            expect(spaces).toEqual([]);
        });

        it('should return the list of spaces that the given tag exists in', () => {
            const b = createBot('test1');
            b.masks = {
                space1: {
                    abc: true,
                },
                space2: {
                    other: 123,
                },
                space3: {
                    abc: null,
                },
            };
            const spaces = getTagMaskSpaces(b, 'abc');

            expect(spaces).toEqual(['space1', 'space3']);
        });
    });

    describe('getTagMask()', () => {
        it('should return undefined if the bot has no masks', () => {
            const b = createBot('test1');
            const value = getTagMask(b, 'test', 'abc');

            expect(value).toBeUndefined();
        });

        it('should return undefined if the bot has no masks for the given space', () => {
            const b = createBot('test1');
            b.masks = {};
            const value = getTagMask(b, 'test', 'abc');

            expect(value).toBeUndefined();
        });

        it('should return the stored value', () => {
            const b = createBot('test1');
            b.masks = {
                test: {
                    abc: 123,
                },
            };
            const value = getTagMask(b, 'test', 'abc');

            expect(value).toBe(123);
        });
    });

    describe('tagMasksOnBot()', () => {
        it('should return the list of tag masks that are on the given bot', () => {
            const tags = tagMasksOnBot({
                id: 'test',
                tags: {
                    tag1: 'value',
                },
                masks: {
                    tempLocal: {
                        tag2: 'value',
                    },
                    shared: {
                        tag3: 'value',
                    },
                },
            });

            expect(tags).toEqual(['tag2', 'tag3']);
        });
    });

    describe('hasMaskForTag()', () => {
        it('should return true if there is a mask defined for the given tag', () => {
            expect(
                hasMaskForTag(
                    {
                        id: 'test',
                        tags: {},
                        masks: {
                            space: {
                                abc: true,
                            },
                        },
                    },
                    'abc'
                )
            ).toEqual(true);
        });

        it('should return false if there are multiple masks defined for the given tag', () => {
            expect(
                hasMaskForTag(
                    {
                        id: 'test',
                        tags: {},
                        masks: {
                            space: {
                                abc: true,
                            },
                            other: {
                                abc: 123,
                            },
                        },
                    },
                    'abc'
                )
            ).toEqual(true);
        });

        it('should return false if there is no mask defined for the given tag', () => {
            expect(
                hasMaskForTag(
                    {
                        id: 'test',
                        tags: {},
                        masks: {
                            space: {},
                        },
                    },
                    'abc'
                )
            ).toEqual(false);
        });

        it('should return false if there is no mask defined for the given tag but there are masks defined', () => {
            expect(
                hasMaskForTag(
                    {
                        id: 'test',
                        tags: {},
                        masks: {
                            space: {
                                other: 984,
                            },
                        },
                    },
                    'abc'
                )
            ).toEqual(false);
        });

        it('should return false if there are no masks defined', () => {
            expect(
                hasMaskForTag(
                    {
                        id: 'test',
                        tags: {},
                    },
                    'abc'
                )
            ).toEqual(false);
        });
    });

    describe('getTagValueForSpace()', () => {
        it('should return the tag mask value for the given space', () => {
            const val = getTagValueForSpace(
                {
                    id: 'test',
                    tags: {
                        abc: 123,
                    },
                    masks: {
                        tempLocal: {
                            abc: 'def',
                        },
                    },
                },
                'abc',
                'tempLocal'
            );

            expect(val).toEqual('def');
        });

        it('should return the tag value if given null for the space', () => {
            const val = getTagValueForSpace(
                {
                    id: 'test',
                    tags: {
                        abc: 123,
                    },
                    masks: {
                        tempLocal: {},
                    },
                },
                'abc',
                null
            );

            expect(val).toEqual(123);
        });

        it('should return undefined if there is no tag for the value', () => {
            const val = getTagValueForSpace(
                {
                    id: 'test',
                    tags: {
                        abc: 123,
                    },
                    masks: {
                        tempLocal: {},
                    },
                },
                'abc',
                'tempLocal'
            );

            expect(val).toBeUndefined();
        });
    });

    describe('getSpaceForTag()', () => {
        it('should return the first space that the tag mask is in', () => {
            const space = getSpaceForTag(
                {
                    id: 'test',
                    tags: {
                        abc: 123,
                    },
                    masks: {
                        tempLocal: {
                            abc: 'def',
                        },
                    },
                },
                'abc'
            );

            expect(space).toEqual('tempLocal');
        });

        it('should prioritize tempLocal over local', () => {
            const space = getSpaceForTag(
                {
                    id: 'test',
                    tags: {
                        abc: 123,
                    },
                    masks: {
                        local: {
                            abc: 'ghi',
                        },
                        tempLocal: {
                            abc: 'def',
                        },
                    },
                },
                'abc'
            );

            expect(space).toEqual('tempLocal');
        });

        it('should return null if there is no mask space that the tag is in', () => {
            const space = getSpaceForTag(
                {
                    id: 'test',
                    tags: {
                        abc: 123,
                    },
                    masks: {
                        tempLocal: {},
                    },
                },
                'abc'
            );

            expect(space).toEqual(null);
        });
    });

    describe('getUpdateForTagAndSpace()', () => {
        it('should return an update object with the given tag set to the value', () => {
            const update = getUpdateForTagAndSpace('abc', 'def', null);

            expect(update).toEqual({
                tags: {
                    abc: 'def',
                },
            });
        });

        it('should return an update object with the given tag mask set to the value', () => {
            const update = getUpdateForTagAndSpace('abc', 'def', 'tempLocal');

            expect(update).toEqual({
                masks: {
                    tempLocal: {
                        abc: 'def',
                    },
                },
            });
        });
    });

    describe('parseNewTag()', () => {
        const cases = [
            [
                'parse normal tags',
                'onClick',
                { name: 'onClick', isScript: false, isFormula: false },
            ] as const,
            [
                'parse script tags',
                '@onClick',
                { name: 'onClick', isScript: true, isFormula: false },
            ] as const,
            [
                'parse mod tags',
                '🧬dna',
                { name: 'dna', isScript: false, isFormula: true },
            ] as const,
        ];

        it.each(cases)('should %s', (desc, tag, expected) => {
            expect(parseNewTag(tag)).toEqual(expected);
        });
    });

    describe('getBotTransformer()', () => {
        it('should return the string value', () => {
            const bot = createPrecalculatedBot('test', {
                transformer: 'id',
            });

            expect(getBotTransformer(null, bot)).toBe('id');
        });

        it('should return null if it is a number', () => {
            const bot = createPrecalculatedBot('test', {
                transformer: 123,
            });

            expect(getBotTransformer(null, bot)).toBe(null);
        });

        it('should return the first string in the array', () => {
            const bot = createPrecalculatedBot('test', {
                transformer: ['id', 'wrong'],
            });

            expect(getBotTransformer(null, bot)).toBe('id');
        });

        it('should return the ID stored in the bot link', () => {
            const bot = createPrecalculatedBot('test', {
                transformer: '🔗id',
            });

            expect(getBotTransformer(null, bot)).toBe('id');
        });

        it('should return the first ID stored in the bot link', () => {
            const bot = createPrecalculatedBot('test', {
                transformer: '🔗id,wrong',
            });

            expect(getBotTransformer(null, bot)).toBe('id');
        });
    });

    botCalculationContextTests(uuidMock, dateNowMock, (bots, userId) =>
        createPrecalculatedContext(bots)
    );
});
