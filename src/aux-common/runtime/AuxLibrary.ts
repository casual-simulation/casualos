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
    enableVR as calcEnableVR,
    disableVR as calcDisableVR,
    showUploadAuxFile as calcShowUploadAuxFile,
    openQRCodeScanner as calcOpenQRCodeScanner,
    showQRCode as calcShowQRCode,
    openBarcodeScanner as calcOpenBarcodeScanner,
    showBarcode as calcShowBarcode,
    importAUX as calcImportAUX,
    showInputForTag as calcShowInputForTag,
    replaceDragBot as calcReplaceDragBot,
    goToDimension as calcGoToDimension,
    goToURL as calcGoToURL,
    openURL as calcOpenURL,
    checkout as calcCheckout,
    playSound as calcPlaySound,
    setupUniverse as calcSetupUniverse,
    shell as calcShell,
    backupToGithub as calcBackupToGithub,
    backupAsDownload as calcBackupAsDownload,
    finishCheckout as calcFinishCheckout,
    markHistory as calcMarkHistory,
    browseHistory as calcBrowseHistory,
    restoreHistoryMark as calcRestoreHistoryMark,
    loadFile as calcLoadFile,
    BotAction,
    download,
    BotsState,
    CameraType,
    BarcodeFormat,
    loadSimulation,
    unloadSimulation,
    getUploadState,
    addState,
    PortalType,
    getPortalTag,
    ShowInputOptions,
    KNOWN_PORTALS,
    openConsole,
    StartCheckoutOptions,
    tagsOnBot,
} from '../bots';
import sortBy from 'lodash/sortBy';
import { BotFilterFunction } from '../Formulas/SandboxInterface';
import every from 'lodash/every';
import {
    remote as calcRemote,
    DeviceSelector,
} from '@casual-simulation/causal-trees';

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
 * An interface that is used to say which user/device/session an event should be sent to.
 */
export interface SessionSelector {
    username?: string;
    device?: string;
    session?: string;
}

/**
 * Defines an interface for options that complete payment for a product.
 */
interface FinishCheckoutOptions {
    /**
     * The secret API key that should be used to checkout with stripe.
     */
    secretKey: string;

    /**
     * The token that authorized payment from the user.
     */
    token: string;

    /**
     * The amount that should be charged in the currency's smallest unit. (cents, etc.)
     */
    amount: number;

    /**
     * The three character currency code.
     */
    currency: string;

    /**
     * The description for the charge.
     */
    description: string;

    /**
     * Any extra info that should be included in the onPaymentSuccessful() or onPaymentFailed() events for this checkout.
     */
    extra?: any;
}

/**
 * Defines an interface for options that mark a specific time in history.
 */
interface MarkHistoryOptions {
    /**
     * The message that the mark should contain.
     */
    message: string;
}

/**
 * Options for loading a file.
 */
