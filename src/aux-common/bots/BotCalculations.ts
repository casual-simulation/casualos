import {
    Object,
    Bot,
    Workspace,
    DEFAULT_WORKSPACE_SCALE,
    DEFAULT_WORKSPACE_HEIGHT,
    DEFAULT_WORKSPACE_GRID_SCALE,
    DEFAULT_BUILDER_USER_COLOR,
    DEFAULT_PLAYER_USER_COLOR,
    AuxDomain,
    BotShape,
    DEFAULT_BOT_SHAPE,
    BotTags,
    DEFAULT_WORKSPACE_SIZE,
    BotLabelAnchor,
    DEFAULT_LABEL_ANCHOR,
    BotDragMode,
    DimensionVisualizeMode,
    PrecalculatedBot,
    PrecalculatedTags,
    BotsState,
    DEFAULT_USER_INACTIVE_TIME,
    DEFAULT_USER_DELETION_TIME,
    BotPositioningMode,
    BotSpace,
    BOT_SPACE_TAG,
    PortalType,
    BotSubShape,
    BotOrientationMode,
    DEFAULT_ORIENTATION_MODE,
    BotAnchorPoint,
    DEFAULT_ANCHOR_POINT,
    PortalPointerDragMode,
    DEFAULT_PORTAL_POINTER_DRAG_MODE,
    BotLOD,
    BotLabelAlignment,
    DEFAULT_LABEL_ALIGNMENT,
    BotScaleMode,
    DEFAULT_SCALE_MODE,
} from './Bot';

import { BotCalculationContext, cacheFunction } from './BotCalculationContext';

import uuid from 'uuid/v4';
import flatMap from 'lodash/flatMap';
import union from 'lodash/union';
import keys from 'lodash/keys';
import intersection from 'lodash/intersection';
import some from 'lodash/some';
import assign from 'lodash/assign';
import find from 'lodash/find';
import values from 'lodash/values';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';
import cloneDeep from 'lodash/cloneDeep';
import difference from 'lodash/difference';
import mapValues from 'lodash/mapValues';

/// <reference path="../typings/global.d.ts" />
import { PartialBot } from '../bots';
import { merge, shortUuid } from '../utils';
import differenceBy from 'lodash/differenceBy';
import maxBy from 'lodash/maxBy';
import { BotObjectsContext } from './BotObjectsContext';

export var isFormulaObjectSymbol: symbol = Symbol('isFormulaObject');

export var ShortId_Length: number = 5;

/**
 * The default energy for actions.
 */
export const DEFAULT_ENERGY: number = 100_000;

export type SimulationIdParseResult =
    | SimulationIdParseFailure
    | SimulationIdParseSuccess;

export interface SimulationIdParseFailure {
    success: false;
}

export interface SimulationIdParseSuccess {
    success: true;
    channel?: string;
    host?: string;
}

export const POSSIBLE_DIMENSION_VISUALIZERS = ['*'] as const;

/**
 * Defines an interface that represents the difference between
 * to BotsState objects.
 */
export interface BotsStateDiff {
    addedBots: Bot[];
    removedBots: string[];
    updatedBots: Bot[];
}

/**
 * Determines whether the given tag value is a valid value or if
 * it represents nothing.
 * @param value The value.
 */
export function hasValue(value: unknown) {
    return !(value === null || typeof value === 'undefined' || value === '');
}

/**
 * Cleans the bot by removing any null or undefined properties.
 * @param bot The bot to clean.
 */
export function cleanBot(bot: Bot): Bot {
    let cleaned = merge({}, bot);
    // Make sure we're not modifying another bot's tags
    let newTags = merge({}, cleaned.tags);
    cleaned.tags = newTags;
    for (let property in cleaned.tags) {
        let value = cleaned.tags[property];
        if (!hasValue(value)) {
            delete cleaned.tags[property];
        }
    }
    return cleaned;
}

/**
 * Determines if the given workspace is currently minimized.
 * @param workspace The workspace.
 */
export function isMinimized(calc: BotCalculationContext, workspace: Workspace) {
    return getDimensionMinimized(calc, workspace);
}

/**
 * Determines if the given bot contains data for a dimension.
 */
export function isDimension(
    calc: BotCalculationContext,
    dimensionBot: Bot
): boolean {
    return getBotConfigDimensions(calc, dimensionBot).length > 0;
}

/**
 * Determines if the given dimension bot is being visualized in the viewport.
 */
export function isVisibleDimension(
    calc: BotCalculationContext,
    dimensionBot: Bot
): boolean {
    const result = calculateBotValue(
        calc,
        dimensionBot,
        'auxDimensionVisualize'
    );

    if (typeof result === 'string' && hasValue(result)) {
        return true;
    } else if (Array.isArray(result)) {
        return true;
    }
    return false;
}

/**
 * Filters the given list of bots by whether they belong to the given selection.
 * @param bots The bots to filter.
 * @param selectionId The selection to check.
 */
export function filterBotsBySelection<TBot extends Bot>(
    bots: TBot[],
    selectionId: string
) {
    return bots.filter(f => {
        if (f.id === selectionId) {
            return true;
        }
        if (selectionId === 'id' || selectionId === 'space') {
            return true;
        }
        for (let prop in f.tags) {
            const val = f.tags[prop];
            if (prop === selectionId && val) {
                return true;
            }
        }
        return false;
    });
}

/**
 * Gets the state that should be uploaded from the given data.
 * @param data The data.
 */
export function getUploadState(data: any): BotsState {
    if ('version' in data) {
        return data.state;
    }
    return data;
}

/**
 * Gets whether the bot is pointable.
 * @param calc The calculation context.
 * @param bot The bot.
 */
export function isBotPointable(calc: BotCalculationContext, bot: Bot): boolean {
    return calculateBooleanTagValue(calc, bot, 'auxPointable', true);
}

/**
 * Gets whether the bot is focusable.
 * @param calc The calculation context.
 * @param bot The bot.
 */
export function isBotFocusable(calc: BotCalculationContext, bot: Bot): boolean {
    return calculateBooleanTagValue(calc, bot, 'auxFocusable', true);
}

/**
 * Gets a list of tags that the given bots contain.
 *
 * @param bots The array of bots that the list of tags should be retrieved
 * for.
 * @param currentTags The current array of tags that is being displayed.
 *                    The new list will try to preserve the order of the tags
 * in this list.
 * @param extraTags The list of tags that should not be removed from the
 * output list.
 */
export function botTags(
    bots: Bot[],
    currentTags: string[],
    extraTags: string[],
    tagWhitelist: (string | boolean)[][] = []
) {
    const botTags = flatMap(bots, f => keys(f.tags));
    const tagsToKeep = union(botTags, extraTags);
    const allTags = union(currentTags, tagsToKeep);

    const onlyTagsToKeep = intersection(allTags, tagsToKeep);

    let allInactive = true;

    // if there is a blacklist index and the  first index [all] is not selected
    if (tagWhitelist != undefined && tagWhitelist.length > 0) {
        let filteredTags: string[] = [];

        for (let i = tagWhitelist.length - 1; i >= 0; i--) {
            if (tagWhitelist[i][1]) {
                allInactive = false;
            }
        }

        if (!allInactive) {
            for (let i = tagWhitelist.length - 1; i >= 0; i--) {
                if (!tagWhitelist[i][1]) {
                    for (let j = 2; j < tagWhitelist[i].length; j++) {
                        for (let k = onlyTagsToKeep.length - 1; k >= 0; k--) {
                            if (
                                onlyTagsToKeep[k] === <string>tagWhitelist[i][j]
                            ) {
                                onlyTagsToKeep.splice(k, 1);
                                break;
                            }
                        }
                    }
                }
            }
        } else {
            const initialTags = onlyTagsToKeep.filter(t => !isHiddenTag(t));
            return initialTags;
        }

        return onlyTagsToKeep;
    } else {
        return onlyTagsToKeep;
    }
}

