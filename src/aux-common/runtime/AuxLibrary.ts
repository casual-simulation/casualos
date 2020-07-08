import { AuxGlobalContext, AsyncTask } from './AuxGlobalContext';
import {
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
    showInput as calcShowInput,
    replaceDragBot as calcReplaceDragBot,
    goToDimension as calcGoToDimension,
    goToURL as calcGoToURL,
    openURL as calcOpenURL,
    checkout as calcCheckout,
    playSound as calcPlaySound,
    setupStory as calcSetupStory,
    shell as calcShell,
    backupToGithub as calcBackupToGithub,
    backupAsDownload as calcBackupAsDownload,
    finishCheckout as calcFinishCheckout,
    markHistory as calcMarkHistory,
    browseHistory as calcBrowseHistory,
    restoreHistoryMark as calcRestoreHistoryMark,
    loadFile as calcLoadFile,
    saveFile as calcSaveFile,
    reject as calcReject,
    localFormAnimation as calcLocalFormAnimation,
    webhook as calcWebhook,
    superShout as calcSuperShout,
    share as calcShare,
    clearSpace,
    loadBots,
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
    getOriginalObject,
    getBotSpace,
    trimEvent,
    CREATE_ACTION_NAME,
    CREATE_ANY_ACTION_NAME,
    DESTROY_ACTION_NAME,
    LocalFormAnimationAction,
    ORIGINAL_OBJECT,
    AsyncActions,
    ShareOptions,
    unlockSpace,
    getPlayerCount,
    getStories,
    getPlayers,
    action,
    getStoryStatuses,
} from '../bots';
import sortBy from 'lodash/sortBy';
import every from 'lodash/every';
import {
    remote as calcRemote,
    DeviceSelector,
} from '@casual-simulation/causal-trees';
import uuidv4 from 'uuid/v4';
import { RuntimeBot, isRuntimeBot } from './RuntimeBot';
import { RanOutOfEnergyError } from './AuxResults';
import '../polyfill/Array.first.polyfill';
import '../polyfill/Array.last.polyfill';
import { convertToCopiableValue } from './Utils';

/**
 * Defines an interface for a library of functions and values that can be used by formulas and listeners.
 */
