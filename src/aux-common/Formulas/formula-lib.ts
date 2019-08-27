import { GLOBALS_FILE_ID } from '../Files/File';
import {
    FileUpdatedEvent,
    FileEvent,
    FileAddedEvent,
    action,
    FileRemovedEvent,
    fileRemoved,
    fileAdded,
    toast as toastMessage,
    tweenTo as calcTweenTo,
    openQRCodeScanner as calcOpenQRCodeScanner,
    loadSimulation as calcLoadSimulation,
    unloadSimulation as calcUnloadSimulation,
    superShout as calcSuperShout,
    showQRCode as calcShowQRCode,
    goToContext as calcGoToContext,
    goToURL as calcGoToURL,
    openURL as calcOpenURL,
    importAUX as calcImportAUX,
    showInputForTag as calcShowInputForTag,
    fileUpdated,
    sayHello as calcSayHello,
    grantRole as calcGrantRole,
    revokeRole as calcRevokeRole,
    shell as calcShell,
    openConsole as calcOpenConsole,
    echo as calcEcho,
    backupToGithub as calcBackupToGithub,
    backupAsDownload as calcBackupAsDownload,
    openBarcodeScanner as calcOpenBarcodeScanner,
    showBarcode as calcShowBarcode,
} from '../Files/FileEvents';
import { calculateActionResultsUsingContext } from '../Files/FilesChannel';
import uuid from 'uuid/v4';
import { every, find, sortBy } from 'lodash';
import {
    calculateFormulaValue,
    COMBINE_ACTION_NAME,
    addToContextDiff as calcAddToContextDiff,
    removeFromContextDiff as calcRemoveFromContextDiff,
    setPositionDiff as calcSetPositionDiff,
    isFile,
    // isFormulaObject,
    // unwrapProxy,
    CREATE_ACTION_NAME,
    DESTROY_ACTION_NAME,
    isFileInContext,
    tagsOnFile,
    isDestroyable,
    isInUsernameList,
    getFileUsernameList,
    DIFF_ACTION_NAME,
    trimTag,
    trimEvent,
    hasValue,
} from '../Files/FileCalculations';

import '../polyfill/Array.first.polyfill';
import '../polyfill/Array.last.polyfill';
import {
    getFileState,
    getCalculationContext,
    getActions,
    setFileState,
    getUserId,
    getEnergy,
    setEnergy,
} from './formula-lib-globals';
import { remote } from '@casual-simulation/causal-trees';

/**
 * The list of possible barcode formats.
 */
export type BarcodeFormat =
    | 'code128'
    | 'code39'
    | 'ean13'
    | 'ean8'
    | 'upc'
    | 'itf14'
    | 'msi'
    | 'pharmacode'
    | 'codabar';

/**
 * Defines the possible input types.
 */
type ShowInputType = 'text' | 'color';

/**
 * Defines the possible input types.
 */
type ShowInputSubtype = 'basic' | 'swatch' | 'advanced';

/**
 * Defines an interface for options that a show input event can use.
 */
interface ShowInputOptions {
    /**
     * The type of input box to show.
     */
    type: ShowInputType;

    /**
     * The subtype of input box to show.
     */
    subtype: ShowInputSubtype;

    /**
     * The title that should be used for the input.
     */
    title: string;

    /**
     * The placeholder for the value.
     */
    placeholder: string;

    /**
     * The background color to use.
     */
    backgroundColor: string;

    /**
     * The foreground color to use.
     */
    foregroundColor: string;
}

type BotTags = any;

/**
 * Defines the basic structure of a bot.
 */
interface Bot {
    /**
     * The ID of the bot.
     */
    id: string;

    /**
     * The raw tag values that the bot contains.
     * If you want to access the script code for a formula, use this.
     * Otherwise, use getTag().
     */
    tags: any;
}

/**
 * Defines a tag filter. It can be either a function that accepts a tag value and returns true/false or it can be the value that the tag value has to match.
 */
type TagFilter =
    | ((value: any) => boolean)
    | string
    | number
    | boolean
    | null
    | undefined;

/**
 * Defines a bot filter. It is a function that accepts a bot and returns true/false.
 *
 * Common bot filters are:
 * - `byTag(tag, value)`
 * - `inContext(context)`
 * - `atPosition(context, x, y)`
 * - `inStack(bot, context)`
 * - `neighboring(bot, context, direction)`
 * - `either(filter1, filter2)`
 * - `not(filter)`
 */
interface BotFilterFunction {
    (bot: Bot): boolean;
    sort?: (bot: Bot) => any;
}

/**
 * Defines a type that represents a mod.
 * That is, a set of tags that can be applied to another bot.
 */
type Mod = BotTags | Bot;

/**
 * Sums the given array of numbers and returns the result.
 * If any value in the list is not a number, it will be converted to one.
 * If the given value is not an array, then it will be converted to a number and returned.
 *
 * @param list The value that should be summed. If it is a list, then the result will be the sum of the items in the list.
 *             If it is not a list, then the result will be the value converted to a number.
 */
function sum(list: any): number {
    if (!Array.isArray(list)) {
        return parseFloat(list);
    }

    let carry = 0;
    for (let i = 0; i < list.length; i++) {
        const l = list[i];
        if (!Array.isArray(l)) {
            carry += parseFloat(l);
        } else {
            carry += sum(l);
        }
    }
    return carry;
}

/**
 * Calculates the average of the numbers in the given list and returns the result.
 * @param list The value that should be averaged.
 *             If it is a list, then the result will be sum(list)/list.length.
 *             If it is not a list, then the result will be the value converted to a number.
 */
function avg(list: any) {
    if (!Array.isArray(list)) {
        return parseFloat(list);
    }

    let total = sum(list);
    let count = list.length;
    return total / count;
}

