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
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { CodeLanguageManager } from './CodeLanguageManager';
import { createBot, botAdded } from '@casual-simulation/aux-common';

describe('CodeLanguageManager', () => {
    let vm: TestAuxVM;
    let subject: CodeLanguageManager;

    beforeEach(() => {
        vm = new TestAuxVM('sim', 'user');
        vm.processEvents = true;
        subject = new CodeLanguageManager(vm);
    });

    describe('getTags()', () => {
        it('should get the full list of tags', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        abc: 'test',
                        def: 'other',
                    })
                ),
                botAdded(
                    createBot('test2', {
                        '123': 456,
                        abc: 'haha',
                        ghi: 'final',
                    })
                ),
            ]);

            const tags = await subject.getTags();

            expect(tags).toEqual(['123', 'abc', 'def', 'ghi']);
        });
    });
});