export function getAllBotTags(bots: Bot[], includeHidden: boolean) {
    const botTags = flatMap(bots, f => keys(f.tags));

    const nonHiddenTags = botTags.filter(t => includeHidden || !isHiddenTag(t));

    return nonHiddenTags;
}

/**
 * Find bots that match the short ids.
 * @param bots The bots to search through.
 * @param shortIds The short ids to search for.
 * @returns bot array or null if no matches found.
 */
export function botsFromShortIds(
    bots: Bot[] | Object[],
    shortIds: string[]
): Bot[] {
    var matches: Bot[] = [];
    shortIds.forEach(shortId => {
        var bot = this.botFromShortId(bots, shortId);
        if (bot) matches.push(bot);
    });

    if (matches.length > 0) return matches;
    else return null;
}

/**
 * Find bot that matches the short id.
 * @param bots The bots to search through.
 * @param shortId The short id to search for.
 * @returns bot or undefined if no match found.
 */
export function botFromShortId(bots: Bot[] | Object[], shortId: string): Bot {
    return find(bots, (f: Bot | Object) => {
        return getShortId(f) === shortId;
    });
}

/**
 * Return the short id for the bot.
 * @param bot The bot to get short id for.
 */
export function getShortId(bot: Bot | Object | string): string {
    let id = typeof bot === 'string' ? bot : bot.id;
    let str = id.substr(0, ShortId_Length);

    if (id.startsWith('mod-')) {
        str = 'mod';
    }

    if (id.startsWith('config')) {
        str = 'config';
    }

    return str;
}

/**
 * Determines if the given tag is a hidden tag.
 * @param tag The tag to test.
 */
export function isHiddenTag(tag: string): boolean {
    return /^_/.test(tag) || /(\w+)\._/.test(tag);
}

export function isPrecalculated(
    bot: Object | PrecalculatedBot
): bot is PrecalculatedBot {
    return bot && (<PrecalculatedBot>bot).precalculated === true;
}

export function isExistingBot(bot: Object | PrecalculatedBot): bot is Bot {
    return bot && (<Bot>bot).id != undefined;
}

/**
 * Gets the space that the given bot lives in.
 * @param bot The bot.
 */
export function getBotSpace(bot: Bot): BotSpace {
    const type = bot.space;
    if (!hasValue(type)) {
        return 'shared';
    }
    return type;
}

export function calculateBotValue(
    context: BotObjectsContext,
    object: Object | PrecalculatedBot,
    tag: keyof BotTags
) {
    const value = calculateBotTagValue(object, tag);
    if (
        typeof value === 'undefined' &&
        typeof tag === 'string' &&
        tag.startsWith('aux') &&
        tag.length >= 4
    ) {
        const firstChar = tag.substring(3, 4);
        const rest = tag.substring(4);
        const newTag = firstChar.toLowerCase() + rest;
        return calculateBotTagValue(object, newTag);
    }
    return value;
}

function calculateBotTagValue(
    object: Object | PrecalculatedBot,
    tag: keyof BotTags
) {
    if (tag === 'id') {
        return object.id;
    } else if (tag === BOT_SPACE_TAG) {
        return getBotSpace(object);
    } else if (isPrecalculated(object)) {
        return object.values[tag];
    } else {
        return calculateValue(object, tag, object.tags[tag]);
    }
}

export function calculateFormattedBotValue(
    context: BotCalculationContext,
    bot: Object,
    tag: string
): string {
    const value = calculateBotValue(context, bot, tag);
    return formatValue(value);
}

/**
 * Determines if the given value represents a formula.
 */
export function isFormula(value: unknown): value is string {
    return typeof value === 'string' && value.indexOf('=') === 0;
}

/**
 * Determines if the given value represents a script.
 * @param value The value.
 */
export function isScript(value: unknown): value is string {
    return typeof value === 'string' && value.indexOf('@') === 0;
}

/**
 * Parses the given value into a script.
 * Returns the script if the value is a script.
 * Returns null if the value is not a script.
 * @param value The value to parse.
 */
export function parseScript(value: unknown): string | null {
    if (isScript(value)) {
        return value.substring(1);
    }
    return null;
}

/**
 * Determines if the given value contains a formula.
 * This is different from isFormula() because it checks arrays for containing formulas in their elements.
 * @param value The value to check.
 */
export function containsFormula(value: string): boolean {
    return (
        isFormula(value) ||
        (isArray(value) && some(parseArray(value), v => isFormula(v)))
    );
}

/**
 * Determines if the given string value represents an array.
 */
export function isArray(value: unknown): boolean {
    return (
        typeof value === 'string' &&
        value.indexOf('[') === 0 &&
        value.lastIndexOf(']') === value.length - 1
    );
}

/**
 * Parses the given string value that represents an array into an actual array.
 * @see isArray
 */
export function parseArray(value: string): string[] {
    var array: string[] = value.slice(1, value.length - 1).split(',');
    if (array && array.length > 0 && array[0].length > 0) {
        // trim all entries.
        return array.map(s => {
            return s.trim();
        });
    } else {
        return [];
    }
}

/**
 * Determines if the given value represents a number.
 */
export function isNumber(value: string): boolean {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        (/^-?\d*(?:\.?\d+)?$/.test(value) ||
            (typeof value === 'string' && 'infinity' === value.toLowerCase()))
    );
}

/**
 * Determines if the given object is a bot.
 * @param object The object to check.
 */
export function isBot(object: any): object is Bot {
    if (object) {
        return !!object.id && !!object.tags;
    }
    return false;
}

/**
 * Gets the array of objects in the given state that are currently active.
 * @param state The state to get the active objects of.
 */
export function getActiveObjects(state: BotsState) {
    return <Object[]>values(state);
}

/**
 * Determines if the given tag is "well known".
 * @param tag The tag.
 */
export function isTagWellKnown(tag: string): boolean {
    return isHiddenTag(tag);
}

/**
 * Determines if the bots are equal disregarding well-known hidden tags
 * and their IDs. Bot "appearance equality" means instead of asking "are these bots exactly the same?"
 * we ask "are these bots functionally the same?". In this respect we care about things like color, label, etc.
 * We also care about things like auxDraggable but not _position, _index _selection, etc.
 *
 * You can determine if a tag is "well-known" by using isTagWellKnown().
 * @param first The first bot.
 * @param second The second bot.
 */
export function doBotsAppearEqual(
    first: Object,
    second: Object,
    options: BotAppearanceEqualityOptions = {}
): boolean {
    if (first === second) {
        return true;
    } else if (!first || !second) {
        return false;
    }

    options = merge(
        {
            ignoreSelectionTags: true,
            ignoreId: false,
        },
        options
    );

    if (!options.ignoreId && first.id === second.id) {
        return true;
    }

    const tags = union(keys(first.tags), keys(second.tags));
    const usableTags = tags.filter(t => !isTagWellKnown(t));

    let allEqual = true;
    for (let t of usableTags) {
        if (!isEqual(first.tags[t], second.tags[t])) {
            allEqual = false;
            break;
        }
    }

    return allEqual;
}

export interface BotAppearanceEqualityOptions {
    ignoreId?: boolean;
}

/**
 * Defines an interface that represents the result of validating a tag.
 */
export interface TagValidation {
    valid: boolean;
    'tag.required'?: TagRequired;
    'tag.invalidChar'?: TagInvalidChar;
}

export interface TagRequired {}

export interface TagInvalidChar {
    char: string;
}

/**
 * Validates the given tag and returns any errors for it.
 * @param tag The tag.
 */
export function validateTag(tag: string) {
    let errors: TagValidation = {
        valid: true,
    };
    if (!tag || !tag.trim()) {
        errors.valid = false;
        errors['tag.required'] = {};
    } else {
        if (tag.indexOf('#') >= 0) {
            errors.valid = false;
            errors['tag.invalidChar'] = { char: '#' };
        }
    }

    return errors;
}

/**
 * Gets a partial bot that toggles whether the given bot is apart of the given selection.
 * @param bot The bot.
 * @param selectionId The ID of the selection.
 * @param userId The User that is adding the bot to the selection.
 */