/**
 * Calculates the square root of the given number.
 * @param value The number.
 */
function sqrt(value: any) {
    return Math.sqrt(parseFloat(value));
}

/**
 * Calculates the absolute value of a number.
 * @param number The number to get the absolute value of.
 */
function abs(number: any) {
    return Math.abs(parseFloat(number));
}

/**
 * Calculates the standard deviation of the numbers in the given list and returns the result.
 *
 * @param list The value that the standard deviation should be calculated for.
 */
function stdDev(list: any) {
    if (!Array.isArray(list)) {
        list = [parseFloat(list)];
    }

    let mean = avg(list);
    let numbersMinusMean = list.map((l: number) => (l - mean) * (l - mean));

    let standardMean = avg(numbersMinusMean);
    return sqrt(standardMean);
}

/**
 * Sorts the given array in ascending order and returns the sorted values in a new array.
 * @param array The array of numbers to sort.
 */
function sort(array: any[], direction: 'ASC' | 'DESC' = 'ASC'): any[] {
    let newArray = array.slice();
    let isAscending = direction.toUpperCase() !== 'DESC';
    if (isAscending) {
        return newArray.sort((a, b) => a - b);
    } else {
        return newArray.sort((a, b) => b - a);
    }
}

/**
 * Generates a random integer number between min and max.
 * @param min The smallest allowed value.
 * @param max The largest allowed value.
 */
function randomInt(min: number = 0, max?: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    const rand = Math.random();
    if (max) {
        return Math.floor(rand * (max - min)) + min;
    } else {
        return Math.floor(rand) + min;
    }
}

/**
 * Generates a random number between min and max.
 * @param min The smallest allowed value.
 * @param max The largest allowed value.
 */
function random(min: number = 0, max?: number): number {
    const rand = Math.random();
    if (max) {
        return rand * (max - min) + min;
    } else {
        return rand + min;
    }
}

/**
 * Joins the given list of values into a single string.
 * @param values The values to make the string out of.
 * @param separator The separator used to separate values.
 */
function join(values: any, separator: string = ','): string {
    if (Array.isArray(values)) {
        return values.join(separator);
    } else {
        return values;
    }
}

/**
 * Removes the given bot or bot ID from the simulation.
 * @param bot The bot or bot ID to remove from the simulation.
 */
function destroyFile(bot: Bot | string) {
    const calc = getCalculationContext();

    let id: string;
    if (typeof bot === 'object') {
        id = bot.id;
    } else if (typeof bot === 'string') {
        id = bot;
    }

    if (typeof id === 'object') {
        id = (<any>id).valueOf();
    }

    const realFile = getFileState()[id];
    if (!realFile) {
        return;
    }

    if (!isDestroyable(calc, realFile)) {
        return;
    }

    if (id) {
        event(DESTROY_ACTION_NAME, [id]);
        let actions = getActions();
        actions.push(fileRemoved(id));
        calc.sandbox.interface.removeFile(id);
    }

    destroyChildren(id);
}

/**
 * Destroys the given bot, bot ID, or list of files.
 * @param bot The bot, bot ID, or list of files to destroy.
 */
function destroy(bot: Bot | string | Bot[]) {
    if (typeof bot === 'object' && Array.isArray(bot)) {
        bot.forEach(f => destroyFile(f));
    } else {
        destroyFile(bot);
    }
}

/**
 * Removes tags from the given list of bots.
 * @param bot The bot, bot ID, or list of bots that should have their matching tags removed.
 * @param tagSection The tag section which should be removed from the bot(s). If given a string, then all the tags
 *                   starting with the given name will be removed. If given a RegExp, then all the tags matching the regex will be removed.
 *
 * @example
 * // Remove tags named starting with "abc" from the `this` bot.
 * removeTags(this, "abc");
 *
 * @example
 * // Remove tags named "hello" using a case-insensitive regex from the `this` bot.
 * removeTags(this, /^hello$/gi);
 *
 */
function removeTags(bot: Bot | Bot[], tagSection: string | RegExp) {
    if (typeof bot === 'object' && Array.isArray(bot)) {
        let fileList: any[] = bot;

        for (let h = 0; h < bot.length; h++) {
            let tags = tagsOnFile(fileList[h]);

            for (let i = tags.length - 1; i >= 0; i--) {
                if (tagSection instanceof RegExp) {
                    if (tagSection.test(tags[i])) {
                        fileList[h][tags[i]] = null;
                    }
                } else if (tags[i].includes(tagSection)) {
                    let doRemoveTag = false;

                    if (tags[i].includes('.')) {
                        if (tags[i].split('.')[0] === tagSection) {
                            doRemoveTag = true;
                        }
                    } else {
                        if (tags[i] === tagSection) {
                            doRemoveTag = true;
                        }
                    }

                    if (doRemoveTag) {
                        fileList[h][tags[i]] = null;
                    }
                }
            }
        }
    } else {
        let tags = tagsOnFile(bot);

        for (let i = tags.length - 1; i >= 0; i--) {
            // if the tag section is relevant to the curretn tag at all
            if (tagSection instanceof RegExp) {
                if (tagSection.test(tags[i])) {
                    setTag(bot, tags[i], null);
                }
            } else if (tags[i].includes(tagSection)) {
                let doRemoveTag = false;
                // if this tag has a period in it, check for first word to match
                if (tags[i].includes('.')) {
                    if (
                        tagSection.includes('.') &&
                        tags[i].startsWith(tagSection)
                    ) {
                        doRemoveTag = true;
                    } else if (tags[i].split('.')[0] === tagSection) {
                        doRemoveTag = true;
                    }
                } else {
                    // check if tag is equal to the tag section and that it doesn't just have the tagsection as a part of its
                    if (tags[i] === tagSection) {
                        doRemoveTag = true;
                    }
                }

                // if it has been verified that the tag matches the tag section for removal
                if (doRemoveTag) {
                    setTag(bot, tags[i], null);
                }
            }
        }
    }
}

