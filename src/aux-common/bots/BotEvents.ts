/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    PartialBot,
    BotsState,
    Bot,
    BotTags,
    BotSpace,
    PortalType,
} from './Bot';
import { clamp } from '../utils';
import { hasValue } from './BotCalculations';
import type { InstUpdate, StoredAux } from './StoredAux';
import type {
    DeviceAction,
    RemoteAction,
    RemoteActionError,
    RemoteActionResult,
    DeviceActionResult,
    DeviceActionError,
    Action,
    SimpleVersionNumber,
} from '../common';
import { remoteError, remoteResult } from '../common';

/**
 * Defines a symbol that can be used to signal to the runtime that the action should not be mapped for bots.
 */
export const UNMAPPABLE = Symbol('UNMAPPABLE');

export type LocalActions = BotActions | ExtraActions | AsyncActions;

/**
 * Defines a union type for all the possible common events.
 *
 * @dochash types/os/event
 * @docname BotAction
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
    | TrackConfigBotTagsAction
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
    | CustomAppContainerAvailableAction
    | LoadServerConfigAction
    | UnloadServerConfigAction;

/**
 * Defines a set of possible async action types.
 */
export type AsyncActions =
    | AsyncResultAction
    | AsyncErrorAction
    | IterableNextAction
    | IterableCompleteAction
    | IterableThrowAction
    | ShowInputAction
    | ShowAlertAction
    | ShowConfirmAction
    | ShareAction
    | ImportAUXAction
    | RegisterBuiltinPortalAction
    | RegisterPrefixAction
    | RunScriptAction
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
    | AddBotMapLayerAction
    | RemoveBotMapLayerAction
    | GetVoicesAction
    | GetGeolocationAction
    | RegisterCustomAppAction
    | UnregisterCustomAppAction
    | RegisterHtmlAppAction
    | ReportInstAction
    | RequestAuthDataAction
    | SignOutAction
    | DefineGlobalBotAction
    | ConvertGeolocationToWhat3WordsAction
    | ARSupportedAction
    | VRSupportedAction
    | MediaPermissionAction
    | GetAverageFrameRateAction
    | OpenImageClassifierAction
    | ClassifyImagesAction
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
    | EnableCollaborationAction
    | GetRecordsEndpointAction
    | ShowAccountInfoAction
    | LDrawCountBuildStepsAction
    | CalculateViewportCoordinatesFromPositionAction
    | CalculateScreenCoordinatesFromViewportCoordinatesAction
    | CalculateViewportCoordinatesFromScreenCoordinatesAction
    | CapturePortalScreenshotAction
    | CreateStaticHtmlAction
    | RecordLoomAction
    | WatchLoomAction
    | GetLoomMetadataAction
    | GetScriptIssuesAction
    | LoadSharedDocumentAction
    | CalculateScreenCoordinatesFromPositionAction
    | AddMapLayerAction
    | RemoveMapLayerAction
    | HideLoadingScreenAction
    | GenerateQRCodeAction
    | ConfigureTypeCheckingAction;

export type RemoteBotActions =
    | GetRemoteCountAction
    | ListInstUpdatesAction
    | GetInstStateFromUpdatesAction
    | CreateInitializationUpdateAction
    | ApplyUpdatesToInstAction
    | GetCurrentInstUpdateAction
    | InstallAuxAction;

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
 * Defines an action that supplies a next iterable value for an AsyncAction.
 */
export interface IterableNextAction extends AsyncAction {
    type: 'iterable_next';

    /**
     * The value.
     */
    value: any;

    /**
     * Whether to map any bots found in the result to their actual bot counterparts.
     * Defaults to false.
     */
    mapBotsInValue?: boolean;
}

/**
 * Defines an action that completes an iterable.
 */
export interface IterableCompleteAction extends AsyncAction {
    type: 'iterable_complete';
}

/**
 * Defines an action that supplies an error for an iterable.
 */
export interface IterableThrowAction extends AsyncAction {
    type: 'iterable_throw';

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
 * @docname TransactionAction
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
 * @docname PasteStateOptions
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
 * @docname PasteStateAction
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
 * @docname ReplaceDragBotAction
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
 * @docname ShellAction
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
 * @dochash types/os/portals
 * @docname ShowToastAction
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
 * @dochash types/os/portals
 * @docname ShowTooltipAction
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
 * @dochash types/os/portals
 * @docname HideTooltipAction
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
 * @dochash types/os/portals
 * @docname ShowHtmlAction
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
 * @dochash types/os/portals
 * @docname HideHtmlAction
 */
export interface HideHtmlAction extends Action {
    type: 'show_html';
    visible: false;
}

/**
 * The options for configuring TypeScript type checking in the Monaco editor.
 * @dochash types/os/system
 * @docname ConfigureTypeCheckingOptions
 */
export interface ConfigureTypeCheckingOptions {
    /**
     * Options for the Monaco editor's TypeScript diagnostic settings.
     */
    editorDiagnosticOptions?: {
        /**
         * Whether to disable semantic validation (type checking).
         * When true, TypeScript semantic errors will not be shown.
         */
        noSemanticValidation?: boolean;

        /**
         * Whether to disable syntax validation.
         * When true, TypeScript syntax errors will not be shown.
         */
        noSyntaxValidation?: boolean;
    };
}

/**
 * An event that is used to configure TypeScript type checking in the Monaco editor.
 * @dochash types/os/system
 * @docname ConfigureTypeCheckingAction
 */
export interface ConfigureTypeCheckingAction extends AsyncAction {
    type: 'configure_type_checking';

    /**
     * The configuration options for type checking.
     */
    options: ConfigureTypeCheckingOptions;
}

/**
 * Options for {@link os.focusOn-bot}, and {@link os.focusOn-position} actions.
 *
 * @dochash types/os/camera
 * @doctitle Camera Types
 * @docsidebar Camera
 * @docdescription Types that are used in camera actions.
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
 * @dochash types/os/camera
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
 * @docname FocusOnBotAction
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
 * @docname FocusOnPositionAction
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
 * @docname CancelAnimationAction
 */
export interface CancelAnimationAction extends AsyncAction {
    type: 'cancel_animation';
}

/**
 * The possible camera types.
 *
 * @dochash types/os/camera
 * @docname CameraType
 */
export type CameraType = 'front' | 'rear';

/**
 * An event that is used to show or hide the QR Code Scanner.
 * @docname OpenQRCodeScannerAction
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
 * @docname OpenBarcodeScannerAction
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
 * @docname OpenPhotoCameraAction
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
 * @dochash types/os/system
 * @docname OpenConsoleAction
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
 *
 * @dochash types/os/barcodes
 * @docname ShowQRCodeAction
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
 * An event that is used to generate a QR Code as a [data URL image](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs).
 *
 * @dochash types/os/barcodes
 * @docname GenerateQRCodeAction
 */
export interface GenerateQRCodeAction extends AsyncAction {
    type: 'generate_qr_code';

    /**
     * The code to generate.
     */
    code: string;

