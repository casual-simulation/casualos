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
import type {
    Bot,
    BotTags,
    SystemPortalPane,
} from '@casual-simulation/aux-common';
import {
    calculateStringTagValue,
    getBotTag,
    hasValue,
    SYSTEM_PORTAL,
    SYSTEM_PORTAL_BOT,
    SYSTEM_TAG,
    getTagMask,
    calculateBooleanTagValue,
    EDITING_BOT,
    EDITING_TAG,
    getShortId,
    isScript,
    EDITING_TAG_SPACE,
    getTagValueForSpace,
    parseNewTag,
    DNA_TAG_PREFIX,
    isFormula,
    SYSTEM_PORTAL_TAG,
    SYSTEM_PORTAL_TAG_SPACE,
    isBotLink,
    calculateBotIdTagValue,
    SYSTEM_PORTAL_SEARCH,
    parseScript,
    parseFormula,
    formatValue,
    BOT_LINK_TAG_PREFIX,
    getScriptPrefix,
    SYSTEM_TAG_NAME,
    calculateFormattedBotValue,
    SYSTEM_PORTAL_DIFF,
    SYSTEM_PORTAL_DIFF_BOT,
    SYSTEM_PORTAL_DIFF_TAG,
    SYSTEM_PORTAL_DIFF_TAG_SPACE,
    getOpenSystemPortalPane,
    isModule,
    parseModule,
} from '@casual-simulation/aux-common';
import type { SimulationManager } from '@casual-simulation/aux-vm';

import { isEqual, sortBy, union, unionBy } from 'es-toolkit/compat';
import type { Observer, SubscriptionLike } from 'rxjs';
import {
    BehaviorSubject,
    combineLatest,
    merge,
    Observable,
    Subscription,
} from 'rxjs';
import {
    bufferTime,
    distinctUntilChanged,
    filter,
    mergeMap,
    map,
    scan,
    startWith,
    switchMap,
    takeUntil,
} from 'rxjs/operators';
import type { BrowserSimulation } from './BrowserSimulation';

/**
 * The number of tags that should be processed per time that the search buffer is updated.
 */
const TAGS_PER_SEARCH_UPDATE = 10;
/**
 * The number of miliseconds that should be waited between search updates.
 */
const SEARCH_UPDATE_WAIT_INTERVAL = 100;

/**
 * Defines a class that is able to manage the state of the system portal.
 */