export function toggleBotSelection(
    bot: Object,
    selectionId: string,
    userId: string
) {
    return {
        tags: {
            [selectionId]: !bot.tags[selectionId],
        },
    };
}

/**
 * Gets the color that the given user bot should appear as.
 * @param calc The bot calculation context.
 * @param userBot The user bot.
 * @param globalsBot The globals bot.
 * @param domain The domain.
 */
export function getUserBotColor(
    calc: BotCalculationContext,
    userBot: Bot,
    domain: AuxDomain
): string {
    if (userBot.tags['auxColor']) {
        return calculateBotValue(calc, userBot, 'auxColor');
    }

    if (domain === 'builder') {
        return DEFAULT_BUILDER_USER_COLOR;
    } else {
        return DEFAULT_PLAYER_USER_COLOR;
    }
}

/**
 * Gets the menu ID that is used for the given user.
 * @param userBot The bot for the user.
 */
export function getUserMenuId(calc: BotCalculationContext, userBot: Bot) {
    return calculateBotValue(calc, userBot, 'auxMenuPortal');
}

/**
 * Gets the list of bots that are in the user's menu.
 * @param calc The bot calculation context.
 * @param userBot The user bot to use.
 */
export function getBotsInMenu(
    calc: BotCalculationContext,
    userBot: Bot
): Bot[] {
    const context = getUserMenuId(calc, userBot);
    return botsInDimension(calc, context);
}

/**
 * Gets the list of bots that are in the given dimension.
 * @param calc The bot calculation context.
 * @param dimension The dimension to search for bots in.
 */
export function botsInDimension(
    calc: BotCalculationContext,
    dimension: string
): Bot[] {
    const bots = calc.objects.filter(f => isBotInDimension(calc, f, dimension));
    return sortBy(bots, f => botDimensionSortOrder(calc, f, dimension));
}

/**
 * Gets a diff that adds a bot to the given dimension.
 * If the bot is already in the dimension, then nothing happens.
 * If other bots are already at the given position, then the bot will be placed at the topmost index.
 * @param calc The bot calculation context.
 * @param dimension The dimension that the bot should be added to.
 * @param x The x position that the bot should be placed at.
 * @param y The x position in the dimension that the bot should be placed at.
 * @param index The index that the bot should be placed at.
 */
export function addToDimensionDiff(
    calc: BotCalculationContext,
    dimension: string,
    x: number = 0,
    y: number = 0,
    index?: number
): BotTags {
    const bots = objectsAtDimensionGridPosition(calc, dimension, { x, y });
    return {
        [dimension]: true,
        ...setPositionDiff(
            calc,
            dimension,
            x,
            y,
            typeof index === 'undefined' ? bots.length : index
        ),
    };
}

/**
 * Gets a diff that removes a bot from the given dimension.
 * @param calc The bot calculation context.
 * @param dimension The dimension that the bot should be removed from.
 */
export function removeFromDimensionDiff(
    calc: BotCalculationContext,
    dimension: string
): BotTags {
    return {
        [dimension]: null,
        [`${dimension}X`]: null,
        [`${dimension}Y`]: null,
        [`${dimension}SortOrder`]: null,
    };
}

/**
 * Gets a diff that sets a bot's position in the given dimension.
 * @param calc The bot calculation context.
 * @param dimension The dimension.
 * @param x The X position.
 * @param y The Y position.
 * @param index The index.
 */
export function setPositionDiff(
    calc: BotCalculationContext,
    dimension: string,
    x?: number,
    y?: number,
    index?: number
): BotTags {
    let tags: BotTags = {};
    if (typeof x === 'number') {
        tags[`${dimension}X`] = x;
    }
    if (typeof y === 'number') {
        tags[`${dimension}Y`] = y;
    }
    if (typeof index === 'number') {
        tags[`${dimension}SortOrder`] = index;
    }
    return tags;
}

/**
 * Gets the bot update needed to add the given bot to the given user's menu.
 * @param calc The calculation context.
 * @param userBot The bot of the user.
 * @param id The ID that should be used for the menu item. This is separate from bot ID.
 * @param index The index that the bot should be added to. Positive infinity means add at the end. 0 means add at the beginning.
 */
export function addBotToMenu(
    calc: BotCalculationContext,
    userBot: Bot,
    id: string,
    index: number = Infinity
): PartialBot {
    const dimension = getUserMenuId(calc, userBot);
    const bots = getBotsInMenu(calc, userBot);
    const idx = isFinite(index) ? index : bots.length;
    return {
        tags: {
            [`${dimension}Id`]: id,
            [`${dimension}SortOrder`]: idx,
            [dimension]: true,
        },
    };
}

/**
 * Gets the bot update needed to remove a bot from the given user's menu.
 * @param calc The bot calculation context.
 * @param userBot The bot of the user.
 */
export function removeBotFromMenu(
    calc: BotCalculationContext,
    userBot: Bot
): PartialBot {
    const dimension = getUserMenuId(calc, userBot);
    return {
        tags: {
            [dimension]: null,
            [`${dimension}Id`]: null,
            [`${dimension}SortOrder`]: null,
        },
    };
}

/**
 * Gets the list of tags that are on the given bot.
 * @param bot
 */
export function tagsOnBot(bot: PartialBot): string[] {
    let tags = keys(bot.tags);
    return tags;
}

/**
 * Gets the specified tag value from the specified bot.
 * @param bot The bot that the tag should be retrieved from.
 * @param tag The tag to retrieve.
 */
export function getTag(bot: PartialBot, tag: string) {
    return bot.tags[tag];
}

/**
 * Gets the specified tag from the specified bot.
 * @param bot The bot that the tag should be retrieved from.
 * @param tag The tag to retrieve.
 */
export function getBotTag(bot: Bot, tag: string) {
    if (tag === 'id') {
        return bot.id;
    } else if (tag === BOT_SPACE_TAG) {
        return getBotSpace(bot);
    }
    return getTag(bot, tag);
}

/**
 * Creates a new codimensionntext ID.
 */
export function createDimensionId() {
    return `${shortUuid()}`;
}

/**
 * Creates a bot with a new ID and the given tags.
 * @param id The ID of the bot.
 * @param tags The tags to use in the bot.
 * @param space The space of the bot.
 */
export function createBot(
    id = uuid(),
    tags: Object['tags'] = {},
    space?: BotSpace
): Bot {
    if (hasValue(space)) {
        return {
            id,
            tags,
            space,
        };
    }
    return { id, tags };
}

export function createPrecalculatedBot(
    id = uuid(),
    values: PrecalculatedTags = {},
    tags?: Object['tags'],
    space?: BotSpace
): PrecalculatedBot {
    if (hasValue(space)) {
        return {
            id,
            space,
            precalculated: true,
            tags: tags || values,
            values,
        };
    }
    return {
        id,
        precalculated: true,
        tags: tags || values,
        values,
    };
}

/**
 * Creates a new Workspace with default values.
 * @param id The ID of the new workspace.
 * @param builderDimensionId The tag that should be used for contexts stored on this workspace.
 * @param locked Whether the dimension is allowed to be accessed via AUX Player.
 */
export function createWorkspace(
    id = uuid(),
    builderDimensionId: string = createDimensionId(),
    locked: boolean = false
): Workspace {
    // checks if given dimension string is empty or just whitespace
    if (builderDimensionId.length === 0 || /^\s*$/.test(builderDimensionId)) {
        builderDimensionId = createDimensionId();
    }

    if (locked) {
        return {
            id: id,
            tags: {
                auxDimensionX: 0,
                auxDimensionY: 0,
                auxDimensionZ: 0,
                auxDimensionVisualize: 'surface',
                auxPortalLocked: true,
                auxDimensionConfig: builderDimensionId,
            },
        };
    } else {
        return {
            id: id,
            tags: {
                auxDimensionX: 0,
                auxDimensionY: 0,
                auxDimensionZ: 0,
                auxDimensionVisualize: 'surface',
                auxDimensionConfig: builderDimensionId,
            },
        };
    }
}