    /**
     * The options for generating the QR code.
     */
    options?: GenerateQRCodeOptions;
}

/**
 * The options that can be used when generating a QR code.
 *
 * @dochash types/os/barcodes
 * @docname GenerateQRCodeOptions
 */
export interface GenerateQRCodeOptions {
    /**
     * The error correction level to use for the QR code.
     *
     * Defaults to 'medium'.
     *
     * 'low' - 7% of codewords can be restored.
     * 'medium' - 15% of codewords can be restored.
     * 'quartile' - 25% of codewords can be restored.
     * 'high' - 30% of codewords can be restored.
     */
    errorCorrectionLevel?: 'low' | 'medium' | 'quartile' | 'high';

    /**
     * The image format that should be used for the generated QR code.
     *
     * @see https://www.the-qrcode-generator.com/blog/qr-code-quiet-zone
     */
    imageFormat?: 'image/jpeg' | 'image/webp' | 'image/png';

    /**
     * The QR Code version to use.
     * Must be between 1 and 40.
     *
     * Higher values store more data, lower values store less data.
     *
     * Defaults to automatic selection based on the length of the code.
     *
     * @see https://www.qrcode.com/en/about/version.html
     */
    version?: number;

    /**
     * The mask pattern to use for the QR Code.
     *
     * Must be between 0 and 7.
     *
     * If not specified, then the best mask pattern will be chosen automatically.
     *
     * @see https://stackoverflow.com/a/68280826/1832856
     */
    maskPattern?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

    /**
     * The scale factor that the QR code should have.
     * That is, how many pixels each module (black or white dot) should be.
     * A value of `1` means `1px` per modules (black dots).
     *
     * Defaults to 4
     */
    scale?: number;

    /**
     * Defines how wide the quiet zone should be around the QR code.
     *
     * Defaults to `4`.
     */
    margin?: number;

    /**
     * The width of the generated QR code in pixels. Defaults to generating the smallest code that can fit the data.
     *
     * If both width and scale are specified, then width takes precedence.
     * If the code is too small to fit the code with the given width, then the width will be increased to fit.
     *
     * Defaults to `256`.
     */
    width?: number;

    /**
     * The color options for the QR Code.
     */
    color?: QRCodeColorOptions;
}

/**
 * The color options for a QR Code.
 *
 * @dochash types/os/barcodes
 * @docname QRCodeColorOptions
 */
export interface QRCodeColorOptions {
    /**
     * The color of dark modules. Must be in hex RGBA format.
     *
     * Defaults to `#000000ff` (black).
     */
    dark?: string;

    /**
     * The color of light modules. Must be in hex RGBA format.
     *
     * Defaults to `#ffffffff` (white).
     */
    light?: string;
}

/**
 * The list of possible barcode formats.
 *
 * @dochash types/os/barcodes
 * @doctitle Barcode Types
 * @docsidebar Barcodes
 * @docdescription Types that are used in barcode actions.
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
 * @docname ShowBarcodeAction
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
 * @docname OpenImageClassifierAction
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
 * @dochash types/os/image-classification
 * @doctitle Image Classifier Types
 * @docsidebar Image Classifier
 * @docdescription Types that are used in image classifier actions.
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

export interface ClassifyImagesAction
    extends AsyncAction,
        ClassifyImagesOptions {
    type: 'classify_images';
}

export interface ClassifyImagesOptions {
    /**
     * The URL the the teachable machine model is available at.
     */
    modelUrl?: string;

    /**
     * The URL that the teachable machine model JSON is available at.
     * Not required if modelUrl is provided.
     */
    modelJsonUrl?: string;

    /**
     * The URL that the teachable machine model metadata is available at.
     * Not required if modelUrl is provided.
     */
    modelMetadataUrl?: string;

    /**
     * The images that should be classified.
     */
    images: Image[];
}

export interface Image {
    /**
     * The URL that the image should be downloaded from for classification.
     */
    url?: string;

    /**
     * The file that should be used for classification.
     */
    file?: {
        /**
         * The name of the file. Includes the file extension.
         */
        name: string;

        /**
         * The size of the file in bytes.
         */
        size: number;

        /**
         * The data of the file.
         * If the file is a text file, the data will be a string.
         * If the file is not a text file, the data will be an ArrayBuffer.
         *
         * Text files have one of the following extentions:
         * .txt
         * .json
         * .md
         * .aux
         * .html
         * .js
         * .ts
         * All the other file extentions map to an ArrayBuffer.
         */
        data: string | ArrayBuffer;

        /**
         * The MIME type of the file.
         * See https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types for more information.
         */
        mimeType: string;
    };
}

export interface ClassifyImagesResult {
    /**
     * The model that the classifier is currently operating on.
     */
    model: {
        /**
         * The modeUrl that was provided to open the classifier.
         */
        modelUrl?: string;

        /**
         * The modelJsonUrl that was provided to open the classifier.
         */
        modelJsonUrl?: string;

        /**
         * The modelMetadataUrl that was provided to open the classifier.
         */
        modelMetadataUrl?: string;

        /**
         * The names of the categories that the loaded model contains.
         */
        classLabels: string[];
    };

    images: ImageClassification[];
}

export interface ImageClassification {
    /**
     * The predictions for the image.
     */
    predictions: ImagePrediction[];
}

export interface ImagePrediction {
    /**
     * The name of the class name.
     */
    className: string;

    /**
     * The probability (between 0 and 1) that the image belongs to this category.
     * All of the probabilities added together will equal (or be really close to) 1.
     */
    probability: number;
}

/**
 * An event that is used to load a simulation.
 * @dochash types/os/spaces
 * @docname LoadInstAction
 */
export interface LoadServerAction extends Action {
    type: 'load_server';

    /**
     * The ID of the simulation to load.
     */
    id: string;
}

/**
 * The configuration for loading an inst.
 *
 * @dochash types/os/spaces
 * @docname InstConfig
 */
export interface InstConfig {
    /**
     * The owner of the inst.
     *
     * Possible values are:
     * - "public" - The inst is public and temporary.
     * - "player" - The inst is owned by the current player.
     * - Any record name - the inst will be loaded from the given record.
     * - Any user ID - the inst will be loaded from the given user's default record.
     * - Any studio ID - the inst will be loaded from the given studio's default record.
     *
     * Only valid when an inst is also specified.
     */
    owner?: string | null;

    /**
     * The record that the inst should be loaded from.
     *
     * Only valid when an inst is also specified.
     */
    record?: string | null;

    /**
     * The inst that should be loaded.
     *
     * When specified, you can also use the owner field to specify where the inst should be loaded from.
     */
    inst?: string;

    /**
     * The static inst that should be loaded.
     *
     * Only valid when specified on its own.
     */
    staticInst?: string;

    /**
     * The temporary inst that should be loaded.
     *
     * Only valid when specified on its own.
     */
    tempInst?: string;
}

/**
 * An event that is used to load an inst.
 * @dochash types/os/spaces
 * @docname LoadInstConfigAction
 */
export interface LoadServerConfigAction extends Action {
    type: 'load_server_config';

    /**
     * The config that should be used to load the inst.
     */
    config: InstConfig;
}

/**
 * An event that is used to unload a simulation.
 * @dochash types/os/spaces
 * @docname UnloadInstAction
 */
export interface UnloadServerAction extends Action {
    type: 'unload_server';

