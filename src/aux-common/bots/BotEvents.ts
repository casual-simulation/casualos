import { PartialBot, BotsState, Bot } from './Bot';
import {
    Action,
    DeviceAction,
    RemoteAction,
    DeviceSelector,
} from '@casual-simulation/causal-trees';
import { clamp } from '../utils';
import { hasValue } from './BotCalculations';

export type LocalActions = BotActions | ExtraActions;

/**
 * Defines a union type for all the possible events that can be emitted from a bots channel.
 */
export type BotAction =
    | BotActions
    | TransactionAction
    | ExtraActions
    | RemoteAction
    | DeviceAction;

/**
 * Defines a union type for all the possible actions that manipulate the bot state.
 */
export type BotActions =
    | AddBotAction
    | RemoveBotAction
    | UpdateBotAction
    | ApplyStateAction;
``;

/**
 * Defines a set of possible local event types.
 */
export type ExtraActions =
    | ShoutAction
    | RejectAction
    | ShowToastAction
    | ShowHtmlAction
    | TweenToAction
    | OpenQRCodeScannerAction
    | OpenBarcodeScannerAction
    | ShowQRCodeAction
    | ShowBarcodeAction
    | LoadSimulationAction
    | UnloadSimulationAction
    | SuperShoutAction
    | SendWebhookAction
    | LoadModAction
    | GoToContextAction
    | GoToURLAction
    | PlaySoundAction
    | OpenURLAction
    | ImportAUXAction
    | ShowInputForTagAction
    | SetForcedOfflineAction
    | SayHelloAction
    | ShellAction
    | OpenConsoleAction
    | EchoAction
    | DownloadAction
    | BackupToGithubAction
    | BackupAsDownloadAction
    | StartCheckoutAction
    | CheckoutSubmittedAction
    | FinishCheckoutAction
    | PasteStateAction;

/**
 * Defines a bot event that indicates a bot was added to the state.
 */
export interface AddBotAction extends Action {
    type: 'add_bot';
    id: string;
    bot: Bot;
}

/**
 * Defines a bot event that indicates a bot was removed from the state.
 */
export interface RemoveBotAction extends Action {
    type: 'remove_bot';
    id: string;
}

/**
 * Defines a bot event that indicates a bot was updated.
 */
export interface UpdateBotAction extends Action {
    type: 'update_bot';
    id: string;
    update: PartialBot;
}

/**
 * A set of bot events in one.
 */
export interface TransactionAction extends Action {
    type: 'transaction';
    events: BotAction[];
}

/**
 * An eventBotsStatesome generic BotsState to the current state.
 * This is useful when you have some generic bot state and want to just apply it to the
 * current state. An example of doing this is from the automatic merge system.
 */
export interface ApplyStateAction extends Action {
    type: 'apply_state';
    state: BotsState;
}

/**
 * The options for pasting bots state into a channel.
 */
export interface PasteStateOptions {
    /**
     * The context that the state should be pasted into.
     */
    context?: string;

    /**
     * The X position that the state should be pasted at.
     * If a context is provided then this is the X position inside the context.
     * If a context is not provided then this is the X position that the new context should be created at.
     */
    x: number;

    /**
     * The Y position that the state should be pasted at.
     * If a context is provided then this is the Y position inside the context.
     * If a context is not provided then this is the Y position that the new context should be created at.
     */
    y: number;

    /**
     * The Z position that the state should be pasted at.
     * If a context is provided then this is the Z position inside the context.
     * If a context is not provided then this is the Z position that the new context should be created at.
     */
    z: number;
}

/**
 * An event to paste the given bots state as a new worksurface at a position.
 */
export interface PasteStateAction extends Action {
    type: 'paste_state';
    state: BotsState;

    /**
     * The options for the event.
     */
    options: PasteStateOptions;
}

/**
 * An event that is used to print a "hello" message.
 */
export interface SayHelloAction extends Action {
    type: 'say_hello';
}

/**
 * An event that is used to request that a message is sent back to you.
 */
export interface EchoAction extends Action {
    type: 'echo';

    /**
     * The message.
     */
    message: string;
}

/**
 * An event that is used to request that the server be backed up to github.
 */
export interface BackupToGithubAction extends Action {
    type: 'backup_to_github';

    /**
     * The authentication key to use.
     */
    auth: string;

