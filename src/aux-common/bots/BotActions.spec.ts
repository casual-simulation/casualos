/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { ApplyStateAction } from './BotEvents';
import { goToDimension, botAdded, botRemoved, botUpdated } from './BotEvents';
import { v4 as uuid } from 'uuid';
import type { BotsState } from './Bot';
import { createBot } from './BotCalculations';
import { breakIntoIndividualEvents } from './BotActions';

const uuidMock: jest.Mock = <any>uuid;
jest.mock('uuid');

console.error = jest.fn();

describe('BotActions', () => {
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