    /**
     * The ID of the simulation to unload.
     */
    id: string;
}

/**
 * An event that is used to unload a simulation.
 *
 * @dochash types/os/spaces
 * @docname UnloadInstConfigAction
 */
export interface UnloadServerConfigAction extends Action {
    type: 'unload_server_config';

    /**
     * The config that should be used to unload the inst.
     */
    config: InstConfig;
}

/**
 * An event that is used to load an AUX from a remote location.
 * @docname ImportAUXAction
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
 * @docname SuperShoutAction
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
 * @docname SendWebhookAction
 */
export interface SendWebhookAction extends AsyncAction {
    type: 'send_webhook';

    /**
     * The options for the webhook.
     */
    options: WebhookActionOptions;
}

/**
 * Defines a set of options for a webhook.
 */
export interface WebhookActionOptions {
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
 * @docname AnimateTagAction
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
 * @docname AnimateTagOptions
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
 * @docname GetRemoteCountAction
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
 * @docname GetRemotesAction
 */
export interface GetRemotesAction extends Action {
    type: 'get_remotes';
}

/**
 * Defines an event that is used to get the list of bot updates on the instance.
 * @docname ListInstUpdatesAction
 */
export interface ListInstUpdatesAction extends Action {
    type: 'list_inst_updates';
}

/**
 * Defines an event that is used to get the state of the inst with a particular set of updates.
 * @docname GetInstStateFromUpdatesAction
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
 * @docname CreateInitializationUpdateAction
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
 * @docname ApplyUpdatesToInstAction
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
 * @docname GetCurrentInstUpdateAction
 */
export interface GetCurrentInstUpdateAction extends Action {
    type: 'get_current_inst_update';
}

/**
 * Defines an event that is used to send the player to a dimension.
 * @docname GoToDimensionAction
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
 * @docname ShowInputForTagAction
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
 * @docname ShowInputAction
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
 * @dochash types/os/input
 * @docname ShowConfirmAction
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
 * @dochash types/os/input
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
 * Defines an event that is used to show an alert/info dialog.
 * @dochash types/os/input
 * @docname ShowAlertAction
 */
export interface ShowAlertAction extends AsyncAction {
    type: 'show_alert';

    /**
     * The options for the alert dialog.
     */
    options: ShowAlertOptions;
}

/**
 * Defines an interface that represents the options that can be used for an alert dialog.
 *
 * @dochash types/os/input
 * @docname ShowAlertOptions
 */
export interface ShowAlertOptions {
    /**
     * The title that should be shown for the dialog.
     */
    title: string;

    /**
     * The content of the dialog.
     */
    content: string;

    /**
     * The text that should be shown on the "Dismiss" button.
     * Defaults to "OK".
     */
    dismissText?: string;
}

/**
 * Defines an event that is used to set whether the connection is forced to be offline.
 * @docname SetForcedOfflineAction
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
 * @docname GoToURLAction
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
 *
 * @dochash types/os/portals
 * @doctitle Portal Types
 * @docsidebar Portals
 * @docdescription Types that are used in portal actions.
 * @docname OpenURLAction
 */
export interface OpenURLAction extends Action {
    type: 'open_url';

    /**
     * The URL to open.
     */
    url: string;
}

/**
 * Defines an event that notifies the system that a config bot tag should be tracked in the URL.
 *
 * @dochash types/os/portals
 * @docname TrackConfigBotTagsAction
 */
export interface TrackConfigBotTagsAction extends Action {
    type: 'track_config_bot_tags';

    /**
     * The tag names that should be tracked.
     */
    tags: string[];

    /**
     * Whether the a history entry should be created for every change to these tags.
     * If false, then the URL will be updated but no additional history entries will be created.
     * If true, then each change to the parameters will create a new history entry.
     */
    fullHistory: boolean;
}

/**
 * Creates a TrackConfigBotTagsAction that notifies the system that a config bot tag should be tracked in the URL.
 */
export function trackConfigBotTags(
    tags: string[],
    fullHistory: boolean
): TrackConfigBotTagsAction {
    return {
        type: 'track_config_bot_tags',
        tags,
        fullHistory,
    };
}

/**
 * Defines an event that is used to play a sound from the given url.
 * @dochash types/os/audio
 * @doctitle Audio Actions
 * @docsidebar Audio
 * @docdescription Defines the types that are used by audio actions.
 * @docname PlaySoundAction
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
 *
 * @dochash types/os/audio
 * @docname BufferSoundAction
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
 *
 * @dochash types/os/audio
 * @docname CancelSoundAction
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
 *
 * @dochash types/os/files
 * @doctitle File Actions
 * @docsidebar Files
 * @docdescription Types that are used in file actions.
 * @docname DownloadAction
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
 * @dochash types/os/input
 * @doctitle Input Types
 * @docsidebar Input
 * @docdescription Types that are used in actions that accept user input.
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

/**
 * Defines an interface that represents an item that can be displayed in a {@link os.showInput} list.
 *
 * @dochash types/os/input
 * @docname ShowInputItem
 */
export interface ShowInputItem {
    label: string;
    value: any;
}

/**
 * Defines the possible input types.
 * @dochash types/os/input
 * @docname ShowInputType
 */
export type ShowInputType = 'text' | 'color' | 'secret' | 'date' | 'list';

/**
 * Defines the possible input types.
 * @dochash types/os/input
 * @docname ShowInputSuptype
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
 *
 * @dochash types/os/event
 * @doctitle Event Types
 * @docsidebar Events
 * @docdescription Types that are used in event actions.
 * @docname RejectAction
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
 *
 * @dochash types/os/clipboard
 * @doctitle Clipboard Types
 * @docsidebar Clipboard
 * @docdescription Types that are used in clipboard actions.
 * @docname SetClipboardAction
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
 *
 * @dochash types/os/input
 * @docname ShowChatBarAction
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
 * @dochash types/os/input
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
 *
 * @dochash types/os/system
 * @docname RunScriptAction
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
 *
 * @dochash types/os/input
 * @docname ShowUploadAuxFileAction
 */
export interface ShowUploadAuxFileAction {
    type: 'show_upload_aux_file';
}

/**
 * Defines an event that shows the "uplaod file" dialog.
 *
 * @dochash types/os/input
 * @docname ShowUploadFilesAction
 */
export interface ShowUploadFilesAction extends AsyncAction {
    type: 'show_upload_files';
}

/**
 * Defines an event that loads a space into the instance.
 *
 * @dochash types/os/spaces
 * @doctitle Space Types
 * @docsidebar Spaces
 * @docdescription Types that are used in actions that relate to spaces.
 * @docname LoadSpaceAction
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
 * Defines an event that is used to load a shared document.
 */
export interface LoadSharedDocumentAction extends AsyncAction {
    type: 'load_shared_document';

    /**
     * The name of the record that the document should be loaded from.
     * If null, then the document will be loaded either from a public inst or indexeddb.
     */
    recordName: string | null;

    /**
     * The inst that should be loaded.
     * If null, then the document will be loaded from indexeddb.
     */
    inst: string | null;

    /**
     * The branch that should be loaded.
     * If null, then the document will not be stored in indexeddb.
     */
    branch: string | null;