    /**
     * The options that should be used for backing up.
     */
    options?: BackupOptions;
}

/**
 * An event that is used to request that the server be backed up to a zip bot and downloaded.
 */
export interface BackupAsDownloadAction extends Action {
    type: 'backup_as_download';

    /**
     * The options that should be used for backing up.
     */
    options?: BackupOptions;

    /**
     * The device(s) that the download should be sent to.
     */
    target: DeviceSelector;
}

/**
 * Defines the list of possible options for backing up a server.
 */
export interface BackupOptions {
    /**
     * Whether to include archived atoms.
     */
    includeArchived?: boolean;
}

export interface StartCheckoutOptions {
    /**
     * The ID of the product that is being checked out.
     */
    productId: string;

    /**
     * The title of the product.
     */
    title: string;

    /**
     * The description of the product.
     */
    description: string;

    /**
     * The channel that the payment processing should occur in.
     */
    processingChannel: string;

    /**
     * Whether to request the payer's billing address.
     */
    requestBillingAddress?: boolean;

    /**
     * Specifies the options that should be used for requesting payment from Apple Pay or the Payment Request API.
     */
    paymentRequest?: PaymentRequestOptions;
}

/**
 * Defines an interface of payment request options.
 */
export interface PaymentRequestOptions {
    /**
     * The two letter country code of your payment processor account.
     */
    country: string;

    /**
     * The three character currency code.
     */
    currency: string;

    /**
     * The total that should be charged to the user.
     */
    total: {
        /**
         * The label that should be displayed for the total.
         */
        label: string;

        /**
         * The amount in the currency's smallest unit. (cents, etc.)
         */
        amount: number;
    };
}

/**
 * An event that is used to initiate the checkout flow.
 */
export interface StartCheckoutAction extends Action, StartCheckoutOptions {
    type: 'start_checkout';
}

/**
 * An event that is used to indicate that the checkout was submitted.
 */
export interface CheckoutSubmittedAction extends Action {
    type: 'checkout_submitted';

    /**
     * The ID of the product that was checked out.
     */
    productId: string;

    /**
     * The token that allows payment.
     */
    token: string;

    /**
     * The channel that processing should happen in.
     */
    processingChannel: string;
}

/**
 * An event that is used to finish the checkout process by charging the user's card/account.
 */
export interface FinishCheckoutAction extends Action {
    type: 'finish_checkout';

    /**
     * The token that was created from the checkout process.
     * You should have recieved this from the onCheckout() event.
     */
    token: string;

    /**
     * The amount to charge in the smallest currency unit.
     * For USD, this is cents. So an amount of 100 equals $1.00.
     */
    amount: number;

    /**
     * The currency that the amount is in.
     */
    currency: string;

    /**
     * The description for the charge.
     */
    description: string;

    /**
     * The extra info that this event contains.
     */
    extra: any;
}

/**
 * An event that is used to run a shell script.
 */
export interface ShellAction extends Action {
    type: 'shell';

    /**
     * The script that should be run.
     */
    script: string;
}

/**
 * An event that is used to show a toast message to the user.
 */
export interface ShowToastAction extends Action {
    type: 'show_toast';
    message: string;
    duration: number;
}

/**
 * An event that is used to show some HTML to the user.
 */
export interface ShowHtmlAction extends Action {
    type: 'show_html';

    /**
     * The HTML that should be shown.
     */
    html: string;
}

/**
 * An event that is used to tween the camera to the given bot's location.
 */
export interface TweenToAction extends Action {
    type: 'tween_to';

    /**
     * The ID of the bot to tween to.
     */
    botId: string;

    /*
     * The zoom value to use.
     */
    zoomValue: number;

    /*
     * The rotation spherical value to use.
     */
    rotationValue: {
        x: number;
        y: number;
    };

    /**
     * The duration that the tween should take.
     */
    duration: number | null;
}

/**
 * The possible camera types.
 */
export type CameraType = 'front' | 'rear';

/**
 * An event that is used to show or hide the QR Code Scanner.
 */
export interface OpenQRCodeScannerAction extends Action {
    type: 'show_qr_code_scanner';

    /**
     * Whether the QR Code scanner should be visible.
     */
    open: boolean;

    /**
     * The camera that should be used.
     */
    cameraType: CameraType;
}

/**
 * An event that is used to show or hide the barcode scanner.
 */
