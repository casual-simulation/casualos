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
    SelectionMode,
    DEFAULT_SELECTION_MODE,
    BotShape,
    DEFAULT_BOT_SHAPE,
    BotTags,
    DEFAULT_WORKSPACE_SIZE,
    BotLabelAnchor,
    DEFAULT_LABEL_ANCHOR,
    BotDragMode,
    ContextVisualizeMode,
    PrecalculatedBot,
    PrecalculatedTags,
    BotsState,
    DEFAULT_USER_INACTIVE_TIME,
    DEFAULT_USER_DELETION_TIME,
} from './Bot';

import {
    BotCalculationContext,
    BotSandboxContext,
    cacheFunction,
} from './BotCalculationContext';

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
import {
    setCalculationContext,
    getCalculationContext,
    getActions,
    getEnergy,
    setEnergy,
} from '../Formulas/formula-lib-globals';
import { PartialBot } from '../bots';
import { merge, shortUuid } from '../utils';
import { AuxBot, AuxObject, AuxOp, AuxState } from '../aux-format';
import { Atom } from '@casual-simulation/causal-trees';
import { differenceBy, maxBy } from 'lodash';

export var isFormulaObjectSymbol: symbol = Symbol('isFormulaObject');

export var ShortId_Length: number = 5;

/**
 * The name of the event that represents two bots getting combined.
 */
export const COMBINE_ACTION_NAME: string = 'onCombine';

/**
 * The name of the event that represents a bot being diffed into another bot.
 */
export const DIFF_ACTION_NAME: string = 'onMod';

/**
 * The name of the event that represents a bot being created.
 */
export const CREATE_ACTION_NAME: string = 'onCreate';

/**
 * The name of the event that represents a bot being destroyed.
 */
export const DESTROY_ACTION_NAME: string = 'onDestroy';

/**
 * The name of the event that represents a bot being dropped onto a context.
 */
export const DROP_ACTION_NAME: string = 'onBotDrop';

/**
 * The name of the event that represents any bot being dropped onto a context.
 */
export const DROP_ANY_ACTION_NAME: string = 'onAnyBotDrop';

/**
 * The name of the event that represents a bot starting to be dragged.
 */
export const DRAG_ACTION_NAME: string = 'onBotDrag';

/**
 * The name of the event that represents any bot starting to be dragged.
 */
export const DRAG_ANY_ACTION_NAME: string = 'onAnyBotDrag';

/**
 * The name of the event that is triggered when a QR Code is scanned.
 */
export const ON_QR_CODE_SCANNED_ACTION_NAME: string = 'onQRCodeScanned';

/**
 * The name of the event that is triggered when the QR Code scanner is closed.
 */
export const ON_QR_CODE_SCANNER_CLOSED_ACTION_NAME: string =
    'onQRCodeScannerClosed';

/**
 * The name of the event that is triggered when the QR Code scanner is opened.
 */
export const ON_QR_CODE_SCANNER_OPENED_ACTION_NAME: string =
    'onQRCodeScannerOpened';

/**
 * The name of the event that is triggered when the Barcode scanner is closed.
 */
export const ON_BARCODE_SCANNER_CLOSED_ACTION_NAME: string =
    'onBarcodeScannerClosed';

/**
 * The name of the event that is triggered when the Barcode scanner is opened.
 */
export const ON_BARCODE_SCANNER_OPENED_ACTION_NAME: string =
    'onBarcodeScannerOpened';

/**
 * The name of the event that is triggered when a Barcode is scanned.
 */
export const ON_BARCODE_SCANNED_ACTION_NAME: string = 'onBarcodeScanned';

/**
 * The name of the event that is triggered when the checkout process is completed.
 */
export const ON_CHECKOUT_ACTION_NAME: string = 'onCheckout';

/**
 * The name of the event that is triggered when payment has been approved for the checkout.
 */
export const ON_PAYMENT_SUCCESSFUL_ACTION_NAME: string = 'onPaymentSuccessful';

/**
 * The name of the event that is triggered when payment has been rejected for the checkout.
 */
export const ON_PAYMENT_FAILED_ACTION_NAME: string = 'onPaymentFailed';

/**
 * The name of the event that is triggered when webhooks have been received.
 */
export const ON_WEBHOOK_ACTION_NAME: string = 'onWebhook';

/**
 * The name of the event that is triggered on every bot when a shout has been executed.
 */
export const ON_ANY_SHOUT_ACTION_NAME: string = 'onAnyListen';

/**
 * The name of the event that is triggered when a shout has been executed.
 */
export const ON_SHOUT_ACTION_NAME: string = 'onListen';

/**
 * The name of the event that is triggered before an action is executed.
 */
export const ON_ACTION_ACTION_NAME: string = 'onChannelAction';

/**
 * The name of the event that is triggered when a channel becomes synced.
 */
export const ON_CHANNEL_STREAMING_ACTION_NAME: string = 'onChannelStreaming';

/**
 * The name of the event that is triggered when a channel has become unsynced.
 */
export const ON_CHANNEL_STREAM_LOST_ACTION_NAME: string = 'onChannelStreamLost';

/**
 * The name of the event that is triggered when a channel is loaded.
 */
export const ON_CHANNEL_SUBSCRIBED_ACTION_NAME: string = 'onChannelSubscribed';

/**
 * The name of the event that is triggered when a channel is unloaded.
 */
export const ON_CHANNEL_UNSUBSCRIBED_ACTION_NAME: string =
    'onChannelUnsubscribed';

/**
 * The default energy for actions.
 */
export const DEFAULT_ENERGY: number = 100_000;

/**
 * Defines an interface for objects that represent assignment formula expressions.
 * Assignment formula expressions are formulas that are only evaluated once.
 * Internally we store them as objects in the tag and display the calculated result.
 * This way, we can preserve the formula value if needed.
 */
export interface Assignment {
    _assignment: boolean;
    editing: boolean;
    formula: string;
    value?: any;
}

export type FilterParseResult = FilterParseSuccess | FilterParseFailure;

