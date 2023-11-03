import {
    PartialBot,
    BotsState,
    Bot,
    BotTags,
    BotSpace,
    PortalType,
} from './Bot';
import { clamp } from '../utils';
import { hasValue } from './BotCalculations';
import { InstUpdate } from './StoredAux';
import {
    DeviceAction,
    RemoteAction,
    RemoteActionError,
    RemoteActionResult,
    DeviceActionResult,
    DeviceActionError,
    Action,
    DeviceSelector,
    remoteError,
    remoteResult,
    RemoteActions,
} from '../common';

/**
 * Defines a symbol that can be used to signal to the runtime that the action should not be mapped for bots.
 */
export const UNMAPPABLE = Symbol('UNMAPPABLE');

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
    | ShowInputForTagAction
    | SetForcedOfflineAction
    | ShellAction
    | OpenConsoleAction
    | DownloadAction
    | PasteStateAction
    | ReplaceDragBotAction
    | SetClipboardAction
    | ShowChatBarAction
    | ShowUploadAuxFileAction
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
    | UnregisterHtmlAppAction
    | AddDropGridTargetsAction
    | CustomAppContainerAvailableAction;

/**
 * Defines a set of possible async action types.
 */
export type AsyncActions =
    | AsyncResultAction
    | AsyncErrorAction
    | ShowInputAction
    | ShowConfirmAction
    | ShareAction
    | ImportAUXAction
    | RegisterBuiltinPortalAction
    | RegisterPrefixAction
    | RunScriptAction
    | LoadBotsAction
    | ClearSpaceAction
    | SendWebhookAction
    | AnimateTagAction
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
    | ARSupportedAction
    | VRSupportedAction
    | MediaPermissionAction
    | GetAverageFrameRateAction
    | OpenImageClassifierAction
    | MeetCommandAction
    | MeetFunctionAction
    | ShowTooltipAction
    | HideTooltipAction
    | RaycastFromCameraAction
    | RaycastInPortalAction
    | CalculateRayFromCameraAction
    | BufferFormAddressGLTFAction
    | StartFormAnimationAction
    | StopFormAnimationAction
    | ListFormAnimationsAction
    | ConfigureWakeLockAction
    | GetWakeLockConfigurationAction
    | AnalyticsRecordEventAction
    | HtmlAppMethodCallAction
    | OpenPhotoCameraAction
    | EnableCollaborationAction;

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
    /**
     * The message that should be shown.
     */
    message: string | number | boolean | object | Array<any> | null;

    /**
     * The duration for the message in miliseconds.
     */
    duration: number;
}

/**
 * An event that is used to show a tooltip message to the user.
 */
export interface ShowTooltipAction extends AsyncAction {
    type: 'show_tooltip';

    /**
     * The message that should be shown.
     */
    message: string | number | boolean | object | Array<any> | null;

    /**
     * The X coodinate of the pixel position that the tip should be shown at.
     * If null, then the current pointer position should be used or the center of the screen if on mobile.
     */
    pixelX: number | null;

    /**
     * The Y coordinate of the pixel position that the tip should be shown at.
     * If null, then the current pointer position should be used or the center of the screen if on mobile.
     */
    pixelY: number | null;

    /**
     * The number of miliseconds that the tip should be shown for.
     */
    duration: number;
}

/**
 * An event that is used to hide tooltip messages.
 */
export interface HideTooltipAction extends AsyncAction {
    type: 'hide_tooltip';

    /**
     * The IDs of the tooltips that should be hidden.
     * If null, then all tooltips will be hidden.
     */
    tooltipIds: number[] | null;
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
 * Options for {@link os.focusOn-bot}, and {@link os.focusOn-position} actions.
 *
 * @dochash types/os
 * @docname FocusOnOptions
 */
export interface FocusOnOptions {
    /*
     * The zoom value to use.
     * For the bot and miniGridPortals, possible values are between `0` and `80`. `1` is the default.
     * For the map portal, this is the scale that the focused point should appear at.
     * For example, 24000 would indicate that the scale is 1:24,000.
     * If no value is specified, then the zoom will remain at its current value.
     */
    zoom?: number;

    /*
     * The rotation value to use in radians.
     * These are the polar coordinates that determine where
     * the camera should orbit around the target point.
     */
    rotation?: FocusOnRotation;

    /**
     * The duration in seconds that the animation should take.
     * Defaults to 1.
     */
    duration?: number;

    /**
     * The options for easing.
     * Can be an "easing type" or an object that specifies the type and mode.
     * If an easing type is specified, then "inout" mode is used.
     * If omitted, then "quadratic" "inout" is used.
     */
    easing?: EaseType | Easing;

    /**
     * The tag that should be focused.
     * Only supported in the system portal.
     */
    tag?: string;

    /**
     * The tag space that should be focused.
     * Only supported in the system portal, sheet portal, and tag portals.
     */
    space?: string;

    /**
     * The line number that should be selected in the editor.
     * Only supported in the system portal, sheet portal, and tag portals.
     */
    lineNumber?: number;

    /**
     * The column number that should be selected in the editor.
     * Only supported in the system portal, sheet portal, and tag portals.
     */
    columnNumber?: number;

    /**
     * The index of the first character that should be selected.
     * Only supported in the system portal, sheet portal, and tag portals.
     */
    startIndex?: number;

