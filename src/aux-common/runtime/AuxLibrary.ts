import { AuxRuntime } from './AuxRuntime';
import { AuxGlobalContext } from './AuxGlobalContext';
import {
    ScriptBot,
    hasValue,
    trimTag,
    isBot,
    BotTags,
    Bot,
    BOT_SPACE_TAG,
    toast as toastMessage,
    showJoinCode as calcShowJoinCode,
    requestFullscreen,
    exitFullscreen,
    html as htmlMessage,
    hideHtml as hideHtmlMessage,
    setClipboard as calcSetClipboard,
    tweenTo as calcTweenTo,
    showChat as calcShowChat,
    hideChat as calcHideChat,
    ShowChatOptions,
    runScript,
    enableAR as calcEnableAR,
    disableAR as calcDisableAR,
    BotAction,
} from '../bots';
import sortBy from 'lodash/sortBy';
import { BotFilterFunction } from '../Formulas/SandboxInterface';

/**
 * Defines an interface for a library of functions and values that can be used by formulas and listeners.
 */
export interface AuxLibrary {
    api: {
        [key: string]: any;
    };
    typeDefinitions?: string;
}

type TagFilter =
    | ((value: any) => boolean)
    | string
    | number
    | boolean
    | null
    | undefined;

/**
 * Defines a type that represents a mod.
 * That is, a set of tags that can be applied to another bot.
 */
type Mod = BotTags | Bot;

/**
 * Creates a library that includes the default functions and APIs.
 * @param context The global context that should be used.
 */