function destroyChildren(id: string) {
    const calc = getCalculationContext();
    const children: Bot[] = calc.sandbox.interface.listObjectsWithTag(
        'aux.creator',
        id
    );
    children.forEach(child => {
        if (!isDestroyable(calc, child)) {
            return;
        }
        let actions = getActions();
        actions.push(fileRemoved(child.id));
        calc.sandbox.interface.removeFile(child.id);
        destroyChildren(child.id);
    });
}

/**
 * Creates a new bot that contains the given tags.
 * @param mods The mods that specify what tags to set on the bot.
 */
function createFromMods(...mods: (Mod | Mod[])[]) {
    let variants: Mod[][] = new Array<Mod[]>(1);
    variants[0] = [];

    for (let i = 0; i < mods.length; i++) {
        let diff = mods[i];
        if (Array.isArray(diff)) {
            let newVariants: Mod[][] = new Array<Mod[]>(
                variants.length * diff.length
            );

            for (let b = 0; b < newVariants.length; b++) {
                let diffIdx = Math.floor(b / variants.length);
                let d = diff[diffIdx];
                let variantIdx = b % variants.length;
                let newVariant = variants[variantIdx].slice();
                newVariant.push(d);
                newVariants[b] = newVariant;
            }

            variants = newVariants;
        } else {
            for (let b = 0; b < variants.length; b++) {
                variants[b].push(diff);
            }
        }
    }

    let files: Bot[] = variants.map(v => {
        let bot = {
            id: uuid(),
            tags: {},
        };
        apply(bot.tags, ...v);
        return bot;
    });

    let actions = getActions();
    actions.push(...files.map(f => fileAdded(f)));

    let ret = new Array<Bot>(files.length);
    const calc = getCalculationContext();
    for (let i = 0; i < files.length; i++) {
        ret[i] = calc.sandbox.interface.addFile(files[i]);
        setFileState(
            Object.assign({}, getFileState(), {
                [files[i].id]: files[i],
            })
        );
    }

    event(CREATE_ACTION_NAME, files);

    if (ret.length === 1) {
        return ret[0];
    } else {
        return ret;
    }
}

/**
 * Gets the ID from the given bot.
 * @param bot The bot or string.
 */
function getFileId(bot: Bot | string): string {
    if (typeof bot === 'string') {
        return bot;
    } else if (bot) {
        return bot.id;
    }
}

/**
 * Creates a new bot and returns it.
 * @param parent The bot that should be the parent of the new bot.
 * @param datas The mods which specify the new bot's tag values.
 * @returns The bot(s) that were created.
 *
 * @example
 * // Create a red bot without a parent.
 * let redBot = create(null, { "aux.color": "red" });
 *
 * @example
 * // Create a red bot and a blue bot with `this` as the parent.
 * let [redBot, blueBot] = create(this, [
 *    { "aux.color": "red" },
 *    { "aux.color": "blue" }
 * ]);
 *
 */
function create(parent: Bot | string, ...datas: Mod[]) {
    let parentId = getFileId(parent);
    let parentDiff = parentId
        ? {
              'aux.creator': parentId,
          }
        : {};
    return createFromMods(...datas, parentDiff);
}

/**
 * Combines the two given files.
 * @param first The first bot.
 * @param second The second bot.
 */
function combine(first: Bot | string, second: Bot | string) {
    event(COMBINE_ACTION_NAME, [first, second]);
}

/**
 * Runs an event on the given files.
 * @param name The name of the event to run.
 * @param files The files that the event should be executed on. If null, then the event will be run on every bot.
 * @param arg The argument to pass.
 * @param sort Whether to sort the Files before processing. Defaults to true.
 */
function event(
    name: string,
    files: (Bot | string)[],
    arg?: any,
    sort?: boolean
) {
    const state = getFileState();
    if (!!state) {
        let ids = !!files
            ? files.map(bot => {
                  return typeof bot === 'string' ? bot : bot.id;
              })
            : null;

        let [events, results] = calculateActionResultsUsingContext(
            state,
            action(trimEvent(name), ids, getUserId(), arg, sort),
            getCalculationContext()
        );

        let actions = getActions();
        actions.push(...events);

        return results;
    }
}

/**
 * Asks every bot in the channel to run the given action.
 * In effect, this is like shouting to a bunch of people in a room.
 *
 * @param name The event name.
 * @param arg The optional argument to include in the shout.
 * @returns Returns a list which contains the values returned from each script that was run for the shout.
 *
 * @example
 * // Tell every bot to reset themselves.
 * shout("reset()");
 *
 * @example
 * // Ask every bot for its name.
 * const names = shout("getName()");
 *
 * @example
 * // Tell every bot say "Hi" to you.
 * shout("sayHi()", "My Name");
 */
function shout(name: string, arg?: any) {
    return event(name, null, arg);
}

/**
 * Shouts the given event to every bot in every loaded simulation.
 * @param eventName The name of the event to shout.
 * @param arg The argument to shout. This gets passed as the `that` variable to the other scripts.
 */
function superShout(eventName: string, arg?: any) {
    let actions = getActions();
    actions.push(calcSuperShout(trimEvent(eventName), arg));
}