export interface OpenBarcodeScannerAction extends Action {
    type: 'show_barcode_scanner';

    /**
     * Whether the barcode scanner should be visible.
     */
    open: boolean;

    /**
     * The camera that should be used.
     */
    cameraType: CameraType;
}

/**
 * An event that is used to toggle whether the console is open.
 */
export interface OpenConsoleAction extends Action {
    type: 'open_console';

    /**
     * Whether the console should be open.
     */
    open: boolean;
}

/**
 * An event that is used to show or hide a QR Code on screen.
 */
export interface ShowQRCodeAction extends Action {
    type: 'show_qr_code';

    /**
     * Whether the QR Code should be visible.
     */
    open: boolean;

    /**
     * The code to display.
     */
    code: string;
}

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
 * An event that is used to show or hide a barcode on screen.
 */
export interface ShowBarcodeAction extends Action {
    type: 'show_barcode';

    /**
     * Whether the barcode should be visible.
     */
    open: boolean;

    /**
     * The code to display.
     */
    code: string;

    /**
     * The format that the code should be displayed in.
     */
    format: BarcodeFormat;
}

/**
 * An event that is used to load a simulation.
 */
export interface LoadSimulationAction extends Action {
    type: 'load_simulation';

    /**
     * The ID of the simulation to load.
     */
    id: string;
}

/**
 * An event that is used to unload a simulation.
 */
export interface UnloadSimulationAction extends Action {
    type: 'unload_simulation';

    /**
     * The ID of the simulation to unload.
     */
    id: string;
}

/**
 * An event that is used to load an AUX from a remote location.
 */
export interface ImportAUXAction extends Action {
    type: 'import_aux';

    /**
     * The URL to load.
     */
    url: string;
}

/**
 * Defines an event for actions that are shouted to every current loaded simulation.
 */
export interface SuperShoutAction extends Action {
    type: 'super_shout';

    /**
     * The name of the event.
     */
    eventName: string;

    /**
     * The argument to pass as the "that" variable to scripts.
     */
    argument?: any;
}

/**
 * Defines an event that sends a web request to a server.
 */
export interface SendWebhookAction extends Action {
    type: 'send_webhook';

    /**
     * The options for the webhook.
     */
    options: WebhookOptions;
}

/**
 * Defines a set of options for a webhook.
 */
export interface WebhookOptions {
    /**
     * The HTTP Method that the request should use.
     */
    method: string;

    /**
     * The URL that the request should be made to.
     */
    url: string;

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
    responseShout: string;
}

/**
 * Defines an event that is used to load a mod.
 */
export interface LoadModAction extends Action {
    type: 'load_mod';

    /**
     * The options for the action.
     */
    options: LoadModOptions;
}

/**
 * Options for loading a mod.
 */
export interface LoadModOptions {
    /**
     * The URL that should be loaded.
     */
    url: string;

    /**
     * The shout that should be made when the request finishes.
     */
    callbackShout?: string;
}

/**
 * Defines an event that is used to send the player to a context.
 */
export interface GoToContextAction extends Action {
    type: 'go_to_context';

    /**
     * The context that should be loaded.
     */
    context: string;
}

/**
 * Defines an event that is used to show an input box to edit a tag on a bot.
 */
export interface ShowInputForTagAction extends Action {
    type: 'show_input_for_tag';

    /**
     * The ID of the bot to edit.
     */
    botId: string;

    /**
     * The tag that should be edited on the bot.
     */
    tag: string;

    /**
     * The options for the input box.
     */
    options: Partial<ShowInputOptions>;
}

/**
 * Defines an event that is used to set whether the connection is forced to be offline.
 */
export interface SetForcedOfflineAction extends Action {
    type: 'set_offline_state';

    /**
     * Whether the connection should be offline.
     */
    offline: boolean;
}

/**
 * Defines an event that is used to redirect the user to the given URL.
 * This should be equivalent to clicking a link with rel="noreferrer".
 */
export interface GoToURLAction extends Action {
    type: 'go_to_url';

    /**
     * The URL to open.
     */
    url: string;
}

/**
 * Defines an event that is used to open the given URL.
 * This should be equivalent to clicking a link with rel="noreferrer" and target="_blank".
 */
export interface OpenURLAction extends Action {
    type: 'open_url';

    /**
     * The URL to open.
     */
    url: string;
}

