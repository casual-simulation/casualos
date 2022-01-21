import {
    PartialBot,
    BotsState,
    Bot,
    BotTags,
    BotSpace,
    BotTagMasks,
    PortalType,
    RecordSpace,
    Record,
    RecordReference,
} from './Bot';
import {
    Action,
    DeviceAction,
    RemoteAction,
    DeviceSelector,
    RemoteActionResult,
    RemoteActionError,
    DeviceActionResult,
    DeviceActionError,
    remoteResult,
    remoteError,
} from '@casual-simulation/causal-trees';
import { clamp } from '../utils';
import { hasValue } from './BotCalculations';
import { RecordFileFailure } from '@casual-simulation/aux-records';

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
    | RemoteActionResult
    | RemoteActionError
    | DeviceAction;

/**
 * Defines a union type for all the possible actions that manipulate the bot state.
 */
export type BotActions =
    | AddBotAction
    | RemoveBotAction
    | UpdateBotAction
    | CreateCertificateAction
    | SignTagAction
    | RevokeCertificateAction
    | ApplyStateAction;

/**
 * Defines a set of possible local event types.
 */
export type ExtraActions =
    | ShoutAction
    | RejectAction
    | ShowToastAction
    | ShowHtmlAction
    | HideHtmlAction
    | OpenQRCodeScannerAction
    | OpenBarcodeScannerAction
    | ShowQRCodeAction
    | ShowBarcodeAction
    | LoadServerAction
    | UnloadServerAction
    | SuperShoutAction
    | SendWebhookAction
    | GoToDimensionAction
    | GoToURLAction
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
    | LocalFormAnimationAction
    | GetRemoteCountAction
    | AddDropSnapTargetsAction
    | EnableCustomDraggingAction
    | EnablePOVAction
    | GoToTagAction
    | UpdateHtmlAppAction
    | HtmlAppEventAction
    | SetAppOutputAction
    | UnregisterHtmlAppAction;

/**
 * Defines a set of possible async action types.
 */
export type AsyncActions =
    | AsyncResultAction
    | AsyncErrorAction
    | ShowInputAction
    | ShareAction
    | RegisterBuiltinPortalAction
    | RegisterPrefixAction
    | RunScriptAction
    | LoadBotsAction
    | ClearSpaceAction
    | SendWebhookAction
    | AnimateTagAction
    | UnlockSpaceAction
    | SetSpacePasswordAction
    | LoadFileAction
    | SaveFileAction
    | SetupChannelAction
    | ExportGpioPinAction
    | UnexportGpioPinAction
    | SetGpioPinAction
    | GetGpioPinAction
    | RpioInitAction
    | RpioExitAction
    | RpioOpenAction
    | RpioModeAction
    | RpioReadAction
    | RpioReadSequenceAction
    | RpioWriteAction
    | RpioWriteSequenceAction
    | RpioReadpadAction
    | RpioWritepadAction
    | RpioPudAction
    | RpioPollAction
    | RpioCloseAction
    | RpioI2CBeginAction
    | RpioI2CSetSlaveAddressAction
    | RpioI2CSetBaudRateAction
    | RpioI2CSetClockDividerAction
    | RpioI2CReadAction
    | RpioI2CWriteAction
    // | RpioI2CReadRegisterRestartAction
    // | RpioI2CWriteReadRestartAction
    | RpioI2CEndAction
    | RpioPWMSetClockDividerAction
    | RpioPWMSetRangeAction
    | RpioPWMSetDataAction
    | RpioSPIBeginAction
    | RpioSPIChipSelectAction
    | RpioSPISetCSPolarityAction
    | RpioSPISetClockDividerAction
    | RpioSPISetDataModeAction
    | RpioSPITransferAction
    | RpioSPIWriteAction
    | RpioSPIEndAction
    | SerialConnectAction
    | SerialStreamAction
    | SerialOpenAction
    | SerialUpdateAction
    | SerialWriteAction
    | SerialReadAction
    | SerialCloseAction
    | SerialFlushAction
    | SerialDrainAction
    | SerialPauseAction
    | SerialResumeAction
    | CreateCertificateAction
    | SignTagAction
    | RevokeCertificateAction
    | RemoteAction
    | RemoteActionResult
    | RemoteActionError
    | DeviceAction
    | DeviceActionResult
    | DeviceActionError
    | PlaySoundAction
    | BufferSoundAction
    | CancelSoundAction
    | LocalPositionTweenAction
    | LocalRotationTweenAction
    | ShowUploadFilesAction
    | OpenCircleWipeAction
    | FocusOnBotAction
    | FocusOnPositionAction
    | BeginAudioRecordingAction
    | EndAudioRecordingAction
    | CancelAnimationAction
    | BeginRecordingAction
    | EndRecordingAction
    | SpeakTextAction
    | GetVoicesAction
    | GetGeolocationAction
    | RegisterCustomAppAction
    | UnregisterCustomAppAction
    | RegisterHtmlAppAction
    | RequestAuthDataAction
    | DefineGlobalBotAction
    | ConvertGeolocationToWhat3WordsAction
    | GetPublicRecordKeyAction
    | RecordDataAction
    | GetRecordDataAction
    | EraseRecordDataAction
    | RecordFileAction
    | EraseFileAction
    | ARSupportedAction
    | VRSupportedAction;

/**
 * Defines an interface for actions that represent asynchronous tasks.
 */
export interface AsyncAction extends Action {
    /**
     * The ID of the async task.
     */
    taskId: number | string;

    /**
     * The ID of the player that created this task.
     * Set by remote action handlers when a task is recieved from a remote player.
     */
    playerId?: string;
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
 * Defines the set of options required for creating a certificate.
 */
export interface CreateCertificateOptions {
    /**
     * The keypair that should be used for the certificate.
     */
    keypair: string;

    /**
     * The ID of the certified bot that is signing the new certificate.
     */
    signingBotId?: string;

    /**
     * The password that should be used to sign the new certificate.
     */
    signingPassword: string;
}

/**
 * Defines a bot event that creates a new certificate from the given keypair.
 */
export interface CreateCertificateAction
    extends AsyncAction,
        CreateCertificateOptions {
    type: 'create_certificate';
}

/**
 * Defines a bot event that creates a signature for the given tag on the given bot using the given certified bot and password.
 */
export interface SignTagAction extends AsyncAction {
    type: 'sign_tag';

    /**
     * The ID of the certified bot that is signing the tag value.
     */
    signingBotId: string;

    /**
     * The password that should be used to sign the value.
     */
    signingPassword: string;

    /**
     * The ID of the bot whose tag is being signed.
     */
    botId: string;

    /**
     * The tag that should be signed.
     */
    tag: string;

    /**
     * The value that should be signed.
     */
    value: any;
}

/**
 * Defines a bot event that revokes a certificate.
 */
export interface RevokeCertificateAction extends AsyncAction {
    type: 'revoke_certificate';

    /**
     * The ID of the bot that should be used to sign the revocation.
     */
    signingBotId: string;

    /**
     * The password that should be used to sign the revocation.
     */
    signingPassword: string;

    /**
     * The ID of the certificate that should be revoked.
     */
    certificateBotId: string;
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
 * An event that is used to request that the instance be backed up to github.
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
 * An event that is used to request that the instance be backed up to a zip bot and downloaded.
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
 * Defines the list of possible options for backing up a instance.
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
     * The instance that the payment processing should occur in.
     */
    processingInst: string;

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
     * The inst that processing should happen in.
     */
    processingInst: string;
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
 * Options for the os.tweenTo(), os.moveTo(), and os.focusOn() actions.
 */
export interface FocusOnOptions {
    /*
     * The zoom value to use.
     */
    zoom?: number;

    /*
     * The rotation value to use. These are the spherical coordinates that determine where the camera should orbit around the target point.
     */
    rotation?: {
        x: number;
        y: number;

        /**
         * Whether to normalize the rotation values to between 0 and 2*PI.
         * Defaults to true. Setting this to false can be useful for rotating around a bot multiple times.
         */
        normalize?: boolean;
    };

    /**
     * The duration in seconds that the tween should take.
     */
    duration?: number;

    /**
     * The type of easing to use.
     * If not specified then "linear" "inout" will be used.
     */
    easing?: EaseType | Easing;

    /**
     * The portal that the bot is in.
     * If not specified, then the bot will be focused in all portals.
     */
    portal?: PortalType;
}

/**
 * An event that is used to focus on a given bot.
 */
export interface FocusOnBotAction extends AsyncAction, FocusOnOptions {
    type: 'focus_on';

    /**
     * The ID of the bot to focus on.
     */
    botId: string;
}

/**
 * An event that is used to focus on a given position.
 */
export interface FocusOnPositionAction extends AsyncAction, FocusOnOptions {
    type: 'focus_on_position';

    /**
     * The position to animate to.
     */
    position: {
        x: number;
        y: number;
    };
}

/**
 * An event that is used to cancel the current camera animation.
 */
export interface CancelAnimationAction extends AsyncAction {
    type: 'cancel_animation';
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
export interface LoadServerAction extends Action {
    type: 'load_server';

    /**
     * The ID of the simulation to load.
     */
    id: string;
}

/**
 * An event that is used to unload a simulation.
 */
export interface UnloadServerAction extends Action {
    type: 'unload_server';

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
 * Defines an event that sends a web request to a instance.
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
 * Defines an event that animates a tag on a bot over some time.
 */
export interface AnimateTagAction extends AsyncAction {
    type: 'animate_tag';

    /**
     * The ID of the bot to animate.
     */
    botId: string;

    /**
     * The tag to animate.
     */
    tag: string;

    /**
     * The options to use for the animation.
     */
    options: AnimateTagOptions;
}

/**
 * Defines the options that can be used to animate a tag.
 */
export interface AnimateTagOptions {
    /**
     * The value to animate from.
     */
    fromValue: any;

    /**
     * The value to animate to.
     */
    toValue: any;

    /**
     * The number of seconds that the animation executes over.
     */
    duration: number;

    /**
     * The easing that should be used.
     */
    easing: Easing;

    /**
     * The space that the tag should be animated in.
     * If set to false, then the tag on the bot will be modified.
     */
    tagMaskSpace: BotSpace | false;
}

/**
 * Defines an event that is used to load a file.
 */
export interface LoadFileAction extends AsyncAction {
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
export interface SaveFileAction extends AsyncAction {
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
export interface GetRemoteCountAction extends Action {
    type: 'get_remote_count';

    /**
     * The instance that the device count should be retrieved for.
     * If omitted, then the total device count will be returned.
     */
    inst?: string;
}

/**
 * Defines an event that is used to get the list of instances from the server.
 */
export interface GetServersAction extends Action {
    type: 'get_servers';

    /**
     * Whether to get the instance statuses.
     */
    includeStatuses?: boolean;
}

/**
 * Defines an event that is used to get the list of remote devices on the instance.
 */
export interface GetRemotesAction extends Action {
    type: 'get_remotes';
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
export interface PlaySoundAction extends AsyncAction {
    type: 'play_sound';

    /**
     * The URL to open.
     */
    url: string;

    /**
     * The ID of the sound.
     */
    // NOTE: ID is capitalized to be consistent with the getID() API
    soundID: number | string;
}

/**
 * Defines an event that is used to pre-load a sound from the given URL.
 */
export interface BufferSoundAction extends AsyncAction {
    type: 'buffer_sound';

    /**
     * The URL to buffer.
     */
    url: string;
}

/**
 * Defines an event that is used to cancel a sound that is playing.
 */
export interface CancelSoundAction extends AsyncAction {
    type: 'cancel_sound';

    /**
     * The ID of the sound.
     */
    soundID: number | string;
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
export type ShowInputType = 'text' | 'color' | 'secret' | 'date';

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
     * The actions to prevent.
     */
    actions: Action[];
}

/**
 * Defines an event that creates a channel if it doesn't exist.
 */
export interface SetupChannelAction extends AsyncAction {
    type: 'setup_server';

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
 * Export a pin (BCM) for use.
 */
export interface ExportGpioPinAction extends AsyncAction {
    type: 'export_gpio_pin';

    /**
     * The pin (BCM) that you want to export.
     */
    pin: number;