/**
 * Asks the given bots to run the given action.
 * In effect, this is like whispering to a specific set of people in a room.
 *
 * @param bot The bot(s) to send the event to.
 * @param eventName The name of the event to send.
 * @param arg The optional argument to include.
 * @returns Returns a list which contains the values returned from each script that was run for the shout.
 *
 * @example
 * // Tell all the red bots to reset themselves.
 * whisper(getBots("#aux.color", "red"), "reset()");
 *
 * @example
 * // Ask all the tall bots for their names.
 * const names = whisper(getBots("aux.scale.z", height => height >= 2), "getName()");
 *
 * @example
 * // Tell every friendly bot to say "Hi" to you.
 * whisper(getBots("friendly", true), "sayHi()", "My Name");
 */
function whisper(
    bot: (Bot | string)[] | Bot | string,
    eventName: string,
    arg?: any
) {
    let files;
    if (Array.isArray(bot)) {
        files = bot;
    } else {
        files = [bot];
    }

    return event(eventName, files, arg, false);
}

/**
 * Redirects the user to the given context.
 * @param context The context to go to.
 *
 * @example
 * // Send the player to the "welcome" context.
 * player.goToContext("welcome");
 */
function goToContext(context: string) {
    let actions = getActions();
    actions.push(calcGoToContext(context));
}

/**
 * Redirects the user to the given URL.
 * @param url The URL to go to.
 *
 * @example
 * // Send the player to wikipedia.
 * player.goToURL("https://wikipedia.org");
 */
function goToURL(url: string) {
    let actions = getActions();
    actions.push(calcGoToURL(url));
}

/**
 * Redirects the user to the given URL.
 * @param url The URL to go to.
 *
 * @example
 * // Open wikipedia in a new tab.
 * player.openURL("https://wikipedia.org");
 */
function openURL(url: string) {
    let actions = getActions();
    actions.push(calcOpenURL(url));
}

/**
 * Shows an input box to edit the given bot and tag.
 *
 * @param bot The bot or bot ID that should be edited.
 * @param tag The tag which should be edited on the bot.
 * @param options The options that indicate how the input box should be customized.
 *
 * @example
 * // Show an input box for `this` bot's label.
 * player.showInputForTag(this, "aux.label", {
 *            title: "Change the label",
 *            type: "text"
 * });
 *
 * @example
 * // Show a color picker for the bot's color.
 * player.showInputForTag(this, "aux.color", {
 *            title: "Change the color",
 *            type: "color",
 *            subtype: "advanced"
 * });
 */
function showInputForTag(
    bot: Bot | string,
    tag: string,
    options?: Partial<ShowInputOptions>
) {
    const id = typeof bot === 'string' ? bot : bot.id;
    let actions = getActions();
    actions.push(calcShowInputForTag(id, trimTag(tag), options));
}

/**
 * Determines whether the current player is allowed to load AUX Builder.
 */
function isDesigner(): boolean {
    const globals = getGlobals();
    const user = getUser();
    if (globals && user) {
        const calc = getCalculationContext();
        const list = getFileUsernameList(calc, globals, 'aux.designers');
        if (list) {
            return isInUsernameList(
                calc,
                globals,
                'aux.designers',
                getTag(user, 'aux._user')
            );
        }
    }
    return true;
}

/**
 * Derermines whether the player is in the given context.
 * @param context The context.
 */
function isInContext(givenContext: string) {
    return currentContext() === givenContext;
}

/**
 * Gets the context that the player is currently in.
 */
function currentContext(): string {
    const user = getUser();
    if (user) {
        const context = getTag(user, 'aux._userContext');
        return context || undefined;
    }
    return undefined;
}

/**
 * Gets the channel that the player is currently in.
 */
function currentChannel(): string {
    const user = getUser();
    if (user) {
        const channel = getTag(user, 'aux._userChannel');

        if ((<string>channel).includes('/')) {
            return (<string>channel).split('/')[1];
        }

        return channel || undefined;
    }
    return undefined;
}

/**
 * Determines whether the player has the given bot in their inventory.
 * @param files The bot or files to check.
 */
function hasBotInInventory(files: Bot | Bot[]): boolean {
    if (!Array.isArray(files)) {
        files = [files];
    }

    return every(files, f =>
        isFileInContext(getCalculationContext(), <any>f, getInventoryContext())
    );
}

/**
 * Gets the current user's bot.
 */
function getUser(): Bot {
    if (!getUserId()) {
        return null;
    }
    const calc = getCalculationContext();
    const user = calc.sandbox.interface.listObjectsWithTag('id', getUserId());
    if (Array.isArray(user)) {
        if (user.length === 1) {
            return user[0];
        } else {
            return null;
        }
    }
    return user || null;
}

/**
 * Gets the current globals bot.
 */
function getGlobals(): Bot {
    const calc = getCalculationContext();
    const globals = calc.sandbox.interface.listObjectsWithTag(
        'id',
        GLOBALS_FILE_ID
    );
    if (Array.isArray(globals)) {
        if (globals.length === 1) {
            return globals[0];
        } else {
            return null;
        }
    }
    return globals || null;
}

/**
 * Gets the name of the context that is used for the current user's menu.
 */
function getMenuContext(): string {
    const user = getUser();
    if (user) {
        return getTag(user, 'aux._userMenuContext');
    } else {
        return null;
    }
}

/**
 * Gets the name of the context that is used for the current user's inventory.
 */
function getInventoryContext(): string {
    const user = getUser();
    if (user) {
        return getTag(user, 'aux._userInventoryContext');
    } else {
        return null;
    }
}

/**
 * Gets the first bot which matches all of the given filters.
 * @param filters The filter functions that the bot needs to match.
 * @returns The first bot that matches all the given filters.
 *
 * @example
 * // Get a bot by the "name" tag.
 * let bot = getBot(byTag("name", "The bot's name"));
 */
function getBot(...filters: BotFilterFunction[]): Bot;