/**
 * Calculates the grid scale for the given workspace.
 * @param workspace
 */
export function calculateGridScale(
    calc: BotCalculationContext,
    workspace: Bot
): number {
    if (workspace) {
        const scale = calculateNumericalTagValue(
            calc,
            workspace,
            `auxPortalSurfaceScale`,
            DEFAULT_WORKSPACE_SCALE
        );
        const gridScale = calculateNumericalTagValue(
            calc,
            workspace,
            `auxPortalGridScale`,
            DEFAULT_WORKSPACE_GRID_SCALE
        );
        return calculateGridScaleFromConstants(scale, gridScale);
    } else {
        return calculateGridScaleFromConstants(
            DEFAULT_WORKSPACE_SCALE,
            DEFAULT_WORKSPACE_GRID_SCALE
        );
    }
}

/**
 * Calculates the grid scale from the given constants.
 * @param surfaceScale
 * @param gridScale
 */
export function calculateGridScaleFromConstants(
    surfaceScale: number,
    gridScale: number
) {
    return surfaceScale * gridScale;
}

/**
 * Calculates the difference between the two given states.
 * In particular, it calculates which operations need to be performed on prev in order to get current.
 * The returned object contains the bots that were added, removed, and/or updated between the two states.
 * This operation runs in O(n) time where n is the number of bots.
 * @param prev The previous state.
 * @param current The current state.
 */
export function calculateStateDiff(
    prev: BotsState,
    current: BotsState
): BotsStateDiff {
    prev = prev || {};
    current = current || {};

    let diff: BotsStateDiff = {
        addedBots: [],
        removedBots: [],
        updatedBots: [],
    };

    const ids = union(keys(prev), keys(current));

    ids.forEach(id => {
        const prevVal = prev[id];
        const currVal = current[id];

        if (prevVal && !currVal) {
            diff.removedBots.push(prevVal.id);
        } else if (!prevVal && currVal) {
            diff.addedBots.push(currVal);
        } else if (!isEqual(prevVal, currVal)) {
            diff.updatedBots.push(currVal);
        }
    });

    return diff;
}

/**
 * Trims the leading # symbol off the given tag.
 */
export function trimTag(tag: string): string {
    if (tag.startsWith('#') || tag.startsWith('@')) {
        return tag.substring(1);
    }
    return tag;
}

/**
 * Trims the leading # symbol and trailing () symbols from the given tag.
 * @param tag The tag.
 */
export function trimEvent(tag: string): string {
    const withoutHash = trimTag(tag);
    if (withoutHash.endsWith('()')) {
        return withoutHash.substring(0, withoutHash.length - 2);
    }
    return withoutHash;
}

/**
 * Gets a list of strings from the given bot and tag.
 * @param calc The bot calculation context.
 * @param bot The bot.
 * @param tag The tag.
 */
export function getBotStringList(
    calc: BotCalculationContext,
    bot: Bot,
    tag: string
): string[] {
    let value = calculateBotValue(calc, bot, tag);

    if (value && !Array.isArray(value)) {
        value = [value];
    }

    return value;
}

/**
 * Gets the AUX_BOT_VERSION number that the given bot was created with.
 * If not specified, then undefined is returned.
 * @param calc The bot calculation context.
 * @param bot THe bot.
 */
export function getBotVersion(calc: BotCalculationContext, bot: Bot) {
    return calculateNumericalTagValue(calc, bot, 'auxVersion', undefined);
}

/**
 * Gets the index that the given bot is at in the given dimension.
 * @param calc The calculation context to use.
 * @param bot The bot.
 * @param dimension The dimension.
 */
export function getBotIndex(
    calc: BotCalculationContext,
    bot: Bot,
    dimension: string
): number {
    return calculateNumericalTagValue(calc, bot, `${dimension}SortOrder`, 0);
}

/**
 * Gets the position that the given bot is at in the given dimension.
 * @param calc The calculation context to use.
 * @param bot The bot.
 * @param dimension The dimension.
 */
export function getBotPosition(
    calc: BotCalculationContext,
    bot: Bot,
    dimension: string
): { x: number; y: number; z: number } {
    return {
        x: calculateNumericalTagValue(calc, bot, `${dimension}X`, 0),
        y: calculateNumericalTagValue(calc, bot, `${dimension}Y`, 0),
        z: calculateNumericalTagValue(calc, bot, `${dimension}Z`, 0),
    };
}

/**
 * Gets the rotation that the given bot is at in the given dimension.
 * @param calc The calculation context to use.
 * @param bot The bot.
 * @param dimension The dimension.
 */
export function getBotRotation(
    calc: BotCalculationContext,
    bot: Bot,
    dimension: string
): { x: number; y: number; z: number } {
    return {
        x: calculateNumericalTagValue(calc, bot, `${dimension}RotationX`, 0),
        y: calculateNumericalTagValue(calc, bot, `${dimension}RotationY`, 0),
        z: calculateNumericalTagValue(calc, bot, `${dimension}RotationZ`, 0),
    };
}

/**
 * Calculates the auxScaleX, auxScaleY, and auxScaleZ values from the given object.
 * @param context The calculation context.
 * @param obj The object.
 * @param multiplier The value that scale values should be multiplied by.
 * @param defaultScale The default value.
 * @param prefix The optional prefix for the tags. Defaults to `aux.`
 */
export function getBotScale(
    context: BotCalculationContext,
    obj: Bot,
    defaultScale: number = 1,
    prefix: string = 'aux'
) {
    return cacheFunction(
        context,
        'getBotScale',
        () => {
            const scaleX = calculateNumericalTagValue(
                context,
                obj,
                `${prefix}ScaleX`,
                defaultScale
            );
            const scaleY = calculateNumericalTagValue(
                context,
                obj,
                `${prefix}ScaleY`,
                defaultScale
            );
            const scaleZ = calculateNumericalTagValue(
                context,
                obj,
                `${prefix}ScaleZ`,
                defaultScale
            );
            const uniformScale = calculateNumericalTagValue(
                context,
                obj,
                `${prefix}Scale`,
                1
            );

            return {
                x: scaleX * uniformScale,
                z: scaleZ * uniformScale,
                y: scaleY * uniformScale,
            };
        },
        obj.id,
        defaultScale,
        prefix
    );
}

/**
 * Gets the shape of the bot.
 * @param calc The calculation context to use.
 * @param bot The bot.
 */
export function getBotShape(calc: BotCalculationContext, bot: Bot): BotShape {
    const shape: BotShape = calculateBotValue(calc, bot, 'auxForm');
    if (
        shape === 'cube' ||
        shape === 'sphere' ||
        shape === 'sprite' ||
        shape === 'mesh' ||
        shape === 'iframe' ||
        shape === 'nothing'
    ) {
        return shape;
    }
    return DEFAULT_BOT_SHAPE;
}

/**
 * Gets the sub-shape of the bot.
 * @param calc The calculation context to use.
 * @param bot The bot.
 */
export function getBotSubShape(
    calc: BotCalculationContext,
    bot: Bot
): BotSubShape {
    const shape: BotSubShape = calculateBotValue(calc, bot, 'auxFormSubtype');
    if (shape === 'gltf' || shape === 'html' || shape === 'src') {
        return shape;
    }
    return null;
}

/**
 * Gets the anchor position for the bot's label.
 * @param calc The calculation context to use.
 * @param bot The bot.
 */
export function getBotLabelAnchor(
    calc: BotCalculationContext,
    bot: Bot
): BotLabelAnchor {
    return getBotTagAnchor(calc, bot, 'auxLabelPosition');
}

export function getBotTagAnchor(
    calc: BotCalculationContext,
    bot: Bot,
    tag: string
): BotLabelAnchor {
    const anchor: BotLabelAnchor = calculateBotValue(calc, bot, tag);
    if (
        anchor === 'back' ||
        anchor === 'floating' ||
        anchor === 'front' ||
        anchor === 'left' ||
        anchor === 'right' ||
        anchor === 'top'
    ) {
        return anchor;
    }
    return DEFAULT_LABEL_ANCHOR;
}