    /**
     * The mode you want to configure your pin (BCM) as.
     */
    mode: 'in' | 'out';
}

/**
 * Unexport a pin (BCM) that is done being used.
 */
export interface UnexportGpioPinAction extends AsyncAction {
    type: 'unexport_gpio_pin';

    /**
     * The pin (BCM) that you want to unexport.
     */
    pin: number;
}

/**
 * Set the value of the provided pin (BCM).
 */
export interface SetGpioPinAction extends AsyncAction {
    type: 'set_gpio_pin';

    /**
     * The pin (BCM) that you want to use.
     */
    pin: number;

    /**
     * The value of the pin (BCM). Either High (0) or Low (1)
     */
    value: 0 | 1;
}

/**
 * Get the value of the provided pin (BCM).
 */
export interface GetGpioPinAction extends AsyncAction {
    type: 'get_gpio_pin';

    /**
     * The pin (BCM) that you want to use.
     */
    pin: number;
}

/**
 * Initialize rpio with the provided settings.
 */
export interface RpioInitAction extends AsyncAction {
    type: 'rpio_init';

    /**
     * Defaults:
     * gpiomem: true            Use /dev/gpiomem
     *                          true | false
     * mapping: 'physical'      Use the P1-P40 numbering scheme
     *                          gpio | physical
     * mock: undefined          Emulate specific hardware in mock mode
     *                          raspi-b-r1 | raspi-a | raspi-b | raspi-a+ | raspi-b+ | raspi-2 | raspi-3 | raspi-zero | raspi-zero-w
     * close_on_exit: true      On node process exit automatically close rpio
     *                          true | false
     */
    options: object;
}

/**
 * Shuts down rpio, unmaps, and clears everything.
 */
export interface RpioExitAction extends AsyncAction {
    type: 'rpio_exit';
}
/**
 * Open a pin for use.
 */
export interface RpioOpenAction extends AsyncAction {
    type: 'rpio_open';

    /**
     * The pin that you want to configure.
     */
    pin: number;

    /**
     * The mode you want toconfigure your pin as.
     */
    mode: 'INPUT' | 'OUTPUT' | 'PWM';

    /**
     * The state you want to initialize your pin as.
     */
    options?: 'HIGH' | 'LOW' | 'PULL_OFF' | 'PULL_DOWN' | 'PULL_UP';
}

/**
 * Set the mode of the provided pin.
 */
export interface RpioModeAction extends AsyncAction {
    type: 'rpio_mode';

    /**
     * The pin that you want to configure.
     */
    pin: number;

    /**
     * The mode you want to set your pin as.
     */
    mode: 'INPUT' | 'OUTPUT' | 'PWM';

    /**
     * The state you want to initialize your pin as.
     */
    options?: 'HIGH' | 'LOW' | 'PULL_OFF' | 'PULL_DOWN' | 'PULL_UP';
}

/**
 * Read the value of the provided pin.
 */
export interface RpioReadAction extends AsyncAction {
    type: 'rpio_read';

    /**
     * The pin that you want to use.
     */
    pin: number;
}

/**
 * Read the buffer of the provided pin.
 */
export interface RpioReadSequenceAction extends AsyncAction {
    type: 'rpio_read_sequence';

    /**
     * The pin that you want to use.
     */
    pin: number;
    /**
     * The length of the buffer.
     */
    length: number;
}

/**
 * Write a new value for the provided pin.
 */
export interface RpioWriteAction extends AsyncAction {
    type: 'rpio_write';

    /**
     * The pin that you want to use.
     */
    pin: number;

    /**
     * The value of the pin. Either High (0) or Low (1)
     */
    value: 'HIGH' | 'LOW';
}

/**
 * Write the buffer to the provided pin.
 */
export interface RpioWriteSequenceAction extends AsyncAction {
    type: 'rpio_write_sequence';

    /**
     * The pin that you want to use.
     */
    pin: number;
    /**
     * The buffer that you want write.
     */
    buffer: number[];
}

/**
 * Read the current state of the GPIO pad control for the specified GPIO group.
 * On current models of Raspberry Pi there are three groups.
 */
export interface RpioReadpadAction extends AsyncAction {
    type: 'rpio_readpad';

    /**
     * 'PAD_GROUP_0_27' is GPIO0 - GPIO27. Use this for the main GPIO header.
     * 'PAD_GROUP_28_45' is GPIO28 - GPIO45. Use this to configure the P5 header.
     * 'PAD_GROUP_46_53' is GPIO46 - GPIO53. Internal, you probably won't need this.
     */
    group: 'PAD_GROUP_0_27' | 'PAD_GROUP_28_45' | 'PAD_GROUP_46_53';
    /**
     * The bitmask you want to check.
     */
    bitmask: 'slew' | 'hysteresis' | 'current';
}
/**
 * Write `control` settings to the pad control for `group`.
 */
export interface RpioWritepadAction extends AsyncAction {
    type: 'rpio_writepad';

    /**
     * 'PAD_GROUP_0_27' is GPIO0 - GPIO27. Use this for the main GPIO header.
     * 'PAD_GROUP_28_45' is GPIO28 - GPIO45. Use this to configure the P5 header.
     * 'PAD_GROUP_46_53' is GPIO46 - GPIO53. Internal, you probably won't need this.
     */
    group: 'PAD_GROUP_0_27' | 'PAD_GROUP_28_45' | 'PAD_GROUP_46_53';

    /**
     * Slew rate unlimited if set to true.
     */
    slew?: boolean;
    /**
     * Hysteresis is enabled if set to true.
     */
    hysteresis?: boolean;
    /**
     * Drive current set in mA. Must be an even number 2-16.
     */
    current?: 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16;
}
/**
 * Configure the pin's internal pullup or pulldown resistors.
 */
export interface RpioPudAction extends AsyncAction {
    type: 'rpio_pud';

    /**
     * The pin that you want to use.
     */
    pin: number;

    /**
     * Configure the pin's resistors as: 'PULL_OFF', 'PULL_DOWN' or 'PULL_UP'
     */
    state: 'PULL_OFF' | 'PULL_DOWN' | 'PULL_UP';
}
/**
 * Watch `pin` for changes and execute the callback `cb()` on events.
 */
export interface RpioPollAction extends AsyncAction {
    type: 'rpio_poll';

    /**
     * The pin that you want to use.
     */
    pin: number;

    /**
     * The callback executed on events.
     */
    cb: any;

    /**
     * Optional. Used to watch for specific events.
     */
    options?: 'POLL_LOW' | 'POLL_HIGH' | 'POLL_BOTH';
}
/**
 * Close a pin to remove it from use.
 */
export interface RpioCloseAction extends AsyncAction {
    type: 'rpio_close';

    /**
     * The pin that you want to use.
     */
    pin: number;

    /**
     * The state you want to leave the pin in. Either PIN_RESET or PIN_PRESERVE
     */
    options?: 'PIN_RESET' | 'PIN_PRESERVE';
}
/**
 *Initializes i2c for use.
 */
export interface RpioI2CBeginAction extends AsyncAction {
    type: 'rpio_i2c_begin';
}
/**
 * Configure the slave address.
 */
export interface RpioI2CSetSlaveAddressAction extends AsyncAction {
    type: 'rpio_i2c_setslaveaddress';

    /**
     * The slave address to set.
     */
    address: number;
}
/**
 * Set the baud rate. Directly set the speed in hertz.
 */
export interface RpioI2CSetBaudRateAction extends AsyncAction {
    type: 'rpio_i2c_setbaudrate';

    /**
     * The i2c refresh rate in hertz.
     */
    rate: number;
}
/**
 * Set the baud rate. Set it based on a divisor of the base 250MHz rate.
 */
export interface RpioI2CSetClockDividerAction extends AsyncAction {
    type: 'rpio_i2c_setclockdivider';

    /**
     * The i2c refresh rate based on a divisor of the base 250MHz rate.
     */
    rate: number;
}
/**
 * Read from the i2c slave.
 */
export interface RpioI2CReadAction extends AsyncAction {
    type: 'rpio_i2c_read';

    /**
     * Buffer to read.
     */
    rx: number[];

    /**
     * Optional. Length of the buffer to read.
     */
    length?: number;
}
/**
 * Write to the i2c slave.
 */
export interface RpioI2CWriteAction extends AsyncAction {
    type: 'rpio_i2c_write';

    /**
     * Buffer to write.
     */
    tx: number[];

    /**
     * Optional. Length of the buffer to write.
     */
    length?: number;
}
/**
 *
 */
// export interface RpioI2CReadRegisterRestartAction extends AsyncAction {
//     type: 'rpio_i2c_readregisterrestart';
// }
/**
 *
 */
// export interface RpioI2CWriteReadRestartAction extends AsyncAction {
//     type: 'rpio_i2c_writereadrestart';
// }
/**
 * Turn off the i²c interface and return the pins to GPIO.
 */
export interface RpioI2CEndAction extends AsyncAction {
    type: 'rpio_i2c_end';
}
/**
 * This is a power-of-two divisor of the base 19.2MHz rate, with a maximum value of 4096 (4.6875kHz).
 */
export interface RpioPWMSetClockDividerAction extends AsyncAction {
    type: 'rpio_pwm_setclockdivider';

    /**
     * The PWM refresh rate.
     */
    rate: number;
}
/**
 * This determines the maximum pulse width.
 */
export interface RpioPWMSetRangeAction extends AsyncAction {
    type: 'rpio_pwm_setrange';

    /**
     * The pin that you want to use.
     */
    pin: number;

    /**
     * The PWM range for a pin.
     */
    range: number;
}
/**
 * Set the width for a given pin.
 */
export interface RpioPWMSetDataAction extends AsyncAction {
    type: 'rpio_pwm_setdata';

    /**
     * The pin that you want to use.
     */
    pin: number;

    /**
     * The PWM width for a pin.
     */
    width: number;
}
/**
 * Initiate SPI mode.
 */
export interface RpioSPIBeginAction extends AsyncAction {
    type: 'rpio_spi_begin';
}
/**
 * Choose which of the chip select / chip enable pins to control.
 */
export interface RpioSPIChipSelectAction extends AsyncAction {
    type: 'rpio_spi_chipselect';

    /*
     *  Value | Pin
     *  ------|---------------------
     *    0   | SPI_CE0 (24 / GPIO8)
     *    1   | SPI_CE1 (26 / GPIO7)
     *    2   | Both
     */
    value: 0 | 1 | 2;
}
/**
 * If your device's CE pin is active high, use this to change the polarity.
 */
export interface RpioSPISetCSPolarityAction extends AsyncAction {
    type: 'rpio_spi_setcspolarity';

    /*
     *  Value | Pin
     *  ------|---------------------
     *    0   | SPI_CE0 (24 / GPIO8)
     *    1   | SPI_CE1 (26 / GPIO7)
     *    2   | Both
     */
    value: 0 | 1 | 2;

    /**
     * Set the polarity it activates on. HIGH or LOW
     */
    polarity: 'HIGH' | 'LOW';
}
/**
 * Set the SPI clock speed.
 */
export interface RpioSPISetClockDividerAction extends AsyncAction {
    type: 'rpio_spi_setclockdivider';

    /**
     * It is an even divisor of the base 250MHz rate ranging between 0 and 65536.
     */
    rate: number;
}
/**
 * Set the SPI Data Mode.
 */
export interface RpioSPISetDataModeAction extends AsyncAction {
    type: 'rpio_spi_setdatamode';

    /**
     *  Mode | CPOL | CPHA
     *  -----|------|-----
     *    0  |  0   |  0
     *    1  |  0   |  1
     *    2  |  1   |  0
     *    3  |  1   |  1
     */
    mode: 0 | 1 | 2 | 3;
}
/**
 *
 */
export interface RpioSPITransferAction extends AsyncAction {
    type: 'rpio_spi_transfer';

    /**
     *
     */
    tx: number[];
}
/**
 *
 */
export interface RpioSPIWriteAction extends AsyncAction {
    type: 'rpio_spi_write';