export class SystemPortalCoordinator<TSim extends BrowserSimulation>
    implements SubscriptionLike
{
    private _sub = new Subscription();
    private _simulationManager: SimulationManager<TSim>;

    private _itemsUpdated: BehaviorSubject<SystemPortalUpdate>;
    private _selectionUpdated: BehaviorSubject<SystemPortalSelectionUpdate>;
    private _recentsUpdated: BehaviorSubject<SystemPortalRecentsUpdate>;
    private _searchUpdated: BehaviorSubject<SystemPortalSearchUpdate>;
    private _diffUpdated: BehaviorSubject<SystemPortalDiffUpdate>;
    private _diffSelectionUpdated: BehaviorSubject<SystemPortalDiffSelectionUpdate>;
    private _systemPortalPaneUpdated: BehaviorSubject<SystemPortalPane>;
    private _buffer: boolean;
    private _recentTags: SystemPortalRecentTag[] = [];
    private _recentTagsListSize: number = 10;
    private _tagSortMode: TagSortMode = 'scripts-first';
    private _extraTags: string[] = [];
    // private _portals: PortalManager;

    get tagSortMode(): TagSortMode {
        return this._tagSortMode;
    }

    set tagSortMode(mode: TagSortMode) {
        this._tagSortMode = mode;
        const result = this._findSelection(this._itemsUpdated.value);
        if (!isEqual(result, this._selectionUpdated.value)) {
            this._selectionUpdated.next(result);
        }
    }

    get items() {
        return this._itemsUpdated.value;
    }

    unsubscribe(): void {
        return this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }

    get onItemsUpdated(): Observable<SystemPortalUpdate> {
        return this._itemsUpdated;
    }

    get onSelectionUpdated(): Observable<SystemPortalSelectionUpdate> {
        return this._selectionUpdated;
    }

    get onRecentsUpdated(): Observable<SystemPortalRecentsUpdate> {
        return this._recentsUpdated;
    }

    get onSearchResultsUpdated(): Observable<SystemPortalSearchUpdate> {
        return this._searchUpdated;
    }

    get onDiffUpdated(): Observable<SystemPortalDiffUpdate> {
        return this._diffUpdated;
    }

    get onDiffSelectionUpdated(): Observable<SystemPortalDiffSelectionUpdate> {
        return this._diffSelectionUpdated;
    }

    get onSystemPortalPaneUpdated(): Observable<SystemPortalPane> {
        return this._systemPortalPaneUpdated;
    }

    /**
     * Creates a new system portal coorindator.
     * @param simulationManager The simulation manager that should be used.
     * @param bufferEvents Whether to buffer the update events.
     */
    constructor(
        simulationManager: SimulationManager<TSim>,
        bufferEvents: boolean = true
    ) {
        this._simulationManager = simulationManager;
        this._buffer = bufferEvents;

        // this._watcher = watcher;
        // this._helper = helper;
        // this._portals = portals;
        this._itemsUpdated = new BehaviorSubject<SystemPortalUpdate>({
            hasPortal: false,
        });
        this._selectionUpdated =
            new BehaviorSubject<SystemPortalSelectionUpdate>({
                hasSelection: false,
            });
        this._recentsUpdated = new BehaviorSubject<SystemPortalRecentsUpdate>({
            hasRecents: false,
        });
        this._searchUpdated = new BehaviorSubject<SystemPortalSearchUpdate>({
            numMatches: 0,
            numBots: 0,
            items: [],
        });
        this._diffUpdated = new BehaviorSubject<SystemPortalDiffUpdate>({
            hasPortal: false,
        });
        this._diffSelectionUpdated =
            new BehaviorSubject<SystemPortalDiffSelectionUpdate>({
                hasSelection: false,
            });
        this._systemPortalPaneUpdated = new BehaviorSubject<SystemPortalPane>(
            null
        );

        const itemsUpdated = this._calculateItemsUpdated();
        const itemsUpdatedDistinct = itemsUpdated.pipe(
            distinctUntilChanged((x, y) => isEqual(x, y))
        );

        const selectionUpdated =
            this._calculateSelectionUpdated(itemsUpdatedDistinct);

        const diffUpdated = this._calculateDiffUpdated(itemsUpdated);
        const diffSelectionUpdated =
            this._calculateDiffSelectionUpdated(diffUpdated);
        const paneUpdated = this._calculateSystemPortalPaneUpdated();

        this._sub.add(itemsUpdatedDistinct.subscribe(this._itemsUpdated));
        this._sub.add(selectionUpdated.subscribe(this._selectionUpdated));
        this._sub.add(
            this._calculateRecentsUpdated().subscribe(this._recentsUpdated)
        );
        this._sub.add(
            this._calculateSearchResults().subscribe(this._searchUpdated)
        );
        this._sub.add(diffUpdated.subscribe(this._diffUpdated));
        this._sub.add(
            diffSelectionUpdated.subscribe(this._diffSelectionUpdated)
        );
        this._sub.add(paneUpdated.subscribe(this._systemPortalPaneUpdated));
    }

    async addTag(tag: string) {
        const parsed = parseNewTag(tag);

        const primarySim = this._simulationManager.primary;
        const helper = primarySim.helper;

        const selectedBotId = calculateBotIdTagValue(
            helper.userBot,
            SYSTEM_PORTAL_BOT,
            null
        );
        const selectedBot = selectedBotId
            ? helper.botsState[selectedBotId]
            : null;
        if ((parsed.isScript || parsed.isFormula) && selectedBot) {
            if (!hasValue(selectedBot.tags[parsed.name])) {
                await helper.updateBot(selectedBot, {
                    tags: {
                        [parsed.name]: parsed.isScript
                            ? '@'
                            : parsed.isFormula
                            ? DNA_TAG_PREFIX
                            : '',
                    },
                });
            }
        }

        this._updateSelection(undefined, [parsed.name]);
    }

    /**
     * Adds the given tag as a pinned tag.
     * Pinned tags are a separate list of tags that are persisted across multiple selections.
     * @param tag The name of the tag to pin.
     */
    async addPinnedTag(tag: string) {
        const parsed = parseNewTag(tag);
        if (this._extraTags.includes(parsed.name)) {
            return;
        }

        const primarySim = this._simulationManager.primary;
        const helper = primarySim.helper;

        const selectedBotId = calculateBotIdTagValue(
            helper.userBot,
            SYSTEM_PORTAL_BOT,
            null
        );
        const selectedBot = selectedBotId
            ? helper.botsState[selectedBotId]
            : null;
        if ((parsed.isScript || parsed.isFormula) && selectedBot) {
            if (!hasValue(selectedBot.tags[parsed.name])) {
                await helper.updateBot(selectedBot, {
                    tags: {
                        [parsed.name]: parsed.isScript
                            ? '@'
                            : parsed.isFormula
                            ? DNA_TAG_PREFIX
                            : '',
                    },
                });
            }
        }

        this._updateSelection([parsed.name]);
    }

    removePinnedTag(tag: SystemPortalSelectionTag) {
        const index = this._extraTags.findIndex((t) => t === tag.name);

        if (index >= 0) {
            this._extraTags.splice(index, 1);
        }

        this._updateSelection();
    }

    private _updateSelection(extraTags?: string[], addedTags?: string[]) {
        const update = this._findSelection(
            this._itemsUpdated.value,
            extraTags,
            addedTags
        );

        if (!isEqual(update, this._selectionUpdated.value)) {
            this._selectionUpdated.next(update);
        }
    }

    private _calculateItemsUpdated(): Observable<SystemPortalUpdate> {
        const allBotsUpdatedAddedAndRemoved =
            this._simulationManager.simulationAdded.pipe(
                mergeMap((sim) => {
                    return merge(
                        sim.watcher.botsDiscovered,
                        sim.watcher.botsUpdated,
                        sim.watcher.botsRemoved
                    ).pipe(
                        takeUntil(
                            this._simulationManager.simulationRemoved.pipe(
                                filter((s) => s.id === sim.id)
                            )
                        )
                    );
                })
            );

        const bufferedEvents: Observable<any> = this._buffer
            ? allBotsUpdatedAddedAndRemoved.pipe(bufferTime(10))
            : allBotsUpdatedAddedAndRemoved;

        return bufferedEvents.pipe(map(() => this._findMatchingItems()));
    }

    private _findMatchingItems(): SystemPortalUpdate {
        let items = [] as SystemPortalItem[];
        let hasPortal = false;
        let selectedBot: string = null;
        let selectedBotSimulationId: string = null;

        for (let [id, sim] of this._simulationManager.simulations) {
            const helper = sim.helper;
            if (!helper.userBot) {
                continue;
            }

            const systemTag = calculateStringTagValue(
                null,
                helper.userBot,
                SYSTEM_TAG_NAME,
                SYSTEM_TAG
            );
            const systemPortal = calculateStringTagValue(
                null,
                helper.userBot,
                SYSTEM_PORTAL,
                null
            );
            const showAllSystemBots = calculateBooleanTagValue(
                null,
                helper.userBot,
                SYSTEM_PORTAL,
                false
            );

            if (showAllSystemBots || hasValue(systemPortal)) {
                if (!hasValue(selectedBot)) {
                    selectedBot = calculateBotIdTagValue(
                        helper.userBot,
                        SYSTEM_PORTAL_BOT,
                        null
                    );
                    if (hasValue(selectedBot)) {
                        selectedBotSimulationId = sim.id;
                    }
                }
                let areaItems = [] as SystemPortalArea[];
                let areas = new Map<string, SystemPortalArea>();
                for (let bot of helper.objects) {
                    if (bot.id === helper.userId) {
                        continue;
                    }

                    const system = calculateFormattedBotValue(
                        null,
                        bot,
                        systemTag
                    );

                    if (
                        bot.id === selectedBot ||
                        (hasValue(system) &&
                            (showAllSystemBots ||
                                system.includes(systemPortal)))
                    ) {
                        const area = getSystemArea(system);
                        const title = getBotTitle(system, area);

                        let item = areas.get(area);
                        if (!item) {
                            item = {
                                area,
                                bots: [],
                            };
                            areaItems.push(item);
                            areas.set(area, item);
                        }

                        item.bots.push({
                            bot,
                            title,
                            system,
                        });
                    }
                }

                for (let item of areaItems) {
                    item.bots = sortBy(item.bots, (b) => b.title);
                }

                areaItems = sortBy(areaItems, (i) => i.area);
                hasPortal = true;

                if (areaItems.length > 0) {
                    items.push({
                        simulationId: sim.id,
                        areas: areaItems,
                    });
                }
            }
        }

        if (hasPortal) {
            return {
                hasPortal: true,
                items,
                selectedBot,
                selectedBotSimulationId,
            };
        } else {
            return {
                hasPortal: false,
            };
        }
    }

    private _calculateSelectionUpdated(
        itemsUpdated: Observable<SystemPortalUpdate>
    ): Observable<SystemPortalSelectionUpdate> {
        return combineLatest([
            itemsUpdated,
            this._simulationManager.simulationAdded.pipe(
                mergeMap((sim) =>
                    sim.watcher.botTagsChanged(sim.helper.userId).pipe(
                        filter(
                            (change) =>
                                change.tags.has(SYSTEM_PORTAL_TAG) ||
                                change.tags.has(SYSTEM_PORTAL_TAG_SPACE)
                        ),
                        startWith(1),
                        takeUntil(
                            this._simulationManager.simulationRemoved.pipe(
                                filter((s) => s.id === sim.id)
                            )
                        )
                    )
                )
            ),
        ]).pipe(
            map(([update, _]) => update),
            map((update) => this._findSelection(update)),
            distinctUntilChanged((first, second) => isEqual(first, second))
        );
    }

    private _findSelection(
        update: SystemPortalUpdate,
        tagsToPin?: string[],
        tagsToAdd?: string[]
    ): SystemPortalSelectionUpdate {
        if (
            !update.hasPortal ||
            !update.selectedBot ||
            !update.selectedBotSimulationId
        ) {
            return {
                hasSelection: false,
            };
        }

        const sim = this._simulationManager.simulations.get(
            update.selectedBotSimulationId
        );
        if (!sim) {
            return {
                hasSelection: false,
            };
        }

        const helper = sim.helper;

        const bot = helper.botsState[update.selectedBot];
        if (!bot) {
            return {
                hasSelection: false,
            };
        }

        const selectedTag = calculateStringTagValue(
            null,
            helper.userBot,
            SYSTEM_PORTAL_TAG,
            null
        );
        const selectedSpace = calculateStringTagValue(
            null,
            helper.userBot,
            SYSTEM_PORTAL_TAG_SPACE,
            null
        );

        let normalTags = Object.keys(bot.tags).map((t) =>
            createSelectionTag(bot, t)
        );

        let maskTags = [] as SystemPortalSelectionTag[];
        for (let space in bot.masks) {
            const tags = Object.keys(bot.masks[space]);

            maskTags.push(
                ...tags.map((t) => createSelectionTag(bot, t, space))
            );
        }

        if (hasValue(selectedTag)) {
            if (hasValue(selectedSpace)) {
                maskTags.push(
                    createSelectionTag(bot, selectedTag, selectedSpace)
                );
            } else {
                maskTags.push(createSelectionTag(bot, selectedTag));
            }
        }

        let addedTags = [] as SystemPortalSelectionTag[];
        if (hasValue(tagsToAdd)) {
            addedTags.push(
                ...tagsToAdd.map((t, i) => ({
                    ...createSelectionTag(bot, t),
                    focusValue: i === 0,
                }))
            );
        }

        const sortMode = this.tagSortMode;
        const inputTags = unionBy(
            [...addedTags, ...normalTags, ...maskTags],
            (t) => `${t.name}.${t.space}`
        );
        const tags = sortTags(inputTags);

        let ret: SystemPortalHasSelectionUpdate = {
            hasSelection: true,
            sortMode,
            bot,
            tags,
            simulationId: sim.id,
        };

        let pinnedTags = [] as SystemPortalSelectionTag[];

        if (hasValue(tagsToPin)) {
            pinnedTags.push(
                ...tagsToPin.map((t, i) => ({
                    ...createSelectionTag(bot, t),
                    focusValue: i === 0,
                }))
            );
        }

        pinnedTags.push(
            ...this._extraTags.map((t) => createSelectionTag(bot, t))
        );
        if (hasValue(tagsToPin)) {
            this._extraTags.push(...tagsToPin);
        }
        pinnedTags = sortTags(pinnedTags);

        if (pinnedTags.length > 0) {
            ret.pinnedTags = pinnedTags;
        }

        if (hasValue(selectedTag)) {
            ret.tag = selectedTag;
            ret.space = selectedSpace;
        }

        return ret;

        function createSelectionTag(
            bot: Bot,
            tag: string,
            space?: string
        ): SystemPortalSelectionTag {
            let selectionTag: SystemPortalSelectionTag = {
                name: tag,
            };

            const tagValue = !hasValue(space)
                ? getBotTag(bot, tag)
                : getTagMask(bot, space, tag);
            if (isScript(tagValue)) {
                selectionTag.isScript = true;
            }

            if (isFormula(tagValue)) {
                selectionTag.isFormula = true;
            }

            if (isBotLink(tagValue)) {
                selectionTag.isLink = true;
            }

            if (hasValue(space)) {
                selectionTag.space = space;
            }

            const prefix = sim.portals.getScriptPrefix(tagValue);

            if (hasValue(prefix)) {
                selectionTag.prefix = prefix;
            }

            return selectionTag;
        }

        function sortTags(
            input: SystemPortalSelectionTag[]
        ): SystemPortalSelectionTag[] {
            return sortMode === 'scripts-first'
                ? sortBy(
                      input,
                      (t) => !t.isScript,
                      (t) => t.name
                  )
                : sortBy(input, (t) => t.name);
        }
    }

    private _calculateRecentsUpdated(): Observable<SystemPortalRecentsUpdate> {
        const changes = this._simulationManager.simulationAdded.pipe(
            mergeMap((sim) =>
                sim.watcher.botTagsChanged(sim.helper.userId).pipe(
                    filter(
                        (c) =>
                            c.tags.has(EDITING_BOT) || c.tags.has(EDITING_TAG)
                    ),
                    takeUntil(
                        this._simulationManager.simulationRemoved.pipe(
                            filter((s) => s.id === sim.id)
                        )
                    )
                )
            )
        );

        return changes.pipe(map(() => this._updateRecentsList()));
    }

    private _updateRecentsList(): SystemPortalRecentsUpdate {
        let hasNewBot = false;
        let hasNewTag = false;
        let newRecentTags = [] as SystemPortalRecentTag[][];

        for (let [id, sim] of this._simulationManager.simulations) {
            const helper = sim.helper;

            const newBotId = calculateBotIdTagValue(
                helper.userBot,
                EDITING_BOT,
                null
            );
            const newTag = calculateStringTagValue(
                null,
                helper.userBot,
                EDITING_TAG,
                null
            );
            const newSpace = calculateStringTagValue(
                null,
                helper.userBot,
                EDITING_TAG_SPACE,
                null
            );
            const systemTag = calculateStringTagValue(
                null,
                helper.userBot,
                SYSTEM_TAG_NAME,
                SYSTEM_TAG
            );

            if (!newBotId || !newTag) {
                continue;
            }

            const newBot = helper.botsState[newBotId];

            if (!newBot || !newTag) {
                continue;
            }

            if (newBot) {
                hasNewBot = true;
            }

            if (newTag) {
                hasNewTag = true;
            }

            const recentTagsCounts = new Map<string, number>();

            recentTagsCounts.set(`${newTag}.${newSpace}`, 1);

            for (let tag of this._recentTags) {
                if (tag.simulationId !== sim.id) {
                    continue;
                }
                if (
                    tag.botId === newBot.id &&
                    tag.tag === newTag &&
                    tag.space === newSpace
                ) {
                    continue;
                }
                const key = `${tag.tag}.${tag.space}`;
                recentTagsCounts.set(key, (recentTagsCounts.get(key) ?? 0) + 1);
            }

            let newTags = [] as SystemPortalRecentTag[];

            newTags.push({
                ...getTagPrefix(
                    sim,
                    systemTag,
                    recentTagsCounts,
                    newTag,
                    newBot,
                    newSpace
                ),
                botId: newBot.id,
                tag: newTag,
                space: newSpace,
                simulationId: sim.id,
            });

            for (let recent of this._recentTags) {
                if (recent.simulationId !== sim.id) {
                    continue;
                }
                if (
                    recent.tag === newTag &&
                    recent.botId === newBot.id &&
                    recent.space === newSpace
                ) {
                    continue;
                } else if (newTags.length < this._recentTagsListSize) {
                    const recentBot = helper.botsState[recent.botId];

                    if (!recentBot) {
                        continue;
                    }

                    newTags.push({
                        ...getTagPrefix(
                            sim,
                            systemTag,
                            recentTagsCounts,
                            recent.tag,
                            recentBot,
                            recent.space
                        ),
                        tag: recent.tag,
                        botId: recent.botId,
                        space: recent.space,
                        simulationId: sim.id,
                    });
                } else {
                    break;
                }
            }

            newRecentTags.push(newTags);
        }

        if (!hasNewBot || !hasNewTag) {
            return this._recentsUpdated.value;
        }

        this._recentTags = newRecentTags.flatMap((t) => t);
        if (this._recentTags.length > 0) {
            return {
                hasRecents: true,
                recentTags: this._recentTags,
            };
        }

        return {
            hasRecents: false,
        };

        function getTagPrefix(
            sim: BrowserSimulation,
            systemTag: string,
            recentTagsCounts: Map<string, number>,
            tag: string,
            bot: Bot,
            space: string | null
        ): Pick<
            SystemPortalRecentTag,
            'hint' | 'isScript' | 'isFormula' | 'isLink' | 'system' | 'prefix'
        > {
            const tagValue = getTagValueForSpace(bot, tag, space);
            const isTagScript = isScript(tagValue);
            const isTagFormula = isFormula(tagValue);
            const isTagLink = isBotLink(tagValue);
            const tagPrefix = sim.portals.getScriptPrefix(tagValue);
            const system = calculateFormattedBotValue(null, bot, systemTag);

            let ret: Pick<
                SystemPortalRecentTag,
                'isScript' | 'isFormula' | 'isLink' | 'system' | 'prefix'
            > = {
                system,
                isScript: isTagScript,
                isFormula: isTagFormula,
                isLink: isTagLink,
            };

            if (hasValue(tagPrefix)) {
                ret.prefix = tagPrefix;
            }

            const area = getSystemArea(system);
            const prefix =
                hasValue(system) && hasValue(area)
                    ? system.substring(area.length + 1)
                    : null;
            return {
                hint: prefix ?? getShortId(bot),
                ...ret,
            };
        }
    }

    private _calculateDiffUpdated(
        itemsUpdated: Observable<SystemPortalUpdate>
    ): Observable<SystemPortalDiffUpdate> {
        return combineLatest([
            itemsUpdated,
            this._simulationManager.simulationAdded.pipe(
                mergeMap((sim) =>
                    sim.watcher.botTagsChanged(sim.helper.userId).pipe(
                        filter(
                            (change) =>
                                change.tags.has(SYSTEM_PORTAL_DIFF) ||
                                change.tags.has(SYSTEM_PORTAL_DIFF_BOT)
                        ),
                        startWith(1),
                        takeUntil(
                            this._simulationManager.simulationRemoved.pipe(
                                filter((s) => s.id === sim.id)
                            )
                        )
                    )
                )
            ),
        ]).pipe(
            map(([update, _]) => update),
            map((update) => this._findDiff(update)),
            distinctUntilChanged((first, second) => isEqual(first, second))
        );
    }

    private _findDiff(update: SystemPortalUpdate): SystemPortalDiffUpdate {
        if (!update.hasPortal) {
            return {
                hasPortal: false,
            };
        }

        let areas: SystemPortalDiffArea[] = [];
        let areasMap = new Map<string, SystemPortalDiffArea>();
        let systems = new Map<
            string,
            { bot: Bot; simulationId: string; diffTag: string }[]
        >();
        let selectedKey: string = null;
        let showAllSystemBots: boolean = null;
        let systemPortal: string = null;

        for (let [id, sim] of this._simulationManager.simulations) {
            const helper = sim.helper;
            if (!helper.userBot) {
                return {
                    hasPortal: false,
                };
            }

            const diffTag = calculateStringTagValue(
                null,
                helper.userBot,
                SYSTEM_PORTAL_DIFF,
                null
            );

            if (!hasValue(systemPortal)) {
                systemPortal = calculateStringTagValue(
                    null,
                    helper.userBot,
                    SYSTEM_PORTAL,
                    null
                );
            }

            if (!hasValue(showAllSystemBots)) {
                showAllSystemBots = calculateBooleanTagValue(
                    null,
                    helper.userBot,
                    SYSTEM_PORTAL,
                    null
                );
            }

            if (!hasValue(diffTag)) {
                return {
                    hasPortal: false,
                };
            }

            if (!hasValue(selectedKey)) {
                selectedKey = calculateBotIdTagValue(
                    helper.userBot,
                    SYSTEM_PORTAL_DIFF_BOT,
                    null
                );
            }

            for (let bot of helper.objects) {
                const system = calculateFormattedBotValue(null, bot, diffTag);
                if (hasValue(system)) {
                    let list = systems.get(system);
                    if (!list) {
                        list = [
                            {
                                bot,
                                simulationId: sim.id,
                                diffTag,
                            },
                        ];
                        systems.set(system, list);
                    } else {
                        list.push({
                            bot,
                            simulationId: sim.id,
                            diffTag,
                        });
                    }
                }
            }
        }

        for (let i of update.items) {
            const sim = this._simulationManager.simulations.get(i.simulationId);
            const helper = sim.helper;
            const systemTag = calculateStringTagValue(
                null,
                helper.userBot,
                SYSTEM_TAG_NAME,
                SYSTEM_TAG
            );

            for (let area of i.areas) {
                let items: SystemPortalDiffBot[] = [];

                for (let item of area.bots) {
                    if (systems.has(item.system)) {
                        const bots = systems.get(item.system);
                        const [bot] = bots.splice(0, 1);

                        if (bots.length <= 0) {
                            systems.delete(item.system);
                        }

                        const originalBot = item.bot;
                        const newBot = bot.bot;
                        const diffTag = bot.diffTag;

                        const changedTags = sortBy(
                            findChangedTags(originalBot, newBot).filter(
                                (t) =>
                                    t.name !== diffTag && t.name !== systemTag
                            ),
                            (t) => t.name
                        );

                        items.push({
                            key: item.bot.id,
                            title: item.title,
                            originalBot: item.bot,
                            originalBotSimulationId: item.bot
                                ? i.simulationId
                                : null,
                            newBot,
                            newBotSimulationId: bot.simulationId,
                            changedTags: changedTags
                                .filter((t) => t.status !== 'none')
                                .map((t) => ({
                                    tag: t.name,
                                    space: t.space,
                                })),
                        });
                    } else {
                        // bot was removed
                        items.push({
                            key: item.bot.id,
                            title: item.title,
                            removedBot: item.bot,
                            removedBotSimulationId: i.simulationId,
                        });
                    }
                }

                if (items.length > 0) {
                    let diffArea = areasMap.get(area.area);
                    if (!diffArea) {
                        diffArea = {
                            area: area.area,
                            bots: items,
                        };
                        areas.push(diffArea);
                        areasMap.set(area.area, diffArea);
                    } else {
                        diffArea.bots.push(...items);
                    }
                }
            }
        }

        for (let [system, bots] of systems) {
            if (!showAllSystemBots && !system.includes(systemPortal)) {
                continue;
            }

            // added bots
            const area = getSystemArea(system);
            const title = getBotTitle(system, area);

            let diffArea = areas.find((a) => a.area === area);
            if (!diffArea) {
                diffArea = {
                    area,
                    bots: [],
                };
                areasMap.set(area, diffArea);
                areas.push(diffArea);
            }

            for (let bot of bots) {
                diffArea.bots.push({
                    key: bot.bot.id,
                    title: title,
                    addedBot: bot.bot,
                    addedBotSimulationId: bot.simulationId,
                });
            }
        }

        for (let item of areas) {
            item.bots = sortBy(item.bots, (b) => b.title);
        }

        return {
            hasPortal: true,
            selectedKey: selectedKey,
            items: sortBy(areas, (a) => a.area),
        };
    }

    private _calculateDiffSelectionUpdated(
        diffUpdated: Observable<SystemPortalDiffUpdate>
    ): Observable<SystemPortalDiffSelectionUpdate> {
        return combineLatest([
            diffUpdated,
            this._simulationManager.simulationAdded.pipe(
                mergeMap((sim) =>
                    sim.watcher.botTagsChanged(sim.helper.userId).pipe(
                        filter(
                            (change) =>
                                change.tags.has(SYSTEM_PORTAL_DIFF_BOT) ||
                                change.tags.has(SYSTEM_PORTAL_DIFF_TAG) ||
                                change.tags.has(SYSTEM_PORTAL_DIFF_TAG_SPACE)
                            // change.tags.has(SYSTEM_PORTAL_TAG_SPACE)
                        ),
                        startWith(1),
                        takeUntil(
                            this._simulationManager.simulationRemoved.pipe(
                                filter((s) => s.id === sim.id)
                            )
                        )
                    )
                )
            ),
        ]).pipe(
            map(([update, _]) => update),
            map((update) => this._findDiffSelection(update)),
            distinctUntilChanged((first, second) => isEqual(first, second))
        );
    }

    private _findDiffSelection(
        update: SystemPortalDiffUpdate
    ): SystemPortalDiffSelectionUpdate {
        if (!update.hasPortal || !update.selectedKey) {
            return {
                hasSelection: false,
            };
        }

        let bot: SystemPortalDiffBot;
        for (let i of update.items) {
            if (bot) {
                break;
            }
            for (let b of i.bots) {
                if (b.key === update.selectedKey) {
                    bot = b;
                    break;
                }
            }
        }

        if (!bot) {
            return {
                hasSelection: false,
            };
        }

        const newBot =
            'addedBot' in bot
                ? bot.addedBot
                : 'removedBot' in bot
                ? null
                : bot.newBot;
        const newBotSimulationId =
            'addedBot' in bot
                ? bot.addedBotSimulationId
                : 'removedBot' in bot
                ? bot.removedBotSimulationId
                : bot.newBotSimulationId;
        const oldBot =
            'addedBot' in bot
                ? null
                : 'removedBot' in bot
                ? bot.removedBot
                : bot.originalBot;
        const oldBotSimulationId =
            'addedBot' in bot
                ? bot.addedBotSimulationId
                : 'removedBot' in bot
                ? bot.removedBotSimulationId
                : bot.originalBotSimulationId;

        const systemTagSimId = oldBotSimulationId;
        const diffTagSimId = newBotSimulationId;

        const systemTagSim =
            this._simulationManager.simulations.get(systemTagSimId);
        const diffTagSim =
            this._simulationManager.simulations.get(diffTagSimId);

        const diffTag =
            calculateStringTagValue(
                null,
                diffTagSim.helper.userBot,
                SYSTEM_PORTAL_DIFF,
                null
            ) ??
            calculateStringTagValue(
                null,
                systemTagSim.helper.userBot,
                SYSTEM_PORTAL_DIFF,
                null
            );
        const systemTag =
            calculateStringTagValue(
                null,
                systemTagSim.helper.userBot,
                SYSTEM_TAG_NAME,
                null
            ) ??
            calculateStringTagValue(
                null,
                diffTagSim.helper.userBot,
                SYSTEM_TAG_NAME,
                SYSTEM_TAG
            );

        const selectedTag =
            calculateStringTagValue(
                null,
                systemTagSim.helper.userBot,
                SYSTEM_PORTAL_DIFF_TAG,
                null
            ) ??
            calculateStringTagValue(
                null,
                diffTagSim.helper.userBot,
                SYSTEM_PORTAL_DIFF_TAG,
                null
            );
        const selectedSpace =
            calculateStringTagValue(
                null,
                systemTagSim.helper.userBot,
                SYSTEM_PORTAL_DIFF_TAG_SPACE,
                null
            ) ??
            calculateStringTagValue(
                null,
                diffTagSim.helper.userBot,
                SYSTEM_PORTAL_DIFF_TAG_SPACE,
                null
            );

        const changedTags = findChangedTags(oldBot, newBot).filter(
            (t) => t.name !== diffTag && t.name !== systemTag
        );

        return {
            hasSelection: true,
            newBot,
            newBotSimulationId: newBot ? newBotSimulationId : null,
            originalBot: oldBot,
            originalBotSimulationId: oldBot ? oldBotSimulationId : null,
            tag: selectedTag,
            space: selectedSpace,
            tags: sortBy(changedTags, (t) => `${t.name}.${t.space}`),
        };
    }

    private _calculateSearchResults(): Observable<SystemPortalSearchUpdate> {
        const changes = this._simulationManager.simulationAdded.pipe(
            mergeMap((sim) =>
                sim.watcher.botTagsChanged(sim.helper.userId).pipe(
                    filter(
                        (c) =>
                            c.tags.has(SYSTEM_PORTAL_SEARCH) ||
                            c.tags.has(SYSTEM_TAG_NAME)
                    ),
                    takeUntil(
                        this._simulationManager.simulationRemoved.pipe(
                            filter((s) => s.id === sim.id)
                        )
                    )
                )
            )
        );

        return changes.pipe(switchMap(() => this._searchResultsUpdate()));
    }

    private _searchResultsUpdate(): Observable<SystemPortalSearchUpdate> {
        let runSearch = async (
            observer: Observer<SystemPortalSearchUpdate>,
            cancelFlag: Subscription
        ) => {
            let hadUpdate = false;

            let matchCount = 0;
            let botCount = 0;
            let completeItems = [] as SystemPortalSearchItem[];
            let tagCounter = 0;
            let hasUpdate = false;
            let buffer = this._buffer;

            for (let [id, sim] of this._simulationManager.simulations) {
                if (cancelFlag.closed) {
                    break;
                }

                const helper = sim.helper;

                const systemTag = calculateStringTagValue(
                    null,
                    helper.userBot,
                    SYSTEM_TAG_NAME,
                    SYSTEM_TAG
                );
                let bots = sortBy(helper.objects, (b) =>
                    calculateFormattedBotValue(null, b, systemTag)
                );

                const query = calculateStringTagValue(
                    null,
                    helper.userBot,
                    SYSTEM_PORTAL_SEARCH,
                    null
                );

                if (!query) {
                    continue;
                }

                let areas = new Map<string, SystemPortalSearchBot[]>();

                function createUpdate(): {
                    update: SystemPortalSearchUpdate;
                    item: SystemPortalSearchItem;
                } {
                    let itemAreas = [] as SystemPortalSearchArea[];
                    for (let [area, value] of areas) {
                        itemAreas.push({
                            area,
                            bots: value,
                        });
                    }

                    const items = [...completeItems];
                    const item = {
                        simulationId: sim.id,
                        areas: sortBy(itemAreas, (i) => i.area),
                    };

                    if (itemAreas.length > 0) {
                        items.push(item);
                    }

                    hadUpdate = true;
                    return {
                        update: {
                            numMatches: matchCount,
                            numBots: botCount,
                            items,
                        },
                        item,
                    };
                }

                function checkTagCounter() {
                    if (
                        buffer &&
                        hasUpdate &&
                        tagCounter > TAGS_PER_SEARCH_UPDATE
                    ) {
                        hasUpdate = false;
                        tagCounter = 0;
                        let { update } = createUpdate();
                        observer.next(update);
                        return true;
                    }
                    return false;
                }

                const prefixes = sim.portals.prefixes;

                for (let bot of bots) {
                    if (cancelFlag.closed) {
                        break;
                    }
                    if (bot.id === helper.userId) {
                        continue;
                    }
                    const system = calculateFormattedBotValue(
                        null,
                        bot,
                        systemTag
                    );
                    const area = getSystemArea(system);
                    const title = getBotTitle(system, area);
                    let tags = [] as SystemPortalSearchTag[];

                    if (bot.id === query) {
                        const result = searchTag(
                            'id',
                            null,
                            bot.id,
                            query,
                            prefixes
                        );
                        if (result) {
                            tags.push(result);
                            matchCount += result.matches.length;
                            tagCounter += 1;
                        }
                    }

                    if (bot.space === query) {
                        const result = searchTag(
                            'space',
                            null,
                            bot.space,
                            query,
                            prefixes
                        );
                        if (result) {
                            tags.push(result);
                            matchCount += result.matches.length;
                            tagCounter += 1;
                        }
                    }

                    for (let tag in bot.tags) {
                        let value = bot.tags[tag];
                        const result = searchTag(
                            tag,
                            null,
                            value,
                            query,
                            prefixes
                        );
                        if (result) {
                            tags.push(result);
                            matchCount += result.matches.length;
                            tagCounter += 1;
                        }
                    }

                    for (let space in bot.masks) {
                        let spaceTags = bot.masks[space];
                        for (let tag in spaceTags) {
                            let value = spaceTags[tag];
                            const result = searchTag(
                                tag,
                                space,
                                value,
                                query,
                                prefixes
                            );
                            if (result) {
                                tags.push(result);
                                matchCount += result.matches.length;
                                tagCounter += 1;
                            }
                        }
                    }

                    if (tags.length > 0) {
                        hasUpdate = true;
                        let arr = areas.get(area);
                        if (!arr) {
                            arr = [];
                            areas.set(area, arr);
                        }
                        botCount += 1;

                        arr.push({
                            bot,
                            title,
                            tags,
                        });
                    }

                    if (checkTagCounter()) {
                        // Wait for the sleep interval so that other processes
                        // can run before resuming the search.
                        await sleep(SEARCH_UPDATE_WAIT_INTERVAL);
                    }
                }

                const { update, item } = createUpdate();
                observer.next(update);
                completeItems.push(item);
            }

            if (!hadUpdate) {
                observer.next({
                    numMatches: 0,
                    numBots: 0,
                    items: [],
                });
            }
        };

        return new Observable<SystemPortalSearchUpdate>((observer) => {
            let sub = new Subscription();
            runSearch(observer, sub);
            return sub;
        });
    }

    private _calculateSystemPortalPaneUpdated(): Observable<SystemPortalPane> {
        const simulationChanges = merge(
            this._simulationManager.simulationAdded.pipe(
                map((sim) => ['added', sim] as const)
            ),
            this._simulationManager.simulationRemoved.pipe(
                map((sim) => ['removed', sim] as const)
            )
        );

        const allSimulations = simulationChanges.pipe(
            scan((array, change, index) => {
                if (change[0] === 'added') {
                    array.push(change[1]);
                } else {
                    const index = array.indexOf(change[1]);
                    if (index >= 0) {
                        array.splice(index, 1);
                    }
                }
                return array;
            }, [] as TSim[])
        );

        const panes = allSimulations.pipe(
            switchMap((simulations) => {
                return combineLatest(
                    simulations.map((sim) => {
                        return sim.watcher
                            .botTagsChanged(sim.helper.userId)
                            .pipe(
                                map((change) =>
                                    getOpenSystemPortalPane(null, change.bot)
                                ),
                                takeUntil(
                                    this._simulationManager.simulationRemoved.pipe(
                                        filter((s) => s.id === sim.id)
                                    )
                                )
                            );
                    })
                );
            }),
            map((panes) => panes.find((pane) => hasValue(pane)) ?? null)
        );

        return panes.pipe(distinctUntilChanged());
    }
}

