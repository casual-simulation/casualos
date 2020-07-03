import { PartialBot, BotsState, Bot, BotTags, BotSpace } from './Bot';
import {
    Action,
    DeviceAction,
    RemoteAction,
    DeviceSelector,
    RemoteActionResult,
    RemoteActionError,
    DeviceActionResult,
    DeviceActionError,
} from '@casual-simulation/causal-trees';
import { clamp } from '../utils';
import { hasValue } from './BotCalculations';

export type LocalActions = BotActions | ExtraActions | AsyncActions;

/**
 * Defines a union type for all the possible events that can be emitted from a bots channel.
 */
export type BotAction =
    | BotActions
    | TransactionAction
    | ExtraActions
    | AsyncActions
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
    | HideHtmlAction
    | TweenToAction
    | OpenQRCodeScannerAction
    | OpenBarcodeScannerAction
    | ShowQRCodeAction
    | ShowBarcodeAction
    | LoadStoryAction
    | UnloadStoryAction
    | SuperShoutAction
    | SendWebhookAction
    | LoadFileAction
    | SaveFileAction
    | GoToDimensionAction
    | GoToURLAction
    | PlaySoundAction
    | OpenURLAction
    | ImportAUXAction
    | ShowInputForTagAction
    | SetForcedOfflineAction
    | ShellAction
    | OpenConsoleAction
    | DownloadAction
    | BackupToGithubAction
    | BackupAsDownloadAction
    | StartCheckoutAction
    | CheckoutSubmittedAction
    | FinishCheckoutAction
    | PasteStateAction
    | ReplaceDragBotAction
    | SetupChannelAction
    | SetClipboardAction
    | ShowChatBarAction
    | ShowUploadAuxFileAction
    | MarkHistoryAction
    | BrowseHistoryAction
    | RestoreHistoryMarkAction
    | LoadSpaceAction
    | EnableARAction
    | EnableVRAction
    | ShowJoinCodeAction
    | RequestFullscreenAction
    | ExitFullscreenAction
    | LoadBotsAction
    | ClearSpaceAction
    | LocalFormAnimationAction
    | GetPlayerCountAction;

/**
 * Defines a set of possible async action types.
 */
export type AsyncActions =
    | AsyncResultAction
    | AsyncErrorAction
    | ShowInputAction
    | ShareAction
    | RunScriptAction
    | SendWebhookAction
    | UnlockSpaceAction
    | RemoteAction
    | RemoteActionResult
    | RemoteActionError
    | DeviceAction
    | DeviceActionResult
    | DeviceActionError;

/**
 * Defines an interface for actions that represent asynchronous tasks.
 */
export interface AsyncAction extends Action {
    /**
     * The ID of the async task.
     */
    taskId: number | string;
}

/**
 * Defines an action that supplies a result for an AsyncRequestAction.
 */
export interface AsyncResultAction extends AsyncAction {
    type: 'async_result';

    /**
     * The result value.
     */
    result: any;

    /**
     * Whether to map any bots found in the result to their actual bot counterparts.
     * Defaults to false.
     */
    mapBotsInResult?: boolean;
}

/**
 * Defines an action that supplies an error for an AsyncRequestAction.
 */
export interface AsyncErrorAction extends AsyncAction {
    type: 'async_error';

    /**
     * The error.
     */
    error: any;
}

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
     * The dimension that the state should be pasted into.
     */
    dimension?: string;

    /**
     * The X position that the state should be pasted at.
     * If a dimension is provided then this is the X position inside the dimension.
     * If a dimension is not provided then this is the X position that the new dimension should be created at.
     */
    x: number;

    /**
     * The Y position that the state should be pasted at.
     * If a dimension is provided then this is the Y position inside the dimension.
     * If a dimension is not provided then this is the Y position that the new dimension should be created at.
     */
    y: number;

    /**
     * The Z position that the state should be pasted at.
     * If a dimension is provided then this is the Z position inside the dimension.
     * If a dimension is not provided then this is the Z position that the new dimension should be created at.
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
 * An event that is used to override dragging a bot.
 */