interface LoadFileOptions {
    /**
     * The shout that should be made when the request finishes.
     */
    callbackShout?: string;
}

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
            getMod,
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

            remote,

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
                enableVR,
                disableVR,
                downloadBots,
                downloadUniverse,
                showUploadAuxFile,
                openQRCodeScanner,
                closeQRCodeScanner,
                showQRCode,
                hideQRCode,
                openBarcodeScanner,
                closeBarcodeScanner,
                showBarcode,
                hideBarcode,
                loadUniverse,
                unloadUniverse,
                importAUX,
                replaceDragBot,

                getBot: getPlayerBot,
                isInDimension,
                getCurrentDimension,
                getCurrentUniverse,
                getMenuDimension,
                getInventoryDimension,
                getPortalDimension,
                getDimensionalDepth,
                showInputForTag,
                goToDimension,
                goToURL,
                openURL,
                openDevConsole,
                checkout,
                playSound,
                hasBotInInventory,
            },

            server: {
                setupUniverse,
                shell,
                backupToGithub,
                backupAsDownload,
                finishCheckout,
                markHistory,
                browseHistory,
                restoreHistoryMark,
                restoreHistoryMarkToUniverse,
                loadFile,
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
     * Creates a mod from exported mod data.
     * @param bot The mod data that should be loaded.
     * @param tags The tags that should be included in the output mod.
     * @returns The mod that was loaded from the data.
     */
    function getMod(bot: any, ...tags: (string | RegExp)[]): Mod {
        if (typeof bot === 'string') {
            bot = JSON.parse(bot);
        }

        let diff: BotTags = {};

        let tagsObj = isBot(bot) ? bot.tags : bot;
        let botTags = isBot(bot) ? tagsOnBot(bot) : Object.keys(bot);
        for (let botTag of botTags) {
            let add = false;
            if (tags.length > 0) {
                for (let tag of tags) {
                    if (tag instanceof RegExp) {
                        if (tag.test(botTag)) {
                            add = true;
                            break;
                        }
                    } else {
                        if (tag === botTag) {
                            add = true;
                            break;
                        }
                    }
                }
            } else {
                add = true;
            }

            if (add) {
                diff[botTag] = tagsObj[botTag];
            }
        }

        return diff;
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

    /**
     * Enables Virtual Reality features.
     */
    function enableVR() {
        return addAction(calcEnableVR());
    }

    /**
     * Disables Virtual Reality features.
     */
    function disableVR() {
        return addAction(calcDisableVR());
    }

    /**
     * Downloads the given list of bots.
     * @param bots The bots that should be downloaded.
     * @param filename The name of the file that the bots should be downloaded as.
     */
    function downloadBots(bots: Bot[], filename: string) {
        let state: BotsState = {};
        for (let bot of bots) {
            state[bot.id] = bot;
        }
        return addAction(
            download(
                JSON.stringify(getDownloadState(state)),
                formatAuxFilename(filename),
                'application/json'
            )
        );
    }

    function downloadUniverse() {
        return downloadBots(
            getBots(bySpace('shared')),
            `${getCurrentUniverse()}.aux`
        );
    }

    /**
     * Shows the "Upload Universe" dialog.
     */
    function showUploadAuxFile() {
        return addAction(calcShowUploadAuxFile());
    }

    /**
     * Opens the QR Code Scanner.
     * @param camera The camera that should be used.
     */
    function openQRCodeScanner(camera?: CameraType) {
        const event = calcOpenQRCodeScanner(true, camera);
        return addAction(event);
    }

    /**
     * Closes the QR Code Scanner.
     */
    function closeQRCodeScanner() {
        const event = calcOpenQRCodeScanner(false);
        return addAction(event);
    }

    /**
     * Shows the given QR Code.
     * @param code The code to show.
     */
    function showQRCode(code: string) {
        const event = calcShowQRCode(true, code);
        return addAction(event);
    }

    /**
     * Hides the QR Code.
     */
    function hideQRCode() {
        const event = calcShowQRCode(false);
        return addAction(event);
    }

    /**
     * Opens the barcode scanner.
     * @param camera The camera that should be used.
     */
    function openBarcodeScanner(camera?: CameraType) {
        const event = calcOpenBarcodeScanner(true, camera);
        return addAction(event);
    }

    /**
     * Closes the barcode scanner.
     */
    function closeBarcodeScanner() {
        const event = calcOpenBarcodeScanner(false);
        return addAction(event);
    }

    /**
     * Shows the given barcode.
     * @param code The code that should be shown.
     * @param format The format that the barcode should be shown in.
     */
    function showBarcode(code: string, format?: BarcodeFormat) {
        const event = calcShowBarcode(true, code, format);
        return addAction(event);
    }

    /**
     * Hides the barcode.
     */
    function hideBarcode() {
        const event = calcShowBarcode(false);
        return addAction(event);
    }

    /**
     * Loads the universe with the given ID.
     * @param id The ID of the universe to load.
     */
    function loadUniverse(id: string) {
        const event = loadSimulation(id);
        return addAction(event);
    }

    /**
     * Unloads the universe with the given ID.
     * @param id The ID of the universe to unload.
     */
    function unloadUniverse(id: string) {
        const event = unloadSimulation(id);
        return addAction(event);
    }

    /**
     * Imports the AUX from the given URL or JSON
     * @param urlOrJSON The URL or JSON to load.
     *                  If given JSON, then it will be imported as if it was a .aux file.
     *                  If given a URL, then it will be downloaded and then imported.
     */
    function importAUX(urlOrJSON: string) {
        try {
            const data = JSON.parse(urlOrJSON);
            const state = getUploadState(data);
            const event = addState(state);
            return addAction(event);
        } catch {
            const event = calcImportAUX(urlOrJSON);
            return addAction(event);
        }
    }

    /**
     * Replaces the bot that the user is beginning to drag.
     * Only works from inside a onDrag() or onAnyBotDrag() listen tag.
     * @param bot The bot or mod that should be dragged instead of the original.
     */
    function replaceDragBot(bot: Mod) {
        const event = calcReplaceDragBot(context.unwrapBot(bot));
        return addAction(event);
    }

    /**
     * Get's the current player's bot.
     */
    function getPlayerBot() {
        return context.playerBot;
    }

    /**
     * Derermines whether the player is in the given dimension.
     * @param dimension The dimension.
     */
    function isInDimension(dimension: string) {
        return (
            getCurrentDimension() === dimension &&
            getCurrentDimension() != undefined
        );
    }

    /**
     * Gets the dimension that the player is currently viewing.
     */
    function getCurrentDimension(): string {
        const user = context.playerBot;
        if (user) {
            const dimension = getTag(user, 'auxPagePortal');
            return dimension || undefined;
        }
        return undefined;
    }

    /**
     * Gets the universe that the player is currently in.
     */
    function getCurrentUniverse(): string {
        const user = context.playerBot;
        if (user) {
            let universe = getTag(user, 'auxUniverse');
            return universe || undefined;
        }
        return undefined;
    }

    /**
     * Gets the name of the dimension that is used for the current user's inventory.
     */
    function getInventoryDimension(): string {
        const user = context.playerBot;
        if (user) {
            return getTag(user, 'auxInventoryPortal');
        } else {
            return null;
        }
    }

    /**
     * Gets the name of the dimension that is used for the current user's menu.
     */
    function getMenuDimension(): string {
        const user = context.playerBot;
        if (user) {
            return getTag(user, 'auxMenuPortal');
        } else {
            return null;
        }
    }

    /**
     * Gets the dimension that is loaded into the given portal for the player.
     * If no dimension is loaded, then null is returned.
     * @param portal The portal type.
     */
    function getPortalDimension(portal: PortalType) {
        const user = context.playerBot;
        if (!user) {
            return null;
        }

        const portalTag = getPortalTag(portal);
        const dimension = getTag(user, portalTag);

        if (!hasValue(dimension)) {
            return null;
        }

        return dimension;
    }

    /**
     * Gets the distance that the player bot is from the given dimension.
     *
     * Returns 0 if the player bot is in the dimension, 1 if the dimension is in a portal, and -1 if neither are true.
     *
     * @param dimension The dimension to check for.
     */
    function getDimensionalDepth(dimension: string): number {
        const bot = context.playerBot;

        if (getTag(bot, dimension) === true) {
            return 0;
        } else if (
            KNOWN_PORTALS.some(portal => getTag(bot, portal) === dimension)
        ) {
            return 1;
        }
        return -1;
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
     * player.showInputForTag(this, "auxLabel", {
     *            title: "Change the label",
     *            type: "text"
     * });
     *
     * @example
     * // Show a color picker for the bot's color.
     * player.showInputForTag(this, "auxColor", {
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
        const event = calcShowInputForTag(id, trimTag(tag), options);
        return addAction(event);
    }

    /**
     * Redirects the user to the given dimension.
     * @param dimension The dimension to go to.
     *
     * @example
     * // Send the player to the "welcome" dimension.
     * player.goToDimension("welcome");
     */
    function goToDimension(dimension: string) {
        const event = calcGoToDimension(dimension);
        return addAction(event);
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
        const event = calcGoToURL(url);
        return addAction(event);
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
        const event = calcOpenURL(url);
        return addAction(event);
    }

    /**
     * Instructs auxPlayer to open the built-in developer console.
     * The dev console provides easy access to error messages and debug logs for formulas and actions.
     */
    function openDevConsole() {
        const event = openConsole();
        return addAction(event);
    }

    /**
     * Shows a checkout screen that lets the user purchase something.
     *
     * @param options The options for the payment box.
     *
     * @example
     * // Show a checkout box for 10 cookies
     * player.checkout({
     *   productId: '10_cookies',
     *   title: '10 Cookies',
     *   description: '$5.00',
     *   processingUniverse: 'cookies_checkout'
     * });
     *
     */
    function checkout(options: StartCheckoutOptions) {
        const event = calcCheckout(options);
        return addAction(event);
    }

    /**
     *   Play given url's audio
     * @example
     * // Send the player to the "welcome" dimension.
     * player.playSound("https://freesound.org/data/previews/58/58277_634166-lq.mp3");
     */
    function playSound(url: string) {
        const event = calcPlaySound(url);
        return addAction(event);
    }

    /**
     * Determines whether the player has the given bot in their inventory.
     * @param bots The bot or bots to check.
     */
    function hasBotInInventory(bots: Bot | Bot[]): boolean {
        if (!Array.isArray(bots)) {
            bots = [bots];
        }
        let inventoryDimension = getInventoryDimension();
        if (!hasValue(inventoryDimension)) {
            return false;
        }
        return every(bots, f => getTag(f, inventoryDimension) === true);
    }

    /**
     * Sends an event to the server to setup a new universe if it does not exist.
     * @param universe The universe.
     * @param botOrMod The bot or mod that should be cloned into the new universe.
     */
    function setupUniverse(universe: string, botOrMod?: Mod) {
        return remote(calcSetupUniverse(universe, context.unwrapBot(botOrMod)));
    }

    /**
     * Executes the given shell script on the server.
     * @param script The shell script  that should be executed.
     */
    function shell(script: string) {
        return remote(calcShell(script));
    }

    /**
     * Backs up all the AUX universes to a Github Gist.
     * @param auth The Github Personal Access Token that should be used to grant access to your Github account. See https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line
     */
    function backupToGithub(auth: string) {
        return remote(calcBackupToGithub(auth));
    }

    /**
     * Backs up all the AUX universes to a zip bot.
     */
    function backupAsDownload(target: SessionSelector) {
        return remote(calcBackupAsDownload(convertSessionSelector(target)));
    }

    /**
     * Finishes the checkout process by charging the payment fee to the user.
     *
     * @param options The options for finishing the checkout.
     *
     * @example
     * // Finish the checkout process
     * server.finishCheckout({
     *   secretKey: 'YOUR_SECRET_API_KEY',
     *   token: 'token from onCheckout',
     *
     *   // 1000 cents == $10.00
     *   amount: 1000,
     *   currency: 'usd',
     *   description: 'Description for purchase'
     * });
     */
    function finishCheckout(options: FinishCheckoutOptions) {
        const event = calcFinishCheckout(
            options.secretKey,
            options.token,
            options.amount,
            options.currency,
            options.description,
            options.extra
        );
        return addAction(event);
    }

    /**
     * Saves the current state as a history mark.
     * @param options The options that describe what information the mark should contain.
     *
     * @example
     * // Bookmark the current state with a message
     * server.markHistory({
     *   message: "Save recent changes"
     * });
     */
    function markHistory(options: MarkHistoryOptions) {
        return remote(calcMarkHistory(options), undefined, false);
    }

    /**
     * Loads the "history" space into the universe.
     */
    function browseHistory() {
        return remote(calcBrowseHistory());
    }

    /**
     * Restores the current state to the given mark.
     * @param mark The bot or bot ID that represents the mark that should be restored.
     */
    function restoreHistoryMark(mark: Bot | string) {
        const id = getID(mark);
        return remote(calcRestoreHistoryMark(id));
    }

    /**
     * Restores the current state to the given mark.
     * @param mark The bot or bot ID that represents the mark that should be restored.
     * @param universe The universe that the mark should be restored to.
     */
    function restoreHistoryMarkToUniverse(
        mark: Bot | string,
        universe: string
    ) {
        const id = getID(mark);
        return remote(calcRestoreHistoryMark(id, universe));
    }

    /**
     * Loads a file from the server at the given path.
     * @param path The path of the file.
     * @param options The options.
     */
    function loadFile(path: string, options?: LoadFileOptions) {
        return remote(
            calcLoadFile({
                path: path,
                ...(options || {}),
            })
        );
    }

    /**
     * Sends the given operation to all the devices that matches the given selector.
     * In effect, this allows users to send each other events directly without having to edit tags.
     *
     * Note that currently, devices will only accept events sent from the server.
     *
     * @param event The event that should be executed in the remote session(s).
     * @param selector The selector that indicates where the event should be sent. The event will be sent to all sessions that match the selector.
     *                 For example, specifying a username means that the event will be sent to every active session that the user has open.
     *                 If a selector is not specified, then the event is sent to the server.
     * @param allowBatching Whether to allow batching this remote event with other remote events. This will preserve ordering between remote events but may not preserve ordering
     *                      with respect to other events. Defaults to true.
     *
     * @example
     * // Send a toast to all sessions for the username "bob"
     * remote(player.toast("Hello, Bob!"), { username: "bob" });
     */
    function remote(
        event: BotAction,
        selector?: SessionSelector,
        allowBatching?: boolean
    ) {
        if (!event) {
            return;
        }
        const r = calcRemote(
            event,
            convertSessionSelector(selector),
            allowBatching
        );
        return addAction(r);
    }

    // Helpers
    function addAction<T extends BotAction>(action: T) {
        context.enqueueAction(action);
        return action;
    }

    function getDownloadState(state: BotsState) {
        return {
            version: 1,
            state,
        };
    }

    function formatAuxFilename(filename: string): string {
        if (filename.endsWith('.aux')) {
            return filename;
        }
        return filename + '.aux';
    }

    function convertSessionSelector(selector: SessionSelector): DeviceSelector {
        return selector
            ? {
                  sessionId: selector.session,
                  username: selector.username,
                  deviceId: selector.device,
              }
            : undefined;
    }
}