    /**
     * The index of the last character that should be selected.
     * Only supported in the system portal, sheet portal, and tag portals.
     */
    endIndex?: number;

    /**
     * The portal that the bot should be focused in.
     * If not specified, then the bot will be focused in all the portals it is in. (bot, mini and menu)
     * Useful if a bot is in two portals but you only want to focus it in one portal.
     */
    portal?: PortalType;
}

/**
 * Defines an interface that represents a rotation in polar coordinates for use with {@link os.focusOn-bot}.
 *
 * @dochash types/os
 * @docname FocusOnRotation
 */
export interface FocusOnRotation {
    x: number;
    y: number;

    /**
     * Whether to normalize the rotation. Normalized rotations are clamped to between 0 and Math.PI*2.
     * You can set this to false to allow using angles more than Math.PI*2. This would allow the camera to rotate around an object multiple times.
     * Defaults to true.
     */
    normalize?: boolean;
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
        z?: number;
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
 *
 * @dochash types/os
 * @docname CameraType
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

    /**
     * Whether to not allow switching the camera.
     */
    disallowSwitchingCameras: boolean;
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

    /**
     * Whether to not allow switching the camera.
     */
    disallowSwitchingCameras: boolean;
}

/**
 * An event that is used to show or hide the photo camera.
 */
export interface OpenPhotoCameraAction extends AsyncAction {
    type: 'open_photo_camera';

    /**
     * Whether the photo camera should be visible.
     */
    open: boolean;

    /**
     * Whether only a single photo should be taken.
     */
    singlePhoto: boolean;

    /**
     * The options for the action.
     */
    options: OpenPhotoCameraOptions;
}

/**
 * Defines a photo that was taken.
 *
 * @dochash types/camera
 * @docname Photo
 */
export interface Photo {
    /**
     * The photo data.
     */
    data: Blob;

    /**
     * The width of the photo in pixels.
     */
    width: number;

    /**
     * The height of the photo in pixels.
     */
    height: number;
}

/**
 * Options for {@link os.openPhotoCamera}.
 *
 * @dochash types/camera
 * @doctitle Camera Types
 * @docsidebar Camera
 * @docdescription Types that are used in camera actions.
 * @docname PhotoCameraOptions
 */
export interface OpenPhotoCameraOptions {
    /**
     * The camera that should be used.
     */
    cameraType?: CameraType;

    /**
     * Whether to not allow switching the camera.
     */
    disallowSwitchingCameras?: boolean;

    /**
     * The image format that should be used.
     *
     * Defaults to "png".
     */
    imageFormat?: 'png' | 'jpeg';

    /**
     * A number between 0 and 1 indicating the image quality to be used.
     *
     * If not specified, then the browser will use its own default.
     */
    imageQuality?: number;

    /**
     * Whether to skip allowing the user to confirm their photo.
     *
     * Defaults to false.
     */
    skipConfirm?: boolean;

    /**
     * Whether to automatically take a photo after a number of seconds.
     *
     * If null, then there is no timer and the user is allowed to take the photo manually.
     * If positive, then the timer will start counting down from the given number of seconds.
     * The user can always cancel the operation manually.
     */
    takePhotoAfterSeconds?: number;

    /**
     * The ideal resolution for the photo to be taken at.
     *
     * If specified, then the web browser will be told to prefer this resolution, but will use a lower resolution if
     * it is not possible to use the ideal resolution.
     */
    idealResolution?: {
        /**
         * The width of the photo in pixels.
         */
        width: number;

        /**
         * The height of the photo in pixels.
         */
        height: number;
    };

    /**
     * Whether to mirror the photo after it is taken.
     *
     * Defaults to false.
     */
    mirrorPhoto?: boolean;
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
 *
 * @dochash types/os
 * @docname BarcodeFormat
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
 * An event that is used to show or hide an image classifier on screen.
 */
export interface OpenImageClassifierAction
    extends AsyncAction,
        ImageClassifierOptions {
    type: 'show_image_classifier';

    /**
     * Whether the image classifier should be visible.
     */
    open: boolean;
}

/**
 * Defines an interface that represents a set of options for {@link os.openImageClassifier}.
 *
 * @dochash types/os
 * @docname ImageClassifierOptions
 */
export interface ImageClassifierOptions {
    /**
     * The URL that the model should be loaded from.
     */
    modelUrl?: string;

    /**
     * The URL that the model JSON should be loaded from.
     * Not required. Can be used if you are storing the model JSON in a custom location.
     */
    modelJsonUrl?: string;

    /**
     * The URL that the model metadata should be loaded from.
     * Not required. Can be used if you are storing the model metadata in a custom location.
     */
    modelMetadataUrl?: string;

    /**
     * The camera that should be used for the image classifier.
     */
    cameraType?: CameraType;
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
export interface ImportAUXAction extends AsyncAction {
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
 * Defines an event that is used to get the player count.
 */
export interface GetRemoteCountAction extends Action {
    type: 'get_remote_count';

    /**
     * The name of the record.
     */
    recordName?: string | null;

    /**
     * The instance that the device count should be retrieved for.
     * If omitted, then the total device count will be returned.
     */
    inst?: string;