export interface ReplaceDragBotAction extends Action {
    type: 'replace_drag_bot';

    /**
     * The bot that should be used to drag.
     */
    bot: Bot | BotTags;
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
     * The publishable API key that should be used for interfacing with the Stripe API.
     */
    publishableKey: string;

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
     * The story that the payment processing should occur in.
     */
    processingStory: string;

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
    processingStory: string;
}

/**
 * An event that is used to finish the checkout process by charging the user's card/account.
 */
export interface FinishCheckoutAction extends Action {
    type: 'finish_checkout';

    /**
     * The Secret API Key that should be used to finish the checkout process.
     */
    secretKey: string;

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
    message: string | number | boolean | object | Array<any> | null;
    duration: number;
}

/**
 * An event that is used to show some HTML to the user.
 */
export interface ShowHtmlAction extends Action {
    type: 'show_html';

    /**
     * Whether the HTML should be visible.
     */
    visible: true;

    /**
     * The HTML that should be shown.
     */
    html: string;
}

/**
 * An event that is used to hide the HTML from the user.
 */
export interface HideHtmlAction extends Action {
    type: 'show_html';
    visible: false;
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
export interface LoadStoryAction extends Action {
    type: 'load_story';

    /**
     * The ID of the simulation to load.
     */
    id: string;
}

/**
 * An event that is used to unload a simulation.
 */
export interface UnloadStoryAction extends Action {
    type: 'unload_story';

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
export interface SendWebhookAction extends AsyncAction {
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
 * Defines an event that is used to load a file.
 */
export interface LoadFileAction extends Action {
    type: 'load_file';

    /**
     * The options for the action.
     */
    options: LoadFileOptions;
}

/**
 * Options for loading a file.
 */
export interface LoadFileOptions {
    /**
     * The file path that should be loaded.
     */
    path?: string;

    /**
     * The shout that should be made when the request finishes.
     */
    callbackShout?: string;
}

/**
 * Defines an event that is used to save a file to a drive.
 */
export interface SaveFileAction extends Action {
    type: 'save_file';

    /**
     * The options for the action.
     */
    options: SaveFileOptions;
}

/**
 * Options for saving a file.
 */
export interface SaveFileOptions {
    /**
     * The path that the mod should be saved.
     */
    path: string;

    /**
     * The data to save to the file.
     */
    data: string;

    /**
     * The shout that should be made when the request finishes.
     */
    callbackShout?: string;

    /**
     * Whether to overwrite existing files.
     */
    overwriteExistingFile?: boolean;
}

/**
 * Defines an event that is used to get the player count.
 */
export interface GetPlayerCountAction extends Action {
    type: 'get_player_count';

    /**
     * The story that the player count should be retrieved for.
     * If omitted, then the total player count will be returned.
     */
    story?: string;
}

/**
 * Defines an event that is used to get the list of stories on the server.
 */
export interface GetStoriesAction extends Action {
    type: 'get_stories';

    /**
     * Whether to get the story statuses.
     */
    includeStatuses?: boolean;
}

/**
 * Defines an event that is used to get the list of players on the server.
 */
export interface GetPlayersAction extends Action {
    type: 'get_players';
}

/**
 * Defines an event that is used to send the player to a dimension.
 */
export interface GoToDimensionAction extends Action {
    type: 'go_to_dimension';

    /**
     * The dimension that should be loaded.
     */
    dimension: string;
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
 * Defines an event that is used to show an input box.
 */
export interface ShowInputAction extends AsyncAction {
    type: 'show_input';

    /**
     * The value that should be in the input box.
     */
    currentValue?: any;

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
 * Defines an event that is used to download a file onto the device.
 */
export interface DownloadAction extends Action {
    type: 'download';

    /**
     * The data that should be included in the downloaded file.
     */
    data: any;

    /**
     * The name of the downloaded file. (includes the extension)
     */
    filename: string;

    /**
     * The MIME type of the downloaded file.
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

    /**
     * Whether the text in the input box should be automatically selected.
     */
    autoSelect: boolean;
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
 * Defines an event that creates a channel if it doesn't exist.
 */
export interface SetupChannelAction {
    type: 'setup_story';