/**
 * Finds the "area" for the given system identifier.
 * System identifiers are dot-separated (.) strings. (like "core.ui.menu")
 * The area includes the first two sections sections of a system ID except for the last section.
 * (the area of "core.ui.menu" is "core.menu" and the area of "core.ui" is "core")
 * @param system
 * @returns
 */
export function getSystemArea(system: string): string {
    if (!hasValue(system)) {
        return '';
    }
    const firstDotIndex = system.indexOf('.');
    if (firstDotIndex < 0) {
        return system;
    }
    const secondDotIndex = system.indexOf('.', firstDotIndex + 1);
    if (secondDotIndex < 0) {
        return system.substring(0, firstDotIndex);
    }
    return system.substring(0, secondDotIndex);
}

/**
 * Finds the title for the bot given the system identifier and area.
 * @param system The system identifier.
 * @param area The area for the system.
 */
export function getBotTitle(system: string, area: string): string {
    return (system ?? '').substring(area.length).replace(/^[.]/, '');
}

/**
 * Searches the given tag for matches to the given query.
 * @param tag The name of the tag that is being searched.
 * @param space The space that the tag is in.
 * @param value The value of the tag.
 * @param query The value to search for.
 */
export function searchTag(
    tag: string,
    space: string,
    value: unknown,
    query: string,
    prefixes: string[]
): SystemPortalSearchTag | null {
    let str = formatValue(value);

    const tagNameMatches = searchValue(tag, 0, query, true);
    let matches: SystemPortalSearchMatch[] = [];
    let prefix: string;
    let isValueScript = false;
    let isValueModule = false;
    let isValueFormula = false;
    let isValueLink = false;

    if (hasValue(str)) {
        isValueScript = isScript(str);
        isValueModule = isModule(str);
        isValueFormula = isFormula(str);
        isValueLink = isBotLink(str);
        prefix = getScriptPrefix(prefixes, str);
        let parsedValue: string;
        let offset = 0;

        if (isValueScript) {
            parsedValue = parseScript(str);
            offset = 1;
        } else if (isValueModule) {
            parsedValue = parseModule(str);
            offset = '📄'.length;
        } else if (isValueFormula) {
            parsedValue = parseFormula(str);
            offset = DNA_TAG_PREFIX.length;
        } else if (isValueLink) {
            parsedValue = str.substring(BOT_LINK_TAG_PREFIX.length);
            offset = BOT_LINK_TAG_PREFIX.length;
        } else {
            parsedValue = str;
        }

        matches = searchValue(parsedValue, offset, query);
    }

    if (matches.length > 0 || tagNameMatches.length > 0) {
        let result: SystemPortalSearchTag = {
            tag,
            matches: [...tagNameMatches, ...matches],
        };

        if (hasValue(space)) {
            result.space = space;
        }

        if (hasValue(prefix)) {
            result.prefix = prefix;
        }

        if (isValueScript) {
            result.isScript = true;
        } else if (isValueFormula) {
            result.isFormula = true;
        } else if (isValueLink) {
            result.isLink = true;
        }

        return result;
    }

    return null;
}