    /**
     * The name of the branch.
     */
    branch?: string;
}
/**
 * Defines an event that is used to get the list of remote devices on the instance.
 */
export interface GetRemotesAction extends Action {
    type: 'get_remotes';
}

/**
 * Defines an event that is used to get the list of bot updates on the instance.
 */
export interface ListInstUpdatesAction extends Action {
    type: 'list_inst_updates';
}

/**
 * Defines an event that is used to get the state of the inst with a particular set of updates.
 */
export interface GetInstStateFromUpdatesAction extends Action {
    type: 'get_inst_state_from_updates';

    /**
     * The list of updates to use.
     */
    updates: InstUpdate[];
}

/**
 * Defines an event that is used to create an initialization update for a given list of bots.
 */
export interface CreateInitializationUpdateAction extends Action {
    type: 'create_initialization_update';

    /**
     * The bots that should be encoded into the state update.
     */
    bots: Bot[];
}

/**
 * Defines an event that applies the given updates to the inst.
 */
export interface ApplyUpdatesToInstAction extends Action {
    type: 'apply_updates_to_inst';

    /**
     * The updates that should be applied.
     */
    updates: InstUpdate[];
}

/**
 * Defines an event that is used to get the current inst update.
 */
export interface GetCurrentInstUpdateAction extends Action {
    type: 'get_current_inst_update';
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
 * Defines an event that is used to show a confirmation dialog.
 */
export interface ShowConfirmAction extends AsyncAction {
    type: 'show_confirm';

    /**
     * The options for the confirmation dialog.
     */
    options: ShowConfirmOptions;
}

/**
 * Defines an interface that represents the options that can be used for a confirmation dialog.
 *
 * @dochash types/os
 * @docname ShowConfirmOptions
 */
export interface ShowConfirmOptions {
    /**
     * The title that should be shown for the dialog.
     */
    title: string;

    /**
     * The content of the dialog.
     */
    content: string;

    /**
     * The text that should be shown on the "Confirm" button.
     */
    confirmText?: string;

    /**
     * The text that should be shown on the "Cancel" button.
     */
    cancelText?: string;
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
 *
 * @dochash types/os
 * @docname ShowInputOptions
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

    /**
     * The list of items that should be displayed.
     */
    items?: ShowInputItem[];
}

export interface ShowInputItem {
    label: string;
    value: any;
}

/**
 * Defines the possible input types.
 */
export type ShowInputType = 'text' | 'color' | 'secret' | 'date' | 'list';

/**
 * Defines the possible input types.
 */
export type ShowInputSubtype =
    | 'basic'
    | 'swatch'
    | 'advanced'
    | 'select'
    | 'multiSelect'
    | 'radio'
    | 'checkbox';

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
 *
 * @dochash types/os
 * @docname ShowChatOptions
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
 * An event that is used to enable collaboration features.
 *
 * @dochash types/os
 * @docname EnableCollaborationAction
 */
export interface EnableCollaborationAction extends AsyncAction {
    type: 'enable_collaboration';
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

/**
 * The possible easing types.
 * @dochash types/animation
 * @docname EaseType
 */
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

/**
 * The possible easing modes.
 * @dochash types/animation
 * @docname EaseMode
 */
export type EaseMode = 'in' | 'out' | 'inout';

/**
 * Defines an interface that represents easing types.
 *
 * @example Create an object that represents "quadratic" "inout" easing
 * let easing = {
 *    type: "quadratic",
 *    mode: "inout"
 * };
 *
 * @dochash types/animation
 * @docname Easing
 */
export interface Easing {
    /**
     * The type of easing to use.
     */
    type: EaseType;

    /**
     * The mode of easing to use.
     */
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
 * Defines an interface that represents the options that an EnableARAction or EnableVRAction can have.
 *
 * @dochash types/os
 * @docname EnableXROptions
 */
export interface EnableXROptions {
    /**
     * The frame buffer scale factor that should be used for the XR session.
     * (see https://developer.mozilla.org/en-US/docs/Web/API/XRWebGLLayer/getNativeFramebufferScaleFactor)
     * - Null or undefined indicates that the default should be used. (usually 1)
     * - A number indicates the ratio of frame buffer pixels to output pixels. (e.g. a value of 2 will cause every 2 frame buffer pixels to be correlated with 1 output pixel, meaning that the render resolution is doubled)
     * - "recommended" indicates that CasualOS should try to pick the optimal number.
     */
    frameBufferScaleFactor?: number | 'recommended';
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

    /**
     * The additional options that should be used.
     */
    options: EnableXROptions;
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

    /**
     * The additional options that should be used.
     */
    options: EnableXROptions;
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
 *
 * @dochash types/os
 * @docname ShareOptions
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
 * Defines an event that registers a custom app container.
 */
export interface CustomAppContainerAvailableAction extends Action {
    type: 'custom_app_container_available';
}

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

    [UNMAPPABLE]: true;
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
 * Defines an event that represents a method call that was dispatched from HTML in a portal.
 */
export interface HtmlAppMethodCallAction extends AsyncAction {
    type: 'html_app_method_call';

    /**
     * The ID of the app.
     */
    appId: string;

    /**
     * The ID of the node that the method was called on.
     */
    nodeId: string;

    /**
     * The name of the method.
     */
    methodName: string;

    /**
     * The arguments that the method was called with.
     */
    args: any[];
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
 *
 * @dochash types/core
 * @docname RegisterPrefixOptions
 */
export interface RegisterPrefixOptions {
    /**
     * The possible languages that prefixes can use.
     */
    language?: 'javascript' | 'typescript' | 'json' | 'jsx' | 'tsx' | 'text';