export interface AuxLibrary {
    api: {
        whisper(
            bot: (Bot | string)[] | Bot | string,
            eventName: string,
            arg?: any
        ): any[];
        __energyCheck(): void;
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
    broadcast?: boolean;
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
 * Options for saving a file.
 */
interface SaveFileOptions {
    /**
     * The shout that should be made when the request finishes.
     */
    callbackShout?: string;

    /**
     * Whether to overwrite an existing file.
     */
    overwriteExistingFile?: boolean;
}

/**
 * Defines a set of options for a webhook.
 */
export interface WebhookOptions {
    /**
     * The HTTP Method that the request should use.
     */
    method?: string;

    /**
     * The URL that the request should be made to.
     */
    url?: string;

    /**
     * The headers to include in the request.
     */
    headers?: {
        [key: string]: string;
    };

    /**
     * The data to send with the request.
     */
    data?: any;

    /**
     * The shout that should be made when the request finishes.
     */
    responseShout?: string;
}

export interface BotFilterFunction {
    (bot: Bot): boolean;
    sort?: (bot: Bot) => any;
}

/**
 * Creates a library that includes the default functions and APIs.
 * @param context The global context that should be used.
 */
export function createDefaultLibrary(context: AuxGlobalContext) {
    webhook.post = function(url: string, data?: any, options?: WebhookOptions) {
        return webhook({
            ...options,
            method: 'POST',
            url: url,
            data: data,
        });
    };

    return {
        api: {
            getBots,
            getBot,
            getBotTagValues,
            getMod,
            getID,
            getJSON,

            getTag,
            setTag,
            removeTags,
            renameTag,
            applyMod,
            subtractMods,

            create,
            destroy,
            changeState,
            superShout,
            shout,
            whisper,

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
            remoteWhisper,
            remoteShout,
            webhook,
            uuid,

            __energyCheck,

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
                downloadStory,
                showUploadAuxFile,
                openQRCodeScanner,
                closeQRCodeScanner,
                showQRCode,
                hideQRCode,
                openBarcodeScanner,
                closeBarcodeScanner,
                showBarcode,
                hideBarcode,
                loadStory,
                unloadStory,
                importAUX,
                replaceDragBot,

                getBot: getPlayerBot,
                isInDimension,
                getCurrentDimension,
                getCurrentStory,
                getMenuDimension,
                getInventoryDimension,
                getPortalDimension,
                getDimensionalDepth,
                showInputForTag,
                showInput,
                goToDimension,
                goToURL,
                openURL,
                openDevConsole,
                checkout,
                playSound,
                hasBotInInventory,
                share,
                inSheet,

                getCameraPosition,
                getCameraRotation,
                getPointerPosition,
                getPointerRotation,
            },

            server: {
                setupStory,
                shell,
                backupToGithub,
                backupAsDownload,
                finishCheckout,
                markHistory,
                browseHistory,
                restoreHistoryMark,
                restoreHistoryMarkToStory,
                loadFile,
                saveFile,
                destroyErrors,
                loadErrors,
                storyPlayerCount,
                totalPlayerCount,
                stories,
                storyStatuses,
                players,
            },

            action: {
                perform,
                reject,
            },

            adminSpace: {
                unlock: unlockAdminSpace,
            },

            experiment: {
                localFormAnimation,
            },

            math: {
                sum,
                avg,
                sqrt,
                abs,
                stdDev,
                randomInt,
                random,
            },
        },
    };

    /**
     * Gets a list of all the bots.
     *
     * @example
     * // Gets all the bots in the story.
     * let bots = getBots();
     */
    function getBots(...args: any[]): RuntimeBot[] {
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
    function getBot(...args: any[]): RuntimeBot {
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
     * // Find all the bots with a height set to 1 and color set to "red".
     * let bots = getBots(byMod({
     *      "color": "red",
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
     * @param direction The neighboring direction to check. If not specified, then bots from all directions will be included.
     * @returns A function that returns true if the given bot is next to the original bot.
     *
     * @example
     * // Find all bots in front of `this` bot in the "test" dimension.
     * let bots = getBots(neighboring(this, "test", "front"));
     */
    function neighboring(
        bot: Bot,
        dimension: string,
        direction?: 'front' | 'left' | 'right' | 'back'
    ): BotFilterFunction {
        if (!hasValue(direction)) {
            return either(
                neighboring(bot, dimension, 'front'),
                neighboring(bot, dimension, 'right'),
                neighboring(bot, dimension, 'back'),
                neighboring(bot, dimension, 'left')
            );
        } else if (
            direction !== 'left' &&
            direction !== 'right' &&
            direction !== 'front' &&
            direction !== 'back'
        ) {
            return () => false;
        }

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
     * let bots = getBots(byCreator(getBot('color','yellow')));
     */
    function byCreator(bot: Bot | string): BotFilterFunction {
        const id = getID(bot);
        return byTag('creator', id);
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
     * // Get the "color" tag from the `this` bot.
     * let color = getTag(this, "color");
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
    function toast(
        message: string | number | boolean | object | Array<any> | null,
        duration: number = 2
    ) {
        return addAction(
            toastMessage(convertToCopiableValue(message), duration)
        );
    }

    /**
     * Shows a QR Code that contains a link to a story and dimension.
     * @param story The story that should be joined. Defaults to the current story.
     * @param dimension The dimension that should be joined. Defaults to the current dimension.
     */
    function showJoinCode(story?: string, dimension?: string) {
        return addAction(calcShowJoinCode(story, dimension));
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
        const task = context.createTask();
        const event = runScript(script, task.taskId);
        return addAsyncAction(task, event);
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

    function downloadStory() {
        return downloadBots(
            getBots(bySpace('shared')),
            `${getCurrentStory()}.aux`
        );
    }

    /**
     * Shows the "Upload AUX File" dialog.
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
     * Loads the story with the given ID.
     * @param id The ID of the story to load.
     */
    function loadStory(id: string) {
        const event = loadSimulation(id);
        return addAction(event);
    }

    /**
     * Unloads the story with the given ID.
     * @param id The ID of the story to unload.
     */
    function unloadStory(id: string) {
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
            const dimension = getTag(user, 'pagePortal');
            if (hasValue(dimension)) {
                return dimension.toString();
            }
            return undefined;
        }
        return undefined;
    }

    /**
     * Gets the story that the player is currently in.
     */
    function getCurrentStory(): string {
        const user = context.playerBot;
        if (user) {
            let story = getTag(user, 'story');
            if (hasValue(story)) {
                return story.toString();
            }
            return undefined;
        }
        return undefined;
    }

    /**
     * Gets the name of the dimension that is used for the current user's inventory.
     */
    function getInventoryDimension(): string {
        const user = context.playerBot;
        if (user) {
            const inventory = getTag(user, 'inventoryPortal');
            if (hasValue(inventory)) {
                return inventory.toString();
            }
            return null;
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
            const menu = getTag(user, 'menuPortal');
            if (hasValue(menu)) {
                return menu.toString();
            }
            return null;
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

        return dimension.toString();
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
     * player.showInputForTag(this, "label", {
     *            title: "Change the label",
     *            type: "text"
     * });
     *
     * @example
     * // Show a color picker for the bot's color.
     * player.showInputForTag(this, "color", {
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
     * Shows an input box. Returns a promise that resolves with the new value.
     *
     * @param currentValue The value that the input box should be prefilled with.
     * @param options The options that indicate how the input box should be customized.
     *
     * @example
     * // Show an input box.
     * const result = await player.showInput({
     *    title: "Change the label",
     *    type: "text"
     * });
     */
    function showInput(
        currentValue?: any,
        options?: Partial<ShowInputOptions>
    ) {
        const task = context.createTask();
        const event = calcShowInput(currentValue, options, task.taskId);
        return addAsyncAction(task, event);
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
     *   processingStory: 'cookies_checkout'
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
     * Shares some information via the device's social sharing functionality.
     * @param options The options.
     */
    function share(options: ShareOptions): Promise<void> {
        const task = context.createTask();
        const event = calcShare(options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Sends an event to the server to setup a new story if it does not exist.
     * @param story The story.
     * @param botOrMod The bot or mod that should be cloned into the new story.
     */
    function setupStory(story: string, botOrMod?: Mod) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcSetupStory(story, context.unwrapBot(botOrMod)),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Executes the given shell script on the server.
     * @param script The shell script  that should be executed.
     */
    function shell(script: string) {
        return remote(calcShell(script));
    }

    /**
     * Backs up all the AUX stories to a Github Gist.
     * @param auth The Github Personal Access Token that should be used to grant access to your Github account. See https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line
     */
    function backupToGithub(auth: string) {
        return remote(calcBackupToGithub(auth));
    }

    /**
     * Backs up all the AUX stories to a zip bot.
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
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcMarkHistory(options),
            undefined,
            false,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Loads the "history" space into the story.
     */
    function browseHistory() {
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcBrowseHistory(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Restores the current state to the given mark.
     * @param mark The bot or bot ID that represents the mark that should be restored.
     */
    function restoreHistoryMark(mark: Bot | string) {
        const id = getID(mark);
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcRestoreHistoryMark(id),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Restores the current state to the given mark.
     * @param mark The bot or bot ID that represents the mark that should be restored.
     * @param story The story that the mark should be restored to.
     */
    function restoreHistoryMarkToStory(mark: Bot | string, story: string) {
        const id = getID(mark);
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcRestoreHistoryMark(id, story),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Loads a file from the server at the given path.
     * @param path The path of the file.
     * @param options The options.
     */
    function loadFile(path: string, options?: LoadFileOptions) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcLoadFile({
                path: path,
                ...(options || {}),
            }),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Saves a file at the given path.
     * @param path The path.
     * @param data The data to save.
     * @param options The options to use.
     */
    function saveFile(path: string, data: string, options?: SaveFileOptions) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcSaveFile({
                path: path,
                data: data,
                ...(options || {}),
            }),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Destroys all the errors in the story.
     */
    function destroyErrors() {
        const task = context.createTask();
        const event = clearSpace('error', task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Loads the errors for the given bot and tag.
     * @param bot The bot that the errors should be loaded for.
     * @param tag The tag that the errors should be loaded for.
     */
    function loadErrors(bot: string | Bot, tag: string): Promise<Bot[]> {
        const task = context.createTask();
        const event = loadBots(
            'error',
            [
                {
                    tag: 'error',
                    value: true,
                },
                {
                    tag: 'errorBot',
                    value: getID(bot),
                },
                {
                    tag: 'errorTag',
                    value: tag,
                },
            ],
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the number of players that are viewing the current story.
     * @param story The story to get the statistics for. If omitted, then the current story is used.
     */
    function storyPlayerCount(story?: string): Promise<number> {
        const task = context.createTask(true, true);
        const actualStory = hasValue(story) ? story : getCurrentStory();
        const event = calcRemote(
            getPlayerCount(actualStory),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the total number of players that are connected to the server.
     */
    function totalPlayerCount(): Promise<number> {
        const task = context.createTask(true, true);
        const event = calcRemote(
            getPlayerCount(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the list of stories that are on the server.
     */
    function stories(): Promise<string[]> {
        const task = context.createTask(true, true);
        const event = calcRemote(
            getStories(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the list of stories that are on the server.
     */
    function storyStatuses(): Promise<
        {
            story: string;
            lastUpdateTime: Date;
        }[]
    > {
        const task = context.createTask(true, true);
        const event = calcRemote(
            getStoryStatuses(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the list of player IDs that are connected to the story.
     */
    function players(): Promise<string[]> {
        const task = context.createTask(true, true);
        const event = calcRemote(
            getPlayers(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
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
        selector?: SessionSelector | string | (SessionSelector | string)[],
        allowBatching?: boolean
    ) {
        if (!event) {
            return;
        }
        let actions = [];
        let selectors = Array.isArray(selector) ? selector : [selector];
        for (let s of selectors) {
            const r = calcRemote(
                event,
                convertSessionSelector(s),
                allowBatching
            );
            actions.push(addAction(r));
        }

        if (Array.isArray(selector)) {
            return actions;
        } else {
            return actions[0];
        }
    }

    /**
     * Sends the given shout to the given player or list of players.
     * The other players will recieve an onRemoteWhisper event for this whisper.
     *
     * In effect, this allows players to communicate with each other by sending arbitrary events.
     *
     * @param playerId The ID of the other player or players to whisper to.
     * @param name The name of the event.
     * @param arg The optional argument to include in the whisper.
     */
    function remoteWhisper(
        playerId: string | string[],
        name: string,
        arg?: any
    ) {
        return remote(action(name, null, null, arg), playerId);
    }

    /**
     * Sends the given shout to all players.
     * The other players will recieve an onRemoteWhisper event for this whisper.
     *
     * In effect, this allows players to communicate with each other by sending arbitrary events.
     *
     * @param name The name of the event.
     * @param arg The optional argument to include in the whisper.
     */
    function remoteShout(name: string, arg?: any) {
        return remote(action(name, null, null, arg), {
            broadcast: true,
        });
    }

    function webhook(options: WebhookOptions) {
        const task = context.createTask();
        const event = calcWebhook(<any>options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Creates a Universally Unique IDentifier (UUID).
     */
    function uuid() {
        return uuidv4();
    }

    // /**
    //  * Sends a web request based on the given options.
    //  * @param options The options that specify where and what to send in the web request.
    //  *
    //  * @example
    //  * // Send a HTTP POST request to https://www.example.com/api/createThing
    //  * webhook({
    //  *   method: 'POST',
    //  *   url: 'https://www.example.com/api/createThing',
    //  *   data: {
    //  *     hello: 'world'
    //  *   },
    //  *   responseShout: 'requestFinished'
    //  * });
    //  */
    // const webhook: {
    //     (options: WebhookOptions): BotAction;

    //     /**
    //      * Sends a HTTP POST request to the given URL with the given data.
    //      *
    //      * @param url The URL that the request should be sent to.
    //      * @param data That that should be sent.
    //      * @param options The options that should be included in the request.
    //      *
    //      * @example
    //      * // Send a HTTP POST request to https://www.example.com/api/createThing
    //      * webhook.post('https://www.example.com/api/createThing', {
    //      *   hello: 'world'
    //      * }, { responseShout: 'requestFinished' });
    //      */
    //     post: (url: string, data?: any, options?: WebhookOptions) => BotAction;
    // } = <any>;

    /**
     * Performs the given action.
     * @param action The action to perform.
     */
    function perform(action: any) {
        return addAction(action);
    }

    /**
     * Rejects the given action.
     * @param action The action to reject.
     */
    function reject(action: any) {
        const event = calcReject(getOriginalObject(action));
        return addAction(event);
    }

    /**
     * Unlocks admin space using the given password.
     * Returns a promise that resolves when the space is unlocked.
     * @param password The password to use to unlock admin space.
     */
    function unlockAdminSpace(password: string) {
        const task = context.createTask();
        const event = unlockSpace('admin', password, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Plays the given animation on the given bot locally.
     * Reverts back to the original animation when done playing.
     * @param bot The bot.
     * @param animation The animation to play.
     */
    function localFormAnimation(
        bot: Bot | string,
        animation: string | number
    ): LocalFormAnimationAction {
        return addAction(calcLocalFormAnimation(getID(bot), animation));
    }

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
     * Sets the value of the given tag stored in the given bot.
     * @param bot The bot.
     * @param tag The tag to set.
     * @param value The value to set.
     *
     * @example
     * // Set a bot's color to "green".
     * setTag(this, "color", "green");
     */
    function setTag(bot: Bot | Bot[] | BotTags, tag: string, value: any): any {
        tag = trimTag(tag);
        if (tag === 'id' || tag === BOT_SPACE_TAG) {
            return value;
        }
        if (Array.isArray(bot) && bot.length > 0) {
            for (let b of bot) {
                setTag(b, tag, value);
            }
            return value;
        } else if (bot && isBot(bot)) {
            bot.tags[tag] = value;
            return value;
        } else if (bot) {
            (<BotTags>bot)[tag] = value;
            return value;
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
            let botList: any[] = bot;

            for (let h = 0; h < bot.length; h++) {
                let currentBot = botList[h];
                let tags = tagsOnBot(currentBot);

                for (let i = tags.length - 1; i >= 0; i--) {
                    if (tagSection instanceof RegExp) {
                        if (tagSection.test(tags[i])) {
                            setTag(currentBot, tags[i], null);
                        }
                    } else if (tags[i].indexOf(tagSection) === 0) {
                        setTag(currentBot, tags[i], null);
                    }
                }
            }
        } else {
            let tags = tagsOnBot(bot);

            for (let i = tags.length - 1; i >= 0; i--) {
                // if the tag section is relevant to the curretn tag at all
                if (tagSection instanceof RegExp) {
                    if (tagSection.test(tags[i])) {
                        setTag(bot, tags[i], null);
                    }
                } else if (tags[i].indexOf(tagSection) === 0) {
                    // if the tag starts with the tag section
                    setTag(bot, tags[i], null);
                }
            }
        }
    }

    /**
     * Renames the given original tag to the given new tag using the given bot or list of bots.
     * @param bot The bot or list of bots that the tag should be renamed on.
     * @param originalTag The original tag to rename.
     * @param newTag The new tag name.
     */
    function renameTag(bot: Bot | Bot[], originalTag: string, newTag: string) {
        if (Array.isArray(bot)) {
            for (let b of bot) {
                renameTag(b, originalTag, newTag);
            }
        } else {
            if (originalTag in bot.tags) {
                const original = bot.tags[originalTag];
                delete bot.tags[originalTag];
                bot.tags[newTag] = original;
            }
        }
    }

    /**
     * Applies the given mods to the given bot.
     * @param bot The bot.
     * @param diffs The mods to apply.
     */
    function applyMod(bot: any, ...diffs: Mod[]) {
        let appliedDiffs: BotTags[] = [];
        for (let diff of diffs) {
            if (!diff) {
                continue;
            }
            let tags: BotTags;
            if (isRuntimeBot(diff)) {
                tags = diff.raw;
            } else if (isBot(diff)) {
                tags = diff.tags;
            } else {
                tags = diff;
            }
            appliedDiffs.push(tags);
            for (let key in tags) {
                setTag(bot, key, tags[key]);
            }
        }
    }

    /**
     * subrtacts the given diff from the given bot.
     * @param bot The bot.
     * @param diff The diff to apply.
     */
    function subtractMods(bot: any, ...diffs: Mod[]) {
        let subtractedDiffs: BotTags[] = [];
        for (let diff of diffs) {
            if (!diff) {
                continue;
            }
            let tags: BotTags;
            if (isBot(diff)) {
                tags = diff.tags;
            } else {
                tags = diff;
            }
            subtractedDiffs.push(tags);
            for (let key in tags) {
                setTag(bot, key, null);
            }
        }
    }

    /**
     * Creates a new bot and returns it.
     * @param parent The bot that should be the parent of the new bot.
     * @param mods The mods which specify the new bot's tag values.
     * @returns The bot(s) that were created.
     *
     * @example
     * // Create a red bot without a parent.
     * let redBot = create(null, { "color": "red" });
     *
     * @example
     * // Create a red bot and a blue bot with `this` as the parent.
     * let [redBot, blueBot] = create(this, [
     *    { "color": "red" },
     *    { "color": "blue" }
     * ]);
     *
     */
    function create(...mods: Mod[]) {
        return createBase(() => uuidv4(), ...mods);
    }

    function createBase(idFactory: () => string, ...datas: Mod[]) {
        let parent = context.currentBot;
        let parentDiff = parent ? { creator: getID(parent) } : {};
        return createFromMods(idFactory, parentDiff, ...datas);
    }

    /**
     * Creates a new bot that contains the given tags.
     * @param mods The mods that specify what tags to set on the bot.
     */
    function createFromMods(idFactory: () => string, ...mods: (Mod | Mod[])[]) {
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
            } else if (typeof diff === 'object') {
                for (let b = 0; b < variants.length; b++) {
                    variants[b].push(diff);
                }
            }
        }

        let bots: Bot[] = variants.map(v => {
            let bot: Bot = {
                id: idFactory(),
                tags: {},
            };
            for (let i = v.length - 1; i >= 0; i--) {
                const mod = v[i];
                if (mod && BOT_SPACE_TAG in mod) {
                    const space = mod[BOT_SPACE_TAG];
                    if (hasValue(space)) {
                        bot.space = space;
                    }
                    break;
                }
            }
            applyMod(bot.tags, ...v);

            if ('creator' in bot.tags) {
                let clearCreator = false;
                const creatorId = bot.tags['creator'];
                if (!creatorId) {
                    clearCreator = true;
                } else {
                    const creator = getBot('id', creatorId);
                    if (!creator) {
                        clearCreator = true;
                    } else {
                        const creatorSpace = getBotSpace(creator);
                        const currentSpace = getBotSpace(bot);
                        if (creatorSpace !== currentSpace) {
                            clearCreator = true;
                        }
                    }
                }

                if (clearCreator) {
                    delete bot.tags['creator'];
                }
            }

            return bot;
        });

        let ret = new Array<RuntimeBot>(bots.length);
        for (let i = 0; i < bots.length; i++) {
            ret[i] = context.createBot(bots[i]);
        }

        event(CREATE_ACTION_NAME, ret);
        for (let bot of ret) {
            event(CREATE_ANY_ACTION_NAME, null, {
                bot: bot,
            });
        }

        if (ret.length === 1) {
            return ret[0];
        } else {
            return ret;
        }
    }

    /**
     * Destroys the given bot, bot ID, or list of bots.
     * @param bot The bot, bot ID, or list of bots to destroy.
     */
    function destroy(
        bot: RuntimeBot | string | Bot | (RuntimeBot | string | Bot)[]
    ) {
        if (typeof bot === 'object' && Array.isArray(bot)) {
            bot.forEach(f => destroyBot(f));
        } else {
            destroyBot(bot);
        }
    }

    /**
     * Removes the given bot or bot ID from the simulation.
     * @param bot The bot or bot ID to remove from the simulation.
     */
    function destroyBot(bot: RuntimeBot | string | Bot) {
        let realBot: RuntimeBot;
        let id: string;
        if (!hasValue(bot)) {
            return;
        }
        if (typeof bot === 'object') {
            if (isRuntimeBot(bot)) {
                id = bot.id;
                realBot = bot;
            } else if (isBot(bot)) {
                id = bot.id;
                realBot = getBot('id', id);
            } else {
                return;
            }
        } else if (typeof bot === 'string') {
            if (!hasValue(bot)) {
                return;
            }
            id = bot;
            realBot = getBot('id', id);
        }

        if (!realBot || !isRuntimeBot(realBot) || !hasValue(id)) {
            return;
        }

        let destroyable = realBot.tags.auxDestroyable;
        if (hasValue(destroyable) && destroyable !== true) {
            return;
        }

        destroyable = realBot.tags.destroyable;
        if (hasValue(destroyable) && destroyable !== true) {
            return;
        }

        if (id) {
            event(DESTROY_ACTION_NAME, [id]);
            context.destroyBot(realBot);
        }

        destroyChildren(id);
    }

    function destroyChildren(id: string) {
        const children = getBots('creator', id);
        for (let child of children) {
            destroyBot(child);
        }
    }

    /**
     * Changes the state that the given bot is in.
     * @param bot The bot to change.
     * @param stateName The state that the bot should move to.
     * @param groupName The group of states that the bot's state should change in. (Defaults to "state")
     */
    function changeState(
        bot: Bot,
        stateName: string,
        groupName: string = 'state'
    ) {
        const previousState = getTag(bot, groupName);
        if (previousState === stateName) {
            return;
        }
        setTag(bot, groupName, stateName);

        const arg = {
            to: stateName,
            from: previousState,
        };
        if (hasValue(previousState)) {
            whisper(bot, `${groupName}${previousState}OnExit`, arg);
        }
        whisper(bot, `${groupName}${stateName}OnEnter`, arg);
    }

    /**
     * Shouts the given event to every bot in every loaded simulation.
     * @param eventName The name of the event to shout.
     * @param arg The argument to shout. This gets passed as the `that` variable to the other scripts.
     */
    function superShout(eventName: string, arg?: any) {
        const event = calcSuperShout(trimEvent(eventName), arg);
        return addAction(event);
    }

    /**
     * Asks every bot in the story to run the given action.
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
     * whisper(getBots("#color", "red"), "reset()");
     *
     * @example
     * // Ask all the tall bots for their names.
     * const names = whisper(getBots("scaleZ", height => height >= 2), "getName()");
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
        let bots;
        if (Array.isArray(bot)) {
            bots = bot;
        } else if (hasValue(bot)) {
            bots = [bot];
        }

        return event(eventName, bots, arg);
    }

    /**
     * Gets whether the player is in the sheet dimension.
     */
    function inSheet(): boolean {
        return getPortalDimension('sheet') !== null;
    }

    /**
     * Gets the 3D position of the player's camera.
     * @param portal The portal that the camera position should be retrieved for.
     */
    function getCameraPosition(
        portal: 'page' | 'inventory' = 'page'
    ): { x: number; y: number; z: number } {
        const user = context.playerBot;
        if (!user) {
            return {
                x: NaN,
                y: NaN,
                z: NaN,
            };
        }

        return {
            x: user.tags[`${portal}CameraPositionX`],
            y: user.tags[`${portal}CameraPositionY`],
            z: user.tags[`${portal}CameraPositionZ`],
        };
    }

    /**
     * Gets the 3D rotation of the player's camera.
     * @param portal The portal that the camera rotation should be retrieved for.
     */
    function getCameraRotation(
        portal: 'page' | 'inventory' = 'page'
    ): { x: number; y: number; z: number } {
        const user = context.playerBot;
        if (!user) {
            return {
                x: NaN,
                y: NaN,
                z: NaN,
            };
        }

        return {
            x: user.tags[`${portal}CameraRotationX`],
            y: user.tags[`${portal}CameraRotationY`],
            z: user.tags[`${portal}CameraRotationZ`],
        };
    }

    /**
     * Gets the 3D position of the player's pointer.
     * @param pointer The position of the pointer to retrieve.
     */
    function getPointerPosition(
        pointer: 'mouse' | 'left' | 'right' = 'mouse'
    ): { x: number; y: number; z: number } {
        const user = context.playerBot;
        if (!user) {
            return {
                x: NaN,
                y: NaN,
                z: NaN,
            };
        }

        return {
            x: user.tags[`${pointer}PointerPositionX`],
            y: user.tags[`${pointer}PointerPositionY`],
            z: user.tags[`${pointer}PointerPositionZ`],
        };
    }

    /**
     * Gets the 3D rotation of the player's pointer.
     * @param pointer The rotation of the pointer to retrieve.
     */
    function getPointerRotation(
        pointer: 'mouse' | 'left' | 'right' = 'mouse'
    ): { x: number; y: number; z: number } {
        const user = context.playerBot;
        if (!user) {
            return {
                x: NaN,
                y: NaN,
                z: NaN,
            };
        }

        return {
            x: user.tags[`${pointer}PointerRotationX`],
            y: user.tags[`${pointer}PointerRotationY`],
            z: user.tags[`${pointer}PointerRotationZ`],
        };
    }

    /**
     * Runs an event on the given bots.
     * @param name The name of the event to run.
     * @param bots The bots that the event should be executed on. If null, then the event will be run on every bot.
     * @param arg The argument to pass.
     * @param sort Whether to sort the Bots before processing. Defaults to true.
     */
    function event(
        name: string,
        bots: (Bot | string)[],
        arg?: any,
        sendListenEvents: boolean = true
    ) {
        let ids = !!bots
            ? bots.map(bot => {
                  return !!bot
                      ? typeof bot === 'string'
                          ? bot
                          : bot.id
                      : null;
              })
            : context.bots.map(b => b.id);

        let results = [] as any[];
        let tag = trimEvent(name);

        let targets = [] as RuntimeBot[];
        let listeners = [] as RuntimeBot[];

        for (let id of ids) {
            if (!id) {
                continue;
            }
            const bot = context.state[id];
            if (bot) {
                targets.push(bot);
            }
            if (
                !bot ||
                bot.tags.auxListening === false ||
                bot.tags.listening === false
            ) {
                continue;
            }

            let listener = bot.listeners[tag];
            if (listener) {
                try {
                    // TODO: Handle exceptions
                    results.push(listener(arg));
                    listeners.push(bot);
                } catch (ex) {
                    context.enqueueError(ex);
                }
            }
        }

        if (sendListenEvents) {
            const listenArg = {
                name: name,
                that: arg,
                responses: results,
                targets,
                listeners,
            };
            event('onListen', targets, listenArg, false);
            event('onAnyListen', null, listenArg, false);
        }

        return results;
    }

    function __energyCheck() {
        let current = context.energy;
        current -= 1;
        context.energy = current;
        if (current <= 0) {
            throw new RanOutOfEnergyError();
        }
    }

    // Helpers
    function addAction<T extends BotAction>(action: T) {
        context.enqueueAction(action);
        return action;
    }

    function addAsyncAction<T extends AsyncActions>(
        task: AsyncTask,
        action: T
    ) {
        addAction(action);
        let promise = task.promise;
        (<any>promise)[ORIGINAL_OBJECT] = action;
        return promise;
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

    function convertSessionSelector(
        selector: SessionSelector | string
    ): DeviceSelector {
        if (typeof selector === 'string') {
            return {
                sessionId: selector,
            };
        }
        return selector
            ? {
                  sessionId: selector.session,
                  username: selector.username,
                  deviceId: selector.device,
                  broadcast: selector.broadcast,
              }
            : undefined;
    }
}