/**
 * Searches the given value for matches of the given query.
 * @param value The value to search.
 * @param indexOffset The offset that should be added to absolute indexes in the matches.
 * @param query The value to search for.
 * @param isTagName Whether the match is for a tag name.
 * @returns
 */
export function searchValue(
    value: string,
    indexOffset: number,
    query: string,
    isTagName?: boolean
): SystemPortalSearchMatch[] {
    let results = [] as SystemPortalSearchMatch[];

    let i = 0;
    while (i < value.length) {
        const match = value.indexOf(query, i);

        if (match >= 0) {
            i = match + query.length;

            let lineStart = match;
            let distance = 0;
            const maxSearchDistance = 40;
            for (
                ;
                lineStart > 0 && distance <= maxSearchDistance;
                lineStart -= 1
            ) {
                const char = value[lineStart];
                if (char === '\n') {
                    lineStart += 1;
                    break;
                } else if (char !== ' ' && char !== '\t') {
                    distance += 1;
                }
            }

            let lineEnd = match + query.length;
            for (
                ;
                lineEnd < value.length && distance <= maxSearchDistance;
                lineEnd += 1
            ) {
                const char = value[lineEnd];
                if (char === '\n') {
                    break;
                } else if (char !== ' ' && char !== '\t') {
                    distance += 1;
                }
            }

            const line = value.substring(lineStart, lineEnd);

            let highlightStart = match - lineStart;
            let highlightEnd = highlightStart + query.length;

            results.push({
                index: match + indexOffset,
                endIndex: match + query.length + indexOffset,
                text: line,
                highlightStartIndex: highlightStart,
                highlightEndIndex: highlightEnd,
                isTagName,
            });
        } else {
            break;
        }
    }

    return results;
}

