import {
    Bot,
    calculateBotValue,
    calculateStringTagValue,
    getBotTag,
    hasValue,
    SYSTEM_PORTAL,
    SYSTEM_PORTAL_BOT,
    SYSTEM_TAG,
    tagsOnBot,
    getTagMask,
    calculateBooleanTagValue,
    EDITING_BOT,
    EDITING_TAG,
    getShortId,
    isScript,
    EDITING_TAG_SPACE,
    getTagValueForSpace,
    parseNewTag,
    hasTagOrMask,
    DNA_TAG_PREFIX,
    isFormula,
    SYSTEM_PORTAL_TAG,
    SYSTEM_PORTAL_TAG_SPACE,
} from '@casual-simulation/aux-common';
import {
    BotHelper,
    BotWatcher,
    UpdatedBotInfo,
} from '@casual-simulation/aux-vm';
import { isEqual, sortBy, unionBy } from 'lodash';
import {
    BehaviorSubject,
    combineLatest,
    merge,
    Observable,
    Subscription,
    SubscriptionLike,
} from 'rxjs';
import {
    bufferTime,
    distinctUntilChanged,
    filter,
    map,
    skip,
    startWith,
} from 'rxjs/operators';

/**
 * Defines a class that is able to manage the state of the system portal.
 */
export class SystemPortalManager implements SubscriptionLike {
    private _sub = new Subscription();
    private _watcher: BotWatcher;
    private _helper: BotHelper;
    private _itemsUpdated: BehaviorSubject<SystemPortalUpdate>;
    private _selectionUpdated: BehaviorSubject<SystemPortalSelectionUpdate>;
    private _recentsUpdated: BehaviorSubject<SystemPortalRecentsUpdate>;
    private _buffer: boolean;
    private _recentTags: SystemPortalRecentTag[] = [];
    private _recentTagsListSize: number = 10;
    private _tagSortMode: TagSortMode = 'scripts-first';
    private _extraTags: string[] = [];

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

