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
import type { PrecalculatedBotsState } from '@casual-simulation/aux-common';
import {
    botAdded,
    createBot,
    botUpdated,
    createPrecalculatedBot,
    botRemoved,
    action,
    CREATE_ACTION_NAME,
    CREATE_ANY_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { BotHelper } from './BotHelper';

describe('BotHelper', () => {
    let userId = 'user';
    let helper: BotHelper;
    let vm: TestAuxVM;

    beforeEach(() => {
        vm = new TestAuxVM('id');
        helper = new BotHelper(vm);
    });

    describe('userBot', () => {
        it('should return the bot that has the same ID as the user ID', () => {
            const state: PrecalculatedBotsState = {
                user: createPrecalculatedBot('user', {}),
            };
            helper.botsState = state;

            const user = helper.userBot;

            expect(user).toBe(state.user);
        });
    });

    describe('createContext()', () => {
        it('should include the bots in the state', () => {
            helper.botsState = {
                abc: createPrecalculatedBot('abc', {}),
                def: createPrecalculatedBot('def', {}),
            };

            const context = helper.createContext();

            expect(context.objects).toEqual([
                helper.botsState['abc'],
                helper.botsState['def'],
            ]);
        });
    });

    describe('setEditingBot()', () => {
        it('should set the editingBot and editingTag tags on the user bot', async () => {
            helper.botsState = {
                user: createPrecalculatedBot('user'),
                test: createPrecalculatedBot('test'),
            };
            await helper.setEditingBot(helper.botsState['test'], 'abc');

            expect(vm.events).toEqual([
                botUpdated('user', {
                    tags: {
                        editingBot: '🔗test',
                        editingTag: 'abc',
                        editingTagSpace: null,
                        cursorStartIndex: null,
                        cursorEndIndex: null,
                    },
                }),
            ]);
        });
    });

    describe('createBot()', () => {
        it('should send onCreate() and onAnyCreate() shouts', async () => {
            await helper.createBot('abc', {
                def: 'ghi',
            });

            expect(vm.events).toEqual([
                botAdded(
                    createBot('abc', {
                        def: 'ghi',
                    })
                ),
                action(CREATE_ACTION_NAME, ['abc'], 'user'),
                action(CREATE_ANY_ACTION_NAME, null, 'user', {
                    bot: createBot('abc', {
                        def: 'ghi',
                    }),
                }),
            ]);
        });
    });

    describe('destroyBot()', () => {
        it('should destroy the given bot', async () => {
            helper.botsState = {
                user: createPrecalculatedBot('user'),
                bot1: createPrecalculatedBot('bot1'),
            };

            const result = await helper.destroyBot(helper.botsState['bot1']);

            expect(vm.events).toEqual([botRemoved('bot1')]);
            expect(result).toBe(true);
        });

        it('should destroy all children of the bot', async () => {
            helper.botsState = {
                user: createPrecalculatedBot('user'),
                bot1: createPrecalculatedBot('bot1'),
                bot2: createPrecalculatedBot('bot2', {
                    creator: 'bot1',
                }),
            };

            const result = await helper.destroyBot(helper.botsState['bot1']);

            expect(vm.events).toEqual([botRemoved('bot1'), botRemoved('bot2')]);
            expect(result).toBe(true);
        });

        it('should return false if the bot was not destroyed', async () => {
            helper.botsState = {
                user: createPrecalculatedBot('user'),
                bot1: createPrecalculatedBot('bot1', {
                    destroyable: false,
                }),
            };

            const result = await helper.destroyBot(helper.botsState['bot1']);

            expect(vm.events).toEqual([]);
            expect(result).toBe(false);
        });
    });

    describe('formulaBatch()', () => {
        it('should send the formulas to the vm', async () => {
            await helper.formulaBatch([
                'setTag(@abc(true).first(), "#test", 123)',
            ]);

            expect(vm.formulas).toEqual([
                'setTag(@abc(true).first(), "#test", 123)',
            ]);
        });
    });
});