function findChangedTags(
    originalBot: Bot,
    newBot: Bot
): SystemPortalDiffSelectionTag[] {
    let changes: SystemPortalDiffSelectionTag[] = diffTags(
        originalBot?.tags ?? {},
        newBot?.tags ?? {},
        undefined
    );

    const allSpaces = union(
        Object.keys(originalBot?.masks ?? {}),
        Object.keys(newBot?.masks ?? {})
    );

    for (let space of allSpaces) {
        changes.push(
            ...diffTags(
                originalBot?.masks?.[space] ?? {},
                newBot?.masks?.[space] ?? {},
                space
            )
        );
    }

    return changes;
}

function diffTags(firstTags: BotTags, secondTags: BotTags, space: string) {
    let changes: SystemPortalDiffSelectionTag[] = [];
    let hasTagsDiff = false;
    const allTags = union(Object.keys(firstTags), Object.keys(secondTags));

    for (let tag of allTags) {
        const firstValue = firstTags[tag];
        const secondValue = secondTags[tag];
        if (!isEqual(firstValue, secondValue)) {
            const status =
                hasValue(secondValue) && !hasValue(firstValue)
                    ? 'added'
                    : hasValue(firstValue) && !hasValue(secondValue)
                    ? 'removed'
                    : 'changed';

            // updated, deleted, or added
            hasTagsDiff = true;
            changes.push({
                name: tag,
                space,
                status: status,
            });
        } else {
            changes.push({
                name: tag,
                space,
                status: 'none',
            });
        }
    }

    return changes;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve, reject) => setTimeout(resolve, ms));
}

