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
                'auxDimension',
            ]);

            expect(newState).toEqual(state);
        });

        describe('dimension_added', () => {
            it('should emit a dimension_added event when a dimension is defined via a tag_added event', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimension: 'abc',
                });
                const calc = createPrecalculatedContext([test]);
                const indexEvents = index.addBots([test]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: 'auxDimension',
                            dimensionBot: test,
                            dimension: 'abc',
                            existingBots: [],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test,
                            tags: new Set(['auxDimension']),
                        },
                    ],
                });
            });

            it('should emit a dimension_added event when a dimension is defined via a tag_updated event', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimension: 'abc',
                });
                const final = createPrecalculatedBot('test', {
                    auxDimension: ['abc', 'def'],
                });
                const calc = createPrecalculatedContext([test]);
                index.addBots([test]);
                const indexEvents = index.updateBots([
                    {
                        bot: final,
                        tags: new Set(['auxDimension']),
                    },
                ]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: 'auxDimension',
                            dimensionBot: final,
                            dimension: 'def',
                            existingBots: [],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: final,
                            tags: new Set(['auxDimension']),
                        },
                    ],
                });
            });

            it('should include all the bots that are already in the dimension', () => {
                const inDimension = createPrecalculatedBot('inDimension', {
                    abc: true,
                });
                const test = createPrecalculatedBot('test', {
                    auxDimension: 'abc',
                });
                const calc = createPrecalculatedContext([inDimension, test]);
                const indexEvents = index.addBots([inDimension, test]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: 'auxDimension',
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
                            tags: new Set(['auxDimension']),
                        },
                    ],
                });
            });

            it('should add all the bots that are already in the dimension to the state', () => {
                const inDimension = createPrecalculatedBot('inDimension', {
                    abc: true,
                });
                const test = createPrecalculatedBot('test', {
                    auxDimension: 'abc',
                });
                const calc = createPrecalculatedContext([inDimension, test]);
                const indexEvents = index.addBots([inDimension, test]);
                const [_, state] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
                );

                expect(state).toEqual({
                    dimensions: new Map([['abc', new Set(['test'])]]),
                    botsInDimensions: new Map([
                        ['abc', new Set(['inDimension'])],
                    ]),
                });
            });

            it('should include user bots with _auxUserDimension set to the dimension', () => {
                const user = createPrecalculatedBot('user', {
                    _auxUser: 'user',
                    _auxUserDimension: 'abc',
                });
                const test = createPrecalculatedBot('test', {
                    auxDimension: 'abc',
                });
                const calc = createPrecalculatedContext([user, test]);
                const indexEvents = index.addBots([user, test]);
                const [result, state] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: 'auxDimension',
                            dimensionBot: test,
                            dimension: 'abc',
                            existingBots: [user],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: user,
                            tags: new Set(['_auxUser', '_auxUserDimension']),
                        },
                        {
                            bot: test,
                            tags: new Set(['auxDimension']),
                        },
                    ],
                });
            });
        });

        describe('dimension_removed', () => {
            it('should emit a dimension_removed event when a dimension is removed via a tag_updated event', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimension: ['abc', 'def'],
                });
                const final = createPrecalculatedBot('test', {
                    auxDimension: ['abc'],
                });
                const calc = createPrecalculatedContext([test]);
                index.addBots([test]);
                const indexEvents = index.updateBots([
                    {
                        bot: final,
                        tags: new Set(['auxDimension']),
                    },
                ]);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'dimension_removed',
                            dimensionTag: 'auxDimension',
                            dimensionBot: final,
                            dimension: 'def',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: final,
                            tags: new Set(['auxDimension']),
                        },
                    ],
                });
            });

            it('should emit a dimension_removed event when a dimension is removed via a tag_removed event', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimension: ['abc', 'def'],
                });
                const calc = createPrecalculatedContext([test]);
                index.addBots([test]);
                const indexEvents = index.removeBots(['test']);
                const [result] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'dimension_removed',
                            dimensionTag: 'auxDimension',
                            dimensionBot: test,
                            dimension: 'abc',
                        },
                        {
                            type: 'dimension_removed',
                            dimensionTag: 'auxDimension',
                            dimensionBot: test,
                            dimension: 'def',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test,
                            tags: new Set(['auxDimension']),
                        },
                    ],
                });
            });

            it('should remove the bot from the dimension state', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimension: ['abc', 'def'],
                });
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test]);
                const [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
                );
                calc = createPrecalculatedContext([]);
                indexEvents = index.removeBots(['test']);
                const [_, state2] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
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
                    auxDimension: 'abc',
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
                    ['auxDimension']
                );
                calc = createPrecalculatedContext([test, inDimension]);
                indexEvents = index.addBots([inDimension]);
                let [result] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
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
                    auxDimension: 'abc',
                });
                const inDimension = createPrecalculatedBot('inDimension', {});
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test, inDimension]);
                let [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
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
                    ['auxDimension']
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

            it('should emit a bot_added_to_dimension event when a user bot is updated into a dimension that has been defined', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimension: 'abc',
                });
                const user = createPrecalculatedBot('user', {
                    _auxUser: 'user',
                });
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test, user]);
                let [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
                );
                calc = createPrecalculatedContext([test, user]);

                const userFinal = createPrecalculatedBot('user', {
                    _auxUser: 'user',
                    _auxUserDimension: 'abc',
                });
                indexEvents = index.updateBots([
                    {
                        bot: userFinal,
                        tags: new Set(['_auxUserDimension']),
                    },
                ]);
                let [result, state] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'bot_added_to_dimension',
                            bot: userFinal,
                            dimension: 'abc',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: userFinal,
                            tags: new Set(['_auxUserDimension']),
                        },
                    ],
                });

                expect(state).toEqual({
                    dimensions: new Map([['abc', new Set(['test'])]]),
                    botsInDimensions: new Map([['abc', new Set(['user'])]]),
                });
            });
        });

        describe('bot_removed_from_dimension', () => {
            it('should emit a bot_removed_from_dimension event when a bot is removed from a dimension that has been defined', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimension: 'abc',
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
                    ['auxDimension']
                );
                calc = createPrecalculatedContext([test, inDimension]);

                indexEvents = index.removeBots(['inDimension']);
                let [result, state2] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
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

            it('should emit a bot_removed_from_dimension event when a user bot is removed from a dimension that has been defined', () => {
                const test = createPrecalculatedBot('test', {
                    auxDimension: 'abc',
                });
                const user = createPrecalculatedBot('user', {
                    _auxUser: 'user',
                    _auxUserDimension: 'abc',
                });
                let calc = createPrecalculatedContext([test]);
                let indexEvents = index.addBots([test, user]);
                let [_1, state1] = processIndexEvents(
                    null,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
                );
                calc = createPrecalculatedContext([test, user]);

                const userFinal = createPrecalculatedBot('user', {
                    _auxUser: 'user',
                    _auxUserDimension: 'different',
                });
                indexEvents = index.updateBots([
                    {
                        bot: userFinal,
                        tags: new Set(['_auxUserDimension']),
                    },
                ]);
                let [result, state] = processIndexEvents(
                    state1,
                    calc,
                    indexEvents,
                    index,
                    ['auxDimension']
                );

                expect(result).toEqual({
                    calc: calc,
                    events: [
                        {
                            type: 'bot_removed_from_dimension',
                            bot: userFinal,
                            dimension: 'abc',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: userFinal,
                            tags: new Set(['_auxUserDimension']),
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
                .watchDimensions('auxDimension')
                .subscribe(e => events.push(e));

            const test = createPrecalculatedBot('test', {
                auxDimension: 'abc',
            });
            index.addBots([test]);

            expect(events).toEqual([
                {
                    calc: expect.anything(),
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: 'auxDimension',
                            dimensionBot: test,
                            dimension: 'abc',
                            existingBots: [],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test,
                            tags: new Set(['auxDimension']),
                        },
                    ],
                },
            ]);
        });

        it('should emit a dimension_removed and dimension_added event when a dimension is changed', () => {
            let events = [] as BotDimensionsUpdate[];

            dimensions
                .watchDimensions('_auxUserDimension')
                .subscribe(e => events.push(e));

            const test = createPrecalculatedBot('test', {
                _auxUserDimension: 'abc',
            });
            index.addBots([test]);

            const test2 = createPrecalculatedBot('test', {
                _auxUserDimension: '123',
            });
            index.updateBots([
                {
                    bot: test2,
                    tags: new Set(['_auxUserDimension']),
                },
            ]);

            expect(events).toEqual([
                {
                    calc: expect.anything(),
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: '_auxUserDimension',
                            dimensionBot: test,
                            dimension: 'abc',
                            existingBots: [],
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test,
                            tags: new Set(['_auxUserDimension']),
                        },
                    ],
                },
                {
                    calc: expect.anything(),
                    events: [
                        {
                            type: 'dimension_added',
                            dimensionTag: '_auxUserDimension',
                            dimensionBot: test2,
                            dimension: '123',
                            existingBots: [],
                        },
                        {
                            type: 'dimension_removed',
                            dimensionTag: '_auxUserDimension',
                            dimensionBot: test2,
                            dimension: 'abc',
                        },
                    ],
                    updatedBots: [
                        {
                            bot: test2,
                            tags: new Set(['_auxUserDimension']),
                        },
                    ],
                },
            ]);
        });
    });
});