/**
 * Gets the text alignment for the bot's label.
 * @param calc The calculation context.
 * @param bot The bot.
 */
export function getBotLabelAlignment(
    calc: BotCalculationContext,
    bot: Bot
): BotLabelAlignment {
    const anchor: BotLabelAlignment = calculateBotValue(
        calc,
        bot,
        'auxLabelAlignment'
    );
    if (anchor === 'center' || anchor === 'left' || anchor === 'right') {
        return anchor;
    }
    return DEFAULT_LABEL_ALIGNMENT;
}

/**
 * Gets the text alignment for the bot's label.
 * @param calc The calculation context.
 * @param bot The bot.
 */
export function getBotScaleMode(
    calc: BotCalculationContext,
    bot: Bot
): BotScaleMode {
    const anchor: BotScaleMode = calculateBotValue(calc, bot, 'auxScaleMode');
    if (anchor === 'fit' || anchor === 'absolute') {
        return anchor;
    }
    return DEFAULT_SCALE_MODE;
}

/**
 * Gets the orientation mode for the given bot.
 * @param calc The calculation context.
 * @param bot The bot.
 */
export function getBotOrientationMode(
    calc: BotCalculationContext,
    bot: Bot
): BotOrientationMode {
    const mode = <BotOrientationMode>(
        calculateStringTagValue(
            calc,
            bot,
            'auxOrientationMode',
            DEFAULT_ORIENTATION_MODE
        )
    );
    if (
        mode === 'absolute' ||
        mode === 'billboard' ||
        mode === 'billboardTop' ||
        mode === 'billboardFront'
    ) {
        return mode;
    }
    return DEFAULT_ORIENTATION_MODE;
}

const possibleAnchorPoints = new Set([
    'center',
    'front',
    'back',
    'bottom',
    'top',
    'left',
    'right',
] as const);

/**
 * Gets the anchor point for the given bot.
 * @param calc The calculation context.
 * @param bot The bot.
 */
export function getBotAnchorPoint(
    calc: BotCalculationContext,
    bot: Bot
): BotAnchorPoint {
    const mode = <BotAnchorPoint>calculateBotValue(calc, bot, 'auxAnchorPoint');

    if (Array.isArray(mode)) {
        if (mode.length >= 3 && mode.every(v => typeof v === 'number')) {
            return mode;
        }
    } else if (possibleAnchorPoints.has(mode)) {
        return mode;
    }
    return DEFAULT_ANCHOR_POINT;
}

/**
 * Gets the anchor point offset for the bot in AUX coordinates.
 * @param calc The calculation context.
 * @param bot The bot.
 */
export function getAnchorPointOffset(
    calc: BotCalculationContext,
    bot: Bot
): {
    x: number;
    y: number;
    z: number;
} {
    const point = getBotAnchorPoint(calc, bot);
    if (typeof point === 'string') {
        let offset = {
            x: 0,
            y: 0,
            z: 0,
        };
        if (point === 'center') {
            offset.z = 0;
        } else if (point === 'top') {
            offset.z = -0.5;
        } else if (point === 'bottom') {
            offset.z = 0.5;
        } else if (point === 'front') {
            offset.y = -0.5;
        } else if (point === 'back') {
            offset.y = 0.5;
        } else if (point === 'left') {
            offset.x = 0.5;
        } else if (point === 'right') {
            offset.x = -0.5;
        } else {
            offset.z = 0.5;
        }

        return offset;
    } else {
        const [x, y, z] = point;
        return {
            x: -x,
            y: -y,
            z: -z,
        };
    }
}

const lodTags = new Set([
    'onMaxLODEnter',
    'onMaxLODExit',
    'onMinLODEnter',
    'onMinLODExit',
    'auxMaxLODThreshold',
    'auxMinLODThreshold',
] as const);

/**
 * Gets whether the bot has a tag to enable LODs.
 * @param calc The calculation context.
 * @param bot The bot.
 */
export function botHasLOD(calc: BotCalculationContext, bot: Bot): boolean {
    for (let tag of lodTags.values()) {
        const val = calculateBotValue(calc, bot, tag);
        if (isScript(val)) {
            return true;
        }
    }
    return false;
}

/**
 * Calcualtes the LOD that a bot should be in based on the virtual distance, minimum threshold, and maximum threshold.
 * @param virtualDistance The percentage of the screen that the bot takes up.
 * @param minThreshold The minimum LOD threshold.
 * @param maxThreshold The maximum LOD threshold.
 */
export function calculateBotLOD(
    virtualDistance: number,
    minThreshold: number,
    maxThreshold: number
): BotLOD {
    return virtualDistance < minThreshold
        ? 'min'
        : virtualDistance > maxThreshold
        ? 'max'
        : 'normal';
}

/**
 * Calculates the portal raycast mode that the given bot has set.
 * @param calc The calculation context.
 * @param bot The portal config bot.
 */
export function calculatePortalPointerDragMode(
    calc: BotCalculationContext,
    bot: Bot
): PortalPointerDragMode {
    const mode = <PortalPointerDragMode>(
        calculateStringTagValue(
            calc,
            bot,
            'auxPortalPointerDragMode',
            DEFAULT_PORTAL_POINTER_DRAG_MODE
        )
    );
    if (mode === 'grid' || mode === 'world') {
        return mode;
    }
    return DEFAULT_PORTAL_POINTER_DRAG_MODE;
}

/**
 * Determines if the given bot is a config bot for the given dimension.
 * @param calc The calculation context.
 * @param bot The bot to check.
 * @param dimension The dimension to check if the bot is the config of.
 */
export function isConfigForContext(
    calc: BotCalculationContext,
    bot: Bot,
    dimension: string
) {
    const contexts = getBotConfigDimensions(calc, bot);
    return contexts.indexOf(dimension) >= 0;
}

/**
 * Gets whether the dimension(s) that the given bot represents are locked.
 * Uses at the auxPortalLocked tag to determine whether it is locked.
 * @param calc The calculation context.
 * @param bot The bot.
 */
export function isDimensionLocked(
    calc: BotCalculationContext,
    bot: Bot
): boolean {
    return calculateBooleanTagValue(calc, bot, 'auxPortalLocked', false);
}

/**
 * Gets the list of contexts that the given bot is a config bot for.
 * @param calc The calculation context.
 * @param bot The bot that represents the dimension.
 */
export function getBotConfigDimensions(
    calc: BotCalculationContext,
    bot: Bot
): string[] {
    const result = calculateBotValue(calc, bot, 'auxDimensionConfig');
    return parseBotConfigDimensions(result);
}

/**
 * Parses a list of dimension names from the given value.
 * @param value The value to parse.
 */
export function parseBotConfigDimensions(value: any): string[] {
    if (typeof value === 'string' && hasValue(value)) {
        return [value];
    } else if (typeof value === 'number' && hasValue(value)) {
        return [value.toString()];
    } else if (typeof value === 'boolean' && hasValue(value)) {
        return [value.toString()];
    } else if (Array.isArray(value)) {
        return value;
    }
    return [];
}

/**
 * Gets a value from the given dimension bot.
 * @param calc The calculation context.
 * @param dimensionBot The bot that represents the dimension.
 * @param name The name of the value to get.
 */
export function getDimensionValue(
    calc: BotCalculationContext,
    dimensionBot: Bot,
    name: string
): any {
    return calculateBotValue(calc, dimensionBot, `auxPortal${name}`);
}

/**
 * Gets the drag mode for the bot.
 * @param calc The bot calculation context.
 * @param bot The bot to check.
 */
export function getBotDragMode(
    calc: BotCalculationContext,
    bot: Bot
): BotDragMode {
    const draggable = calculateBooleanTagValue(calc, bot, 'auxDraggable', true);
    const val = calculateStringTagValue(calc, bot, 'auxDraggableMode', null);
    if (!draggable) {
        return 'none';
    }
    if (
        val === 'all' ||
        val === 'none' ||
        val === 'pickupOnly' ||
        val === 'moveOnly'
    ) {
        return val;
    } else {
        return 'all';
    }
}

