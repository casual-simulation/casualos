import {
    goToDimension,
    ApplyStateAction,
    botAdded,
    botRemoved,
    botUpdated,
} from './BotEvents';
import uuid from 'uuid/v4';
import { botActionsTests } from './test/BotActionsTests';
import { BotsState } from './Bot';
import { createBot } from './BotCalculations';
import { breakIntoIndividualEvents } from './BotActions';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid/v4');

console.error = jest.fn();

describe('BotActions', () => {
    botActionsTests(uuidMock);

    describe('goToDimension()', () => {
        it('should use the first parameter as the dimension if only one argument is provided', () => {
            const event = goToDimension('dimension');

            expect(event).toEqual({
                type: 'go_to_dimension',
                dimension: 'dimension',
            });
        });

        it('should ignore all other parameters', () => {
            const event = (<any>goToDimension)('dimension', 'abc');

            expect(event).toEqual({
                type: 'go_to_dimension',
                dimension: 'dimension',
            });
        });
    });

    describe('breakIntoIndividualEvents()', () => {
        it('should return an add bot event for new bots', () => {
            const current: BotsState = {
                other: createBot('other', {
                    num: 123,
                }),
            };

            const a: ApplyStateAction = {
                type: 'apply_state',
                state: {
                    new: createBot('new', {
                        abc: 'def',
                    }),
                },
            };

            const events = breakIntoIndividualEvents(current, a);

            expect(events).toEqual([
                botAdded(
                    createBot('new', {
                        abc: 'def',
                    })
                ),
            ]);
        });

        it('should return a remove bot event for deleted bots', () => {
            const current: BotsState = {
                other: createBot('other', {
                    num: 123,
                }),
            };

            const a: ApplyStateAction = {
                type: 'apply_state',
                state: {
                    other: null,
                },
            };

            const events = breakIntoIndividualEvents(current, a);

            expect(events).toEqual([botRemoved('other')]);
        });

        it('should return a update bot event for updated bots', () => {
            const current: BotsState = {
                other: createBot('other', {
                    num: 123,
                }),
            };

            const a: ApplyStateAction = {
                type: 'apply_state',
                state: <any>{
                    other: {
                        tags: {
                            num: 456,
                        },
                    },
                },
            };

            const events = breakIntoIndividualEvents(current, a);

            expect(events).toEqual([
                botUpdated('other', {
                    tags: {
                        num: 456,
                    },
                }),
            ]);
        });
    });
});