export interface FilterParseSuccess {
    success: true;
    eventName: string;
    tag: string;
    filter: {
        tag: string;
        value: any;
    };
}

export interface FilterParseFailure {
    success: false;
    partialSuccess: boolean;
    tag: string;
    eventName: string;
}

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
    context?: string;
}

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
    return getContextMinimized(calc, workspace);
}

/**
 * Determines if the given bot contains data for a context.
 */
export function isContext(
    calc: BotCalculationContext,
    contextBot: Bot
): boolean {
    return getBotConfigContexts(calc, contextBot).length > 0;
}

/**
 * Determines if the given context bot is being visualized in the viewport.
 */
export function isVisibleContext(
    calc: BotCalculationContext,
    contextBot: Bot
): boolean {
    const result = calculateBotValue(calc, contextBot, 'auxContextVisualize');

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
 * Gets a list of tags that the given bots contain.
 *
 * @param bots The array of bots that the list of tags should be retrieved
 * for.
 * @param currentTags The current array of tags that is being displayed.
 *                    The new list will try to preserve the order of the tags
 * in this list.
 * @param extraTags The list of tags that should not be removed from the
 * output list.
 * @param includeHidden Whether the hidden tags should be included in the output.
 */
export function botTags(
    bots: Bot[],
    currentTags: string[],
    extraTags: string[],
    includeHidden: boolean = false,
    tagBlacklist: (string | boolean)[][] = []
) {
    const botTags = flatMap(bots, f => keys(f.tags));
    // Only keep tags that don't start with an underscore (_)
    const nonHiddenTags = botTags.filter(t => includeHidden || !isHiddenTag(t));
    const tagsToKeep = union(nonHiddenTags, extraTags);
    const allTags = union(currentTags, tagsToKeep);

    const onlyTagsToKeep = intersection(allTags, tagsToKeep);

    let allInactive = true;

    // if there is a blacklist index and the  first index [all] is not selected
    if (tagBlacklist != undefined && tagBlacklist.length > 0) {
        let filteredTags: string[] = [];

        for (let i = tagBlacklist.length - 1; i >= 0; i--) {
            if (tagBlacklist[i][1]) {
                allInactive = false;
            }
        }

        if (!allInactive) {
            for (let i = tagBlacklist.length - 1; i >= 0; i--) {
                if (!tagBlacklist[i][1]) {
                    for (let j = 2; j < tagBlacklist[i].length; j++) {
                        for (let k = onlyTagsToKeep.length - 1; k >= 0; k--) {
                            if (
                                onlyTagsToKeep[k] === <string>tagBlacklist[i][j]
                            ) {
                                onlyTagsToKeep.splice(k, 1);
                                break;
                            }
                        }
                    }
                }
            }
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

export function calculateBotValue(
    context: BotCalculationContext,
    object: Object | PrecalculatedBot,
    tag: keyof BotTags,
    energy?: number
) {
    if (tag === 'id') {
        return object.id;
    } else if (isPrecalculated(object)) {
        return object.values[tag];
    } else {
        return calculateValue(
            <BotSandboxContext>context,
            object,
            tag,
            object.tags[tag],
            energy
        );
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
export function isFormula(value: unknown): boolean {
    return typeof value === 'string' && value.indexOf('=') === 0;
}

/**
 * Determines if the given value represents an assignment.
 */
export function isAssignment(object: any): any {
    return typeof object === 'object' && object && !!object._assignment;
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
export function isBot(object: any): object is AuxObject {
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
 * Determines if the given tag matches the filter syntax.
 */
export function isFilterTag(tag: string) {
    const parsed = parseFilterTag(tag);
    return parsed.success;
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
 * Well-known hidden tags include:
 * - _auxSelection
 * - context._index
 *
 * You can determine if a tag is "well-known" by using isWellKnownTag().
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
        const filter = parseFilterTag(tag);
        if (
            !(
                filter.success ||
                (filter.success === false && filter.partialSuccess)
            ) &&
            tag.indexOf('#') >= 0
        ) {
            errors.valid = false;
            errors['tag.invalidChar'] = { char: '#' };
        }
    }

    return errors;
}

/**
 * Gets the ID of the selection that the user is using.
 * If the user doesn't have a selection, returns a new selection ID.
 * @param user The user's bot.
 */
export function selectionIdForUser(user: Object) {
    if (user && user.tags['_auxSelection']) {
        return { id: user.tags['_auxSelection'] || null, newId: <string>null };
    } else {
        const id = newSelectionId();
        return { id: id, newId: id };
    }
}

/**
 * Gets a partial bot that updates a user's bot to reference the given selection.
 * @param selectionId The ID of the selection.
 * @param botId The ID of the bot that is being selected.
 */
export function updateUserSelection(selectionId: string, botId: string) {
    return {
        tags: {
            ['_auxSelection']: selectionId,
            ['_auxEditingBot']: botId,
        },
    };
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
 * Creates a new selection id.
 */
export function newSelectionId() {
    return `aux._selection_${shortUuid()}`;
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
    globalsBot: Bot,
    domain: AuxDomain
): string {
    if (userBot.tags['auxColor']) {
        return calculateBotValue(calc, userBot, 'auxColor');
    }

    if (domain === 'builder') {
        return (
            calculateBotValue(calc, globalsBot, 'auxChannelUserBuilderColor') ||
            DEFAULT_BUILDER_USER_COLOR
        );
    } else {
        return (
            calculateBotValue(calc, globalsBot, 'auxChannelUserPlayerColor') ||
            DEFAULT_PLAYER_USER_COLOR
        );
    }
}

/**
 * Gets the menu ID that is used for the given user.
 * @param userBot The bot for the user.
 */
export function getUserMenuId(calc: BotCalculationContext, userBot: Bot) {
    return calculateBotValue(calc, userBot, '_auxUserMenuContext');
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
    return botsInContext(calc, context);
}

/**
 * Gets the list of bots that are in the given context.
 * @param calc The bot calculation context.
 * @param context The context to search for bots in.
 */
export function botsInContext(
    calc: BotCalculationContext,
    context: string
): Bot[] {
    const bots = calc.objects.filter(f => isBotInContext(calc, f, context));
    return sortBy(bots, f => botContextSortOrder(calc, f, context));
}

/**
 * Gets a diff that adds a bot to the given context.
 * If the bot is already in the context, then nothing happens.
 * If other bots are already at the given position, then the bot will be placed at the topmost index.
 * @param calc The bot calculation context.
 * @param context The context that the bot should be added to.
 * @param x The x position that the bot should be placed at.
 * @param y The x position in the context that the bot should be placed at.
 * @param index The index that the bot should be placed at.
 */
export function addToContextDiff(
    calc: BotCalculationContext,
    context: string,
    x: number = 0,
    y: number = 0,
    index?: number
): BotTags {
    const bots = objectsAtContextGridPosition(calc, context, { x, y });
    return {
        [context]: true,
        ...setPositionDiff(
            calc,
            context,
            x,
            y,
            typeof index === 'undefined' ? bots.length : index
        ),
    };
}

/**
 * Gets a diff that removes a bot from the given context.
 * @param calc The bot calculation context.
 * @param context The context that the bot should be removed from.
 */
export function removeFromContextDiff(
    calc: BotCalculationContext,
    context: string
): BotTags {
    return {
        [context]: null,
        [`${context}.x`]: null,
        [`${context}.y`]: null,
        [`${context}.sortOrder`]: null,
    };
}

/**
 * Gets a diff that sets a bot's position in the given context.
 * @param calc The bot calculation context.
 * @param context The context.
 * @param x The X position.
 * @param y The Y position.
 * @param index The index.
 */
export function setPositionDiff(
    calc: BotCalculationContext,
    context: string,
    x?: number,
    y?: number,
    index?: number
): BotTags {
    let tags: BotTags = {};
    if (typeof x === 'number') {
        tags[`${context}.x`] = x;
    }
    if (typeof y === 'number') {
        tags[`${context}.y`] = y;
    }
    if (typeof index === 'number') {
        tags[`${context}.sortOrder`] = index;
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
    const context = getUserMenuId(calc, userBot);
    const bots = getBotsInMenu(calc, userBot);
    const idx = isFinite(index) ? index : bots.length;
    return {
        tags: {
            [`${context}.id`]: id,
            [`${context}.sortOrder`]: idx,
            [context]: true,
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
    const context = getUserMenuId(calc, userBot);
    return {
        tags: {
            [context]: null,
            [`${context}.id`]: null,
            [`${context}.sortOrder`]: null,
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
    return getTag(bot, tag);
}

/**
 * Creates a new context ID.
 */
export function createContextId() {
    return `${shortUuid()}`;
}

/**
 * Creates a bot with a new ID and the given tags.
 * @param id
 * @param tags
 */
export function createBot(id = uuid(), tags: Object['tags'] = {}) {
    const bot: Bot = { id: id, tags: tags };

    return bot;
}

export function createPrecalculatedBot(
    id = uuid(),
    values: PrecalculatedTags = {},
    tags?: Object['tags']
): PrecalculatedBot {
    return {
        id: id,
        precalculated: true,
        tags: tags || values,
        values: values,
    };
}

/**
 * Creates a new Workspace with default values.
 * @param id The ID of the new workspace.
 * @param builderContextId The tag that should be used for contexts stored on this workspace.
 * @param locked Whether the context is allowed to be accessed via AUX Player.
 */
export function createWorkspace(
    id = uuid(),
    builderContextId: string = createContextId(),
    locked: boolean = false
): Workspace {
    // checks if given context string is empty or just whitespace
    if (builderContextId.length === 0 || /^\s*$/.test(builderContextId)) {
        builderContextId = createContextId();
    }

    if (locked) {
        return {
            id: id,
            tags: {
                auxContextX: 0,
                auxContextY: 0,
                auxContextZ: 0,
                auxContextVisualize: 'surface',
                auxContextLocked: true,
                'aux.context': builderContextId,
            },
        };
    } else {
        return {
            id: id,
            tags: {
                auxContextX: 0,
                auxContextY: 0,
                auxContextZ: 0,
                auxContextVisualize: 'surface',
                'aux.context': builderContextId,
            },
        };
    }
}

/**
 * Performs a pre-process step for updating the given bot by nulling out falsy tags and also calculating assignments.
 * @param bot The bot to update.
 * @param userId The ID of the bot whose user edited this bot.
 * @param newData The new data to assign to the bot.
 * @param createContext A function that, when called, returns a new BotCalculationContext that can be used to calculate formulas for assignment expressions.
 */
export function updateBot(
    bot: Bot,
    userId: string,
    newData: PartialBot,
    createContext: () => BotSandboxContext
) {
    if (newData.tags) {
        // Cleanup/preprocessing
        for (let property in newData.tags) {
            let value = newData.tags[property];
            if (value) {
                if (_isAssignmentFormula(value)) {
                    const assignment = _convertToAssignment(value);
                    const result = _calculateFormulaValue(
                        createContext(),
                        bot,
                        property,
                        assignment.formula
                    );
                    newData.tags[property] = assign(assignment, {
                        value: result.result,
                    });
                }
            }
        }
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
            `auxContextSurfaceScale`,
            DEFAULT_WORKSPACE_SCALE
        );
        const gridScale = calculateNumericalTagValue(
            calc,
            workspace,
            `auxContextGridScale`,
            DEFAULT_WORKSPACE_GRID_SCALE
        );
        return scale * gridScale;
    } else {
        return DEFAULT_WORKSPACE_SCALE * DEFAULT_WORKSPACE_GRID_SCALE;
    }
}

/**
 * Calculates the difference between the two given states.
 * In particular, it calculates which operations need to be performed on prev in order to get current.
 * The returned object contains the bots that were added, removed, and/or updated between the two states.
 * This operation runs in O(n) time where n is the number of bots.
 * @param prev The previous state.
 * @param current The current state.
 * @param events If provided, this event will be used to help short-circut the diff calculation to be O(1) whenever the event is a 'add_bot', 'remove_bot', or 'update_bot' event.
 */
export function calculateStateDiff(
    prev: BotsState,
    current: BotsState,
    events?: Atom<AuxOp>[]
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
    if (tag.indexOf('#') === 0) {
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
 * Gets a list of tags from the given object that match the given event name and arguments.
 * @param bot The bot to find the tags that match the arguments.
 * @param eventName The event name to test.
 * @param other The arguments to match against.
 */
export function filtersMatchingArguments(
    context: BotCalculationContext,
    bot: Object,
    eventName: string,
    args: any[]
): FilterParseResult[] {
    if (bot === undefined) {
        return;
    }

    const tags = keys(bot.tags);
    return tags
        .map(t => parseFilterTag(t))
        .filter(t => filterMatchesArguments(context, t, eventName, args));
}

/**
 * Gets a list of tags from the given object that match the given event name.
 * @param bot The bot to find the tags that match the arguments.
 * @param eventName The event name to test.
 */
export function filtersOnBot(
    context: BotCalculationContext,
    bot: Object,
    eventName: string
): FilterParseResult[] {
    if (bot === undefined) {
        return;
    }

    const tags = keys(bot.tags);
    return tags
        .map(t => parseFilterTag(t))
        .filter(t => t.success && t.eventName === eventName);
}

/**
 * Determines if the given tag matches the given object and event.
 * @param tag The tag.
 * @param bot The bot to test.
 * @param eventName The event to test for.
 */
export function filterMatchesArguments(
    context: BotCalculationContext,
    filter: FilterParseResult,
    eventName: string,
    args: any[]
): boolean {
    if (filter.success && filter.eventName === eventName) {
        if (!!filter.filter) {
            const arg = args.length > 0 ? args[0] : null;
            if (arg) {
                const calculatedValue = calculateBotValue(
                    context,
                    arg,
                    filter.filter.tag
                );
                return (
                    calculatedValue === filter.filter.value ||
                    (Array.isArray(filter.filter.value) &&
                        isEqual(
                            arg.tags[filter.filter.tag],
                            filter.filter.value
                        ))
                );
            } else {
                return false;
            }
        } else {
            return true;
        }
    }
    return false;
}

/**
 * Determines if the given username is in the username list in the given bot and tag.
 * @param calc The bot calculation context.
 * @param bot The bot.
 * @param tag The tag.
 * @param username The username to check.
 */
export function isInUsernameList(
    calc: BotCalculationContext,
    bot: Bot,
    tag: string,
    username: string
): boolean {
    const list = getBotUsernameList(calc, bot, tag);
    return list.indexOf(username) >= 0;
}

/**
 * Gets a list of usernames from the given bot and tag.
 * @param calc The bot calculation context.
 * @param bot The bot.
 * @param tag The tag.
 */
export function getBotUsernameList(
    calc: BotCalculationContext,
    bot: Bot,
    tag: string
): string[] {
    let value = calculateBotValue(calc, bot, tag);

    if (value && !Array.isArray(value)) {
        value = [value];
    }

    if (value) {
        for (let i = 0; i < value.length; i++) {
            let v = value[i];
            if (isBot(v)) {
                value[i] = v.tags['_auxUser'] || v.id;
            }
        }
    }

    return value;
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
 * Gets the index that the given bot is at in the given context.
 * @param calc The calculation context to use.
 * @param bot The bot.
 * @param workspaceId The context.
 */
export function getBotIndex(
    calc: BotCalculationContext,
    bot: Bot,
    context: string
): number {
    return calculateNumericalTagValue(calc, bot, `${context}.sortOrder`, 0);
}

/**
 * Gets the position that the given bot is at in the given context.
 * @param calc The calculation context to use.
 * @param bot The bot.
 * @param context The context.
 */
export function getBotPosition(
    calc: BotCalculationContext,
    bot: Bot,
    context: string
): { x: number; y: number; z: number } {
    return {
        x: calculateNumericalTagValue(calc, bot, `${context}.x`, 0),
        y: calculateNumericalTagValue(calc, bot, `${context}.y`, 0),
        z: calculateNumericalTagValue(calc, bot, `${context}.z`, 0),
    };
}

/**
 * Gets the rotation that the given bot is at in the given context.
 * @param calc The calculation context to use.
 * @param bot The bot.
 * @param context The context.
 */
export function getBotRotation(
    calc: BotCalculationContext,
    bot: Bot,
    context: string
): { x: number; y: number; z: number } {
    return {
        x: calculateNumericalTagValue(calc, bot, `${context}.rotation.x`, 0),
        y: calculateNumericalTagValue(calc, bot, `${context}.rotation.y`, 0),
        z: calculateNumericalTagValue(calc, bot, `${context}.rotation.z`, 0),
    };
}

/**
 * Calculates the scale.x, scale.y, and scale.z values from the given object.
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
    prefix: string = 'aux.'
) {
    return cacheFunction(
        context,
        'getBotScale',
        () => {
            const scaleX = calculateNumericalTagValue(
                context,
                obj,
                `${prefix}scale.x`,
                defaultScale
            );
            const scaleY = calculateNumericalTagValue(
                context,
                obj,
                `${prefix}scale.y`,
                defaultScale
            );
            const scaleZ = calculateNumericalTagValue(
                context,
                obj,
                `${prefix}scale.z`,
                defaultScale
            );
            const uniformScale = calculateNumericalTagValue(
                context,
                obj,
                `${prefix}scale`,
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
    const shape: BotShape = calculateBotValue(calc, bot, 'auxShape');
    if (shape === 'cube' || shape === 'sphere' || shape === 'sprite') {
        return shape;
    }
    return DEFAULT_BOT_SHAPE;
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
    const anchor: BotLabelAnchor = calculateBotValue(
        calc,
        bot,
        'auxLabelAnchor'
    );
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
 * Determines if the given bot is a config bot for the given context.
 * @param calc The calculation context.
 * @param bot The bot to check.
 * @param context The context to check if the bot is the config of.
 */
export function isConfigForContext(
    calc: BotCalculationContext,
    bot: Bot,
    context: string
) {
    const contexts = getBotConfigContexts(calc, bot);
    return contexts.indexOf(context) >= 0;
}

/**
 * Gets whether the context(s) that the given bot represents are locked.
 * Uses at the auxContextLocked tag to determine whether it is locked.
 * Defaults to false if the bot is a context. Otherwise it defaults to true.
 * @param calc The calculation context.
 * @param bot The bot.
 */
export function isContextLocked(
    calc: BotCalculationContext,
    bot: Bot
): boolean {
    if (isContext(calc, bot)) {
        return calculateBooleanTagValue(calc, bot, 'auxContextLocked', false);
    }
    return true;
}

/**
 * Gets the list of contexts that the given bot is a config bot for.
 * @param calc The calculation context.
 * @param bot The bot that represents the context.
 */
export function getBotConfigContexts(
    calc: BotCalculationContext,
    bot: Bot
): string[] {
    const result = calculateBotValue(calc, bot, 'aux.context');
    return parseBotConfigContexts(result);
}

/**
 * Parses a list of context names from the given value.
 * @param value The value to parse.
 */
export function parseBotConfigContexts(value: any): string[] {
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
 * Gets a value from the given context bot.
 * @param calc The calculation context.
 * @param contextBot The bot that represents the context.
 * @param name The name of the value to get.
 */
export function getContextValue(
    calc: BotCalculationContext,
    contextBot: Bot,
    name: string
): any {
    return calculateBotValue(calc, contextBot, `aux.context.${name}`);
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
    return calculateBooleanTagValue(calc, bot, 'auxStackable', true);
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
 * Gets whether the given bot's context is movable.
 * @param calc The calculation context.
 * @param bot The bot to check.
 */
export function isContextMovable(
    calc: BotCalculationContext,
    bot: Bot
): boolean {
    return calculateBooleanTagValue(
        calc,
        bot,
        'aux.context.surface.movable',
        true
    );
}

/**
 * Gets the position that the context should be at using the given bot.
 * @param calc The calculation context to use.
 * @param contextBot The bot that represents the context.
 */
export function getContextPosition(
    calc: BotCalculationContext,
    contextBot: Bot
): { x: number; y: number; z: number } {
    return {
        x: calculateNumericalTagValue(calc, contextBot, `auxContextX`, 0),
        y: calculateNumericalTagValue(calc, contextBot, `auxContextY`, 0),
        z: calculateNumericalTagValue(calc, contextBot, `auxContextZ`, 0),
    };
}

/**
 * Gets the rotation that the context should be at using the given bot.
 * @param calc The calculation context to use.
 * @param contextBot The bot that represents the context.
 */
export function getContextRotation(
    calc: BotCalculationContext,
    contextBot: Bot
): { x: number; y: number; z: number } {
    return {
        x: calculateNumericalTagValue(
            calc,
            contextBot,
            `aux.context.rotation.x`,
            0
        ),
        y: calculateNumericalTagValue(
            calc,
            contextBot,
            `aux.context.rotation.y`,
            0
        ),
        z: calculateNumericalTagValue(
            calc,
            contextBot,
            `aux.context.rotation.z`,
            0
        ),
    };
}

/**
 * Gets whether the context is minimized.
 * @param calc The calculation context to use.
 * @param contextBot The bot that represents the context.
 */
export function getContextMinimized(
    calc: BotCalculationContext,
    contextBot: Bot
): boolean {
    return getContextValue(calc, contextBot, 'surface.minimized');
}

/**
 * Gets the color of the context.
 * @param calc The calculation context to use.
 * @param contextBot The bot that represents the context.
 */
export function getContextColor(
    calc: BotCalculationContext,
    contextBot: Bot
): string {
    return getContextValue(calc, contextBot, 'color');
}

/**
 * Gets the size of the context.
 * @param calc The calculation context to use.
 * @param contextBot The bot that represents the context.
 */
export function getContextSize(
    calc: BotCalculationContext,
    contextBot: Bot
): number {
    if (getContextVisualizeMode(calc, contextBot) === 'surface') {
        return calculateNumericalTagValue(
            calc,
            contextBot,
            `aux.context.surface.size`,
            DEFAULT_WORKSPACE_SIZE
        );
    }
    return 0;
}

/**
 * Gets the auxContextVisualize mode from the given bot.
 * @param calc The calculation context.
 * @param bot The bot.
 */
export function getContextVisualizeMode(
    calc: BotCalculationContext,
    bot: Bot
): ContextVisualizeMode {
    const val = calculateBotValue(calc, bot, 'auxContextVisualize');
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
 * Gets the grid of the context.
 * @param calc The calculation context to use.
 * @param contextBot The bot that represents the context.
 */
export function getBuilderContextGrid(
    calc: BotCalculationContext,
    contextBot: Bot
): { [key: string]: number } {
    const tags = tagsOnBot(contextBot);
    const gridTags = tags.filter(
        t => t.indexOf('aux.context.surface.grid.') === 0 && t.indexOf(':') > 0
    );

    let val: { [key: string]: number } = {};
    for (let tag of gridTags) {
        val[
            tag.substr('aux.context.surface.grid.'.length)
        ] = calculateNumericalTagValue(calc, contextBot, tag, undefined);
    }

    return val;
}

/**
 * Gets the height of the specified grid on the context.
 * @param calc The calculation context to use.
 * @param contextBot The bot that represents the context.
 * @param key The key for the grid position to lookup in the context grid.
 */
export function getContextGridHeight(
    calc: BotCalculationContext,
    contextBot: Bot,
    key: string
): number {
    let contextGrid = getBuilderContextGrid(calc, contextBot);
    if (contextGrid && contextGrid[key]) {
        if (contextGrid[key]) {
            return contextGrid[key];
        }
    }

    return DEFAULT_WORKSPACE_HEIGHT;
}

/**
 * Gets the grid scale of the context.
 * @param calc The calculation context to use.
 * @param contextBot The bot that represents the context.
 */
export function getContextGridScale(
    calc: BotCalculationContext,
    contextBot: Bot
): number {
    return getContextValue(calc, contextBot, 'grid.scale');
}

/**
 * Gets the scale of the context.
 * @param calc The calculation context to use.
 * @param contextBot The bot that represents the context.
 */
export function getContextScale(
    calc: BotCalculationContext,
    contextBot: Bot
): number {
    return (
        getContextValue(calc, contextBot, 'surface.scale') ||
        DEFAULT_WORKSPACE_SCALE
    );
}

/**
 * Gets the default height of the context.
 * @param calc The calculation context to use.
 * @param contextBot The bot that represents the context.
 */
export function getContextDefaultHeight(
    calc: BotCalculationContext,
    contextBot: Bot
): number {
    return getContextValue(calc, contextBot, 'defaultHeight');
}

/**
 * Filters the given list of objects to those matching the given workspace ID and grid position.
 * The returned list is in the order of their indexes.
 * @param calc The bot calculation context to use.
 * @param context The ID of the context that the objects need to be on.
 * @param position The position that the objects need to be at.
 */
export function objectsAtContextGridPosition(
    calc: BotCalculationContext,
    context: string,
    position: { x: number; y: number }
): Bot[] {
    return cacheFunction(
        calc,
        'objectsAtContextGridPosition',
        () => {
            const botsAtPosition = calc.lookup.query(
                calc,
                [context, `${context}.x`, `${context}.y`],
                [true, position.x, position.y],
                [undefined, 0, 0]
            );
            return <Bot[]>(
                sortBy(
                    botsAtPosition.filter(o => !isUserBot(o)),
                    o => getBotIndex(calc, o, context),
                    o => o.id
                )
            );
        },
        context,
        position.x,
        position.y
    );
}

/**
 * Calculates whether the given bot should be stacked onto another bot or if
 * it should be combined with another bot.
 * @param calc The bot calculation context.
 * @param context The context.
 * @param gridPosition The grid position that the bot is being dragged to.
 * @param bot The bot that is being dragged.
 */
export function calculateBotDragStackPosition(
    calc: BotCalculationContext,
    context: string,
    gridPosition: { x: number; y: number },
    ...bots: (Bot | BotTags)[]
) {
    const objs = differenceBy(
        objectsAtContextGridPosition(calc, context, gridPosition),
        bots,
        f => f.id
    );

    const canMerge =
        objs.length >= 1 &&
        bots.length === 1 &&
        isBotTags(bots[0]) &&
        isMergeable(calc, objs[0]);

    const firstBot = bots[0];

    const canCombine =
        !canMerge &&
        objs.length === 1 &&
        bots.length === 1 &&
        isBot(firstBot) &&
        canCombineBots(calc, firstBot, objs[0]);

    // Can stack if we're dragging more than one bot,
    // or (if the single bot we're dragging is stackable and
    // the stack we're dragging onto is stackable)
    let canStack =
        bots.length > 1 ||
        ((isBotTags(firstBot) || isBotStackable(calc, firstBot)) &&
            (objs.length === 0 || isBotStackable(calc, objs[0])));

    const index = nextAvailableObjectIndex(calc, context, bots, objs);

    return {
        combine: canCombine,
        merge: canMerge,
        stackable: canStack,
        other: objs[0],
        index: index,
    };
}

/**
 * Determines if the two bots can be combined and includes the resolved events if so.
 * @param bot The first bot.
 * @param other The second bot.
 */
export function canCombineBots(
    calc: BotCalculationContext,
    bot: Object,
    other: Object
): boolean {
    // TODO: Make this work even if the bot is a "workspace"
    if (
        bot &&
        other &&
        getBotConfigContexts(calc, bot).length === 0 &&
        getBotConfigContexts(calc, other).length === 0 &&
        bot.id !== other.id
    ) {
        const tags = union(
            filtersMatchingArguments(calc, bot, COMBINE_ACTION_NAME, [other]),
            filtersMatchingArguments(calc, other, COMBINE_ACTION_NAME, [bot])
        );
        return tags.length > 0;
    }
    return false;
}

/**
 * Calculates the next available index that an object can be placed at on the given workspace at the
 * given grid position.
 * @param context The context.
 * @param gridPosition The grid position that the next available index should be found for.
 * @param bots The bots that we're trying to find the next index for.
 * @param objs The objects at the same grid position.
 */
export function nextAvailableObjectIndex(
    calc: BotCalculationContext,
    context: string,
    bots: (Bot | BotTags)[],
    objs: Bot[]
): number {
    const except = differenceBy(objs, bots, f => f.id);

    const indexes = except.map(o => ({
        object: o,
        index: getBotIndex(calc, o, context),
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
 * Determines if the given bot is for a user.
 */
export function isUserBot(bot: Bot): boolean {
    return !!bot.tags['_auxUser'];
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
    const tagsToRemove = filterWellKnownAndContextTags(calc, tags);
    tagsToRemove.forEach(t => {
        delete copy.tags[t];
    });

    let newBot = merge(copy, data || {});
    newBot.id = uuid();

    return <Object>cleanBot(newBot);
}

/**
 * Filters the given list of tags by whether they are well known or used in a context.
 * @param calc The bot calculation context.
 * @param tags The list of tags to filter.
 */
export function filterWellKnownAndContextTags(
    calc: BotCalculationContext,
    tags: string[]
) {
    const contextsToRemove = getContexts(calc);
    const tagsToRemove = tags.filter(t =>
        isWellKnownOrContext(t, contextsToRemove)
    );
    return tagsToRemove;
}

/**
 * Gets the list of contexts that the given calculation context contains.
 * @param calc The bot calculation context.
 */
export function getContexts(calc: BotCalculationContext) {
    return union(...calc.objects.map(o => getBotConfigContexts(calc, o)));
}

/**
 * Determines if the given tag is well known or in one of the given contexts.
 * @param tag The tag to check.
 * @param contexts The contexts to check the tag against.
 */
export function isWellKnownOrContext(tag: string, contexts: string[]): any {
    return isTagWellKnown(tag) || contexts.some(c => tag.indexOf(c) === 0);
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
    return isBotStackable(calc, bot);
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
    let str = '';
    if (id.host) {
        str += `${id.host}/*/`;
    }
    if (id.channel) {
        str += `${id.channel}`;
    }
    return str;
}

export function parseSimulationId(id: string): SimulationIdParseSuccess {
    try {
        let uri = new URL(id);
        const split = uri.pathname.slice(1).split('/');
        if (split.length === 1) {
            if (split[0]) {
                return {
                    success: true,
                    host: uri.host,
                    context: split[0],
                };
            } else {
                return {
                    success: true,
                    host: uri.host,
                };
            }
        } else {
            return {
                success: true,
                host: uri.host,
                context: split[0],
                channel: split.slice(1).join('/'),
            };
        }
    } catch (ex) {
        const split = id.split('/');
        if (split.length === 1) {
            return {
                success: true,
                channel: id,
            };
        } else {
            const firstSlashIndex = id.indexOf('/');
            const firstDotIndex = id.indexOf('.');

            if (firstDotIndex >= 0 && firstDotIndex < firstSlashIndex) {
                return {
                    success: true,
                    host: split[0],
                    context: split[1],
                    channel: split.slice(2).join('/'),
                };
            } else {
                return {
                    success: true,
                    context: split[0],
                    channel: split.slice(1).join('/'),
                };
            }
        }
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
 * Parses the given tag filter into its components.
 * @param tag
 */
export function parseFilterTag(tag: string): FilterParseResult {
    let originalTag = tag;
    tag = tag.replace(/[“”‘’]/g, '"');
    const firstParenIndex = tag.indexOf('(');
    const tagIndex = tag.indexOf('#');
    if (firstParenIndex > 0 && (tagIndex > firstParenIndex || tagIndex < 0)) {
        const eventName = tag.slice(0, firstParenIndex).trim();

        if (eventName) {
            const colonIndex = tag.indexOf(':');
            if (colonIndex > tagIndex) {
                const tagName = tag.slice(tagIndex + 1, colonIndex).trim();
                if (tagName && tagIndex > 0) {
                    let firstQuote = tag.indexOf('"');
                    if (firstQuote < 0) {
                        firstQuote = colonIndex;
                    }
                    let lastQuote = tag.lastIndexOf('"');
                    if (lastQuote < 0) {
                        lastQuote = tag.lastIndexOf(')');
                        if (lastQuote < 0) {
                            lastQuote = tag.length;
                        }
                    } else if (lastQuote === firstQuote) {
                        lastQuote = tag.length;
                    }
                    const value = tag.slice(firstQuote + 1, lastQuote);
                    const finalValue = _parseFilterValue(value);
                    return {
                        success: true,
                        eventName: eventName,
                        tag: originalTag,
                        filter: {
                            tag: tagName,
                            value: finalValue,
                        },
                    };
                }
            }

            let lastParen = tag.lastIndexOf(')');
            if (lastParen > firstParenIndex) {
                let between = tag.slice(firstParenIndex + 1, lastParen);
                // Only whitespace is allowed
                if (/^\s*$/.test(between)) {
                    return {
                        success: true,
                        eventName: eventName,
                        tag: originalTag,
                        filter: null,
                    };
                }
            }

            return {
                success: false,
                partialSuccess: true,
                tag: originalTag,
                eventName: eventName,
            };
        }
    }
    return {
        success: false,
        partialSuccess: false,
        tag: originalTag,
        eventName: null,
    };
}

/**
 * Gets the user selection mode value from the given bot.
 * @param bot The bot.
 */
export function getSelectionMode(bot: Bot): SelectionMode {
    return bot.tags['_auxSelectionMode'] || DEFAULT_SELECTION_MODE;
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
    if (typeof bot.tags[tag] !== 'undefined') {
        const result = calculateBotValue(context, bot, tag);
        if (typeof result === 'number' && result !== null) {
            return result;
        }
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
    if (typeof bot.tags[tag] !== 'undefined') {
        const result = calculateBotValue(context, bot, tag);
        if (typeof result === 'boolean' && result !== null) {
            return result;
        }
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
    if (typeof bot.tags[tag] !== 'undefined') {
        const result = calculateBotValue(context, bot, tag);
        if (typeof result === 'string' && result !== null) {
            return result;
        }
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
 * Gets the auxChannel tag from the given bot.
 * @param calc The bot calculation context to use.
 * @param bot The bot.
 */
export function getBotChannel(
    calc: BotCalculationContext,
    bot: Object
): string {
    return calculateBotValue(calc, bot, 'auxChannel');
}

/**
 * Gets the first bot which is in the aux.channels context that has the auxChannel tag set to the given ID.
 * @param calc The bot calculation context.
 * @param id The ID to search for.
 */
export function getChannelBotById(calc: BotCalculationContext, id: string) {
    const bots = calc.objects.filter(o => {
        return (
            isBotInContext(calc, o, 'aux.channels') &&
            calculateBotValue(calc, o, 'auxChannel') === id
        );
    });

    if (bots.length > 0) {
        return bots[0];
    } else {
        return null;
    }
}

/**
 * Gets the number of connected devices that are connected to the channel that
 * the given bot is for.
 * @param calc The bot calculation context.
 * @param bot The bot.
 */
export function getChannelConnectedDevices(
    calc: BotCalculationContext,
    bot: Bot
): number {
    return calculateNumericalTagValue(
        calc,
        bot,
        'auxChannelConnectedSessions',
        0
    );
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
 * Returns wether or not the given bot resides in the given context id.
 * @param context The bot calculation context to run formulas with.
 * @param bot The bot.
 * @param contextId The id of the context that we are asking if the bot is in.
 */
export function isBotInContext(
    context: BotCalculationContext,
    bot: Object,
    contextId: string
): boolean {
    if (!contextId) return false;

    let result: boolean;

    let contextValue = calculateBotValue(context, bot, contextId.valueOf());

    if (
        typeof contextValue === 'object' &&
        typeof contextValue.valueOf === 'function'
    ) {
        contextValue = contextValue.valueOf();
    }

    if (typeof contextValue === 'string') {
        result = contextValue === 'true';
    } else if (typeof contextValue === 'number') {
        result = true;
    } else {
        result = contextValue === true;
    }

    if (!result && hasValue(bot.tags['_auxUser'])) {
        const userContextValue = calculateBotValue(
            context,
            bot,
            '_auxUserContext'
        );
        result = userContextValue == contextId;
    }

    return result;
}

/**
 * Gets the sort order that the given bot should appear in the given context.
 * @param context The bot calculation context.
 * @param bot The bot.
 * @param contextId The ID of the context that we're getting the sort order for.
 */
export function botContextSortOrder(
    context: BotCalculationContext,
    bot: Bot,
    contextId: string
): number | string {
    if (!contextId) return NaN;

    const contextValue = calculateBotValue(
        context,
        bot,
        `${contextId}.sortOrder`
    );
    if (typeof contextValue === 'string') {
        return contextValue;
    } else if (typeof contextValue === 'number') {
        return contextValue;
    } else {
        return 0;
    }
}

/**
 * Calculates the given formula and returns the result.
 * @param context The bot calculation context to run formulas with.
 * @param formula The formula to use.
 * @param extras The extra data to include in callbacks to the interface implementation.
 * @param thisObj The object that should be used for the this keyword in the formula.
 */
export function calculateFormulaValue(
    context: BotSandboxContext,
    formula: string,
    extras: any = {},
    thisObj: any = null
) {
    const prevCalc = getCalculationContext();
    const prevEnergy = getEnergy();
    setCalculationContext(context);

    // TODO: Allow configuring energy per formula
    setEnergy(DEFAULT_ENERGY);

    const result = context.sandbox.run(formula, extras, context);

    setCalculationContext(prevCalc);
    setEnergy(prevEnergy);
    return result;
}

export function isUserActive(calc: BotCalculationContext, bot: Bot) {
    const active = calculateBooleanTagValue(calc, bot, `auxUserActive`, false);
    if (!active) {
        return false;
    }
    const lastActiveTime = calculateNumericalTagValue(
        calc,
        bot,
        `aux._lastActiveTime`,
        0
    );
    if (lastActiveTime) {
        const milisecondsFromNow = Date.now() - lastActiveTime;
        return milisecondsFromNow < DEFAULT_USER_INACTIVE_TIME;
    } else {
        return false;
    }
}

export function shouldDeleteUser(bot: Bot) {
    const lastActiveTime = bot.tags[`aux._lastActiveTime`];
    if (lastActiveTime) {
        const milisecondsFromNow = Date.now() - lastActiveTime;
        return milisecondsFromNow > DEFAULT_USER_DELETION_TIME;
    } else {
        return false;
    }
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

function _convertToAssignment(object: any): Assignment {
    if (isAssignment(object)) {
        return object;
    }

    return {
        _assignment: true,
        editing: true,
        formula: object,
    };
}

/**
 * Determines if the given value is an assignment expression or an assignment object.
 */
function _isAssignmentFormula(value: any): boolean {
    if (typeof value === 'string') {
        return value.indexOf(':') === 0 && value.indexOf('=') === 1;
    } else {
        return isAssignment(value);
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
 * @param context The calculation context to use.
 * @param object The bot that the formula was from.
 * @param tag The tag that the formula was from.
 * @param formula The formula.
 * @param energy (Optional) The amount of energy that the calculation has left. If not specified then there will be no energy limit and stack overflow errors will occur.
 */
export function calculateValue(
    context: BotSandboxContext,
    object: any,
    tag: keyof BotTags,
    formula: string,
    energy?: number
): any {
    if (isFormula(formula)) {
        if (!context || !context.sandbox) {
            return formula;
        }
        const result = _calculateFormulaValue(
            context,
            object,
            tag,
            formula,
            energy
        );
        if (result.success) {
            return result.result;
        } else {
            throw result.error;
        }
    } else if (isAssignment(formula)) {
        const obj: Assignment = <any>formula;
        return obj.value;
    } else if (isArray(formula)) {
        const split = parseArray(formula);
        return split.map(s =>
            calculateValue(context, object, tag, s.trim(), energy)
        );
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
 * Calculates the value of the given formula and ensures that the result is a transferrable value.
 * @param context The bot calculation context to use.
 * @param object The object that the formula was from.
 * @param tag The tag that the formula was from.
 * @param formula The formula to calculate the value of.
 */
export function calculateCopiableValue(
    context: BotSandboxContext,
    object: any,
    tag: keyof BotTags,
    formula: string
): any {
    try {
        const value = calculateValue(context, object, tag, formula);
        return convertToCopiableValue(value);
    } catch (err) {
        return convertToCopiableValue(err);
    }
}

/**
 * Converts the given value to a copiable value.
 * Copiable values are strings, numbers, booleans, arrays, and objects made of any of those types.
 * Non-copiable values are functions and errors.
 * @param value
 */
export function convertToCopiableValue(value: any): any {
    if (typeof value === 'function') {
        return `[Function ${value.name}]`;
    } else if (value instanceof Error) {
        return `${value.name}: ${value.message}`;
    } else if (typeof value === 'object') {
        if (isBot(value)) {
            return {
                id: value.id,
                tags: value.tags,
            };
        } else if (Array.isArray(value)) {
            return value.map(val => convertToCopiableValue(val));
        } else {
            return mapValues(value, val => convertToCopiableValue(val));
        }
    }
    return value;
}

function _calculateFormulaValue(
    context: BotSandboxContext,
    object: any,
    tag: keyof BotTags,
    formula: string,
    energy?: number
) {
    const prevCalc = getCalculationContext();
    setCalculationContext(context);

    // NOTE: The energy should not get reset
    // here because then infinite formula loops would be possible.
    const result = context.sandbox.run(
        formula,
        {
            formula,
            tag,
            context,
        },
        object
    );

    setCalculationContext(prevCalc);
    return result;
}