/**
 * Gets whether the given bot is stackable.
 * @param calc The calculation context.
 * @param bot The bot to check.
 */
export function isBotStackable(calc: BotCalculationContext, bot: Bot): boolean {
    return getBotPositioningMode(calc, bot) === 'stack';
}

/**
 * Gets the positioning mode for the bot.
 * @param calc The calculation context.
 * @param bot The bot.
 */
export function getBotPositioningMode(
    calc: BotCalculationContext,
    bot: Bot
): BotPositioningMode {
    const mode = calculateStringTagValue(
        calc,
        bot,
        'auxPositioningMode',
        'stack'
    );
    if (mode === 'stack' || mode === 'absolute') {
        return mode;
    }
    return 'stack';
}

/**
 * Gets whether the given bot is movable.
 * @param calc The calculation context.
 * @param bot The bot to check.
 */
export function isBotMovable(calc: BotCalculationContext, bot: Bot): boolean {
    // checks if bot is movable, but we should also allow it if it is pickupable so we can drag it into inventory if movable is false
    return calculateBooleanTagValue(calc, bot, 'auxDraggable', true);
}

/**
 * Gets whether the given bot is listening for shouts or whispers.
 * @param calc The calculation context.
 * @param bot The bot to check.
 */
export function isBotListening(calc: BotCalculationContext, bot: Bot): boolean {
    // checks if bot is movable, but we should also allow it if it is pickupable so we can drag it into inventory if movable is false
    return calculateBooleanTagValue(calc, bot, 'auxListening', true);
}

/**
 * Gets whether the given bot's dimension is movable.
 * @param calc The calculation context.
 * @param bot The bot to check.
 */
export function isDimensionMovable(
    calc: BotCalculationContext,
    bot: Bot
): boolean {
    return calculateBooleanTagValue(
        calc,
        bot,
        'auxDimensionSurfaceMovable',
        true
    );
}

/**
 * Gets the position that the dimension should be at using the given bot.
 * @param calc The calculation context to use.
 * @param bot The bot that represents the dimension.
 */
export function getDimensionPosition(
    calc: BotCalculationContext,
    bot: Bot
): { x: number; y: number; z: number } {
    return {
        x: calculateNumericalTagValue(calc, bot, `auxDimensionX`, 0),
        y: calculateNumericalTagValue(calc, bot, `auxDimensionY`, 0),
        z: calculateNumericalTagValue(calc, bot, `auxDimensionZ`, 0),
    };
}

/**
 * Gets the rotation that the dimension should be at using the given bot.
 * @param calc The calculation context to use.
 * @param bot The bot that represents the dimension.
 */
export function getDimensionRotation(
    calc: BotCalculationContext,
    bot: Bot
): { x: number; y: number; z: number } {
    return {
        x: calculateNumericalTagValue(calc, bot, `auxDimensionOrientationX`, 0),
        y: calculateNumericalTagValue(calc, bot, `auxDimensionOrientationY`, 0),
        z: calculateNumericalTagValue(calc, bot, `auxDimensionOrientationZ`, 0),
    };
}

/**
 * Gets whether the dimension is minimized.
 * @param calc The calculation context to use.
 * @param bot The bot that represents the dimension.
 */
export function getDimensionMinimized(
    calc: BotCalculationContext,
    bot: Bot
): boolean {
    return getDimensionValue(calc, bot, 'SurfaceMinimized');
}

/**
 * Gets the color of the dimension.
 * @param calc The calculation context to use.
 * @param bot The bot that represents the dimension.
 */
export function getDimensionColor(
    calc: BotCalculationContext,
    bot: Bot
): string {
    return getDimensionValue(calc, bot, 'Color');
}

/**
 * Gets the size of the dimension.
 * @param calc The calculation context to use.
 * @param bot The bot that represents the dimension.
 */
export function getDimensionSize(
    calc: BotCalculationContext,
    bot: Bot
): number {
    if (getDimensionVisualizeMode(calc, bot) === 'surface') {
        return calculateNumericalTagValue(
            calc,
            bot,
            `auxDimensionSurfaceSize`,
            DEFAULT_WORKSPACE_SIZE
        );
    }
    return 0;
}

/**
 * Gets the auxDimensionVisualize mode from the given bot.
 * @param calc The calculation context.
 * @param bot The bot.
 */
export function getDimensionVisualizeMode(
    calc: BotCalculationContext,
    bot: Bot
): DimensionVisualizeMode {
    const val = calculateBotValue(calc, bot, 'auxDimensionVisualize');
    if (typeof val === 'boolean') {
        return val;
    }
    if (val === 'surface') {
        return val;
    } else {
        return false;
    }
}

/**
 * Gets the grid of the dimension.
 * @param calc The calculation context to use.
 * @param bot The bot that represents the dimension.
 */
export function getBuilderDimensionGrid(
    calc: BotCalculationContext,
    bot: Bot
): { [key: string]: number } {
    const tags = tagsOnBot(bot);
    const gridTags = tags.filter(
        t =>
            t.indexOf('auxDimensionConfig.surface.grid.') === 0 &&
            t.indexOf(':') > 0
    );

    let val: { [key: string]: number } = {};
    for (let tag of gridTags) {
        val[
            tag.substr('auxDimensionConfig.surface.grid.'.length)
        ] = calculateNumericalTagValue(calc, bot, tag, undefined);
    }

    return val;
}

/**
 * Gets the height of the specified grid on the dimension.
 * @param calc The calculation context to use.
 * @param bot The bot that represents the dimension.
 * @param key The key for the grid position to lookup in the dimension grid.
 */
export function getDimensionGridHeight(
    calc: BotCalculationContext,
    bot: Bot,
    key: string
): number {
    let contextGrid = getBuilderDimensionGrid(calc, bot);
    if (contextGrid && contextGrid[key]) {
        if (contextGrid[key]) {
            return contextGrid[key];
        }
    }

    return DEFAULT_WORKSPACE_HEIGHT;
}

/**
 * Gets the grid scale of the dimension.
 * @param calc The calculation context to use.
 * @param bot The bot that represents the dimension.
 */
export function getDimensionGridScale(
    calc: BotCalculationContext,
    bot: Bot
): number {
    return getDimensionValue(calc, bot, 'GridScale');
}

/**
 * Gets the scale of the dimension.
 * @param calc The calculation context to use.
 * @param bot The bot that represents the dimension.
 */
export function getDimensionScale(
    calc: BotCalculationContext,
    bot: Bot
): number {
    return (
        getDimensionValue(calc, bot, 'SurfaceScale') || DEFAULT_WORKSPACE_SCALE
    );
}

/**
 * Gets the default height of the dimension.
 * @param calc The calculation context to use.
 * @param bot The bot that represents the dimension.
 */
export function getDimensionDefaultHeight(
    calc: BotCalculationContext,
    bot: Bot
): number {
    return getDimensionValue(calc, bot, 'SurfaceDefaultHeight');
}

/**
 * Filters the given list of objects to those matching the given workspace ID and grid position.
 * The returned list is in the order of their indexes.
 * @param calc The bot calculation context to use.
 * @param dimension The ID of the dimension that the objects need to be on.
 * @param position The position that the objects need to be at.
 */
export function objectsAtDimensionGridPosition(
    calc: BotCalculationContext,
    dimension: string,
    position: { x: number; y: number }
): Bot[] {
    return cacheFunction(
        calc,
        'objectsAtDimensionGridPosition',
        () => {
            const botsAtPosition = calc.lookup.query(
                calc,
                [dimension, `${dimension}X`, `${dimension}Y`],
                [true, position.x, position.y],
                [undefined, 0, 0]
            );
            return <Bot[]>(
                sortBy(
                    botsAtPosition,
                    o => getBotIndex(calc, o, dimension),
                    o => o.id
                )
            );
        },
        dimension,
        position.x,
        position.y
    );
}