    /**
     * The markers that should be set on the inst if it is new.
     * If the inst already exists, this field is ignored.
     * If not provided, the default markers will be used.
     */
    markers?: string[];
}

/**
 * An event that is used to enable collaboration features.
 *
 * @dochash types/os/spaces
 * @docname EnableCollaborationAction
 */
export interface EnableCollaborationAction extends AsyncAction {
    type: 'enable_collaboration';
}

/**
 * An event that is used to show the account info dialog.
 */
export interface ShowAccountInfoAction extends AsyncAction {
    type: 'show_account_info';
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
 *
 * @dochash types/os/animations
 * @doctitle Animation Types
 * @docsidebar Animations
 * @docdescription Types that are used in actions that relate to animations.
 * @docname LocalFormAnimationAction
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
 *
 * @dochash types/os/animations
 * @docname LocalTweenAction
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
 *
 * @dochash types/os/animations
 * @docname LocalPositionTweenAction
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
 * @dochash types/os/xr
 * @doctitle XR Actions
 * @docsidebar XR
 * @docdescription Types that are used in actions that relate to XR features (Augmented Reality or Virtual Reality).
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
 *
 * @dochash types/os/xr
 * @docname EnableARAction
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
 *
 * @dochash types/os/xr
 * @docname ARSupportedAction
 */
export interface ARSupportedAction extends AsyncAction {
    type: 'ar_supported';
}

/**
 * Defines an event that checks for VR support on the device.
 *
 * @dochash types/os/xr
 * @docname VRSupportedAction
 */
export interface VRSupportedAction extends AsyncAction {
    type: 'vr_supported';
}

/**
 * Defines an event that enables VR on the device.
 *
 * @dochash types/os/xr
 * @docname EnableVRAction
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
 *
 * @dochash types/os/portals
 * @docname EnablePOVAction
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
 *
 * @dochash types/os/barcodes
 * @docname ShowJoinCodeAction
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
 *
 * @dochash types/os/portals
 * @docname RequestFullscreenAction
 */
export interface RequestFullscreenAction {
    type: 'request_fullscreen_mode';
}

/**
 * Defines an event that exits fullscreen mode.
 *
 * @dochash types/os/portals
 * @docname ExitFullscreenAction
 */
export interface ExitFullscreenAction {
    type: 'exit_fullscreen_mode';
}

/**
 * Defines the options that a share action can have.
 *
 * @dochash types/os/input
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
 *
 * @dochash types/os/input
 * @docname ShareAction
 */
export interface ShareAction extends AsyncAction, ShareOptions {
    type: 'share';
}

/**
 * Defines an event that ensures a portal bot has been created for a portal.
 *
 * @dochash types/os/portals
 * @docname RegisterBuiltinPortalAction
 */
export interface RegisterBuiltinPortalAction {
    type: 'register_builtin_portal';

    /**
     * The ID of the portal.
     */
    portalId: string;
}

/**
 * Defines an event that registers a custom app container.
 */
export interface CustomAppContainerAvailableAction extends Action {
    type: 'custom_app_container_available';
}

/**
 * Defines an event that registers a custom portal.
 *
 * @dochash types/os/portals
 * @docname RegisterCustomAppAction
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
 *
 * @dochash types/os/portals
 * @docname UnregisterCustomAppAction
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
 *
 * @dochash types/os/portals
 * @docname RegisterHtmlAppAction
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
 *
 * @dochash types/os/portals
 * @docname UnregisterHtmlAppAction
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
 *
 * @dochash types/os/portals
 * @docname SetAppOutputAction
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
 *
 * @dochash types/os/portals
 * @docname UpdateHtmlAppAction
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
 *
 * @dochash types/os/portals
 * @docname HtmlAppEventAction
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
 *
 * @dochash types/os/portals
 * @docname HtmlAppMethodCallAction
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
 *
 * @dochash types/os/portals
 * @docname SerializableMutationRecord
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

/**
 * Defines a reference to a HTML node. Internal to CasualOS.
 *
 * @dochash types/os/portals
 * @docname NodeReference
 */
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
 *
 * @dochash types/os/portals
 * @docname OpenCircleWipeAction
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
 *
 * @dochash types/os/portals
 * @docname OpenCircleWipeOptions
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
 *
 * @dochash types/os/portals
 * @docname AddDropSnapAction
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
 *
 * @dochash types/os/portals
 * @docname AddDropSnapPointsAction
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
 * @dochash types/os/portals
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
 * @dochash types/os/portals
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
 * @dochash types/os/portals
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
 *
 * @dochash types/os/portals
 * @docname SnapGrid
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
 *
 * @dochash types/os/portals
 * @docname EnableCustomDraggingAction
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

    /**
     * The buffer rate in milliseconds that audio recordings should use.
     * When set, the audio will be buffered and sent in chunks at the specified rate.
     * Defaults to 500ms.
     */
    bufferRateMilliseconds?: number;
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

    /**
     * The MIME type that should be produced.
     * If supported, then the recorded file(s) will be in this format.
     * If not supported, then the recording will fail.
     * If not provided, then a default will be used.
     *
     * See https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Video_codecs for more information.
     */
    mimeType?: string;

    /**
     * The ideal number of bits per second that the recording should use.
     * If omitted, then the videoBitsPerSecond and audioBitsPerSecond  settings will be used.
     *
     * See https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/MediaRecorder#bitspersecond for more information.
     */
    bitsPerSecond?: number;

    /**
     * The ideal number of bits per second that the video portion of the recording should use.
     * If omitted, then a bitrate of 1mbps will be used.
     *
     * See https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/MediaRecorder#videobitspersecond for more information.
     */
    videoBitsPerSecond?: number;

    /**
     * The ideal number of bits per second that the audio portion of the recording should use.
     * If omitted then a bitrake of 48kbps will be used.
     *
     * See https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/MediaRecorder#audiobitspersecond for more information.
     */
    audioBitsPerSecond?: number;
}

/**
 * An event that is used to start audio recording.
 *
 * @dochash types/os/audio
 * @docname BeginRecordingAction
 */
export interface BeginRecordingAction extends AsyncAction, RecordingOptions {
    type: 'begin_recording';
}

/**
 * An event that is used to finish audio recording.
 *
 * @dochash types/os/audio
 * @docname EndRecordingAction
 */
export interface EndRecordingAction extends AsyncAction {
    type: 'end_recording';
}

/**
 * An event that is used to send a command to the Jitsi Meet API.
 *
 * @dochash types/os/meets
 * @doctitle Meet Types
 * @docsidebar Meets
 * @docdescription Types that are used in actions that relate to the meetPortal.
 * @docname MeetCommandAction
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
 *
 * @dochash types/os/meets
 * @docname MeetFunctionAction
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
 *
 * @dochash types/os/audio
 * @docname SpeakTextAction
 */
export interface SpeakTextAction extends AsyncAction, SpeakTextOptions {
    type: 'speak_text';