    /**
     * The channel that should be created.
     */
    channel: string;

    /**
     * The bot or mod that should be cloned into the new channel.
     */
    botOrMod?: Bot | BotTags;
}

/**
 * Defines an event that sets some text on the user's clipboard.
 */
export interface SetClipboardAction {
    type: 'set_clipboard';

    /**
     * The text that the clipboard should be set to.
     */
    text: string;
}

/**
 * Defines an event that shows the chat bar.
 */
export interface ShowChatBarAction {
    type: 'show_chat_bar';

    /**
     * Whether the chat bar should be visible.
     */
    visible: boolean;

    /**
     * The text that the bar should be filled with by default.
     */
    prefill?: string;

    /**
     * The text that the bar should have as the placeholder.
     */
    placeholder?: string;
}

/**
 * Defines the possible options for showing the chat bar.
 */
export interface ShowChatOptions {
    /**
     * The text that the bar should be filled with by default.
     */
    prefill?: string;

    /**
     * The text that the bar should have as the placeholder.
     */
    placeholder?: string;
}

/**
 * Defines an event that executes a script.
 */
export interface RunScriptAction extends AsyncAction {
    type: 'run_script';

    /**
     * The script that should be executed.
     */
    script: string;
}

/**
 * Defines an event that shows the "upload AUX file" dialog.
 */
export interface ShowUploadAuxFileAction {
    type: 'show_upload_aux_file';
}

/**
 * Defines an event that marks a specific point in history.
 */
export interface MarkHistoryAction {
    type: 'mark_history';

    /**
     * The message that the mark should contain.
     */
    message: string;
}

/**
 * Defines an event that loads the history into the story.
 */
export interface BrowseHistoryAction {
    type: 'browse_history';
}

/**
 * Defines an event that restores the current state to a specific bookmark.
 */
export interface RestoreHistoryMarkAction {
    type: 'restore_history_mark';

    /**
     * The ID of the mark that should be restored.
     */
    mark: string;

    /**
     * The story that the mark should be restored to.
     * If not specified, then the current story will be used.
     */
    story?: string;
}

/**
 * Defines an event that loads a space into the story.
 */
export interface LoadSpaceAction {
    type: 'load_space';

    /**
     * The space that should be loaded.
     */
    space: BotSpace;

    /**
     * The config that should be used to load the space.
     */
    config: any;
}

/**
 * Defines an event that loads bots from the given space that match the given tags and values.
 */
export interface LoadBotsAction {
    type: 'load_bots';

    /**
     * The space that should be searched.
     */
    space: BotSpace;

    /**
     * The tags that the loaded bots should have.
     */
    tags: TagFilter[];
}

/**
 * Defines an interface for objects that specify a tag and value
 * that a bot should have to be loaded.
 */
export interface TagFilter {
    /**
     * The tag that the bot should have.
     */
    tag: string;

    /**
     * The value that the bot should have.
     */
    value?: any;
}

/**
 * Defines an event that clears all bots from a space.
 *
 * Only supported for the following spaces:
 * - error
 */
export interface ClearSpaceAction {
    type: 'clear_space';

    /**
     * The space to clear.
     */
    space: BotSpace;
}

/**
 * Defines an event that unlocks the given space for editing.
 * Once a space is unlocked, it cannot be locked for the remainder of the session.
 *
 * Only supported for the following spaces:
 * - admin
 */
export interface UnlockSpaceAction extends AsyncAction {
    type: 'unlock_space';

    /**
     * The space to unlock.
     */
    space: BotSpace;

    /**
     * The password to use to unlock the space.
     */
    password: string;
}

/**
 * Defines an event that runs an animation locally over
 * whatever existing animations are playing.
 */
export interface LocalFormAnimationAction {
    type: 'local_form_animation';

    /**
     * The bot to run the animation on.
     */
    botId: string;

    /**
     * The animation to run.
     */
    animation: number | string;
}

/**
 * Defines an event that enables AR on the device.
 */
export interface EnableARAction {
    type: 'enable_ar';