/**
 * Gets the first bot ordered by ID which matches the given tag and filter.
 * @param tag The tag the bot should match.
 * @param filter The optional value or filter the bot should match.
 *
 * @example
 * // Get a bot with the "name" tag.
 * // Shorthand for getBot(byTag("name"))
 * let bot = getBot("name");
 *
 * @example
 * // Get a bot by the "name" tag.
 * // Shorthand for getBot(byTag("name", "The bot's name"))
 * let bot = getBot("name", "The bot's name");
 *
 * @example
 * // Get a bot where the "name" tag starts with the letter "N".
 * // Shorthand for getBot(byTag("name", name => name.startsWith("N")))
 * let bot = getBot("name", name => name.startsWith("N"));
 */
function getBot(tag: string, filter?: any | TagFilter): Bot;

/**
 * Gets the first bot ordered by ID.
 * @returns The bot with the first ID when sorted alphebetically.
 *
 * @example
 * let firstBot = getBot();
 */
function getBot(): Bot {
    const bots = getBots(...arguments);
    return bots.first();
}

/**
 * Gets the list of bots which match all of the given filters.
 * @param filters The filter functions that the bots need to match.
 * @returns A list of bots that match all the given filters. If no bots match then an empty list is returned.
 *
 * @example
 * // Get all the bots that are red.
 * let bots = getBots(byTag("aux.color", "red"));
 */
function getBots(...filters: ((bot: Bot) => boolean)[]): Bot[];

/**
 * Gets the list of bots that have the given tag matching the given filter value.
 * @param tag The tag the bot should match.
 * @param filter The value or filter the bot should match.
 *
 * @example
 * // Get all the bots that are red.
 * // Shorthand for getBots(byTag("aux.color", "red"))
 * let bots = getBots("aux.color", "red");
 */
function getBots(tag: string, filter?: any | TagFilter): Bot[];

/**
 * Gets a list of all the bots.
 *
 * @example
 * // Gets all the bots in the channel.
 * let bots = getBots();
 */
function getBots(): Bot[] {
    const calc = getCalculationContext();
    if (arguments.length > 0 && typeof arguments[0] === 'function') {
        return calc.sandbox.interface.listObjects(...arguments);
    } else {
        const tag: string = arguments[0];
        if (typeof tag === 'undefined') {
            return calc.sandbox.interface.objects.slice();
        } else if (!tag) {
            return [];
        }
        const filter = arguments[1];
        return calc.sandbox.interface.listObjectsWithTag(trimTag(tag), filter);
    }
}

/**
 * Gets the list of tag values from bots that have the given tag.
 * @param tag The tag.
 * @param filter THe optional filter to use for the values.
 */
function getBotTagValues(tag: string, filter?: TagFilter): any[] {
    const calc = getCalculationContext();
    return calc.sandbox.interface.listTagValues(trimTag(tag), filter);
}

/**
 * Creates a filter function that checks whether bots have the given tag and value.
 * @param tag The tag to check.
 * @param filter The value or filter that the tag should match.
 *
 * @example
 * // Find all the bots with a "name" of "bob".
 * let bobs = getBots(byTag("name", "bob"));
 *
 * @example
 * // Find all bots with a height larger than 2.
 * let bots = getBots(byTag("height", height => height > 2));
 *
 * @example
 * // Find all the bots with the "test" tag.
 * let bots = getBots(byTag("test"));
 */
function byTag(tag: string, filter?: TagFilter): BotFilterFunction {
    if (filter && typeof filter === 'function') {
        return bot => {
            let val = getTag(bot, tag);
            return hasValue(val) && filter(val);
        };
    } else if (hasValue(filter)) {
        return bot => {
            let val = getTag(bot, tag);
            return hasValue(val) && filter === val;
        };
    } else {
        return bot => {
            let val = getTag(bot, tag);
            return hasValue(val);
        };
    }
}

/**
 * Creates a filter function that checks whether bots are in the given context.
 * @param context The context to check.
 * @returns A function that returns true if the given bot is in the context and false if it is not.
 *
 * @example
 * // Find all the bots in the "test" context.
 * let bots = getBots(inContext("test"));
 */
function inContext(context: string): BotFilterFunction {
    return byTag(context, true);
}

/**
 * Creates a filter function that checks whether bots are at the given position in the given context.
 * @param context The context that the bots should be in.
 * @param x The X position in the context that the bots should be at.
 * @param y The Y position in the context that the bots should be at.
 * @returns A function that returns true if the given bot is at the given position and false if it is not.
 *
 * @example
 * // Find all the bots at (1, 2) in the "test" context.
 * let bots = getBots(atPosition("test", 1, 2));
 */
function atPosition(context: string, x: number, y: number): BotFilterFunction {
    const inCtx = inContext(context);
    const atX = byTag(`${context}.x`, x);
    const atY = byTag(`${context}.y`, y);
    const filter: BotFilterFunction = b => inCtx(b) && atX(b) && atY(b);
    filter.sort = b => getTag(b, `${context}.sortOrder`) || 0;
    return filter;
}

/**
 * Creates a filter function that checks whether bots are in the same stack as the given bot.
 * @param bot The bot that other bots should be checked against.
 * @param context The context that other bots should be checked in.
 * @returns A function that returns true if the given bot is in the same stack as the original bot.
 *
 * @example
 * // Find all bots in the same stack as `this` in the "test" context.
 * let bots = getBots(inStack(this, "test"));
 *
 */
function inStack(bot: Bot, context: string): BotFilterFunction {
    return atPosition(
        context,
        getTag(bot, `${context}.x`),
        getTag(bot, `${context}.y`)
    );
}

/**
 * Creates a function that filters bots by whether they are neighboring the given bot.
 * @param bot The bot that other bots should be checked against.
 * @param context The context that other bots should be checked in.
 * @param direction The neighboring direction to check.
 * @returns A function that returns true if the given bot is next to the original bot.
 *
 * @example
 * // Find all bots in front of `this` bot in the "test" context.
 * let bots = getBots(neighboring(this, "test", "front"));
 */