/**
 * Calculates whether the given bot should be stacked onto another bot or if
 * it should be combined with another bot.
 * @param calc The bot calculation context.
 * @param dimension The dimension.
 * @param gridPosition The grid position that the bot is being dragged to.
 * @param bot The bot that is being dragged.
 */
export function calculateBotDragStackPosition(
    calc: BotCalculationContext,
    dimension: string,
    gridPosition: { x: number; y: number },
    ...bots: (Bot | BotTags)[]
) {
    const objs = differenceBy(
        objectsAtDimensionGridPosition(calc, dimension, gridPosition),
        bots,
        f => f.id
    );

    const canMerge = canMergeBots(calc, objs, bots);

    const firstBot = bots[0];

    // Can stack if we're dragging more than one bot,
    // or (if the single bot we're dragging is stackable and
    // the stack we're dragging onto is stackable)
    let canStack =
        bots.length > 1 ||
        ((isBotTags(firstBot) || isBotStackable(calc, firstBot)) &&
            (objs.length === 0 || isBotStackable(calc, objs[0])));

    const index = nextAvailableObjectIndex(calc, dimension, bots, objs);

    return {
        merge: canMerge,
        stackable: canStack,
        other: objs[0],
        index: index,
    };
}

function canMergeBots(
    calc: BotCalculationContext,
    objs: Bot[],
    bots: (Bot | BotTags)[]
) {
    return (
        objs.length >= 1 &&
        bots.length === 1 &&
        isBotTags(bots[0]) &&
        isMergeable(calc, objs[0])
    );
}

/**
 * Calculates the next available index that an object can be placed at on the given workspace at the
 * given grid position.
 * @param dimension The dimension.
 * @param gridPosition The grid position that the next available index should be found for.
 * @param bots The bots that we're trying to find the next index for.
 * @param objs The objects at the same grid position.
 */
export function nextAvailableObjectIndex(
    calc: BotCalculationContext,
    dimension: string,
    bots: (Bot | BotTags)[],
    objs: Bot[]
): number {
    const except = differenceBy(objs, bots, f => f.id);

    const indexes = except.map(o => ({
        object: o,
        index: getBotIndex(calc, o, dimension),
    }));

    // TODO: Improve to handle other scenarios like:
    // - Reordering objects
    // - Filling in gaps that can be made by moving bots from the center of the list
    const maxIndex = maxBy(indexes, i => i.index);
    let nextIndex = 0;
    if (maxIndex) {
        nextIndex = maxIndex.index + 1;
    }

    return nextIndex;
}

/**
 * Filters the given list of objects to those that are assigned to the given workspace ID.
 * @param objects The objects to filter.
 * @param workspaceId The ID of the workspace that the objects need to be on,
 */
export function objectsAtWorkspace(objects: Object[], workspaceId: string) {
    return objects.filter(o => {
        return o.tags._workspace === workspaceId;
    });
}

/**
 * Duplicates the given bot and returns a new bot with a new ID but the same tags.
 * The bot will be exactly the same as the previous except for 3 things.
 * First, it will have a different ID.
 * Second, it will never be marked as destroyed.
 * Third, it will not have any well known tags. (see isTagWellKnown())
 * @param calc The bot calculation context.
 * @param bot The bot to duplicate.
 * @param data The optional data that should override the existing bot data.
 */
export function duplicateBot(
    calc: BotCalculationContext,
    bot: Object,
    data?: PartialBot
): Object {
    let copy = cloneDeep(bot);
    const tags = tagsOnBot(copy);
    const tagsToRemove = filterWellKnownAndDimensionTags(calc, tags);
    tagsToRemove.forEach(t => {
        delete copy.tags[t];
    });

    let newBot = merge(copy, data || {});
    newBot.id = uuid();

    return <Object>cleanBot(newBot);
}

/**
 * Filters the given list of tags by whether they are well known or used in a dimension.
 * @param calc The bot calculation context.
 * @param tags The list of tags to filter.
 */
export function filterWellKnownAndDimensionTags(
    calc: BotCalculationContext,
    tags: string[]
) {
    const contextsToRemove = getDimensions(calc);
    const tagsToRemove = tags.filter(t =>
        isWellKnownOrDimension(t, contextsToRemove)
    );
    return tagsToRemove;
}

/**
 * Gets the list of contexts that the given calculation dimension contains.
 * @param calc The bot calculation context.
 */
export function getDimensions(calc: BotCalculationContext) {
    return union(...calc.objects.map(o => getBotConfigDimensions(calc, o)));
}

/**
 * Determines if the given tag is well known or in one of the given dimensions.
 * @param tag The tag to check.
 * @param dimensions The dimensions to check the tag against.
 */
export function isWellKnownOrDimension(tag: string, dimensions: string[]): any {
    return isTagWellKnown(tag) || dimensions.some(c => tag.indexOf(c) === 0);
}

/**
 * Determines if the given value is some bot tags.
 * @param value The value to test.
 */
export function isBotTags(value: any): value is BotTags {
    return !isBot(value);
}

/**
 * Determines if the given bot allows for merging.
 * @param bot The bot to check.
 */
export function isMergeable(calc: BotCalculationContext, bot: Bot): boolean {
    return true;
}

/**
 * Determines if the given bot allows for the bot to be place in inventory.
 * @param bot The bot to check.
 */
export function isPickupable(calc: BotCalculationContext, bot: Bot): boolean {
    if (!!bot && isBotMovable(calc, bot)) {
        const mode = getBotDragMode(calc, bot);
        return mode === 'pickupOnly' || mode === 'all';
    }
    return false;
}

export function simulationIdToString(id: SimulationIdParseSuccess): string {
    if (id.host) {
        let str = id.host;
        if (id.channel) {
            str += `?auxStory=${encodeURIComponent(id.channel)}`;
        }
        return str;
    }

    return id.channel;
}

export function parseSimulationId(id: string): SimulationIdParseSuccess {
    try {
        let uri = new URL(id);
        const channel = uri.searchParams.get('auxStory');
        if (channel) {
            return {
                success: true,
                host: `${uri.protocol}//${uri.host}`,
                channel,
            };
        } else {
            return {
                success: true,
                host: `${uri.protocol}//${uri.host}`,
            };
        }
    } catch (ex) {
        return {
            success: true,
            channel: id,
        };
    }
}

/**
 * Normalizes the given URL so that it will load the AUX bot instead of the web application.
 * @param url The URL.
 */
export function normalizeAUXBotURL(url: string): string {
    const parsed = new URL(url);

    if (
        parsed.pathname.indexOf('.aux') !==
        parsed.pathname.length - '.aux'.length
    ) {
        parsed.pathname = `${parsed.pathname}.aux`;
        return parsed.href;
    }

    return url;
}

/**
 * Calculates the value of the given tag on the given bot. If the result is not a bot, then the given default value
 * is returned.
 * @param context The context.
 * @param bot The bot.
 * @param tag The tag.
 * @param defaultValue The default value to use if the tag doesn't exist or the result is not a bot.
 */
export function calculateBotValueAsBot(
    context: BotCalculationContext,
    bot: Bot,
    tag: string,
    defaultValue: Bot
): Bot {
    if (bot.tags[tag]) {
        const result = calculateBotValue(context, bot, tag);
        if (isBot(result)) {
            return result;
        }
    }
    return defaultValue;
}

/**
 * Calculates the value of the given tag on the given bot as a list of strings.
 * @param context The calculation context.
 * @param bot The bot.
 * @param tag The tag.
 * @param defaultValue The default value.
 */
export function calculateStringListTagValue(
    context: BotCalculationContext,
    bot: Bot,
    tag: string,
    defaultValue: string[]
): string[] {
    let value: any = calculateBotValue(context, bot, tag);

    if (typeof value === 'undefined' || value === null || value === '') {
        return defaultValue;
    } else if (!Array.isArray(value)) {
        value = [value];
    }

    if (value) {
        for (let i = 0; i < value.length; i++) {
            let v = value[i];
            if (typeof v !== 'undefined' && v !== null) {
                value[i] = v.toString();
            }
        }
    }

    return value;
}