    /**
     * The text that should be spoken.
     */
    text: string;
}

/** Extensible overlay type — bot map form */
type OverlayType = 'geojson_canvas';

export interface AddBotMapLayerAction extends AsyncAction {
    type: 'add_bot_map_layer';
    /**
     * The ID of the bot that should be drawn on.
     */
    botId: string;
    /**
     * Layer configuration
     */
    overlay: {
        /**
         * The type of overlay to add to the bot map form
         */
        overlayType: 'geojson';
        type?: 'geojson';
        /**
         * Data specific to the overlay type for layer creation
         */
        data: any;
        /**
         * An optional user defined ID of the overlay that should be added.
         * Will be generated and returned if ommited.
         */
        overlayId?: string;
    };
}
export interface RemoveBotMapLayerAction extends AsyncAction {
    type: 'remove_bot_map_layer';
    /**
     * The ID of the bot that the overlay is on.
     */
    botId: string;
    /**
     * The ID of the overlay that should be removed.
     */
    overlayId: string;
}

/**
 * An event that is used to retrieve the synthetic voices that are supported by the current system.
 *
 * @dochash types/os/audio
 * @docname GetVoicesAction
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
 *
 * @dochash types/os/geolocation
 * @docname GetGeolocationAction
 */
export interface GetGeolocationAction extends AsyncAction {
    type: 'get_geolocation';
}

/**
 * Defines the possible geolocation results.
 *
 * @dochash types/os/geolocation
 * @doctitle Geolocation Types
 * @docsidebar Geolocation
 * @docdescription Defines the types that are used by Location actions.
 * @docgroup 01-geo
 * @docorder 0
 * @docname Geolocation
 */
export type Geolocation = SuccessfulGeolocation | UnsuccessfulGeolocation;

/**
 * Defines an interface that represents a successful geolocation result.
 *
 * @dochash types/os/geolocation
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
 * @dochash types/os/geolocation
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
 *
 * @dochash types/os/portals
 * @docname GoToTagAction
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
 * Defines an event that requests to report the current inst.
 *
 * @dochash types/os/moderation
 * @doctitle Moderation Types
 * @docsidebar Moderation
 * @docdescription Types that are used in actions that relate to moderation.
 * @docname ReportInstAction
 */
export interface ReportInstAction extends AsyncAction {
    type: 'report_inst';
}

/**
 * Defines an event that requests a Auth data from the OS.
 *
 * @dochash types/os/records
 * @doctitle Records Types
 * @docsidebar Records
 * @docdescription Defines the types that are used by Record actions.
 * @docname RequestAuthDataAction
 */
export interface RequestAuthDataAction extends AsyncAction {
    type: 'request_auth_data';

    /**
     * Whether the request should be limited to the background.
     * Defaults to false.
     */
    requestInBackground?: boolean;
}

/**
 * Defines an event that requests the user be signed out.
 *
 * @dochash types/os/records
 * @docname SignOutAction
 */
export interface SignOutAction extends AsyncAction {
    type: 'sign_out';
}

/**
 * Defines an interface that represents a authenticated user.
 *
 * @dochash types/os/records
 * @docname AuthData
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
     * Whether the user has an active subscription that they are paying for.
     * If false, then the user either has no subscription or has a default subscription.
     */
    hasActiveSubscription: boolean;

    /**
     * The subscription tier that is currently active for the user.
     * If null, then the user has no subscription tier.
     * Otherwise, then the user is paying for a subscription for has a default subscription.
     */
    subscriptionTier: string | null;

    /**
     * The privacy features that the user has enabled.
     */
    privacyFeatures: {
        /**
         * Whether the user is allowed to publish any data.
         */
        publishData: boolean;

        /**
         * Whether the user is allowed to access or publish public data.
         */
        allowPublicData: boolean;

        /**
         * Whether AI is allowed.
         */
        allowAI: boolean;

        /**
         * Whether public insts are allowed.
         */
        allowPublicInsts: boolean;
    };
}

/**
 * Defines an event that defines a global variable that points to the given bot.
 *
 * @dochash types/os/portals
 * @docname DefineGlobalBotAction
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
 * @dochash types/os/geolocation
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
 *
 * @dochash types/os/geolocation
 * @docname ConvertGeolocationToWhat3WordsAction
 */
export interface ConvertGeolocationToWhat3WordsAction
    extends AsyncAction,
        ConvertGeolocationToWhat3WordsOptions {
    type: 'convert_geolocation_to_w3w';
}

/**
 * Defines an interface that represents options for requesting media permissions.
 *
 * @dochash types/os/media
 * @doctitle Media Types
 * @docsidebar Media
 * @docdescription Defines the types that are used by Media actions.
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
 *
 * @dochash types/os/media
 * @docname MediaPermissionAction
 */
export interface MediaPermissionAction
    extends AsyncAction,
        MediaPermssionOptions {
    type: 'media_permission';
}

/**
 * Defines an event that retrieves the current average frame rate.
 *
 * @dochash types/os/portals
 * @docname GetAverageFrameRateAction
 */
export interface GetAverageFrameRateAction extends AsyncAction {
    type: 'get_average_frame_rate';
}

/**
 * Defines an event that performs a raycast from the camera in the given portal.
 *
 * @dochash types/os/portals
 * @docname RaycastFromCameraAction
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
 *
 * @dochash types/os/portals
 * @docname RaycastInPortalAction
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
 *
 * @dochash types/os/portals
 * @docname CalculateRayFromCameraAction
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
 * Defines an event that calculates the 2D viewport coordinates from the given 3D position.
 *
 * @dochash types/os/portals
 * @docname CalculateViewportCoordinatesFromPositionAction
 */
export interface CalculateViewportCoordinatesFromPositionAction
    extends AsyncAction {
    type: 'calculate_viewport_coordinates_from_position';

    /**
     * The portal that the ray should be calculated for.
     */
    portal: CameraPortal;

    /**
     * The 3D position that the viewport coordinates should be calculated for.
     */
    position: Point3D;
}

/**
 * Defines an event that calculates the 2D screen coordinates from the given 2D viewport coordinates.
 *
 * @dochash types/os/portals
 * @docname CalculateScreenCoordinatesFromViewportCoordinatesAction
 */
export interface CalculateScreenCoordinatesFromViewportCoordinatesAction
    extends AsyncAction {
    type: 'calculate_screen_coordinates_from_viewport_coordinates';

    /**
     * The portal that the ray should be calculated for.
     */
    portal: CameraPortal;

    /**
     * The 2D position that the screen coordinates should be calculated for.
     */
    coordinates: Point2D;
}

/**
 * Defines an event that calculates the 2D screen coordinates from the given 3D positions.
 *
 * @dochash types/os/portals
 * @docname CalculateScreenCoordinatesFromPositionAction
 */
export interface CalculateScreenCoordinatesFromPositionAction
    extends AsyncAction {
    type: 'calculate_screen_coordinates_from_position';

    /**
     * The portal that the ray should be calculated for.
     */
    portal: CameraPortal;

    /**
     * The 3D positions that the screen coordinates should be calculated for.
     */
    coordinates: Point3D[];
}

/**
 * Defines an event that calculates the 2D viewport coordinates from the given 2D screen coordinates.
 *
 * @dochash types/os/portals
 * @docname CalculateViewportCoordinatesFromScreenCoordinatesAction
 */