function neighboring(
    bot: Bot,
    context: string,
    direction: 'front' | 'left' | 'right' | 'back'
): BotFilterFunction {
    const offsetX = direction === 'left' ? 1 : direction === 'right' ? -1 : 0;
    const offsetY = direction === 'back' ? 1 : direction === 'front' ? -1 : 0;

    const x = getTag(bot, `${context}.x`);
    const y = getTag(bot, `${context}.y`);

    return atPosition(context, x + offsetX, y + offsetY);
}

/**
 * Creates a function that filters bots by whether they match any of the given filters.
 * @param filters The filter functions that a bot should be tested against.
 *
 * @example
 * // Find all bots with the name "bob" or height 2.
 * let bots = getBots(
 *   either(
 *     byTag("name", "bob"),
 *     byTag("height", height => height === 2)
 *   )
 * );
 */
function either(...filters: BotFilterFunction[]): BotFilterFunction {
    return bot => filters.some(f => f(bot));
}

/**
 * Creates a function that negates the result of the given function.
 * @param filter The function whose results should be negated.
 *
 * @example
 * // Find all bots that are not in the "test" context.
 * let bots = getBots(not(inContext("test")));
 */
function not(filter: BotFilterFunction): BotFilterFunction {
    return bot => !filter(bot);
}

/**
 * Gets the value of the given tag stored in the given bot.
 * @param bot The bot.
 * @param tag The tag.
 *
 * @example
 * // Get the "aux.color" tag from the `this` bot.
 * let color = getTag(this, "aux.color");
 */
function getTag(bot: Bot, ...tags: string[]): any {
    let current: any = bot;
    for (let i = 0; i < tags.length; i++) {
        if (isFile(current)) {
            const tag = trimTag(tags[i]);
            const calc = getCalculationContext();
            if (calc) {
                current = calc.sandbox.interface.getTag(current, tag);
            } else {
                current = bot.tags[tag];
            }
        } else {
            return current;
        }
    }

    return current;
}

/**
 * Gets weather the current tag exists on the given bot.
 * @param bot The bot.
 * @param tag The tag to check.
 *
 * @example
 * // Determine if the "aux.label" tag exists on the `this` bot.
 * let hasLabel = hasTag(this, "aux.label");
 * if (hasLabel) {
 *   // Do something...
 * }
 */
function hasTag(bot: Bot, ...tags: string[]): boolean {
    let current: any = bot;
    const calc = getCalculationContext();
    for (let i = 0; i < tags.length; i++) {
        if (isFile(current)) {
            const tag = trimTag(tags[i]);
            if (calc) {
                current = calc.sandbox.interface.getTag(current, tag);
            } else {
                current = bot.tags[tag];
            }
        } else {
            if (current != null && current != undefined && current != '') {
                return true;
            } else {
                return false;
            }
        }
    }

    if (current != null && current != undefined && current != '') {
        return true;
    } else {
        return false;
    }
}

/**
 * Sets the value of the given tag stored in the given bot.
 * @param bot The bot.
 * @param tag The tag to set.
 * @param value The value to set.
 *
 * @example
 * // Set a bot's color to "green".
 * setTag(this, "aux.color", "green");
 */
function setTag(bot: Bot | Bot[] | BotTags, tag: string, value: any): any {
    tag = trimTag(tag);
    if (Array.isArray(bot) && bot.length > 0 && isFile(bot[0])) {
        const calc = getCalculationContext();
        for (let i = 0; i < bot.length; i++) {
            calc.sandbox.interface.setTag(bot[i], tag, value);
        }
        return value;
    } else if (bot && isFile(bot)) {
        const calc = getCalculationContext();
        return calc.sandbox.interface.setTag(bot, tag, value);
    } else {
        (<BotTags>bot)[tag] = value;
        return value;
    }
}

/**
 * Gets the list of files that are in the given context.
 * @param context The context.
 */
function getBotsInContext(context: string): Bot[] {
    const calc = getCalculationContext();
    const result = calc.sandbox.interface.listObjectsWithTag(context, true);
    if (Array.isArray(result)) {
        return result;
    } else {
        return [result];
    }
}

/**
 * Gets the list of files that are at the same position in the given context as the given bot.
 * @param bot A bot in the stack of files.
 * @param context The context that the stack of files exists in.
 */
function getBotsInStack(bot: Bot, context: string): Bot[] {
    return getFilesAtPosition(
        context,
        getTag(bot, `${context}.x`),
        getTag(bot, `${context}.y`)
    );
}

/**
 * Gets the stack of files in the given context at the given position.
 * @param context The context that the files are in.
 * @param x The X position of the stack.
 * @param y The Y position of the stack.
 */
function getFilesAtPosition(context: string, x: number, y: number) {
    const result = getBotsInContext(context);
    const filtered = result.filter(f => {
        return (
            getTag(f, `${context}.x`) === x && getTag(f, `${context}.y`) === y
        );
    });
    return <Bot[]>sortBy(filtered, f => getTag(f, `${context}.sortOrder`) || 0);
}

/**
 * Gets the list of files that are in a stack next to the given bot in the given context.
 * @param bot The bot.
 * @param context The context that the stack of files exists in.
 * @param position The position next to the given bot to search for the stack.
 */
