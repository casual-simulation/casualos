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
import { ProgressManager } from './ProgressManager';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import {
    GRID_PORTAL,
    type BotAction,
    type ProgressMessage,
} from '@casual-simulation/aux-common';
import { Subject } from 'rxjs';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';

describe('ProgressManager', () => {
    let subject: ProgressManager;
    let vm: TestAuxVM;
    let onPortalLoaded: Subject<string>;
    let localEvents: Subject<BotAction[]>;

    beforeEach(() => {
        vm = new TestAuxVM('sim', 'user');
        onPortalLoaded = new Subject<string>();
        localEvents = vm.localEvents = new Subject<BotAction[]>();
        subject = new ProgressManager(vm, onPortalLoaded);
    });

    it('should return the most recent progress message', () => {
        vm.connectionStateChanged.next({
            type: 'progress',
            progress: 0.5,
            message: 'def',
        });

        let messages: ProgressMessage[] = [];
        subject.updates.subscribe((m) => messages.push(m));

        expect(messages).toEqual([
            {
                type: 'progress',
                progress: 0.5,
                message: 'def',
                done: false,
            },
        ]);
    });

    it('should emit a done progress event when the gridPortal is loaded', async () => {
        let messages: ProgressMessage[] = [];
        subject.updates.subscribe((m) => messages.push(m));

        vm.connectionStateChanged.next({
            type: 'progress',
            progress: 0.5,
            message: 'def',
        });

        onPortalLoaded.next(GRID_PORTAL);

        await waitAsync();

        expect(messages).toEqual([
            {
                type: 'progress',
                progress: 0,
                message: 'Starting...',
            },
            {
                type: 'progress',
                progress: 0.5,
                message: 'def',
                done: false,
            },
            {
                type: 'progress',
                progress: 1,
                message: 'Done.',
                done: true,
            },
        ]);
    });

    it('should not emit a done progress event when the menuPortal portal is loaded', async () => {
        let messages: ProgressMessage[] = [];
        subject.updates.subscribe((m) => messages.push(m));

        vm.connectionStateChanged.next({
            type: 'progress',
            progress: 0.5,
            message: 'def',
        });

        onPortalLoaded.next('menuPortal');

        await waitAsync();

        expect(messages).toEqual([
            {
                type: 'progress',
                progress: 0,
                message: 'Starting...',
            },
            {
                type: 'progress',
                progress: 0.5,
                message: 'def',
                done: false,
            },
        ]);
    });

    it('should emit a done progress event when a hide_loading_screen event is received', async () => {
        let messages: ProgressMessage[] = [];
        subject.updates.subscribe((m) => messages.push(m));

        vm.connectionStateChanged.next({
            type: 'progress',
            progress: 0.5,
            message: 'def',
        });

        vm.localEvents.next([
            {
                type: 'hide_loading_screen',
                taskId: 'task1',
            },
        ]);

        await waitAsync();

        expect(messages).toEqual([
            {
                type: 'progress',
                progress: 0,
                message: 'Starting...',
            },
            {
                type: 'progress',
                progress: 0.5,
                message: 'def',
                done: false,
            },
            {
                type: 'progress',
                progress: 1,
                message: 'Done.',
                done: true,
            },
        ]);
    });

    it('should not emit a done progress event when initialized', () => {
        let messages: ProgressMessage[] = [];
        subject.updates.subscribe((m) => messages.push(m));

        vm.connectionStateChanged.next({
            type: 'init',
        });

        expect(messages).toEqual([
            {
                type: 'progress',
                progress: 0,
                message: 'Starting...',
            },
        ]);
    });

    it('should emit a done progress event when not authenticated', () => {
        let messages: ProgressMessage[] = [];
        subject.updates.subscribe((m) => messages.push(m));

        vm.connectionStateChanged.next({
            type: 'authentication',
            authenticated: false,
            reason: 'invalid_token',
        });

        expect(messages).toEqual([
            {
                type: 'progress',
                progress: 0,
                message: 'Starting...',
            },
            {
                type: 'progress',
                progress: 1,
                message: 'You are not authenticated.',
                done: true,
            },
        ]);
    });

    it('should emit an error progress event when not authorized', async () => {
        let messages: ProgressMessage[] = [];
        let completed: boolean = false;
        subject.updates.subscribe({
            next: (m) => messages.push(m),
            complete: () => (completed = true),
        });

        vm.connectionStateChanged.next({
            type: 'authorization',
            authorized: false,
        });

        await waitAsync();

        expect(messages).toEqual([
            {
                type: 'progress',
                progress: 0,
                message: 'Starting...',
            },
            {
                type: 'progress',
                progress: 1,
                message: 'You are not authorized.',
                error: true,
            },
        ]);
        expect(completed).toBe(true);
    });
});