export interface CalculateViewportCoordinatesFromScreenCoordinatesAction
    extends AsyncAction {
    type: 'calculate_viewport_coordinates_from_screen_coordinates';

    /**
     * The portal that the ray should be calculated for.
     */
    portal: CameraPortal;

    /**
     * The 2D position that the viewport coordinates should be calculated for.
     */
    coordinates: Point2D;
}

/**
 * Defines an event that captures a screenshot from the given portal.
 */
export interface CapturePortalScreenshotAction extends AsyncAction {
    type: 'capture_portal_screenshot';

    /**
     * The portal that should be captured.
     */
    portal: CameraPortal;
}

/**
 * Defines an event that captures a screenshot from the given viewport coordinates.
 */
export interface CreateStaticHtmlAction extends AsyncAction {
    type: 'create_static_html';

    /**
     * The bots that should be injected.
     */
    bots: BotsState;

    /**
     * The URL of the HTML that the static HTML should be created from.
     */
    templateUrl?: string;
}

/**
 * Defines an event that requests that a loom video be recorded.
 *
 * @dochash types/loom
 * @docname RecordLoomAction
 */
export interface RecordLoomAction extends AsyncAction {
    type: 'record_loom';

    /**
     * The options for the loom.
     */
    options: RecordLoomOptions;
}

/**
 * Defines a set of options that can be used when recording a loom.
 *
 * @dochash types/loom
 * @doctitle Loom Types
 * @docsidebar Loom
 * @docdescription Types that are used in Loom actions.
 * @docname RecordLoomOptions
 */
export interface RecordLoomOptions {
    /**
     * The public ID of the loom app.
     */
    publicAppId?: string | null;

    /**
     * The name of the record that the loom recording is for.
     */
    recordName?: string | null;
}

/**
 * Defines an event that requests that a loom video be displayed to the user.
 *
 * @dochash types/loom
 * @docname WatchLoomAction
 */
export interface WatchLoomAction extends AsyncAction {
    type: 'watch_loom';

    /**
     * The shared URL of the loom video that should be watched.
     */
    sharedUrl: string;
}

/**
 * Defines an event that retrieves the metadata for a loom video.
 *
 * @dochash types/loom
 * @docname GetLoomMetadataAction
 */
export interface GetLoomMetadataAction extends AsyncAction {
    type: 'get_loom_metadata';

    /**
     * The shared URL of the loom video that the metadata should be retrieved for.
     */
    sharedUrl: string;
}

export interface GetScriptIssuesAction extends AsyncAction {
    type: 'get_script_issues';

    botId: string;

    tag: string;
}

/**
 * Defines an interface that contains information for a loom video.
 *
 * @dochash types/loom
 * @docname LoomVideo
 */
export interface LoomVideo {
    /**
     * The ID of the loom video.
     */
    id: string;

    /**
     * The URL that should be used for sharing the video.
     */
    sharedUrl: string;

    /**
     * The URL that should be used for embedding the video.
     */
    embedUrl: string;

    /**
     * The title of the loom video.
     */
    title: string;

    /**
     * The height of the video in pixels.
     */
    height: number;

    /**
     * The width of the video in pixels.
     */
    width: number;

    /**
     * The URL of the thumbnail for the video.
     */
    thumbnailUrl: string;

    /**
     * The height of the thumbnail in pixels.
     */
    thumbnailHeight: number;

    /**
     * The width of the thumbnail in pixels.
     */
    thumbnailWidth: number;

    /**
     * The duration of the video in seconds.
     */
    duration: string;
}

/**
 * Defines an interface that contains embed metadata for a loom video.
 *
 * @dochash types/loom
 * @docname LoomVideoEmbedMetadata
 */
export interface LoomVideoEmbedMetadata {
    /**
     * The HTML that can be used to embed the video.
     */
    html: string;

    /**
     * The height of the video in pixels.
     */
    height: number;

    /**
     * The width of the video in pixels.
     */
    width: number;

    /**
     * The URL of the thumbnail image for the video.
     */
    thumnailUrl: string;

    /**
     * The height of the thumbnail image in pixels.
     */
    thumbnailHeight: number;

    /**
     * The width of the thumbnail image in pixels.
     */
    thumbnailWidth: number;

    /**
     * The duration of the video in seconds.
     */
    duration: number;
}

/**
 * Defines an event that requests the pre-caching of a GLTF mesh.
 *
 * @dochash types/os/portals
 * @docname BufferFormAddressGLTFAction
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
 * @dochash types/os/animations
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
 *
 * @dochash types/os/animations
 * @docname StartFormAnimationAction
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
 * @dochash types/os/animations
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
 *
 * @dochash types/os/animations
 * @docname StopFormAnimationAction
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
 *
 * @dochash types/os/animations
 * @docname ListFormAnimationsAction
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
 * @dochash types/os/animations
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

/**
 * Defines an event that retrieves the build steps for a given LDraw model.
 */
export interface LDrawCountBuildStepsAction extends AsyncAction {
    type: 'ldraw_count_build_steps';

    /**
     * The address that the build steps should be retrieved from.
     */
    address?: string;

    /**
     * The text that contains the LDraw model.
     */
    text?: string;
}

/**
 * An event that adds a map layer to the map or miniMap portal.
 * This is used to add custom layers to the map, such as heatmaps or other visualizations.
 *
 * @dochash types/os/maps
 * @doctitle Map Types
 * @docsidebar Maps
 * @docdescription Types that are used in actions that relate to maps.
 * @docid AddMapLayerAction
 */
export interface AddMapLayerAction extends AsyncAction {
    type: 'add_map_layer';

    /**
     * The portal that the layer should be added to.
     */
    portal: 'map' | 'miniMap';

    /**
     * The layer that should be added to the portal.
     */
    layer: MapLayer;
}

/**
 * An event that is used to remove a map layer from the map or miniMapPortal.
 *
 * @dochash types/os/maps
 * @docid RemoveMapLayerAction
 */
export interface RemoveMapLayerAction extends AsyncAction {
    type: 'remove_map_layer';

    /**
     * The ID of the layer that should be removed.
     */
    layerId: string;
}

/**
 * The kinds of map layers that can be added to the map or miniMapPortal.
 *
 * @dochash types/os/maps
 * @docid MapLayer
 */
export type MapLayer = GeoJSONMapLayer;

/**
 * Defines a base interface for map layers.
 *
 * @dochash types/os/maps
 * @docid MapLayerBase
 */
export interface MapLayerBase {
    /**
     * Copyright information for the layer.
     */
    copyright?: string;
}

/**
 * A map layer that contains GeoJSON data.
 *
 * @dochash types/os/maps
 * @docid GeoJSONMapLayer
 */
export interface GeoJSONMapLayer extends MapLayerBase {
    type: 'geojson';

    /**
     * The URL that contains the GeoJSON data.
     *
     * Can be a blob url, a data url, or a regular URL.
     */
    url?: string;

    /**
     * The GeoJSON data for the layer.
     */
    data?: object;
}

/**
 * The portals that contain a camera that can be raycasted from.
 *
 * @dochash types/os/portals
 * @docname CameraPortal
 */
export type CameraPortal = 'grid' | 'miniGrid' | 'map' | 'miniMap';