function getNeighboringBots(
    bot: Bot,
    context: string
): {
    front: Bot[];
    back: Bot[];
    left: Bot[];
    right: Bot[];
};
function getNeighboringBots(
    bot: Bot,
    context: string,
    position: 'left' | 'right' | 'front' | 'back'
): Bot[];
function getNeighboringBots(
    bot: Bot,
    context: string,
    position?: 'left' | 'right' | 'front' | 'back'
):
    | Bot[]
    | {
          front: Bot[];
          back: Bot[];
          left: Bot[];
          right: Bot[];
      } {
    if (!position) {
        return {
            front: getNeighboringBots(bot, context, 'front'),
            back: getNeighboringBots(bot, context, 'back'),
            left: getNeighboringBots(bot, context, 'left'),
            right: getNeighboringBots(bot, context, 'right'),
        };
    }

    const offsetX = position === 'left' ? 1 : position === 'right' ? -1 : 0;
    const offsetY = position === 'back' ? 1 : position === 'front' ? -1 : 0;

    const x = getTag(bot, `${context}.x`);
    const y = getTag(bot, `${context}.y`);

    return getFilesAtPosition(context, x + offsetX, y + offsetY);
}

/**
 * Creates a mod from exported mod data.
 * @param bot The mod data that should be loaded.
 * @param tags The tags that should be included in the output mod.
 * @returns The mod that was loaded from the data.
 */
function load(bot: any, ...tags: (string | RegExp)[]): Mod {
    if (typeof bot === 'string') {
        bot = JSON.parse(bot);
    }

    let diff: BotTags = {};

    let tagsObj = isFile(bot) ? bot.tags : bot;
    let fileTags = isFile(bot) ? tagsOnFile(bot) : Object.keys(bot);
    for (let fileTag of fileTags) {
        let add = false;
        if (tags.length > 0) {
            for (let tag of tags) {
                if (tag instanceof RegExp) {
                    if (tag.test(fileTag)) {
                        add = true;
                        break;
                    }
                } else {
                    if (tag === fileTag) {
                        add = true;
                        break;
                    }
                }
            }
        } else {
            add = true;
        }

        if (add) {
            diff[fileTag] = tagsObj[fileTag];
        }
    }

    return diff;
}

/**
 * Saves the given diff to a string of JSON.
 * @param bot The diff to save.
 */
function save(bot: any): string {
    if (isFile(bot)) {
        return JSON.stringify(bot.tags);
    } else {
        return JSON.stringify(bot);
    }
}

/**
 * Applies the given diff to the given bot.
 * @param bot The bot.
 * @param diff The diff to apply.
 */
function apply(bot: any, ...diffs: Mod[]) {
    let appliedDiffs: BotTags[] = [];
    diffs.forEach(diff => {
        if (!diff) {
            return;
        }
        let tags: BotTags;
        if (isFile(diff)) {
            tags = diff.tags;
        } else {
            tags = diff;
        }
        appliedDiffs.push(tags);
        for (let key in tags) {
            setTag(bot, key, tags[key]);
        }
    });

    if (isFile(bot)) {
        event(DIFF_ACTION_NAME, [bot], {
            diffs: appliedDiffs,
        });
    }
}

/**
 * Gets a diff that adds a bot to the given context.
 * @param context The context.
 * @param x The X position that the bot should be added at.
 * @param y The Y position that the bot should be added at.
 * @param index The index that the bot should be added at.
 */
function addToContext(
    context: string,
    x: number = 0,
    y: number = 0,
    index?: number
) {
    const calc = getCalculationContext();
    return calcAddToContextDiff(calc, context, x, y, index);
}

/**
 * Gets a diff that removes a bot from the given context.
 * @param context The context.
 */
function removeFromContext(context: string) {
    const calc = getCalculationContext();
    return calcRemoveFromContextDiff(calc, context);
}

/**
 * Gets a diff that sets the position of a bot in the given context when applied.
 * @param context The context.
 * @param x The X position.
 * @param y The Y position.
 * @param index The index.
 */
function setPosition(context: string, x?: number, y?: number, index?: number) {
    const calc = getCalculationContext();
    return calcSetPositionDiff(calc, context, x, y, index);
}

/**
 * Gets a diff that adds a bot to the current user's menu.
 */
function addToMenu(): BotTags {
    const context = getMenuContext();
    return {
        ...addToContext(context),
        [`${context}.id`]: uuid(),
    };
}

/**
 * Gets a diff that removes a bot from the current user's menu.
 */
function removeFromMenu(): BotTags {
    const context = getMenuContext();
    return {
        ...removeFromContext(context),
        [`${context}.id`]: null,
    };
}

/**
 * Shows a toast message to the user.
 * @param message The message to show.
 */
function toast(message: string) {
    let actions = getActions();
    actions.push(toastMessage(message));
}

/**
 * Tweens the user's camera to view the given bot.
 * @param bot The bot to view.
 * @param zoomValue The zoom value to use.
 */
function tweenTo(
    bot: Bot | string,
    zoomValue?: number,
    rotX?: number,
    rotY?: number
) {
    let actions = getActions();
    actions.push(calcTweenTo(getFileId(bot), zoomValue, rotX, rotY));
}

/**
 * Opens the QR Code Scanner.
 */
function openQRCodeScanner() {
    let actions = getActions();
    actions.push(calcOpenQRCodeScanner(true));
}

/**
 * Closes the QR Code Scanner.
 */
function closeQRCodeScanner() {
    let actions = getActions();
    actions.push(calcOpenQRCodeScanner(false));
}

/**
 * Shows the given QR Code.
 * @param code The code to show.
 */
function showQRCode(code: string) {
    let actions = getActions();
    actions.push(calcShowQRCode(true, code));
}

/**
 * Hides the QR Code.
 */
function hideQRCode() {
    let actions = getActions();
    actions.push(calcShowQRCode(false));
}

/**
 * Opens the barcode scanner.
 */
function openBarcodeScanner() {
    let actions = getActions();
    actions.push(calcOpenBarcodeScanner(true));
}