export type SystemPortalUpdate =
    | SystemPortalEmptyUpdate
    | SystemPortalItemsUpdate;

export interface SystemPortalEmptyUpdate {
    hasPortal: false;
}

export interface SystemPortalItemsUpdate {
    hasPortal: true;
    selectedBotSimulationId: string;
    selectedBot: string;
    items: SystemPortalItem[];
}

export interface SystemPortalItem {
    simulationId: string;
    areas: SystemPortalArea[];
}

export interface SystemPortalArea {
    area: string;
    bots: SystemPortalBot[];
}

export interface SystemPortalBot {
    bot: Bot;
    title: string;
    system: string;
}

export type SystemPortalSelectionUpdate =
    | SystemPortalHasSelectionUpdate
    | SystemPortalNoSelectionUpdate;

export interface SystemPortalHasSelectionUpdate {
    hasSelection: true;
    simulationId: string;
    bot: Bot;
    tag?: string;
    space?: string;
    sortMode: TagSortMode;
    tags: SystemPortalSelectionTag[];

    /**
     * The list of tags that should be pinned to a section at the bottom of the tags list.
     */
    pinnedTags?: SystemPortalSelectionTag[];
}

export interface SystemPortalSelectionTag {
    name: string;
    space?: string;
    isScript?: boolean;
    isFormula?: boolean;
    isLink?: boolean;
    prefix?: string;