/**
 * Defines an event that is used to play a sound from the given url.
 */
export interface PlaySoundAction extends Action {
    type: 'play_sound';

    /**
     * The URL to open.
     */
    url: string;
}

/**
 * Defines an event that is used to download a bot onto the device.
 */
export interface DownloadAction extends Action {
    type: 'download';

    /**
     * The data that should be included in the downloaded bot.
     */
    data: any;

    /**
     * The name of the downloaded bot. (includes the extension)
     */
    botname: string;

    /**
     * The MIME type of the downloaded bot.
     */
    mimeType: string;
}

/**
 * Defines an interface for options that a show input event can use.
 */
export interface ShowInputOptions {
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

/**
 * Defines the possible input types.
 */
export type ShowInputType = 'text' | 'color';

/**
 * Defines the possible input types.
 */
export type ShowInputSubtype = 'basic' | 'swatch' | 'advanced';

/**
 * Defines an event for actions.
 * Actions are basically user-defined events.
 */
export interface ShoutAction {
    type: 'action';

    /**
     * The IDs of the bots that the event is being sent to.
     * If null, then the action is sent to every bot.
     */
    botIds: string[] | null;

    /**
     * The Bot ID of the user.
     */
    userId: string | null;

    /**
     * The name of the event.
     */
    eventName: string;

    /**
     * The argument to pass as the "that" variable to scripts.
     */
    argument?: any;

    /**
     * Whether the Bot IDs should be sorted before processing.
     */
    sortBotIds?: boolean;
}

/**
 * Defines an event that prevents the execution of an action.
 */
export interface RejectAction {
    type: 'reject';

