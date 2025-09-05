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
import {
    IDE_PORTAL,
    isPortalScript,
    isScript,
    isFormula,
    KNOWN_TAG_PREFIXES,
    getScriptPrefix,
    hasValue,
} from '@casual-simulation/aux-common';
import { sortBy } from 'es-toolkit/compat';

export type IdeNode = IdeFolderNode | IdeTagNode;

export interface IdeFolderNode {
    type: 'folder';
    name: string;
    key: string;
    children: IdeNode[];
}

export interface IdeTagNode {
    type: 'tag';
    botId: string;
    tag: string;
    key: string;
    name: string;

    prefix?: string;
    isScript?: boolean;
    isFormula?: boolean;
}

export interface IdePortalUpdate {
    hasPortal: boolean;
    items: IdeTagNode[];
}

/**
 * Defines a class that manages the bot panel.
 */
export class IdePortalManager implements SubscriptionLike {
    private _helper: BotHelper;
    private _watcher: BotWatcher;
    private _buffer: boolean;

    private _itemsUpdated: BehaviorSubject<IdePortalUpdate>;

    private _subs: SubscriptionLike[] = [];
    closed: boolean = false;

    /**
     * Gets an observable that resolves whenever the list of selected bots is updated.
     */
    get itemsUpdated(): Observable<IdePortalUpdate> {
        return this._itemsUpdated;
    }

    get items() {
        return this._itemsUpdated.value;
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
        this._itemsUpdated = new BehaviorSubject<IdePortalUpdate>({
            hasPortal: false,
            items: [],
        });

        this._subs.push(
            this._calculateItemsUpdated().subscribe(this._itemsUpdated)
        );
    }

    unsubscribe(): void {
        if (!this.closed) {
            this.closed = true;
            this._subs.forEach((s) => s.unsubscribe());
            this._subs = null;
        }
    }

    private _findMatchingItems(): IdePortalUpdate {
        if (!this._helper.userBot) {
            return {
                hasPortal: false,
                items: [],
            };
        }
        const portalValue = this._helper.userBot.tags[IDE_PORTAL];
        if (portalValue) {
            let items = [] as IdeTagNode[];
            for (let bot of this._helper.objects) {
                if (bot.id === this._helper.userId) {
                    continue;
                }
                for (let tag in bot.values) {
                    const val = bot.tags[tag];
                    if (
                        portalValue === true ||
                        portalValue === 'true' ||
                        isPortalScript(portalValue, bot.tags[tag])
                    ) {
                        let item: IdeTagNode = {
                            type: 'tag',
                            botId: bot.id,
                            tag: tag,
                            name: tag,
                            key: `${tag}.${bot.id}`,
                        };

                        let prefix = getScriptPrefix(KNOWN_TAG_PREFIXES, val);
                        if (hasValue(prefix)) {
                            item.prefix = prefix;
                        }

                        if (isScript(val)) {
                            item.isScript = true;
                        } else if (isFormula(val)) {
                            item.isFormula = true;
                        }

                        items.push(item);
                    }
                }
            }
            return {
                hasPortal: true,
                items: sortBy(items, (item) => item.key),
            };
        }

        return {
            hasPortal: false,
            items: [],
        };
    }

    private _calculateItemsUpdated(): Observable<IdePortalUpdate> {
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
                const items = this._findMatchingItems();
                return items;
            })
        );
    }
}