    /**
     *
     */
    tx: number[];
}
/**
 * Release the pins back to general purpose use.
 */
export interface RpioSPIEndAction extends AsyncAction {
    type: 'rpio_spi_end';
}
/**
 * Establish the connection to the bluetooth serial device
 */
export interface SerialConnectAction extends AsyncAction {
    type: 'serial_connect';

    /**
     * A friendly device name. Example: Brush01
     */
    name: string;

    /**
     * The device path. Example: /dev/rfcomm0
     */
    device: string;

    /**
     * The device MAC address. Example: AA:BB:CC:DD:EE
     */
    mac: string;

    /**
     * The device channel. Example: 1
     */
    channel: number;

    /**
     * {boolean} [autoOpen=true] Automatically opens the port on `nextTick`.
     *
     * {number=} [baudRate=9600] The baud rate of the port to be opened. This should match one of the commonly available baud rates, such as 110, 300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, or 115200. Custom rates are supported best effort per platform. The device connected to the serial port is not guaranteed to support the requested baud rate, even if the port itself supports that baud rate.
     *
     * {number} [dataBits=8] Must be one of these: 8, 7, 6, or 5.
     *
     * {number} [highWaterMark=65536] The size of the read and write buffers defaults to 64k.
     *
     * {boolean} [lock=true] Prevent other processes from opening the port. Windows does not currently support `false`.
     *
     * {number} [stopBits=1] Must be one of these: 1 or 2.
     *
     * {string} [parity=none] Must be one of these: 'none', 'even', 'mark', 'odd', 'space'.
     *
     * {boolean} [rtscts=false] flow control setting
     *
     * {boolean} [xon=false] flow control setting
     *
     * {boolean} [xoff=false] flow control setting
     *
     * {boolean} [xany=false] flow control setting
     *
     * {object=} bindingOptions sets binding-specific options
     *
     * {Binding=} Binding The hardware access binding. `Bindings` are how Node-Serialport talks to the underlying system. Will default to the static property `Serialport.Binding`.
     *
     * {number} [bindingOptions.vmin=1] see [`man termios`](http://linux.die.net/man/3/termios) LinuxBinding and DarwinBinding
     *
     * {number} [bindingOptions.vtime=0] see [`man termios`](http://linux.die.net/man/3/termios) LinuxBinding and DarwinBinding
     */
    options?: object;
}
/**
 * Parses and returns the serial stream to the event tag 'onSerialData'.
 */
export interface SerialStreamAction extends AsyncAction {
    type: 'serial_stream';

    /**
     * The id of the bot you want data streamed to. The bot needs the 'onSerialData' tag.
     */
    bot: string;

    /**
     * A friendly device name. Example: Brush01
     */
    name: string;
}
/**
 * Opens the serial connection if you set the option in serialConnect to {autoOpen: false}
 */
export interface SerialOpenAction extends AsyncAction {
    type: 'serial_open';
    /**
     * A friendly device name. Example: Brush01
     */
    name: string;
}
/**
 * Updates the SerialPort object with a new baudRate.
 */
export interface SerialUpdateAction extends AsyncAction {
    type: 'serial_update';
    /**
     * A friendly device name. Example: Brush01
     */
    name: string;

    /**
     * {number=} [baudRate=9600] The baud rate of the port to be opened. This should match one of the commonly available baud rates, such as 110, 300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, or 115200. Custom rates are supported best effort per platform. The device connected to the serial port is not guaranteed to support the requested baud rate, even if the port itself supports that baud rate.
     */
    options: object;

    /**
     *
     */
    cb?: any;
}
/**
 * Writes the provided data/command to the device
 */
export interface SerialWriteAction extends AsyncAction {
    type: 'serial_write';
    /**
     * A friendly device name. Example: Brush01
     */
    name: string;

    /**
     * The data/command to send.
     */
    data: string | number[];

    /**
     * The encoding, if chunk is a string. Defaults to 'utf8'. Also accepts 'utf16le', 'latin1', 'ascii', 'base64', 'binary', 'ucs2', and 'hex'
     */
    encoding?: string;

    /**
     *
     */
    cb?: any;
}
/**
 * Request a number of bytes from the SerialPort.
 */
export interface SerialReadAction extends AsyncAction {
    type: 'serial_read';
    /**
     * A friendly device name. Example: Brush01
     */
    name: string;

    /**
     * Specify how many bytes of data to return, if available
     */
    size?: number;
}
/**
 * Closes an open connection.
 */
export interface SerialCloseAction extends AsyncAction {
    type: 'serial_close';
    /**
     * A friendly device name. Example: Brush01
     */
    name: string;

    /**
     * The device path. Example: /dev/rfcomm0
     */
    device: string;

    /**
     *
     */
    cb?: any;
}
/**
 * Flush discards data that has been received but not read, or written but not transmitted by the operating system.
 */
export interface SerialFlushAction extends AsyncAction {
    type: 'serial_flush';
    /**
     * A friendly device name. Example: Brush01
     */
    name: string;
}
/**
 * Waits until all output data is transmitted to the serial port. After any pending write has completed, it calls `tcdrain()` or `FlushFileBuffers()` to ensure it has been written to the device.
 */
export interface SerialDrainAction extends AsyncAction {
    type: 'serial_drain';
    /**
     * A friendly device name. Example: Brush01
     */
    name: string;
}
/**
 * Causes a stream in flowing mode to stop emitting 'data' events, switching out of flowing mode. Any data that becomes available remains in the internal buffer.
 */
export interface SerialPauseAction extends AsyncAction {
    type: 'serial_pause';
    /**
     * A friendly device name. Example: Brush01
     */
    name: string;
}
/**
 * Causes an explicitly paused, Readable stream to resume emitting 'data' events, switching the stream into flowing mode.
 */
export interface SerialResumeAction extends AsyncAction {
    type: 'serial_resume';
    /**
     * A friendly device name. Example: Brush01
     */
    name: string;
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

    /**
     * The color to use for the placeholder.
     */
    placeholderColor?: string;

    /**
     * The color to use for the background.
     */
    backgroundColor?: string;

    /**
     * The color to use for the foreground (text).
     */
    foregroundColor?: string;
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

    /**
     * The color to use for the placeholder.
     */
    placeholderColor?: string;

    /**
     * The color to use for the background.
     */
    backgroundColor?: string;

    /**
     * The color to use for the foreground (text).
     */
    foregroundColor?: string;
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
 * Defines an event that shows the "uplaod file" dialog.
 */
export interface ShowUploadFilesAction extends AsyncAction {
    type: 'show_upload_files';
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
 * Defines an event that loads the history into the instance.
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
     * The instance that the mark should be restored to.
     * If not specified, then the current instance will be used.
     */
    inst?: string;
}

/**
 * Defines an event that loads a space into the instance.
 */
export interface LoadSpaceAction extends Partial<AsyncAction> {
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
export interface LoadBotsAction extends AsyncAction {
    type: 'load_bots';

    /**
     * The space that should be searched.
     */
    space: string;

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
export interface ClearSpaceAction extends AsyncAction {
    type: 'clear_space';

    /**
     * The space to clear.
     */
    space: string;
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
 * Defines an event that sets the password used to unlock the given space for editing.
 */
export interface SetSpacePasswordAction extends AsyncAction {
    type: 'set_space_password';

    /**
     * The space to set the password for.
     */
    space: BotSpace;

    /**
     * The old password for the space.
     */
    oldPassword: string;

    /**
     * The new password for the space.
     */
    newPassword: string;
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

export type TweenType = 'position' | 'rotation';

export type EaseType =
    | 'linear'
    | 'quadratic'
    | 'cubic'
    | 'quartic'
    | 'quintic'
    | 'sinusoidal'
    | 'exponential'
    | 'circular'
    | 'elastic';

export type EaseMode = 'in' | 'out' | 'inout';

export interface Easing {
    type: EaseType;
    mode: EaseMode;
}

/**
 * The maximum allowed duration for tweens.
 */
export const MAX_TWEEN_DURATION = 60 * 60 * 24;

/**
 * Defines an event that runs a tween locally.
 */
export interface LocalTweenAction extends AsyncAction {
    type: 'local_tween';

    /**
     * The bot to run the tween on.
     */
    botId: string;

    /**
     * The dimension that the bot should be tweened in.
     */
    dimension: string;

    /**
     * The type of the tween.
     */
    tweenType: TweenType;

    /**
     * The easing that should be used.
     */
    easing: Easing;

    /**
     * The duration of the tween in seconds.
     */
    duration: number;
}

/**
 * Defines an event that runs a position tween locally.
 */
export interface LocalPositionTweenAction extends LocalTweenAction {
    tweenType: 'position';

    /**
     * The target position of the tween.
     */
    position: { x?: number; y?: number; z?: number };
}

export interface LocalRotationTweenAction extends LocalTweenAction {
    tweenType: 'rotation';

    rotation: { x?: number; y?: number; z?: number };
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
 * Defines an event that checks for AR support on the device.
 */
export interface ARSupportedAction extends AsyncAction {
    type: 'ar_supported';
}

/**
 * Defines an event that checks for VR support on the device.
 */
export interface VRSupportedAction extends AsyncAction {
    type: 'vr_supported';
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
 * Defines an event that enables POV on the device.
 */
export interface EnablePOVAction {
    type: 'enable_pov';

    /**
     * Whether POV features should be enabled.
     */
    enabled: boolean;

    /**
     * The point that the camera should be placed at for POV.
     */
    center?: { x: number; y: number; z: number };

    /**
     * Whether IMU features should be enabled while in POV mode.
     */
    imu?: boolean;
}

/**
 * Defines an event that shows a QR code that is a link to a instance & dimension.
 */
export interface ShowJoinCodeAction {
    type: 'show_join_code';

    /**
     * The instance that should be joined.
     */
    inst?: string;

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

/**
 * Defines an event that ensures a portal bot has been created for a portal.
 */
export interface RegisterBuiltinPortalAction {
    type: 'register_builtin_portal';

    /**
     * The ID of the portal.
     */
    portalId: string;
}

/**
 * The list of types of output that custom portals support.
 */
export type CustomAppOutputType = 'html';

/**
 * the list of modes that custom portals support.
 */
export type CustomPortalOutputMode = 'push' | 'pull';

/**
 * Defines an event that registers a custom portal.
 */
export interface RegisterCustomAppAction extends AsyncAction {
    type: 'register_custom_app';

    /**
     * The ID of the app.
     */
    appId: string;

    /**
     * The ID of the bot that should be used to configure the portal.
     */
    botId: string;
}

/**
 * Defines an event that unregisters a custom app.
 */
export interface UnregisterCustomAppAction extends AsyncAction {
    type: 'unregister_custom_app';

    /**
     * The ID of the app.
     */
    appId: string;
}

/**
 * Defines an event that requests that a HTML app be created.
 */
export interface RegisterHtmlAppAction extends AsyncAction {
    type: 'register_html_app';

    /**
     * The ID of the app.
     */
    appId: string;

    /**
     * The ID of the app instance.
     * Used to distinguish between multiple instances of the same app.
     */
    instanceId: string;
}

/**
 * Defines an event that requests that a HTML app be deleted.
 */
export interface UnregisterHtmlAppAction extends Action {
    type: 'unregister_html_app';

    /**
     * The ID of the app.
     */
    appId: string;

    /**
     * The ID of the app instance.
     * Used to distinguish between multiple instances of the same app.
     */
    instanceId: string;
}

/**
 * Defines an event that notifies that the output of a app should be updated with the given data.
 */
export interface SetAppOutputAction extends Action {
    type: 'set_app_output';

    /**
     * The ID of the app.
     */
    appId: string;

    /**
     * The output that the app should show.
     */
    output: any;

    uncopiable: true;
}

/**
 * Defines an event that notifies that a custom app has recieved a HTML update.
 */
export interface UpdateHtmlAppAction extends Action {
    type: 'update_html_app';

    /**
     * The ID of the app.
     */
    appId: string;

    /**
     * The array of mutation rectords that represent the changes to the HTML.
     */
    updates: SerializableMutationRecord[];
}

/**
 * Defines an event that represents an event that was dispatched from HTML in a portal.
 */
export interface HtmlAppEventAction extends Action {
    type: 'html_app_event';

