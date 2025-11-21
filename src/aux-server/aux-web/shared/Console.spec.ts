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
import type { SubscriptionLike } from 'rxjs';
import { messages } from './Console';
import type { ConsoleMessages } from '@casual-simulation/aux-common';

let logMock = (console.log = jest.fn());
let warnMock = (console.warn = jest.fn());
let errorMock = (console.error = jest.fn());

describe('Console', () => {
    describe('register()', () => {
        let sub: SubscriptionLike;
        let calls: ConsoleMessages[] = [];

        beforeAll(() => {
            sub = messages.subscribe((m) => {
                calls.push(m);
            });
        });

        afterAll(() => {
            sub.unsubscribe();
        });

        beforeEach(() => {
            calls = [];
        });

        const cases = [
            ['log', logMock] as const,
            ['warn', warnMock] as const,
            ['error', errorMock] as const,
        ];

        it.each(cases)(
            'should replace console.%s with a wrapper',
            (type, mock: jest.Mock<any>) => {
                const func: any = (<any>console)[type];
                func('abc');

                expect(calls).toEqual([
                    {
                        type: type,
                        messages: ['abc'],
                        stack: expect.any(String),
                        source: 'app',
                    },
                ]);
                expect(func).not.toBe(mock);
                expect(mock).toHaveBeenCalledWith('abc');
            }
        );
    });
});