    /**
     * Whether the tag value should be focused once rendered into view.
     */
    focusValue?: boolean;
}

export interface SystemPortalNoSelectionUpdate {
    hasSelection: false;
}

export type TagSortMode = 'alphabetical' | 'scripts-first';

export type SystemPortalRecentsUpdate =
    | SystemPortalHasRecentsUpdate
    | SystemPortalNoRecentsUpdate;

export interface SystemPortalHasRecentsUpdate {
    hasRecents: true;
    recentTags: SystemPortalRecentTag[];
}

export interface SystemPortalNoRecentsUpdate {
    hasRecents: false;
}

export interface SystemPortalRecentTag {
    hint: string;
    system: string;
    isScript: boolean;
    isFormula: boolean;
    isLink: boolean;
    simulationId: string;
    botId: string;
    tag: string;
    space: string;
    prefix?: string;
}

export interface SystemPortalSearchUpdate {
    numMatches: number;
    numBots: number;
    items: SystemPortalSearchItem[];
}

export interface SystemPortalSearchItem {
    simulationId: string;
    areas: SystemPortalSearchArea[];
}

export interface SystemPortalSearchArea {
    /**
     * The system area that the matches ocurred for.
     */
    area: string;

    /**
     * The bots that the match ocurred for.
     */
    bots: SystemPortalSearchBot[];
}