        this._sub.add(
            this._calculateItemsUpdated().subscribe(this._itemsUpdated)
        );
        this._sub.add(
            this._calculateSelectionUpdated().subscribe(this._selectionUpdated)
        );
        this._sub.add(
            this._calculateRecentsUpdated().subscribe(this._recentsUpdated)
        );
    }

    /**
     * Adds the given tag as a pinned tag.
     * Pinned tags are a separate list of tags that are persisted across multiple selections.
     * @param tag The name of the tag to pin.
     */
    addPinnedTag(tag: string) {
        const parsed = parseNewTag(tag);
        if (this._extraTags.includes(parsed.name)) {
            return;
        }

        const selectedBotId = calculateStringTagValue(
            null,
            this._helper.userBot,
            SYSTEM_PORTAL_BOT,
            null
        );
        const selectedBot = selectedBotId
            ? this._helper.botsState[selectedBotId]
            : null;
        if ((parsed.isScript || parsed.isFormula) && selectedBot) {
            if (!hasValue(selectedBot.tags[parsed.name])) {
                this._helper.updateBot(selectedBot, {
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

    private _updateSelection(extraTags?: string[]) {
        const update = this._findSelection(this._itemsUpdated.value, extraTags);

        if (!isEqual(update, this._selectionUpdated.value)) {
            this._selectionUpdated.next(update);
        }
    }

    private _calculateItemsUpdated(): Observable<SystemPortalUpdate> {
        const allBotsSelectedUpdatedAddedAndRemoved = merge(
            this._watcher.botsDiscovered,
            this._watcher.botsUpdated,
            this._watcher.botsRemoved
        );
        const bufferedEvents: Observable<any> = this._buffer
            ? allBotsSelectedUpdatedAddedAndRemoved.pipe(bufferTime(10))
            : allBotsSelectedUpdatedAddedAndRemoved;

        return bufferedEvents.pipe(
            map(() => this._findMatchingItems()),
            distinctUntilChanged((x, y) => isEqual(x, y))
        );
    }

    private _findMatchingItems(): SystemPortalUpdate {
        if (!this._helper.userBot) {
            return {
                hasPortal: false,
            };
        }

        const systemPortal = calculateStringTagValue(
            null,
            this._helper.userBot,
            SYSTEM_PORTAL,
            null
        );
        const showAllSystemBots = calculateBooleanTagValue(
            null,
            this._helper.userBot,
            SYSTEM_PORTAL,
            false
        );

        if (showAllSystemBots || hasValue(systemPortal)) {
            let selectedBot: string = calculateStringTagValue(
                null,
                this._helper.userBot,
                SYSTEM_PORTAL_BOT,
                null
            );
            let items = [] as SystemPortalItem[];
            let areas = new Map<string, SystemPortalItem>();
            for (let bot of this._helper.objects) {
                if (bot.id === this._helper.userId) {
                    continue;
                }

                const system = calculateStringTagValue(
                    null,
                    bot,
                    SYSTEM_TAG,
                    null
                );

                if (
                    bot.id === selectedBot ||
                    (hasValue(system) &&
                        (showAllSystemBots || system.includes(systemPortal)))
                ) {
                    const area = getSystemArea(system);
                    const title = system
                        .substring(area.length)
                        .replace(/^[\.]/, '');

                    let item = areas.get(area);
                    if (!item) {
                        item = {
                            area,
                            bots: [],
                        };
                        items.push(item);
                        areas.set(area, item);
                    }

                    item.bots.push({
                        bot,
                        title,
                    });
                }
            }

            for (let item of items) {
                item.bots = sortBy(item.bots, (b) => b.title);
            }

            items = sortBy(items, (i) => i.area);

            return {
                hasPortal: true,
                selectedBot,
                items,
            };
        }

        return {
            hasPortal: false,
        };
    }

    private _calculateSelectionUpdated(): Observable<SystemPortalSelectionUpdate> {
        return combineLatest([
            this._itemsUpdated.pipe(skip(1)),
            this._watcher.botTagsChanged(this._helper.userId).pipe(
                filter(
                    (change) =>
                        change.tags.has(SYSTEM_PORTAL_TAG) ||
                        change.tags.has(SYSTEM_PORTAL_TAG_SPACE)
                ),
                startWith(1)
            ),
        ]).pipe(
            map(([update, _]) => update),
            map((update) => this._findSelection(update)),
            distinctUntilChanged((first, second) => isEqual(first, second))
        );
    }

    private _findSelection(
        update: SystemPortalUpdate,
        tagsToPin?: string[]
    ): SystemPortalSelectionUpdate {
        if (!update.hasPortal || !update.selectedBot) {
            return {
                hasSelection: false,
            };
        }

        const bot = this._helper.botsState[update.selectedBot];
        if (!bot) {
            return {
                hasSelection: false,
            };
        }

        const selectedTag = calculateStringTagValue(
            null,
            this._helper.userBot,
            SYSTEM_PORTAL_TAG,
            null
        );
        const selectedSpace = calculateStringTagValue(
            null,
            this._helper.userBot,
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

        const sortMode = this.tagSortMode;
        const inputTags = unionBy(
            [...normalTags, ...maskTags],
            (t) => `${t.name}.${t.space}`
        );
        const tags = sortTags(inputTags);

        let ret: SystemPortalHasSelectionUpdate = {
            hasSelection: true,
            sortMode,
            bot,
            tags,
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

            if (hasValue(space)) {
                selectionTag.space = space;
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
        const changes = this._watcher.botTagsChanged(this._helper.userId);

        return changes.pipe(
            filter((c) => c.tags.has(EDITING_BOT) || c.tags.has(EDITING_TAG)),
            map(() => this._updateRecentsList())
        );
    }

    private _updateRecentsList(): SystemPortalRecentsUpdate {
        const newBotId = calculateStringTagValue(
            null,
            this._helper.userBot,
            EDITING_BOT,
            null
        );
        const newTag = calculateStringTagValue(
            null,
            this._helper.userBot,
            EDITING_TAG,
            null
        );
        const newSpace = calculateStringTagValue(
            null,
            this._helper.userBot,
            EDITING_TAG_SPACE,
            null
        );

        if (!newBotId || !newTag) {
            return this._recentsUpdated.value;
        }

        const newBot = this._helper.botsState[newBotId];

        if (!newBotId || !newTag) {
            return this._recentsUpdated.value;
        }

        const recentTagsCounts = new Map<string, number>();

        recentTagsCounts.set(`${newTag}.${newSpace}`, 1);

        for (let tag of this._recentTags) {
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
            ...getTagPrefix(newTag, newBot, newSpace),
            botId: newBot.id,
            tag: newTag,
            space: newSpace,
        });

        for (let recent of this._recentTags) {
            if (
                recent.tag === newTag &&
                recent.botId === newBot.id &&
                recent.space === newSpace
            ) {
                continue;
            } else if (newTags.length < this._recentTagsListSize) {
                newTags.push({
                    ...getTagPrefix(
                        recent.tag,
                        this._helper.botsState[recent.botId],
                        recent.space
                    ),
                    tag: recent.tag,
                    botId: recent.botId,
                    space: recent.space,
                });
            } else {
                break;
            }
        }

        this._recentTags = newTags;

        if (this._recentTags.length > 0) {
            return {
                hasRecents: true,
                recentTags: this._recentTags,
            };
        }

        function getTagPrefix(
            tag: string,
            bot: Bot,
            space: string | null
        ): Pick<SystemPortalRecentTag, 'prefix' | 'isScript'> {
            const tagValue = getTagValueForSpace(bot, tag, space);
            const isTagScript = isScript(tagValue);
            if ((recentTagsCounts.get(`${tag}.${space}`) ?? 0) > 1) {
                const system = calculateStringTagValue(
                    null,
                    bot,
                    SYSTEM_TAG,
                    null
                );
                return {
                    prefix: system ?? getShortId(bot),
                    isScript: isTagScript,
                };
            }

            return {
                prefix: '',
                isScript: isTagScript,
            };
        }
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
    const firstDotIndex = system.indexOf('.');
    if (firstDotIndex < 0) {
        return system;
    }
    const secondDotIndex = system.indexOf('.', firstDotIndex + 1);
    if (secondDotIndex < 0) {
        return system.substring(0, firstDotIndex);
    }
    return system.substring(0, secondDotIndex);
    // let lastIndex = 0;
    // while (true) {
    //     const nextDotIndex = system.indexOf('.', lastIndex);
    //     if (nextDotIndex < 0) {
    //         return system.substring(0, lastIndex);
    //     }
    //     lastIndex = nextDotIndex;
    // }
}

export type SystemPortalUpdate =
    | SystemPortalEmptyUpdate
    | SystemPortalItemsUpdate;

export interface SystemPortalEmptyUpdate {
    hasPortal: false;
}

export interface SystemPortalItemsUpdate {
    hasPortal: true;
    selectedBot: string;
    items: SystemPortalItem[];
}

export interface SystemPortalItem {
    area: string;
    bots: SystemPortalBot[];
}

export interface SystemPortalBot {
    bot: Bot;
    title: string;
}

export type SystemPortalSelectionUpdate =
    | SystemPortalHasSelectionUpdate
    | SystemPortalNoSelectionUpdate;

export interface SystemPortalHasSelectionUpdate {
    hasSelection: true;
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
    prefix: string;
    isScript: boolean;
    botId: string;
    tag: string;
    space: string;
}