/**
 * Defines an event that represents a 2D point.
 *
 * @dochash types/os/portals
 * @docname Point2D
 */
export interface Point2D {
    x: number;
    y: number;
}

/**
 * Defines an interface that represents a 3D point.
 *
 * @dochash types/os/portals
 * @docname Point3D
 */
export interface Point3D {
    x: number;
    y: number;
    z: number;
}

/**
 * An event that is used to enable/disable wake lock.
 *
 * @dochash types/os/portals
 * @docname ConfigureWakeLockAction
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
 *
 * @dochash types/os/portals
 * @docname GetWakeLockConfigurationAction
 */
export interface GetWakeLockConfigurationAction extends AsyncAction {
    type: 'get_wake_lock_configuration';
}

/**
 * Defines an interface that represents a wake lock configuration.
 *
 * @dochash types/os/portals
 * @docname WakeLockConfiguration
 */
export interface WakeLockConfiguration {
    /**
     * Whether the wake lock is enabled.
     */
    enabled: boolean;
}

/**
 * An action that is used to record an event for analytics.
 *
 * @dochash types/os/portals
 * @docname AnalyticsRecordEventAction
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

/**
 * An action that hides the loading screen.
 */
export interface HideLoadingScreenAction extends AsyncAction {
    type: 'hide_loading_screen';
}

/**
 * An action that is used to retrieve the default records endpoint.
 */