    /**
     * The name of the prefix.
     */
    name?: string;
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
 * Defines a base interface for actions that can add drop snap points.
 */
export interface AddDropSnapAction extends Action {
    /**
     * The ID of the bot that, when it is a drop target, the snap points should be enabled.
     * If null, then the targets apply globally during the drag operation.
     */
    botId?: string;
}

/**
 * An event that is used to add some snap points for a drag operation.
 */
export interface AddDropSnapTargetsAction extends AddDropSnapAction {
    type: 'add_drop_snap_targets';

    /**
     * The list of snap targets that should be used.
     */
    targets: SnapTarget[];
}

/**
 * Defines an interface that represents a snap point.
 * That is, a point in 3D space with an associated snap distance.
 *
 * @dochash types/os
 * @docgroup 10-snap
 * @docorder 1
 * @docname SnapPoint
 */
export interface SnapPoint {
    /**
     * The 3D position for the point.
     *
     * @docsource Vector3
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
 *
 * @dochash types/os
 * @docgroup 10-snap
 * @docorder 2
 * @docname SnapAxis
 */
export interface SnapAxis {
    /**
     * The 3D direction that the axis ray travels along.
     *
     * @docsource Vector3
     */
    direction: { x: number; y: number; z: number };

    /**
     * The 3D position that the ray starts at.
     *
     * @docsource Vector3
     */
    origin: { x: number; y: number; z: number };

    /**
     * The distance from the ray line that the snap point should take effect at.
     */
    distance: number;
}

/**
 * The list of possible snap targets.
 * - `"ground"` means that the dragged bot should snap to the ground plane. This option is overriden by "grid".
 * - `"grid"` means that the dragged bot should snap to grid tiles.
 * - `"face"` means that the dragged bot should snap to other bot faces.
 * - `"bots"` means that the dragged bot will snap to other bots.
 *
 * @dochash types/os
 * @docgroup 10-snap
 * @docorder 0
 * @docname SnapTarget
 */
export type SnapTarget =
    | 'ground'
    | 'grid'
    | 'face'
    | 'bots'
    | SnapPoint
    | SnapAxis;

/**
 * An event that is used to add grids as possible drop locations for a drag operation.
 */
export interface AddDropGridTargetsAction extends AddDropSnapAction {
    type: 'add_drop_grid_targets';

    /**
     * The list of grids that bots should be snapped to.
     */
    targets: SnapGrid[];
}

/**
 * Defines an interface that represents a snap grid.
 * That is, a 2D plane that is segmented into discrete sections.
 */
export interface SnapGrid {
    /**
     * The 3D position of the grid.
     * If not specified, then 0,0,0 is used.
     */
    position?: { x: number; y: number; z: number };

    /**
     * The 3D rotation of the grid.
     * If not specified, then the identity rotation is used.
     */
    rotation?: { x: number; y: number; z: number; w?: number };

    /**
     * The ID of the bot that defines the portal that this grid should use.
     * If not specifed, then the config bot is used.
     */
    portalBotId?: string;

    /**
     * The tag that contains the portal dimension.
     * If a portalBotId is specified, then this defaults to formAddress.
     * If a portalBotId is not specified, then this defaults to gridPortal.
     */
    portalTag?: string;

    /**
     * The priority that the snap grid has.
     * Higher numbers mean higher priority.
     */
    priority?: number;

    /**
     * The bounds that the snap grid has.
     * If not specified, then default bounds are used.
     */
    bounds?: { x: number; y: number };

    /**
     * Whether to visualize the grid when dragging bots around.
     * Defaults to false.
     */
    showGrid?: boolean;

    /**
     * The type of grid that this snap grid should be.
     * Defaults to the type of grid that the portal bot uses.
     *
     * - "grid" indicates that the snap target should be a flat grid.
     * - "sphere" indicates that the snap target should be a sphere.
     */
    type?: 'grid' | 'sphere';
}

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
 *
 * @dochash types/experimental
 * @doctitle Experimental Types
 * @docsidebar Experimental
 * @docdescription Defines the types that are used by experimental actions.
 * @docname RecordingOptions
 */
export interface RecordingOptions {
    /**
     * Whether to record audio.
     *
     * If the computer does not have an audio device attached, then setting this to true
     * will cause an error.
     *
     * If an array is specified, only the specified audio sources will be recorded.
     *
     * Defaults to true.
     */
    audio: boolean | ('screen' | 'microphone')[];

    /**
     * Whether to record video.
     *
     * If the computer does not have a video device attached (like a web cam),
     * then setting this to true will cause an error.
     *
     * Defaults to true.
     */
    video: boolean;

    /**
     * Whether to record the screen.
     *
     * Defaults to false.
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

/**
 * An event that is used to send a command to the Jitsi Meet API.
 */
export interface MeetCommandAction extends AsyncAction {
    type: 'meet_command';

    /**
     * The name of the command to execute.
     */
    command: string;

    /**
     * The arguments for the command (if any).
     */
    args?: any[];
}

/**
 * An event that is used to call Jitsi Meet functions.
 */
export interface MeetFunctionAction extends AsyncAction {
    type: 'meet_function';