/**
 * Calculates the value of the given tag on the given bot. If the result is not a number, then the given default value
 * is returned.
 * @param context The calculation context.
 * @param bot The bot.
 * @param tag The tag.
 * @param defaultValue The default value to use if the tag doesn't exist or the result is not a number.
 */
export function calculateNumericalTagValue(
    context: BotCalculationContext,
    bot: Object,
    tag: string,
    defaultValue: number
): number {
    const result = calculateBotValue(context, bot, tag);
    if (typeof result === 'number' && result !== null) {
        return result;
    }
    return defaultValue;
}

/**
 * Calculates the value of the given tag on the given bot. If the result is not a boolean, then the given default value is returned.
 * @param context The context.
 * @param bot The bot.
 * @param tag The tag.
 * @param defaultValue The default value to use.
 */
export function calculateBooleanTagValue(
    context: BotCalculationContext,
    bot: Object,
    tag: string,
    defaultValue: boolean
): boolean {
    const result = calculateBotValue(context, bot, tag);
    if (typeof result === 'boolean' && result !== null) {
        return result;
    } else if (typeof result === 'object' && result instanceof Boolean) {
        return result.valueOf();
    }
    return defaultValue;
}

/**
 * Calculates the value of the given tag on the given bot. If the result is not a stirng, then the given default value is returned.
 * @param context THe context.
 * @param bot The bot.
 * @param tag The tag.
 * @param defaultValue The default value to use.
 */
export function calculateStringTagValue(
    context: BotCalculationContext,
    bot: Object,
    tag: string,
    defaultValue: string
): string {
    const result = calculateBotValue(context, bot, tag);
    if (typeof result === 'string' && result !== null) {
        return result;
    }
    return defaultValue;
}

/**
 * Determines if the given bot is able to be destroyed.
 * Defaults to true.
 * @param calc The bot calculation context.
 * @param bot The bot to check.
 */
export function isDestroyable(calc: BotCalculationContext, bot: Object) {
    return calculateBooleanTagValue(calc, bot, 'auxDestroyable', true);
}

/**
 * Determines if the given bot is able to be edited by the bot sheet.
 * Defaults to true.
 * @param calc The bot calculation context.
 * @param bot The bot to check.
 */
export function isEditable(calc: BotCalculationContext, bot: Object) {
    return calculateBooleanTagValue(calc, bot, 'auxEditable', true);
}

/**
 * Determines if the given bot is trying to load a simulation.
 * @param calc The calculation context.
 * @param bot The bot to check.
 */
export function isSimulation(
    calc: BotCalculationContext,
    bot: Object
): boolean {
    return !!getBotChannel(calc, bot);
}

/**
 * Gets the auxStory tag from the given bot.
 * @param calc The bot calculation context to use.
 * @param bot The bot.
 */
export function getBotChannel(
    calc: BotCalculationContext,
    bot: Object
): string {
    return calculateBotValue(calc, bot, 'auxStory');
}

/**
 * Gets the first bot which is in the aux.channels dimension that has the auxStory tag set to the given ID.
 * @param calc The bot calculation context.
 * @param id The ID to search for.
 */
export function getChannelBotById(calc: BotCalculationContext, id: string) {
    const bots = calc.objects.filter(o => {
        return (
            isBotInDimension(calc, o, 'aux.channels') &&
            calculateBotValue(calc, o, 'auxStory') === id
        );
    });

    if (bots.length > 0) {
        return bots[0];
    } else {
        return null;
    }
}

/**
 * Gets the number of connected devices that are connected from the given globals bot.
 * @param calc The bot calculation context.
 * @param bot The globals bot.
 */
export function getConnectedDevices(
    calc: BotCalculationContext,
    bot: Bot
): number {
    return calculateNumericalTagValue(calc, bot, 'auxConnectedSessions', 0);
}

/**
 * Returns wether or not the given bot resides in the given dimension id.
 * @param context The bot calculation context to run formulas with.
 * @param bot The bot.
 * @param dimensionId The id of the dimension that we are asking if the bot is in.
 */
export function isBotInDimension(
    context: BotCalculationContext,
    bot: Object,
    dimensionId: string
): boolean {
    if (!dimensionId) return false;

    let dimensionValue = calculateBooleanTagValue(
        context,
        bot,
        dimensionId.valueOf(),
        false
    ); //calculateBotValue(context, bot, dimensionId.valueOf());

    return dimensionValue;
}

/**
 * Gets the tag that is used to set the dimension for the given portal type.
 * @param portal The portal type.
 */
export function getPortalTag(portal: PortalType) {
    if (portal.endsWith('Portal')) {
        return portal;
    }
    const upper = portal[0].toUpperCase() + portal.slice(1);
    return `aux${upper}Portal`;
}

/**
 * Gets the ID of the bot that should be used to configure the given portal.
 * @param context The context.
 * @param bot The bot that is defining the portal.
 * @param portal The portal.
 */
export function getPortalConfigBotID(
    context: BotCalculationContext,
    bot: Bot,
    portal: PortalType
) {
    const tag = `${getPortalTag(portal)}ConfigBot`;
    return calculateStringTagValue(context, bot, tag, null);
}

/**
 * Gets the sort order that the given bot should appear in the given dimension.
 * @param context The bot calculation context.
 * @param bot The bot.
 * @param dimensionId The ID of the dimension that we're getting the sort order for.
 */
export function botDimensionSortOrder(
    context: BotCalculationContext,
    bot: Bot,
    dimensionId: string
): number | string {
    if (!dimensionId) return NaN;

    const dimensionValue = calculateBotValue(
        context,
        bot,
        `${dimensionId}SortOrder`
    );
    if (typeof dimensionValue === 'string') {
        return dimensionValue;
    } else if (typeof dimensionValue === 'number') {
        return dimensionValue;
    } else {
        return 0;
    }
}

export function isUserActive(calc: BotCalculationContext, bot: Bot) {
    return calculateBooleanTagValue(calc, bot, `auxPlayerActive`, false);
}

function _parseFilterValue(value: string): any {
    if (isArray(value)) {
        const split = parseArray(value);
        return split.map(v => _parseFilterValue(v));
    } else if (isNumber(value)) {
        return parseFloat(value);
    } else if (value === 'true') {
        return true;
    } else if (value === 'false') {
        return false;
    } else {
        return value;
    }
}

/**
 * Formats the given value and returns a string representing it.
 * @param value The value to format.
 */
export function formatValue(value: any): string {
    if (typeof value === 'object') {
        if (!value) {
            return null;
        } else if (Array.isArray(value)) {
            return `[${value.map(v => formatValue(v)).join(',')}]`;
        } else if (value instanceof Error) {
            return value.toString();
        } else {
            if (value.id) {
                return getShortId(value);
            } else {
                return JSON.stringify(value);
            }
        }
    } else if (typeof value !== 'undefined' && value !== null) {
        return value.toString();
    } else {
        return value;
    }
}

/**
 * Calculates the value of the given formula as if it was on the given bot (object) and tag.
 * @param object The bot that the formula was from.
 * @param tag The tag that the formula was from.
 * @param formula The formula.
 */
export function calculateValue(
    object: Bot,
    tag: keyof BotTags,
    formula: string
): any {
    if (isArray(formula)) {
        const split = parseArray(formula);
        return split.map(s => calculateValue(object, tag, s.trim()));
    } else if (isNumber(formula)) {
        return parseFloat(formula);
    } else if (formula === 'true') {
        return true;
    } else if (formula === 'false') {
        return false;
    } else {
        return formula;
    }
}

/**
 * Defines a symbol for a property that contains the original object that
 * a value was transformed from.
 */
export const ORIGINAL_OBJECT = Symbol('ORIGINAL_OBJECT');

/**
 * Gets the original object that the given object was constructed from.
 * Returns the object if there is no original object.
 * @param obj The object.
 */
export function getOriginalObject(obj: any): any {
    if (ORIGINAL_OBJECT in obj) {
        return obj[ORIGINAL_OBJECT];
    }
    return obj;
}
