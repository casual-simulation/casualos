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
import type { Observable, SubscriptionLike } from 'rxjs';
import { BehaviorSubject, merge } from 'rxjs';
import { mergeMap, bufferTime } from 'rxjs/operators';
import type { BotHelper, BotWatcher } from '@casual-simulation/aux-vm';
import type { PrecalculatedBot } from '@casual-simulation/aux-common';
import {
    filterBotsBySelection,
    SHEET_PORTAL,
} from '@casual-simulation/aux-common';

/**
 * Defines a class that manages the bot panel.
 */
export class BotPanelManager implements SubscriptionLike {
    private _helper: BotHelper;
    private _watcher: BotWatcher;
    private _buffer: boolean;

    private _botsUpdated: BehaviorSubject<BotsUpdatedEvent>;

    private _subs: SubscriptionLike[] = [];
    closed: boolean = false;

    get state() {
        return this._botsUpdated.value;
    }

    /**
     * Gets an observable that resolves whenever the list of selected bots is updated.
     */
    get botsUpdated(): Observable<BotsUpdatedEvent> {
        return this._botsUpdated;
    }

    /**
     * Creates a new bot panel manager.
     * @param watcher The bot watcher to use.
     * @param helper The bot helper to use.
     * @param bufferEvents Whether to buffer the update events.
     */
    constructor(
        watcher: BotWatcher,
        helper: BotHelper,
        bufferEvents: boolean = true
    ) {
        this._watcher = watcher;
        this._helper = helper;
        this._buffer = bufferEvents;
        this._botsUpdated = new BehaviorSubject<BotsUpdatedEvent>({
            bots: [],
            isDiff: false,
            hasPortal: false,
            dimension: null,
            isSingleBot: false,
        });

        this._subs.push(
            this._calculateBotsUpdated().subscribe(this._botsUpdated)
        );
    }

    unsubscribe(): void {
        if (!this.closed) {
            this.closed = true;
            this._subs.forEach((s) => s.unsubscribe());
            this._subs = null;
        }
    }

    private _calculateBotsUpdated(): Observable<BotsUpdatedEvent> {
        const allBotsSelectedUpdatedAddedAndRemoved = merge(
            this._watcher.botsDiscovered,
            this._watcher.botsUpdated,
            this._watcher.botsRemoved
        );
        const bufferedEvents: Observable<any> = this._buffer
            ? allBotsSelectedUpdatedAddedAndRemoved.pipe(bufferTime(10))
            : allBotsSelectedUpdatedAddedAndRemoved;
        return bufferedEvents.pipe(
            mergeMap(async () => {
                if (this._helper.userBot) {
                    const dimension = this._helper.userBot.values[SHEET_PORTAL];
                    if (!!dimension && dimension !== true) {
                        const bots = filterBotsBySelection(
                            this._helper.objects,
                            dimension
                        );
                        const singleBot =
                            bots.length === 1 && bots[0].id === dimension;
                        return {
                            bots: bots,
                            hasPortal: true,
                            dimension: dimension,
                            isDiff: false,
                            isSingleBot: singleBot,
                        };
                    } else if (dimension === true) {
                        return {
                            bots: this._helper.objects,
                            hasPortal: true,
                            dimension: null,
                            isDiff: false,
                            isSingleBot: false,
                        };
                    }
                }
                return {
                    bots: [],
                    hasPortal: false,
                    dimension: null,
                    isDiff: false,
                    isSingleBot: false,
                };
            })
        );
    }
}

export interface BotsUpdatedEvent {
    bots: PrecalculatedBot[];
    dimension: string;
    hasPortal: boolean;
    isDiff: boolean;
    isSingleBot: boolean;
}