    /**
     * The name of the function to execute.
     */
    functionName: string;

    /**
     * The arguments for the function (if any).
     */
    args?: any[];
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
 *
 * @dochash types/experimental
 * @docname SyntheticVoice
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

/**
 * Defines the possible geolocation results.
 *
 * @dochash types/os
 * @doctitle OS Types
 * @docsidebar OS
 * @docdescription Defines the types that are used by OS actions.
 * @docgroup 01-geo
 * @docorder 0
 * @docname Geolocation
 */
export type Geolocation = SuccessfulGeolocation | UnsuccessfulGeolocation;

/**
 * Defines an interface that represents a successful geolocation result.
 *
 * @dochash types/os
 * @docgroup 01-geo
 * @docorder 1
 * @docname SuccessfulGeolocation
 */
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

/**
 * Defines an interface that represents an unsuccessful geolocation result.
 *
 * @dochash types/os
 * @docgroup 01-geo
 * @docorder 2
 * @docname UnsuccessfulGeolocation
 */
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
 * Defines an interface that contains recorded data.
 *
 * @dochash types/experimental
 * @docname Recording
 */
export interface Recording {
    /**
     * The list of files that were produced when recording.
     */
    files: RecordedFile[];
}

/**
 * Defines an interface that represents a recorded file.
 *
 * @dochash types/experimental
 * @docname RecordedFile
 */
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
     * The display name of the user.
     */
    displayName: string;

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

    /**
     * Whether the user has an active subscription to the beta program.
     */
    hasActiveSubscription: boolean;

    /**
     * The subscription tier that is currently active for the user.
     */
    subscriptionTier: string | null;
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
 * Defines an interface that represents options for converting a geolocation to a what3words address.
 *
 * @dochash types/os
 * @docgroup 01-geo
 * @docorder 3
 * @docname ConvertGeolocationToWhat3WordsOptions
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
 * Defines an interface that represents options for requesting media permissions.
 *
 * @dochash types/os
 * @docname MediaPermissionOptions
 */
export interface MediaPermssionOptions {
    /**
     * Should include audio permission.
     */
    audio?: boolean;

    /**
     * Should include video permission.
     */
    video?: boolean;
}

/**
 * Defines an event that gets permission for audio and/or video.
 */
export interface MediaPermissionAction
    extends AsyncAction,
        MediaPermssionOptions {
    type: 'media_permission';
}

/**
 * Defines an event that retrieves the current average frame rate.
 */
export interface GetAverageFrameRateAction extends AsyncAction {
    type: 'get_average_frame_rate';
}

/**
 * Defines an event that performs a raycast from the camera in the given portal.
 */
export interface RaycastFromCameraAction extends AsyncAction {
    type: 'raycast_from_camera';

    /**
     * The portal that the raycast should be performed in.
     */
    portal: CameraPortal;

    /**
     * The viewport coordinates that the raycast should be at.
     */
    viewportCoordinates: Point2D;
}

/**
 * Defines an event that performs a raycast for the given ray in the given portal.
 */
export interface RaycastInPortalAction extends AsyncAction {
    type: 'raycast_in_portal';

    /**
     * The portal that the raycast should be performed in.
     */
    portal: CameraPortal;

    /**
     * The 3D position that the raycast should be performed at.
     */
    origin: Point3D;

    /**
     * The 3D direction that the raycast should be performed in.
     */
    direction: Point3D;
}

/**
 * Defines an event that calculates a ray for the given portal from the given viewport coordinates.
 */
export interface CalculateRayFromCameraAction extends AsyncAction {
    type: 'calculate_camera_ray';

    /**
     * The portal that the ray should be calculated for.
     */
    portal: CameraPortal;

    /**
     * The viewport coordinates that the ray should be calculated at.
     */
    viewportCoordinates: Point2D;
}

/**
 * Defines an event that requests the pre-caching of a GLTF mesh.
 */
export interface BufferFormAddressGLTFAction extends AsyncAction {
    type: 'buffer_form_address_gltf';

    /**
     * The address that should be buffered.
     */
    address: string;
}

/**
 * Defines an interface that contains a bunch of options for starting an animation.
 *
 * @dochash types/os
 * @docname StartFormAnimationOptions
 */
export interface StartFormAnimationOptions {
    /**
     * The Unix time in miliseconds that the animation should start at.
     */
    startTime?: number;

    /**
     * The time within the animation clip that the animation should start at in miliseconds.
     */
    initialTime?: number;

    /**
     * The rate at which the animation plays.
     * 1 means the animation plays normally.
     * 2 means the animation plays 2x as quickly.
     * 0 means that the animation is paused.
     */
    timeScale?: number;

    /**
     * The options for looping the animation.
     * If omitted, then the animation will play once and finish.
     */
    loop?: {
        /**
         * The looping mode that should be used.
         */
        mode: 'repeat' | 'pingPong';

        /**
         * The number of times that the animation should repeat for.
         */
        count: number;
    };

    /**
     * Whether the final animation values should be preserved when the animation finishes.
     */
    clampWhenFinished?: boolean;

    /**
     * The number of miliseconds that the animation should take to cross fade from the previous animation.
     * If null, then this animation takes over immediately. Additionally, if no previous animation was playing then this animation takes over immediately.
     */
    crossFadeDuration?: number;

    /**
     * Whether to warp animation values during a cross fade.
     */
    crossFadeWarp?: boolean;

