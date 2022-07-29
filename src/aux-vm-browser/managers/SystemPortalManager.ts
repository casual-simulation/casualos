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
    isBotLink,
    calculateBotIdTagValue,
    calculateBotIds,
    SYSTEM_PORTAL_SEARCH,
    parseScriptSafe,
    parseScript,
    parseFormula,
    parseBotLink,
    formatValue,
    BOT_LINK_TAG_PREFIX,
    getScriptPrefix,
    KNOWN_TAG_PREFIXES,
    SYSTEM_TAG_NAME,
    calculateFormattedBotValue,
    DIFF_PORTAL,
    DIFF_PORTAL_BOT,
    BotTags,
    DIFF_PORTAL_TAG,
    DIFF_PORTAL_TAG_SPACE,
} from '@casual-simulation/aux-common';
import {
    BotHelper,
    BotWatcher,
    UpdatedBotInfo,
} from '@casual-simulation/aux-vm';
import { indexOf, isEqual, sortBy, union, unionBy } from 'lodash';
import {
    BehaviorSubject,
    combineLatest,
    merge,
    Observable,
    Observer,
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
    switchMap,
} from 'rxjs/operators';

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
export class SystemPortalManager implements SubscriptionLike {
    private _sub = new Subscription();
    private _watcher: BotWatcher;
    private _helper: BotHelper;
    private _itemsUpdated: BehaviorSubject<SystemPortalUpdate>;
    private _selectionUpdated: BehaviorSubject<SystemPortalSelectionUpdate>;
    private _recentsUpdated: BehaviorSubject<SystemPortalRecentsUpdate>;
    private _searchUpdated: BehaviorSubject<SystemPortalSearchUpdate>;
    private _diffUpdated: BehaviorSubject<SystemPortalDiffUpdate>;
    private _diffSelectionUpdated: BehaviorSubject<SystemPortalDiffSelectionUpdate>;
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

    get onSearchResultsUpdated(): Observable<SystemPortalSearchUpdate> {
        return this._searchUpdated;
    }

    get onDiffUpdated(): Observable<SystemPortalDiffUpdate> {
        return this._diffUpdated;
    }