export interface GetRecordsEndpointAction extends AsyncAction {
    type: 'get_records_endpoint';
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
 * Creates a new ConfigureTypeCheckingAction.
 * @param options The configuration options for type checking.
 * @param taskId The ID of the async task.
 */
export function configureTypeChecking(
    options: ConfigureTypeCheckingOptions,
    taskId?: string | number
): ConfigureTypeCheckingAction {
    return {
        type: 'configure_type_checking',
        options,
        taskId,
    };
}

export function getScriptIssues(
    botId: string,
    tag: string,
    taskId: string | number
): GetScriptIssuesAction {
    return {
        type: 'get_script_issues',
        botId: botId,
        tag: tag,
        taskId: taskId,
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
 * Creates a new GenerateQRCodeAction.
 * @param code The code that should be generated.
 */
export function generateQRCode(
    code?: string,
    options?: GenerateQRCodeOptions,
    taskId?: number | string
): GenerateQRCodeAction {
    return {
        type: 'generate_qr_code',
        code,
        options,
        taskId,
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

export function classifyImages(
    options: ClassifyImagesOptions,
    taskId?: number | string
): ClassifyImagesAction {
    return {
        type: 'classify_images',
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
export function loadSimulation(id: string): LoadServerAction;
/**
 * Creates a new LoadSimulationAction.
 * @param config The config of the simulation to load.
 */
export function loadSimulation(
    config: LoadServerConfigAction['config']
): LoadServerConfigAction;
export function loadSimulation(
    id: string | LoadServerConfigAction['config']
): LoadServerAction | LoadServerConfigAction {
    if (typeof id === 'object') {
        return {
            type: 'load_server_config',
            config: id,
        };
    }
    return {
        type: 'load_server',
        id: id,
    };
}

/**
 * Creates a new UnloadSimulationAction.
 * @param id The ID of the simulation to unload.
 */
export function unloadSimulation(id: string): UnloadServerAction;
/**
 * Creates a new UnloadServerConfigAction.
 * @param config The config of the simulation to unload.
 */
export function unloadSimulation(config: InstConfig): UnloadServerConfigAction;
export function unloadSimulation(
    id: string | InstConfig
): UnloadServerAction | UnloadServerConfigAction {
    if (typeof id === 'object') {
        return {
            type: 'unload_server_config',
            config: id,
        };
    }
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
 * Creates a new ShowAlertAction.
 * @param options The options for the action.
 * @param taskId The ID of the async task.
 */
export function showAlert(
    options: ShowAlertOptions,
    taskId?: number | string
): ShowAlertAction {
    return {
        type: 'show_alert',
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
    options: WebhookActionOptions,
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
 * Loads a shared document.
 * @param recordName The name of the record.
 * @param inst The instance to load the document into.
 * @param branch The branch to load the document from.
 * @param taskId The ID of the async task.
 * @param markers The markers that should be set on the inst if it is new.
 */
export function loadSharedDocument(
    recordName: string | null,
    inst: string | null,
    branch: string,
    taskId?: number | string,
    markers?: string[]
): LoadSharedDocumentAction {
    return {
        type: 'load_shared_document',
        recordName,
        inst,
        branch,
        taskId,
        markers,
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
 * Creates a ShowAccountInfoAction.
 * @param taskId The ID of the async task.
 */
export function showAccountInfo(
    taskId?: number | string
): ShowAccountInfoAction {
    return {
        type: 'show_account_info',
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
 * @param uncopiable Whether the result should be uncopiable.
 */
export function asyncResult(
    taskId: number | string,
    result: any,
    mapBots?: boolean,
    uncopiable?: boolean
): AsyncResultAction {
    return {
        type: 'async_result',
        taskId,
        result,
        mapBotsInResult: mapBots,
        uncopiable,
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
 * Creates an action that provides a next value to an iterable.
 * @param taskId The ID of the task for the iterable.
 * @param value The value.
 */
export function iterableNext(
    taskId: number | string,
    value: any
): IterableNextAction {
    return {
        type: 'iterable_next',
        taskId,
        value,
    };
}

/**
 * Creates an action that completes an iterable.
 * @param taskId The ID of the task for the iterable.
 * @returns
 */
export function iterableComplete(
    taskId: number | string
): IterableCompleteAction {
    return {
        type: 'iterable_complete',
        taskId,
    };
}

/**
 * Creates an action that throws an error for an iterable.
 * @param taskId The ID of the task for the iterable.
 * @param error The error to throw from the iterable.
 */
export function iterableThrow(
    taskId: number | string,
    error: any
): IterableThrowAction {
    return {
        type: 'iterable_throw',
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
 * Creates an action that adds a map overlay to the given bot.
 * @param bot
 * @param overlayId
 * @param options
 * @param taskId
 */
export function addBotMapLayer(
    bot: Bot,
    overlayConfig: AddBotMapLayerAction['overlay'],
    taskId?: string | number
): AddBotMapLayerAction {
    return {
        type: 'add_bot_map_layer',
        botId: bot?.id,
        overlay: overlayConfig,
        taskId,
    };
}

export function removeBotMapLayer(
    bot: Bot,
    overlayId: string,
    taskId?: string | number
): RemoveBotMapLayerAction {
    return {
        type: 'remove_bot_map_layer',
        botId: bot?.id,
        overlayId,
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
 * Creates a ReportInstAction.
 * @param taskId The ID of the async task.
 */
export function reportInst(taskId?: string | number): ReportInstAction {
    return {
        type: 'report_inst',
        taskId,
    };
}

/**
 * Creates a RequestAuthDataAction.
 * @param requestInBackground Whether the request should be made in the background.
 */
export function requestAuthData(
    requestInBackground?: boolean,
    taskId?: string | number
): RequestAuthDataAction {
    return {
        type: 'request_auth_data',
        requestInBackground,
        taskId,
    };
}

/**
 * Creates a SignOutAction.
 * @param taskId The ID of the async task.
 */
export function signOut(taskId?: string | number): SignOutAction {
    return {
        type: 'sign_out',
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
 * Creates a new CalculateViewportCoordinatesFromPositionAction.
 * @param portal The portal that the ray should be calcualted for.
 * @param position The 3D position that the ray should be calculated for.
 * @param taskId The ID of the task.
 */
export function calculateViewportCoordinatesFromPosition(
    portal: CameraPortal,
    position: Point3D,
    taskId?: number | string
): CalculateViewportCoordinatesFromPositionAction {
    return {
        type: 'calculate_viewport_coordinates_from_position',
        portal,
        position,
        taskId,
    };
}

/**
 * Creates a new CalculateScreenCoordinatesFromViewportCoordinatesAction.
 * @param portal The portal that the ray should be calcualted for.
 * @param coordinates The 2D position that the coordinates should be calculated for.
 * @param taskId The ID of the task.
 */
export function calculateScreenCoordinatesFromViewportCoordinates(
    portal: CameraPortal,
    coordinates: Point2D,
    taskId?: number | string
): CalculateScreenCoordinatesFromViewportCoordinatesAction {
    return {
        type: 'calculate_screen_coordinates_from_viewport_coordinates',
        portal,
        coordinates,
        taskId,
    };
}

/**
 * Creates a new CalculateViewportCoordinatesFromScreenCoordinatesAction.
 * @param portal The portal that the ray should be calcualted for.
 * @param coordinates The 2D position that the coordinates should be calculated for.
 * @param taskId The ID of the task.
 */
export function calculateViewportCoordinatesFromScreenCoordinates(
    portal: CameraPortal,
    coordinates: Point2D,
    taskId?: number | string
): CalculateViewportCoordinatesFromScreenCoordinatesAction {
    return {
        type: 'calculate_viewport_coordinates_from_screen_coordinates',
        portal,
        coordinates,
        taskId,
    };
}

export function calculateScreenCoordinatesFromPosition(
    portal: CameraPortal,
    coordinates: Point3D[],
    taskId?: number | string
): CalculateScreenCoordinatesFromPositionAction {
    return {
        type: 'calculate_screen_coordinates_from_position',
        portal,
        coordinates,
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
 * Creates a new LDrawCountBuildStepsAction.
 * @param address The address of the LDraw file that should be used.
 * @param taskId The ID of the async task.
 */
export function ldrawCountAddressBuildSteps(
    address: string,
    taskId?: number | string
): LDrawCountBuildStepsAction {
    return {
        type: 'ldraw_count_build_steps',
        address,
        taskId,
    };
}

/**
 * Creates a new LDrawCountBuildStepsAction.
 * @param text The text content of the LDraw file that should be used.
 * @param taskId The ID of the async task.
 */
export function ldrawCountTextBuildSteps(
    text: string,
    taskId?: number | string
): LDrawCountBuildStepsAction {
    return {
        type: 'ldraw_count_build_steps',
        text,
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

/**
 * Creates a GetRecordsEndpointAction.
 * @param taskId The ID of the async task.
 */
export function getRecordsEndpoint(
    taskId?: number | string
): GetRecordsEndpointAction {
    return {
        type: 'get_records_endpoint',
        taskId,
    };
}

/**
 * Creates a CapturePortalScreenshotAction.
 * @param portal The portal that the screenshot should be captured from.
 * @param taskId The ID of the task.
 */
export function capturePortalScreenshot(
    portal: CameraPortal,
    taskId?: number | string
): CapturePortalScreenshotAction {
    return {
        type: 'capture_portal_screenshot',
        portal,
        taskId,
    };
}

/**
 * Creates a CreateStaticHtmlAction.
 * @param bots The bots that should be used to render the template.
 * @param templateUrl The URL of the template.
 * @param taskId The ID of the task.
 */
export function createStaticHtml(
    bots: BotsState,
    templateUrl: string,
    taskId?: number | string
): CreateStaticHtmlAction {
    return {
        type: 'create_static_html',
        bots,
        templateUrl,
        taskId,
    };
}

export function recordLoom(
    options: RecordLoomOptions,
    taskId?: number | string
): RecordLoomAction {
    return {
        type: 'record_loom',
        options,
        taskId,
    };
}

export function watchLoom(
    sharedUrl: string,
    taskId?: number | string
): WatchLoomAction {
    return {
        type: 'watch_loom',
        sharedUrl,
        taskId,
    };
}

export function getLoomMetadata(
    sharedUrl: string,
    taskId?: number | string
): GetLoomMetadataAction {
    return {
        type: 'get_loom_metadata',
        sharedUrl,
        taskId,
    };
}

export type InstallAuxFileMode = 'default' | 'copy';

export interface InstallAuxAction extends Action {
    type: 'install_aux_file';

    /**
     * The aux file that should be installed.
     */
    aux: StoredAux;

    /**
     * The mode that should be used to install the aux file.
     *
     * - "default" indicates that the aux file will be installed as-is.
     *    If the file was already installed, then it will either overwrite bots or do nothing depending on the version of the aux.
     *    Version 1 auxes will overwrite existing bots, while version 2 auxes will do nothing.
     * - "copy" indicates that all the bots in the aux file should be given new IDs. This is useful if you want to be able to install an AUX multiple times in the same inst.
     */
    mode: InstallAuxFileMode;

    /**
     * The source of the aux file (e.g. package ID).
     *
     * Used to track bots installed from aux files so that updates can be seamless.
     *
     * If omitted, then the aux file will be treated as a one-off install.
     * If specified and the mode is "default", then the aux file will be installed as an update if an aux from the same source was previously installed.
     * If specified and the mode is "copy", then the aux file will always be installed as a new install.
     */
    source?: string;

    /**
     * The version of the aux file being installed.
     *
     * Used to determine if the update is an upgrade or a downgrade.
     */
    version?: SimpleVersionNumber;

    /**
     * Whether to allow downgrading to older versions.
     */
    downgrade?: boolean;
}

export function installAuxFile(
    aux: StoredAux,
    mode: InstallAuxFileMode,
    source?: string,
    version?: SimpleVersionNumber,
    downgrade?: boolean
): InstallAuxAction {
    return {
        type: 'install_aux_file',
        aux,
        mode,
        source,
        version,
        downgrade,
    };
}

/**
 * Creates a new AddMapLayerAction.
 * @param portal The portal that the layer should be added to.
 * @param layer The layer that should be added.
 * @param index The index that the layer should be added at.
 * @param taskId The ID of the async task.
 */
export function addMapLayer(
    portal: 'map' | 'miniMap',
    layer: MapLayer,
    taskId?: number | string
): AddMapLayerAction {
    return {
        type: 'add_map_layer',
        portal,
        layer,
        taskId,
    };
}

/**
 * Creates a RemoveMapLayerAction.
 * @param layerId The ID of the layer that should be removed.
 * @param taskId The ID of the async task.
 * @returns The RemoveMapLayerAction.
 */
export function removeMapLayer(
    layerId: string,
    taskId?: number | string
): RemoveMapLayerAction {
    return {
        type: 'remove_map_layer',
        layerId,
        taskId,
    };
}