export interface SystemPortalSearchBot {
    /**
     * The bot that the match ocurred for.
     */
    bot: Bot;

    /**
     * The title for the bot.
     */
    title: string;

    /**
     * The tags that were matched.
     */
    tags: SystemPortalSearchTag[];
}

export interface SystemPortalSearchTag {
    /**
     * The tag that the matches occurred for.
     */
    tag: string;

    /**
     * The space that the tag is in.
     */
    space?: string;

    /**
     * Whether the tag is a script.
     */
    isScript?: boolean;

    /**
     * Whether the tag is a formula.
     */
    isFormula?: boolean;

    /**
     * Whether the tag is a link.
     */
    isLink?: boolean;

    /**
     * Whether the search is actually matching a tag name.
     */
    isTagName?: boolean;

    /**
     * The prefix that the tag has.
     */
    prefix?: string;

    /**
     * The list of matches.
     */
    matches: SystemPortalSearchMatch[];
}

export interface SystemPortalSearchMatch {
    /**
     * The text that should be shown for the match.
     */
    text: string;

    /**
     * The index that the match starts at inside the tag value.
     */
    index: number;

    /**
     * The index that the match ends at inside the tag value.
     */
    endIndex: number;

    /**
     * The index that the match starts at inside this object's text.
     */
    highlightStartIndex: number;

    /**
     * The index that the match ends at inside this object's text.
     */
    highlightEndIndex: number;

    /**
     * Whether the match is for the tag name and not the tag value.
     */
    isTagName?: boolean;
}

export type SystemPortalDiffUpdate =
    | SystemPortalDiffEmptyUpdate
    | SystemPortalDiffItemsUpdate;

export interface SystemPortalDiffEmptyUpdate {
    hasPortal: false;
}

export interface SystemPortalDiffItemsUpdate {
    hasPortal: true;
    selectedKey: string;
    items: SystemPortalDiffArea[];
}

export interface SystemPortalDiffArea {
    area: string;
    bots: SystemPortalDiffBot[];
}

export type SystemPortalDiffBot =
    | SystemPortalDiffAddedBot
    | SystemPortalDiffRemovedBot
    | SystemPortalDiffUpdatedBot;

export interface SystemPortalDiffAddedBot {
    key: string;
    title: string;
    addedBot: Bot;
    addedBotSimulationId: string;
}

export interface SystemPortalDiffRemovedBot {
    key: string;
    title: string;
    removedBot: Bot;
    removedBotSimulationId: string;
}

export interface SystemPortalDiffUpdatedBot {
    key: string;
    title: string;
    originalBotSimulationId: string;
    originalBot: Bot;
    newBot: Bot;
    newBotSimulationId: string;
    changedTags: SystemPortalDiffTag[];
}

export interface SystemPortalDiffTag {
    tag: string;
    space?: string;
}

export type SystemPortalDiffSelectionUpdate =
    | SystemPortalHasDiffSelectionUpdate
    | SystemPortalNoDiffSelectionUpdate;

export interface SystemPortalHasDiffSelectionUpdate {
    hasSelection: true;
    originalBotSimulationId: string;
    originalBot: Bot;
    newBotSimulationId: string;
    newBot: Bot;
    tag?: string;
    space?: string;
    // sortMode: TagSortMode;
    tags: SystemPortalDiffSelectionTag[];
}

export interface SystemPortalDiffSelectionTag {
    name: string;
    space?: string;
    prefix?: string;

    status: 'added' | 'removed' | 'changed' | 'none';
}

export interface SystemPortalNoDiffSelectionUpdate {
    hasSelection: false;
}