    get onDiffSelectionUpdated(): Observable<SystemPortalDiffSelectionUpdate> {
        return this._diffSelectionUpdated;
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

        const itemsUpdated = this._calculateItemsUpdated();
        const itemsUpdatedDistinct = itemsUpdated.pipe(
            distinctUntilChanged((x, y) => isEqual(x, y))
        );

        const selectionUpdated =
            this._calculateSelectionUpdated(itemsUpdatedDistinct);

        const diffUpdated = this._calculateDiffUpdated(itemsUpdated);
        const diffSelectionUpdated =
            this._calculateDiffSelectionUpdated(diffUpdated);

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

        const selectedBotId = calculateBotIdTagValue(
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

        return bufferedEvents.pipe(map(() => this._findMatchingItems()));
    }

    private _findMatchingItems(): SystemPortalUpdate {
        if (!this._helper.userBot) {
            return {
                hasPortal: false,
            };
        }

        const systemTag = calculateStringTagValue(
            null,
            this._helper.userBot,
            SYSTEM_TAG_NAME,
            SYSTEM_TAG
        );
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
            let selectedBot: string = calculateBotIdTagValue(
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

                const system = calculateFormattedBotValue(null, bot, systemTag);

                if (
                    bot.id === selectedBot ||
                    (hasValue(system) &&
                        (showAllSystemBots || system.includes(systemPortal)))
                ) {
                    const area = getSystemArea(system);
                    const title = getBotTitle(system, area);

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
                        system,
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

    private _calculateSelectionUpdated(
        itemsUpdated: Observable<SystemPortalUpdate>
    ): Observable<SystemPortalSelectionUpdate> {
        return combineLatest([
            itemsUpdated,
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

            if (isBotLink(tagValue)) {
                selectionTag.isLink = true;
            }

            if (hasValue(space)) {
                selectionTag.space = space;
            }

            const prefix = getScriptPrefix(KNOWN_TAG_PREFIXES, tagValue);

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
        const changes = this._watcher.botTagsChanged(this._helper.userId);

        return changes.pipe(
            filter((c) => c.tags.has(EDITING_BOT) || c.tags.has(EDITING_TAG)),
            map(() => this._updateRecentsList())
        );
    }

    private _updateRecentsList(): SystemPortalRecentsUpdate {
        const newBotId = calculateBotIdTagValue(
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
        const systemTag = calculateStringTagValue(
            null,
            this._helper.userBot,
            SYSTEM_TAG_NAME,
            SYSTEM_TAG
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
        ): Pick<
            SystemPortalRecentTag,
            'hint' | 'isScript' | 'isFormula' | 'isLink' | 'system' | 'prefix'
        > {
            const tagValue = getTagValueForSpace(bot, tag, space);
            const isTagScript = isScript(tagValue);
            const isTagFormula = isFormula(tagValue);
            const isTagLink = isBotLink(tagValue);
            const tagPrefix = getScriptPrefix(KNOWN_TAG_PREFIXES, tagValue);
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

            if ((recentTagsCounts.get(`${tag}.${space}`) ?? 0) > 1) {
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

            return {
                hint: '',
                ...ret,
            };
        }
    }

    private _calculateDiffUpdated(
        itemsUpdated: Observable<SystemPortalUpdate>
    ): Observable<SystemPortalDiffUpdate> {
        return combineLatest([
            itemsUpdated,
            this._watcher.botTagsChanged(this._helper.userId).pipe(
                filter(
                    (change) =>
                        change.tags.has(DIFF_PORTAL) ||
                        change.tags.has(DIFF_PORTAL_BOT)
                ),
                startWith(1)
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
        if (!this._helper.userBot) {
            return {
                hasPortal: false,
            };
        }

        const diffTag = calculateStringTagValue(
            null,
            this._helper.userBot,
            DIFF_PORTAL,
            null
        );
        const systemTag = calculateStringTagValue(
            null,
            this._helper.userBot,
            SYSTEM_TAG_NAME,
            SYSTEM_TAG
        );

        if (!hasValue(diffTag)) {
            return {
                hasPortal: false,
            };
        }

        let selectedKey: string = calculateBotIdTagValue(
            this._helper.userBot,
            DIFF_PORTAL_BOT,
            null
        );

        let areas: SystemPortalDiffArea[] = [];
        let areasMap = new Map<string, SystemPortalDiffArea>();
        let systems = new Map<string, Bot[]>();
        for (let bot of this._helper.objects) {
            const system = calculateFormattedBotValue(null, bot, diffTag);
            if (hasValue(system)) {
                let list = systems.get(system);
                if (!list) {
                    list = [bot];
                    systems.set(system, list);
                } else {
                    list.push(bot);
                }
            }
        }

        for (let area of update.items) {
            let items: SystemPortalDiffBot[] = [];

            for (let item of area.bots) {
                if (systems.has(item.system)) {
                    const bots = systems.get(item.system);
                    const [bot] = bots.splice(0, 1);

                    if (bots.length <= 0) {
                        systems.delete(item.system);
                    }

                    const originalBot = item.bot;
                    const newBot = bot;

                    const changedTags = sortBy(
                        findChangedTags(originalBot, newBot).filter(
                            (t) => t.name !== diffTag && t.name !== systemTag
                        ),
                        (t) => t.name
                    );

                    items.push({
                        key: item.bot.id,
                        title: item.title,
                        originalBot: item.bot,
                        newBot: bot,
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
                    });
                }
            }

            if (items.length > 0) {
                let diffArea = {
                    area: area.area,
                    bots: items,
                };
                areas.push(diffArea);
                areasMap.set(area.area, diffArea);
            }
        }

        for (let [system, bots] of systems) {
            // added bots
            const area = getSystemArea(system);
            const title = getBotTitle(system, area);

            let diffArea = areasMap.get(area);
            if (!diffArea) {
                diffArea = {
                    area: area,
                    bots: [],
                };
                areasMap.set(area, diffArea);
                areas.push(diffArea);
            }

            for (let bot of bots) {
                diffArea.bots.push({
                    key: bot.id,
                    title: title,
                    addedBot: bot,
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
            this._watcher.botTagsChanged(this._helper.userId).pipe(
                filter(
                    (change) =>
                        change.tags.has(DIFF_PORTAL_BOT) ||
                        change.tags.has(DIFF_PORTAL_TAG) ||
                        change.tags.has(DIFF_PORTAL_TAG_SPACE)
                    // change.tags.has(SYSTEM_PORTAL_TAG_SPACE)
                ),
                startWith(1)
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

        const diffTag = calculateStringTagValue(
            null,
            this._helper.userBot,
            DIFF_PORTAL,
            null
        );
        const systemTag = calculateStringTagValue(
            null,
            this._helper.userBot,
            SYSTEM_TAG_NAME,
            SYSTEM_TAG
        );

        const selectedTag = calculateStringTagValue(
            null,
            this._helper.userBot,
            DIFF_PORTAL_TAG,
            null
        );
        const selectedSpace = calculateStringTagValue(
            null,
            this._helper.userBot,
            DIFF_PORTAL_TAG_SPACE,
            null
        );

        const newBot =
            'addedBot' in bot
                ? bot.addedBot
                : 'removedBot' in bot
                ? null
                : bot.newBot;
        const oldBot =
            'addedBot' in bot
                ? null
                : 'removedBot' in bot
                ? bot.removedBot
                : bot.originalBot;

        const changedTags = findChangedTags(oldBot, newBot).filter(
            (t) => t.name !== diffTag && t.name !== systemTag
        );

        return {
            hasSelection: true,
            newBot,
            originalBot: oldBot,
            tag: selectedTag,
            space: selectedSpace,
            tags: sortBy(changedTags, (t) => `${t.name}.${t.space}`),
        };
    }

    private _calculateSearchResults(): Observable<SystemPortalSearchUpdate> {
        const changes = this._watcher.botTagsChanged(this._helper.userId);

        return changes.pipe(
            filter(
                (c) =>
                    c.tags.has(SYSTEM_PORTAL_SEARCH) ||
                    c.tags.has(SYSTEM_TAG_NAME)
            ),
            switchMap(() => this._searchResultsUpdate())
        );
    }

    private _searchResultsUpdate(): Observable<SystemPortalSearchUpdate> {
        let runSearch = async (
            observer: Observer<SystemPortalSearchUpdate>,
            cancelFlag: Subscription
        ) => {
            const systemTag = calculateStringTagValue(
                null,
                this._helper.userBot,
                SYSTEM_TAG_NAME,
                SYSTEM_TAG
            );
            let bots = sortBy(this._helper.objects, (b) =>
                calculateFormattedBotValue(null, b, systemTag)
            );
            let areas = new Map<string, SystemPortalSearchBot[]>();
            let tagCounter = 0;
            let hasUpdate = false;
            let buffer = this._buffer;
            let matchCount = 0;
            let botCount = 0;
            const query = calculateStringTagValue(
                null,
                this._helper.userBot,
                SYSTEM_PORTAL_SEARCH,
                null
            );

            if (!query) {
                observer.next({
                    numMatches: 0,
                    numBots: 0,
                    items: [],
                });
                return;
            }

            function createUpdate(): SystemPortalSearchUpdate {
                let items = [] as SystemPortalSearchItem[];
                for (let [area, value] of areas) {
                    items.push({
                        area,
                        bots: value,
                    });
                }

                return {
                    numMatches: matchCount,
                    numBots: botCount,
                    items: sortBy(items, (i) => i.area),
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
                    let update = createUpdate();
                    observer.next(update);
                    return true;
                }
                return false;
            }

            for (let bot of bots) {
                if (cancelFlag.closed) {
                    break;
                }
                if (bot.id === this._helper.userId) {
                    continue;
                }
                const system = calculateFormattedBotValue(null, bot, systemTag);
                const area = getSystemArea(system);
                const title = getBotTitle(system, area);
                let tags = [] as SystemPortalSearchTag[];

                for (let tag in bot.tags) {
                    let value = bot.tags[tag];
                    const result = searchTag(tag, null, value, query);
                    if (result) {
                        tags.push(result);
                        matchCount += result.matches.length;
                        tagCounter += 1;
                    }
                }

                for (let space in bot.masks) {
                    let tags = bot.masks[space];
                    for (let tag in tags) {
                        let value = tags[tag];
                        const result = searchTag(tag, space, value, query);
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

            if (hasUpdate) {
                const update = createUpdate();
                observer.next(update);
            }
        };

        return new Observable<SystemPortalSearchUpdate>((observer) => {
            let sub = new Subscription();
            runSearch(observer, sub);
            return sub;
        });
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
    return (system ?? '').substring(area.length).replace(/^[\.]/, '');
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
    query: string
): SystemPortalSearchTag | null {
    let str = formatValue(value);
    if (hasValue(str)) {
        let isValueScript = isScript(str);
        let isValueFormula = isFormula(str);
        let isValueLink = isBotLink(str);
        let prefix = getScriptPrefix(KNOWN_TAG_PREFIXES, str);
        let parsedValue: string;
        let offset = 0;

        if (isValueScript) {
            parsedValue = parseScript(str);
            offset = 1;
        } else if (isValueFormula) {
            parsedValue = parseFormula(str);
            offset = DNA_TAG_PREFIX.length;
        } else if (isValueLink) {
            parsedValue = str.substring(BOT_LINK_TAG_PREFIX.length);
            offset = BOT_LINK_TAG_PREFIX.length;
        } else {
            parsedValue = str;
        }

        const matches = searchValue(parsedValue, offset, query);

        if (matches.length > 0) {
            let result: SystemPortalSearchTag = {
                tag,
                matches,
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
    }

    return null;
}

/**
 * Searches the given value for matches of the given query.
 * @param value The value to search.
 * @param indexOffset The offset that should be added to absolute indexes in the matches.
 * @param query The value to search for.
 * @returns
 */
export function searchValue(
    value: string,
    indexOffset: number,
    query: string
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
    system: string;
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
}

export interface SystemPortalDiffRemovedBot {
    key: string;
    title: string;
    removedBot: Bot;
}

export interface SystemPortalDiffUpdatedBot {
    key: string;
    title: string;
    originalBot: Bot;
    newBot: Bot;
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
    originalBot: Bot;
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