export function createDefaultLibrary(context: AuxGlobalContext) {
    return {
        api: {
            getBots,
            getBot,
            getBotTagValues,
            getID,
            getJSON,
            getTag,

            byTag,
            byMod,
            inDimension,
            atPosition,
            inStack,
            neighboring,
            bySpace,
            byCreator,
            either,
            not,

            player: {
                toast,
                showJoinCode,
                requestFullscreenMode,
                exitFullscreenMode,
                showHtml,
                hideHtml,
                setClipboard,
                tweenTo,
                moveTo,
                showChat,
                hideChat,
                run,
                version,
                device,
                enableAR,
                disableAR,
            },
        },
    };

    /**
     * Gets a list of all the bots.
     *
     * @example
     * // Gets all the bots in the universe.
     * let bots = getBots();
     */
    function getBots(...args: any[]): ScriptBot[] {
        if (args.length > 0 && typeof args[0] === 'function') {
            const filtered = context.bots.filter(b => args.every(f => f(b)));

            const sortFuncs = args
                .filter(f => typeof f.sort === 'function')
                .map(f => f.sort);
            const sorted =
                sortFuncs.length > 0
                    ? sortBy(filtered, ...sortFuncs)
                    : filtered;

            return sorted;
        }

        let tag: string = args[0];
        if (typeof tag === 'undefined') {
            return context.bots.slice();
        } else if (!tag) {
            return [];
        }
        tag = trimTag(tag);
        const filter = arguments[1];

        if (hasValue(filter)) {
            if (typeof filter === 'function') {
                return context.bots.filter(b => filter(b.tags[tag]));
            } else {
                return context.bots.filter(b => b.tags[tag] === filter);
            }
        } else {
            return context.bots.filter(b => hasValue(b.tags[tag]));
        }
    }

    /**
     * Gets the first bot ordered by ID.
     * @returns The bot with the first ID when sorted alphebetically.
     *
     * @example
     * let firstBot = getBot();
     */
    function getBot(...args: any[]): Bot {
        const bots = getBots(...args);
        return bots.first();
    }

    /**
     * Gets the list of tag values from bots that have the given tag.
     * @param tag The tag.
     * @param filter THe optional filter to use for the values.
     */
    function getBotTagValues(tag: string, filter?: TagFilter): any[] {
        const values = context.bots
            .map(b => getTag(b, tag))
            .filter(t => hasValue(t));
        if (hasValue(filter)) {
            if (typeof filter === 'function') {
                return values.filter(val => filter(val));
            } else {
                return values.filter(val => val === filter);
            }
        } else {
            return values;
        }
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
        tag = trimTag(tag);
        if (filter && typeof filter === 'function') {
            return bot => {
                let val = bot.tags[tag];
                return hasValue(val) && filter(val);
            };
        } else if (hasValue(filter)) {
            return bot => {
                let val = bot.tags[tag];
                return hasValue(val) && filter === val;
            };
        } else if (filter === null) {
            return bot => {
                let val = bot.tags[tag];
                return !hasValue(val);
            };
        } else {
            return bot => {
                let val = bot.tags[tag];
                return hasValue(val);
            };
        }
    }

    /**
     * Creates a filter function that checks whether bots match the given mod.
     * @param mod The mod that bots should be checked against.
     *
     * @example
     * // Find all the bots with a height set to 1 and auxColor set to "red".
     * let bots = getBots(byMod({
     *      "auxColor": "red",
     *      height: 1
     * }));
     */
    function byMod(mod: Mod): BotFilterFunction {
        let tags = isBot(mod) ? mod.tags : mod;
        let filters = Object.keys(tags).map(k => byTag(k, tags[k]));
        return bot => filters.every(f => f(bot));
    }

    /**
     * Creates a filter function that checks whether bots are in the given dimension.
     * @param dimension The dimension to check.
     * @returns A function that returns true if the given bot is in the dimension and false if it is not.
     *
     * @example
     * // Find all the bots in the "test" dimension.
     * let bots = getBots(inDimension("test"));
     */
    function inDimension(dimension: string): BotFilterFunction {
        return byTag(dimension, true);
    }

    /**
     * Creates a filter function that checks whether bots are at the given position in the given dimension.
     * @param dimension The dimension that the bots should be in.
     * @param x The X position in the dimension that the bots should be at.
     * @param y The Y position in the dimension that the bots should be at.
     * @returns A function that returns true if the given bot is at the given position and false if it is not.
     *
     * @example
     * // Find all the bots at (1, 2) in the "test" dimension.
     * let bots = getBots(atPosition("test", 1, 2));
     */
    function atPosition(
        dimension: string,
        x: number,
        y: number
    ): BotFilterFunction {
        const inCtx = inDimension(dimension);
        const atX = byTag(`${dimension}X`, x);
        const atY = byTag(`${dimension}Y`, y);
        const filter: BotFilterFunction = b => inCtx(b) && atX(b) && atY(b);
        filter.sort = b => getTag(b, `${dimension}SortOrder`) || 0;
        return filter;
    }

    /**
     * Creates a filter function that checks whether bots are in the same stack as the given bot.
     * @param bot The bot that other bots should be checked against.
     * @param dimension The dimension that other bots should be checked in.
     * @returns A function that returns true if the given bot is in the same stack as the original bot.
     *
     * @example
     * // Find all bots in the same stack as `this` in the "test" dimension.
     * let bots = getBots(inStack(this, "test"));
     *
     */
    function inStack(bot: Bot, dimension: string): BotFilterFunction {
        return atPosition(
            dimension,
            getTag(bot, `${dimension}X`),
            getTag(bot, `${dimension}Y`)
        );
    }

    /**
     * Creates a function that filters bots by whether they are neighboring the given bot.
     * @param bot The bot that other bots should be checked against.
     * @param dimension The dimension that other bots should be checked in.
     * @param direction The neighboring direction to check.
     * @returns A function that returns true if the given bot is next to the original bot.
     *
     * @example
     * // Find all bots in front of `this` bot in the "test" dimension.
     * let bots = getBots(neighboring(this, "test", "front"));
     */
    function neighboring(
        bot: Bot,
        dimension: string,
        direction: 'front' | 'left' | 'right' | 'back'
    ): BotFilterFunction {
        const offsetX =
            direction === 'left' ? 1 : direction === 'right' ? -1 : 0;
        const offsetY =
            direction === 'back' ? 1 : direction === 'front' ? -1 : 0;

        const x = getTag(bot, `${dimension}X`);
        const y = getTag(bot, `${dimension}Y`);

        return atPosition(dimension, x + offsetX, y + offsetY);
    }

    /**
     * Creates a function that filters bots by whether they are in the given space.
     * @param space The space that the bots should be in.
     */
    function bySpace(space: string): BotFilterFunction {
        return byTag(BOT_SPACE_TAG, space);
    }

    /**
     * Creates a filter function that checks whether bots were created by the given bot.
     * @param bot The bot to determine weather the bots have been created by it or not.
     * @returns A function that returns true if the bot was created by the given bot.
     *
     * @example
     * // Find all the bots created by the yellow bot.
     * let bots = getBots(byCreator(getBot('auxColor','yellow')));
     */
    function byCreator(bot: Bot | string) {
        return byTag('auxCreator', getID(bot));
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
     * // Find all bots that are not in the "test" dimension.
     * let bots = getBots(not(inDimension("test")));
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
     * // Get the "auxColor" tag from the `this` bot.
     * let color = getTag(this, "auxColor");
     */
    function getTag(bot: Bot, ...tags: string[]): any {
        let current: any = bot;
        for (let i = 0; i < tags.length; i++) {
            const tag = trimTag(tags[i].toString());
            if (isBot(current)) {
                current = current.tags[tag];
            } else {
                return current;
            }
        }

        return current;
    }

    /**
     * Gets the ID from the given bot.
     * @param bot The bot or string.
     */
    function getID(bot: Bot | string): string {
        if (typeof bot === 'string') {
            return bot || null;
        } else if (bot) {
            return bot.id || null;
        }

        return null;
    }

    /**
     * Gets JSON for the given data.
     * @param data The data.
     */
    function getJSON(data: any): string {
        return JSON.stringify(data);
    }

    // Actions

    /**
     * Shows a toast message to the user.
     * @param message The message to show.
     * @param duration The number of seconds the message should be on the screen. (Defaults to 2)
     */
    function toast(message: string, duration: number = 2) {
        return addAction(toastMessage(message, duration));
    }

    /**
     * Shows a QR Code that contains a link to a universe and dimension.
     * @param universe The universe that should be joined. Defaults to the current universe.
     * @param dimension The dimension that should be joined. Defaults to the current dimension.
     */
    function showJoinCode(universe?: string, dimension?: string) {
        return addAction(calcShowJoinCode(universe, dimension));
    }

    /**
     * Requests that AUX enters fullscreen mode.
     * Depending on the web browser, this may ask the player for permission.
     */
    function requestFullscreenMode() {
        return addAction(requestFullscreen());
    }

    /**
     * Exits fullscreen mode.
     */
    function exitFullscreenMode() {
        return addAction(exitFullscreen());
    }

    /**
     * Shows some HTML to the user.
     * @param html The HTML to show.
     */
    function showHtml(html: string) {
        return addAction(htmlMessage(html));
    }

    /**
     * Hides the HTML from the user.
     */
    function hideHtml() {
        return addAction(hideHtmlMessage());
    }

    /**
     * Sets the text stored in the player's clipboard.
     * @param text The text to set to the clipboard.
     */
    function setClipboard(text: string) {
        return addAction(calcSetClipboard(text));
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
        rotY?: number,
        duration?: number
    ) {
        return addAction(
            calcTweenTo(getID(bot), zoomValue, rotX, rotY, duration)
        );
    }

    /**
     * Instantly moves the user's camera to view the given bot.
     * @param bot The bot to view.
     * @param zoomValue The zoom value to use.
     * @param rotX The X rotation.
     * @param rotY The Y rotation.
     */
    function moveTo(
        bot: Bot | string,
        zoomValue?: number,
        rotX?: number,
        rotY?: number
    ) {
        return tweenTo(bot, zoomValue, rotX, rotY, 0);
    }

    /**
     * Shows the chat bar.
     * @param placeholderOrOptions The placeholder text or options. (optional)
     */
    function showChat(placeholderOrOptions?: string | ShowChatOptions) {
        const action =
            typeof placeholderOrOptions === 'string'
                ? calcShowChat({
                      placeholder: placeholderOrOptions,
                  })
                : calcShowChat(placeholderOrOptions);
        return addAction(action);
    }

    /**
     * Hides the run bar.
     */
    function hideChat() {
        return addAction(calcHideChat());
    }

    /**
     * Enqueues the given script to execute after this script is done running.
     * @param script The script that should be executed.
     */
    function run(script: string) {
        return addAction(runScript(script));
    }

    /**
     * Gets information about the version of AUX that is running.
     */
    function version() {
        return context.version;
    }

    /**
     * Gets information about the device that the player is using.
     */
    function device() {
        if (context.device) {
            return context.device;
        }
        return {
            supportsAR: null as boolean,
            supportsVR: null as boolean,
        };
    }

    /**
     * Enables Augmented Reality features.
     */
    function enableAR() {
        return addAction(calcEnableAR());
    }

    /**
     * Disables Augmented Reality features.
     */
    function disableAR() {
        return addAction(calcDisableAR());
    }

    function addAction(action: BotAction) {
        context.enqueueAction(action);
        return action;
    }
}