    /**
     * Whether AR features should be enabled.
     */
    enabled: boolean;
}

/**
 * Defines an event that enables VR on the device.
 */
export interface EnableVRAction {
    type: 'enable_vr';

    /**
     * Whether VR features should be enabled.
     */
    enabled: boolean;
}

/**
 * Defines an event that shows a QR code that is a link to a story & dimension.
 */
export interface ShowJoinCodeAction {
    type: 'show_join_code';

    /**
     * The story that should be joined.
     */
    story?: string;

    /**
     * The dimension that should be joined.
     */
    dimension?: string;
}

/**
 * Defines an event that requests that AUX enter fullscreen mode.
 * This can be denied by the user.
 */
export interface RequestFullscreenAction {
    type: 'request_fullscreen_mode';
}

/**
 * Defines an event that exits fullscreen mode.
 */
export interface ExitFullscreenAction {
    type: 'exit_fullscreen_mode';
}

/**
 * Defines the options that a share action can have.
 */
export interface ShareOptions {
    /**
     * The title of the document being shared.
     */
    title?: string;

    /**
     * The text that should be shared.
     */
    text?: string;

    /**
     * The URL of the document being shared.
     */
    url?: string;
}

/**
 * Defines an event that shares the given information using the
 * device's native social sharing capabilities.
 */
export interface ShareAction extends AsyncAction, ShareOptions {
    type: 'share';
}

/**z
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
export function toast(
    message: string | number | boolean | object | Array<any> | null,
    duration?: number
): ShowToastAction {
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
        visible: true,
        html: html,
    };
}

/**
 * Creates a new HideHtmlAction.
 */
export function hideHtml(): HideHtmlAction {
    return {
        type: 'show_html',
        visible: false,
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
 * Creates a new ShowRunBarAction that shows the run bar.
 * @param options The options that should be used.
 */
export function showChat(options: ShowChatOptions = {}): ShowChatBarAction {
    return {
        type: 'show_chat_bar',
        visible: true,
        ...options,
    };
}

/**
 * Creates a new ShowRunBarAction that hides the run bar.
 */
export function hideChat(): ShowChatBarAction {
    return {
        type: 'show_chat_bar',
        visible: false,
    };
}

/**
 * Creates a new LoadSimulationAction.
 * @param id The ID of the simulation to load.
 */
export function loadSimulation(id: string): LoadStoryAction {
    return {
        type: 'load_story',
        id: id,
    };
}

/**
 * Creates a new UnloadSimulationAction.
 * @param id The ID of the simulation to unload.
 */
export function unloadSimulation(id: string): UnloadStoryAction {
    return {
        type: 'unload_story',
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
 * @param dimension The simulation ID or dimension to go to. If a simulation ID is being provided, then the dimension parameter must also be provided.
 */
export function goToDimension(dimension: string): GoToDimensionAction {
    return {
        type: 'go_to_dimension',
        dimension,
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
 * Creates a new ShowInputAction.
 * @param currentValue The value that the input should be prefilled with.
 * @param options The options for the input.
 * @param taskId The ID of the async task.
 */
export function showInput(
    currentValue?: any,
    options?: Partial<ShowInputOptions>,
    taskId?: number | string
): ShowInputAction {
    return {
        type: 'show_input',
        taskId,
        currentValue,
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
 * @param filename The name of the file.
 * @param mimeType The MIME type of the data.
 */
export function download(
    data: any,
    filename: string,
    mimeType: string
): DownloadAction {
    return {
        type: 'download',
        data,
        filename,
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
    processingStory: string
): CheckoutSubmittedAction {
    return {
        type: 'checkout_submitted',
        productId: productId,
        token: token,
        processingStory: processingStory,
    };
}

/**
 * Creates a new FinishCheckoutAction.
 * @param secretKey The secret stripe API Key.
 * @param token The token.
 * @param amount The amount.
 * @param currency The currency.
 * @param description The description.
 * @param extra Any extra info to send.
 */
export function finishCheckout(
    secretKey: string,
    token: string,
    amount: number,
    currency: string,
    description: string,
    extra?: any
): FinishCheckoutAction {
    return {
        type: 'finish_checkout',
        secretKey: secretKey,
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
 * @param taskId The ID of the task.
 */
export function webhook(
    options: WebhookOptions,
    taskId?: number | string
): SendWebhookAction {
    return {
        type: 'send_webhook',
        options: options,
        taskId,
    };
}

/**
 * Creates a new LoadFileAction.
 * @param options The options.
 */
export function loadFile(options: LoadFileOptions): LoadFileAction {
    return {
        type: 'load_file',
        options: options,
    };
}

/**
 * Creates a new SaveFileAction.
 * @param options The options.
 */
export function saveFile(options: SaveFileOptions): SaveFileAction {
    return {
        type: 'save_file',
        options: options,
    };
}

/**
 * Creates a new GetPlayerCountAction.
 * @param story The story that the player count should be retrieved for.
 */
export function getPlayerCount(story?: string): GetPlayerCountAction {
    if (hasValue(story)) {
        return {
            type: 'get_player_count',
            story,
        };
    } else {
        return {
            type: 'get_player_count',
        };
    }
}

/**
 * Creates a new GetStoriesAction.
 */
export function getStories(): GetStoriesAction {
    return {
        type: 'get_stories',
    };
}

/**
 * Creates a new GetStoriesAction that includes statuses.
 */
export function getStoryStatuses(): GetStoriesAction {
    return {
        type: 'get_stories',
        includeStatuses: true,
    };
}

/**
 * Creates a new GetPlayersAction.
 */
export function getPlayers(): GetPlayersAction {
    return {
        type: 'get_players',
    };
}

/**
 * Creates a new ReplaceDragBotAction.
 * @param bot The bot/mod that should be dragged instead.
 */
export function replaceDragBot(bot: Bot | BotTags): ReplaceDragBotAction {
    return {
        type: 'replace_drag_bot',
        bot,
    };
}

/**
 * Creates a channel if it doesn't exist and places the given bot in it.
 * @param channel The ID of the channel to setup.
 * @param botOrMod The bot that should be cloned into the new channel.
 */
export function setupStory(
    channel: string,
    botOrMod?: Bot | BotTags
): SetupChannelAction {
    return {
        type: 'setup_story',
        channel,
        botOrMod,
    };
}

/**
 * Creates a SetClipboardAction.
 * @param text The text that should be set to the clipboard.
 */
export function setClipboard(text: string): SetClipboardAction {
    return {
        type: 'set_clipboard',
        text,
    };
}

/**
 * Creates a RunScriptAction.
 * @param script The script that should be executed.
 * @param taskId The ID of the async task that this script represents.
 */
export function runScript(
    script: string,
    taskId?: number | string
): RunScriptAction {
    return {
        type: 'run_script',
        script,
        taskId,
    };
}

/**
 * Creates a showUploadAuxFileAction.
 */
export function showUploadAuxFile(): ShowUploadAuxFileAction {
    return {
        type: 'show_upload_aux_file',
    };
}

/**
 * Creates a MarkHistoryAction.
 * @param options The options to use.
 */
export function markHistory(options: MarkHistoryOptions): MarkHistoryAction {
    return {
        type: 'mark_history',
        ...options,
    };
}

export interface MarkHistoryOptions {
    message: string;
}

/**
 * Creates a BrowseHistoryAction.
 */
export function browseHistory(): BrowseHistoryAction {
    return {
        type: 'browse_history',
    };
}

/**
 * Creates a RestoreHistoryMarkAction.
 * @param mark The ID of the mark that history should be restored to.
 * @param story The story that the mark should be restored to. If not specified, then the current story will be used.
 */
export function restoreHistoryMark(
    mark: string,
    story?: string
): RestoreHistoryMarkAction {
    if (!story) {
        return {
            type: 'restore_history_mark',
            mark,
        };
    } else {
        return {
            type: 'restore_history_mark',
            mark,
            story,
        };
    }
}

/**
 * Loads a space into the story.
 * @param space The space to load.
 * @param config The config which specifies how the space should be loaded.
 */
export function loadSpace(space: BotSpace, config: any): LoadSpaceAction {
    return {
        type: 'load_space',
        space,
        config,
    };
}

/**
 * Creates a EnableARAction.
 */
export function enableAR(): EnableARAction {
    return {
        type: 'enable_ar',
        enabled: true,
    };
}

/**
 * Creates a EnableVRAction.
 */
export function enableVR(): EnableVRAction {
    return {
        type: 'enable_vr',
        enabled: true,
    };
}

/**
 * Creates a EnableARAction that disables AR.
 */
export function disableAR(): EnableARAction {
    return {
        type: 'enable_ar',
        enabled: false,
    };
}

/**
 * Creates a EnableVRAction that disables VR.
 */
export function disableVR(): EnableVRAction {
    return {
        type: 'enable_vr',
        enabled: false,
    };
}

/**
 * Creates a ShowJoinCodeAction.
 * @param story The story to link to.
 * @param dimension The dimension to link to.
 */
export function showJoinCode(
    story?: string,
    dimension?: string
): ShowJoinCodeAction {
    return {
        type: 'show_join_code',
        story,
        dimension,
    };
}

/**
 * Requests that the app go into fullscreen mode.
 */
export function requestFullscreen(): RequestFullscreenAction {
    return {
        type: 'request_fullscreen_mode',
    };
}

/**
 * Exists fullscreen mode.
 */
export function exitFullscreen(): ExitFullscreenAction {
    return {
        type: 'exit_fullscreen_mode',
    };
}

/**
 * Requests that bots matching the given tags be loaded from the given space.
 * @param space The space that the bots should be loaded from.
 * @param tags The tags that should be on the loaded bots.
 */
export function loadBots(space: BotSpace, tags: TagFilter[]): LoadBotsAction {
    return {
        type: 'load_bots',
        space: space,
        tags: tags,
    };
}

/**
 * Requests that all the bots in the given space be cleared.
 *
 * Only supported for the following spaces:
 * - error
 *
 * @param space The space to clear.
 */
export function clearSpace(space: BotSpace): ClearSpaceAction {
    return {
        type: 'clear_space',
        space: space,
    };
}

/**
 * Requests that the given space be unlocked for editing.
 *
 * Only supported for the following spaces:
 * - admin
 *
 * @param space The space to unlock.
 * @param password The password to use to unlock the space.
 * @param taskId The ID of the task that this event represents.
 */
export function unlockSpace(
    space: BotSpace,
    password: string,
    taskId?: number | string
): UnlockSpaceAction {
    return {
        type: 'unlock_space',
        space,
        password,
        taskId,
    };
}

/**
 * Requests that the given animation be played for the given bot locally.
 * @param botId The bot ID.
 * @param animation The animation.
 */
export function localFormAnimation(
    botId: string,
    animation: string | number
): LocalFormAnimationAction {
    return {
        type: 'local_form_animation',
        botId,
        animation,
    };
}

/**
 * Creates an action that resolves an async task with the given result.
 * @param taskId The ID of the task.
 * @param result The result.
 * @param mapBots Whether to map any bots found in the result to their actual counterparts.
 */
export function asyncResult(
    taskId: number | string,
    result: any,
    mapBots?: boolean
): AsyncResultAction {
    return {
        type: 'async_result',
        taskId,
        result,
        mapBotsInResult: mapBots,
    };
}

/**
 * Creates an action that resolves an async task with the given error.
 * @param taskId The ID of the task.
 * @param error The error.
 */
export function asyncError(
    taskId: number | string,
    error: any
): AsyncErrorAction {
    return {
        type: 'async_error',
        taskId,
        error,
    };
}

/**
 * Creates an action that shares some data via the device's social share capabilities.
 * @param options The options for sharing.
 * @param taskId The ID of the task.
 */
export function share(
    options: ShareOptions,
    taskId?: number | string
): ShareAction {
    return {
        type: 'share',
        taskId,
        ...options,
    };
}