    /**
     * The number of miliseconds that the animation should take to fade in.
     * If null, then the animation will not fade in.
     */
    fadeDuration?: number;

    /**
     * The address that the animations should be loaded from.
     */
    animationAddress?: string;
}

/**
 * Defines an event that starts a given animation on a bot/bots.
 */
export interface StartFormAnimationAction
    extends AsyncAction,
        StartFormAnimationOptions {
    type: 'start_form_animation';

    /**
     * The list of bot IDs that the animation should be run for.
     */
    botIds: string[];

    /**
     * The name or index of the animation that should be started.
     */
    nameOrIndex: string | number;
}

/**
 * Defines an interface that contains a bunch of options for stopping an animation.
 *
 * @dochash types/os
 * @docname StopFormAnimationOptions
 */
export interface StopFormAnimationOptions {
    /**
     * The Unix time in miliseconds that the animation should be stopped at.
     */
    stopTime?: number;

    /**
     * The number of miliseconds that the animation should take to fade out.
     * If null, then the animation will stop immediately.
     */
    fadeDuration?: number;
}

/**
 * Defines an event that stops an animation on a bot/bots.
 */
export interface StopFormAnimationAction
    extends AsyncAction,
        StopFormAnimationOptions {
    type: 'stop_form_animation';

    /**
     * The list of Bot IDs that the animation should be stopped on.
     */
    botIds: string[];
}

/**
 * Defines an event that retrieves a list of animations for a given form or bot.
 */
export interface ListFormAnimationsAction extends AsyncAction {
    type: 'list_form_animations';

    /**
     * The address that the animations should be retrieved from.
     */
    address: string;
}

/**
 * Defines an interface that contains animation information.
 *
 * @dochash types/os
 * @docname FormAnimationData
 */
export interface FormAnimationData {
    /**
     * The name of the animation.
     */
    name: string;

    /**
     * The index that the animation is at.
     */
    index: number;

    /**
     * The duration of the animation in miliseconds.
     */
    duration: number;
}

export type CameraPortal = 'grid' | 'miniGrid' | 'map' | 'miniMap';

export interface Point2D {
    x: number;
    y: number;
}

export interface Point3D {
    x: number;
    y: number;
    z: number;
}

/**
 * An event that is used to enable/disable wake lock.
 */
export interface ConfigureWakeLockAction extends AsyncAction {
    type: 'configure_wake_lock';

    /**
     * Whether the wake lock should be enabled.
     */
    enabled: boolean;
}

/**
 * An event that is used to retrieve the current wake lock configuration.
 */
export interface GetWakeLockConfigurationAction extends AsyncAction {
    type: 'get_wake_lock_configuration';
}

/**
 * Defines an interface that represents a wake lock configuration.
 */
export interface WakeLockConfiguration {
    /**
     * Whether the wake lock is enabled.
     */
    enabled: boolean;
}

/**
 * An action that is used to record an event for analytics.
 */
export interface AnalyticsRecordEventAction extends AsyncAction {
    type: 'analytics_record_event';

    /**
     * The name of the event.
     */
    name: string;