    /**
     * The ID of the app.
     */
    appId: string;

    /**
     * The event.
     */
    event: any;
}

/**
 * Defines a mutation record that can be serialized and sent over a web worker pipe.
 */
export interface SerializableMutationRecord {
    type: 'attributes' | 'characterData' | 'childList' | 'event_listener';
    target: NodeReference;
    addedNodes: NodeReference[];
    removedNodes: NodeReference[];

    previousSibling: NodeReference;
    nextSibling: NodeReference;

    attributeName: string;
    attributeNamespace: string;
    oldValue: string;

    /**
     * The name of the event listener.
     */
    listenerName?: string;

    /**
     * The number of event listeners that were added (positive number) or removed (negative number).
     */
    listenerDelta?: number;
}

export interface NodeReference {
    __id: string;
}

/**
 * Defines an event that adds an entry point to a custom portal.
 */
export interface RegisterPrefixAction extends AsyncAction {
    type: 'register_prefix';

    /**
     * The prefix that should be registered.
     */
    prefix: string;

    /**
     * The options that should be used for the prefix.
     */
    options: RegisterPrefixOptions;
}

/**
 * Defines an interface that contains options for register prefix actions.
 */
export interface RegisterPrefixOptions {
    /**
     * The possible languages that prefixes can use.
     */
    language?: 'javascript' | 'typescript' | 'json' | 'jsx' | 'tsx' | 'text';
}

/**
 * An event that is used to show or hide the circle wipe.
 */
export interface OpenCircleWipeAction extends AsyncAction {
    type: 'show_circle_wipe';

    /**
     * Whether the circle wipe should be visible.
     */
    open: boolean;

    /**
     * The options for the circle wipe.
     */
    options: OpenCircleWipeOptions;
}

/**
 * The options for the circle wipe.
 */
export interface OpenCircleWipeOptions {
    /**
     * The duration of this half of the circle wipe animation in seconds.
     */
    duration: number;

    /**
     * The color that the circle wipe should be.
     */
    color: string;
}

/**
 * An event that is used to add some snap points for a drag operation.
 */
export interface AddDropSnapTargetsAction extends Action {
    type: 'add_drop_snap_targets';

    /**
     * The ID of the bot that, when it is a drop target, the snap points should be enabled.
     * If null, then the targets apply globally during the drag operation.
     */
    botId?: string;

    /**
     * The list of snap targets that should be used.
     */
    targets: SnapTarget[];
}

/**
 * Defines an interface that represents a snap point.
 * That is, a point in 3D space with an associated snap distance.
 */
export interface SnapPoint {
    /**
     * The 3D position for the point.
     */
    position: { x: number; y: number; z: number };

    /**
     * The distance that the snap point should take effect at.
     */
    distance: number;
}

/**
 * Defines an interface that represents a snap axis.
 * That is, a ray in 3D space with an associated snap distance.
 */
export interface SnapAxis {
    /**
     * The 3D direction that the axis ray travels along.
     */
    direction: { x: number; y: number; z: number };

    /**
     * The 3D position that the ray starts at.
     */
    origin: { x: number; y: number; z: number };

    /**
     * The distance from the ray line that the snap point should take effect at.
     */
    distance: number;
}

/**
 * The list of possible snap targets.
 * - "ground" means that the dragged bot should snap to the ground plane. This option is overriden by "grid".
 * - "grid" means that the dragged bot should snap to grid tiles.
 * - "face" means that the dragged bot should snap to other bot faces.
 * - "bots" means that the dragged bot will snap to other bots.
 */
export type SnapTarget =
    | 'ground'
    | 'grid'
    | 'face'
    | 'bots'
    | SnapPoint
    | SnapAxis;

/**
 * An event that is used to disable the default dragging logic (moving the bot) and enable
 * "onDragging" shouts and whispers.
 */
export interface EnableCustomDraggingAction extends Action {
    type: 'enable_custom_dragging';
}

/**
 * An event that is used to start audio recording.
 */
export interface BeginAudioRecordingAction extends AsyncAction {
    type: 'begin_audio_recording';

    /**
     * Whether to stream the audio recording.
     * If streaming is enabled, then @onAudioChunk will be triggered whenever a new
     * piece of audio is available.
     */
    stream?: boolean;

    /**
     * The MIME type that should be produced.
     * Defaults to a containerized format (audio/mp3, audio/webm, etc.) if not specified.
     */
    mimeType?: string;

    /**
     * The number of samples per second (Hz) that audio/x-raw recordings should use.
     * Defaults to 44100 if not specified.
     */
    sampleRate?: number;
}

/**
 * An event that is used to finish audio recording.
 */
export interface EndAudioRecordingAction extends AsyncAction {
    type: 'end_audio_recording';
}

/**
 * An interface that represents the options that can be used for making recordings.
 */
export interface RecordingOptions {
    /**
     * Whether to record audio.
     */
    audio: boolean;

    /**
     * Whether to record video.
     */
    video: boolean;

    /**
     * Whether to record the screen.
     */
    screen: boolean;
}

/**
 * An event that is used to start audio recording.
 */
export interface BeginRecordingAction extends AsyncAction, RecordingOptions {
    type: 'begin_recording';
}

/**
 * An event that is used to finish audio recording.
 */
export interface EndRecordingAction extends AsyncAction {
    type: 'end_recording';
}

export interface SpeakTextOptions {
    /**
     * The pitch that the text should be spoken at.
     */
    pitch?: number;

    /**
     * The rate that the text should be spoken at.
     */
    rate?: number;

    /**
     * The name of the voice that the text should be spoken with.
     */
    voice?: string;
}

/**
 * An event that is used to speak some text using the builtin text to speech engine.
 */
export interface SpeakTextAction extends AsyncAction, SpeakTextOptions {
    type: 'speak_text';

    /**
     * The text that should be spoken.
     */
    text: string;
}

/**
 * An event that is used to retrieve the synthetic voices that are supported by the current system.
 */
export interface GetVoicesAction extends AsyncAction {
    type: 'get_voices';
}

/**
 * Defines an interface that represents a synthetic voice.
 */
export interface SyntheticVoice {
    /**
     * Whether this voice is the default synthetic voice.
     */
    default: boolean;

    /**
     * The language that this voice can speak.
     */
    language: string;

    /**
     * The name of the voice.
     */
    name: string;
}

/**
 * An event that is used to retrieve the current geolocation of the device.
 */
export interface GetGeolocationAction extends AsyncAction {
    type: 'get_geolocation';
}

export interface SuccessfulGeolocation {
    success: true;

    /**
     * The altitude that the device is near.
     * Null if the device does not support determining the altitude.
     */
    altitude?: number;

    /**
     * The accuracy of the altitude in meters.
     * Null if the device does not support altitude.
     */
    altitudeAccuracy?: number;

    /**
     * The latitude that the device is near.
     */
    latitude?: number;

    /**
     * The longitude that the device is near.
     */
    longitude?: number;

    /**
     * The accuracy of the positional location (latitude and longitude) in meters.
     */
    positionalAccuracy?: number;

    /**
     * The heading of the device from north in radians.
     * 0 is true north, Math.PI/2 is east, Math.PI is south and 3/2*Math.PI is west.
     * This value is null if the device is unable to determine the heading.
     */
    heading: number;

    /**
     * The speed that the device is moving in meters per second.
     * Null if the device does not support calculating the speed.
     */
    speed: number;

    /**
     * The timestamp of the geolocation result.
     */
    timestamp: number;
}

export interface UnsuccessfulGeolocation {
    success: false;

    /**
     * The code of the error that occurred.
     */
    errorCode?:
        | 'permission_denied'
        | 'position_unavailable'
        | 'timeout'
        | 'unknown';

    /**
     * The message of the error that occurred.
     */
    errorMessage?: string;
}

/**
 * Defines an interface that represents a geolocation result.
 */
export type Geolocation = SuccessfulGeolocation | UnsuccessfulGeolocation;

/**
 * Defines an interface that contains recorded data.
 */
export interface Recording {
    /**
     * The list of files that were produced when recording.
     */
    files: RecordedFile[];
}

export interface RecordedFile {
    /**
     * Whether the file contains the recorded audio.
     */
    containsAudio: boolean;

    /**
     * Whether the file contains the recorded video.
     */
    containsVideo: boolean;

    /**
     * Whether the file contains the recorded screen data.
     */
    containsScreen: boolean;

    /**
     * The data that the file contains.
     */
    data: Blob;
}

/**
 * Defines an event that tells the IDE portal to open the given bot and tag.
 */
export interface GoToTagAction {
    type: 'go_to_tag';

    /**
     * The ID of the bot.
     */
    botId: string;

    /**
     * The tag to open.
     */
    tag: string;

    /**
     * The space to open.
     */
    space: string | null;
}

/**
 * Defines an event that requests a Auth data from the OS.
 */
export interface RequestAuthDataAction extends AsyncAction {
    type: 'request_auth_data';
}

/**
 * Defines an interface that represents a authenticated user.
 */
export interface AuthData {
    /**
     * The ID of the user.
     */
    userId: string;

    /**
     * The name of the user.
     * Null if the user has not set a name.
     */
    name: string;

    /**
     * The URL of the user's avatar.
     * Null if the user does not have an avatar.
     */
    avatarUrl: string;

    /**
     * The URL that the user's avatar portrait is at.
     * Null if the user does not have an avatar.
     */
    avatarPortraitUrl: string;
}

/**
 * Defines an event that defines a global variable that points to the given bot.
 */
export interface DefineGlobalBotAction extends AsyncAction {
    type: 'define_global_bot';

    /**
     * The ID of the bot that should be defined.
     */
    botId: string;

    /**
     * The name of the global variable that should reference the bot.
     */
    name: string;
}

export const APPROVED_SYMBOL = Symbol('approved');

/**
 * Defines an interface that represents tbe base for actions that deal with data records.
 */
export interface DataRecordAction extends AsyncAction {
    /**
     * Whether this action is trying to publish data that requires manual approval.
     */
    requiresApproval: boolean;

    /**
     * Whether this action has been manually approved.
     *
     * Uses a symbol to ensure that it cannot be copied across security boundaries.
     * As a result, it should be impossible to generate actions that are pre-approved.
     */
    [APPROVED_SYMBOL]?: boolean;
}

/**
 * Defines an event that publishes data to a record.
 */
export interface RecordDataAction extends DataRecordAction {
    type: 'record_data';

    /**
     * The record key that should be used to publish the data.
     */
    recordKey: string;

    /**
     * The address that the data should be recorded to.
     */
    address: string;

    /**
     * The data that should be recorded.
     */
    data: any;
}

/**
 * Defines an event that requests some data in a record.
 */
export interface GetRecordDataAction extends DataRecordAction {
    type: 'get_record_data';

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The address of the data that should be retrieved.
     */
    address: string;
}

/**
 * Defines an event that erases some data in a record.
 */
export interface EraseRecordDataAction extends DataRecordAction {
    type: 'erase_record_data';

    /**
     * The record key that should be used to erase the data.
     */
    recordKey: string;

    /**
     * The address that the data from.
     */
    address: string;
}

/**
 * Defines an event that publishes a file to a record.
 */
export interface RecordFileAction extends AsyncAction {
    type: 'record_file';

    /**
     * The record key that should be used to publish the file.
     */
    recordKey: string;

    /**
     * The data that should be recorded.
     */
    data: any;

    /**
     * The description of the file.
     */
    description: string;

    /**
     * The MIME type of the uploaded file.
     */
    mimeType?: string;
}

/**
 * Defines an event that erases a file from a record.
 */
export interface EraseFileAction extends AsyncAction {
    type: 'erase_file';

    /**
     * The record key that should be used to erase the file.
     */
    recordKey: string;

    /**
     * The URL that the file is stored at.
     */
    fileUrl: string;
}

export type FileRecordedResult = FileRecordedSuccess | FileRecordedFailure;

export interface FileRecordedSuccess {
    success: true;
    url: string;
    sha256Hash: string;
}

export interface FileRecordedFailure {
    success: false;
    errorCode: RecordFileFailure['errorCode'] | 'upload_failed';
    errorMessage: string;
}

export interface GetRecordsActionResult {
    records: Record[];
    hasMoreRecords: boolean;
    totalCount: number;
    cursor?: string;
}

/**
 * Defines an interface that represents options for converting a geolocation to a what3words address.
 */
export interface ConvertGeolocationToWhat3WordsOptions {
    /**
     * The latitude to convert.
     */
    latitude: number;