    /**
     * The action to prevent.
     */
    action: Action;
}

/**
 * Creates a new AddBotAction.
 * @param bot The bot that was added.
 */
export function botAdded(bot: Bot): AddBotAction {
    return {
        type: 'add_bot',
        id: bot.id,
        bot: bot,
    };
}

/**
 * Creates a new RemoveBotAction.
 * @param botId The ID of the bot that was removed.
 */
export function botRemoved(botId: string): RemoveBotAction {
    return {
        type: 'remove_bot',
        id: botId,
    };
}

/**
 * Creates a new UpdateBotAction.
 * @param id The ID of the bot that was updated.
 * @param update The update that was applied to the bot.
 */
export function botUpdated(id: string, update: PartialBot): UpdateBotAction {
    return {
        type: 'update_bot',
        id: id,
        update: update,
    };
}

/**
 * Creates a new TransactionAction.
 * @param events The events to contain in the transaction.
 */
export function transaction(events: BotAction[]): TransactionAction {
    return {
        type: 'transaction',
        events: events,
    };
}

/**
 * Creates a new ShoutAction.
 * @param eventName The name of the event.
 * @param botIds The IDs of the bots that the event should be sent to. If null then the event is sent to every bot.
 * @param userId The ID of the bot for the current user.
 * @param arg The optional argument to provide.
 * @param sortIds Whether the bots should be processed in order of their Bot IDs.
 */
export function action(
    eventName: string,
    botIds: string[] = null,
    userId: string = null,
    arg?: any,
    sortIds: boolean = true
): ShoutAction {
    return {
        type: 'action',
        botIds,
        eventName,
        userId,
        argument: arg,
        sortBotIds: sortIds,
    };
}

/**
 * Creates a new RejectAction.
 * @param event The action to reject.
 */
export function reject(event: Action): RejectAction {
    return {
        type: 'reject',
        action: event,
    };
}

/**
 * Creates a new ApplyStateAction.
 * @param state The state to apply.
 */
export function addState(state: BotsState): ApplyStateAction {
    return {
        type: 'apply_state',
        state: state,
    };
}

/**
 * Creates a new PasteStateAction.
 * @param state The state to paste.
 * @param options The options for the event.
 */
export function pasteState(
    state: BotsState,
    options: PasteStateOptions
): PasteStateAction {
    return {
        type: 'paste_state',
        state,
        options,
    };
}

/**
 * Creates a new ShowToastAction.
 * @param message The message to show with the event.
 */
export function toast(message: string, duration?: number): ShowToastAction {
    if (duration != null) {
        return {
            type: 'show_toast',
            message: message,
            duration: duration * 1000,
        };
    }

    return {
        type: 'show_toast',
        message: message,
        duration: 2000,
    };
}

/**
 * Creates a new ShowHtmlAction.
 * @param template The HTML to show.
 */
export function html(html: string): ShowHtmlAction {
    return {
        type: 'show_html',
        html: html,
    };
}

/**
 * Creates a new TweenToAction.
 * @param botId The ID of the bot to tween to.
 * @param zoomValue The zoom value to use.
 * @param rotX The X rotation value.
 * @param rotY The Y rotation value.
 * @param duration The duration.
 */
export function tweenTo(
    botId: string,
    zoomValue: number = null,
    rotX: number = null,
    rotY: number = null,
    duration: number = null
): TweenToAction {
    if (rotY != null && rotX != null && rotY > 0 && rotX === 0) {
        rotX = 1;
    }

    if (hasValue(zoomValue)) {
        zoomValue = clamp(zoomValue, 0, 80);
    }
    if (hasValue(rotY)) {
        rotY = clamp(rotY, -180, 180);
    }
    if (hasValue(rotX)) {
        rotX = clamp(rotX, 1, 90);
    }

    if (!hasValue(rotX) || !hasValue(rotY)) {
        return {
            type: 'tween_to',
            botId: botId,
            zoomValue: zoomValue,
            rotationValue: null,
            duration: duration,
        };
    } else {
        return {
            type: 'tween_to',
            botId: botId,
            zoomValue: zoomValue,
            rotationValue: {
                x: rotX / 180,
                y: rotY / 180,
            },
            duration: duration,
        };
    }
}

/**
 * Creates a new OpenQRCodeScannerAction.
 * @param open Whether the QR Code scanner should be open or closed.
 * @param cameraType The camera type that should be used.
 */
export function openQRCodeScanner(
    open: boolean,
    cameraType?: CameraType
): OpenQRCodeScannerAction {
    return {
        type: 'show_qr_code_scanner',
        open: open,
        cameraType: cameraType,
    };
}

/**
 * Creates a new ShowQRCodeAction.
 * @param open Whether the QR Code should be visible.
 * @param code The code that should be shown.
 */
export function showQRCode(open: boolean, code?: string): ShowQRCodeAction {
    return {
        type: 'show_qr_code',
        open: open,
        code: code,
    };
}

/**
 * Creates a new OpenBarcodeScannerAction.
 * @param open Whether the barcode scanner should be open or closed.
 * @param cameraType The camera type that should be used.
 */
export function openBarcodeScanner(
    open: boolean,
    cameraType?: CameraType
): OpenBarcodeScannerAction {
    return {
        type: 'show_barcode_scanner',
        open: open,
        cameraType: cameraType,
    };
}

/**
 * Creates a new ShowBarcodeAction.
 * @param open Whether the barcode should be visible.
 * @param code The code that should be shown.
 * @param format The format that the code should be shown in. Defaults to 'code128'.
 */
export function showBarcode(
    open: boolean,
    code?: string,
    format: BarcodeFormat = 'code128'
): ShowBarcodeAction {
    return {
        type: 'show_barcode',
        open: open,
        code: code,
        format: format,
    };
}

/**
 * Creates a new LoadSimulationAction.
 * @param id The ID of the simulation to load.
 */
export function loadSimulation(id: string): LoadSimulationAction {
    return {
        type: 'load_simulation',
        id: id,
    };
}

/**
 * Creates a new UnloadSimulationAction.
 * @param id The ID of the simulation to unload.
 */
export function unloadSimulation(id: string): UnloadSimulationAction {
    return {
        type: 'unload_simulation',
        id: id,
    };
}

/**
 * Creates a new SuperShoutAction.
 * @param eventName The name of the event.
 * @param arg The argument to send as the "that" variable to scripts.
 */
export function superShout(eventName: string, arg?: any): SuperShoutAction {
    return {
        type: 'super_shout',
        eventName,
        argument: arg,
    };
}

/**
 * Creates a new GoToContextAction.
 * @param simulationOrContext The simulation ID or context to go to. If a simulation ID is being provided, then the context parameter must also be provided.
 * @param context
 */
export function goToContext(context: string): GoToContextAction {
    return {
        type: 'go_to_context',
        context: context,
    };
}

/**
 * Creates a new ImportAUXAction.
 * @param url The URL that should be loaded.
 */
export function importAUX(url: string): ImportAUXAction {
    return {
        type: 'import_aux',
        url: url,
    };
}

/**
 * Creates a new ShowInputForTagAction.
 * @param botId The ID of the bot to edit.
 * @param tag The tag to edit.
 */
export function showInputForTag(
    botId: string,
    tag: string,
    options?: Partial<ShowInputOptions>
): ShowInputForTagAction {
    return {
        type: 'show_input_for_tag',
        botId: botId,
        tag: tag,
        options: options || {},
    };
}

/**
 * Creates a new SetForcedOfflineAction event.
 * @param offline Whether the connection should be offline.
 */
export function setForcedOffline(offline: boolean): SetForcedOfflineAction {
    return {
        type: 'set_offline_state',
        offline: offline,
    };
}

/**
 * Creates a new GoToURLAction.
 * @param url The URL to go to.
 */
export function goToURL(url: string): GoToURLAction {
    return {
        type: 'go_to_url',
        url: url,
    };
}

/**
 * Creates a new OpenURLAction.
 * @param url The URL to go to.
 */
export function openURL(url: string): OpenURLAction {
    return {
        type: 'open_url',
        url: url,
    };
}

/**
 * Creates a new PlaySoundAction.
 * @param url The URL of the sound to play.
 */
export function playSound(url: string): PlaySoundAction {
    return {
        type: 'play_sound',
        url: url,
    };
}

/**
 * Creates a new SayHelloAction.
 */
export function sayHello(): SayHelloAction {
    return {
        type: 'say_hello',
    };
}

/**
 * Creates an new EchoAction.
 */
export function echo(message: string): EchoAction {
    return {
        type: 'echo',
        message,
    };
}

/**
 * Creates a new ShellAction.
 * @param script The script that should be run.
 */
export function shell(script: string): ShellAction {
    return {
        type: 'shell',
        script: script,
    };
}

/**
 * Creates a new ToggleConsoleEvent.
 */
export function openConsole(): OpenConsoleAction {
    return {
        type: 'open_console',
        open: true,
    };
}

/**
 * Creates a new BackupToGithub event.
 * @param auth The authentication key that should be used.
 * @param options The options that should be used.
 */
export function backupToGithub(
    auth: string,
    options?: BackupOptions
): BackupToGithubAction {
    return {
        type: 'backup_to_github',
        auth,
        options,
    };
}

/**
 * Creates a new BackupAsDownload event.
 */
export function backupAsDownload(
    target: DeviceSelector,
    options?: BackupOptions
): BackupAsDownloadAction {
    return {
        type: 'backup_as_download',
        target,
        options,
    };
}

/**
 * Creates a new DownloadAction.
 * @param data The data that should be downloaded.
 * @param botname The name of the bot.
 * @param mimeType The MIME type of the data.
 */
export function download(
    data: any,
    botname: string,
    mimeType: string
): DownloadAction {
    return {
        type: 'download',
        data,
        botname,
        mimeType,
    };
}

/**
 * Creates a new StartCheckoutAction.
 * @param options The options.
 */
export function checkout(options: StartCheckoutOptions): StartCheckoutAction {
    return {
        type: 'start_checkout',
        ...options,
    };
}

/**
 * Creates a new CheckoutSubmittedAction.
 */
export function checkoutSubmitted(
    productId: string,
    token: string,
    processingChannel: string
): CheckoutSubmittedAction {
    return {
        type: 'checkout_submitted',
        productId: productId,
        token: token,
        processingChannel: processingChannel,
    };
}

/**
 * Creates a new FinishCheckoutAction.
 * @param token The token.
 * @param amount The amount.
 * @param currency The currency.
 * @param description The description.
 * @param extra Any extra info to send.
 */
export function finishCheckout(
    token: string,
    amount: number,
    currency: string,
    description: string,
    extra?: any
): FinishCheckoutAction {
    return {
        type: 'finish_checkout',
        amount: amount,
        currency: currency,
        description: description,
        token: token,
        extra: extra,
    };
}

/**
 * Creates a new SendWebhookAction.
 * @param options The options for the webhook.
 */
export function webhook(options: WebhookOptions): SendWebhookAction {
    return {
        type: 'send_webhook',
        options: options,
    };
}

/**
 * Creates a new LoadModAction.
 * @param options The options.
 */
export function loadMod(options: LoadModOptions): LoadModAction {
    return {
        type: 'load_mod',
        options: options,
    };
}