/**
 * Closes the barcode scanner.
 */
function closeBarcodeScanner() {
    let actions = getActions();
    actions.push(calcOpenBarcodeScanner(false));
}

/**
 * Shows the given barcode.
 * @param code The code that should be shown.
 * @param format The format that the barcode should be shown in.
 */
function showBarcode(code: string, format?: BarcodeFormat) {
    let actions = getActions();
    actions.push(calcShowBarcode(true, code, format));
}

/**
 * Hides the barcode.
 */
function hideBarcode() {
    let actions = getActions();
    actions.push(calcShowBarcode(false));
}

/**
 * Loads the channel with the given ID.
 * @param id The ID of the channel to load.
 */
function loadChannel(id: string) {
    let actions = getActions();
    actions.push(calcLoadSimulation(id));
}

/**
 * Unloads the channel with the given ID.
 * @param id The ID of the channel to unload.
 */
function unloadChannel(id: string) {
    let actions = getActions();
    actions.push(calcUnloadSimulation(id));
}

/**
 * Imports the AUX at the given URL.
 * @param url The URL to load.
 */
function importAUX(url: string) {
    let actions = getActions();
    actions.push(calcImportAUX(url));
}

/**
 * Sends a "hello" event to the server.
 */
function sayHello() {
    let actions = getActions();
    actions.push(remote(calcSayHello()));
}

/**
 * Sends an echo event to the server.
 * @param message The message to send to the server.
 */
function echo(message: string) {
    let actions = getActions();
    actions.push(remote(calcEcho(message)));
}

/**
 * Instructs the server to grant the given user the given role.
 * Only works in the admin channel.
 * @param username The username of the user that should be granted the role.
 * @param role The role to grant.
 */
function grantRole(username: string, role: string) {
    let actions = getActions();
    actions.push(remote(calcGrantRole(username, role)));
}

/**
 * Instructs the server to revoke the given role from the given user.
 * Only works in the admin channel.
 * @param username The username of the user that the role should be removed from.
 * @param role The role that should be revoked.
 */
function revokeRole(username: string, role: string) {
    let actions = getActions();
    actions.push(remote(calcRevokeRole(username, role)));
}

/**
 * Executes the given shell script on the server.
 * Only works in the admin channel.
 * @param script The shell script  that should be executed.
 */
function shell(script: string) {
    let actions = getActions();
    actions.push(remote(calcShell(script)));
}

/**
 * Backs up all the AUX channels to a Github Gist.
 * Only works in the admin channel.
 * @param auth The Github Personal Access Token that should be used to grant access to your Github account. See https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line
 */
function backupToGithub(auth: string) {
    let actions = getActions();
    actions.push(remote(calcBackupToGithub(auth)));
}

/**
 * Backs up all the AUX channels to a zip file.
 * Only works in the admin channel.
 */
function backupAsDownload() {
    let actions = getActions();
    actions.push(remote(calcBackupAsDownload()));
}

/**
 * Instructs AUXPlayer/Channel Designer to open the built-in developer console.
 * The dev console provides easy access to error messages and debug logs for formulas and actions.
 */
function openDevConsole() {
    let actions = getActions();
    actions.push(calcOpenConsole());
}

/**
 * Determines if the user is currently connected to the server.
 */
function isConnected(): boolean {
    const user = getUser();
    if (user) {
        const val = getTag(user, 'aux.connected');
        if (val) {
            return val.valueOf() || false;
        }
    }
    return false;
}

function __energyCheck() {
    let current = getEnergy();
    current -= 1;
    setEnergy(current);
    if (current <= 0) {
        throw new Error('Ran out of energy');
    }
}

// NOTE: Make sure to add functions that don't
// match their exported name here so that builtin code editors can figure out what they are.
export const typeDefinitionMap = new Map([
    ['mod.import', 'load'],
    ['mod.export', 'save'],
    ['player.getBot', 'getUser'],
]);

/**
 * Defines a set of functions that are able to make Bot Diffs.
 */
const mod = {
    addToContext,
    removeFromContext,
    addToMenu,
    removeFromMenu,
    setPosition,
    import: load,
    export: save,
    apply,
};

/**
 * Defines a set of functions that relate to common player operations.
 */
const player = {
    isInContext,
    goToContext,
    goToURL,
    openURL,
    getBot: getUser,
    getMenuContext,
    getInventoryContext,
    toast,
    tweenTo,
    openQRCodeScanner,
    closeQRCodeScanner,
    openBarcodeScanner,
    closeBarcodeScanner,
    showBarcode,
    hideBarcode,
    loadChannel,
    unloadChannel,
    importAUX,
    hasBotInInventory,
    showQRCode,
    hideQRCode,
    isConnected,
    currentContext,
    currentChannel,
    isDesigner,
    showInputForTag,

    openDevConsole,
};

const server = {
    sayHello,
    grantRole,
    revokeRole,
    shell,
    echo,
    backupToGithub,
    backupAsDownload,
};

/**
 * Defines a set of functions that relate to common math operations.
 */
const math = {
    sum,
    avg,
    sqrt,
    abs,
    stdDev,
    randomInt,
    random,
};

/**
 * Defines a set of functions that relate to common data operations.
 */
const data = {
    sort,
    join,
};

export default {
    // Namespaces
    data,
    mod,
    math,
    player,
    server,

    // Global functions
    combine,
    create,
    destroy,
    getBotsInContext,
    getBotsInStack,
    getNeighboringBots,
    shout,
    superShout,
    whisper,

    getBot,
    getBots,
    getBotTagValues,
    byTag,
    inContext,
    inStack,
    atPosition,
    neighboring,
    either,
    not,
    getTag,
    hasTag,
    setTag,
    removeTags,

    // Engine functions
    __energyCheck,
};