    /**
     * The longitude to convert.
     */
    longitude: number;

    /**
     * The identifier of the language that should be used for the resulting what3words address.
     */
    language?: string;
}

/**
 * Defines an interface that represents an action that converts a geolocation (latitude and longitude) to a what3words address (see https://what3words.com/).
 */
export interface ConvertGeolocationToWhat3WordsAction
    extends AsyncAction,
        ConvertGeolocationToWhat3WordsOptions {
    type: 'convert_geolocation_to_w3w';
}

/**
 * Defines an interface that represents an action that requests a key to a public record.
 */
export interface GetPublicRecordKeyAction extends AsyncAction {
    type: 'get_public_record_key';

    /**
     * The name of the record.
     */
    recordName: string;
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
export function reject(...events: Action[]): RejectAction {
    return {
        type: 'reject',
        actions: events,
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
 * Creates a new FocusOnBotAction.
 * @param botId The ID of the bot to tween to.
 * @param zoomValue The zoom value to use.
 * @param rotX The X rotation value.
 * @param rotY The Y rotation value.
 * @param duration The duration.
 */
export function tweenTo(
    botId: string,
    options: FocusOnOptions = {},
    taskId?: string | number
): FocusOnBotAction {
    return {
        type: 'focus_on',
        botId: botId,
        taskId,
        ...options,
    };
}

/**
 * Creates a new FocusOnPositionAction.
 * @param position The position that the camera should move to.
 * @param options The options to use.
 * @param taskId The ID of the task.
 */
export function animateToPosition(
    position: { x: number; y: number },
    options: FocusOnOptions = {},
    taskId?: string | number
): FocusOnPositionAction {
    return {
        type: 'focus_on_position',
        position,
        taskId,
        ...options,
    };
}

/**
 * Creates a new CancelAnimationAction.
 * @param taskId The ID of the task.
 */
export function cancelAnimation(
    taskId?: string | number
): CancelAnimationAction {
    return {
        type: 'cancel_animation',
        taskId,
    };
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
export function loadSimulation(id: string): LoadServerAction {
    return {
        type: 'load_server',
        id: id,
    };
}

/**
 * Creates a new UnloadSimulationAction.
 * @param id The ID of the simulation to unload.
 */
export function unloadSimulation(id: string): UnloadServerAction {
    return {
        type: 'unload_server',
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
 * @param soundID The ID of the sound.
 * @param taskId The ID of the task.
 */
export function playSound(
    url: string,
    soundID: string | number,
    taskId?: string | number
): PlaySoundAction {
    return {
        type: 'play_sound',
        url: url,
        soundID,
        taskId,
    };
}

/**
 * Creates a new BufferSoundAction.
 * @param url The URL of the sound to play.
 * @param taskId The ID of the async task.
 */
export function bufferSound(
    url: string,
    taskId?: string | number
): BufferSoundAction {
    return {
        type: 'buffer_sound',
        url: url,
        taskId,
    };
}

/**
 * Creates a new CancelSoundAction.
 * @param soundId The ID of the sound to cancel.
 * @param taskId The ID of the async task.
 */
export function cancelSound(
    soundID: number | string,
    taskId?: string | number
): CancelSoundAction {
    return {
        type: 'cancel_sound',
        soundID,
        taskId,
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
    processingInst: string
): CheckoutSubmittedAction {
    return {
        type: 'checkout_submitted',
        productId: productId,
        token: token,
        processingInst: processingInst,
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
 * Animates the given tag on the given bot using the given options.
 * @param botId The ID of the bot.
 * @param tag The tag to animate.
 * @param options The options.
 * @param taskId The ID of the task that this event represents.
 */
export function animateTag(
    botId: string,
    tag: string,
    options: AnimateTagOptions,
    taskId?: number | string
): AnimateTagAction {
    return {
        type: 'animate_tag',
        botId,
        tag,
        options,
        taskId,
    };
}

/**
 * Creates a new LoadFileAction.
 * @param options The options.
 * @param taskId The ID of the async task.
 */
export function loadFile(
    options: LoadFileOptions,
    taskId?: number | string
): LoadFileAction {
    return {
        type: 'load_file',
        options: options,
        taskId,
    };
}

/**
 * Creates a new SaveFileAction.
 * @param options The options.
 * @param taskId The ID of the async task.
 */
export function saveFile(
    options: SaveFileOptions,
    taskId?: number | string
): SaveFileAction {
    return {
        type: 'save_file',
        options: options,
        taskId,
    };
}

/**
 * Creates a new GetRemoteCountAction.
 * @param inst The instance that the device count should be retrieved for.
 */
export function getRemoteCount(inst?: string): GetRemoteCountAction {
    if (hasValue(inst)) {
        return {
            type: 'get_remote_count',
            inst,
        };
    } else {
        return {
            type: 'get_remote_count',
        };
    }
}

/**
 * Creates a new GetServersAction.
 */
export function getServers(): GetServersAction {
    return {
        type: 'get_servers',
    };
}

/**
 * Creates a new GetServersAction that includes statuses.
 */
export function getServerStatuses(): GetServersAction {
    return {
        type: 'get_servers',
        includeStatuses: true,
    };
}

/**
 * Creates a new GetRemotesAction.
 */
export function getRemotes(): GetRemotesAction {
    return {
        type: 'get_remotes',
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
 * @param taskId The ID of the async task.
 */
export function setupServer(
    channel: string,
    botOrMod?: Bot | BotTags,
    taskId?: string | number,
    playerId?: string
): SetupChannelAction {
    return {
        type: 'setup_server',
        channel,
        botOrMod,
        taskId,
        playerId,
    };
}

/**
 * Exports a pin (BCM) if it doesn't exist.
 * @param pin The physical BCM Pin on the server.
 * @param mode The mode of the BCM pin.
 * @param taskId The ID of the async task.
 */
export function exportGpioPin(
    pin: number,
    mode: 'in' | 'out',
    taskId?: string | number,
    playerId?: string
): ExportGpioPinAction {
    return {
        type: 'export_gpio_pin',
        pin,
        mode,
        taskId,
        playerId,
    };
}

/**
 * Unexports a pin (BCM) if it exists.
 * @param pin The physical BCM Pin on the server.
 * @param taskId The ID of the async task.
 */
export function unexportGpioPin(
    pin: number,
    taskId?: string | number,
    playerId?: string
): UnexportGpioPinAction {
    return {
        type: 'unexport_gpio_pin',
        pin,
        taskId,
        playerId,
    };
}

/**
 * Sets the value of a pin (BCM) to HIGH/LOW.
 * @param pin The physical BCM Pin on the server.
 * @param value The value of the BCM pin whether it's HIGH or LOW.
 * @param taskId The ID of the async task.
 */
export function setGpioPin(
    pin: number,
    value: 0 | 1,
    taskId?: string | number,
    playerId?: string
): SetGpioPinAction {
    return {
        type: 'set_gpio_pin',
        pin,
        value,
        taskId,
        playerId,
    };
}

/**
 * Gets the current state of a pin (BCM).
 * @param pin The physical BCM Pin on the server.
 * @param taskId The ID of the async task.
 */
export function getGpioPin(
    pin: number,
    taskId?: string | number,
    playerId?: string
): GetGpioPinAction {
    return {
        type: 'get_gpio_pin',
        pin,
        taskId,
        playerId,
    };
}

/**
 * Sends an event to the server to initialize rpio with provided settings
 * @param options An object containing values to initilize with.
 * @param taskId The ID of the async task.
 *
 * @example
 * // Initialize with default settings
 * server.rpioInit({
 *   gpiomem: true,
 *   mapping: 'physical',
 *   mock: undefined,
 *   close_on_exit: false
 * });
 */
export function rpioInitPin(
    options: object,
    taskId?: string | number,
    playerId?: string
): RpioInitAction {
    return {
        type: 'rpio_init',
        options,
        taskId,
        playerId,
    };
}

/**
 * Shuts down rpio, unmaps, and clears everything.
 * @param taskId The ID of the async task.
 */
export function rpioExitPin(
    taskId?: string | number,
    playerId?: string
): RpioExitAction {
    return {
        type: 'rpio_exit',
        taskId,
        playerId,
    };
}

/**
 * Opens a pin up for use and sets its initial mode/state.
 * @param pin The physical pin on the server.
 * @param mode The mode of the pin.
 * @param taskId The ID of the async task.
 */
export function rpioOpenPin(
    pin: number,
    mode: 'INPUT' | 'OUTPUT' | 'PWM',
    options?: 'HIGH' | 'LOW' | 'PULL_OFF' | 'PULL_DOWN' | 'PULL_UP',
    taskId?: string | number,
    playerId?: string
): RpioOpenAction {
    return {
        type: 'rpio_open',
        pin,
        mode,
        options,
        taskId,
        playerId,
    };
}

/**
 * Changes a pin's mode/value.
 * @param pin The physical pin on the server.
 * @param mode The mode of the pin.
 * @param taskId The ID of the async task.
 */
export function rpioModePin(
    pin: number,
    mode: 'INPUT' | 'OUTPUT' | 'PWM',
    options?: 'HIGH' | 'LOW' | 'PULL_OFF' | 'PULL_DOWN' | 'PULL_UP',
    taskId?: string | number,
    playerId?: string
): RpioModeAction {
    return {
        type: 'rpio_mode',
        pin,
        mode,
        options,
        taskId,
        playerId,
    };
}

/**
 * Reads a pin's current value.
 * @param pin The physical BCM Pin on the server.
 * @param taskId The ID of the async task.
 */
export function rpioReadPin(
    pin: number,
    taskId?: string | number,
    playerId?: string
): RpioReadAction {
    return {
        type: 'rpio_read',
        pin,
        taskId,
        playerId,
    };
}

/**
 * Reads a pin's current buffer.
 * @param pin The physical BCM Pin on the server.
 * @param length The length of the buffer.
 * @param taskId The ID of the async task.
 */
export function rpioReadSequencePin(
    pin: number,
    length: number,
    taskId?: string | number,
    playerId?: string
): RpioReadSequenceAction {
    return {
        type: 'rpio_read_sequence',
        pin,
        length,
        taskId,
        playerId,
    };
}

/**
 * Sets a pin's value.
 * @param pin The physical BCM Pin on the server.
 * @param value The value of the BCM pin whether it's HIGH or LOW.
 * @param taskId The ID of the async task.
 */
export function rpioWritePin(
    pin: number,
    value: 'HIGH' | 'LOW',
    taskId?: string | number,
    playerId?: string
): RpioWriteAction {
    return {
        type: 'rpio_write',
        pin,
        value,
        taskId,
        playerId,
    };
}

/**
 * Writes to a pin's buffer.
 * @param pin The physical BCM Pin on the server.
 * @param buffer The buffer to write to the pin.
 * @param taskId The ID of the async task.
 */
export function rpioWriteSequencePin(
    pin: number,
    buffer: number[],
    taskId?: string | number,
    playerId?: string
): RpioWriteSequenceAction {
    return {
        type: 'rpio_write_sequence',
        pin,
        buffer,
        taskId,
        playerId,
    };
}

/**
 * Read the current state of the GPIO pad control for the specified GPIO group.
 * On current models of Raspberry Pi there are three groups.
 *
 * 'PAD_GROUP_0_27' is GPIO0 - GPIO27. Use this for the main GPIO header.
 * 'PAD_GROUP_28_45' is GPIO28 - GPIO45. Use this to configure the P5 header.
 * 'PAD_GROUP_46_53' is GPIO46 - GPIO53. Internal, you probably won't need this.
 *
 * @param group The GPIO group to be read.
 * @param bitmask The bitmask you want to check.
 * @param taskId The ID of the async task.
 */
export function rpioReadpadPin(
    group: 'PAD_GROUP_0_27' | 'PAD_GROUP_28_45' | 'PAD_GROUP_46_53',
    bitmask: 'slew' | 'hysteresis' | 'current',
    taskId?: string | number,
    playerId?: string
): RpioReadpadAction {
    return {
        group,
        bitmask,
        type: 'rpio_readpad',
        taskId,
        playerId,
    };
}

/**
 * Write `control` settings to the pad control for `group`.
 *
 * 'PAD_GROUP_0_27' is GPIO0 - GPIO27. Use this for the main GPIO header.
 * 'PAD_GROUP_28_45' is GPIO28 - GPIO45. Use this to configure the P5 header.
 * 'PAD_GROUP_46_53' is GPIO46 - GPIO53. Internal, you probably won't need this.
 *
 * @param group The GPIO group to be read.
 * @param slew Slew rate unlimited if set to true.
 * @param hysteresis Hysteresis is enabled if set to true.
 * @param current Drive current set in mA. Must be an even number 2-16.
 * @param taskId The ID of the async task.
 */
export function rpioWritepadPin(
    group: 'PAD_GROUP_0_27' | 'PAD_GROUP_28_45' | 'PAD_GROUP_46_53',
    slew?: boolean,
    hysteresis?: boolean,
    current?: 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16,
    taskId?: string | number,
    playerId?: string
): RpioWritepadAction {
    return {
        group,
        slew,
        hysteresis,
        current,
        type: 'rpio_writepad',
        taskId,
        playerId,
    };
}

/**
 * Configure the pin's internal pullup or pulldown resistors.
 * @param pin The pin that you want to use.
 * @param state Configure the pin's resistors as: 'PULL_OFF', 'PULL_DOWN' or 'PULL_UP'
 * @param taskId The ID of the async task.
 */
export function rpioPudPin(
    pin: number,
    state: 'PULL_OFF' | 'PULL_DOWN' | 'PULL_UP',
    taskId?: string | number,
    playerId?: string
): RpioPudAction {
    return {
        pin,
        state,
        type: 'rpio_pud',
        taskId,
        playerId,
    };
}

/**
 * Watch `pin` for changes and execute the callback `cb()` on events.
 * @param pin The pin that you want to use.
 * @param cb The callback executed on events.
 * @param options Optional. Used to watch for specific events.
 * @param taskId The ID of the async task.
 */
export function rpioPollPin(
    pin: number,
    cb: any,
    options?: 'POLL_LOW' | 'POLL_HIGH' | 'POLL_BOTH',
    taskId?: string | number,
    playerId?: string
): RpioPollAction {
    return {
        pin,
        cb,
        options,
        type: 'rpio_poll',
        taskId,
        playerId,
    };
}

/**
 * Sends an event to the server to close a pin and what state to leave it in.
 * @param pin The physical pin number.
 * @param options The state to leave the pin in upon closing.
 * @param taskId The ID of the async task.
 */
export function rpioClosePin(
    pin: number,
    options?: 'PIN_RESET' | 'PIN_PRESERVE',
    taskId?: string | number,
    playerId?: string
): RpioCloseAction {
    return {
        type: 'rpio_close',
        pin,
        options,
        taskId,
        playerId,
    };
}

/**
 * Initializes i2c for use.
 * @param taskId The ID of the async task.
 */
export function rpioI2CBeginPin(
    taskId?: string | number,
    playerId?: string
): RpioI2CBeginAction {
    return {
        type: 'rpio_i2c_begin',
        taskId,
        playerId,
    };
}

/**
 * Configure the slave address.
 * @param address The slave address to set.
 * @param taskId The ID of the async task.
 */
export function rpioI2CSetSlaveAddressPin(
    address: number,
    taskId?: string | number,
    playerId?: string
): RpioI2CSetSlaveAddressAction {
    return {
        address,
        type: 'rpio_i2c_setslaveaddress',
        taskId,
        playerId,
    };
}

/**
 * Set the baud rate. Directly set the speed in hertz.
 * @param rate The i2c refresh rate in hertz.
 * @param taskId The ID of the async task.
 */
export function rpioI2CSetBaudRatePin(
    rate: number,
    taskId?: string | number,
    playerId?: string
): RpioI2CSetBaudRateAction {
    return {
        rate,
        type: 'rpio_i2c_setbaudrate',
        taskId,
        playerId,
    };
}

/**
 * Set the baud rate. Set it based on a divisor of the base 250MHz rate.
 * @param rate The i2c refresh rate based on a divisor of the base 250MHz rate.
 * @param taskId The ID of the async task.
 */
export function rpioI2CSetClockDividerPin(
    rate: number,
    taskId?: string | number,
    playerId?: string
): RpioI2CSetClockDividerAction {
    return {
        rate,
        type: 'rpio_i2c_setclockdivider',
        taskId,
        playerId,
    };
}

/**
 * Read from the i2c slave.
 * @param rx Buffer to read.
 * @param length Optional. Length of the buffer to read.
 * @param taskId The ID of the async task.
 */
export function rpioI2CReadPin(
    rx: number[],
    length?: number,
    taskId?: string | number,
    playerId?: string
): RpioI2CReadAction {
    return {
        rx,
        length,
        type: 'rpio_i2c_read',
        taskId,
        playerId,
    };
}

/**
 * Write to the i2c slave.
 * @param tx Buffer to write.
 * @param length Optional. Length of the buffer to write.
 * @param taskId The ID of the async task.
 */
export function rpioI2CWritePin(
    tx: number[],
    length?: number,
    taskId?: string | number,
    playerId?: string
): RpioI2CWriteAction {
    return {
        tx,
        length,
        type: 'rpio_i2c_write',
        taskId,
        playerId,
    };
}

/**
 *
 * @param taskId The ID of the async task.
 */
// export function rpioI2CReadRegisterRestartPin(
//     taskId?: string | number,
//     playerId?: string
// ): RpioI2CReadRegisterRestartAction {
//     return {
//         type: 'rpio_i2c_readregisterrestart',
//         taskId,
//         playerId,
//     };
// }

/**
 *
 * @param taskId The ID of the async task.
 */
// export function rpioI2CWriteReadRestartPin(
//     taskId?: string | number,
//     playerId?: string
// ): RpioI2CWriteReadRestartAction {
//     return {
//         type: 'rpio_i2c_writereadrestart',
//         taskId,
//         playerId,
//     };
// }

/**
 * Turn off the i²c interface and return the pins to GPIO.
 * @param taskId The ID of the async task.
 */
export function rpioI2CEndPin(
    taskId?: string | number,
    playerId?: string
): RpioI2CEndAction {
    return {
        type: 'rpio_i2c_end',
        taskId,
        playerId,
    };
}

/**
 * This is a power-of-two divisor of the base 19.2MHz rate, with a maximum value of 4096 (4.6875kHz).
 * @param rate The PWM refresh rate.
 * @param taskId The ID of the async task.
 */
export function rpioPWMSetClockDividerPin(
    rate: number,
    taskId?: string | number,
    playerId?: string
): RpioPWMSetClockDividerAction {
    return {
        type: 'rpio_pwm_setclockdivider',
        rate,
        taskId,
        playerId,
    };
}

/**
 * This determines the maximum pulse width.
 * @param pin The physical pin number.
 * @param range The PWM range for a pin.
 * @param taskId The ID of the async task.
 */
export function rpioPWMSetRangePin(
    pin: number,
    range: number,
    taskId?: string | number,
    playerId?: string
): RpioPWMSetRangeAction {
    return {
        pin,
        range,
        type: 'rpio_pwm_setrange',
        taskId,
        playerId,
    };
}

/**
 * Set the width for a given pin.
 * @param pin The physical pin number.
 * @param width The PWM width for a pin.
 * @param taskId The ID of the async task.
 */
export function rpioPWMSetDataPin(
    pin: number,
    width: number,
    taskId?: string | number,
    playerId?: string
): RpioPWMSetDataAction {
    return {
        pin,
        width,
        type: 'rpio_pwm_setdata',
        taskId,
        playerId,
    };
}

/**
 * Initiate SPI mode.
 * @param taskId The ID of the async task.
 */
export function rpioSPIBeginPin(
    taskId?: string | number,
    playerId?: string
): RpioSPIBeginAction {
    return {
        type: 'rpio_spi_begin',
        taskId,
        playerId,
    };
}

/**
 * Choose which of the chip select / chip enable pins to control.
 *  Value | Pin
 *  ------|---------------------
 *    0   | SPI_CE0 (24 / GPIO8)
 *    1   | SPI_CE1 (26 / GPIO7)
 *    2   | Both
 * @param value The value correlating to pin(s) to control.
 * @param taskId The ID of the async task.
 */
export function rpioSPIChipSelectPin(
    value: 0 | 1 | 2,
    taskId?: string | number,
    playerId?: string
): RpioSPIChipSelectAction {
    return {
        value,
        type: 'rpio_spi_chipselect',
        taskId,
        playerId,
    };
}

/**
 * If your device's CE pin is active high, use this to change the polarity.
 *  Value | Pin
 *  ------|---------------------
 *    0   | SPI_CE0 (24 / GPIO8)
 *    1   | SPI_CE1 (26 / GPIO7)
 *    2   | Both
 * @param value The value correlating to pin(s) to control.
 * @param polarity Set the polarity it activates on. HIGH or LOW
 * @param taskId The ID of the async task.
 */
export function rpioSPISetCSPolarityPin(
    value: 0 | 1 | 2,
    polarity: 'HIGH' | 'LOW',
    taskId?: string | number,
    playerId?: string
): RpioSPISetCSPolarityAction {
    return {
        value,
        polarity,
        type: 'rpio_spi_setcspolarity',
        taskId,
        playerId,
    };
}

/**
 * Set the SPI clock speed.
 * @param rate It is an even divisor of the base 250MHz rate ranging between 0 and 65536.
 * @param taskId The ID of the async task.
 */
export function rpioSPISetClockDividerPin(
    rate: number,
    taskId?: string | number,
    playerId?: string
): RpioSPISetClockDividerAction {
    return {
        rate,
        type: 'rpio_spi_setclockdivider',
        taskId,
        playerId,
    };
}

/**
 * Set the SPI Data Mode.
 *  Mode | CPOL | CPHA
 *  -----|------|-----
 *    0  |  0   |  0
 *    1  |  0   |  1
 *    2  |  1   |  0
 *    3  |  1   |  1
 * @param mode The SPI Data Mode.
 * @param taskId The ID of the async task.
 */
export function rpioSPISetDataModePin(
    mode: 0 | 1 | 2 | 3,
    taskId?: string | number,
    playerId?: string
): RpioSPISetDataModeAction {
    return {
        mode,
        type: 'rpio_spi_setdatamode',
        taskId,
        playerId,
    };
}

/**
 *
 * @param taskId The ID of the async task.
 */
export function rpioSPITransferPin(
    tx: number[],
    taskId?: string | number,
    playerId?: string
): RpioSPITransferAction {
    return {
        tx,
        type: 'rpio_spi_transfer',
        taskId,
        playerId,
    };
}

/**
 *
 * @param taskId The ID of the async task.
 */
export function rpioSPIWritePin(
    tx: number[],
    taskId?: string | number,
    playerId?: string
): RpioSPIWriteAction {
    return {
        tx,
        type: 'rpio_spi_write',
        taskId,
        playerId,
    };
}

/**
 * Release the pins back to general purpose use.
 * @param taskId The ID of the async task.
 */
export function rpioSPIEndPin(
    taskId?: string | number,
    playerId?: string
): RpioSPIEndAction {
    return {
        type: 'rpio_spi_end',
        taskId,
        playerId,
    };
}

/**
 */

/**
 * Establish the connection to the bluetooth serial device
 * @param name A friendly device name. Example: Brush01
 * @param path The device path. Example: /dev/rfcomm0
 * @param options
 * {boolean} [autoOpen=true] Automatically opens the port on `nextTick`.
 *
 * {number=} [baudRate=9600] The baud rate of the port to be opened. This should match one of the commonly available baud rates, such as 110, 300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, or 115200. Custom rates are supported best effort per platform. The device connected to the serial port is not guaranteed to support the requested baud rate, even if the port itself supports that baud rate.
 *
 * {number} [dataBits=8] Must be one of these: 8, 7, 6, or 5.
 *
 * {number} [highWaterMark=65536] The size of the read and write buffers defaults to 64k.
 *
 * {boolean} [lock=true] Prevent other processes from opening the port. Windows does not currently support `false`.
 *
 * {number} [stopBits=1] Must be one of these: 1 or 2.
 *
 * {string} [parity=none] Must be one of these: 'none', 'even', 'mark', 'odd', 'space'.
 *
 * {boolean} [rtscts=false] flow control setting
 *
 * {boolean} [xon=false] flow control setting
 *
 * {boolean} [xoff=false] flow control setting
 *
 * {boolean} [xany=false] flow control setting
 *
 * {object=} bindingOptions sets binding-specific options
 *
 * {Binding=} Binding The hardware access binding. `Bindings` are how Node-Serialport talks to the underlying system. Will default to the static property `Serialport.Binding`.
 *
 * {number} [bindingOptions.vmin=1] see [`man termios`](http://linux.die.net/man/3/termios) LinuxBinding and DarwinBinding
 *
 * {number} [bindingOptions.vtime=0] see [`man termios`](http://linux.die.net/man/3/termios) LinuxBinding and DarwinBinding
 * @param taskId The ID of the async task.
 */
export function serialConnectPin(
    name: string,
    device: string,
    mac: string,
    channel: number,
    options?: object,
    taskId?: string | number,
    playerId?: string
): SerialConnectAction {
    return {
        name,
        device,
        mac,
        channel,
        options,
        type: 'serial_connect',
        taskId,
        playerId,
    };
}

/**
 * Parses and returns the serial stream to the event tag 'onSerialData'.
 * @param bot The id of the bot you want data streamed to. The bot needs the 'onSerialData' tag.
 * @param name A friendly device name. Example: Brush01
 * @param taskId The ID of the async task.
 */
export function serialStreamPin(
    bot: string,
    name: string,
    taskId?: string | number,
    playerId?: string
): SerialStreamAction {
    return {
        bot,
        name,
        type: 'serial_stream',
        taskId,
        playerId,
    };
}

/**
 * Opens the serial connection if you set the option in serialConnect to {autoOpen: false}
 * @param name A friendly device name. Example: Brush01
 * @param taskId The ID of the async task.
 */
export function serialOpenPin(
    name: string,
    taskId?: string | number,
    playerId?: string
): SerialOpenAction {
    return {
        name,
        type: 'serial_open',
        taskId,
        playerId,
    };
}

/**
 * Updates the SerialPort object with a new baudRate.
 * @param name A friendly device name. Example: Brush01
 * @param options {number=} [baudRate=9600] The baud rate of the port to be opened. This should match one of the commonly available baud rates, such as 110, 300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, or 115200. Custom rates are supported best effort per platform. The device connected to the serial port is not guaranteed to support the requested baud rate, even if the port itself supports that baud rate.
 * @param cb
 * @param taskId The ID of the async task.
 */
export function serialUpdatePin(
    name: string,
    options: object,
    cb?: any,
    taskId?: string | number,
    playerId?: string
): SerialUpdateAction {
    return {
        name,
        options,
        cb,
        type: 'serial_update',
        taskId,
        playerId,
    };
}

/**
 * Writes the provided data/command to the device
 * @param name A friendly device name. Example: Brush01
 * @param data The data/command to send
 * @param encoding The encoding, if chunk is a string. Defaults to 'utf8'. Also accepts 'utf16le', 'latin1', 'ascii', 'base64', 'binary', 'ucs2', and 'hex'
 * @param cb
 * @param taskId The ID of the async task.
 */
export function serialWritePin(
    name: string,
    data: string | number[],
    encoding?: string,
    cb?: any,
    taskId?: string | number,
    playerId?: string
): SerialWriteAction {
    return {
        name,
        data,
        encoding,
        cb,
        type: 'serial_write',
        taskId,
        playerId,
    };
}

/**
 * Request a number of bytes from the SerialPort.
 * @param name A friendly device name. Example: Brush01
 * @param size Specify how many bytes of data to return, if available.
 * @param taskId The ID of the async task.
 */
export function serialReadPin(
    name: string,
    size?: number,
    taskId?: string | number,
    playerId?: string
): SerialReadAction {
    return {
        name,
        size,
        type: 'serial_read',
        taskId,
        playerId,
    };
}

/**
 * Closes an open connection.
 * @param name A friendly device name. Example: Brush01
 * @param cb
 * @param device The device path. Example: /dev/rfcomm0
 * @param taskId The ID of the async task.
 */
export function serialClosePin(
    name: string,
    device: string,
    cb?: any,
    taskId?: string | number,
    playerId?: string
): SerialCloseAction {
    return {
        name,
        device,
        cb,
        type: 'serial_close',
        taskId,
        playerId,
    };
}

/**
 * Flush discards data that has been received but not read, or written but not transmitted by the operating system.
 * @param name A friendly device name. Example: Brush01
 * @param taskId The ID of the async task.
 */
export function serialFlushPin(
    name: string,
    taskId?: string | number,
    playerId?: string
): SerialFlushAction {
    return {
        name,
        type: 'serial_flush',
        taskId,
        playerId,
    };
}

/**
 * Waits until all output data is transmitted to the serial port. After any pending write has completed, it calls `tcdrain()` or `FlushFileBuffers()` to ensure it has been written to the device.
 * @param name A friendly device name. Example: Brush01
 * @param taskId The ID of the async task.
 */
export function serialDrainPin(
    name: string,
    taskId?: string | number,
    playerId?: string
): SerialDrainAction {
    return {
        name,
        type: 'serial_drain',
        taskId,
        playerId,
    };
}

/**
 * Causes a stream in flowing mode to stop emitting 'data' events, switching out of flowing mode. Any data that becomes available remains in the internal buffer.
 * @param name A friendly device name. Example: Brush01
 * @param taskId The ID of the async task.
 */
export function serialPausePin(
    name: string,
    taskId?: string | number,
    playerId?: string
): SerialPauseAction {
    return {
        name,
        type: 'serial_pause',
        taskId,
        playerId,
    };
}

/**
 * Causes an explicitly paused, Readable stream to resume emitting 'data' events, switching the stream into flowing mode.
 * @param name A friendly device name. Example: Brush01
 * @param taskId The ID of the async task.
 */
export function serialResumePin(
    name: string,
    taskId?: string | number,
    playerId?: string
): SerialResumeAction {
    return {
        name,
        type: 'serial_resume',
        taskId,
        playerId,
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
 * Creates a ShowUploadFilesAction.
 */
export function showUploadFiles(
    taskId: number | string
): ShowUploadFilesAction {
    return {
        type: 'show_upload_files',
        taskId,
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
 * @param inst The instance that the mark should be restored to. If not specified, then the current instance will be used.
 */
export function restoreHistoryMark(
    mark: string,
    inst?: string
): RestoreHistoryMarkAction {
    if (!inst) {
        return {
            type: 'restore_history_mark',
            mark,
        };
    } else {
        return {
            type: 'restore_history_mark',
            mark,
            inst,
        };
    }
}

/**
 * Loads a space into the instance.
 * @param space The space to load.
 * @param config The config which specifies how the space should be loaded.
 * @param taskId The ID of the async task.
 */
export function loadSpace(
    space: BotSpace,
    config: any,
    taskId?: number | string
): LoadSpaceAction {
    return {
        type: 'load_space',
        space,
        config,
        taskId,
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
 * Creates a new ARSupportedAction.
 * @param taskId The ID of the async task.
 */
export function arSupported(taskId?: number | string): ARSupportedAction {
    return {
        type: 'ar_supported',
        taskId,
    };
}

/**
 * Creates a new VRSupportedAction.
 * @param taskId The ID of the async task.
 */
export function vrSupported(taskId?: number | string): VRSupportedAction {
    return {
        type: 'vr_supported',
        taskId,
    };
}

/**
 * Creates a EnablePOVAction that enables point-of-view mode.
 * @param center
 * @returns
 */
export function enablePOV(
    center: {
        x: number;
        y: number;
        z: number;
    },
    imu?: boolean
): EnablePOVAction {
    return {
        type: 'enable_pov',
        enabled: true,
        center,
        imu,
    };
}

/**
 * Creates a EnablePOVAction that disables point-of-view mode.
 */
export function disablePOV(): EnablePOVAction {
    return {
        type: 'enable_pov',
        enabled: false,
    };
}

/**
 * Creates a ShowJoinCodeAction.
 * @param inst The instance to link to.
 * @param dimension The dimension to link to.
 */
export function showJoinCode(
    inst?: string,
    dimension?: string
): ShowJoinCodeAction {
    return {
        type: 'show_join_code',
        inst,
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
 * @param taskId The ID of the async task for this action.
 */
export function loadBots(
    space: string,
    tags: TagFilter[],
    taskId?: number | string
): LoadBotsAction {
    return {
        type: 'load_bots',
        space: space,
        tags: tags,
        taskId,
    };
}

/**
 * Requests that all the bots in the given space be cleared.
 *
 * Only supported for the following spaces:
 * - error
 *
 * @param space The space to clear.
 * @param taskId The ID of the async task.
 */
export function clearSpace(
    space: string,
    taskId?: number | string
): ClearSpaceAction {
    return {
        type: 'clear_space',
        space: space,
        taskId,
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
 * Requests that the given new password be used to unlock the space for editing.
 *
 * Only supported for the following spaces:
 * - admin
 *
 * @param space The space to unlock.
 * @param oldPassword The old password.
 * @param newPassword The new password to use to unlock the space.
 * @param taskId The ID of the task that this event represents.
 */
export function setSpacePassword(
    space: BotSpace,
    oldPassword: string,
    newPassword: string,
    taskId?: number | string
): SetSpacePasswordAction {
    return {
        type: 'set_space_password',
        space,
        oldPassword,
        newPassword,
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
 * Requests that the given bot be tweened to the given position using the given easing.
 * @param botId The ID of the bot.
 * @param dimension The dimension that the bot should be tweened in.
 * @param position The position of the bot.
 * @param easing The easing to use.
 * @param duration The duration of the tween in seconds.
 */
export function localPositionTween(
    botId: string,
    dimension: string,
    position: { x?: number; y?: number; z?: number },
    easing: Easing = { type: 'linear', mode: 'inout' },
    duration: number = 1,
    taskId?: string | number
): LocalPositionTweenAction {
    return {
        type: 'local_tween',
        tweenType: 'position',
        botId,
        dimension,
        easing,
        position,
        duration: clamp(duration, 0, MAX_TWEEN_DURATION),
        taskId,
    };
}

/**
 * Requests that the given bot be tweened to the given rotation using the given easing.
 * @param botId The ID of the bot.
 * @param dimension The dimension that the bot should be tweened in.
 * @param position The position of the bot.
 * @param easing The easing to use.
 * @param duration The duration of the tween in seconds.
 *
 */
export function localRotationTween(
    botId: string,
    dimension: string,
    rotation: { x?: number; y?: number; z?: number },
    easing: Easing = { type: 'linear', mode: 'inout' },
    duration: number = 1,
    taskId?: string | number
): LocalRotationTweenAction {
    return {
        type: 'local_tween',
        tweenType: 'rotation',
        botId,
        dimension,
        easing,
        rotation,
        duration: clamp(duration, 0, MAX_TWEEN_DURATION),
        taskId,
    };
}

/**
 * Enqueues an async result to the given list for the given event.
 * @param list The list to add the result to.
 * @param event The event that the result is for.
 * @param result The result.
 * @param mapBots Whether the result should have the argument mapped for bots.
 */
export function enqueueAsyncResult(
    list: Action[],
    event: AsyncAction,
    result: any,
    mapBots?: boolean
) {
    if (hasValue(event.taskId)) {
        if (hasValue(event.playerId)) {
            list.push(
                remoteResult(
                    result,
                    {
                        sessionId: event.playerId,
                    },
                    event.taskId
                )
            );
        } else {
            list.push(asyncResult(event.taskId, result, mapBots));
        }
    }
}

/**
 * Enqueues an async error to the given list for the given event.
 * @param list The list to add the error to.
 * @param event The event that the error is for.
 * @param error The error.
 */
export function enqueueAsyncError(
    list: Action[],
    event: AsyncAction,
    error: any
) {
    if (hasValue(event.taskId)) {
        if (hasValue(event.playerId)) {
            list.push(
                remoteError(
                    error,
                    {
                        sessionId: event.playerId,
                    },
                    event.taskId
                )
            );
        } else {
            list.push(asyncError(event.taskId, error));
        }
    }
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

/**
 * Creates an action that opens/closes the circle wipe display element.
 * @param open Whether the circle wipe should transition to open or closed.
 * @param options The options that the circle wipe should use.
 * @param taskId The ID of the task.
 */
export function circleWipe(
    open: boolean,
    options: OpenCircleWipeOptions,
    taskId?: number | string
): OpenCircleWipeAction {
    return {
        type: 'show_circle_wipe',
        open,
        options,
        taskId,
    };
}

/**
 * Creates a AddDropSnapTargetsAction.
 * @param botId The ID of the bot.
 * @param targets The list of snap targets to add.
 */
export function addDropSnap(
    botId: string,
    targets: SnapTarget[]
): AddDropSnapTargetsAction {
    return {
        type: 'add_drop_snap_targets',
        botId,
        targets,
    };
}

/**
 * Creates a EnableCustomDraggingAction.
 */
export function enableCustomDragging(): EnableCustomDraggingAction {
    return {
        type: 'enable_custom_dragging',
    };
}

/**
 * Creates an action that registers a portal that is builtin.
 * This instructs the runtime to create a portal bot if one has not already been created.
 * @param portalId The ID of the portal.
 */
export function registerBuiltinPortal(
    portalId: string
): RegisterBuiltinPortalAction {
    return {
        type: 'register_builtin_portal',
        portalId,
    };
}

/**
 * Creates an action that registers the given script prefix for custom portals.
 * @param prefix The prefix that should be used.
 * @param taskId The ID of the task.
 */
export function registerPrefix(
    prefix: string,
    options: RegisterPrefixOptions,
    taskId?: number | string
): RegisterPrefixAction {
    return {
        type: 'register_prefix',
        prefix,
        options,
        taskId,
    };
}

/**
 * Creates an action that requests a new certificate be created.
 * @param options The options.
 * @param taskId The ID of the task.
 */
export function createCertificate(
    options: CreateCertificateOptions,
    taskId?: number | string
): CreateCertificateAction {
    return {
        type: 'create_certificate',
        ...options,
        taskId,
    };
}

/**
 * Creates an action that requests a tag on a bot be signed.
 * @param signingBotId The ID of the certificate bot that is creating the signature.
 * @param signingPassword The password used to decrypt the certificate's private key.
 * @param botId The ID of the bot whose tag is being signed.
 * @param tag The tag that is being signed.
 * @param value The value that is being signed.
 */
export function signTag(
    signingBotId: string,
    signingPassword: string,
    botId: string,
    tag: string,
    value: any,
    taskId?: number | string
): SignTagAction {
    return {
        type: 'sign_tag',
        signingBotId,
        signingPassword,
        botId,
        tag,
        value,
        taskId,
    };
}

/**
 * Creates an action that requests that a certificate be revoked.
 * @param signingBotId The ID of the certificate that is signing the revocation.
 * @param signingPassword The password used to decrypt the signing certificate's private key.
 * @param certificateBotId The ID of the bot whose tag is being signed.
 * @param taskId The task ID.
 */
export function revokeCertificate(
    signingBotId: string,
    signingPassword: string,
    certificateBotId: string,
    taskId?: number | string
): RevokeCertificateAction {
    return {
        type: 'revoke_certificate',
        signingBotId,
        signingPassword,
        certificateBotId,
        taskId,
    };
}

/**
 * Creates a BeginAudioRecordingAction.
 * @param options The options for the audio recording.
 * @param taskId The task ID.
 */
export function beginAudioRecording(
    options: Omit<BeginAudioRecordingAction, 'type' | 'taskId'>,
    taskId?: string | number
): BeginAudioRecordingAction {
    return {
        type: 'begin_audio_recording',
        ...options,
        taskId,
    };
}

/**
 * Creates a EndAudioRecordingAction.
 * @param taskId The task ID.
 */
export function endAudioRecording(
    taskId?: string | number
): EndAudioRecordingAction {
    return {
        type: 'end_audio_recording',
        taskId,
    };
}

/**
 * Creates a BeginRecordingAction.
 * @param options The options for the recording.
 * @param taskId The task ID.
 */
export function beginRecording(
    options: RecordingOptions,
    taskId?: string | number
): BeginRecordingAction {
    return {
        type: 'begin_recording',
        ...options,
        taskId,
    };
}

/**
 * Creates a EndRecordingAction.
 * @param taskId The task ID.
 */
export function endRecording(taskId?: string | number): EndRecordingAction {
    return {
        type: 'end_recording',
        taskId,
    };
}

/**
 * Creates a SpeakTextAction.
 * @param text The text that should be spoken.
 * @param options The options that should be used.
 * @param taskId The ID of the task.
 */
export function speakText(
    text: string,
    options: SpeakTextOptions,
    taskId?: string | number
): SpeakTextAction {
    return {
        type: 'speak_text',
        text,
        ...options,
        taskId,
    };
}

/**
 * Creates a GetVoicesAction.
 * @param taskId The task ID.
 */
export function getVoices(taskId?: string | number): GetVoicesAction {
    return {
        type: 'get_voices',
        taskId,
    };
}

/**
 * Creates a GetGeolocationAction.
 * @param taskId The ID of the task.
 */
export function getGeolocation(taskId?: string | number): GetGeolocationAction {
    return {
        type: 'get_geolocation',
        taskId,
    };
}

/**
 * Creates a GoToTagAction.
 * @param botId The ID of the bot.
 * @param tag The tag to navigate to.
 */
export function goToTag(
    botId: string,
    tag: string,
    space: string = null
): GoToTagAction {
    return {
        type: 'go_to_tag',
        botId,
        tag,
        space,
    };
}

/**
 * Creates a RegisterCustomAppAction.
 * @param appId The Id of the app.
 * @param botId The ID of the bot.
 */
export function registerCustomApp(
    appId: string,
    botId: string,
    taskId?: string | number
): RegisterCustomAppAction {
    return {
        type: 'register_custom_app',
        appId,
        botId,
        taskId,
    };
}

/**
 * Creates a UnegisterCustomAppAction.
 * @param appId The Id of the app.
 * @param botId The ID of the bot.
 */
export function unregisterCustomApp(
    appId: string,
    taskId?: string | number
): UnregisterCustomAppAction {
    return {
        type: 'unregister_custom_app',
        appId,
        taskId,
    };
}

/**
 * Creates a SetAppOutputAction.
 * @param appId The ID of the app.
 * @param output The output that the app should display.
 */
export function setAppOutput(appId: string, output: any): SetAppOutputAction {
    return {
        type: 'set_app_output',
        uncopiable: true,
        appId,
        output,
    };
}

/**
 * Creates a RegisterHtmlAppAction.
 */
export function registerHtmlApp(
    appId: string,
    instanceId: string,
    taskId?: string | number
): RegisterHtmlAppAction {
    return {
        type: 'register_html_app',
        appId,
        instanceId,
        taskId,
    };
}

/**
 * Creates a UnregisterHtmlAppAction.
 */
export function unregisterHtmlApp(
    appId: string,
    instanceId: string
): UnregisterHtmlAppAction {
    return {
        type: 'unregister_html_app',
        appId,
        instanceId,
    };
}

/**
 * Creates a UpdateHtmlAppAction.
 */
export function updateHtmlApp(
    appId: string,
    updates: SerializableMutationRecord[]
): UpdateHtmlAppAction {
    return {
        type: 'update_html_app',
        appId,
        updates,
    };
}

/**
 * Creates a HtmlAppEventAction.
 * @param appId The ID of the portal.
 * @param event The event that occurred.
 */
export function htmlAppEvent(appId: string, event: any): HtmlAppEventAction {
    return {
        type: 'html_app_event',
        appId,
        event,
    };
}

/**
 * Creates a RequestAuthDataAction.
 */
export function requestAuthData(
    taskId?: string | number
): RequestAuthDataAction {
    return {
        type: 'request_auth_data',
        taskId,
    };
}

/**
 * Creates a DefineGlobalBotAction.
 */
export function defineGlobalBot(
    name: string,
    botId: string,
    taskId?: string | number
): DefineGlobalBotAction {
    return {
        type: 'define_global_bot',
        name,
        botId,
        taskId,
    };
}

/**
 * Creates a ConvertGeolocationToWhat3WordsAction.
 * @param options The options.
 * @param taskId The ID of the async task.
 */
export function convertGeolocationToWhat3Words(
    options: ConvertGeolocationToWhat3WordsOptions,
    taskId: number | string
): ConvertGeolocationToWhat3WordsAction {
    return {
        type: 'convert_geolocation_to_w3w',
        ...options,
        taskId,
    };
}

/**
 * Creates a GetPublicRecordKeyAction.
 * @param recordName The name of the record.
 * @param taskId The ID of the task.
 */
export function getPublicRecordKey(
    recordName: string,
    taskId: number | string
): GetPublicRecordKeyAction {
    return {
        type: 'get_public_record_key',
        recordName,
        taskId,
    };
}

/**
 * Creates a RecordDataAction.
 * @param recordKey The key that should be used to access the record.
 * @param address The address that the data should be stored at in the record.
 * @param data The data to store.
 * @param requiresApproval Whether to try to record data that requires approval.
 * @param taskId The ID of the task.
 */
export function recordData(
    recordKey: string,
    address: string,
    data: any,
    requiresApproval: boolean,
    taskId: number | string
): RecordDataAction {
    return {
        type: 'record_data',
        recordKey,
        address,
        data,
        requiresApproval,
        taskId,
    };
}

/**
 * Creates a GetRecordDataAction.
 * @param recordName The name of the record to retrieve.
 * @param address The address of the data to retrieve.
 * @param requiresApproval Whether to try to get a record that requires manual approval.
 * @param taskId The ID of the task.
 */
export function getRecordData(
    recordName: string,
    address: string,
    requiresApproval: boolean,
    taskId?: number | string
): GetRecordDataAction {
    return {
        type: 'get_record_data',
        recordName,
        address,
        requiresApproval,
        taskId,
    };
}

/**
 * Creates a EraseRecordDataAction.
 * @param recordKey The key that should be used to access the record.
 * @param address The address of the data to erase.
 * @param requiresApproval Whether to try to erase a record that requires manual approval.
 * @param taskId The ID of the task.
 */
export function eraseRecordData(
    recordKey: string,
    address: string,
    requiresApproval: boolean,
    taskId?: number | string
): EraseRecordDataAction {
    return {
        type: 'erase_record_data',
        recordKey,
        address,
        requiresApproval,
        taskId,
    };
}

/**
 * Approves the given data record action and returns a new action that has been approved.
 * @param action The action to approve.
 */
export function approveDataRecord<T extends DataRecordAction>(action: T): T {
    return {
        ...action,
        [APPROVED_SYMBOL]: true,
    };
}

/**
 * Creates a RecordFileAction.
 * @param recordKey The key that should be used to access the record.
 * @param data The data to store.
 * @param description The description of the file.
 * @param mimeType The MIME type of the file.
 */
export function recordFile(
    recordKey: string,
    data: any,
    description: string,
    mimeType: string,
    taskId?: number | string
): RecordFileAction {
    return {
        type: 'record_file',
        recordKey,
        data,
        description,
        mimeType,
        taskId,
    };
}

/**
 * Creates a EraseFileAction.
 * @param recordKey The key that should be used to access the record.
 * @param fileUrl The URL that the file was stored at.
 * @param taskId The ID of the task.
 */
export function eraseFile(
    recordKey: string,
    fileUrl: string,
    taskId?: number | string
): EraseFileAction {
    return {
        type: 'erase_file',
        recordKey,
        fileUrl,
        taskId,
    };
}