    /**
     * The metadata for the event.
     */
    metadata: any;
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
    botIds: string[] | null = null,
    userId: string | null = null,
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
 * Creates a new ShowTooltipAction.
 * @param message The message to show with the event.
 * @param pixelX The X coordinate that the tooltip should be shown at. If null, then the current pointer position will be used.
 * @param pixelY The Y coordinate that the tooltip should be shown at. If null, then the current pointer position will be used.
 * @param duration The duration that the tooltip should be shown in miliseconds.
 * @param taskId The ID of the async task.
 */
export function tip(
    message: string | number | boolean | object | Array<any> | null,
    pixelX: number | null,
    pixelY: number | null,
    duration: number,
    taskId?: string | number
): ShowTooltipAction {
    return {
        type: 'show_tooltip',
        message,
        pixelX,
        pixelY,
        duration,
        taskId,
    };
}

/**
 * Creates a HideTooltipAction.
 * @param ids The IDs of the tooltips that should be hidden. If null, then all tooltips will be hidden.
 * @param taskId The ID of the async task.
 */
export function hideTips(
    tooltipIds: number[] | null,
    taskId?: string | number
): HideTooltipAction {
    return {
        type: 'hide_tooltip',
        tooltipIds,
        taskId,
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
    position: { x: number; y: number; z?: number },
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
        disallowSwitchingCameras: false,
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
        disallowSwitchingCameras: false,
    };
}

/**
 * Creates a new OpenPhotoCameraAction.
 * @param open Whether the barcode scanner should be open or closed.
 * @param singlePhoto Whether only a single photo should be taken.
 * @param cameraType The camera type that should be used.
 */
export function openPhotoCamera(
    open: boolean,
    singlePhoto: boolean,
    options?: OpenPhotoCameraOptions,
    taskId?: string | number
): OpenPhotoCameraAction {
    return {
        type: 'open_photo_camera',
        open: open,
        singlePhoto,
        options: options ?? {},
        taskId,
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
 * Creates a new OpenImageClassifierAction.
 * @param open Whether the image classifier should be opened or closed.
 * @param options The options for the classifier.
 * @param taskId The ID of the async task.
 */
export function openImageClassifier(
    open: boolean,
    options: ImageClassifierOptions,
    taskId?: number | string
): OpenImageClassifierAction {
    return {
        type: 'show_image_classifier',
        open,
        ...options,
        taskId,
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
 * @param taskId The ID of the async task.
 */
export function importAUX(
    url: string,
    taskId?: string | number
): ImportAUXAction {
    return {
        type: 'import_aux',
        url: url,
        taskId,
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
 * Creates a new ShowConfirmAction.
 * @param options The options for the action.
 * @param taskId The ID of the async task.
 */
export function showConfirm(
    options: ShowConfirmOptions,
    taskId?: number | string
): ShowConfirmAction {
    return {
        type: 'show_confirm',
        options,
        taskId,
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
 * Creates a new GetRemoteCountAction.
 * @param inst The instance that the device count should be retrieved for.
 */
export function getRemoteCount(
    recordName?: string | null,
    inst?: string | null,
    branch?: string | null
): GetRemoteCountAction {
    if (hasValue(inst)) {
        return {
            type: 'get_remote_count',
            recordName,
            inst,
            branch,
        };
    } else {
        return {
            type: 'get_remote_count',
        };
    }
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
 * Creates a new ListInstUpdatesAction.
 */
export function listInstUpdates(): ListInstUpdatesAction {
    return {
        type: 'list_inst_updates',
    };
}

/**
 * Creates a new GetInstStateFromUpdatesAction.
 * @param updates The list of updates to use.
 */
export function getInstStateFromUpdates(
    updates: InstUpdate[]
): GetInstStateFromUpdatesAction {
    return {
        type: 'get_inst_state_from_updates',
        updates,
    };
}

/**
 * Creates a new CreateInitializationUpdateAction.
 * @param bots The bots that should be encoded into the update.
 * @param taskId The ID of the task.
 */
export function createInitializationUpdate(
    bots: Bot[]
): CreateInitializationUpdateAction {
    return {
        type: 'create_initialization_update',
        bots,
    };
}

/**
 * Creates a new ApplyUpdatesToInstAction.
 * @param updates The list of updates that should be applied.
 * @param taskId The ID of the task.
 */
export function applyUpdatesToInst(
    updates: InstUpdate[]
): ApplyUpdatesToInstAction {
    return {
        type: 'apply_updates_to_inst',
        updates,
    };
}

/**
 * Creates a new GetCurrentInstUpdateAction.
 */
export function getCurrentInstUpdate(): GetCurrentInstUpdateAction {
    return {
        type: 'get_current_inst_update',
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
 * Creates a EnableCollaborationAction.
 * @param taskId The ID of the async task.
 */
export function enableCollaboration(
    taskId?: number | string
): EnableCollaborationAction {
    return {
        type: 'enable_collaboration',
        taskId,
    };
}

/**
 * Creates a EnableARAction.
 */
export function enableAR(options: EnableXROptions = {}): EnableARAction {
    return {
        type: 'enable_ar',
        enabled: true,
        options,
    };
}

/**
 * Creates a EnableVRAction.
 */
export function enableVR(options: EnableXROptions = {}): EnableVRAction {
    return {
        type: 'enable_vr',
        enabled: true,
        options,
    };
}

/**
 * Creates a EnableARAction that disables AR.
 */
export function disableAR(): EnableARAction {
    return {
        type: 'enable_ar',
        enabled: false,
        options: {},
    };
}

/**
 * Creates a EnableVRAction that disables VR.
 */
export function disableVR(): EnableVRAction {
    return {
        type: 'enable_vr',
        enabled: false,
        options: {},
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
 * Creates a AddDropGridTargetsAction.
 * @param botId The ID of the bot.
 * @param targets The list of snap targets to add.
 */
export function addDropGrid(
    botId: string,
    targets: SnapGrid[]
): AddDropGridTargetsAction {
    return {
        type: 'add_drop_grid_targets',
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
 * Creates a MeetCommandAction.
 * @param command The name of the command to execute.
 * @param args The arguments for the command.
 */
export function meetCommand(
    command: string,
    args: any[],
    taskId?: string | number
): MeetCommandAction {
    return {
        type: 'meet_command',
        command,
        args,
        taskId,
    };
}

/**
 * Creates a MeetFunctionAction.
 * @param functionName The name of the function.
 * @param args The arguments for the function.
 * @param taskId The ID of the async task.
 */
export function meetFunction(
    functionName: string,
    args: any[],
    taskId?: string | number
): MeetFunctionAction {
    return {
        type: 'meet_function',
        functionName,
        args,
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

export function customAppContainerAvailable(): CustomAppContainerAvailableAction {
    return {
        type: 'custom_app_container_available',
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
        [UNMAPPABLE]: true,
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
 * Creates a HtmlAppMethodCallAction.
 * @param appId The ID of the app.
 * @param nodeId The ID of the node.
 * @param methodName The name of the method that should be called.
 * @param args The arguments to pass to the method.
 * @param taskId The ID of the async task.
 */
export function htmlAppMethod(
    appId: string,
    nodeId: string,
    methodName: string,
    args: any[],
    taskId?: string | number
): HtmlAppMethodCallAction {
    return {
        type: 'html_app_method_call',
        appId,
        nodeId,
        methodName,
        args,
        taskId,
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

export interface ApprovableAction {
    /**
     * Whether this action has been manually approved.
     *
     * Uses a symbol to ensure that it cannot be copied across security boundaries.
     * As a result, it should be impossible to generate actions that are pre-approved.
     */
    [APPROVED_SYMBOL]?: boolean;
}

/**
 * Approves the given data record action and returns a new action that has been approved.
 * @param action The action to approve.
 */
export function approveAction<T extends ApprovableAction>(action: T): T {
    return {
        ...action,
        [APPROVED_SYMBOL]: true,
    };
}

/**
 * Creates a new MediaPermissionAction
 * @param options The options.
 * @param taskId The ID of the async task.
 */
export function getMediaPermission(
    options: MediaPermssionOptions,
    taskId?: number | string
): MediaPermissionAction {
    return {
        type: 'media_permission',
        ...options,
        taskId,
    };
}

/**
 * Creates a new GetAverageFrameRateAction.
 * @param taskId The ID of the async task.
 */
export function getAverageFrameRate(
    taskId?: number | string
): GetAverageFrameRateAction {
    return {
        type: 'get_average_frame_rate',
        taskId,
    };
}

/**
 * Creates a new RaycastFromCameraAction.
 * @param portal The portal that the raycast should occur in.
 * @param viewportCoordinates The point on the viewport that the raycast should be sent from.
 * @param taskId The ID of the task.
 */
export function raycastFromCamera(
    portal: CameraPortal,
    viewportCoordinates: Point2D,
    taskId?: number | string
): RaycastFromCameraAction {
    return {
        type: 'raycast_from_camera',
        portal,
        viewportCoordinates,
        taskId,
    };
}

/**
 * Creates a new RaycastInPortalAction.
 * @param portal The portal that the raycast should occur in.
 * @param origin The 3D point that the ray should start at.
 * @param direction The 3D direction that the ray should move in.
 * @param taskId The ID of the task.
 */
export function raycastInPortal(
    portal: CameraPortal,
    origin: Point3D,
    direction: Point3D,
    taskId?: number | string
): RaycastInPortalAction {
    return {
        type: 'raycast_in_portal',
        portal,
        origin,
        direction,
        taskId,
    };
}

/**
 * Creates a new CalculateRayFromCameraAction.
 * @param portal The portal that the ray should be calcualted for.
 * @param viewportCoordinates The point on the viewport that the calculated ray should be sent from.
 * @param taskId The ID of the task.
 */
export function calculateRayFromCamera(
    portal: CameraPortal,
    viewportCoordinates: Point2D,
    taskId?: number | string
): CalculateRayFromCameraAction {
    return {
        type: 'calculate_camera_ray',
        portal,
        viewportCoordinates,
        taskId,
    };
}

/**
 * Creates a new BufferFormAddressGLTFAction.
 * @param address The address that should be cached.
 * @param taskId The ID of the async task.
 */
export function bufferFormAddressGltf(
    address: string,
    taskId?: number | string
): BufferFormAddressGLTFAction {
    return {
        type: 'buffer_form_address_gltf',
        address,
        taskId,
    };
}

/**
 * Creates a new StartFormAnimationAction.
 * @param botIds The IDs of the bots that the animation should be started for.
 * @param nameOrIndex The name of the animation.
 * @param options The options that should be used for the animation.
 * @param taskId The ID of the async task.
 */
export function startFormAnimation(
    botIds: string[],
    nameOrIndex: string | number,
    options: StartFormAnimationOptions,
    taskId?: number | string
): StartFormAnimationAction {
    return {
        type: 'start_form_animation',
        botIds,
        nameOrIndex,
        ...options,
        taskId,
    };
}

/**
 * Creates a new StopFormAnimationAction.
 * @param botIds The IDs of the bots that the animation should be stopped on.
 * @param options The options that should be used.
 * @param taskId The ID of the async task.
 */
export function stopFormAnimation(
    botIds: string[],
    options: StopFormAnimationOptions,
    taskId?: number | string
): StopFormAnimationAction {
    return {
        type: 'stop_form_animation',
        botIds,
        ...options,
        taskId,
    };
}

export function listFormAnimations(
    address: string,
    taskId?: number | string
): ListFormAnimationsAction {
    return {
        type: 'list_form_animations',
        address,
        taskId,
    };
}

/**
 * Creates a new ConfigureWakeLockAction.
 * @param enabled Whether the wake lock should be enabled.
 * @param taskId The ID of the async task.
 */
export function configureWakeLock(
    enabled: boolean,
    taskId?: number | string
): ConfigureWakeLockAction {
    return {
        type: 'configure_wake_lock',
        enabled,
        taskId,
    };
}

/**
 * Creates a GetWakeLockConfigurationAction.
 * @param taskId The ID of the async task.
 */
export function getWakeLockConfiguration(
    taskId?: number | string
): GetWakeLockConfigurationAction {
    return {
        type: 'get_wake_lock_configuration',
        taskId,
    };
}

/**
 * Creates a AnalyticsRecordEventAction.
 * @param name The name of the event that should be recorded.
 * @param metadata The metadata that should be recorded with the event.
 * @param taskId The ID of the async task.
 */
export function analyticsRecordEvent(
    name: string,
    metadata: any,
    taskId?: number | string
): AnalyticsRecordEventAction {
    return {
        type: 'analytics_record_event',
        name,
        metadata,
        taskId,
    };
}
