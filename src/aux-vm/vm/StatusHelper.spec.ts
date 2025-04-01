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
import { Subject } from 'rxjs';
import { StatusHelper } from './StatusHelper';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import type { StatusUpdate } from '@casual-simulation/aux-common';

describe('StatusHelper', () => {
    describe('progress', () => {
        it('should track progress per channel and report an average', async () => {
            let channel1 = new Subject<StatusUpdate>();
            let channel2 = new Subject<StatusUpdate>();

            const helper = new StatusHelper([channel1, channel2]);

            let updates: StatusUpdate[] = [];
            helper.updates.subscribe((update) => {
                updates.push(update);
            });

            channel1.next({
                type: 'progress',
                message: 'Test',
                progress: 0.2,
            });

            channel2.next({
                type: 'progress',
                message: 'Test 2',
                progress: 0.2,
            });

            await waitAsync();

            expect(updates).toEqual([
                {
                    type: 'progress',
                    message: 'Test',
                    done: false,
                    progress: 0.1,
                },
                {
                    type: 'progress',
                    message: 'Test 2',
                    done: false,
                    progress: 0.2,
                },
            ]);
        });

        it('should report progress errors', async () => {
            let channel1 = new Subject<StatusUpdate>();
            let channel2 = new Subject<StatusUpdate>();

            const helper = new StatusHelper([channel1, channel2]);

            let updates: StatusUpdate[] = [];
            helper.updates.subscribe((update) => {
                updates.push(update);
            });

            channel1.next({
                type: 'progress',
                message: 'Test',
                progress: 0.2,
            });

            channel2.next({
                type: 'progress',
                message: 'Test 2',
                error: true,
                progress: 0.2,
            });

            await waitAsync();

            expect(updates).toEqual([
                {
                    type: 'progress',
                    message: 'Test',
                    done: false,
                    progress: 0.1,
                },
                {
                    type: 'progress',
                    message: 'Test 2',
                    error: true,
                    done: false,
                    progress: 0.2,
                },
            ]);
        });

        it('should report done when all the channels are done', async () => {
            let channel1 = new Subject<StatusUpdate>();
            let channel2 = new Subject<StatusUpdate>();

            const helper = new StatusHelper([channel1, channel2]);

            let updates: StatusUpdate[] = [];
            helper.updates.subscribe((update) => {
                updates.push(update);
            });

            channel1.next({
                type: 'progress',
                message: 'Test',
                progress: 0.7,
                done: true,
            });

            channel2.next({
                type: 'progress',
                message: 'Test 2',
                progress: 0.2,
                done: true,
            });

            await waitAsync();

            expect(updates).toEqual([
                {
                    type: 'progress',
                    message: 'Test',
                    done: false,
                    progress: 0.5,
                },
                {
                    type: 'progress',
                    message: 'Test 2',
                    done: true,
                    progress: 1,
                },
            ]);
        });
    });

    describe('connection', () => {
        it('should track connection per channel and only report connected when all are connected', async () => {
            let channel1 = new Subject<StatusUpdate>();
            let channel2 = new Subject<StatusUpdate>();

            const helper = new StatusHelper([channel1, channel2]);

            let updates: StatusUpdate[] = [];
            helper.updates.subscribe((update) => {
                updates.push(update);
            });

            channel1.next({
                type: 'connection',
                connected: false,
            });

            channel2.next({
                type: 'connection',
                connected: true,
            });

            channel1.next({
                type: 'connection',
                connected: true,
            });

            await waitAsync();

            // Should merge multiple of the same result
            expect(updates).toEqual([
                {
                    type: 'connection',
                    connected: false,
                },
                {
                    type: 'connection',
                    connected: true,
                },
            ]);
        });
    });

    describe('sync', () => {
        it('should track sync per channel and only report synced when all are synced', async () => {
            let channel1 = new Subject<StatusUpdate>();
            let channel2 = new Subject<StatusUpdate>();

            const helper = new StatusHelper([channel1, channel2]);

            let updates: StatusUpdate[] = [];
            helper.updates.subscribe((update) => {
                updates.push(update);
            });

            channel1.next({
                type: 'sync',
                synced: false,
            });

            channel2.next({
                type: 'sync',
                synced: true,
            });

            channel1.next({
                type: 'sync',
                synced: true,
            });

            await waitAsync();

            // Should merge multiple of the same result
            expect(updates).toEqual([
                {
                    type: 'sync',
                    synced: false,
                },
                {
                    type: 'sync',
                    synced: true,
                },
            ]);
        });
    });

    describe('init', () => {
        it('should track init per channel and only report init when all are initialized', async () => {
            let channel1 = new Subject<StatusUpdate>();
            let channel2 = new Subject<StatusUpdate>();

            const helper = new StatusHelper([channel1, channel2]);

            let updates: StatusUpdate[] = [];
            helper.updates.subscribe((update) => {
                updates.push(update);
            });

            channel1.next({
                type: 'init',
            });

            await waitAsync();

            expect(updates).toEqual([]);

            channel2.next({
                type: 'init',
            });

            await waitAsync();

            // Should merge multiple of the same result
            expect(updates).toEqual([
                {
                    type: 'init',
                },
            ]);
        });
    });

    describe('message', () => {
        it('should send messages directly through', async () => {
            let channel1 = new Subject<StatusUpdate>();
            let channel2 = new Subject<StatusUpdate>();

            const helper = new StatusHelper([channel1, channel2]);

            let updates: StatusUpdate[] = [];
            helper.updates.subscribe((update) => {
                updates.push(update);
            });

            channel1.next({
                type: 'message',
                message: 'Test',
                source: 'abc',
            });

            await waitAsync();

            expect(updates).toEqual([
                {
                    type: 'message',
                    message: 'Test',
                    source: 'abc',
                },
            ]);

            channel2.next({
                type: 'message',
                message: 'Test 2',
                source: 'def',
            });

            await waitAsync();

            // Should merge multiple of the same result
            expect(updates).toEqual([
                {
                    type: 'message',
                    message: 'Test',
                    source: 'abc',
                },
                {
                    type: 'message',
                    message: 'Test 2',
                    source: 'def',
                },
            ]);
        });
    });

    describe('console', () => {
        const consoleMessageCases = [
            ['log'] as const,
            ['warn'] as const,
            ['error'] as const,
        ];

        it.each(consoleMessageCases)(
            'should send console %s messages directly through',
            async (type) => {
                let channel1 = new Subject<StatusUpdate>();
                let channel2 = new Subject<StatusUpdate>();

                const helper = new StatusHelper([channel1, channel2]);

                let updates: StatusUpdate[] = [];
                helper.updates.subscribe((update) => {
                    updates.push(update);
                });

                channel1.next({
                    type: type,
                    messages: ['Test'],
                    stack: 'Stack 1',
                    source: 'Source 1',
                });

                await waitAsync();

                expect(updates).toEqual([
                    {
                        type: type,
                        messages: ['Test'],
                        stack: 'Stack 1',
                        source: 'Source 1',
                    },
                ]);

                channel2.next({
                    type: type,
                    messages: ['Test 2'],
                    stack: 'Stack 2',
                    source: 'Source 2',
                });

                await waitAsync();

                // Should merge multiple of the same result
                expect(updates).toEqual([
                    {
                        type: type,
                        messages: ['Test'],
                        stack: 'Stack 1',
                        source: 'Source 1',
                    },
                    {
                        type: type,
                        messages: ['Test 2'],
                        stack: 'Stack 2',
                        source: 'Source 2',
                    },
                ]);
            }
        );
    });

    describe('authentication', () => {
        it('should only send authentication messages from the first channel', async () => {
            let channel1 = new Subject<StatusUpdate>();
            let channel2 = new Subject<StatusUpdate>();

            const helper = new StatusHelper([channel1, channel2]);

            let updates: StatusUpdate[] = [];
            helper.updates.subscribe((update) => {
                updates.push(update);
            });

            channel2.next({
                type: 'authentication',
                authenticated: false,
            });

            await waitAsync();

            expect(updates).toEqual([]);

            channel1.next({
                type: 'authentication',
                authenticated: true,
            });

            await waitAsync();

            // Should merge multiple of the same result
            expect(updates).toEqual([
                {
                    type: 'authentication',
                    authenticated: true,
                },
            ]);
        });
    });

    describe('authorization', () => {
        it('should only send authorization messages from the first channel', async () => {
            let channel1 = new Subject<StatusUpdate>();
            let channel2 = new Subject<StatusUpdate>();

            const helper = new StatusHelper([channel1, channel2]);

            let updates: StatusUpdate[] = [];
            helper.updates.subscribe((update) => {
                updates.push(update);
            });

            channel2.next({
                type: 'authorization',
                authorized: false,
            });

            await waitAsync();

            expect(updates).toEqual([]);

            channel1.next({
                type: 'authorization',
                authorized: true,
            });

            await waitAsync();

            // Should merge multiple of the same result
            expect(updates).toEqual([
                {
                    type: 'authorization',
                    authorized: true,
                },
            ]);
        });
    });
});
