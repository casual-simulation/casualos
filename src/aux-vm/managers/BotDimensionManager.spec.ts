import {
    BotIndex,
    createPrecalculatedBot,
    createPrecalculatedContext,
} from '@casual-simulation/aux-common';
import {
    BotDimensionManager,
    BotDimensionsUpdate,
    processIndexEvents,
} from './BotDimensionManager';
import { BotHelper } from '.';
import { TestAuxVM } from '../vm/test/TestAuxVM';

describe('BotDimensionManager', () => {
    let index: BotIndex;
    let helper: BotHelper;
    let vm: TestAuxVM;
    let dimensions: BotDimensionManager;

    beforeEach(() => {
        vm = new TestAuxVM();
        helper = new BotHelper(vm);
        helper.userId = 'user';
        index = new BotIndex();
        dimensions = new BotDimensionManager(helper, index);
    });

    describe('processIndexEvents()', () => {
        it('should properly clone the previous state', () => {
            const calc = createPrecalculatedContext([]);
            const state = {
                dimensions: new Map([['abc', new Set(['test'])]]),
                botsInDimensions: new Map([['abc', new Set(['inDimension'])]]),
            };
            const [_, newState] = processIndexEvents(state, calc, [], index, [
                'auxDimensionConfig',
            ]);

            expect(newState).toEqual(state);
        });

        describe('dimension_added', () => {
            it('should emit a dimension_added event when a dimension is defined via a tag_added event', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: 'abc',
                });
                const calc = createPrecalculatedContext([test]);
                const indexEvents = index.addBots([test]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: 'auxDimensionConfig',
                            dimensionBot: test,
                            dimension: 'abc',
                            existingBots: [],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test,
                            tags: new Set(['auxDimensionConfig']),
                        },
                    ],
                });
            });

            it('should emit a dimension_added event when a dimension is defined via a tag_updated event', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: 'abc',
                });
                const final = createPrecalculatedBot('test', {
                    auxDimensionConfig: ['abc', 'def'],
                });
                const calc = createPrecalculatedContext([test]);
                index.addBots([test]);
                const indexEvents = index.updateBots([
                    {
                        bot: final,
                        tags: new Set(['auxDimensionConfig']),
                    },
                ]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: 'auxDimensionConfig',
                            dimensionBot: final,
                            dimension: 'def',
                            existingBots: [],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: final,
                            tags: new Set(['auxDimensionConfig']),
                        },
                    ],
                });
            });

            it('should include all the bots that are already in the dimension', () => {
                const inDimension = createPrecalculatedBot('inDimension', {
                    abc: true,
                });
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: 'abc',
                });
                const calc = createPrecalculatedContext([inDimension, test]);
                const indexEvents = index.addBots([inDimension, test]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: 'auxDimensionConfig',
                            dimensionBot: test,
                            dimension: 'abc',
                            existingBots: [inDimension],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: inDimension,
                            tags: new Set(['abc']),
                        },
                        {
                            bot: test,
                            tags: new Set(['auxDimensionConfig']),
                        },
                    ],
                });
            });

            it('should add all the bots that are already in the dimension to the state', () => {
                const inDimension = createPrecalculatedBot('inDimension', {
                    abc: true,
                });
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: 'abc',
                });
                const calc = createPrecalculatedContext([inDimension, test]);
                const indexEvents = index.addBots([inDimension, test]);
                const [_, state] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(state).toEqual({
                    dimensions: new Map([['abc', new Set(['test'])]]),
                    botsInDimensions: new Map([
                        ['abc', new Set(['inDimension'])],
                    ]),
                });
            });

            it('should not include user bots with pagePortal set to the dimension', () => {
                const user = createPrecalculatedBot('user', {
                    auxPlayerName: 'user',
                    pagePortal: 'abc',
                });
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: 'abc',
                });
                const calc = createPrecalculatedContext([user, test]);
                const indexEvents = index.addBots([user, test]);
                const [result, state] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: 'auxDimensionConfig',
                            dimensionBot: test,
                            dimension: 'abc',
                            existingBots: [],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: user,
                            tags: new Set(['auxPlayerName', 'pagePortal']),
                        },
                        {
                            bot: test,
                            tags: new Set(['auxDimensionConfig']),
                        },
                    ],
                });
            });

            it('should not emit a dimension_added event when a the dimension bot filter returns false', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: 'abc',
                });
                const calc = createPrecalculatedContext([test]);
                const indexEvents = index.addBots([test]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig'],
                    () => false
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [],
                    updatedBots: [
                        {
                            bot: test,
                            tags: new Set(['auxDimensionConfig']),
                        },
                    ],
                });
            });
        });

        describe('dimension_removed', () => {
            it('should emit a dimension_removed event when a dimension is removed via a tag_updated event', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: ['abc', 'def'],
                });
                const final = createPrecalculatedBot('test', {
                    auxDimensionConfig: ['abc'],
                });
                const calc = createPrecalculatedContext([test]);
                index.addBots([test]);
                const indexEvents = index.updateBots([
                    {
                        bot: final,
                        tags: new Set(['auxDimensionConfig']),
                    },
                ]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'dimension_removed',
                            dimensionTag: 'auxDimensionConfig',
                            dimensionBot: final,
                            dimension: 'def',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: final,
                            tags: new Set(['auxDimensionConfig']),
                        },
                    ],
                });
            });

            it('should emit a dimension_removed event when a dimension is removed via a tag_updated event', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: 'abc',
                });
                const final = createPrecalculatedBot('test', {
                    auxDimensionConfig: null,
                });
                const calc = createPrecalculatedContext([test]);
                index.addBots([test]);
                const indexEvents = index.updateBots([
                    {
                        bot: final,
                        tags: new Set(['auxDimensionConfig']),
                    },
                ]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'dimension_removed',
                            dimensionTag: 'auxDimensionConfig',
                            dimensionBot: final,
                            dimension: 'abc',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: final,
                            tags: new Set(['auxDimensionConfig']),
                        },
                    ],
                });
            });

            it('should emit a dimension_removed event when a dimension is removed via a tag_removed event', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: ['abc', 'def'],
                });
                const calc = createPrecalculatedContext([test]);
                index.addBots([test]);
                const indexEvents = index.removeBots(['test']);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'dimension_removed',
                            dimensionTag: 'auxDimensionConfig',
                            dimensionBot: test,
                            dimension: 'abc',
                        },
                        {
                            type: 'dimension_removed',
                            dimensionTag: 'auxDimensionConfig',
                            dimensionBot: test,
                            dimension: 'def',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test,
                            tags: new Set(['auxDimensionConfig']),
                        },
                    ],
                });
            });

            it('should remove the bot from the dimension state', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: ['abc', 'def'],
                });
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test]);
                const [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );
                calc = createPrecalculatedContext([]);
                indexEvents = index.removeBots(['test']);
                const [_, state2] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(state2).toEqual({
                    dimensions: new Map(),
                    botsInDimensions: new Map(),
                });
            });
        });

        describe('bot_added_to_dimension', () => {
            it('should emit a bot_added_to_dimension event when a bot is added to a dimension that has been defined', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: 'abc',
                });
                const inDimension = createPrecalculatedBot('inDimension', {
                    abc: true,
                });
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test]);
                let [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );
                calc = createPrecalculatedContext([test, inDimension]);
                indexEvents = index.addBots([inDimension]);
                let [result] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'bot_added_to_dimension',
                            bot: inDimension,
                            dimension: 'abc',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: inDimension,
                            tags: new Set(['abc']),
                        },
                    ],
                });
            });

            it('should emit a bot_added_to_dimension event when a bot is updated into a dimension that has been defined', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: 'abc',
                });
                const inDimension = createPrecalculatedBot('inDimension', {});
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test, inDimension]);
                let [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );
                calc = createPrecalculatedContext([test, inDimension]);

                const inDimensionFinal = createPrecalculatedBot('inDimension', {
                    abc: true,
                });
                indexEvents = index.updateBots([
                    {
                        bot: inDimensionFinal,
                        tags: new Set(['abc']),
                    },
                ]);
                let [result, state] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'bot_added_to_dimension',
                            bot: inDimensionFinal,
                            dimension: 'abc',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: inDimensionFinal,
                            tags: new Set(['abc']),
                        },
                    ],
                });

                expect(state).toEqual({
                    dimensions: new Map([['abc', new Set(['test'])]]),
                    botsInDimensions: new Map([
                        ['abc', new Set(['inDimension'])],
                    ]),
                });
            });

            it('should not emit a bot_added_to_dimension event when a user bot is updated into a dimension that has been defined', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: 'abc',
                });
                const user = createPrecalculatedBot('user', {
                    auxPlayerName: 'user',
                });
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test, user]);
                let [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );
                calc = createPrecalculatedContext([test, user]);

                const userFinal = createPrecalculatedBot('user', {
                    auxPlayerName: 'user',
                    pagePortal: 'abc',
                });
                indexEvents = index.updateBots([
                    {
                        bot: userFinal,
                        tags: new Set(['pagePortal']),
                    },
                ]);
                let [result, state] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [],
                    updatedBots: [
                        {
                            bot: userFinal,
                            tags: new Set(['pagePortal']),
                        },
                    ],
                });

                expect(state).toEqual({
                    dimensions: new Map([['abc', new Set(['test'])]]),
                    botsInDimensions: new Map([['abc', new Set([])]]),
                });
            });
        });

        describe('bot_removed_from_dimension', () => {
            it('should emit a bot_removed_from_dimension event when a bot is removed from a dimension that has been defined', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: 'abc',
                });
                const inDimension = createPrecalculatedBot('inDimension', {
                    abc: true,
                });
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test, inDimension]);
                let [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );
                calc = createPrecalculatedContext([test, inDimension]);

                indexEvents = index.removeBots(['inDimension']);
                let [result, state2] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'bot_removed_from_dimension',
                            bot: inDimension,
                            dimension: 'abc',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: inDimension,
                            tags: new Set(['abc']),
                        },
                    ],
                });

                expect(state2).toEqual({
                    dimensions: new Map([['abc', new Set(['test'])]]),
                    botsInDimensions: new Map([['abc', new Set([])]]),
                });
            });

            it('should not emit a bot_removed_from_dimension event when a user bot is removed from a dimension that has been defined', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimensionConfig: 'abc',
                });
                const user = createPrecalculatedBot('user', {
                    auxPlayerName: 'user',
                    pagePortal: 'abc',
                });
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test, user]);
                let [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );
                calc = createPrecalculatedContext([test, user]);

                const userFinal = createPrecalculatedBot('user', {
                    auxPlayerName: 'user',
                    pagePortal: 'different',
                });
                indexEvents = index.updateBots([
                    {
                        bot: userFinal,
                        tags: new Set(['pagePortal']),
                    },
                ]);
                let [result, state] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimensionConfig']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [],
                    updatedBots: [
                        {
                            bot: userFinal,
                            tags: new Set(['pagePortal']),
                        },
                    ],
                });

                expect(state).toEqual({
                    dimensions: new Map([['abc', new Set(['test'])]]),
                    botsInDimensions: new Map([['abc', new Set([])]]),
                });
            });
        });
    });

    describe('watchDimensions()', () => {
        it('should emit a dimension_added event when a dimension is defined in the given tag', () => {
            let events = [] as BotDimensionsUpdate[];

            dimensions
                .watchDimensions(['auxDimensionConfig'], () => true)
                .subscribe((e) => events.push(e));

            const test = createPrecalculatedBot('test', {
                auxDimensionConfig: 'abc',
            });
            index.addBots([test]);

            expect(events).toEqual([
                {
                    calc: expect.anything(),
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: 'auxDimensionConfig',
                            dimensionBot: test,
                            dimension: 'abc',
                            existingBots: [],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test,
                            tags: new Set(['auxDimensionConfig']),
                        },
                    ],
                },
            ]);
        });

        it('should emit a dimension_removed and dimension_added event when a dimension is changed', () => {
            let events = [] as BotDimensionsUpdate[];

            dimensions
                .watchDimensions(['pagePortal'], () => true)
                .subscribe((e) => events.push(e));

            const test = createPrecalculatedBot('test', {
                pagePortal: 'abc',
            });
            index.addBots([test]);

            const test2 = createPrecalculatedBot('test', {
                pagePortal: '123',
            });
            index.updateBots([
                {
                    bot: test2,
                    tags: new Set(['pagePortal']),
                },
            ]);

            expect(events).toEqual([
                {
                    calc: expect.anything(),
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: 'pagePortal',
                            dimensionBot: test,
                            dimension: 'abc',
                            existingBots: [],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test,
                            tags: new Set(['pagePortal']),
                        },
                    ],
                },
                {
                    calc: expect.anything(),
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: 'pagePortal',
                            dimensionBot: test2,
                            dimension: '123',
                            existingBots: [],
                        },
                        {
                            type: 'dimension_removed',
                            dimensionTag: 'pagePortal',
                            dimensionBot: test2,
                            dimension: 'abc',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test2,
                            tags: new Set(['pagePortal']),
                        },
                    ],
                },
            ]);
        });

        it('should support the same dimension multiple times but in different dimension tags', () => {
            let events = [] as BotDimensionsUpdate[];

            dimensions
                .watchDimensions(
                    ['auxDimensionConfig1', 'auxDimensionConfig2'],
                    () => true
                )
                .subscribe((e) => events.push(e));

            const test = createPrecalculatedBot('test', {
                auxDimensionConfig1: 'abc',
                auxDimensionConfig2: 'abc',
            });
            index.addBots([test]);

            expect(events).toEqual([
                {
                    calc: expect.anything(),
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: 'auxDimensionConfig1',
                            dimensionBot: test,
                            dimension: 'abc',
                            existingBots: [],
                        },
                        {
                            type: 'dimension_added',
                            dimensionTag: 'auxDimensionConfig2',
                            dimensionBot: test,
                            dimension: 'abc',
                            existingBots: [],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test,
                            tags: new Set([
                                'auxDimensionConfig1',
                                'auxDimensionConfig2',
                            ]),
                        },
                    ],
                },
            ]);
        });
    });
});
