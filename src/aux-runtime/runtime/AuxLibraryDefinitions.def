
// Preact Hooks Types
type Inputs = ReadonlyArray<unknown>;

export type StateUpdater<S> = (value: S | ((prevState: S) => S)) => void;

export type Reducer<S, A> = (prevState: S, action: A) => S;
interface Ref<T> {
	readonly current: T | null;
}

interface MutableRef<T> {
	current: T;
}
// End Preact Hooks Types

type EffectCallback = () => void | (() => void);

type MaskFunc<Func extends ((...args: any[]) => any)> = {
    (...args: Parameters<Func>): ReturnType<Func>;

    /**
     * Masks this function so that it can return a value when called with the specified parameters.
     */
    mask(...args: Parameters<Func>): MaskedFunction;
}


export interface MaskedFunction {
    /**
     * Specifies the value that should be returned when this function is called with the parameters specified to mask().
     * @param value The value that should be returned.
     */
    returns(value: any): void;
}

/**
 * Contains information about the version of AUX that is running.
 */
export interface AuxVersion {
    /**
     * The commit of the hash that AUX was built from.
     */
    hash: string;

    /**
     * The full version number.
     */
    version: string;

    /**
     * The major portion of the version.
     */
    major: number;

    /**
     * The minor portion of the version.
     */
    minor: number;

    /**
     * The patch portion of the version.
     */
    patch: number;

    /**
     * Whether this version is an alpha (i.e. test) version.
     */
    alpha: boolean | number;

    /**
     * Gets the player mode of this CasualOS version.
     * 
     * - "player" indicates that the instance has been configured for experiencing AUXes.
     * - "builder" indicates that the instance has been configured for building AUXes.
     */
    playerMode: 'player' | 'builder';
}

/**
 * Contains information about the device that AUX is running on.
 */
export interface AuxDevice {
    /**
     * Whether the device supports augmented reality features.
     */
    supportsAR: boolean;

    /**
     * Whether the device supports virtual reality features.
     */
    supportsVR: boolean;
}

/**
 * An interface for an object that contains a set of roles that a user has.
 */
declare interface DeviceInfo {
    /**
     * The list of roles.
     */
    roles: string[];

    /**
     * The claims that the device contains.
     * That is, information about the device which has been verified.
     */
    claims: {
        username: string;
        device_id: string;
        session_id: string;
        [key: string]: string;
    };
}

/**
 * Defines an interface that represents an event.
 * That is, a time-ordered action in a inst.
 * @deprecated
 */
declare interface Action {
    /**
     * The type of the event.
     * This helps determine how the event should be applied to the state.
     */
    type: string;
}

/**
 * An event that is used to indicate an event that was sent from a remote device.
 */
declare interface DeviceAction extends Action {
    type: 'device';

    /**
     * The device which sent the event.
     */
    device: DeviceInfo;

    /**
     * The event.
     */
    event: Action;
}

/**
 * An interface that is used to determine which device to send a remote event to.
 */
declare interface DeviceSelector {
    /**
     * The ID of the session that the event should be sent to.
     */
    sessionId?: string;

    /**
     * The ID of the device that the event should be sent to.
     */
    deviceId?: string;

    /**
     * The username of the user that the event should be sent to.
     */
    username?: string;
}

/**
 * An event that is used to send events from this device to a remote device.
 */
declare interface RemoteAction extends Action, DeviceSelector {
    type: 'remote';

    /**
     * The event that should be sent to the device.
     */
    event: Action;

    /**
     * Whether this action is allowed to be batched with other remote actions.
     * Batching will preserve ordering between remote actions but may
     * break ordering with respect to bot actions. Defaults to true.
     */
    allowBatching?: boolean;
}

declare type LocalActions = BotActions | ExtraActions | AsyncActions;

/**
 * Defines a union type for all the possible events that can be emitted from a bot in an inst.
 */
declare type BotAction =
    | BotActions
    | TransactionAction
    | ExtraActions
    | AsyncActions
    | RemoteAction
    | DeviceAction;

/**
 * Defines a union type for all the possible actions that manipulate the bot state.
 */
declare type BotActions =
    | AddBotAction
    | RemoveBotAction
    | UpdateBotAction
    | CreateCertificateAction
    | SignTagAction
    | RevokeCertificateAction
    | ApplyStateAction;
``;

/**
 * Defines a set of possible local event types.
 */
declare type ExtraActions =
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
    | PasteStateAction
    | ReplaceDragBotAction
    | SetClipboardAction
    | ShowChatBarAction
    | RunScriptAction
    | ShowUploadAuxFileAction
    | LoadSpaceAction
    | EnableARAction
    | EnableVRAction
    | ShowJoinCodeAction
    | RequestFullscreenAction
    | ExitFullscreenAction
    | ClearSpaceAction
    | LocalFormAnimationAction
    | AddDropSnapTargetsAction
    | EnableCustomDraggingAction
    | EnablePOVAction
    | SetAppOutputAction
    | AddDropGridTargetsAction;

/**
 * Defines a set of possible async action types.
 */
declare type AsyncActions =
    | AsyncResultAction
    | AsyncErrorAction
    | ShowInputAction
    | ShowConfirmAction
    | ShareAction
    | CreateCertificateAction
    | SignTagAction
    | RevokeCertificateAction
    | BufferSoundAction
    | PlaySoundAction
    | CancelSoundAction
    | RegisterPrefixAction
    | FocusOnBotAction
    | FocusOnPositionAction
    | BeginRecordingAction
    | EndRecordingAction
    | SpeakTextAction
    | GetVoicesAction
    | GetGeolocationAction
    | ARSupportedAction
    | VRSupportedAction
    | OpenImageClassifierAction
    | MeetCommandAction;

/**
 * Defines an interface for actions that represent asynchronous tasks.
 */
declare interface AsyncAction extends Action {
    /**
     * The ID of the async task.
     */
    taskId: number;
}

/**
 * Defines an action that supplies a result for an AsyncRequestAction.
 */
declare interface AsyncResultAction extends AsyncAction {
    type: 'async_result';

    /**
     * The result value.
     */
    result: any;
}

/**
 * Defines an action that supplies an error for an AsyncRequestAction.
 */
declare interface AsyncErrorAction extends AsyncAction {
    type: 'async_error';

    /**
     * The error.
     */
    error: any;
}

/**
 * Defines a bot event that indicates a bot was added to the state.
 */
declare interface AddBotAction extends Action {
    type: 'add_bot';
    id: string;
    bot: Bot;
}

/**
 * Defines a bot event that indicates a bot was removed from the state.
 */
declare interface RemoveBotAction extends Action {
    type: 'remove_bot';
    id: string;
}

/**
 * Defines a bot event that indicates a bot was updated.
 */
declare interface UpdateBotAction extends Action {
    type: 'update_bot';
    id: string;
    update: Partial<Bot>;
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
declare interface TransactionAction extends Action {
    type: 'transaction';
    events: BotAction[];
}

/**
 * An eventBotsStatesome generic BotsState to the current state.
 * This is useful when you have some generic bot state and want to just apply it to the
 * current state. An example of doing this is from the automatic merge system.
 */
declare interface ApplyStateAction extends Action {
    type: 'apply_state';
    state: BotsState;
}

/**
 * The options for pasting bots state into a inst.
 */
declare interface PasteStateOptions {
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
declare interface PasteStateAction extends Action {
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
declare interface ReplaceDragBotAction extends Action {
    type: 'replace_drag_bot';

    /**
     * The bot that should be used to drag.
     */
    bot: Bot | BotTags;
}


/**
 * An event that is used to run a shell script.
 */
declare interface ShellAction extends Action {
    type: 'shell';

    /**
     * The script that should be run.
     */
    script: string;
}

/**
 * An event that is used to show a toast message to the user.
 */
declare interface ShowToastAction extends Action {
    type: 'show_toast';
    message: string;
    duration: number;
}

/**
 * An event that is used to show some HTML to the user.
 */
declare interface ShowHtmlAction extends Action {
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
declare interface HideHtmlAction extends Action {
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
     * The rotation value to use in radians. These are the polar coordinates that determine where the camera should orbit around the target point.
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
     * The duration in seconds that the animation should take.
     * Defaults to 1.
     */
    duration?: number;

    /**
     * The type of easing to use.
     * If not specified then "quadratic" "inout" will be used.
     */
    easing?: EaseType | Easing;

    /**
     * The tag that should be focused.
     * Only supported by the system portal.
     */
     tag?: string;

     /**
      * The space of the tag that should be focused.
      * Only supported by the system portal.
      */
     space?: string;
 
     /**
      * The line number that should be focued.
      * Only supported by the system portal.
      */
     lineNumber?: number;
 
     /**
      * The column number that should be focused.
      * Only supported by the system portal.
      */
     columnNumber?: number;

    /**
     * The portal that the bot should be focused in.
     * If not specified, then the bot will be focused in all supported portals. (bot, mini, menu, and system)
     */
    portal?: PortalType;
}

/**
 * An event that is used to focus on a given bot.
 */
export interface FocusOnBotAction extends AsyncAction, FocusOnOptions {
    type: 'focus_on';

    /**
     * The ID of the bot to tween to.
     */
    botId: string;
}

/**
 * An event that is used to focus the camera on a specific position.
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
 * The possible camera types.
 */
declare type CameraType = 'front' | 'rear';

/**
 * An event that is used to show or hide the QR Code Scanner.
 */
declare interface OpenQRCodeScannerAction extends Action {
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
declare interface OpenBarcodeScannerAction extends Action {
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
    }

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
declare interface OpenConsoleAction extends Action {
    type: 'open_console';

    /**
     * Whether the console should be open.
     */
    open: boolean;
}

/**
 * An event that is used to show or hide a QR Code on screen.
 */
declare interface ShowQRCodeAction extends Action {
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
declare type BarcodeFormat =
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
declare interface ShowBarcodeAction extends Action {
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
export interface OpenImageClassifierAction extends AsyncAction {
    type: 'show_image_classifier';

    /**
     * Whether the image classifier should be visible.
     */
    open: boolean;

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

export interface ClassifyImagesAction extends AsyncAction {
    type: 'classify_images';

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

export type ImageClassifierOptions = Pick<
    OpenImageClassifierAction,
    'modelUrl' | 'modelJsonUrl' | 'modelMetadataUrl' | 'cameraType'
>;

export type ClassifyImagesOptions = Pick<
    ClassifyImagesAction,
    'modelUrl' | 'modelJsonUrl' | 'modelMetadataUrl' | 'images'
>

/**
 * An event that is used to load a simulation.
 */
declare interface LoadServerAction extends Action {
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
 */
declare interface UnloadServerAction extends Action {
    type: 'unload_server';

    /**
     * The ID of the simulation to unload.
     */
    id: string;
}

/**
 * An event that is used to unload a simulation.
 */
declare interface UnloadServerConfigAction extends Action {
    type: 'unload_server_config';

    /**
     * The config that should be used to unload the inst.
     */
    config: InstConfig;
}

/**
 * An event that is used to load an AUX from a remote location.
 */
declare interface ImportAUXAction extends Action {
    type: 'import_aux';

    /**
     * The URL to load.
     */
    url: string;
}

/**
 * Defines an event for actions that are shouted to every current loaded simulation.
 */
declare interface SuperShoutAction extends Action {
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
 * Defines an event that sends a web request to a website.
 */
declare interface SendWebhookAction extends Action {
    type: 'send_webhook';

    /**
     * The options for the webhook.
     */
    options: WebhookOptions;
}

/**
 * Defines a set of options for a webhook.
 */
declare interface WebhookOptions {
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

    /**
     * The number of retries that should be attempted for the webhook if it fails.
     * Defaults to 0.
     */
    retryCount?: number;

    /**
     * The HTTP response status codes that should allow the web request to be retried.
     * Defaults to:
     *  - 408 - Request Timeout
     *  - 429 - Too Many Requests
     *  - 500 - Internal Server Error
     *  - 502 - Bad Gateway
     *  - 503 - Service Unavailable
     *  - 504 - Gateway Timeout
     *  - 0 - Network Failure / CORS
     */
    retryStatusCodes?: number[];

    /**
     * The number of miliseconds to wait between retry requests.
     * Defaults to 3000ms (3 seconds).
     */
    retryAfterMs?: number;
}

/**
 * Defines a set of options for animateTag().
 */
declare interface AnimateTagFunctionOptions {
    /**
     * The value that should be animated from.
     * If not specified then the current tag value will be used.
     */
    fromValue?: any;

    /**
     * The value that should be animated to.
     */
    toValue: any;

    /**
     * The duration of the animation in seconds.
     */
    duration: number;

    /**
     * The time that the animation should start.
     * Should be the number of miliseconds since January 1st 1970 UTC-0. (e.g. os.localTime or os.agreedUponTime).
     */
    startTime?: number;

    /**
     * The type of easing to use.
     * If not specified then "linear" "inout" will be used.
     * 
     * Can also be a custom function that takes a single parameter and returns a number.
     * The paramater will be a number between 0 and 1 indicating the progress through the tween.
     */
    easing?: EaseType | Easing | ((progress: number) => number);

    /**
     * The space that the tag should be animated in.
     * If not specified then "tempLocal" will be used.
     * If false, then the bot will be edited instead of using tag masks.
     */
    tagMaskSpace?: BotSpace | false;
}

/**
 * Defines an event that is used to send the player to a dimension.
 */
declare interface GoToDimensionAction extends Action {
    type: 'go_to_dimension';

    /**
     * The dimension that should be loaded.
     */
    dimension: string;
}

/**
 * Defines an event that is used to show an input box to edit a tag on a bot.
 */
declare interface ShowInputForTagAction extends Action {
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
declare interface ShowInputAction extends AsyncAction {
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
declare interface SetForcedOfflineAction extends Action {
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
declare interface GoToURLAction extends Action {
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
declare interface OpenURLAction extends Action {
    type: 'open_url';

    /**
     * The URL to open.
     */
    url: string;
}

/**
 * Defines an event that is used to play a sound from the given url.
 */
declare interface PlaySoundAction extends AsyncAction {
    type: 'play_sound';

    /**
     * The URL to open.
     */
    url: string;

    /**
     * The ID of the sound.
     */
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
    soundID: number;
}

/**
 * Defines an event that is used to download a file onto the device.
 */
declare interface DownloadAction extends Action {
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

export type StoredAux = StoredAuxVersion1 | StoredAuxVersion2;

export interface StoredAuxVersion1 {
    version: 1;
    state: BotsState;
}

export interface StoredAuxVersion2 {
    version: 2;
    updates: InstUpdate[];
}

export interface AuxFileOptions {
    /**
     * The version that should be used for the output file.
     *
     * Version 1 stores bots as pure JSON and is the original version of the file format.
     * Version 2 stores bots as updates and is the new version of the file format.
     *
     * If not specifed, then version 2 will be used.
     */
    version?: 1 | 2;
}

export type InstallAuxFileMode = 'default' | 'copy';

/**
 * Defines an interface for options that a show input event can use.
 */
declare interface ShowInputOptions {
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
     * The items that should be shown in the list.
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
declare type ShowInputType = 'text' | 'color' | 'secret' | 'date' | 'list';

/**
 * Defines the possible input types.
 */
declare type ShowInputSubtype = 'basic' | 'swatch' | 'advanced' | 'select' | 'multiSelect' | 'radio' | 'checkbox';

/**
 * Defines an event that is used to show a confirmation dialog.
 */
declare interface ShowConfirmAction extends AsyncAction {
    type: 'show_confirm';

    /**
     * The options for the confirmation dialog.
     */
    options: ShowConfirmOptions;
}

/**
 * Defines an interface that represents the options that can be used for a confirmation dialog.
 */
declare interface ShowConfirmOptions {
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
 * Defines an event for actions.
 * Actions are basically user-defined events.
 */
declare interface ShoutAction {
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
declare interface RejectAction {
    type: 'reject';

    /**
     * The action to prevent.
     */
    action: Action;
}

/**
 * Defines an event that sets some text on the user's clipboard.
 */
declare interface SetClipboardAction {
    type: 'set_clipboard';

    /**
     * The text that the clipboard should be set to.
     */
    text: string;
}

/**
 * Defines an event that shows the chat bar.
 */
declare interface ShowChatBarAction {
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
declare interface ShowChatOptions {
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
declare interface RunScriptAction extends AsyncAction {
    type: 'run_script';

    /**
     * The script that should be executed.
     */
    script: string;
}

/**
 * Defines an event that shows the "upload AUX file" dialog.
 */
declare interface ShowUploadAuxFileAction {
    type: 'show_upload_aux_file';
}

/**
 * Defines an interface that represents a file that was uploaded.
 */
declare interface UploadedFile {
    /**
     * The name of the file that was uploaded.
     */
    name: string;

    /**
     * The size of the file in bytes.
     */
    size: number;

    /**
     * The MIME type of the file.
     */
    mimeType: string;

    /**
     * The data that the file contains.
     */
    data: string | ArrayBuffer;
}

/**
 * Defines an event that loads a space into the inst.
 */
declare interface LoadSpaceAction {
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
 * Defines an interface for objects that specify a tag and value
 * that a bot should have to be loaded.
 */
declare interface LoadBotsTagFilter {
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
declare interface ClearSpaceAction {
    type: 'clear_space';

    /**
     * The space to clear.
     */
    space: BotSpace;
}

/**
 * Defines an event that runs an animation locally over
 * whatever existing animations are playing.
 */
declare interface LocalFormAnimationAction {
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

declare type TweenType = 'position' | 'rotation';

declare type EaseType = 'linear' | 'quadratic' | 'cubic' | 'quartic' | 'quintic' | 'sinusoidal' | 'exponential' | 'circular' | 'elastic';

declare type EaseMode = 'in' | 'out' | 'inout';

declare interface Easing {
    type: EaseType;
    mode: EaseMode;
}

/**
 * Defines the set of possible options for tweens.
 */
declare interface TweenOptions {
    /**
     * The easing type and mode that the tween should use.
     */
    easing?: Easing;

    /**
     * The amount of time that the tween should take in seconds.
     */
    duration?: number;
}

/**
 * Defines an event that runs a tween locally.
 */
declare interface LocalTweenAction extends Action {
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
}

/**
 * Defines an event that runs a position tween locally.
 */
declare interface LocalPositionTweenAction extends LocalTweenAction {
    tweenType: 'position';

    /**
     * The target position of the tween.
     */
    position: { x?: number, y?: number, z?: number };
}

/**
 * Defines an event that runs a rotation tween locally.
 */
declare interface LocalRotationTweenAction extends LocalTweenAction {
    tweenType: 'rotation';

    /**
     * The target rotation of the tween.
     */
    rotation: { x?: number, y?: number, z?: number };
}

/**
 * Defines an interface that represents the options that an EnableARAction or EnableVRAction can have.
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
declare interface EnableARAction {
    type: 'enable_ar';

    /**
     * Whether AR features should be enabled.
     */
    enabled: boolean;
}

/**
 * Defines an event that enables VR on the device.
 */
declare interface EnableVRAction {
    type: 'enable_vr';

    /**
     * Whether VR features should be enabled.
     */
    enabled: boolean;
}

/**
 * Defines an event that checks for AR support on the device.
 */
declare interface ARSupportedAction extends AsyncAction {
    type: 'ar_supported';
}

/**
 * Defines an event that checks for VR support on the device.
 */
declare interface VRSupportedAction extends AsyncAction {
    type: 'vr_supported';
}

/**
 * Defines an event that enables POV on the device.
 */
declare interface EnablePOVAction {
    type: 'enable_pov';

    /**
     * Whether POV features should be enabled.
     */
    enabled: boolean;

    /**
     * The point that the camera should be placed at for POV.
     */
    center?: { x: number, y: number, z: number };
}

/**
 * Defines an interface that represents a wake lock configuration.
 */
declare interface WakeLockConfiguration {
    /**
     * Whether the wake lock is enabled.
     */
    enabled: boolean;
}

/**
 * An event that is used to send a command to the Jitsi Meet API.
 */
declare interface MeetCommandAction extends AsyncAction {
    type: 'meet_command',

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
 * Defines an event that shows a QR code that is a link to a inst & dimension.
 */
declare interface ShowJoinCodeAction {
    type: 'show_join_code';

    /**
     * The inst that should be joined.
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
declare interface RequestFullscreenAction {
    type: 'request_fullscreen_mode';
}

/**
 * Defines an event that exits fullscreen mode.
 */
declare interface ExitFullscreenAction {
    type: 'exit_fullscreen_mode';
}

/**
 * Defines the options that a share action can have.
 */
declare interface ShareOptions {
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
declare interface ShareAction extends AsyncAction, ShareOptions {
    type: 'share';
}

/**
 * An event that is used to show or hide the circle wipe.
 */
declare interface OpenCircleWipeAction extends AsyncAction {
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
declare interface OpenCircleWipeOptions {
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
 */
declare interface SnapPoint {
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
declare type SnapTarget = 'ground' | 'grid' | 'face' | 'bots' | SnapPoint | SnapAxis;


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
    position?: { x: number, y: number, z: number };

    /**
     * The 3D rotation of the grid.
     * If not specified, then the identity rotation is used.
     */
    rotation?: { x: number, y: number, z: number, w?: number };

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
    bounds?: { x: number, y: number };

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

export interface SnapGridTarget {
    /**
     * The 3D position that the grid should appear at.
     */
    position?: { x: number, y: number, z: number };

    /**
     * The 3D rotation that the grid should appear at.
     */
    rotation?: { x: number, y: number, z: number, w?: number };

    /**
     * The bot that defines the portal that the grid should exist in.
     * If null, then this defaults to the configBot.
     */
    portalBot?: Bot | string;

    /**
     * The tag that the portal uses to determine which dimension to show. Defaults to formAddress.
     */
    portalTag?: string;

    /**
     * The bounds of the grid.
     * Defaults to 10 x 10.
     */
    bounds?: { x: number, y: number };

    /**
     * The priority that this grid should be evaluated in over other grids.
     * Higher priorities will be evaluated before lower priorities.
     */
    priority?: number;

    /**
     * Whether to visualize the grid while a bot is being dragged.
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
 * Defines an event that registers a custom portal.
 */
export interface RegisterCustomAppAction extends AsyncAction {
    type: 'register_custom_app';

    /**
     * The ID of the portal.
     */
    portalId: string;

    /**
     * The ID of the bot that should be used to configure the portal.
     */
    botId: string;

    /**
     * Options that should be used to configure the custom portal.
     */
    options: RegisterCustomAppOptions;
}

/**
 * The options for a register custom portal action.
 */
export interface RegisterCustomAppOptions {

    /**
     * The kind of the custom portal.
     * Used to make it easy to register multiple custom portals that rely on the same kind of renderers.
     */
    kind?: string;
}


/**
 * Defines an event that notifies that the output of a portal should be updated with the given data.
 */
export interface SetAppOutputAction extends Action {
    type: 'set_app_output';

    /**
     * The ID of the portal.
     */
    portalId: string;

    /**
     * The output that the portal should show.
     */
    output: any;

    uncopiable: true;
}

/**
 * Defines an event that adds an entry point to a custom portal.
 */
declare interface RegisterPrefixAction extends AsyncAction {
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
declare interface RegisterPrefixOptions {
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
 * An interface that represents the options that can be used for making recordings.
 */
declare interface RecordingOptions {
    /**
     * Whether to record audio.
     * If an array is specified, only the specified audio sources will be recorded.
     */
    audio: boolean | ('screen' | 'microphone')[];

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
declare interface BeginRecordingAction extends AsyncAction, RecordingOptions {
    type: 'begin_recording';
}

/**
 * An event that is used to finish audio recording.
 */
declare interface EndRecordingAction extends AsyncAction {
    type: 'end_recording';
}

/**
 * Defines an interface that contains recorded data.
 */
declare interface Recording {

    /**
     * The list of files that were produced when recording.
     */
    files: RecordedFile[];
}

declare interface RecordedFile {
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


declare interface SpeakTextOptions {
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
declare interface SpeakTextAction extends AsyncAction, SpeakTextOptions {
    type: 'speak_text';

    /**
     * The text that should be spoken.
     */
    text: string;
}

/**
 * An event that is used to retrieve the synthetic voices that are supported by the current system.
 */
declare interface GetVoicesAction extends AsyncAction {
    type: 'get_voices';
}

/**
 * Defines an interface that represents a synthetic voice.
 */
declare interface SyntheticVoice {
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
declare interface GetGeolocationAction extends AsyncAction {
    type: 'get_geolocation';
}

declare interface SuccessfulGeolocation {
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
    latitude: number;

    /**
     * The longitude that the device is near.
     */
    longitude: number;

    /**
     * The accuracy of the positional location (latitude and longitude) in meters.
     */
    positionalAccuracy: number;

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

declare interface UnsuccessfulGeolocation {
    success: false;

    /**
     * The code of the error that occurred.
     */
    errorCode?: 'permission_denied' | 'position_unavailable' | 'timeout' | 'unknown';

    /**
     * The message of the error that occurred.
     */
    errorMessage?: string;
}

/**
 * Defines an interface that represents a geolocation result.
 */
declare type GeoLocation = SuccessfulGeolocation | UnsuccessfulGeolocation;

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
 * Defines an interface for options that show a payment box.
 */
declare interface CheckoutOptions {
    /**
     * The publishable API Key that should be used to checkout with stripe.
     */
    publishableKey: string;

    /**
     * The ID of the product that is being purchased.
     */
    productId: string;

    /**
     * The title that should be shown for the product.
     */
    title: string;

    /**
     * The description that should be shown for the product.
     */
    description: string;

    /**
     * The inst that the payment should be processed on.
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
declare interface PaymentRequestOptions {
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
 * Defines an interface for options that complete payment for a product.
 */
declare interface FinishCheckoutOptions {
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
    extra: any;
}

/**
 * Defines an interface for options that mark a specific time in history.
 */
declare interface MarkHistoryOptions {
    /**
     * The message that the mark should contain.
     */
    message: string;
}

/**
 * An interface that is used to say which user/device/session an event should be sent to.
 */
declare interface SessionSelector {
    username?: string;
    device?: string;
    session?: string;
    broadcast?: boolean;
}

declare interface BotTags {
    [key: string]: any;
}

/**
 * Defines an interface that represents a bot link that was parsed from a tag.
 */
declare interface ParsedBotLink {
    /**
     * The tag that the link was parsed from.
     */
    tag: string;

    /**
     * The bot IDs that the link references.
     */
    botIDs: string[];
}

declare interface BotVars {
    [variable: string]: any;
}

/**
 * Defines an interface that represents the bot links a bot can have.
 */
declare interface BotLinks {
    [tag: string]: Bot | Bot[];
}

/**
 * Defines the basic structure of a bot.
 */
export interface Bot {
    /**
     * The ID of the bot.
     */
    id: string;

    /**
     * The link to this bot.
     */
    link: string;

    /**
     * The space the bot lives in.
     */
    space?: BotSpace;

    /**
     * The calculated tag values that the bot contains.
     */
    tags: BotTags;

    /**
     * The tag masks that are applied to the bot.
     */
    masks: BotTags;

    /**
     * The links that this bot has to other bots.
     */
    links: BotLinks;

    /**
     * THe variables that are stored in this bot.
     */
    vars: BotVars;

    /**
     * The raw tag values that the bot contains.
     * If you want to access the script code for a formula, use this.
     * Otherwise, use the tags property.
     */
    raw: BotTags;

    /**
     * The tags that have been changed on this bot.
     */
    changes: BotTags;

    /**
     * The tag masks that have been changed on this bot.
     */
    maskChanges: {
        [space: string]: BotTags;
    };
}

/**
 * Defines the possible bot anchor points.
 */
declare type BotAnchorPoint =
    | 'top'
    | 'front'
    | 'back'
    | 'left'
    | 'right'
    | 'bottom'
    | 'center'
    | [number, number, number];

/**
 * Defines an interface for the state that an AUX bot can contain.
 */
declare interface BotsState {
    [id: string]: Bot;
}

declare type PartialBot = Partial<Bot>;

declare interface PartialBotsState {
    [id: string]: PartialBot;
}

/**
 * The possible bot spaces.
 *
 * - "shared" means that the bot is a normal bot.
 * - "local" means that the bot is stored in the local storage partition.
 * - "tempLocal" means that the bot is stored in the temporary partition.
 * - "history" means that the bot represents a version of another space.
 * - "admin" means that the bot is shared across all instances.
 * - "tempShared" means that the bot is temporary and shared with other devices.
 * - "remoteTempShared" means that the bot is temporary and shared with this device from a remote device.
 * - "certified" means that the bot is a certificate.
 */
export type BotSpace =
    | 'shared'
    | 'local'
    | 'tempLocal'
    | 'history'
    | 'admin'
    | 'tempShared'
    | 'remoteTempShared'
    | 'certified';

/**
 * The possible spaces that records can be stored in.
 * 
 * - "tempGlobal" means that the record is temporary and available to anyone.
 * - "tempRestricted" means that the record is temporary and available to a specific user.
 * - "permanentGlobal" means that the record is permanent and available to anyone.
 * - "permanentRestricted" means that the record is permanent and available to a specific user.
 */
export type RecordSpace =
    | 'tempGlobal'
    | 'tempRestricted'
    | 'permanentGlobal'
    | 'permanentRestricted';

/**
 * The possible portal types.
 */
declare type PortalType =
    | 'grid'
    | 'miniGrid'
    | 'menu'
    | 'sheet'
    | 'system'
    | string;

/**
 * Defines a tag filter. It can be either a function that accepts a tag value and returns true/false or it can be the value that the tag value has to match.
 */
declare type TagFilter =
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
 * - `inDimension(dimension)`
 * - `atPosition(dimension, x, y)`
 * - `inStack(bot, dimension)`
 * - `neighboring(bot, dimension, direction)`
 * - `either(filter1, filter2)`
 * - `not(filter)`
 */
declare interface BotFilterFunction {
    (bot: Bot): boolean;
    sort?: (bot: Bot) => any;
}

/**
 * Defines a result from a webhook.
 */
declare interface WebhookResult {
    /**
     * The data returned from the webhook.
     * If the returned data was JSON, then this will be an object.
     * Otherwise, it will be a string.
     */
    data: any;

    /**
     * The HTTP status code number that was returned.
     */
    status: number;

    /**
     * The name of the status code that was returned.
     */
    statusText: string;

    /**
     * The HTTP headers that were returned with the response.
     */
    headers: {
        [key: string]: string
    }
}

/**
 * Defines a type that represents a mod.
 * That is, a set of tags that can be applied to another bot.
 */
declare type Mod = BotTags | Bot;

/**
 * Defines a point in 3D space.
 */
declare interface Point3D {
    /**
     * The X position of the point.
     */
    x: number;

    /**
     * The Y position of the point.
     */
    y: number;

    /**
     * The Z position of the point.
     */
    z: number;
}

/**
 * Defines a 3D rotation as Euler angles or a Quaternion.
 */
declare interface RawRotation {
    /**
     * The amount to rotate around the X axis in radians.
     */
    x: number;

    /**
     * The amount to rotate around the Y axis in radians.
     */
    y: number;

    /**
     * The amount to rotate around the Z axis in radians.
     */
    z: number;

    /**
     * The real part of the quaternion.
     * If provided, then the value will be interpreted as a quaternion.
     * Otherwise, it will be interpreted as euler angles.
     */
    w?: number;
}

/**
 * Defines an interface that contains performance statistics about a inst.
 */
declare interface PerformanceStats {
    /**
     * The number of bots in the inst.
     */
    numberOfBots: number;

    /**
     * A list of listen tags and the amount of time spent executing them (in miliseconds).
     * Useful to guage if a listen tag is causing the inst to slow down.
     */
    shoutTimes: {
        tag: string;
        timeMs: number;
    }[];

    /**
     * The total number of active setTimeout() and setInterval() timers that are active.
     */
    numberOfActiveTimers: number;

    /**
     * An object containing information about the load performance of various pieces of CasualOS.
     */
    loadTimes: {
        [key: string]: number;
    }
}

/**
 * Defines an interface for a function that provides HTML VDOM capabilities to bots.
 */
export interface HtmlFunction {
    (...args: any[]): any;
    h: (name: string | Function, props: any, ...children: any[]) => any;
    f: any;
}

/**
 * Defines an interface for a tag mapper.
 */
export interface TagMapper {
    /**
     * Maps a tag name from its internal name to the name that should be used by the frontend.
     */
    forward: (name: string) => string;

    /**
     * Maps a tag name from its frontend name to the name that is used internally.
     */
    reverse: (name: string) => string;
}

/**
 * Defines an interface that contains options for attaching a debugger.
 */
export interface AttachDebuggerOptions {
    /**
     * Gets the tag name mapper that should be used.
     * This is useful for ensuring that the debugger objects utilize different tag names for the front end.
     */
    tagNameMapper?: TagMapper;
}

/** 
 * Defines an interface that contains options for a debugger.
*/
export interface CommonDebuggerOptions {
    /**
     * Whether to use "real" UUIDs instead of predictable ones.
     */
    useRealUUIDs: boolean;

    /**
     * Whether to allow scripts to be asynchronous.
     * If false, then all scripts will be forced to be synchronous.
     * Defaults to true.
     */
    allowAsynchronousScripts: boolean;

    /**
    * The data that the configBot should be created from.
    * Can be a mod or another bot.
    */
    configBot: Bot | BotTags;
}

export interface NormalDebuggerOptions extends CommonDebuggerOptions {
    pausable: false;
}

export interface PausableDebuggerOptions extends CommonDebuggerOptions {
    pausable: true;
}

/**
 * Defines an interface that represents the result of a "create public record key" operation.
 */
export type CreatePublicRecordKeyResult =
    | CreatePublicRecordKeySuccess
    | CreatePublicRecordKeyFailure;

/**
 * Defines an interface that represents a successful "create public record key" result.
 */
export interface CreatePublicRecordKeySuccess {
    /**
     * Whether the operation was successful.
     */
    success: true;

    /**
     * The key that was created.
     */
    recordKey: string;

    /**
     * The name of the record the key was created for.
     */
    recordName: string;
}

/**
 * Defines an interface that represents a failed "create public record key" result.
 */
export interface CreatePublicRecordKeyFailure {
    /**
     * Whether the operation was successful.
     */
    success: false;

    /**
     * The type of error that occurred.
     */
     errorCode:
        | UnauthorizedToCreateRecordKeyError
        | NotLoggedInError
        | 'unacceptable_session_key'
        | 'invalid_key'
        | 'session_expired'
        | 'invalid_policy'
        | ServerError
        | 'not_supported';

    /**
     * The error message.
     */
    errorMessage: string;

    /**
     * The unique reason as to why the error occurred.
     */
    errorReason: 
    | 'user_denied'
    | NotLoggedInError
    | 'record_owned_by_different_user'
    | 'invalid_policy'
    | 'not_supported'
    | ServerError;
}

/**
 * Defines an error that occurs when a user is not authorized to create a key for the public record.
 * This may happen when the user is not the owner of the record.
 */
export type UnauthorizedToCreateRecordKeyError =
    'unauthorized_to_create_record_key';

/**
 * Defines an error that occurs when an unspecified error occurs while creating a public record key.
 */
export type InvalidRecordKey = 'invalid_record_key';

/**
 * Defines an error that occurs when an unspecified error occurs while creating a public record key.
 */
export type ServerError = 'server_error';

/**
 * Defines an error that occurs when a feature is not supported.
 */
export type NotSupportedError = 'not_supported';

/**
 * Defines an error that occurs when the user is not logged in but they are required to be in order to perform an action.
 */
export type NotLoggedInError = 'not_logged_in';

export type RecordNotFoundError = 'record_not_found';

/**
 * Defines an error that occurs when the user does not have the right permissions to perform an action.
 */
export type NotAuthorizedError = 'not_authorized';


export type AuthorizeDeniedError = ServerError
| CreatePublicRecordKeyFailure['errorCode']
| 'action_not_supported'
| 'not_logged_in'
| NotAuthorizedError
| 'unacceptable_request'
| 'subscription_limit_reached';

export type UpdateUserPolicyError = 'policy_too_large';

export type GetPolicyError = 'policy_not_found';

/**
 * Defines a type that represents a policy that indicates which users are allowed to affect a record.
 * 
 * True indicates that any user can edit the record.
 * An array of strings indicates the list of users that are allowed to edit the record.
 */
export type RecordUserPolicyType = true | string[];

/**
 * Defines an interface that represents the base for options for a records action.
 */
export interface RecordActionOptions {
    /**
     * The HTTP endpoint that the request should interface with.
     */
    endpoint?: string;
}

/**
 * The possible types of subjects that can be affected by permissions.
 *
 * - "user" - The permission is for a user.
 * - "inst" - The permission is for an inst.
 * - "role" - The permission is for a role.
 *
 * @dochash types/permissions
 * @doctitle Permissions Types
 * @docsidebar Permissions
 * @docdescription Types that represent permissions that control access to resources.
 * @docname SubjectType
 */
export type SubjectType = 'user' | 'inst' | 'role';

/**
 * The possible types of permissions that can be added to policies.
 *
 * @dochash types/permissions
 * @doctitle Permissions Types
 * @docsidebar Permissions
 * @docdescription Types that represent permissions that control access to resources.
 * @docname AvailablePermissions
 */
export type AvailablePermissions =
    | DataPermission
    | FilePermission
    | EventPermission
    | MarkerPermission
    | RolePermission
    | InstPermission;

/**
 * Defines an interface that describes common options for all permissions.
 */
export interface Permission {
    /**
     * The marker that the permission is for.
     * If null or undefined, then the permission is for a specific resource instead of a marker.
     */
    marker?: string;

    /**
     * The type of the subject that the permission is for.
     *
     * "user" - The permission is for a user.
     * "inst" - The permission is for an inst.
     * "role" - The permission is for a role.
     */
    subjectType: SubjectType;

    /**
     * The ID of the subject.
     */
    subjectId: string;

    /**
     * The ID of the resource that is allowed.
     * If null, then all resources are allowed.
     */
    resourceId?: string | null;

    /**
     * The options for the permission.
     */
    options: {};

    /**
     * The unix time in miliseconds that the permission will expire at.
     * If null, then the permission does not expire.
     */
    expireTimeMs: number | null;
}


/**
 * Defines an interface that describes the common options for all permissions that affect data records.
 *
 * @dochash types/permissions
 * @docname DataPermission
 */
export interface DataPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'data';

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: DataActionKinds | null;
}

/**
 * Options for file permissions.
 *
 * @dochash types/permissions
 * @docname FilePermissionOptions
 */
export interface FilePermissionOptions {
    /**
     * The maximum allowed file size in bytes.
     * Defaults to Infinity.
     */
    maxFileSizeInBytes?: number;

    /**
     * The list of allowed file MIME types.
     * If true, then all file types are allowed.
     * If an array of strings, then only MIME types that are specified are allowed.
     */
    allowedMimeTypes?: true | string[];
}


/**
 * Defines an interface that describes the common options for all permissions that affect file records.
 *
 * @dochash types/permissions
 * @docname FilePermission
 */
export interface FilePermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'file';

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: FileActionKinds | null;

    /**
     * The options for the permission.
     */
    options: FilePermissionOptions;
}


/**
 * Defines an interface that describes the common options for all permissions that affect event records.
 *
 * @dochash types/permissions
 * @docname EventPermission
 */
export interface EventPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'event';

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: EventActionKinds | null;
}


/**
 * Defines an interface that describes the common options for all permissions that affect markers.
 *
 * @dochash types/permissions
 * @docname MarkerPermission
 */
export interface MarkerPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'marker';

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: MarkerActionKinds | null;
}


/**
 * Options for role permissions.
 *
 * @dochash types/permissions
 * @docname RolePermissionOptions
 */
export interface RolePermissionOptions {
    /**
     * The maximum lifetime that the role can be granted for in miliseconds.
     * If not specified, then the role can be granted for an infinite amount of time.
     */
    maxDurationMs?: number;
}


/**
 * Defines an interface that describes the common options for all permissions that affect roles.
 *
 * @dochash types/permissions
 * @docname RolePermission
 */
export interface RolePermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'role';

    /**
     * The ID of the resource that is allowed.
     * If null, then all resources are allowed.
     */
    resourceId: string | null;

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: RoleActionKinds | null;

    /**
     * The options for the permission.
     */
    options: RolePermissionOptions;
}


/**
 * Defines an interface that describes common options for all permissions that affect insts.
 *
 * @dochash types/permissions
 * @docname InstPermission
 */
export interface InstPermission extends Permission {
    /**
     * The kind of the permission.
     */
    resourceKind: 'inst';

    /**
     * The ID of the resource that is allowed.
     * If null, then all resources are allowed.
     */
    resourceId: string | null;

    /**
     * The action th at is allowed.
     * If null, then all actions are allowed.
     */
    action: InstActionKinds | null;
}

/**
 * The possible types of actions that can be performed on data resources.
 *
 * @dochash types/permissions
 * @docname DataActionKinds
 */
export type DataActionKinds = 'read' | 'create' | 'update' | 'delete' | 'list';

/**
 * The possible types of actions that can be performed on file resources.
 *
 * @dochash types/permissions
 * @docname FileActionKinds
 */
export type FileActionKinds = 'read' | 'create' | 'update' | 'delete' | 'list';

/**
 * The possible types of actions that can be performed on event resources.
 *
 * @dochash types/permissions
 * @docname EventActionKinds
 */
export type EventActionKinds = 'increment' | 'count' | 'update' | 'list';

/**
 * The possible types of actions that can be performed on marker resources.
 *
 * @dochash types/permissions
 * @docname MarkerActionKinds
 */
export type MarkerActionKinds =
    | 'assign'
    | 'unassign'
    | 'grantPermission'
    | 'revokePermission'
    | 'read';

/**
 * The possible types of actions that can be performed on roles resources.
 *
 * @dochash types/permissions
 * @docname RoleActionKinds
 */
export type RoleActionKinds = 'grant' | 'revoke' | 'read' | 'update' | 'list';

/**
 * The possible types of actions that can be performed on inst resources.
 *
 * @dochash types/permissions
 * @docname InstActionKinds
 */
export type InstActionKinds =
    | 'create'
    | 'read'
    | 'update'
    | 'updateData'
    | 'delete'
    | 'list'
    | 'sendAction';


/**
 * Defines the possible results of granting a permission to a marker.
 *
 * @dochash types/records/policies
 * @doctitle Policy Types
 * @docsidebar Policies
 * @docdescription Types for working with policies.
 * @docgroup 01-grant
 * @docorder 0
 * @docname GrantMarkerPermissionResult
 */
export type GrantMarkerPermissionResult =
    | GrantMarkerPermissionSuccess
    | GrantMarkerPermissionFailure;

/**
 * Defines an interface that represents a successful request to grant a marker permission to a policy.
 *
 * @dochash types/records/policies
 * @docgroup 01-grant
 * @docorder 1
 * @docname GrantMarkerPermissionSuccess
 */
export interface GrantMarkerPermissionSuccess {
    success: true;
}

/**
 * Defines an interface that represents a failed request to grant a marker permission to a policy.
 *
 * @dochash types/records/policies
 * @docgroup 01-grant
 * @docorder 2
 * @docname GrantMarkerPermissionFailure
 */
export interface GrantMarkerPermissionFailure {
    success: false;

    /**
     * The error code that indicates why the request failed.
     */
    errorCode:
        | ServerError
        | AuthorizeDeniedError;

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;
}


/**
 * Defines the possible results of granting a permission to a resource.
 *
 * @dochash types/records/policies
 * @docname GrantResourcePermissionResult
 */
export type GrantResourcePermissionResult =
    | GrantResourcePermissionSuccess
    | GrantResourcePermissionFailure;

/**
 * Defines an interface that represents a successful request to grant a permission to a resource.
 *
 * @dochash types/records/policies
 * @docgroup 01-grant
 * @docorder 1
 * @docname GrantResourcePermissionSuccess
 */
export interface GrantResourcePermissionSuccess {
    success: true;
}

/**
 * Defines an interface that represents a failed request to grant a permission to a resource.
 *
 * @dochash types/records/policies
 * @docgroup 01-grant
 * @docorder 2
 * @docname GrantResourcePermissionFailure
 */
export interface GrantResourcePermissionFailure {
    success: false;

    /**
     * The error code that indicates why the request failed.
     */
    errorCode:
        | ServerError
        | AuthorizeDeniedError;

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;
}

/**
 * Defines the possible results of revoking a permission.
 *
 * @dochash types/records/policies
 * @docgroup 02-revoke
 * @docorder 0
 * @docname RevokeMarkerPermissionResult
 */
export type RevokePermissionResult =
    | RevokePermissionSuccess
    | RevokePermissionFailure;

/**
 * Defines an interface that represents a successful request to revoke a permission.
 *
 * @dochash types/records/policies
 * @docgroup 02-revoke
 * @docorder 1
 * @docname RevokePermissionSuccess
 */
export interface RevokePermissionSuccess {
    success: true;
}

/**
 * Defines an interface that represents a failed request to revoke a permission.
 *
 * @dochash types/records/policies
 * @docgroup 02-revoke
 * @docorder 2
 * @docname RevokePermissionFailure
 */
export interface RevokePermissionFailure {
    success: false;

    /**
     * The error code that indicates why the request failed.
     */
    errorCode:
        | ServerError
        | 'permission_not_found'
        | AuthorizeDeniedError;

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;
}

/**
 * Defines the possible results of revoking a role.
 *
 * @dochash types/records/roles
 * @docgroup 01-revoke
 * @docorder 0
 * @docname RevokeRoleResult
 */
export type RevokeRoleResult = RevokeRoleSuccess | RevokeRoleFailure;

/**
 * Defines an interface that represents a successful request to revoke a role.
 *
 * @dochash types/records/roles
 * @docgroup 01-revoke
 * @docorder 1
 * @docname RevokeRoleSuccess
 */
export interface RevokeRoleSuccess {
    success: true;
}

/**
 * Defines an interface that represents a failed request to revoke a role.
 *
 * @dochash types/records/roles
 * @docgroup 01-revoke
 * @docorder 2
 * @docname RevokeRoleFailure
 */
export interface RevokeRoleFailure {
    success: false;

    /**
     * The error code that indicates why the request failed.
     */
    errorCode:
        | ServerError
        | AuthorizeDeniedError;

    /**
     * The error message that indicates why the request failed.
     */
    errorMessage: string;
}

export type GrantRoleResult = GrantRoleSuccess | GrantRoleFailure;

export interface GrantRoleSuccess {
    success: true;
}

export interface GrantRoleFailure {
    success: false;
    errorCode:
        | ServerError
        | AuthorizeDeniedError
        | 'roles_too_large';
    errorMessage: string;
}

/**
 * The options for data record actions.
 */
 export interface RecordDataOptions {
    /**
     * The HTTP Endpoint that should be queried.
     */
    endpoint?: string;

    /**
     * The policy that should be used for updating the record.
     */
    updatePolicy?: RecordUserPolicyType;

    /**
     * The policy that should be used for deleting the record.
     */
    deletePolicy?: RecordUserPolicyType;

    /**
     * The markers that should be applied to the record.
     */
    markers?: string[];

    /**
     * The marker that should be applied to the record.
     */
    marker?: string;
}

/**
 * Defines an interface that represents the options for a list data action.
 *
 * @dochash types/records/data
 * @docName ListDataOptions
 */
export interface ListDataOptions extends RecordActionOptions {

    /**
     * The order that items should be sorted in.
     * - "ascending" means that the items should be sorted in alphebatically ascending order by address.
     * - "descending" means that the items should be sorted in alphebatically descending order by address.
     */
    sort?: 'ascending' | 'descending';
}

export type RecordDataResult = RecordDataSuccess | RecordDataFailure;

export interface RecordDataSuccess {
    success: true;
    recordName: string;
    address: string;
}

export interface RecordDataFailure {
    success: false;
    errorCode:
    | ServerError
    | NotLoggedInError
    | InvalidRecordKey
    | RecordNotFoundError
    | NotSupportedError
    | 'not_authorized'
    | 'data_too_large';
    errorMessage: string;
}

export type GetDataResult = GetDataSuccess | GetDataFailure;

/**
 * Defines an interface that represents a successful "get data" result.
 */
export interface GetDataSuccess {
    success: true;

    /**
     * The data that was stored.
     */
    data: any;

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The ID of the user that owns the record.
     */
    publisherId: string;

    /**
     * The ID of the user that sent the data.
     */
    subjectId: string;
}

export interface GetDataFailure {
    success: false;
    errorCode: ServerError | 'data_not_found' | 'not_authorized' | NotSupportedError;
    errorMessage: string;
}


export type ListDataResult = ListDataSuccess | ListDataFailure;

export interface ListDataSuccess {
    success: true;
    recordName: string;
    items: {
        data: any;
        address: string;
    }[];
}

export interface ListDataFailure {
    success: false;
    errorCode:
    | ServerError
    | NotSupportedError;
    errorMessage: string;
}


export type EraseDataResult = EraseDataSuccess | EraseDataFailure;

export interface EraseDataSuccess {
    success: true;
    recordName: string;
    address: string;
}

export interface EraseDataFailure {
    success: false;
    errorCode: ServerError
    | NotLoggedInError
    | InvalidRecordKey
    | RecordNotFoundError
    | NotSupportedError
    | 'not_authorized'
    | 'data_not_found';
    errorMessage: string;
}


export type RecordFileResult = RecordFileSuccess | RecordFileFailure;

export interface RecordFileSuccess {
    success: true;

    /**
     * The URL that the file can be accessed at.
     */
    url: string;

    /**
     * The SHA-256 hash of the file.
     * When downloading the URL, the resulting data is guaranteed to have a SHA-256 hash that matches this value.
     */
    sha256Hash: string;
}

export interface RecordFileFailure {
    success: false;
    errorCode:
    | ServerError
    | NotLoggedInError
    | InvalidRecordKey
    | RecordNotFoundError
    | 'file_already_exists'
    | NotSupportedError
    | 'invalid_file_data';
    errorMessage: string;
}


export type EraseFileResult = EraseFileSuccess | EraseFileFailure;
export interface EraseFileSuccess {
    success: true;
    recordName: string;
    fileName: string;
}

export interface EraseFileFailure {
    success: false;
    errorCode: ServerError
    | InvalidRecordKey
    | RecordNotFoundError
    | NotLoggedInError
    | NotSupportedError
    | 'file_not_found';
    errorMessage: string;
}


export type AddCountResult = AddCountSuccess | AddCountFailure;

export interface AddCountSuccess {
    success: true;
    recordName: string;
    eventName: string;
    countAdded: number;
}

export interface AddCountFailure {
    success: false;
    errorCode:
    | ServerError
    | NotLoggedInError
    | InvalidRecordKey
    | RecordNotFoundError
    | NotSupportedError
    errorMessage: string;
}

export type GetCountResult = GetCountSuccess | GetCountFailure;

/**
 * Defines an interface that represents a successful "get data" result.
 */
export interface GetCountSuccess {
    success: true;

    /**
     * The total count of events.
     */
    count: number;

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The name of the event.
     */
    eventName: string;
}

export interface GetCountFailure {
    success: false;
    errorCode:
    | ServerError
    | NotSupportedError;
    errorMessage: string;
}

/**
 * Defines the list of possible results for the {@link os.listUserStudios} function.
 *
 * @dochash types/records/studios
 * @doctitle Studio Types
 * @docsidebar Studios
 * @docdescription Types that are used for actions that manage studios.
 * @docname ListStudiosResult
 */
export type ListStudiosResult = ListStudiosSuccess | ListStudiosFailure;

/**
 * Defines an interface that represents a successful "list studios" result.
 * 
 * @dochash types/records/studios
 * @docname ListStudiosSuccess
 */
export interface ListStudiosSuccess {
    success: true;

    /**
     * The list of studios that the user is a member of.
     */
    studios: ListedStudio[];
}

/**
 * Defines an interface that represents a failed "list studios" result.
 * 
 * @dochash types/records/studios
 * @docname ListStudiosFailure
 */
export interface ListStudiosFailure {
    success: false;
    
    /**
     * The error code.
     */
    errorCode: NotLoggedInError | NotAuthorizedError | ServerError;

    /**
     * The error message.
     */
    errorMessage: string;
}

/**
 * Defines an interface that represents a studio that a user has access to.
 * 
 * @dochash types/records/studios
 * @docname ListedStudio
 */
export interface ListedStudio {
    /**
     * The ID of the studio.
     */
    studioId: string;

    /**
     * The name of the studio.
     */
    displayName: string;

    /**
     * The role that the user has in the studio.
     */
    role: StudioAssignmentRole;

    /**
     * Whether the user is the primary contact for this studio.
     */
    isPrimaryContact: boolean;

    /**
     * The tier of the studio's subscription.
     */
    subscriptionTier: string;
}

/**
 * Defines the list of possible studio roles that a user can be assigned.
 *
 * @dochash types/records/studios
 * @docname StudioAssignmentRole
 */
export type StudioAssignmentRole = 'admin' | 'member';


export type JoinRoomResult = JoinRoomSuccess | JoinRoomFailure;

export interface JoinRoomSuccess {
    success: true;
    roomName: string;
}

export interface JoinRoomFailure {
    success: false;
    roomName: string;
    errorCode: string;
    errorMessage: string;
}

export type LeaveRoomResult = LeaveRoomSuccess | LeaveRoomFailure;

export interface LeaveRoomSuccess {
    success: true;
    roomName: string;
}

export interface LeaveRoomFailure {
    success: false;
    roomName: string;
    errorCode: string;
    errorMessage: string;
}

export type SetRoomOptionsResult = SetRoomOptionsSuccess | SetRoomOptionsFailure;

export interface SetRoomOptionsSuccess {
    success: true;
    roomName: true;
}

export interface SetRoomOptionsFailure {
    success: false;
    roomName: string;
    errorCode: string;
    errorMessage: string;
}

export type GetRoomOptionsResult = GetRoomOptionsSuccess | GetRoomOptionsFailure;

export interface GetRoomOptionsSuccess {
    success: true;
    roomName: string;
    options: RoomOptions;
}

export interface GetRoomOptionsFailure {
    success: false;
    errorCode: string;
    errorMessage: string;
}

/**
 * Defines a set of options that the local user can have for a room.
 */
export interface RoomOptions {
    /**
     * Whether to stream video.
     * Defaults to true.
     */
     video?: boolean;

     /**
      * Whether to stream audio.
      * Defaults to true.
      */
     audio?: boolean;
 
     /**
      * Whether to stream the screen.
      * Defaults to false.
      */
     screen?: boolean;
}


export type GetRoomTrackOptionsResult =
    | GetRoomTrackOptionsSuccess
    | GetRoomTrackOptionsFailure;

export interface GetRoomTrackOptionsSuccess {
    success: true;
    roomName: string;
    address: string;
    options: RoomTrackOptions;
}

export interface GetRoomTrackOptionsFailure {
    success: false;
    errorCode: string;
    errorMessage: string;
    roomName: string;
    address: string;
}

export type SetRoomTrackOptionsResult =
    | SetRoomTrackOptionsSuccess
    | SetRoomTrackOptionsFailure;

export interface SetRoomTrackOptionsSuccess {
    success: true;
    roomName: string;
    address: string;
    options: RoomTrackOptions;
}

export interface SetRoomTrackOptionsFailure {
    success: false;
    errorCode: string;
    errorMessage: string;
    roomName: string;
    address: string;
}

export interface SetRoomTrackOptions {
    /**
     * Whether to mute the track locally.
     * This will prevent the track from streaming from the server to this device.
     */
    muted?: boolean;

    /**
     * The video quality that the track should stream at.
     */
    videoQuality?: TrackVideoQuality;
}

export interface RoomTrackOptions {
    /**
     * Whether the track is being sourced from a remote user.
     */
    isRemote: boolean;

    /**
     * The ID of the remote that is publishing this track.
     */
    remoteId: string;

    /**
     * Whether the track is muted locally.
     */
    muted: boolean;

    /**
     * The type of the track.
     */
    kind: TrackKind;

    /**
     * The source of the track.
     */
    source: TrackSource;

    /**
     * The video quality of the track if the track represents video.
     */
    videoQuality?: TrackVideoQuality;

    /**
     * The dimensions of the video if the track represents a video.
     */
    dimensions?: { width: number, height: number };

    /**
     * The aspect ratio of the video if the track represents a video.
     */
    aspectRatio?: number;
}

/**
 * The possible kinds of tracks.
 */
export type TrackKind = 'video' | 'audio';

/**
 * The possible sources for a room track.
 */
export type TrackSource = 'camera' | 'microphone' | 'screen_share' | 'screen_share_audio';

/**
 * The possible video qualities for a room track.
 */
export type TrackVideoQuality = 'high' | 'medium' | 'low' | 'off';

export interface JoinRoomActionOptions extends Partial<RoomOptions> {
    /**
     * The HTTP endpoint of the records website that should host the meeting.
     * If omitted, then the preconfigured records endpoint will be used.
     */
     endpoint?: string;

    /**
     * The defaults that should be used for recording audio.
     * Should be an object.
     * See https://docs.livekit.io/client-sdk-js/interfaces/AudioCaptureOptions.html for a full list of properties.
     */
     audioCaptureDefaults: object;

     /**
      * The defaults that should be used for recording video. Should be an object.
      * See https://docs.livekit.io/client-sdk-js/interfaces/VideoCaptureOptions.html for a full list of properties.
      */
     videoCaptureDefaults: object;
 
     /**
      * The defaults that should be used for uploading audio/video content.
      * See https://docs.livekit.io/client-sdk-js/interfaces/TrackPublishDefaults.html for a full list of properties.
      */
     publishDefaults: object;
 
     /**
      * Whether to enable dynacast.
      * See https://docs.livekit.io/client-sdk-js/interfaces/RoomOptions.html#dynacast for more info.
      */
     dynacast: boolean;
 
     /**
      * Whether to enable adaptive streaming. Alternatively accepts an object with properties from this page: https://docs.livekit.io/client-sdk-js/modules.html#AdaptiveStreamSettings
      */
     adaptiveStream: boolean | object;
}

export interface LeaveRoomActionOptions {
    /**
     * The HTTP endpoint of the records website that should host the meeting.
     * If omitted, then the preconfigured records endpoint will be used.
     */
     endpoint?: string;
}

export type GetRoomRemoteOptionsResult =
    | GetRoomRemoteOptionsSuccess
    | GetRoomRemoteOptionsFailure;

export interface GetRoomRemoteOptionsSuccess {
    success: true;
    roomName: string;
    remoteId: string;
    options: RoomRemoteOptions;
}

export interface GetRoomRemoteOptionsFailure {
    success: false;
    errorCode: string;
    errorMessage: string;
    roomName: string;
    remoteId: string;
}

/**
 * Defines an interface that contains options for a remote room user.
 */
export interface RoomRemoteOptions {
    /**
     * Gets the connection quality of the remote user.
     */
    connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';

    /**
     * Whether the remote user has enabled their camera video.
     */
    video: boolean;

    /**
     * Whether the remote user has enabled their microphone audio.
     */
    audio: boolean;

    /**
     * Whether the remote user has enabled their screen share.
     */
    screen: boolean;

    /**
     * The audio level that is being transmitted by the user.
     * Between 0 and 1 with 1 being the loudest and 0 being the quietest.
     */
    audioLevel: number;
}

/**
 * Defines an interface that represents an update that has been applied to an inst.
 */
 export interface InstUpdate {
    /**
     * The ID of the update.
     */
    id: number;

    /**
     * The update content.
     */
    update: string;

    /**
     * The time that the update occurred at.
     */
    timestamp: number;
}

export interface AudioRecordingOptions {
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
 * Defines an interface for a random number generator.
 */
export interface PseudoRandomNumberGenerator {
    /**
     * The seed used for this random number generator.
     * If null then an unpredictable seed was used.
     */
    seed: number | string | null;

    /**
     * Generates a random number between 0 and 1.
     */
    random(): number;

    /**
     * Generates a random decimal number between the given min and max values.
     * @param min The minimum output number.
     * @param max The maximum output number.
     */
    random(min?: number, max?: number): number;

    /**
     * Generates a random integer between the given min and max values.
     * @param min The minimum output number.
     * @param max The maximum output number.
     */
    randomInt(min: number, max: number): number;
}


// Luxon Types Copyright
// MIT License

// Copyright (c) Microsoft Corporation.

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE

export interface ZoneOffsetOptions {
    /**
     * What style of offset to return.
     */
    format?: 'short' | 'long' | undefined;
    /**
     * What locale to return the offset name in.
     */
    locale?: string | undefined;
}

/**
 * What style of offset to return.
 * Returning '+6', '+06:00', or '+0600' respectively
 */
export type ZoneOffsetFormat = 'narrow' | 'short' | 'techie';

declare class Zone {
    /**
     * The type of zone
     */
    get type(): string;

    /**
     * The name of this zone.
     */
    get name(): string;

    /**
     * Returns whether the offset is known to be fixed for the whole year.
     */
    get isUniversal(): boolean;

    /**
     * Returns the offset's common name (such as EST) at the specified timestamp
     *
     * @param ts - Epoch milliseconds for which to get the name
     * @param options - Options to affect the format
     * @param options.format - What style of offset to return.
     * @param options.locale - What locale to return the offset name in.
     */
    offsetName(ts: number, options: ZoneOffsetOptions): string;

    /**
     * Returns the offset's value as a string
     *
     * @param ts - Epoch milliseconds for which to get the offset
     * @param format - What style of offset to return.
     *                 Accepts 'narrow', 'short', or 'techie'. Returning '+6', '+06:00', or '+0600' respectively
     */
    formatOffset(ts: number, format: ZoneOffsetFormat): string;

    /**
     * Return the offset in minutes for this zone at the specified timestamp.
     *
     * @param ts - Epoch milliseconds for which to compute the offset
     */
    offset(ts: number): number;

    /**
     * Return whether this Zone is equal to another zone
     *
     * @param other - the zone to compare
     */
    equals(other: Zone): boolean;

    /**
     * Return whether this Zone is valid.
     */
    get isValid(): boolean;
}

/**
 * A zone identified by an IANA identifier, like America/New_York
 */
declare class IANAZone extends Zone {
    /**
     * Same as constructor but has caching.
     */
    static create(name: string): IANAZone;

    /**
     * Reset local caches. Should only be necessary in testing scenarios.
     */
    static resetCache(): void;

    /**
     * Returns whether the provided string is a valid specifier.
     * This only checks the string's format, not that the specifier
     * identifies a known zone; see {@link isValidZone} for that.
     *
     * @param s - The string to check validity on
     *
     * @example
     * IANAZone.isValidSpecifier("America/New_York") //=> true
     * @example
     * IANAZone.isValidSpecifier("Fantasia/Castle") //=> true
     * @example
     * IANAZone.isValidSpecifier("Sport~~blorp") //=> false
     */
    static isValidSpecifier(s: string): boolean;

    /**
     * Returns whether the provided string identifies a real zone
     *
     * @param zone - The string to check
     *
     * @example
     * IANAZone.isValidZone("America/New_York") //=> true
     * @example
     * IANAZone.isValidZone("Fantasia/Castle") //=> false
     * @example
     * IANAZone.isValidZone("Sport~~blorp") //=> false
     */
    static isValidZone(zone: string): boolean;

    constructor(name: string);
}

/**
 * A zone with a fixed offset (meaning no DST)
 */
declare class FixedOffsetZone extends Zone {
    /**
     * Get a singleton instance of UTC
     */
    static get utcInstance(): FixedOffsetZone;

    /**
     * Get an instance with a specified offset
     *
     * @param offset - The offset in minutes
     */
    static instance(offset: number): FixedOffsetZone;

    /**
     * Get an instance of FixedOffsetZone from a UTC offset string, like "UTC+6"
     *
     * @param s - The offset string to parse
     *
     * @example
     * FixedOffsetZone.parseSpecifier("UTC+6")
     * @example
     * FixedOffsetZone.parseSpecifier("UTC+06")
     * @example
     * FixedOffsetZone.parseSpecifier("UTC-6:00")
     */
    static parseSpecifier(s: string): FixedOffsetZone;
}

/**
 * A zone that failed to parse. You should never need to instantiate this.
 */
declare class InvalidZone extends Zone { }

/**
 * Represents the system zone for this JavaScript environment.
 */
declare class SystemZone extends Zone {
    /**
     * Get a singleton instance of the system zone
     */
    static get instance(): SystemZone;
}

export interface IntervalObject {
    start?: DateTime | undefined;
    end?: DateTime | undefined;
}

export type DateInput = DateTime | DateObjectUnits | Date;

/**
 * An Interval object represents a half-open interval of time, where each endpoint is a {@link DateTime}. Conceptually, it's a container for those two endpoints, accompanied by methods for
 * creating, parsing, interrogating, comparing, transforming, and formatting them.
 *
 * Here is a brief overview of the most commonly used methods and getters in Interval:
 *
 * * **Creation** To create an Interval, use {@link Interval.fromDateTimes}, {@link Interval.after}, {@link Interval.before}, or {@link Interval.fromISO}.
 * * **Accessors** Use {@link Interval#start} and {@link Interval#end} to get the start and end.
 * * **Interrogation** To analyze the Interval, use {@link Interval#count}, {@link Interval#length}, {@link Interval#hasSame},
 * * {@link Interval#contains}, {@link Interval#isAfter}, or {@link Interval#isBefore}.
 * * **Transformation** To create other Intervals out of this one, use {@link Interval#set}, {@link Interval#splitAt}, {@link Interval#splitBy}, {@link Interval#divideEqually},
 * * {@link Interval#merge}, {@link Interval#xor}, {@link Interval#union}, {@link Interval#intersection}, or {@link Interval#difference}.
 * * **Comparison** To compare this Interval to another one, use {@link Interval#equals}, {@link Interval#overlaps}, {@link Interval#abutsStart}, {@link Interval#abutsEnd}, {@link Interval#engulfs}
 * * **Output** To convert the Interval into other representations, see {@link Interval#toString}, {@link Interval#toISO}, {@link Interval#toISODate}, {@link Interval#toISOTime},
 * * {@link Interval#toFormat}, and {@link Interval#toDuration}.
 */
declare class Interval {
    /**
     * Create an invalid Interval.
     *
     * @param reason - simple string of why this Interval is invalid. Should not contain parameters or anything else data-dependent
     * @param explanation - longer explanation, may include parameters and other useful debugging information. Defaults to null.
     */
    static invalid(reason: string, explanation?: string): Interval;

    /**
     * Create an Interval from a start DateTime and an end DateTime. Inclusive of the start but not the end.
     *
     * @param start
     * @param end
     */
    static fromDateTimes(start: DateInput, end: DateInput): Interval;

    /**
     * Create an Interval from a start DateTime and a Duration to extend to.
     *
     * @param start
     * @param duration - the length of the Interval.
     */
    static after(start: DateInput, duration: DurationLike): Interval;

    /**
     * Create an Interval from an end DateTime and a Duration to extend backwards to.
     *
     * @param end
     * @param duration - the length of the Interval.
     */
    static before(end: DateInput, duration: DurationLike): Interval;

    /**
     * Create an Interval from an ISO 8601 string.
     * Accepts `<start>/<end>`, `<start>/<duration>`, and `<duration>/<end>` formats.
     * @see https://en.wikipedia.org/wiki/ISO_8601#Time_intervals
     *
     * @param text - the ISO string to parse
     * @param opts - options to pass {@link DateTime.fromISO} and optionally {@link Duration.fromISO}
     */
    static fromISO(text: string, opts?: DateTimeOptions): Interval;

    /**
     * Check if an object is an Interval. Works across context boundaries
     *
     * @param o
     */
    static isInterval(o: unknown): o is Interval;

    /**
     * Returns the start of the Interval
     */
    get start(): DateTime;

    /**
     * Returns the end of the Interval
     */
    get end(): DateTime;

    /**
     * Returns whether this Interval's end is at least its start, meaning that the Interval isn't 'backwards'.
     */
    get isValid(): boolean;

    /**
     * Returns an error code if this Interval is invalid, or null if the Interval is valid
     */
    get invalidReason(): string;

    /**
     * Returns an explanation of why this Interval became invalid, or null if the Interval is valid
     */
    get invalidExplanation(): string;

    /**
     * Returns the length of the Interval in the specified unit.
     *
     * @param unit - the unit (such as 'hours' or 'days') to return the length in.
     */
    length(unit?: DurationUnit): number;

    /**
     * Returns the count of minutes, hours, days, months, or years included in the Interval, even in part.
     * Unlike {@link Interval#length} this counts sections of the calendar, not periods of time, e.g. specifying 'day'
     * asks 'what dates are included in this interval?', not 'how many days long is this interval?'
     *
     * @param unit - the unit of time to count. Defaults to 'milliseconds'.
     */
    count(unit?: DurationUnit): number;

    /**
     * Returns whether this Interval's start and end are both in the same unit of time
     *
     * @param unit - the unit of time to check sameness on
     */
    hasSame(unit: DurationUnit): boolean;

    /**
     * Return whether this Interval has the same start and end DateTimes.
     */
    isEmpty(): boolean;

    /**
     * Return whether this Interval's start is after the specified DateTime.
     *
     * @param dateTime
     */
    isAfter(dateTime: DateTime): boolean;

    /**
     * Return whether this Interval's end is before the specified DateTime.
     *
     * @param dateTime
     */
    isBefore(dateTime: DateTime): boolean;

    /**
     * Return whether this Interval contains the specified DateTime.
     *
     * @param dateTime
     */
    contains(dateTime: DateTime): boolean;

    /**
     * "Sets" the start and/or end dates. Returns a newly-constructed Interval.
     *
     * @param values - the values to set
     * @param values.start - the starting DateTime
     * @param values.end - the ending DateTime
     */
    set(values?: IntervalObject): Interval;

    /**
     * Split this Interval at each of the specified DateTimes
     *
     * @param dateTimes - the unit of time to count.
     */
    splitAt(...dateTimes: DateTime[]): Interval[];

    /**
     * Split this Interval into smaller Intervals, each of the specified length.
     * Left over time is grouped into a smaller interval
     *
     * @param duration - The length of each resulting interval.
     */
    splitBy(duration: DurationLike): Interval[];

    /**
     * Split this Interval into the specified number of smaller intervals.
     *
     * @param numberOfParts - The number of Intervals to divide the Interval into.
     */
    divideEqually(numberOfParts: number): Interval[];

    /**
     * Return whether this Interval overlaps with the specified Interval
     *
     * @param other
     */
    overlaps(other: Interval): boolean;

    /**
     * Return whether this Interval's end is adjacent to the specified Interval's start.
     *
     * @param other
     */
    abutsStart(other: Interval): boolean;

    /**
     * Return whether this Interval's start is adjacent to the specified Interval's end.
     *
     * @param other
     */
    abutsEnd(other: Interval): boolean;

    /**
     * Return whether this Interval engulfs the start and end of the specified Interval.
     *
     * @param other
     */
    engulfs(other: Interval): boolean;

    /**
     * Return whether this Interval has the same start and end as the specified Interval.
     *
     * @param other
     */
    equals(other: Interval): boolean;

    /**
     * Return an Interval representing the intersection of this Interval and the specified Interval.
     * Specifically, the resulting Interval has the maximum start time and the minimum end time of the two Intervals.
     * Returns null if the intersection is empty, meaning, the intervals don't intersect.
     *
     * @param other
     */
    intersection(other: Interval): Interval | null;

    /**
     * Return an Interval representing the union of this Interval and the specified Interval.
     * Specifically, the resulting Interval has the minimum start time and the maximum end time of the two Intervals.
     *
     * @param other
     */
    union(other: Interval): Interval;

    /**
     * Merge an array of Intervals into a equivalent minimal set of Intervals.
     * Combines overlapping and adjacent Intervals.
     *
     * @param intervals
     */
    static merge(intervals: Interval[]): Interval[];

    /**
     * Return an array of Intervals representing the spans of time that only appear in one of the specified Intervals.
     *
     *  @param intervals
     */
    static xor(intervals: Interval[]): Interval[];

    /**
     * Return an Interval representing the span of time in this Interval that doesn't overlap with any of the specified Intervals.
     *
     * @param intervals
     */
    difference(...intervals: Interval[]): Interval[];

    /**
     * Returns a string representation of this Interval appropriate for debugging.
     */
    toString(): string;

    /**
     * Returns an ISO 8601-compliant string representation of this Interval.
     * @see https://en.wikipedia.org/wiki/ISO_8601#Time_intervals
     *
     * @param opts - The same options as {@link DateTime#toISO}
     */
    toISO(opts?: ToISOTimeOptions): string;

    /**
     * Returns an ISO 8601-compliant string representation of date of this Interval.
     * The time components are ignored.
     * @see https://en.wikipedia.org/wiki/ISO_8601#Time_intervals
     */
    toISODate(): string;

    /**
     * Returns an ISO 8601-compliant string representation of time of this Interval.
     * The date components are ignored.
     * @see https://en.wikipedia.org/wiki/ISO_8601#Time_intervals
     *
     * @param opts - The same options as {@link DateTime.toISO}
     */
    toISOTime(opts?: ToISOTimeOptions): string;

    /**
     * Returns a string representation of this Interval formatted according to the specified format string.
     *
     * @param dateFormat - the format string. This string formats the start and end time. See {@link DateTime.toFormat} for details.
     * @param opts - options
     * @param opts.separator - a separator to place between the start and end representations. Defaults to ' - '.
     */
    toFormat(
        dateFormat: string,
        opts?: {
            separator?: string | undefined;
        },
    ): string;

    /**
     * Return a Duration representing the time spanned by this interval.
     *
     * @param unit - the unit or units (such as 'hours' or 'days') to include in the duration. Defaults to ['milliseconds'].
     * @param opts - options that affect the creation of the Duration
     * @param opts.conversionAccuracy - the conversion system to use. Defaults to 'casual'.
     *
     * @example
     * Interval.fromDateTimes(dt1, dt2).toDuration().toObject() //=> { milliseconds: 88489257 }
     * @example
     * Interval.fromDateTimes(dt1, dt2).toDuration('days').toObject() //=> { days: 1.0241812152777778 }
     * @example
     * Interval.fromDateTimes(dt1, dt2).toDuration(['hours', 'minutes']).toObject() //=> { hours: 24, minutes: 34.82095 }
     * @example
     * Interval.fromDateTimes(dt1, dt2).toDuration(['hours', 'minutes', 'seconds']).toObject() //=> { hours: 24, minutes: 34, seconds: 49.257 }
     * @example
     * Interval.fromDateTimes(dt1, dt2).toDuration('seconds').toObject() //=> { seconds: 88489.257 }
     */
    toDuration(unit?: DurationUnit | DurationUnit[], opts?: DiffOptions): Duration;

    /**
     * Run mapFn on the interval start and end, returning a new Interval from the resulting DateTimes
     *
     * @param mapFn
     *
     * @example
     * Interval.fromDateTimes(dt1, dt2).mapEndpoints(endpoint => endpoint.toUTC())
     * @example
     * Interval.fromDateTimes(dt1, dt2).mapEndpoints(endpoint => endpoint.plus({ hours: 2 }))
     */
    mapEndpoints(mapFn: (d: DateTime) => DateTime): Interval;
}

export interface InfoOptions {
    locale?: string | undefined;
}

export interface InfoUnitOptions extends InfoOptions {
    numberingSystem?: NumberingSystem | undefined;
}

/** @deprecated */
export type UnitOptions = InfoUnitOptions;

export interface InfoCalendarOptions extends InfoUnitOptions {
    outputCalendar?: CalendarSystem | undefined;
}

/**
 * The set of available features in this environment. Some features of Luxon are not available in all environments.
 */
export interface Features {
    /**
     * Whether this environment supports relative time formatting
     */
    relative: boolean;
}

/**
 * The Info class contains static methods for retrieving general time and date related data. For example, it has methods for finding out if a time zone has a DST, for listing the months in any
 * supported locale, and for discovering which of Luxon features are available in the current environment.
 */
declare namespace Info {
    /**
     * Return whether the specified zone contains a DST.
     *
     * @param zone - Zone to check. Defaults to the environment's local zone. Defaults to 'local'.
     */
    function hasDST(zone?: string | Zone): boolean;

    /**
     * Return whether the specified zone is a valid IANA specifier.
     *
     * @param zone - Zone to check
     */
    function isValidIANAZone(zone: string): boolean;

    /**
     * Converts the input into a {@link Zone} instance.
     *
     * * If `input` is already a Zone instance, it is returned unchanged.
     * * If `input` is a string containing a valid time zone name, a Zone instance
     *   with that name is returned.
     * * If `input` is a string that doesn't refer to a known time zone, a Zone
     *   instance with {@link Zone.isValid} == false is returned.
     * * If `input is a number, a Zone instance with the specified fixed offset
     *   in minutes is returned.
     * * If `input` is `null` or `undefined`, the default zone is returned.
     *
     * @param input - the value to be converted
     */
    function normalizeZone(input?: string | Zone | number): Zone;

    /**
     * Return an array of standalone month names.
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat
     *
     * @param length - the length of the month representation, such as "numeric", "2-digit", "narrow", "short", "long". Defaults to 'long'.
     * @param opts - options
     * @param opts.locale - the locale code
     * @param opts.numberingSystem - the numbering system. Defaults to null.
     * @param opts.locObj - an existing locale object to use. Defaults to null.
     * @param opts.outputCalendar - the calendar. Defaults to 'gregory'.
     *
     * @example
     * Info.months()[0] //=> 'January'
     * @example
     * Info.months('short')[0] //=> 'Jan'
     * @example
     * Info.months('numeric')[0] //=> '1'
     * @example
     * Info.months('short', { locale: 'fr-CA' } )[0] //=> 'janv.'
     * @example
     * Info.months('numeric', { locale: 'ar' })[0] //=> '١'
     * @example
     * Info.months('long', { outputCalendar: 'islamic' })[0] //=> 'Rabiʻ I'
     */
    function months(length?: UnitLength, opts?: InfoCalendarOptions): string[];

    /**
     * Return an array of format month names.
     * Format months differ from standalone months in that they're meant to appear next to the day of the month. In some languages, that
     * changes the string.
     * See {@link Info#months}
     *
     * @param length - the length of the month representation, such as "numeric", "2-digit", "narrow", "short", "long". Defaults to 'long'.
     * @param opts - options
     * @param opts.locale - the locale code
     * @param opts.numberingSystem - the numbering system. Defaults to null.
     * @param opts.locObj - an existing locale object to use. Defaults to null.
     * @param opts.outputCalendar - the calendar. Defaults to 'gregory'.
     */
    function monthsFormat(length?: UnitLength, options?: InfoCalendarOptions): string[];

    /**
     * Return an array of standalone week names.
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat
     *
     * @param length - the length of the weekday representation, such as "narrow", "short", "long". Defaults to 'long'.
     * @param opts - options
     * @param opts.locale - the locale code
     * @param opts.numberingSystem - the numbering system. Defaults to null.
     * @param opts.locObj - an existing locale object to use. Defaults to null.
     *
     * @example
     * Info.weekdays()[0] //=> 'Monday'
     * @example
     * Info.weekdays('short')[0] //=> 'Mon'
     * @example
     * Info.weekdays('short', { locale: 'fr-CA' })[0] //=> 'lun.'
     * @example
     * Info.weekdays('short', { locale: 'ar' })[0] //=> 'الاثنين'
     */
    function weekdays(length?: StringUnitLength, options?: InfoUnitOptions): string[];

    /**
     * Return an array of format week names.
     * Format weekdays differ from standalone weekdays in that they're meant to appear next to more date information. In some languages, that
     * changes the string.
     * See {@link Info#weekdays}
     *
     * @param length - the length of the month representation, such as "narrow", "short", "long". Defaults to 'long'.
     * @param opts - options
     * @param opts.locale - the locale code. Defaults to null.
     * @param opts.numberingSystem - the numbering system. Defaults to null.
     * @param opts.locObj - an existing locale object to use. Defaults to null.
     */
    function weekdaysFormat(length?: StringUnitLength, options?: InfoUnitOptions): string[];

    /**
     * Return an array of meridiems.
     *
     * @param opts - options
     * @param opts.locale - the locale code
     *
     * @example
     * Info.meridiems() //=> [ 'AM', 'PM' ]
     * @example
     * Info.meridiems({ locale: 'my' }) //=> [ 'နံနက်', 'ညနေ' ]
     */
    function meridiems(options?: InfoOptions): string[];

    /**
     * Return an array of eras, such as ['BC', 'AD']. The locale can be specified, but the calendar system is always Gregorian.
     *
     * @param length - the length of the era representation, such as "short" or "long". Defaults to 'short'.
     * @param opts - options
     * @param opts.locale - the locale code
     *
     * @example
     * Info.eras() //=> [ 'BC', 'AD' ]
     * @example
     * Info.eras('long') //=> [ 'Before Christ', 'Anno Domini' ]
     * @example
     * Info.eras('long', { locale: 'fr' }) //=> [ 'avant Jésus-Christ', 'après Jésus-Christ' ]
     */
    function eras(length?: StringUnitLength, options?: InfoOptions): string[];

    /**
     * Return the set of available features in this environment.
     * Some features of Luxon are not available in all environments. For example, on older browsers, timezone support is not available. Use this function to figure out if that's the case.
     * Keys:
     * * `relative`: whether this environment supports relative time formatting
     *
     * @example
     * Info.features() //=> { intl: true, intlTokens: false, zones: true, relative: false }
     */
    function features(): Features;
}

export interface DurationOptions {
    locale?: string | undefined;
    numberingSystem?: NumberingSystem | undefined;
    conversionAccuracy?: ConversionAccuracy | undefined;
}

export interface DurationObjectUnits {
    years?: number | undefined;
    quarters?: number | undefined;
    months?: number | undefined;
    weeks?: number | undefined;
    days?: number | undefined;
    hours?: number | undefined;
    minutes?: number | undefined;
    seconds?: number | undefined;
    milliseconds?: number | undefined;
}

export interface DurationLikeObject extends DurationObjectUnits {
    year?: number | undefined;
    quarter?: number | undefined;
    month?: number | undefined;
    week?: number | undefined;
    day?: number | undefined;
    hour?: number | undefined;
    minute?: number | undefined;
    second?: number | undefined;
    millisecond?: number | undefined;
}

export type DurationUnit = keyof DurationLikeObject;
export type DurationUnits = DurationUnit | DurationUnit[];

export type ToISOFormat = 'basic' | 'extended';

export interface ToISOTimeDurationOptions {
    /**
     * Include the `T` prefix
     * @default false
     */
    includePrefix?: boolean | undefined;
    /**
     * Exclude milliseconds from the format if they're 0
     * @default false
     */
    suppressMilliseconds?: boolean | undefined;
    /**
     * Exclude seconds from the format if they're 0
     * @default false
     */
    suppressSeconds?: boolean | undefined;
    /**
     * Choose between the basic and extended format
     * @default 'extended'
     */
    format?: ToISOFormat | undefined;
}

export interface ToHumanDurationOptions extends Intl.NumberFormatOptions {
    listStyle?: 'long' | 'short' | 'narrow' | undefined;
}

/**
 * Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
 *
 * @deprecated Use DurationLike instead.
 */
export type DurationInput = Duration | number | DurationLikeObject;

/**
 * Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
 */
export type DurationLike = Duration | DurationLikeObject | number;

/**
 * A Duration object represents a period of time, like "2 months" or "1 day, 1 hour".
 * Conceptually, it's just a map of units to their quantities, accompanied by some additional configuration and methods for creating, parsing, interrogating, transforming, and formatting them.
 * They can be used on their own or in conjunction with other Luxon types; for example, you can use {@link DateTime.plus} to add a Duration object to a DateTime, producing another DateTime.
 *
 * Here is a brief overview of commonly used methods and getters in Duration:
 *
 * * **Creation** To create a Duration, use {@link Duration.fromMillis}, {@link Duration.fromObject}, or {@link Duration.fromISO}.
 * * **Unit values** See the {@link Duration#years}, {@link Duration.months}, {@link Duration#weeks}, {@link Duration#days}, {@link Duration#hours}, {@link Duration#minutes},
 * * {@link Duration#seconds}, {@link Duration#milliseconds} accessors.
 * * **Configuration** See  {@link Duration#locale} and {@link Duration#numberingSystem} accessors.
 * * **Transformation** To create new Durations out of old ones use {@link Duration#plus}, {@link Duration#minus}, {@link Duration#normalize}, {@link Duration#set}, {@link Duration#reconfigure},
 * * {@link Duration#shiftTo}, and {@link Duration#negate}.
 * * **Output** To convert the Duration into other representations, see {@link Duration#as}, {@link Duration#toISO}, {@link Duration#toFormat}, and {@link Duration#toJSON}
 *
 * There's are more methods documented below. In addition, for more information on subtler topics like internationalization and validity, see the external documentation.
 */
declare class Duration {
    /**
     * Create Duration from a number of milliseconds.
     *
     * @param count - of milliseconds
     * @param opts - options for parsing
     * @param opts.locale - the locale to use
     * @param opts.numberingSystem - the numbering system to use
     * @param opts.conversionAccuracy - the conversion system to use
     */
    static fromMillis(count: number, opts?: DurationOptions): Duration;

    /**
     * Create a Duration from a JavaScript object with keys like 'years' and 'hours'.
     * If this object is empty then a zero milliseconds duration is returned.
     *
     * @param obj - the object to create the DateTime from
     * @param obj.years
     * @param obj.quarters
     * @param obj.months
     * @param obj.weeks
     * @param obj.days
     * @param obj.hours
     * @param obj.minutes
     * @param obj.seconds
     * @param obj.milliseconds
     * @param opts - options for creating this Duration. Defaults to {}.
     * @param opts.locale - the locale to use. Defaults to 'en-US'.
     * @param opts.numberingSystem - the numbering system to use
     * @param opts.conversionAccuracy - the conversion system to use. Defaults to 'casual'.
     */
    static fromObject(obj: DurationLikeObject, opts?: DurationOptions): Duration;

    /**
     * Create a Duration from DurationLike.
     *
     * @param durationLike
     * Either a Luxon Duration, a number of milliseconds, or the object argument to Duration.fromObject()
     */
    static fromDurationLike(durationLike: DurationLike): Duration;

    /**
     * Create a Duration from an ISO 8601 duration string.
     * @see https://en.wikipedia.org/wiki/ISO_8601#Durations
     *
     * @param text - text to parse
     * @param opts - options for parsing
     * @param opts.locale - the locale to use. Defaults to 'en-US'.
     * @param opts.numberingSystem - the numbering system to use
     * @param opts.conversionAccuracy - the conversion system to use. Defaults to 'casual'.
     *
     * @example
     * Duration.fromISO('P3Y6M1W4DT12H30M5S').toObject() //=> { years: 3, months: 6, weeks: 1, days: 4, hours: 12, minutes: 30, seconds: 5 }
     * @example
     * Duration.fromISO('PT23H').toObject() //=> { hours: 23 }
     * @example
     * Duration.fromISO('P5Y3M').toObject() //=> { years: 5, months: 3 }
     */
    static fromISO(text: string, opts?: DurationOptions): Duration;

    /**
     * Create a Duration from an ISO 8601 time string.
     * @see https://en.wikipedia.org/wiki/ISO_8601#Times
     *
     * @param text - text to parse
     * @param opts - options for parsing
     * @param opts.locale - the locale to use. Defaults to 'en-US'.
     * @param opts.numberingSystem - the numbering system to use
     * @param opts.conversionAccuracy - the conversion system to use. Defaults to 'casual'.
     *
     * @example
     * Duration.fromISOTime('11:22:33.444').toObject() //=> { hours: 11, minutes: 22, seconds: 33, milliseconds: 444 }
     * @example
     * Duration.fromISOTime('11:00').toObject() //=> { hours: 11, minutes: 0, seconds: 0 }
     * @example
     * Duration.fromISOTime('T11:00').toObject() //=> { hours: 11, minutes: 0, seconds: 0 }
     * @example
     * Duration.fromISOTime('1100').toObject() //=> { hours: 11, minutes: 0, seconds: 0 }
     * @example
     * Duration.fromISOTime('T1100').toObject() //=> { hours: 11, minutes: 0, seconds: 0 }
     */
    static fromISOTime(text: string, opts?: DurationOptions): Duration;

    /**
     * Create an invalid Duration.
     *
     * @param reason - simple string of why this datetime is invalid. Should not contain parameters or anything else data-dependent
     * @param explanation - longer explanation, may include parameters and other useful debugging information. Defaults to null.
     */
    static invalid(reason: string, explanation?: string): Duration;

    /**
     * Check if an object is a Duration. Works across context boundaries
     *
     * @param o
     */
    static isDuration(o: unknown): o is Duration;

    /**
     * Get  the locale of a Duration, such 'en-GB'
     */
    get locale(): string;

    /**
     * Get the numbering system of a Duration, such 'beng'. The numbering system is used when formatting the Duration
     */
    get numberingSystem(): string;

    /**
     * Returns a string representation of this Duration formatted according to the specified format string. You may use these tokens:
     * * `S` for milliseconds
     * * `s` for seconds
     * * `m` for minutes
     * * `h` for hours
     * * `d` for days
     * * `M` for months
     * * `y` for years
     * Notes:
     * * Add padding by repeating the token, e.g. "yy" pads the years to two digits, "hhhh" pads the hours out to four digits
     * * The duration will be converted to the set of units in the format string using {@link Duration.shiftTo} and the Durations's conversion accuracy setting.
     *
     * @param fmt - the format string
     * @param opts - options
     * @param opts.floor - floor numerical values. Defaults to true.
     *
     * @example
     * Duration.fromObject({ years: 1, days: 6, seconds: 2 }).toFormat("y d s") //=> "1 6 2"
     * @example
     * Duration.fromObject({ years: 1, days: 6, seconds: 2 }).toFormat("yy dd sss") //=> "01 06 002"
     * @example
     * Duration.fromObject({ years: 1, days: 6, seconds: 2 }).toFormat("M S") //=> "12 518402000"
     */
    toFormat(fmt: string, opts?: { floor?: boolean | undefined }): string;

    /**
     * Returns a string representation of a Duration with all units included
     * To modify its behavior use the `listStyle` and any Intl.NumberFormat option, though `unitDisplay` is especially relevant. See {@link Intl.NumberFormat}.
     * @param opts - On option object to override the formatting. Accepts the same keys as the options parameter of the native `Int.NumberFormat` constructor, as well as `listStyle`.
     * @example
     * ```js
     * var dur = Duration.fromObject({ days: 1, hours: 5, minutes: 6 })
     * dur.toHuman() //=> '1 day, 5 hours, 6 minutes'
     * dur.toHuman({ listStyle: "long" }) //=> '1 day, 5 hours, and 6 minutes'
     * dur.toHuman({ unitDisplay: "short" }) //=> '1 day, 5 hr, 6 min'
     * ```
     */
    toHuman(opts?: ToHumanDurationOptions): string;

    /**
     * Returns a JavaScript object with this Duration's values.
     *
     * @example
     * Duration.fromObject({ years: 1, days: 6, seconds: 2 }).toObject() //=> { years: 1, days: 6, seconds: 2 }
     */
    toObject(): DurationObjectUnits;

    /**
     * Returns an ISO 8601-compliant string representation of this Duration.
     * @see https://en.wikipedia.org/wiki/ISO_8601#Durations
     *
     * @example
     * Duration.fromObject({ years: 3, seconds: 45 }).toISO() //=> 'P3YT45S'
     * @example
     * Duration.fromObject({ months: 4, seconds: 45 }).toISO() //=> 'P4MT45S'
     * @example
     * Duration.fromObject({ months: 5 }).toISO() //=> 'P5M'
     * @example
     * Duration.fromObject({ minutes: 5 }).toISO() //=> 'PT5M'
     * @example
     * Duration.fromObject({ milliseconds: 6 }).toISO() //=> 'PT0.006S'
     */
    toISO(): string;

    /**
     * Returns an ISO 8601-compliant string representation of this Duration, formatted as a time of day.
     * @see https://en.wikipedia.org/wiki/ISO_8601#Times
     *
     * @param opts - options
     * @param opts.suppressMilliseconds - exclude milliseconds from the format if they're 0. Defaults to false.
     * @param opts.suppressSeconds - exclude seconds from the format if they're 0. Defaults to false.
     * @param opts.includePrefix - include the `T` prefix. Defaults to false.
     * @param opts.format - choose between the basic and extended format. Defaults to 'extended'.
     *
     * @example
     * Duration.fromObject({ hours: 11 }).toISOTime() //=> '11:00:00.000'
     * @example
     * Duration.fromObject({ hours: 11 }).toISOTime({ suppressMilliseconds: true }) //=> '11:00:00'
     * @example
     * Duration.fromObject({ hours: 11 }).toISOTime({ suppressSeconds: true }) //=> '11:00'
     * @example
     * Duration.fromObject({ hours: 11 }).toISOTime({ includePrefix: true }) //=> 'T11:00:00.000'
     * @example
     * Duration.fromObject({ hours: 11 }).toISOTime({ format: 'basic' }) //=> '110000.000'
     */
    toISOTime(opts?: ToISOTimeDurationOptions): string;

    /**
     * Returns an ISO 8601 representation of this Duration appropriate for use in JSON.
     */
    toJSON(): string;

    /**
     * Returns an ISO 8601 representation of this Duration appropriate for use in debugging.
     */
    toString(): string;

    /**
     * Returns an milliseconds value of this Duration.
     */
    toMillis(): number;

    /**
     * Returns an milliseconds value of this Duration. Alias of {@link toMillis}
     */
    valueOf(): number;

    /**
     * Make this Duration longer by the specified amount. Return a newly-constructed Duration.
     *
     * @param duration - The amount to add. Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
     */
    plus(duration: DurationLike): Duration;

    /**
     * Make this Duration shorter by the specified amount. Return a newly-constructed Duration.
     *
     * @param duration - The amount to subtract. Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
     */
    minus(duration: DurationLike): Duration;

    /**
     * Scale this Duration by the specified amount. Return a newly-constructed Duration.
     *
     * @example
     * Duration.fromObject({ hours: 1, minutes: 30 }).mapUnit(x => x * 2) //=> { hours: 2, minutes: 60 }
     * @example
     * Duration.fromObject({ hours: 1, minutes: 30 }).mapUnit((x, u) => u === "hour" ? x * 2 : x) //=> { hours: 2, minutes: 30 }
     */
    mapUnits(fn: (x: number, u?: DurationUnit) => number): Duration;

    /**
     * Get the value of unit.
     *
     * @param unit - a unit such as 'minute' or 'day'
     *
     * @example
     * Duration.fromObject({years: 2, days: 3}).get('years') //=> 2
     * @example
     * Duration.fromObject({years: 2, days: 3}).get('months') //=> 0
     * @example
     * Duration.fromObject({years: 2, days: 3}).get('days') //=> 3
     */
    get(unit: DurationUnit): number;

    /**
     * "Set" the values of specified units. Return a newly-constructed Duration.
     *
     * @param values - a mapping of units to numbers
     *
     * @example
     * dur.set({ years: 2017 })
     * @example
     * dur.set({ hours: 8, minutes: 30 })
     */
    set(values: DurationLikeObject): Duration;

    /**
     * "Set" the locale and/or numberingSystem.  Returns a newly-constructed Duration.
     *
     * @example
     * dur.reconfigure({ locale: 'en-GB' })
     */
    reconfigure(opts?: DurationOptions): Duration;

    /**
     * Return the length of the duration in the specified unit.
     *
     * @param unit - a unit such as 'minutes' or 'days'
     *
     * @example
     * Duration.fromObject({years: 1}).as('days') //=> 365
     * @example
     * Duration.fromObject({years: 1}).as('months') //=> 12
     * @example
     * Duration.fromObject({hours: 60}).as('days') //=> 2.5
     */
    as(unit: DurationUnit): number;

    /**
     * Reduce this Duration to its canonical representation in its current units.
     *
     * @example
     * Duration.fromObject({ years: 2, days: 5000 }).normalize().toObject() //=> { years: 15, days: 255 }
     * @example
     * Duration.fromObject({ hours: 12, minutes: -45 }).normalize().toObject() //=> { hours: 11, minutes: 15 }
     */
    normalize(): Duration;

    /**
     * Convert this Duration into its representation in a different set of units.
     *
     * @example
     * Duration.fromObject({ hours: 1, seconds: 30 }).shiftTo('minutes', 'milliseconds').toObject() //=> { minutes: 60, milliseconds: 30000 }
     */
    shiftTo(...units: DurationUnit[]): Duration;

    /**
     * Return the negative of this Duration.
     *
     * @example
     * Duration.fromObject({ hours: 1, seconds: 30 }).negate().toObject() //=> { hours: -1, seconds: -30 }
     */
    negate(): Duration;

    /**
     * Get the years.
     */
    get years(): number;

    /**
     * Get the quarters.
     */
    get quarters(): number;

    /**
     * Get the months.
     */
    get months(): number;

    /**
     * Get the weeks
     */
    get weeks(): number;

    /**
     * Get the days.
     */
    get days(): number;

    /**
     * Get the hours.
     */
    get hours(): number;

    /**
     * Get the minutes.
     */
    get minutes(): number;

    /**
     * Get the seconds.
     */
    get seconds(): number;

    /**
     * Get the milliseconds.
     */
    get milliseconds(): number;

    /**
     * Returns whether the Duration is invalid. Invalid durations are returned by diff operations
     * on invalid DateTimes or Intervals.
     */
    get isValid(): boolean;

    /**
     * Returns an error code if this Duration became invalid, or null if the Duration is valid
     */
    get invalidReason(): string;

    /**
     * Returns an explanation of why this Duration became invalid, or null if the Duration is valid
     */
    get invalidExplanation(): string;

    /**
     * Equality check
     * Two Durations are equal iff they have the same units and the same values for each unit.
     *
     * @param other
     */
    equals(other: Duration): boolean;
}


export type DateTimeFormatOptions = Intl.DateTimeFormatOptions;

export interface ZoneOptions {
    /**
     * If true, adjust the underlying time so that the local time stays the same, but in the target zone.
     * You should rarely need this.
     * Defaults to false.
     */
    keepLocalTime?: boolean | undefined;
    /**
     * @deprecated since 0.2.12. Use keepLocalTime instead
     */
    keepCalendarTime?: boolean | undefined;
}

/** @deprecated */
export type EraLength = StringUnitLength;

export type NumberingSystem = Intl.DateTimeFormatOptions extends { numberingSystem?: infer T }
    ? T
    :
    | 'arab'
    | 'arabext'
    | 'bali'
    | 'beng'
    | 'deva'
    | 'fullwide'
    | 'gujr'
    | 'guru'
    | 'hanidec'
    | 'khmr'
    | 'knda'
    | 'laoo'
    | 'latn'
    | 'limb'
    | 'mlym'
    | 'mong'
    | 'mymr'
    | 'orya'
    | 'tamldec'
    | 'telu'
    | 'thai'
    | 'tibt';

export type CalendarSystem = Intl.DateTimeFormatOptions extends { calendar?: infer T }
    ? T
    :
    | 'buddhist'
    | 'chinese'
    | 'coptic'
    | 'ethioaa'
    | 'ethiopic'
    | 'gregory'
    | 'hebrew'
    | 'indian'
    | 'islamic'
    | 'islamicc'
    | 'iso8601'
    | 'japanese'
    | 'persian'
    | 'roc';

export type HourCycle = 'h11' | 'h12' | 'h23' | 'h24';

export type StringUnitLength = 'narrow' | 'short' | 'long';
export type NumberUnitLength = 'numeric' | '2-digit';
export type UnitLength = StringUnitLength | NumberUnitLength;


export type DateTimeUnit = 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour' | 'minute' | 'second' | 'millisecond';
export type ToRelativeUnit = 'years' | 'quarters' | 'months' | 'weeks' | 'days' | 'hours' | 'minutes' | 'seconds';

export type MonthNumbers = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type WeekdayNumbers = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type DayNumbers =
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18
    | 19
    | 20
    | 21
    | 22
    | 23
    | 24
    | 25
    | 26
    | 27
    | 28
    | 29
    | 30
    | 31;

export type SecondNumbers =
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18
    | 19
    | 20
    | 21
    | 22
    | 23
    | 24
    | 25
    | 26
    | 27
    | 28
    | 29
    | 30
    | 31
    | 32
    | 33
    | 34
    | 35
    | 36
    | 37
    | 38
    | 39
    | 40
    | 41
    | 42
    | 43
    | 44
    | 45
    | 46
    | 47
    | 48
    | 49
    | 50
    | 51
    | 52
    | 53
    | 54
    | 55
    | 56
    | 57
    | 58
    | 59;

export type MinuteNumbers = SecondNumbers;

export type HourNumbers =
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18
    | 19
    | 20
    | 21
    | 22
    | 23;

export type WeekNumbers =
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18
    | 19
    | 20
    | 21
    | 22
    | 23
    | 24
    | 25
    | 26
    | 27
    | 28
    | 29
    | 30
    | 31
    | 32
    | 33
    | 34
    | 35
    | 36
    | 37
    | 38
    | 39
    | 40
    | 41
    | 42
    | 43
    | 44
    | 45
    | 46
    | 47
    | 48
    | 49
    | 50
    | 51
    | 52
    | 53;

export type QuarterNumbers = 1 | 2 | 3 | 4;

export type PossibleDaysInMonth = 28 | 29 | 30 | 31;
export type PossibleDaysInYear = 365 | 366;
export type PossibleWeeksInYear = 52 | 53;

export interface ToObjectOutput extends DateTimeJSOptions {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
}

export interface ToRelativeOptions extends Omit<ToRelativeCalendarOptions, 'unit'> {
    /**
     * @default long
     */
    style?: StringUnitLength | undefined;
    /** @default true */
    round?: boolean | undefined;
    /**
     * Padding in milliseconds. This allows you to round up the result if it fits inside the threshold.
     * Don't use in combination with {round: false} because the decimal output will include the padding.
     * @default 0
     */
    padding?: number | undefined;
    /**
     * A single unit or an array of units. If an array is supplied, the method will pick the best one
     * to use from the array. If omitted, the method will pick the unit from a default set.
     */
    unit?: ToRelativeUnit | ToRelativeUnit[] | undefined;
}

export interface ToRelativeCalendarOptions {
    /**
     * The DateTime to use as the basis to which this time is compared
     * @default now
     */
    base?: DateTime | undefined;
    /**
     * Override the locale of this DateTime
     */
    locale?: string | undefined;
    /** If omitted, the method will pick the unit. */
    unit?: ToRelativeUnit | undefined;
    /**
     * Override the numberingSystem of this DateTime.
     * The Intl system may choose not to honor this.
     */
    numberingSystem?: NumberingSystem | undefined;
}

export interface ToSQLOptions {
    /**
     * Include the offset, such as 'Z' or '-04:00'
     * @default true
     */
    includeOffset?: boolean | undefined;
    /**
     * Include the zone, such as 'America/New_York'. Overrides includeOffset.
     * @default false
     */
    includeZone?: boolean | undefined;
}

export interface ToISODateOptions {
    /**
     * Choose between the basic and extended format
     * @default 'extended'
     */
    format?: ToISOFormat | undefined;
}

export interface ToISOTimeOptions extends ToISOTimeDurationOptions {
    /**
     * Include the offset, such as 'Z' or '-04:00'
     * @default true
     */
    includeOffset?: boolean | undefined;
}

/** @deprecated alias for backwards compatibility */
export type ISOTimeOptions = ToISOTimeOptions;

export interface LocaleOptions {
    /**
     * @default system's locale
     */
    locale?: string | undefined;
    outputCalendar?: CalendarSystem | undefined;
    numberingSystem?: NumberingSystem | undefined;
}

export type ResolvedLocaleOptions = Required<LocaleOptions>;

export interface DateTimeOptions extends LocaleOptions {
    /**
     * Use this zone if no offset is specified in the input string itself. Will also convert the time to this zone.
     * @default local
     */
    zone?: string | Zone | undefined;
    /**
     * Override the zone with a fixed-offset zone specified in the string itself, if it specifies one.
     * @default false
     */
    setZone?: boolean | undefined;
}

export type DateTimeJSOptions = Omit<DateTimeOptions, 'setZone'>;

export interface DateObjectUnits {
    // a year, such as 1987
    year?: number | undefined;
    // a month, 1-12
    month?: number | undefined;
    // a day of the month, 1-31, depending on the month
    day?: number | undefined;
    // day of the year, 1-365 or 366
    ordinal?: number | undefined;
    // an ISO week year
    weekYear?: number | undefined;
    // an ISO week number, between 1 and 52 or 53, depending on the year
    weekNumber?: number | undefined;
    // an ISO weekday, 1-7, where 1 is Monday and 7 is Sunday
    weekday?: number | undefined;
    // hour of the day, 0-23
    hour?: number | undefined;
    // minute of the hour, 0-59
    minute?: number | undefined;
    // second of the minute, 0-59
    second?: number | undefined;
    // millisecond of the second, 0-999
    millisecond?: number | undefined;
}

export type ConversionAccuracy = 'casual' | 'longterm';

/**
 * @deprecated You should use Intl.DateTimeFormatOptions' fields and values instead.
 */
export type DateTimeFormatPresetValue = 'numeric' | 'short' | 'long';
/**
 * @deprecated Use Intl.DateTimeFormatOptions instead.
 */
export type DateTimeFormatPreset = Intl.DateTimeFormatOptions;

export interface DiffOptions {
    conversionAccuracy?: ConversionAccuracy | undefined;
}

export interface ExplainedFormat {
    input: string;
    tokens: Array<{ literal: boolean; val: string }>;
    regex?: RegExp | undefined;
    rawMatches?: RegExpMatchArray | null | undefined;
    matches?: { [k: string]: any } | undefined;
    result?: { [k: string]: any } | null | undefined;
    zone?: Zone | null | undefined;
    invalidReason?: string | undefined;
}

/**
 * A DateTime is an immutable data structure representing a specific date and time and accompanying methods.
 * It contains class and instance methods for creating, parsing, interrogating, transforming, and formatting them.
 *
 * A DateTime comprises of:
 * * A timestamp. Each DateTime instance refers to a specific millisecond of the Unix epoch.
 * * A time zone. Each instance is considered in the context of a specific zone (by default the local system's zone).
 * * Configuration properties that effect how output strings are formatted, such as `locale`, `numberingSystem`, and `outputCalendar`.
 *
 * Here is a brief overview of the most commonly used functionality it provides:
 *
 * * **Creation**: To create a DateTime from its components, use one of its factory class methods: {@link DateTime.local}, {@link DateTime.utc}, and (most flexibly) {@link DateTime.fromObject}.
 * To create one from a standard string format, use {@link DateTime.fromISO}, {@link DateTime.fromHTTP}, and {@link DateTime.fromRFC2822}.
 * To create one from a custom string format, use {@link DateTime.fromFormat}. To create one from a native JS date, use {@link DateTime.fromJSDate}.
 * * **Gregorian calendar and time**: To examine the Gregorian properties of a DateTime individually (i.e as opposed to collectively through {@link DateTime#toObject}), use the {@link DateTime#year},
 * {@link DateTime#month}, {@link DateTime#day}, {@link DateTime#hour}, {@link DateTime#minute}, {@link DateTime#second}, {@link DateTime#millisecond} accessors.
 * * **Week calendar**: For ISO week calendar attributes, see the {@link DateTime#weekYear}, {@link DateTime#weekNumber}, and {@link DateTime#weekday} accessors.
 * * **Configuration** See the {@link DateTime#locale} and {@link DateTime#numberingSystem} accessors.
 * * **Transformation**: To transform the DateTime into other DateTimes, use {@link DateTime#set}, {@link DateTime#reconfigure}, {@link DateTime#setZone}, {@link DateTime#setLocale},
 * {@link DateTime.plus}, {@link DateTime#minus}, {@link DateTime#endOf}, {@link DateTime#startOf}, {@link DateTime#toUTC}, and {@link DateTime#toLocal}.
 * * **Output**: To convert the DateTime to other representations, use the {@link DateTime#toRelative}, {@link DateTime#toRelativeCalendar}, {@link DateTime#toJSON}, {@link DateTime#toISO},
 * {@link DateTime#toHTTP}, {@link DateTime#toObject}, {@link DateTime#toRFC2822}, {@link DateTime#toString}, {@link DateTime#toLocaleString}, {@link DateTime#toFormat},
 * {@link DateTime#toMillis} and {@link DateTime#toJSDate}.
 *
 * There's plenty others documented below. In addition, for more information on subtler topics
 * like internationalization, time zones, alternative calendars, validity, and so on, see the external documentation.
 */
declare class DateTime {
    /**
     * Create a DateTime for the current instant, in the system's time zone.
     *
     * Use Settings to override these default values if needed.
     * @example
     * DateTime.now().toISO() //~> now in the ISO format
     */
    static now(): DateTime;

    /**
     * Create a local DateTime
     *
     * @param year - The calendar year. If omitted (as in, call `local()` with no arguments), the current time will be used
     * @param month - The month, 1-indexed
     * @param day - The day of the month, 1-indexed
     * @param hour - The hour of the day, in 24-hour time
     * @param minute - The minute of the hour, meaning a number between 0 and 59
     * @param second - The second of the minute, meaning a number between 0 and 59
     * @param millisecond - The millisecond of the second, meaning a number between 0 and 999
     *
     * @example
     * DateTime.local()                                  //~> now
     * @example
     * DateTime.local({ zone: "America/New_York" })      //~> now, in US east coast time
     * @example
     * DateTime.local(2017)                              //~> 2017-01-01T00:00:00
     * @example
     * DateTime.local(2017, 3)                           //~> 2017-03-01T00:00:00
     * @example
     * DateTime.local(2017, 3, 12, { locale: "fr")       //~> 2017-03-12T00:00:00, with a French locale
     * @example
     * DateTime.local(2017, 3, 12, 5)                    //~> 2017-03-12T05:00:00
     * @example
     * DateTime.local(2017, 3, 12, 5, { zone: "utc" })   //~> 2017-03-12T05:00:00, in UTC
     * @example
     * DateTime.local(2017, 3, 12, 5, 45)                //~> 2017-03-12T05:45:00
     * @example
     * DateTime.local(2017, 3, 12, 5, 45, 10)            //~> 2017-03-12T05:45:10
     * @example
     * DateTime.local(2017, 3, 12, 5, 45, 10, 765)       //~> 2017-03-12T05:45:10.765
     */
    static local(
        year: number,
        month: number,
        day: number,
        hour: number,
        minute: number,
        second: number,
        millisecond: number,
        opts?: DateTimeJSOptions,
    ): DateTime;
    static local(
        year: number,
        month: number,
        day: number,
        hour: number,
        minute: number,
        second: number,
        opts?: DateTimeJSOptions,
    ): DateTime;
    static local(
        year: number,
        month: number,
        day: number,
        hour: number,
        minute: number,
        opts?: DateTimeJSOptions,
    ): DateTime;
    static local(year: number, month: number, day: number, hour: number, opts?: DateTimeJSOptions): DateTime;
    static local(year: number, month: number, day: number, opts?: DateTimeJSOptions): DateTime;
    static local(year: number, month: number, opts?: DateTimeJSOptions): DateTime;
    static local(year: number, opts?: DateTimeJSOptions): DateTime;
    static local(opts?: DateTimeJSOptions): DateTime;

    /**
     * Create a DateTime in UTC
     *
     * @param year - The calendar year. If omitted (as in, call `utc()` with no arguments), the current time will be used
     * @param month - The month, 1-indexed
     * @param day - The day of the month
     * @param hour - The hour of the day, in 24-hour time
     * @param minute - The minute of the hour, meaning a number between 0 and 59
     * @param second - The second of the minute, meaning a number between 0 and 59
     * @param millisecond - The millisecond of the second, meaning a number between 0 and 999
     * @param options - configuration options for the DateTime
     * @param options.locale - a locale to set on the resulting DateTime instance
     * @param options.outputCalendar - the output calendar to set on the resulting DateTime instance
     * @param options.numberingSystem - the numbering system to set on the resulting DateTime instance
     *
     * @example
     * DateTime.utc()                                            //~> now
     * @example
     * DateTime.utc(2017)                                        //~> 2017-01-01T00:00:00Z
     * @example
     * DateTime.utc(2017, 3)                                     //~> 2017-03-01T00:00:00Z
     * @example
     * DateTime.utc(2017, 3, 12)                                 //~> 2017-03-12T00:00:00Z
     * @example
     * DateTime.utc(2017, 3, 12, 5)                              //~> 2017-03-12T05:00:00Z
     * @example
     * DateTime.utc(2017, 3, 12, 5, 45)                          //~> 2017-03-12T05:45:00Z
     * @example
     * DateTime.utc(2017, 3, 12, 5, 45, { locale: "fr" } )       //~> 2017-03-12T05:45:00Z with a French locale
     * @example
     * DateTime.utc(2017, 3, 12, 5, 45, 10)                      //~> 2017-03-12T05:45:10Z
     * @example
     * DateTime.utc(2017, 3, 12, 5, 45, 10, 765, { locale: "fr") //~> 2017-03-12T05:45:10.765Z with a French locale
     */
    static utc(
        year: number,
        month: number,
        day: number,
        hour: number,
        minute: number,
        second: number,
        millisecond: number,
        options?: LocaleOptions,
    ): DateTime;
    static utc(
        year: number,
        month: number,
        day: number,
        hour: number,
        minute: number,
        second: number,
        options?: LocaleOptions,
    ): DateTime;
    static utc(
        year: number,
        month: number,
        day: number,
        hour: number,
        minute: number,
        options?: LocaleOptions,
    ): DateTime;
    static utc(year: number, month: number, day: number, hour: number, options?: LocaleOptions): DateTime;
    static utc(year: number, month: number, day: number, options?: LocaleOptions): DateTime;
    static utc(year: number, month: number, options?: LocaleOptions): DateTime;
    static utc(year: number, options?: LocaleOptions): DateTime;
    static utc(options?: LocaleOptions): DateTime;

    /**
     * Create a DateTime from a JavaScript Date object. Uses the default zone.
     *
     * @param date - a JavaScript Date object
     * @param options - configuration options for the DateTime
     * @param options.zone - the zone to place the DateTime into
     */
    static fromJSDate(date: Date, options?: { zone?: string | Zone }): DateTime;

    /**
     * Create a DateTime from a number of milliseconds since the epoch (meaning since 1 January 1970 00:00:00 UTC). Uses the default zone.
     *
     * @param milliseconds - a number of milliseconds since 1970 UTC
     * @param options - configuration options for the DateTime
     * @param options.zone - the zone to place the DateTime into. Defaults to 'local'.
     * @param options.locale - a locale to set on the resulting DateTime instance
     * @param options.outputCalendar - the output calendar to set on the resulting DateTime instance
     * @param options.numberingSystem - the numbering system to set on the resulting DateTime instance
     */
    static fromMillis(milliseconds: number, options?: DateTimeJSOptions): DateTime;

    /**
     * Create a DateTime from a number of seconds since the epoch (meaning since 1 January 1970 00:00:00 UTC). Uses the default zone.
     *
     * @param seconds - a number of seconds since 1970 UTC
     * @param options - configuration options for the DateTime
     * @param options.zone - the zone to place the DateTime into. Defaults to 'local'.
     * @param options.locale - a locale to set on the resulting DateTime instance
     * @param options.outputCalendar - the output calendar to set on the resulting DateTime instance
     * @param options.numberingSystem - the numbering system to set on the resulting DateTime instance
     */
    static fromSeconds(seconds: number, options?: DateTimeJSOptions): DateTime;

    /**
     * Create a DateTime from a JavaScript object with keys like 'year' and 'hour' with reasonable defaults.
     *
     * @param obj - the object to create the DateTime from
     * @param obj.year - a year, such as 1987
     * @param obj.month - a month, 1-12
     * @param obj.day - a day of the month, 1-31, depending on the month
     * @param obj.ordinal - day of the year, 1-365 or 366
     * @param obj.weekYear - an ISO week year
     * @param obj.weekNumber - an ISO week number, between 1 and 52 or 53, depending on the year
     * @param obj.weekday - an ISO weekday, 1-7, where 1 is Monday and 7 is Sunday
     * @param obj.hour - hour of the day, 0-23
     * @param obj.minute - minute of the hour, 0-59
     * @param obj.second - second of the minute, 0-59
     * @param obj.millisecond - millisecond of the second, 0-999
     * @param opts - options for creating this DateTime
     * @param opts.zone - interpret the numbers in the context of a particular zone. Can take any value taken as the first argument to setZone(). Defaults to 'local'.
     * @param opts.locale - a locale to set on the resulting DateTime instance. Defaults to 'system's locale'.
     * @param opts.outputCalendar - the output calendar to set on the resulting DateTime instance
     * @param opts.numberingSystem - the numbering system to set on the resulting DateTime instance
     *
     * @example
     * DateTime.fromObject({ year: 1982, month: 5, day: 25}).toISODate() //=> '1982-05-25'
     * @example
     * DateTime.fromObject({ year: 1982 }).toISODate() //=> '1982-01-01'
     * @example
     * DateTime.fromObject({ hour: 10, minute: 26, second: 6 }) //~> today at 10:26:06
     * @example
     * DateTime.fromObject({ hour: 10, minute: 26, second: 6 }, { zone: 'utc' }),
     * @example
     * DateTime.fromObject({ hour: 10, minute: 26, second: 6 }, { zone: 'local' })
     * @example
     * DateTime.fromObject({ hour: 10, minute: 26, second: 6 }, { }zone: 'America/New_York' })
     * @example
     * DateTime.fromObject({ weekYear: 2016, weekNumber: 2, weekday: 3 }).toISODate() //=> '2016-01-13'
     */
    static fromObject(obj: DateObjectUnits, opts?: DateTimeJSOptions): DateTime;

    /**
     * Create a DateTime from an ISO 8601 string
     *
     * @param text - the ISO string
     * @param opts - options to affect the creation
     * @param opts.zone - use this zone if no offset is specified in the input string itself. Will also convert the time to this zone. Defaults to 'local'.
     * @param opts.setZone - override the zone with a fixed-offset zone specified in the string itself, if it specifies one. Defaults to false.
     * @param opts.locale - a locale to set on the resulting DateTime instance. Defaults to 'system's locale'.
     * @param opts.outputCalendar - the output calendar to set on the resulting DateTime instance
     * @param opts.numberingSystem - the numbering system to set on the resulting DateTime instance
     *
     * @example
     * DateTime.fromISO('2016-05-25T09:08:34.123')
     * @example
     * DateTime.fromISO('2016-05-25T09:08:34.123+06:00')
     * @example
     * DateTime.fromISO('2016-05-25T09:08:34.123+06:00', {setZone: true})
     * @example
     * DateTime.fromISO('2016-05-25T09:08:34.123', {zone: 'utc'})
     * @example
     * DateTime.fromISO('2016-W05-4')
     */
    static fromISO(text: string, opts?: DateTimeOptions): DateTime;

    /**
     * Create a DateTime from an RFC 2822 string
     *
     * @param text - the RFC 2822 string
     * @param opts - options to affect the creation
     * @param opts.zone - convert the time to this zone. Since the offset is always specified in the string itself,
     * this has no effect on the interpretation of string, merely the zone the resulting DateTime is expressed in. Defaults to 'local'
     * @param opts.setZone - override the zone with a fixed-offset zone specified in the string itself, if it specifies one. Defaults to false.
     * @param opts.locale - a locale to set on the resulting DateTime instance. Defaults to 'system's locale'.
     * @param opts.outputCalendar - the output calendar to set on the resulting DateTime instance
     * @param opts.numberingSystem - the numbering system to set on the resulting DateTime instance
     *
     * @example
     * DateTime.fromRFC2822('25 Nov 2016 13:23:12 GMT')
     * @example
     * DateTime.fromRFC2822('Fri, 25 Nov 2016 13:23:12 +0600')
     * @example
     * DateTime.fromRFC2822('25 Nov 2016 13:23 Z')
     */
    static fromRFC2822(text: string, opts?: DateTimeOptions): DateTime;

    /**
     * Create a DateTime from an HTTP header date
     *
     * @see https://www.w3.org/Protocols/rfc2616/rfc2616-sec3.html#sec3.3.1
     *
     * @param text - the HTTP header date
     * @param opts - options to affect the creation
     * @param opts.zone - convert the time to this zone. Since HTTP dates are always in UTC,
     * this has no effect on the interpretation of string,merely the zone the resulting DateTime is expressed in. Defaults to 'local'.
     * @param opts.setZone - override the zone with the fixed-offset zone specified in the string. For HTTP dates, this is always UTC,
     * so this option is equivalent to setting the `zone` option to 'utc', but this option is included for consistency with similar methods. Defaults to false.
     * @param opts.locale - a locale to set on the resulting DateTime instance. Defaults to 'system's locale'.
     * @param opts.outputCalendar - the output calendar to set on the resulting DateTime instance
     * @param opts.numberingSystem - the numbering system to set on the resulting DateTime instance
     *
     * @example
     * DateTime.fromHTTP('Sun, 06 Nov 1994 08:49:37 GMT')
     * @example
     * DateTime.fromHTTP('Sunday, 06-Nov-94 08:49:37 GMT')
     * @example
     * DateTime.fromHTTP('Sun Nov  6 08:49:37 1994')
     */
    static fromHTTP(text: string, opts?: DateTimeOptions): DateTime;

    /**
     * Create a DateTime from an input string and format string.
     * Defaults to en-US if no locale has been specified, regardless of the system's locale. For a table of tokens and their interpretations,
     * see [here](https://moment.github.io/luxon/#/parsing?id=table-of-tokens).
     *
     * @param text - the string to parse
     * @param fmt - the format the string is expected to be in (see the link below for the formats)
     * @param opts - options to affect the creation
     * @param opts.zone - use this zone if no offset is specified in the input string itself. Will also convert the DateTime to this zone. Defaults to 'local'.
     * @param opts.setZone - override the zone with a zone specified in the string itself, if it specifies one. Defaults to false.
     * @param opts.locale - a locale string to use when parsing. Will also set the DateTime to this locale. Defaults to 'en-US'.
     * @param opts.numberingSystem - the numbering system to use when parsing. Will also set the resulting DateTime to this numbering system
     * @param opts.outputCalendar - the output calendar to set on the resulting DateTime instance
     */
    static fromFormat(text: string, fmt: string, opts?: DateTimeOptions): DateTime;

    /**
     * @deprecated use fromFormat instead
     */
    static fromString(text: string, format: string, options?: DateTimeOptions): DateTime;

    /**
     * Create a DateTime from a SQL date, time, or datetime
     * Defaults to en-US if no locale has been specified, regardless of the system's locale
     *
     * @param text - the string to parse
     * @param opts - options to affect the creation
     * @param opts.zone - use this zone if no offset is specified in the input string itself. Will also convert the DateTime to this zone. Defaults to 'local'.
     * @param opts.setZone - override the zone with a zone specified in the string itself, if it specifies one. Defaults to false.
     * @param opts.locale - a locale string to use when parsing. Will also set the DateTime to this locale. Defaults to 'en-US'.
     * @param opts.numberingSystem - the numbering system to use when parsing. Will also set the resulting DateTime to this numbering system
     * @param opts.outputCalendar - the output calendar to set on the resulting DateTime instance
     *
     * @example
     * DateTime.fromSQL('2017-05-15')
     * @example
     * DateTime.fromSQL('2017-05-15 09:12:34')
     * @example
     * DateTime.fromSQL('2017-05-15 09:12:34.342')
     * @example
     * DateTime.fromSQL('2017-05-15 09:12:34.342+06:00')
     * @example
     * DateTime.fromSQL('2017-05-15 09:12:34.342 America/Los_Angeles')
     * @example
     * DateTime.fromSQL('2017-05-15 09:12:34.342 America/Los_Angeles', { setZone: true })
     * @example
     * DateTime.fromSQL('2017-05-15 09:12:34.342', { zone: 'America/Los_Angeles' })
     * @example
     * DateTime.fromSQL('09:12:34.342')
     */
    static fromSQL(text: string, opts?: DateTimeOptions): DateTime;

    /**
     * Create an invalid DateTime.
     *
     * @param reason - simple string of why this DateTime is invalid. Should not contain parameters or anything else data-dependent
     * @param explanation - longer explanation, may include parameters and other useful debugging information. Defaults to null.
     */
    static invalid(reason: string, explanation?: string): DateTime;

    /**
     * Check if an object is a DateTime. Works across context boundaries
     *
     * @param o
     */
    static isDateTime(o: unknown): o is DateTime;

    // INFO

    /**
     * Get the value of unit.
     *
     * @param unit - a unit such as 'minute' or 'day'
     *
     * @example
     * DateTime.local(2017, 7, 4).get('month'); //=> 7
     * @example
     * DateTime.local(2017, 7, 4).get('day'); //=> 4
     */
    get(unit: keyof DateTime): number;

    /**
     * Returns whether the DateTime is valid. Invalid DateTimes occur when:
     * * The DateTime was created from invalid calendar information, such as the 13th month or February 30
     * * The DateTime was created by an operation on another invalid date
     */
    get isValid(): boolean;

    /**
     * Returns an error code if this DateTime is invalid, or null if the DateTime is valid
     */
    get invalidReason(): string | null;

    /**
     * Returns an explanation of why this DateTime became invalid, or null if the DateTime is valid
     */
    get invalidExplanation(): string | null;

    /**
     * Get the locale of a DateTime, such 'en-GB'. The locale is used when formatting the DateTime
     */
    get locale(): string;

    /**
     * Get the numbering system of a DateTime, such 'beng'. The numbering system is used when formatting the DateTime
     */
    get numberingSystem(): string;

    /**
     * Get the output calendar of a DateTime, such 'islamic'. The output calendar is used when formatting the DateTime
     */
    get outputCalendar(): string;

    /**
     * Get the time zone associated with this DateTime.
     */
    get zone(): Zone;

    /**
     * Get the name of the time zone.
     */
    get zoneName(): string;

    /**
     * Get the year
     *
     * @example DateTime.local(2017, 5, 25).year //=> 2017
     */
    get year(): number;

    /**
     * Get the quarter
     *
     * @example DateTime.local(2017, 5, 25).quarter //=> 2
     */
    get quarter(): QuarterNumbers;

    /**
     * Get the month (1-12).
     *
     * @example DateTime.local(2017, 5, 25).month //=> 5
     */
    get month(): MonthNumbers;

    /**
     * Get the day of the month (1-30ish).
     *
     * @example DateTime.local(2017, 5, 25).day //=> 25
     */
    get day(): DayNumbers;

    /**
     * Get the hour of the day (0-23).
     *
     * @example DateTime.local(2017, 5, 25, 9).hour //=> 9
     */
    get hour(): HourNumbers;

    /**
     * Get the minute of the hour (0-59).
     *
     * @example
     * DateTime.local(2017, 5, 25, 9, 30).minute //=> 30
     */
    get minute(): MinuteNumbers;

    /**
     * Get the second of the minute (0-59).
     *
     * @example
     * DateTime.local(2017, 5, 25, 9, 30, 52).second //=> 52
     */
    get second(): SecondNumbers;

    /**
     * Get the millisecond of the second (0-999).
     *
     * @example
     * DateTime.local(2017, 5, 25, 9, 30, 52, 654).millisecond //=> 654
     */
    get millisecond(): number;

    /**
     * Get the week year
     * @see https://en.wikipedia.org/wiki/ISO_week_date
     *
     * @example
     * DateTime.local(2014, 12, 31).weekYear //=> 2015
     */
    get weekYear(): number;

    /**
     * Get the week number of the week year (1-52ish).
     * @see https://en.wikipedia.org/wiki/ISO_week_date
     *
     * @example
     * DateTime.local(2017, 5, 25).weekNumber //=> 21
     */
    get weekNumber(): WeekNumbers;

    /**
     * Get the day of the week.
     * 1 is Monday and 7 is Sunday
     * @see https://en.wikipedia.org/wiki/ISO_week_date
     *
     * @example
     * DateTime.local(2014, 11, 31).weekday //=> 4
     */
    get weekday(): WeekdayNumbers;

    /**
     * Get the ordinal (meaning the day of the year)
     *
     * @example
     * DateTime.local(2017, 5, 25).ordinal //=> 145
     */
    get ordinal(): number;

    /**
     * Get the human readable short month name, such as 'Oct'.
     * Defaults to the system's locale if no locale has been specified
     *
     * @example
     * DateTime.local(2017, 10, 30).monthShort //=> Oct
     */
    get monthShort(): string;

    /**
     * Get the human readable long month name, such as 'October'.
     * Defaults to the system's locale if no locale has been specified
     *
     * @example
     * DateTime.local(2017, 10, 30).monthLong //=> October
     */
    get monthLong(): string;

    /**
     * Get the human readable short weekday, such as 'Mon'.
     * Defaults to the system's locale if no locale has been specified
     *
     * @example
     * DateTime.local(2017, 10, 30).weekdayShort //=> Mon
     */
    get weekdayShort(): string;

    /**
     * Get the human readable long weekday, such as 'Monday'.
     * Defaults to the system's locale if no locale has been specified
     *
     * @example
     * DateTime.local(2017, 10, 30).weekdayLong //=> Monday
     */
    get weekdayLong(): string;

    /**
     * Get the UTC offset of this DateTime in minutes
     *
     * @example
     * DateTime.now().offset //=> -240
     * @example
     * DateTime.utc().offset //=> 0
     */
    get offset(): number;

    /**
     * Get the short human name for the zone's current offset, for example "EST" or "EDT".
     * Defaults to the system's locale if no locale has been specified
     */
    get offsetNameShort(): string;

    /**
     * Get the long human name for the zone's current offset, for example "Eastern Standard Time" or "Eastern Daylight Time".
     * Defaults to the system's locale if no locale has been specified
     */
    get offsetNameLong(): string;

    /**
     * Get whether this zone's offset ever changes, as in a DST.
     */
    get isOffsetFixed(): boolean;

    /**
     * Get whether the DateTime is in a DST.
     */
    get isInDST(): boolean;

    /**
     * Returns true if this DateTime is in a leap year, false otherwise
     *
     * @example
     * DateTime.local(2016).isInLeapYear //=> true
     * @example
     * DateTime.local(2013).isInLeapYear //=> false
     */
    get isInLeapYear(): boolean;

    /**
     * Returns the number of days in this DateTime's month
     *
     * @example
     * DateTime.local(2016, 2).daysInMonth //=> 29
     * @example
     * DateTime.local(2016, 3).daysInMonth //=> 31
     */
    get daysInMonth(): PossibleDaysInMonth;

    /**
     * Returns the number of days in this DateTime's year
     *
     * @example
     * DateTime.local(2016).daysInYear //=> 366
     * @example
     * DateTime.local(2013).daysInYear //=> 365
     */
    get daysInYear(): PossibleDaysInYear;

    /**
     * Returns the number of weeks in this DateTime's year
     * @see https://en.wikipedia.org/wiki/ISO_week_date
     *
     * @example
     * DateTime.local(2004).weeksInWeekYear //=> 53
     * @example
     * DateTime.local(2013).weeksInWeekYear //=> 52
     */
    get weeksInWeekYear(): PossibleWeeksInYear;

    /**
     * Returns the resolved Intl options for this DateTime.
     * This is useful in understanding the behavior of formatting methods
     *
     * @param opts - the same options as toLocaleString
     */
    resolvedLocaleOptions(opts?: LocaleOptions | DateTimeFormatOptions): ResolvedLocaleOptions;

    // TRANSFORM

    /**
     * "Set" the DateTime's zone to UTC. Returns a newly-constructed DateTime.
     *
     * Equivalent to {@link DateTime.setZone}('utc')
     *
     * @param offset - optionally, an offset from UTC in minutes. Defaults to 0.
     * @param opts - options to pass to `setZone()`. Defaults to {}.
     */
    toUTC(offset?: number, opts?: ZoneOptions): DateTime;

    /**
     * "Set" the DateTime's zone to the host's local zone. Returns a newly-constructed DateTime.
     *
     * Equivalent to `setZone('local')`
     */
    toLocal(): DateTime;

    /**
     * "Set" the DateTime's zone to specified zone. Returns a newly-constructed DateTime.
     *
     * By default, the setter keeps the underlying time the same (as in, the same timestamp), but the new instance will report different local times and consider DSTs when making computations,
     * as with {@link DateTime.plus}. You may wish to use {@link DateTime.toLocal} and {@link DateTime.toUTC} which provide simple convenience wrappers for commonly used zones.
     *
     * @param zone - a zone identifier. As a string, that can be any IANA zone supported by the host environment, or a fixed-offset name of the form 'UTC+3', or the strings 'local' or 'utc'.
     * You may also supply an instance of a {@link DateTime.Zone} class. Defaults to 'local'.
     * @param opts - options
     * @param opts.keepLocalTime - If true, adjust the underlying time so that the local time stays the same, but in the target zone. You should rarely need this. Defaults to false.
     */
    setZone(zone?: string | Zone, opts?: ZoneOptions): DateTime;

    /**
     * "Set" the locale, numberingSystem, or outputCalendar. Returns a newly-constructed DateTime.
     *
     * @param properties - the properties to set
     *
     * @example
     * DateTime.local(2017, 5, 25).reconfigure({ locale: 'en-GB' })
     */
    reconfigure(properties: LocaleOptions): DateTime;

    /**
     * "Set" the locale. Returns a newly-constructed DateTime.
     * Just a convenient alias for reconfigure({ locale })
     *
     * @example
     * DateTime.local(2017, 5, 25).setLocale('en-GB')
     */
    setLocale(locale: string): DateTime;

    /**
     * "Set" the values of specified units. Returns a newly-constructed DateTime.
     * You can only set units with this method; for "setting" metadata, see {@link DateTime.reconfigure} and {@link DateTime.setZone}.
     *
     * @param values - a mapping of units to numbers
     *
     * @example
     * dt.set({ year: 2017 })
     * @example
     * dt.set({ hour: 8, minute: 30 })
     * @example
     * dt.set({ weekday: 5 })
     * @example
     * dt.set({ year: 2005, ordinal: 234 })
     */
    set(values: DateObjectUnits): DateTime;

    /**
     * Adding hours, minutes, seconds, or milliseconds increases the timestamp by the right number of milliseconds. Adding days, months, or years shifts the calendar,
     * accounting for DSTs and leap years along the way. Thus, `dt.plus({ hours: 24 })` may result in a different time than `dt.plus({ days: 1 })` if there's a DST shift in between.
     *
     * @param duration - The amount to add. Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
     *
     * @example
     * DateTime.now().plus(123) //~> in 123 milliseconds
     * @example
     * DateTime.now().plus({ minutes: 15 }) //~> in 15 minutes
     * @example
     * DateTime.now().plus({ days: 1 }) //~> this time tomorrow
     * @example
     * DateTime.now().plus({ days: -1 }) //~> this time yesterday
     * @example
     * DateTime.now().plus({ hours: 3, minutes: 13 }) //~> in 3 hr, 13 min
     * @example
     * DateTime.now().plus(Duration.fromObject({ hours: 3, minutes: 13 })) //~> in 3 hr, 13 min
     */
    plus(duration: DurationLike): DateTime;

    /**
     * See {@link DateTime.plus}
     *
     * @param duration - The amount to subtract. Either a Luxon Duration, a number of milliseconds, the object argument to Duration.fromObject()
     */
    minus(duration: DurationLike): DateTime;

    /**
     * "Set" this DateTime to the beginning of a unit of time.
     *
     * @param unit - The unit to go to the beginning of. Can be 'year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', or 'millisecond'.
     *
     * @example
     * DateTime.local(2014, 3, 3).startOf('month').toISODate(); //=> '2014-03-01'
     * @example
     * DateTime.local(2014, 3, 3).startOf('year').toISODate(); //=> '2014-01-01'
     * @example
     * DateTime.local(2014, 3, 3).startOf('week').toISODate(); //=> '2014-03-03', weeks always start on Mondays
     * @example
     * DateTime.local(2014, 3, 3, 5, 30).startOf('day').toISOTime(); //=> '00:00.000-05:00'
     * @example
     * DateTime.local(2014, 3, 3, 5, 30).startOf('hour').toISOTime(); //=> '05:00:00.000-05:00'
     */
    startOf(unit: DateTimeUnit): DateTime;

    /**
     * "Set" this DateTime to the end (meaning the last millisecond) of a unit of time
     *
     * @param unit - The unit to go to the end of. Can be 'year', 'quarter', 'month', 'week', 'day', 'hour', 'minute', 'second', or 'millisecond'.
     *
     * @example
     * DateTime.local(2014, 3, 3).endOf('month').toISO(); //=> '2014-03-31T23:59:59.999-05:00'
     * @example
     * DateTime.local(2014, 3, 3).endOf('year').toISO(); //=> '2014-12-31T23:59:59.999-05:00'
     * @example
     * DateTime.local(2014, 3, 3).endOf('week').toISO(); // => '2014-03-09T23:59:59.999-05:00', weeks start on Mondays
     * @example
     * DateTime.local(2014, 3, 3, 5, 30).endOf('day').toISO(); //=> '2014-03-03T23:59:59.999-05:00'
     * @example
     * DateTime.local(2014, 3, 3, 5, 30).endOf('hour').toISO(); //=> '2014-03-03T05:59:59.999-05:00'
     */
    endOf(unit: DateTimeUnit): DateTime;

    // OUTPUT

    /**
     * Returns a string representation of this DateTime formatted according to the specified format string.
     * **You may not want this.** See {@link DateTime.toLocaleString} for a more flexible formatting tool. For a table of tokens and their interpretations,
     * see [here](https://moment.github.io/luxon/#/formatting?id=table-of-tokens).
     * Defaults to en-US if no locale has been specified, regardless of the system's locale.
     *
     * @param fmt - the format string
     * @param opts - opts to override the configuration options on this DateTime
     *
     * @example
     * DateTime.now().toFormat('yyyy LLL dd') //=> '2017 Apr 22'
     * @example
     * DateTime.now().setLocale('fr').toFormat('yyyy LLL dd') //=> '2017 avr. 22'
     * @example
     * DateTime.now().toFormat('yyyy LLL dd', { locale: "fr" }) //=> '2017 avr. 22'
     * @example
     * DateTime.now().toFormat("HH 'hours and' mm 'minutes'") //=> '20 hours and 55 minutes'
     */
    toFormat(fmt: string, opts?: LocaleOptions): string;

    /**
     * Returns a localized string representing this date. Accepts the same options as the Intl.DateTimeFormat constructor and any presets defined by Luxon,
     * such as `DateTime.DATE_FULL` or `DateTime.TIME_SIMPLE` of the DateTime in the assigned locale.
     * Defaults to the system's locale if no locale has been specified
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat
     *
     * @param formatOpts - Intl.DateTimeFormat constructor options and configuration options
     * @param opts - opts to override the configuration options on this DateTime
     *
     * @example
     * DateTime.now().toLocaleString(); //=> 4/20/2017
     * @example
     * DateTime.now().setLocale('en-gb').toLocaleString(); //=> '20/04/2017'
     * @example
     * DateTime.now().toLocaleString({ locale: 'en-gb' }); //=> '20/04/2017'
     * @example
     * DateTime.now().toLocaleString(DateTime.DATE_FULL); //=> 'April 20, 2017'
     * @example
     * DateTime.now().toLocaleString(DateTime.TIME_SIMPLE); //=> '11:32 AM'
     * @example
     * DateTime.now().toLocaleString(DateTime.DATETIME_SHORT); //=> '4/20/2017, 11:32 AM'
     * @example
     * DateTime.now().toLocaleString({ weekday: 'long', month: 'long', day: '2-digit' }); //=> 'Thursday, April 20'
     * @example
     * DateTime.now().toLocaleString({ weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }); //=> 'Thu, Apr 20, 11:27 AM'
     * @example
     * DateTime.now().toLocaleString({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); //=> '11:32'
     */
    toLocaleString(formatOpts?: DateTimeFormatOptions, opts?: LocaleOptions): string;

    /**
     * Returns an array of format "parts", meaning individual tokens along with metadata. This is allows callers to post-process individual sections of the formatted output.
     * Defaults to the system's locale if no locale has been specified
     * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat/formatToParts
     *
     * @param opts - Intl.DateTimeFormat constructor options, same as `toLocaleString`.
     *
     * @example
     * DateTime.now().toLocaleParts(); //=> [
     *                                 //=>   { type: 'day', value: '25' },
     *                                 //=>   { type: 'literal', value: '/' },
     *                                 //=>   { type: 'month', value: '05' },
     *                                 //=>   { type: 'literal', value: '/' },
     *                                 //=>   { type: 'year', value: '1982' }
     *                                 //=> ]
     */
    toLocaleParts(opts?: DateTimeFormatOptions): Intl.DateTimeFormatPart[];

    /**
     * Returns an ISO 8601-compliant string representation of this DateTime
     *
     * @param opts - options
     * @param opts.suppressMilliseconds - exclude milliseconds from the format if they're 0. Defaults to false.
     * @param opts.suppressSeconds - exclude seconds from the format if they're 0. Defaults to false.
     * @param opts.includeOffset - include the offset, such as 'Z' or '-04:00'. Defaults to true.
     * @param opts.format - choose between the basic and extended format. Defaults to 'extended'.
     *
     * @example
     * DateTime.utc(1982, 5, 25).toISO() //=> '1982-05-25T00:00:00.000Z'
     * @example
     * DateTime.now().toISO() //=> '2017-04-22T20:47:05.335-04:00'
     * @example
     * DateTime.now().toISO({ includeOffset: false }) //=> '2017-04-22T20:47:05.335'
     * @example
     * DateTime.now().toISO({ format: 'basic' }) //=> '20170422T204705.335-0400'
     */
    toISO(opts?: ToISOTimeOptions): string;

    /**
     * Returns an ISO 8601-compliant string representation of this DateTime's date component
     *
     * @param opts - options
     * @param opts.format - choose between the basic and extended format. Defaults to 'extended'.
     *
     * @example
     * DateTime.utc(1982, 5, 25).toISODate() //=> '1982-05-25'
     * @example
     * DateTime.utc(1982, 5, 25).toISODate({ format: 'basic' }) //=> '19820525'
     */
    toISODate(opts?: ToISODateOptions): string;

    /**
     * Returns an ISO 8601-compliant string representation of this DateTime's week date
     *
     * @example
     * DateTime.utc(1982, 5, 25).toISOWeekDate() //=> '1982-W21-2'
     */
    toISOWeekDate(): string;

    /**
     * Returns an ISO 8601-compliant string representation of this DateTime's time component
     *
     * @param opts - options
     * @param opts.suppressMilliseconds - exclude milliseconds from the format if they're 0. Defaults to false.
     * @param opts.suppressSeconds - exclude seconds from the format if they're 0. Defaults to false.
     * @param opts.includeOffset - include the offset, such as 'Z' or '-04:00'. Defaults to true.
     * @param opts.includePrefix - include the `T` prefix. Defaults to false.
     * @param opts.format - choose between the basic and extended format. Defaults to 'extended'.
     *
     * @example
     * DateTime.utc().set({ hour: 7, minute: 34 }).toISOTime() //=> '07:34:19.361Z'
     * @example
     * DateTime.utc().set({ hour: 7, minute: 34, seconds: 0, milliseconds: 0 }).toISOTime({ suppressSeconds: true }) //=> '07:34Z'
     * @example
     * DateTime.utc().set({ hour: 7, minute: 34 }).toISOTime({ format: 'basic' }) //=> '073419.361Z'
     * @example
     * DateTime.utc().set({ hour: 7, minute: 34 }).toISOTime({ includePrefix: true }) //=> 'T07:34:19.361Z'
     */
    toISOTime(ops?: ToISOTimeOptions): string;

    /**
     * Returns an RFC 2822-compatible string representation of this DateTime, always in UTC
     *
     * @example
     * DateTime.utc(2014, 7, 13).toRFC2822() //=> 'Sun, 13 Jul 2014 00:00:00 +0000'
     * @example
     * DateTime.local(2014, 7, 13).toRFC2822() //=> 'Sun, 13 Jul 2014 00:00:00 -0400'
     */
    toRFC2822(): string;

    /**
     * Returns a string representation of this DateTime appropriate for use in HTTP headers.
     * Specifically, the string conforms to RFC 1123.
     * @see https://www.w3.org/Protocols/rfc2616/rfc2616-sec3.html#sec3.3.1
     *
     * @example
     * DateTime.utc(2014, 7, 13).toHTTP() //=> 'Sun, 13 Jul 2014 00:00:00 GMT'
     * @example
     * DateTime.utc(2014, 7, 13, 19).toHTTP() //=> 'Sun, 13 Jul 2014 19:00:00 GMT'
     */
    toHTTP(): string;

    /**
     * Returns a string representation of this DateTime appropriate for use in SQL Date
     *
     * @example
     * DateTime.utc(2014, 7, 13).toSQLDate() //=> '2014-07-13'
     */
    toSQLDate(): string;

    /**
     * Returns a string representation of this DateTime appropriate for use in SQL Time
     *
     * @param opts - options
     * @param opts.includeZone - include the zone, such as 'America/New_York'. Overrides includeOffset. Defaults to false.
     * @param opts.includeOffset - include the offset, such as 'Z' or '-04:00'. Defaults to true.
     *
     * @example
     * DateTime.utc().toSQL() //=> '05:15:16.345'
     * @example
     * DateTime.now().toSQL() //=> '05:15:16.345 -04:00'
     * @example
     * DateTime.now().toSQL({ includeOffset: false }) //=> '05:15:16.345'
     * @example
     * DateTime.now().toSQL({ includeZone: false }) //=> '05:15:16.345 America/New_York'
     */
    toSQLTime(opts?: ToSQLOptions): string;

    /**
     * Returns a string representation of this DateTime appropriate for use in SQL DateTime
     *
     * @param opts - options
     * @param opts.includeZone - include the zone, such as 'America/New_York'. Overrides includeOffset. Defaults to false.
     * @param opts.includeOffset - include the offset, such as 'Z' or '-04:00'. Defaults to true.
     *
     * @example
     * DateTime.utc(2014, 7, 13).toSQL() //=> '2014-07-13 00:00:00.000 Z'
     * @example
     * DateTime.local(2014, 7, 13).toSQL() //=> '2014-07-13 00:00:00.000 -04:00'
     * @example
     * DateTime.local(2014, 7, 13).toSQL({ includeOffset: false }) //=> '2014-07-13 00:00:00.000'
     * @example
     * DateTime.local(2014, 7, 13).toSQL({ includeZone: true }) //=> '2014-07-13 00:00:00.000 America/New_York'
     */
    toSQL(opts?: ToSQLOptions): string;

    /**
     * Returns a string representation of this DateTime appropriate for debugging
     */
    toString(): string;

    /**
     * Returns the epoch milliseconds of this DateTime. Alias of {@link DateTime.toMillis}
     */
    valueOf(): number;

    /**
     * Returns the epoch milliseconds of this DateTime.
     */
    toMillis(): number;

    /**
     * Returns the epoch seconds of this DateTime.
     */
    toSeconds(): number;

    /**
     * Returns an ISO 8601 representation of this DateTime appropriate for use in JSON.
     */
    toJSON(): string;

    /**
     * Returns a BSON serializable equivalent to this DateTime.
     */
    toBSON(): Date;

    /**
     * Returns a JavaScript object with this DateTime's year, month, day, and so on.
     *
     * @param opts - options for generating the object
     * @param opts.includeConfig - include configuration attributes in the output. Defaults to false.
     *
     * @example
     * DateTime.now().toObject() //=> { year: 2017, month: 4, day: 22, hour: 20, minute: 49, second: 42, millisecond: 268 }
     */
    toObject(opts?: {
        /**
         * Include configuration attributes in the output
         * @defaultValue false
         */
        includeConfig?: boolean | undefined;
    }): ToObjectOutput;

    /**
     * Returns a JavaScript Date equivalent to this DateTime.
     */
    toJSDate(): Date;

    // COMPARE

    /**
     * Return the difference between two DateTimes as a Duration.
     *
     * @param otherDateTime - the DateTime to compare this one to
     * @param unit- the unit or array of units (such as 'hours' or 'days') to include in the duration. Defaults to ['milliseconds'].
     * @param opts - options that affect the creation of the Duration
     * @param opts.conversionAccuracy - the conversion system to use. Defaults to 'casual'.
     *
     * @example
     * var i1 = DateTime.fromISO('1982-05-25T09:45'),
     *     i2 = DateTime.fromISO('1983-10-14T10:30');
     * i2.diff(i1).toObject() //=> { milliseconds: 43807500000 }
     * i2.diff(i1, 'hours').toObject() //=> { hours: 12168.75 }
     * i2.diff(i1, ['months', 'days']).toObject() //=> { months: 16, days: 19.03125 }
     * i2.diff(i1, ['months', 'days', 'hours']).toObject() //=> { months: 16, days: 19, hours: 0.75 }
     */
    diff(otherDateTime: DateTime, unit?: DurationUnits, opts?: DiffOptions): Duration;

    /**
     * Return the difference between this DateTime and right now.
     * See {@link DateTime.diff}
     *
     * @param unit - the unit or units units (such as 'hours' or 'days') to include in the duration. Defaults to ['milliseconds'].
     * @param opts - options that affect the creation of the Duration
     * @param opts.conversionAccuracy - the conversion system to use. Defaults to 'casual'.
     */
    diffNow(unit?: DurationUnits, opts?: DiffOptions): Duration;

    /**
     * Return an Interval spanning between this DateTime and another DateTime
     *
     * @param otherDateTime - the other end point of the Interval
     */
    until(otherDateTime: DateTime): Interval;

    /**
     * Return whether this DateTime is in the same unit of time as another DateTime.
     * Note that time zones are **ignored** in this comparison, which compares the **local** calendar time. Use {@link DateTime.setZone} to convert one of the dates if needed.
     *
     * @param otherDateTime - the other DateTime
     * @param unit - the unit of time to check sameness on
     *
     * @example
     * DateTime.now().hasSame(otherDT, 'day'); //~> true if otherDT is in the same current calendar day
     */
    hasSame(otherDateTime: DateTime, unit: DateTimeUnit): boolean;

    /**
     * Equality check
     * Two DateTimes are equal iff they represent the same millisecond, have the same zone and location, and are both valid.
     * To compare just the millisecond values, use `+dt1 === +dt2`.
     *
     * @param other - the other DateTime
     */
    equals(other: DateTime): boolean;

    /**
     * Returns a string representation of a this time relative to now, such as "in two days". Can only internationalize if your
     * platform supports Intl.RelativeTimeFormat. Rounds down by default.
     *
     * @param options - options that affect the output
     * @param options.base - the DateTime to use as the basis to which this time is compared. Defaults to now.
     * @param options.style - the style of units, must be "long", "short", or "narrow". Defaults to long.
     * @param options.unit - use a specific unit or array of units; if omitted, or an array, the method will pick the best unit.
     * Use an array or one of "years", "quarters", "months", "weeks", "days", "hours", "minutes", or "seconds"
     * @param options.round - whether to round the numbers in the output. Defaults to true.
     * @param options.padding - padding in milliseconds. This allows you to round up the result if it fits inside the threshold. Don't use in combination with {round: false}
     * because the decimal output will include the padding. Defaults to 0.
     * @param options.locale - override the locale of this DateTime
     * @param options.numberingSystem - override the numberingSystem of this DateTime. The Intl system may choose not to honor this
     *
     * @example
     * DateTime.now().plus({ days: 1 }).toRelative() //=> "in 1 day"
     * @example
     * DateTime.now().setLocale("es").toRelative({ days: 1 }) //=> "dentro de 1 día"
     * @example
     * DateTime.now().plus({ days: 1 }).toRelative({ locale: "fr" }) //=> "dans 23 heures"
     * @example
     * DateTime.now().minus({ days: 2 }).toRelative() //=> "2 days ago"
     * @example
     * DateTime.now().minus({ days: 2 }).toRelative({ unit: "hours" }) //=> "48 hours ago"
     * @example
     * DateTime.now().minus({ hours: 36 }).toRelative({ round: false }) //=> "1.5 days ago"
     */
    toRelative(options?: ToRelativeOptions): string | null;

    /**
     * Returns a string representation of this date relative to today, such as "yesterday" or "next month".
     * Only internationalizes on platforms that supports Intl.RelativeTimeFormat.
     *
     * @param options - options that affect the output
     * @param options.base - the DateTime to use as the basis to which this time is compared. Defaults to now.
     * @param options.locale - override the locale of this DateTime
     * @param options.unit - use a specific unit; if omitted, the method will pick the unit. Use one of "years", "quarters", "months", "weeks", or "days"
     * @param options.numberingSystem - override the numberingSystem of this DateTime. The Intl system may choose not to honor this
     *
     * @example
     * DateTime.now().plus({ days: 1 }).toRelativeCalendar() //=> "tomorrow"
     * @example
     * DateTime.now().setLocale("es").plus({ days: 1 }).toRelative() //=> ""mañana"
     * @example
     * DateTime.now().plus({ days: 1 }).toRelativeCalendar({ locale: "fr" }) //=> "demain"
     * @example
     * DateTime.now().minus({ days: 2 }).toRelativeCalendar() //=> "2 days ago"
     */
    toRelativeCalendar(options?: ToRelativeCalendarOptions): string | null;

    /**
     * Return the min of several date times
     *
     * @param dateTimes - the DateTimes from which to choose the minimum
     */
    static min(...dateTimes: DateTime[]): DateTime;

    /**
     * Return the max of several date times
     *
     * @param dateTimes - the DateTimes from which to choose the maximum
     */
    static max(...dateTimes: DateTime[]): DateTime;

    // MISC

    /**
     * Explain how a string would be parsed by fromFormat()
     *
     * @param text - the string to parse
     * @param fmt - the format the string is expected to be in (see description)
     * @param options - options taken by fromFormat()
     */
    static fromFormatExplain(text: string, fmt: string, options?: DateTimeOptions): ExplainedFormat;

    /**
     * @deprecated use fromFormatExplain instead
     */
    static fromStringExplain(text: string, fmt: string, options?: DateTimeOptions): ExplainedFormat;

    // FORMAT PRESETS

    /**
     * {@link DateTime.toLocaleString} format like 10/14/1983
     */
    static get DATE_SHORT(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like 'Oct 14, 1983'
     */
    static get DATE_MED(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like 'Fri, Oct 14, 1983'
     */
    static get DATE_MED_WITH_WEEKDAY(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like 'October 14, 1983'
     */
    static get DATE_FULL(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like 'Tuesday, October 14, 1983'
     */
    static get DATE_HUGE(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like '09:30 AM'. Only 12-hour if the locale is.
     */
    static get TIME_SIMPLE(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like '09:30:23 AM'. Only 12-hour if the locale is.
     */
    static get TIME_WITH_SECONDS(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like '09:30:23 AM EDT'. Only 12-hour if the locale is.
     */
    static get TIME_WITH_SHORT_OFFSET(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like '09:30:23 AM Eastern Daylight Time'. Only 12-hour if the locale is.
     */
    static get TIME_WITH_LONG_OFFSET(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like '09:30', always 24-hour.
     */
    static get TIME_24_SIMPLE(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like '09:30:23', always 24-hour.
     */
    static get TIME_24_WITH_SECONDS(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like '09:30:23 EDT', always 24-hour.
     */
    static get TIME_24_WITH_SHORT_OFFSET(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like '09:30:23 Eastern Daylight Time', always 24-hour.
     */
    static get TIME_24_WITH_LONG_OFFSET(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like '10/14/1983, 9:30 AM'. Only 12-hour if the locale is.
     */
    static get DATETIME_SHORT(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like '10/14/1983, 9:30:33 AM'. Only 12-hour if the locale is.
     */
    static get DATETIME_SHORT_WITH_SECONDS(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like 'Oct 14, 1983, 9:30 AM'. Only 12-hour if the locale is.
     */
    static get DATETIME_MED(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like 'Oct 14, 1983, 9:30:33 AM'. Only 12-hour if the locale is.
     */
    static get DATETIME_MED_WITH_SECONDS(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like 'Fri, 14 Oct 1983, 9:30 AM'. Only 12-hour if the locale is.
     */
    static get DATETIME_MED_WITH_WEEKDAY(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like 'October 14, 1983, 9:30 AM EDT'. Only 12-hour if the locale is.
     */
    static get DATETIME_FULL(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like 'October 14, 1983, 9:30:33 AM EDT'. Only 12-hour if the locale is.
     */
    static get DATETIME_FULL_WITH_SECONDS(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like 'Friday, October 14, 1983, 9:30 AM Eastern Daylight Time'. Only 12-hour if the locale is.
     */
    static get DATETIME_HUGE(): Intl.DateTimeFormatOptions;

    /**
     * {@link DateTime.toLocaleString} format like 'Friday, October 14, 1983, 9:30:33 AM Eastern Daylight Time'. Only 12-hour if the locale is.
     */
    static get DATETIME_HUGE_WITH_SECONDS(): Intl.DateTimeFormatOptions;
}

declare type DateTimeClass = typeof DateTime;
// End Luxon Types


// Begin Math Types
type Vector2Class = typeof Vector2;
type Vector3Class = typeof Vector3;
type QuaternionClass = typeof Quaternion;
type RotationClass = typeof Rotation;
/**
 * Defines a class that represents a 2D point in space.
 */
declare class Vector2 {
    /**
     * The X value of this vector.
     */
    x: number;
    /**
     * The Y value of this vector.
     */
    y: number;
    /**
     * Constructs a new 2D vector with the given X and Y values.
     * @param x The X value of the vector.
     * @param y The Y value of the vector.
     */
    constructor(x?: number, y?: number);
    /**
     * Creates a 2D vector with the given X and Y values that is normalized immediately upon creation.
     * @param x The X value of the vector.
     * @param y The Y value of the vector.
     */
    static createNormalized(x: number, y: number): Vector2;
    /**
     * Calculates the angle between the two given vectors and returns the result in radians.
     * @param first The first vector.
     * @param second The second vector.
     */
    static angleBetween(first: Vector2, second: Vector2): number;
    /**
     * Calculates the distance between the two given vectors and returns the result.
     * @param first The first vector.
     * @param second The second vector.
     */
    static distanceBetween(first: Vector2, second: Vector2): number;
    /**
     * Constructs a new vector that is the linear interpolation between the given start and end positions.
     * The degree that the result is interpolated is determined by the given amount parameter.
     * @param start The start position.
     * @param finish The end position.
     * @param amount The amount that the resulting position should be interpolated between the start and end positions.  Values near 0 indicate rotations close to the first and values near 1 indicate rotations close to the second.
     */
    static interpolatePosition(start: Vector2, finish: Vector2, amount: number): Vector2;
    /**
     * Constructs a new vector that is the directional linear interpolation between the given start and end positions.
     * The degree that the result is interpolated is determined by the given amount parameter.
     *
     * This function works similarly to interpolatePosition(), except the result is always a normalized vector.
     *
     * @param start The start position.
     * @param finish The end position.
     * @param amount The amount that the resulting position should be interpolated between the start and end positions.  Values near 0 indicate rotations close to the first and values near 1 indicate rotations close to the second.
     */
    static interpolateDirection(start: Vector2, finish: Vector2, amount: number): Vector2;
    /**
     * Adds this vector with the other vector and returns the result.
     * @param other The other vector to add with this vector.
     */
    add(other: Vector2): Vector2;
    /**
     * Subtracts the other vector from this vector and returns the result.
     * @param other The other vector that should be subtracted from this vector.
     */
    subtract(other: Vector2): Vector2;
    /**
     * Multiplies each component of this vector by the given value and returns the result.
     * @param scale The scale that should be applied to this vector.
     */
    multiplyScalar(scale: number): Vector2;
    /**
     * Multiplies this vector by the given other vector and returns the result.
     * @param other The other vector to multiply with this vector.
     */
    multiply(other: Vector2): Vector2;
    /**
     * Calculates the dot product of this vector compared to the given other vector.
     * Returns a number that is positive if the vectors point in the same direction,
     * negative if they point in opposite directions, and zero if they are perpendicular.
     * For normalized vectors, this value is clamped to 1 and -1.
     * @param other The other vector to calculate the dot product with.
     */
    dot(other: Vector2): number;
    /**
     * Calculates the length of this vector and returns the result.
     */
    length(): number;
    /**
     * Calculates the square length of this vector and returns the result.
     * This is equivalent to length^2, but it is faster to calculate than length because it doesn't require
     * calculating a square root.
     */
    squareLength(): number;
    /**
     * Calculates the normalized version of this vector and returns it.
     * A normalized vector is a vector whose length equals 1.
     *
     * Normalizing a vector preserves its directionality while making the length (i.e. scale) of it 1.
     */
    normalize(): Vector2;
    toString(): string;
    /**
     * Determines if this vector equals the other vector.
     * @param other The other vector.
     */
    equals(other: Vector2): boolean;
}
/**
 * Defines a class that represents a 3D point in space.
 */
declare class Vector3 {
    /**
     * The X value of this vector.
     */
    x: number;
    /**
     * The Y value of this vector.
     */
    y: number;
    /**
     * The Z value of this vector.
     */
    z: number;
    /**
     * Constructs a new 3D vector with the given X and Y values.
     * @param x The X value of the vector.
     * @param y The Y value of the vector.
     * @param z The Z value of the vector.
     */
    constructor(x?: number, y?: number, z?: number);
    /**
     * Creates a 3D vector with the given X and Y values that is normalized immediately upon creation.
     * @param x The X value of the vector.
     * @param y The Y value of the vector.
     * @param z The Z value of the vector.
     */
    static createNormalized(x: number, y: number, z: number): Vector3;
    /**
     * Calculates the angle between the two given vectors and returns the result in radians.
     * @param first The first vector.
     * @param second The second vector.
     */
    static angleBetween(first: Vector3, second: Vector3): number;
    /**
     * Calculates the distance between the two given vectors and returns the result.
     * @param first The first vector.
     * @param second The second vector.
     */
    static distanceBetween(first: Vector3, second: Vector3): number;
    /**
     * Constructs a new vector that is the linear interpolation between the given start and end positions.
     * The degree that the result is interpolated is determined by the given amount parameter.
     * @param start The start position.
     * @param finish The end position.
     * @param amount The amount that the resulting position should be interpolated between the start and end positions.  Values near 0 indicate rotations close to the first and values near 1 indicate rotations close to the second.
     */
    static interpolatePosition(start: Vector3, finish: Vector3, amount: number): Vector3;
    /**
     * Constructs a new vector that is the directional linear interpolation between the given start and end positions.
     * The degree that the result is interpolated is determined by the given amount parameter.
     *
     * This function works similarly to interpolatePosition(), except the result is always a normalized vector.
     *
     * @param start The start position.
     * @param finish The end position.
     * @param amount The amount that the resulting position should be interpolated between the start and end positions.  Values near 0 indicate rotations close to the first and values near 1 indicate rotations close to the second.
     */
    static interpolateDirection(start: Vector3, finish: Vector3, amount: number): Vector3;
    /**
     * Adds this vector with the other vector and returns the result.
     * @param other The other vector to add with this vector.
     */
    add(other: Vector3): Vector3;
    /**
     * Subtracts the other vector from this vector and returns the result.
     * @param other The other vector that should be subtracted from this vector.
     */
    subtract(other: Vector3): Vector3;
    /**
     * Multiplies each component of this vector by the given value and returns the result.
     * @param scale The scale that should be applied to this vector.
     */
    multiplyScalar(scale: number): Vector3;
    /**
     * Multiplies this vector by the given other vector and returns the result.
     * @param other The other vector to multiply with this vector.
     */
    multiply(other: Vector3): Vector3;
    /**
     * Calculates the dot product of this vector compared to the given other vector.
     * Returns a number that is positive if the vectors point in the same direction,
     * negative if they point in opposite directions, and zero if they are perpendicular.
     * For normalized vectors, this value is clamped to 1 and -1.
     * @param other The other vector to calculate the dot product with.
     */
    dot(other: Vector3): number;
    /**
     * Calculates the cross product of this vector with the given other vector.
     * Returns a new vector that is perpendicular to both vectors.
     * Note that the order of the vectors greatly matters. For example, (1, 0, 0).cross(0, 1, 0) === (0, 0, 1) but (0, 1, 0).cross(1, 0, 0) === (0, 0, -1).
     * @param other The other vector to calculate the cross product with.
     */
    cross(other: Vector3): Vector3;
    /**
     * Calculates the length of this vector and returns the result.
     */
    length(): number;
    /**
     * Calculates the square length of this vector and returns the result.
     * This is equivalent to length^2, but it is faster to calculate than length because it doesn't require
     * calculating a square root.
     */
    squareLength(): number;
    /**
     * Calculates the normalized version of this vector and returns it.
     * A normalized vector is a vector whose length equals 1.
     */
    normalize(): Vector3;
    toString(): string;
    /**
     * Determines if this vector equals the other vector.
     */
    equals(other: Vector3): boolean;
}
/**
 * Defines a class that represents a Quaternion. That is, a representation of a 3D rotation.
 *
 * Quaternions are a mathematical representation of 3D transformations and are commonly used to calculate and apply rotations to 3D points.
 * They work by defining a quaterion such that q = w + x*i + y*j + z*k, where w, x, y, and z are real numbers and i, j, and k are imaginary numbers.
 * The basics of this is that x, y, and z define a vector that represents the rotation axis, and w defines an angle around which the rotation occurs.
 * However, because i, j, and k are included we can keep x, y, and z from incorrectly interacting with each other and so avoid common pitfalls like Gimbal lock.
 *
 * One little known feature of quaternions is that they can also represent reflections and also scale.
 * This is because there are two different ways to apply a quaternion to a 3D point:
 *
 * - quaterion * point * inverse(quaterion)
 *
 * This formula rotates and scales the point quaternion. The rotation occurs around the axis specified by the quaternion X, Y, and Z values.
 * Additionally, the point will be scaled by the length of the quaternion. (i.e. sqrt( x^2 + y^2 + z^2 + w^2 ))
 * This is why quaternions that are used to represent only rotations must be normalized.
 *
 * - quaternion * point * quaternion
 *
 * This formula reflects scales the point by the quaternion. The reflection occurs across the axis specified by the quaternion X, Y, and Z values.
 * Additionally, the point will be scaled by the length of the quaternion. (i.e. sqrt( x^2 + y^2 + z^2 + w^2 ))
 */
declare class Quaternion {
    /**
     * The X value of the quaternion.
     */
    x: number;
    /**
     * The Y value of the quaternion.
     */
    y: number;
    /**
     * The Z value of the quaternion.
     */
    z: number;
    /**
     * The W value of the quaternion.
     */
    w: number;
    /**
     * Creates a new Quaternion with the given values.
     * @param x The X value.
     * @param y The Y value.
     * @param z The Z value.
     * @param w The W value.
     */
    constructor(x?: number, y?: number, z?: number, w?: number);
    /**
     * Multiplies this quaternion by the other quaternion and returns the result.
     * In quaternion math, multiplication can be used to combine quaternions together,
     * however unlike regular multiplication quaternion multiplication is order dependent.
     *
     * Which frame of reference you want to use depends on which order you use.
     * For example, q2.multiply(q1) starts with the identity, applies q1 to it, and then applies q2 to that.
     * Whereas, q1.multiply(q2) starts with the identity, applies q2 to it, and then applies q1 to that.
     *
     * @param other The other quaternion.
     */
    multiply(other: Quaternion): Quaternion;
    /**
     * Calculates the conjugate of this quaternion and returns the result.
     * The conjugate (or inverse) of a quaternion is similar to negating a number.
     * When you multiply a quaternion by its conjugate, the result is the identity quaternion.
     */
    invert(): Quaternion;
    /**
     * Gets the length of this vector. That is, the pathagorean theorem applied to X, Y, Z, and W.
     */
    length(): number;
    /**
     * Calculates the square length of this quaternion and returns the result.
     * This is equivalent to length^2, but it is faster to calculate than length because it doesn't require
     * calculating a square root.
     */
    squareLength(): number;
    /**
     * Calculates the normalized version of this quaternion and returns it.
     * A normalized quaternion is a quaternion whose length equals 1.
     *
     * Normalizing a quaternion preserves its rotation/reflection while making the length (i.e. scale) of it 1.
     */
    normalize(): Quaternion;
    toString(): string;
    /**
     * Determines if this quaternion equals the other quaternion.
     * @param other The other quaternion to apply.
     */
    equals(other: Quaternion): boolean;
}
/**
 * Defines a class that can represent geometric rotations.
 */
declare class Rotation {
    private _q;
    /**
     * The quaternion that this rotation uses.
     */
    get quaternion(): Quaternion;
    /**
     * Creates a new rotation using the given parameters.
     * @param rotation The information that should be used to construct the rotation.
     */
    constructor(rotation?: FromToRotation | AxisAndAngle | QuaternionRotation | Quaternion | SequenceRotation | EulerAnglesRotation | LookRotation);
    /**
     * Constructs a new Quaternion from the given axis and angle.
     * @param axisAndAngle The object that contains the axis and angle values.
     */
    static quaternionFromAxisAndAngle(axisAndAngle: AxisAndAngle): Quaternion;
    /**
     * Constructs a new Quaternion from the given from/to rotation.
     * This is equivalent to calculating the cross product and angle between the two vectors and constructing an axis/angle quaternion.
     * @param fromToRotation The object that contains the from and to values.
     */
    static quaternionFromTo(fromToRotation: FromToRotation): Quaternion;
    /**
     * Constructs a new Quaternion from the given look rotation.
     * @param look The object that contains the look rotation values.
     */
    static quaternionLook(look: LookRotation): Quaternion;
    /**
     * Determines the angle between the two given quaternions and returns the result in radians.
     * @param first The first quaternion. Must be a quaterion that represents a rotation
     * @param second The second quaternion.
     */
    static angleBetween(first: Rotation, second: Rotation): number;
    /**
     * Constructs a new rotation that is the spherical linear interpolation between the given first and second rotations.
     * The degree that the result is interpolated is determined by the given amount parameter.
     * @param first The first rotation.
     * @param second The second rotation.
     * @param amount The amount that the resulting rotation should be interpolated between the first and second rotations. Values near 0 indicate rotations close to the first and values near 1 indicate rotations close to the second.
     */
    static interpolate(first: Rotation, second: Rotation, amount: number): Rotation;
    /**
     * Rotates the given Vector3 by this quaternion and returns a new vector containing the result.
     * @param vector The 3D vector that should be rotated.
     */
    rotateVector3(vector: Vector3): Vector3;
    /**
     * Rotates the given Vector2 by this quaternion and returns a new vector containing the result.
     * Note that rotations around any other axis than (0, 0, 1) or (0, 0, -1) can produce results that contain a Z component.
     * @param vector The 2D vector that should be rotated.
     */
    rotateVector2(vector: Vector2): Vector3;
    /**
     * Combines this rotation with the other rotation and returns a new rotation that represents the combination of the two.
     * @param other The other rotation.
     */
    combineWith(other: Rotation): Rotation;
    /**
     * Calculates the inverse rotation of this rotation and returns a new rotation with the result.
     */
    invert(): Rotation;
    /**
     * Gets the axis and angle that this rotation rotates around.
     */
    axisAndAngle(): AxisAndAngle;
    /**
     * Determines if this rotation equals the other rotation.
     * @param other The rotation to check.
     */
    equals(other: Rotation): boolean;
    toString(): string;
}
/**
 * Defines an interface that represents a from/to rotation.
 * That is, a rotation that is able to rotate a vector from the given vector direction to the given vector direction.
 */
export interface FromToRotation {
    /**
     * The direction that the rotation should rotate from.
     */
    from: Vector3;
    /**
     * The direction that the rotation should rotate to.
     */
    to: Vector3;
}
/**
 * Defines an interface that represents an Axis and Angle pair.
 */
export interface AxisAndAngle {
    /**
     * The axis about which the angle should rotate around.
     */
    axis: Vector3;
    /**
     * The number of radians that should be rotated around the axis.
     */
    angle: number;
}
/**
 * Defines an interface that represents an Euler Angles rotation.
 */
export interface EulerAnglesRotation {
    euler: {
        /**
         * The amount to rotate around the X axis.
         */
        x: number;
        /**
         * The amount to rotate around the Y axis.
         */
        y: number;
        /**
         * The amount to rotate around the Z axis.
         */
        z: number;
        /**
         * The order that the rotations should be applied in.
         */
        order?: string;
    };
}
/**
 * Defines an interface that represents a sequence of rotations.
 */
export interface SequenceRotation {
    /**
     * The sequence of successive rotations.
     */
    sequence: Rotation[];
}
export interface QuaternionRotation {
    quaternion: { x: number, y: number, z: number, w: number };
}

/**
 * Defines an interface that represents a rotation transforms (0, 1, 0) and (0, 0, 1) to look along the given direction and upwards axes.
 */
 export interface LookRotation {
    /**
     * The direction that (0, 1, 0) should be pointing along after the rotation is applied.
     */
    direction: Vector3;

    /**
     * The direction that the upward axis should be pointing along after the rotation is applied.
     * If the direction and upwards vectors are not perpendicular, then the direction will be prioritized and the angle between
     * upwards and the resulting upwards vector will be minimized.
     *
     * If direction and upwards are perpendicular, then applying the rotation to (0, 0, 1) will give the upwards vector.
     */
    upwards: Vector3;

    /**
     * How errors with the direction and upwards vectors should be handled.
     * If the direction and upwards vectors are parallel or perpendicular, then it is not possible to create a rotation
     * that looks along the direction and uses the upwards vector. The upwards vector is essentially useless in this scenario
     * and as a result there are an infinite number of possible valid rotations that look along direction vector.
     *
     * This parameter provides two ways to handle this situation:
     *
     * - "error" indicates that an error should be thrown when this situation arises.
     * - "nudge" indicates that the direction vector should be nudged by a miniscule amount in an arbitrary direction.
     *           This causes the upwards and direction vectors to no longer be parallel, but it can also cause rotation bugs when the direction and upwards are the same.
     */
    errorHandling: 'error' | 'nudge';
}

// End Math Types


/**
 * Defines an interface that represents the result of a raycast operation.
 */
 export interface RaycastResult {
    /**
     * The list of intersections.
     */
    botIntersections: BotIntersection[];

    /**
     * The ray that the operation sent.
     */
    ray: RaycastRay;
}

/**
 * Defines an interface that represents the intersection of a bot and ray.
 */
export interface BotIntersection {
    /**
     * The bot that was intersected.
     */
    bot: Bot;

    /**
     * The distance from the origin of the ray that the intersection ocurred at.
     */
    distance: number;

    /**
     * The point that the intersection ocurred at.
     */
    point: Vector3;

    /**
     * The normal that the intersection ocurred at.
     */
    normal: Vector3;

    /**
     * The face that the intersection hit.
     */
    face: string;

    /**
     * The UV coordinates that the intersection ocurred at.
     */
    uv: Vector2;

    /**
     * The portal that the bot is in.
     */
    portal: string;

     /**
      * The dimension that the bot is in.
      */
    dimension: string;
}

/**
 * Defines an interface that represents a ray.
 */
export interface RaycastRay {
    /**
     * The origin of the ray.
     */
    origin: Vector3;

    /**
     * The direction that the ray travels in.
     */
    direction: Vector3;
}

export type PossiblePauseTriggerStates =
    | ['before' | 'after']
    | ['before', 'after'];

/**
 * Defines an interface that contains options for a pause trigger.
 */
export interface PauseTriggerOptions {
    /**
     * The line number that the trigger starts at.
     * Numbers should be one-based.
     */
    lineNumber: number;

    /**
     * The column number that the trigger starts at.
     * Numbers should be one-based, and the @ symbol in listeners is ignored.
     */
    columnNumber: number;

    /**
     * The states that the trigger should use.
     * Defaults to ["before"] if not specified.
     */
    states?: ('before' | 'after')[];

    /**
     * Whether the trigger is enabled.
     * Defaults to true.
     */
    enabled?: boolean;
}

/**
 * Defines an interface that represents a pause trigger.
 */
export interface PauseTrigger extends PauseTriggerOptions {
    /**
     * The ID of the trigger.
     */
    triggerId: string;

    /**
     * The ID of the bot that the trigger is set on.
     */
    botId: string;

    /**
     * The tag that the trigger is set on.
     */
    tag: string;
}

/**
 * Defines an interface for a possible pause trigger location.
 */
export interface PossiblePauseTriggerLocation {
    /**
     * The line number that the trigger would pause the debugger at.
     */
    lineNumber: number;

    /**
     * The column number that the trigger would pause the debugger at.
     */
    columnNumber: number;

    /**
     * The states that are reasonable for this pause trigger to stop at.
     */
    possibleStates: PossiblePauseTriggerStates;
}

/**
 * Defines an interface that contains information about the current debugger pause state.
 */
export interface DebuggerPause {
    /**
     * The ID of the pause.
     */
    pauseId: string | number;

    /**
     * The pause trigger that started this pause.
     */
    trigger: PauseTrigger;

    /**
     * The state of the pause.
     * Indicates whether the pause is before or after the node was executed.
     */
    state: 'before' | 'after';

    /**
     * The result of the node evaluation.
     * Only included for "after" pause states.
     */
    result?: any;

    /**
     * The call stack that the debugger currently has.
     */
    callStack: DebuggerCallFrame[];
}

/**
 * Defines an interface that contains information about a single call stack frame.
 */
export interface DebuggerCallFrame {
    /**
     * The location that was last evaluated in this frame.
     */
    location: DebuggerFunctionLocation;

    /**
     * Gets the list of variables that are avaiable from this frame.
     */
    listVariables(): DebuggerVariable[];

    /**
     * Sets the given variable name to the given value.
     * @param variableName The name of the variable to set.
     * @param value The value to set in the variable.
     */
    setVariableValue(variableName: string, value: any): void;
}

/**
 * Defines an interface that represents a location in a debugger.
 */
export interface DebuggerFunctionLocation {
    /**
     * The name of the function.
     */
    name?: string;

    /**
     * The ID of the bot that this function is defined in.
     */
    botId?: string;

    /**
     * The name of the tag that this function is defined in.
     */
    tag?: string;

    /**
     * The line number that this function is defined at.
     */
    lineNumber?: number;

    /**
     * The column number that this function is defined at.
     */
    columnNumber?: number;
}

/**
 * Defines an interface that represents a debugger variable.
 */
export interface DebuggerVariable {
    /**
     * The name of the variable.
     */
    name: string;

    /**
     * The value contained by the variable.
     */
    value: any;

    /**
     * The scope that the variable exists in.
     *
     * "block" indicates that the variable was defined in and exists only in the current block.
     * "frame" indicates that the variable was defined in and exists in the current stack frame.
     * "closure" indicates that the variable was inherited from a parent stack frame.
     */
    scope: 'block' | 'frame' | 'closure';

    /**
     * Whether the variable value can be overwriten.
     */
    writable: boolean;

    /**
     * Whether this variable has been initialized.
     */
    initialized?: boolean;
}

/**
 * Defines an interface for a debugger trace that represents when a tag was updated.
 */
export interface DebuggerTagUpdate {
    /**
     * The ID of the bot that was updated.
     */
    botId: string;

    /**
     * The tag that was updated.
     */
    tag: string;

    /**
     * The old value of the tag.
     */
    oldValue: any;

    /**
     * The new value for the tag.
     */
    newValue: any;
}

/**
 * Defines an interface for a debugger trace that represents when a tag mask was updated.
 */
export interface DebuggerTagMaskUpdate extends DebuggerTagUpdate {
    /**
     * The space of the tag mask.
     */
    space: string;
}

export interface PreactContext<T> {
    Consumer: any;
    Provider: any;
    displayName?: string;
}

export type RefObject<T> = { current: T | null };


declare global {

    /**
     * The Bot that this script is running in.
     */
    const thisBot: Bot;

    /**
     * The Bot that this script is running in.
     */
    const bot: Bot;

    /**
     * The tags of the Bot that this script is running in.
     */
    const tags: BotTags;

    /**
     * The raw tags of the Bot that this script is running in.
     */
    const raw: BotTags;

    /**
     * The Bot that created this Bot.
     */
    const creatorBot: Bot;

    /**
     * The config Bot for this Bot.
     */
    const configBot: Bot;

    /**
     * The name of the tag that this script is running in.
     */
    const tagName: string;

    /**
     * The tag masks that this bot has.
     */
    const masks: BotTags;

    /**
     * The links that this bot has to other bots.
     */
    const links: BotLinks;

    /**
     * A DateTime is an immutable data structure representing a specific date and time and accompanying methods.
     * It contains class and instance methods for creating, parsing, interrogating, transforming, and formatting them.
     *
     * A DateTime comprises of:
     * * A timestamp. Each DateTime instance refers to a specific millisecond of the Unix epoch.
     * * A time zone. Each instance is considered in the context of a specific zone (by default the local system's zone).
     * * Configuration properties that effect how output strings are formatted, such as `locale`, `numberingSystem`, and `outputCalendar`.
     *
     * Here is a brief overview of the most commonly used functionality it provides:
     *
     * * **Creation**: To create a DateTime from its components, use one of its factory class methods: {@link DateTimeClass.local}, {@link DateTimeClass.utc}, and (most flexibly) {@link DateTimeClass.fromObject}.
     * To create one from a standard string format, use {@link DateTimeClass.fromISO}, {@link DateTimeClass.fromHTTP}, and {@link DateTimeClass.fromRFC2822}.
     * To create one from a custom string format, use {@link DateTimeClass.fromFormat}. To create one from a native JS date, use {@link DateTimeClass.fromJSDate}.
     * * **Gregorian calendar and time**: To examine the Gregorian properties of a DateTimeClass individually (i.e as opposed to collectively through {@link DateTimeClass#toObject}), use the {@link DateTimeClass#year},
     * {@link DateTimeClass#month}, {@link DateTimeClass#day}, {@link DateTimeClass#hour}, {@link DateTimeClass#minute}, {@link DateTimeClass#second}, {@link DateTimeClass#millisecond} accessors.
     * * **Week calendar**: For ISO week calendar attributes, see the {@link DateTimeClass#weekYear}, {@link DateTimeClass#weekNumber}, and {@link DateTimeClass#weekday} accessors.
     * * **Configuration** See the {@link DateTimeClass#locale} and {@link DateTimeClass#numberingSystem} accessors.
     * * **Transformation**: To transform the DateTimeClass into other DateTimeClasss, use {@link DateTimeClass#set}, {@link DateTimeClass#reconfigure}, {@link DateTimeClass#setZone}, {@link DateTimeClass#setLocale},
     * {@link DateTimeClass.plus}, {@link DateTimeClass#minus}, {@link DateTimeClass#endOf}, {@link DateTimeClass#startOf}, {@link DateTimeClass#toUTC}, and {@link DateTimeClass#toLocal}.
     * * **Output**: To convert the DateTimeClass to other representations, use the {@link DateTimeClass#toRelative}, {@link DateTimeClass#toRelativeCalendar}, {@link DateTimeClass#toJSON}, {@link DateTimeClass#toISO},
     * {@link DateTimeClass#toHTTP}, {@link DateTimeClass#toObject}, {@link DateTimeClass#toRFC2822}, {@link DateTimeClass#toString}, {@link DateTimeClass#toLocaleString}, {@link DateTimeClass#toFormat},
     * {@link DateTimeClass#toMillis} and {@link DateTimeClass#toJSDate}.
     *
     * There's plenty others documented below. In addition, for more information on subtler topics
     * like internationalization, time zones, alternative calendars, validity, and so on, see the external documentation.
     */
    const DateTime: DateTimeClass;

    /**
     * Defines a class that represents a 2D point in space.
     */
    const Vector2: Vector2Class;

    /**
     * Defines a class that represents a 3D point in space.
     */
    const Vector3: Vector3Class;

    /**
     * Defines a class that represents a Quaternion. That is, a representation of a 3D rotation.
     *
     * Quaternions are a mathematical representation of 3D transformations and are commonly used to calculate and apply rotations to 3D points.
     * They work by defining a quaterion such that q = w + x*i + y*j + z*k, where w, x, y, and z are real numbers and i, j, and k are imaginary numbers.
     * The basics of this is that x, y, and z define a vector that represents the rotation axis, and w defines an angle around which the rotation occurs.
     * However, because i, j, and k are included we can keep x, y, and z from incorrectly interacting with each other and so avoid common pitfalls like Gimbal lock.
     *
     * One little known feature of quaternions is that they can also represent reflections and also scale.
     * This is because there are two different ways to apply a quaternion to a 3D point:
     *
     * - quaterion * point * inverse(quaterion)
     *
     * This formula rotates and scales the point quaternion. The rotation occurs around the axis specified by the quaternion X, Y, and Z values.
     * Additionally, the point will be scaled by the length of the quaternion. (i.e. sqrt( x^2 + y^2 + z^2 + w^2 ))
     * This is why quaternions that are used to represent only rotations must be normalized.
     *
     * - quaternion * point * quaternion
     *
     * This formula reflects scales the point by the quaternion. The reflection occurs across the axis specified by the quaternion X, Y, and Z values.
     * Additionally, the point will be scaled by the length of the quaternion. (i.e. sqrt( x^2 + y^2 + z^2 + w^2 ))
     */
    const Quaternion: QuaternionClass;

    /**
     * Defines a class that can represent geometric rotations.
     */
    const Rotation: RotationClass;

    /**
     * Creates a new bot and returns it.
     * @param parent The bot that should be the parent of the new bot.
     * @param mods The mods which specify the new bot's tag values. If given a mod with no tags, then an error will be thrown.
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
    function create(...mods: Mod[]): Bot | Bot[];

    /**
     * Destroys the given bot, bot ID, or list of bots.
     * @param bot The bot, bot ID, or list of bots to destroy.
     */
    function destroy(bot: Bot | string | Bot[]): void;

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
    function removeTags(bot: Bot | Bot[], tagSection: string | RegExp): void;

    /**
     * Renames the given original tag to the given new tag using the given bot or list of bots.
     * @param bot The bot or list of bots that the tag should be renamed on.
     * @param originalTag The original tag to rename.
     * @param newTag The new tag name.
     * 
     * @example
     * // Rename the "abc" tag to "def"
     * renameTag(this, "abc", "def")
     */
    function renameTag(bot: Bot | Bot[], originalTag: string, newTag: string): void;

    /**
     * Gets the ID from the given bot.
     * @param bot The bot or string.
     */
    function getID(bot: Bot | string): string;

    /**
     * Gets JSON for the given data.
     * @param data The data.
     */
    function getJSON(data: any): string;

    /**
     * Gets nicely formatted JSON for the given data.
     * @param data The data.
     */
    function getFormattedJSON(data: any): string;

    /**
     * Makes a snapshot of the given bot(s).
     * Snapshots are like mods except they contain multiple bots and include the ID, space, tags, and tag masks of the bots.
     * @param bots The bots to make a snapshot of.
     */
    function getSnapshot(bots: Bot | Bot[]): BotsState;

    /**
     * Calculates the difference between the two given snapshots.
     * @param first The first snapshot.
     * @param second The second snapshot.
     */
    function diffSnapshots(first: BotsState, second: BotsState): PartialBotsState;

    /**
     * Applies the given delta to the given snapshot and returns the result.
     * This is essentially the opposite of diffSnapshots().
     * @param snapshot The snapshot that the diff should be applied to.
     * @param diff The delta that should be applied to the snapshot.
     */
    function applyDiffToSnapshot(snapshot: BotsState, diff: PartialBotsState): BotsState;

    /**
     * Shouts the given events in order until a bot returns a result.
     * Returns the result that was produced or undefined if no result was produced.
     * @param eventNames The names of the events to shout.
     * @param arg The argument to shout.
     */
    function priorityShout(eventNames: string[], arg?: any): any;

    /**
    * Creates a tag value that can be used to link to the given bots.
    * @param bots The bots that the link should point to.
    */
    function getLink(...bots: (Bot | string | (Bot | string)[])[]): string;

    /**
     * Gets the list of bot links that are stored in this bot's tags.
     * @param bot The bot to get the links for.
     */
    function getBotLinks(bot: Bot): ParsedBotLink[];

    /**
     * Updates all the links in the given bot using the given ID map.
     * Useful if you know that the links in the given bot are outdated and you know which IDs map to the new IDs.
     * @param bot The bot to update.
     * @param idMap The map of old IDs to new IDs that should be used.
     */
    function updateBotLinks(bot: Bot, idMap: Map<string, string | Bot> | { [id: string]: string | Bot }): void;

    /**
     * Parses the given value into a date time object.
     * Returns null if the value could not be parsed into a date time.
     * @param value The value to parse.
     */
    function getDateTime(value: unknown): DateTime;

    /**
     * Asks every bot in the inst to run the given action.
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
    const shout: {
        /**
         * Asks every bot in the inst to run the given action.
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
        (name: string, arg?: any): any[],
        [name: string]: {
            /**
             * Asks every bot in the inst to run the given action.
             * In effect, this is like shouting to a bunch of people in a room.
             *
             * @param arg The optional argument to include in the shout.
             * @returns Returns a list which contains the values returned from each script that was run for the shout.
             */
            (arg?: any): any[]
        }
    };

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
    ): any[];

    /**
     * Shouts the given event to every bot in every loaded simulation.
     * @param eventName The name of the event to shout.
     * @param arg The argument to shout. This gets passed as the `that` variable to the other scripts.
     */
    function superShout(eventName: string, arg?: any): SuperShoutAction;

    /**
     * Watches the given bot or list of bots for changes and calls the given callback when the bot is changed or destroyed.
     * Returns a number that can be passed to clearWatchBot() to stop watching the bot.
     * @param bot The bot or list of bots that should be watched for changes.
     * @param callback The function that should be called when the bot is changed or destroyed.
     */
    function watchBot(bot: (Bot | string)[] | Bot | string, callback: () => void): number;

    /**
     * Cancels watching a bot using the given ID number that was returned from watchBot().
     * @param watchId The ID number that should be used to cancel the watch callbacks.
     */
    function clearWatchBot(watchId: number): void;

    /**
     * Watches the given portal for when bots are added and removed from it and calls the given function.
     * Returns a number that can be passed to clearWatchPortal() to stop watching the portal.
     * @param portalId The ID of the portal to watch.
     * @param callback The function that should be called when the portal changes.
     */
    function watchPortal(portalId: string, callback: () => void): number;

    /**
     * Cancels watching a portal using the given ID number that was returned from watchPortal().
     * @param watchId The ID number that should be used to cancel the watch callbacks.
     */
    function clearWatchPortal(watchId: number): void;

    /**
     * Asserts that the given condition is true.
     * Throws an error if the condition is not true.
     * @param condition The condition to check.
     * @param message The message to use in the error if the condition is not true.
     */
    function assert(condition: boolean, message?: string): void;

    /**
     * Asserts that the given values contain the same data.
     * Throws an error if they are not equal.
     * @param first The first value to test.
     * @param second The second value to test.
     */
    function assertEqual(first: any, second: any): void;

    /**
     * Sends a web request based on the given options.
     * @param options The options that specify where and what to send in the web request.
     *
     * @example
     * // Send a HTTP POST request to https://www.example.com/api/createThing
     * webhook({
     *   method: 'POST',
     *   url: 'https://www.example.com/api/createThing',
     *   data: {
     *     hello: 'world'
     *   },
     *   responseShout: 'requestFinished'
     * });
     */
    const web: Web;

    /**
    * Creates a Universally Unique IDentifier (UUID).
    */
    function uuid(): string;

    /**
     * Animates the given tag. Returns a promise when the animation is finished.
     * @param bot The bot or list of bots that should be animated.
     * @param tag The tag that should be animated.
     * @param options The options for the animation. If given null, then any running animations for the given tag will be canceled.
     */
    function animateTag(bot: Bot | (Bot | string)[] | string, tag: string, options: AnimateTagFunctionOptions): Promise<void>;

    /**
     * Animates the given tags. Returns a promise when the animation is finished.
     * @param bot The bot or list of bots that should be animated.
     * @param options The options for the animation. fromValue should be an object which contains the starting tag values and toValue should be an object that contains the ending tag values.
     */
    function animateTag(bot: Bot | (Bot | string)[] | string, options: AnimateTagFunctionOptions): Promise<void>;
    /**
     * Animates the given tag. Returns a promise when the animation is finished.
     * @param bot The bot or list of bots that should be animated.
     * @param tag The tag that should be animated.
     * @param options The options for the animation.
     */
    function animateTag(
        bot: Bot | (Bot | string)[] | string,
        tagOrOptions: string | AnimateTagFunctionOptions,
        options?: AnimateTagFunctionOptions
    ): Promise<void>;

    /**
     * Cancels the animations that are running on the given bot(s).
     * @param bot The bot or list of bots that should cancel their animations.
     * @param tag The tag that the animations should be canceld for. If omitted then all tags will be canceled.
     */
    function clearAnimations(bot: Bot | (Bot | string)[] | string, tag?: string): void;

    /**
     * Sends the given operation to all the devices that matches the given selector.
     * In effect, this allows users to send each other events directly without having to edit tags.
     *
     * Note that currently, devices will only accept events sent from the inst.
     *
     * @param event The event that should be executed in the remote session(s).
     * @param selector The selector that indicates where the event should be sent. The event will be sent to all sessions that match the selector.
     *                 For example, specifying a username means that the event will be sent to every active session that the user has open.
     *                 If a selector is not specified, then the event is sent to the inst.
     * @param allowBatching Whether to allow batching this remote event with other remote events. This will preserve ordering between remote events but may not preserve ordering
     *                      with respect to other events. Defaults to true.
     *
     * @example
     * // Send a toast to all sessions for the username "bob"
     * remote(os.toast("Hello, Bob!"), { username: "bob" });
     */
    function remote(
        event: BotAction,
        selector?: SessionSelector | string | (SessionSelector | string)[],
        allowBatching?: boolean
    ): RemoteAction | RemoteAction[];

    /**
     * Sends an event to the given remote or list of remotes.
     * The other remotes will recieve an onRemoteData shout for this whisper.
     * 
     * In effect, this allows remotes to communicate with each other by sending arbitrary events.
     * 
     * @param remoteId The ID of the other remote or remotes to whisper to.
     * @param name The name of the event.
     * @param arg The optional argument to include in the event.
     */
    function sendRemoteData(remoteId: string | string[], name: string, arg?: any): RemoteAction | RemoteAction[];

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
    function getBot(): Bot;

    /**
     * Gets the list of bots which match all of the given filters.
     * @param filters The filter functions that the bots need to match.
     * @returns A list of bots that match all the given filters. If no bots match then an empty list is returned.
     *
     * @example
     * // Get all the bots that are red.
     * let bots = getBots(byTag("color", "red"));
     */
    function getBots(...filters: ((bot: Bot) => boolean)[]): Bot[];

    /**
     * Gets the list of bots that have the given tag matching the given filter value.
     * @param tag The tag the bot should match.
     * @param filter The value or filter the bot should match.
     *
     * @example
     * // Get all the bots that are red.
     * // Shorthand for getBots(byTag("color", "red"))
     * let bots = getBots("color", "red");
     */
    function getBots(tag: string, filter?: any | TagFilter): Bot[];

    /**
     * Gets a list of all the bots.
     *
     * @example
     * // Gets all the bots in the inst.
     * let bots = getBots();
     */
    function getBots(): Bot[];

    /**
     * Gets the list of tag values from bots that have the given tag.
     * @param tag The tag.
     * @param filter THe optional filter to use for the values.
     */
    function getBotTagValues(tag: string, filter?: TagFilter): any[];

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
    function byTag(tag: string, filter?: TagFilter): BotFilterFunction;

    /**
     * Creates a filter function that checks whether bots have the given ID.
     * @param id The ID to check for.
     * 
     * @example
     * // Find all the bots with the ID "bob".
     * let bobs = getBots(byId("bob"));
     */
    function byID(id: string): BotFilterFunction;

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
    function byMod(mod: Mod): BotFilterFunction;

    /**
     * Creates a filter function that checks whether bots are in the given dimension.
     * @param dimension The dimension to check.
     * @returns A function that returns true if the given bot is in the dimension and false if it is not.
     *
     * @example
     * // Find all the bots in the "test" dimension.
     * let bots = getBots(inDimension("test"));
     */
    function inDimension(dimension: string): BotFilterFunction;

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
    ): BotFilterFunction;

    /**
     * Creates a filter function that checks whether bots were created by the given bot.
     * @param bot The bot to determine weather the bots have been created by it or not.
     * @returns A function that returns true if the bot was created by the given bot.
     *
     * @example
     * // Find all the bots created by the yellow bot.
     * let bots = getBots(byCreator(getBot('color','yellow')));
     */
    function byCreator(bot: Bot | string);

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
    function inStack(bot: Bot, dimension: string): BotFilterFunction;

    /**
     * Creates a function that filters bots by whether they are in the given space.
     * @param space The space that the bots should be in.
     */
    function bySpace(space: string): BotFilterFunction;

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
    ): BotFilterFunction;

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
    function either(...filters: BotFilterFunction[]): BotFilterFunction;

    /**
     * Creates a function that negates the result of the given function.
     * @param filter The function whose results should be negated.
     *
     * @example
     * // Find all bots that are not in the "test" dimension.
     * let bots = getBots(not(inDimension("test")));
     */
    function not(filter: BotFilterFunction): BotFilterFunction;

    /**
     * Gets the value of the given tag stored in the given bot.
     * @param bot The bot.
     * @param tag The tag.
     *
     * @example
     * // Get the "color" tag from the `this` bot.
     * let color = getTag(this, "color");
     */
    function getTag(bot: Bot, ...tags: string[]): any;

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
    function setTag(bot: Bot | Bot[] | BotTags, tag: string, value: any): any;

    /**
     * Sets the value of the given tag mask in the given bot.
     * @param bot The bot.
     * @param tag The tag to set.
     * @param value The value to set.
     * @param space The space that the tag mask should be placed in. If not specified, then the tempLocal space will be used.
     * 
     * @example
     * // Set a bot's color to "green".
     * setTagMask(this, "color", "green")
     */
    function setTagMask(bot: Bot | Bot[], tag: string, value: any, space?: BotSpace): any;

    /**
     * Clears the tag masks from the given bot.
     * @param bot The bot or bots that the tag masks should be cleared from.
     * @param space The space that the tag masks should be cleared from. If not specified, then all spaces will be cleared.
     */
    function clearTagMasks(bot: Bot | Bot[], space?: BotSpace): void;

    /**
     * Inserts the given text into the given tag at the given index.
     * Returns the resulting raw tag value.
     * @param bot The bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index The index that the text should be inserted at.
     * @param text The text that should be inserted.
     */
    function insertTagText(
        bot: Bot,
        tag: string,
        index: number,
        text: string
    ): string;

    /**
     * Inserts the given text into the given tag and space at the given index.
     * Returns the resulting raw tag mask value.
     * @param bot The bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index The index that the text should be inserted at.
     * @param text The text that should be inserted.
     * @param space The space that the tag exists in. If not specified then the tempLocal space will be used.
     */
    function insertTagMaskText(
        bot: Bot,
        tag: string,
        index: number,
        text: string,
        space?: BotSpace
    ): string;

    /**
     * Deletes the specified number of characters from the given tag.
     * Returns the resulting raw tag value.
     * @param bot The bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index The index that the text should be deleted at.
     * @param count The number of characters to delete.
     */
    function deleteTagText(
        bot: Bot,
        tag: string,
        index: number,
        count: number
    ): string;

    /**
     * Deletes the specified number of characters from the given tag mask.
     * Returns the resulting raw tag mask value.
     * @param bot The bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index The index that the text should be deleted at.
     * @param count The number of characters to delete.
     * @param space The space that the tag mask exists in. If not specified then the tempLocal space will be used.
     */
    function deleteTagMaskText(
        bot: Bot,
        tag: string,
        index: number,
        count: number,
        space?: string
    ): string;

    /**
     * Creates a mod from declareed mod data.
     * @param bot The mod data that should be loaded.
     * @param tags The tags that should be included in the output mod.
     * @returns The mod that was loaded from the data.
     */
    function getMod(bot: any, ...tags: (string | RegExp)[]): Mod;

    /**
     * Gets the position that the given bot is at in the given dimension.
     * @param bot The bot or bot ID.
     * @param dimension The dimension that the bot's position should be retrieved for.
     */
    function getBotPosition(
        bot: Bot | string,
        dimension: string
    ): Vector3;

    /**
     * Gets the rotation that the given bot is at in the given dimension.
     * @param bot The bot or bot ID.
     * @param dimension The dimension that the bot's rotation should be retrieved for.
     */
    function getBotRotation(
        bot: Bot | string,
        dimension: string
    ): Rotation;

    /**
     * Applies the given diff to the given bot.
     * @param bot The bot.
     * @param diff The diff to apply.
     */
    function applyMod(bot: any, ...diffs: Mod[]): void;

    /**
     * subrtacts the given diff from the given bot.
     * @param bot The bot.
     * @param diff The diff to apply.
     */
    function subtractMods(bot: any, ...diffs: Mod[]): void;

    /**
     * Produces HTML from the given HTML strings and expressions.
     * Best used with a tagged template string.
     */
    const html: HtmlFunction;

    /**
     * Defines a set of functions that relate to common OS operations.
     */
    const os: Os;

    /**
     * Defines a set of functions that relate to AI operations.
     */
    const ai: Ai;

    /**
     * Defines a set of functions that relate to common server operations.
     * Typically, these operations are instance-independent.
     */
    const server: Server;

    /**
     * Defines a set of functions that handle actions.
     */
    const action: Actions;

    /**
     * Defines a set of functions that relate to common math operations.
     */
    const math: Math;

    /**
     * Defines a set of functions that are used to create and transform mods.
     */
    const mod: ModFuncs;

    /**
     * Defines a set of functions that are used to transform byte arrays.
     */
    const bytes: Bytes;

    // @ts-ignore: Ignore redeclaration
    const crypto: Crypto;

    /**
     * Defines a set of experimental functions.
     */
    const experiment: Experiment;

    /**
     * Defines a set of functions that are used to interface with Loom.
     */
    const loom: Loom;

    /**
     * Defines a set of performance related functions.
     */
    const perf: Perf;

    /**
     * Defines a set of analytics-related functions.
     */
    const analytics: Analytics;
}

interface DebuggerBase {

    /**
     * Gets the config bot from the debugger.
     * May be null.
     */
    get configBot(): Bot;

    /**
     * Gets the list of portal bots in the debugger.
     */
    getPortalBots(): Map<string, Bot>;

    /**
     * Gets the list of actions that have been performed by bots in this debugger.
     */
    getAllActions(): BotAction[];

    /**
     * Gets the list of common actions that have been performed by bots in this debugger.
     * Common actions are actions that don't directly change bots or bot tags.
     */
    getCommonActions(): BotAction[];

    /**
    * Gets the list of bot actions that have been performed by bots in this debugger.
    * Bot actions are actions that directly create/destroy/update bots or bot tags.
    */
    getBotActions(): BotAction[];

    /**
     * Gets the list of errors that occurred while bots were executing scripts in this debugger.
     */
    getErrors(): any[];

    /**
     * Registers the given handler to be called before a bot action is executed in this debugger.
     * @param handler The handler that should be called.
     */
    onBeforeAction(handler: (action: BotAction) => void): void;

    /**
     * Registers the given handler to be called after a bot action is executed in this debugger.
     * @param handler The handler that should be called.
     */
    onAfterAction(handler: (action: BotAction) => void): void;

    /**
     * Registers the given handler to be called before a user action is executed in this debugger.
     * User actions are like actions, but they are only triggered from the CasualOS frontend.
     * Generally, this includes things like input events (clicks), but it can also happen automatically.
     * @param listener The handler that should be called.
     */
    onBeforeUserAction(listener: (action: BotAction) => void): void;

    /**
     * Registers the given handler to be called after a bot script enqueues a bot action to be executed.
     * @param listener The listener that should be executed.
     */
    onScriptActionEnqueued(listener: (action: BotAction) => void): void;

    /**
     * Registers the given handler to be called after a bot script changes a tag value.
     * @param listener The listener that should be executed.
     */
    onAfterScriptUpdatedTag(listener: (update: DebuggerTagUpdate) => void): void;

    /**
     * Registers the given handler to be called after a bot script changes a tag mask value.
     * @param listener The listener that should be executed.
     */
    onAfterScriptUpdatedTagMask(listener: (update: DebuggerTagMaskUpdate) => void): void;

    /**
     * Gets the current call stack for the interpreter.
     * Only supported on pausable debuggers.
     */
    getCallStack(): DebuggerCallFrame[];

    /**
     * Performs the given actions as if they were user actions.
     * Returns a promise that resolves with an array that contains the result for each action in order.
     * If the action was a shout action, then the results for that shout are also included.
     * @param actions The actions that should be performed.
     */
    performUserAction(...actions: BotAction[]): Promise<(any[] | null)[]>;

    /**
     * Registers the given handler to react to when this debugger pauses by hitting a trigger.
     * @param handler The handler that should be called when the debugger pauses.
     */
    onPause(handler: (pause: DebuggerPause) => void): void;

    /**
     * Registers or updates a pause trigger with this debugger.
     * Pause triggers can be used to tell the debugger when you want it to stop execution.
     * You specify the bot, tag, line and column numbers and the debugger will stop before/after it executes the code at that location.
     * @param botOrIdOrTrigger The bot, bot ID, or trigger that should be registered or updated.
     * @param tag The tag that the trigger should be registered in. Required if a bot or bot ID is specified.
     * @param options The options that go with this pause trigger. Required if a bot or bot ID is specified.
     */
    setPauseTrigger(botOrIdOrTrigger: Bot | string | PauseTrigger, tag?: string, options?: PauseTriggerOptions): PauseTrigger;
    /**
     * Registers a new pause trigger with this debugger.
     * Pause triggers can be used to tell the debugger when you want it to stop execution.
     * You specify the bot, tag, line and column numbers and the debugger will stop before/after it executes the code at that location.
     * @param botOrId The bot, or bot ID that the trigger should be placed in.
     * @param tag The tag that the trigger should be placed in.
     * @param options The options that go with this pause trigger.
     */
    setPauseTrigger(botOrId: Bot | string, tag: string, options: PauseTriggerOptions): PauseTrigger;

    /**
     * Registers or updates the given pause trigger with this debugger.
     * @param trigger The trigger that should be registered or updated.
     */
    setPauseTrigger(trigger: PauseTrigger): PauseTrigger;

    /**
     * Removes the given pause trigger from the debugger.
     * @param triggerOrId The trigger or trigger ID that should be removed from the debugger.
     */
    removePauseTrigger(triggerOrId: string | PauseTrigger): void;

    /**
     * Disables the given pause trigger.
     * Disabled pause triggers will continue to be listed with listPauseTriggers(), but will not cause a pause to happen while they are disabled.
     * @param triggerOrId The trigger or trigger ID that should be disabled.
     */
    disablePauseTrigger(triggerOrId: string | PauseTrigger): void;

    /**
     * Enables the given pause trigger
     * @param triggerOrId The trigger or trigger ID that should be enabled.
     */
    enablePauseTrigger(triggerOrId: string | PauseTrigger): void;

    /**
     * Gets the list of pause triggers that have been registered with this debugger.
     */
    listPauseTriggers(): PauseTrigger[];

    /**
     * Gets a list of common trigger locations for the specified listener on the specified bot.
     * @param botOrId The bot or bot ID.
     * @param tag The name of the tag that the trigger locations should be listed for.
     */
    listCommonPauseTriggers(botOrId: Bot | string, tag: string): PossiblePauseTriggerLocation[];

    /**
     * Resumes the debugger execution from the given pause.
     * @param pause The pause state that execution should be resumed from.
     */
    resume(pause: DebuggerPause): void;

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
    removeTags(bot: Bot | Bot[], tagSection: string | RegExp): void;

    /**
     * Renames the given original tag to the given new tag using the given bot or list of bots.
     * @param bot The bot or list of bots that the tag should be renamed on.
     * @param originalTag The original tag to rename.
     * @param newTag The new tag name.
     * 
     * @example
     * // Rename the "abc" tag to "def"
     * renameTag(this, "abc", "def")
     */
    renameTag(bot: Bot | Bot[], originalTag: string, newTag: string): void;

    /**
     * Gets the ID from the given bot.
     * @param bot The bot or string.
     */
    getID(bot: Bot | string): string;

    /**
     * Gets JSON for the given data.
     * @param data The data.
     */
    getJSON(data: any): string;

    /**
    * Gets nicely formatted JSON for the given data.
    * @param data The data.
    */
    getFormattedJSON(data: any): string;

    /**
     * Makes a snapshot of the given bot(s).
     * Snapshots are like mods except they contain multiple bots and include the ID, space, tags, and tag masks of the bots.
     * @param bots The bots to make a snapshot of.
     */
    getSnapshot(bots: Bot | Bot[]): BotsState;

    /**
     * Calculates the difference between the two given snapshots.
     * @param first The first snapshot.
     * @param second The second snapshot.
     */
    diffSnapshots(first: BotsState, second: BotsState): PartialBotsState;

    /**
     * Applies the given delta to the given snapshot and returns the result.
     * This is essentially the opposite of diffSnapshots().
     * @param snapshot The snapshot that the diff should be applied to.
     * @param diff The delta that should be applied to the snapshot.
     */
    applyDiffToSnapshot(snapshot: BotsState, diff: PartialBotsState): BotsState;

    /**
     * Converts the given array of bytes into a base64 string.
     * @param bytes The bytes that should be converted into base64.
     */
    toBase64String(bytes: Uint8Array): string;

    /**
     * Converts the given base64 formatted string into an array of bytes.
     * @param base64 The base64 that should be converted to bytes.
     */
    fromBase64String(base64: string): Uint8Array;

    /**
    * Creates a tag value that can be used to link to the given bots.
    * @param bots The bots that the link should point to.
    */
     getLink(...bots: (Bot | string | (Bot | string)[])[]): string;

    /**
     * Gets the list of bot links that are stored in this bot's tags.
     * @param bot The bot to get the links for.
     */
    getBotLinks(bot: Bot): ParsedBotLink[];

    /**
    * Updates all the links in the given bot using the given ID map.
    * Useful if you know that the links in the given bot are outdated and you know which IDs map to the new IDs.
    * @param bot The bot to update.
    * @param idMap The map of old IDs to new IDs that should be used.
    */
    updateBotLinks(bot: Bot, idMap: Map<string, string | Bot> | { [id: string]: string | Bot }): void

    /**
     * Shouts the given event to every bot in every loaded simulation.
     * @param eventName The name of the event to shout.
     * @param arg The argument to shout. This gets passed as the `that` variable to the other scripts.
     */
    superShout(eventName: string, arg?: any): SuperShoutAction;

    /**
     * Watches the given bot or list of bots for changes and calls the given callback when the bot is changed or destroyed.
     * Returns a number that can be passed to clearWatchBot() to stop watching the bot.
     * @param bot The bot or list of bots that should be watched for changes.
     * @param callback The function that should be called when the bot is changed or destroyed.
     */
    watchBot(bot: (Bot | string)[] | Bot | string, callback: () => void): number;

    /**
     * Cancels watching a bot using the given ID number that was returned from watchBot().
     * @param watchId The ID number that should be used to cancel the watch callbacks.
     */
    clearWatchBot(watchId: number): void;

    /**
     * Watches the given portal for when bots are added and removed from it and calls the given function.
     * Returns a number that can be passed to clearWatchPortal() to stop watching the portal.
     * @param portalId The ID of the portal to watch.
     * @param callback The function that should be called when the portal changes.
     */
    watchPortal(portalId: string, callback: () => void): number;

    /**
     * Cancels watching a portal using the given ID number that was returned from watchPortal().
     * @param watchId The ID number that should be used to cancel the watch callbacks.
     */
    clearWatchPortal(watchId: number): void;

    /**
    * Asserts that the given condition is true.
    * Throws an error if the condition is not true.
    * @param condition The condition to check.
    * @param message The message to use in the error if the condition is not true.
    */
    assert(condition: boolean, message?: string): void;

    /**
     * Asserts that the given values contain the same data.
     * Throws an error if they are not equal.
     * @param received The value to test.
     * @param expected The value that the first should be equal to.
     */
    assertEqual(received: any, expected: any): void;

    /**
     * Sends a web request based on the given options.
     * @param options The options that specify where and what to send in the web request.
     *
     * @example
     * // Send a HTTP POST request to https://www.example.com/api/createThing
     * webhook({
     *   method: 'POST',
     *   url: 'https://www.example.com/api/createThing',
     *   data: {
     *     hello: 'world'
     *   },
     *   responseShout: 'requestFinished'
     * });
     */
    web: Web;

    /**
    * Creates a Universally Unique IDentifier (UUID).
    */
    uuid(): string;

    /**
     * Animates the given tag. Returns a promise when the animation is finished.
     * @param bot The bot or list of bots that should be animated.
     * @param tag The tag that should be animated.
     * @param options The options for the animation. If given null, then any running animations for the given tag will be canceled.
     */
    animateTag(bot: Bot | (Bot | string)[] | string, tag: string, options: AnimateTagFunctionOptions): Promise<void>;

    /**
     * Animates the given tags. Returns a promise when the animation is finished.
     * @param bot The bot or list of bots that should be animated.
     * @param options The options for the animation. fromValue should be an object which contains the starting tag values and toValue should be an object that contains the ending tag values.
     */
    animateTag(bot: Bot | (Bot | string)[] | string, options: AnimateTagFunctionOptions): Promise<void>;
    /**
     * Animates the given tag. Returns a promise when the animation is finished.
     * @param bot The bot or list of bots that should be animated.
     * @param tag The tag that should be animated.
     * @param options The options for the animation.
     */
    animateTag(
        bot: Bot | (Bot | string)[] | string,
        tagOrOptions: string | AnimateTagFunctionOptions,
        options?: AnimateTagFunctionOptions
    ): Promise<void>;

    /**
     * Cancels the animations that are running on the given bot(s).
     * @param bot The bot or list of bots that should cancel their animations.
     * @param tag The tag that the animations should be canceld for. If omitted then all tags will be canceled.
     */
    clearAnimations(bot: Bot | (Bot | string)[] | string, tag?: string): void;

    /**
     * Sends the given operation to all the devices that matches the given selector.
     * In effect, this allows users to send each other events directly without having to edit tags.
     *
     * Note that currently, devices will only accept events sent from the inst.
     *
     * @param event The event that should be executed in the remote session(s).
     * @param selector The selector that indicates where the event should be sent. The event will be sent to all sessions that match the selector.
     *                 For example, specifying a username means that the event will be sent to every active session that the user has open.
     *                 If a selector is not specified, then the event is sent to the inst.
     * @param allowBatching Whether to allow batching this remote event with other remote events. This will preserve ordering between remote events but may not preserve ordering
     *                      with respect to other events. Defaults to true.
     *
     * @example
     * // Send a toast to all sessions for the username "bob"
     * remote(os.toast("Hello, Bob!"), { username: "bob" });
     */
    remote(
        event: BotAction,
        selector?: SessionSelector | string | (SessionSelector | string)[],
        allowBatching?: boolean
    ): RemoteAction | RemoteAction[];

    /**
     * Sends an event to the given remote or list of remotes.
     * The other remotes will recieve an onRemoteData shout for this whisper.
     * 
     * In effect, this allows remotes to communicate with each other by sending arbitrary events.
     * 
     * @param remoteId The ID of the other remote or remotes to whisper to.
     * @param name The name of the event.
     * @param arg The optional argument to include in the event.
     */
    sendRemoteData(remoteId: string | string[], name: string, arg?: any): RemoteAction | RemoteAction[];

    /**
     * Gets the first bot which matches all of the given filters.
     * @param filters The filter functions that the bot needs to match.
     * @returns The first bot that matches all the given filters.
     *
     * @example
     * // Get a bot by the "name" tag.
     * let bot = getBot(byTag("name", "The bot's name"));
     */
    getBot(...filters: BotFilterFunction[]): Bot;

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
    getBot(tag: string, filter?: any | TagFilter): Bot;

    /**
     * Gets the first bot ordered by ID.
     * @returns The bot with the first ID when sorted alphebetically.
     *
     * @example
     * let firstBot = getBot();
     */
    getBot(): Bot;

    /**
     * Gets the list of bots which match all of the given filters.
     * @param filters The filter functions that the bots need to match.
     * @returns A list of bots that match all the given filters. If no bots match then an empty list is returned.
     *
     * @example
     * // Get all the bots that are red.
     * let bots = getBots(byTag("color", "red"));
     */
    getBots(...filters: ((bot: Bot) => boolean)[]): Bot[];

    /**
     * Gets the list of bots that have the given tag matching the given filter value.
     * @param tag The tag the bot should match.
     * @param filter The value or filter the bot should match.
     *
     * @example
     * // Get all the bots that are red.
     * // Shorthand for getBots(byTag("color", "red"))
     * let bots = getBots("color", "red");
     */
    getBots(tag: string, filter?: any | TagFilter): Bot[];

    /**
     * Gets a list of all the bots.
     *
     * @example
     * // Gets all the bots in the inst.
     * let bots = getBots();
     */
    getBots(): Bot[];

    /**
     * Gets the list of tag values from bots that have the given tag.
     * @param tag The tag.
     * @param filter THe optional filter to use for the values.
     */
    getBotTagValues(tag: string, filter?: TagFilter): any[];

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
    byTag(tag: string, filter?: TagFilter): BotFilterFunction;

    /**
     * Creates a filter function that checks whether bots have the given ID.
     * @param id The ID to check for.
     * 
     * @example
     * // Find all the bots with the ID "bob".
     * let bobs = getBots(byId("bob"));
     */
    byID(id: string): BotFilterFunction;

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
    byMod(mod: Mod): BotFilterFunction;

    /**
     * Creates a filter function that checks whether bots are in the given dimension.
     * @param dimension The dimension to check.
     * @returns A function that returns true if the given bot is in the dimension and false if it is not.
     *
     * @example
     * // Find all the bots in the "test" dimension.
     * let bots = getBots(inDimension("test"));
     */
    inDimension(dimension: string): BotFilterFunction;

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
    atPosition(
        dimension: string,
        x: number,
        y: number
    ): BotFilterFunction;

    /**
     * Creates a filter function that checks whether bots were created by the given bot.
     * @param bot The bot to determine weather the bots have been created by it or not.
     * @returns A function that returns true if the bot was created by the given bot.
     *
     * @example
     * // Find all the bots created by the yellow bot.
     * let bots = getBots(byCreator(getBot('color','yellow')));
     */
    byCreator(bot: Bot | string): BotFilterFunction;

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
    inStack(bot: Bot, dimension: string): BotFilterFunction;

    /**
     * Creates a function that filters bots by whether they are in the given space.
     * @param space The space that the bots should be in.
     */
    bySpace(space: string): BotFilterFunction;

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
    neighboring(
        bot: Bot,
        dimension: string,
        direction: 'front' | 'left' | 'right' | 'back'
    ): BotFilterFunction;

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
    either(...filters: BotFilterFunction[]): BotFilterFunction;

    /**
     * Creates a function that negates the result of the given function.
     * @param filter The function whose results should be negated.
     *
     * @example
     * // Find all bots that are not in the "test" dimension.
     * let bots = getBots(not(inDimension("test")));
     */
    not(filter: BotFilterFunction): BotFilterFunction;

    /**
     * Gets the value of the given tag stored in the given bot.
     * @param bot The bot.
     * @param tag The tag.
     *
     * @example
     * // Get the "color" tag from the `this` bot.
     * let color = getTag(this, "color");
     */
    getTag(bot: Bot, ...tags: string[]): any;

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
    setTag(bot: Bot | Bot[] | BotTags, tag: string, value: any): any;

    /**
     * Sets the value of the given tag mask in the given bot.
     * @param bot The bot.
     * @param tag The tag to set.
     * @param value The value to set.
     * @param space The space that the tag mask should be placed in. If not specified, then the tempLocal space will be used.
     * 
     * @example
     * // Set a bot's color to "green".
     * setTagMask(this, "color", "green")
     */
    setTagMask(bot: Bot | Bot[], tag: string, value: any, space?: BotSpace): any;

    /**
     * Clears the tag masks from the given bot.
     * @param bot The bot or bots that the tag masks should be cleared from.
     * @param space The space that the tag masks should be cleared from. If not specified, then all spaces will be cleared.
     */
    clearTagMasks(bot: Bot | Bot[], space?: BotSpace): void;

    /**
     * Inserts the given text into the given tag at the given index.
     * Returns the resulting raw tag value.
     * @param bot The bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index The index that the text should be inserted at.
     * @param text The text that should be inserted.
     */
    insertTagText(
        bot: Bot,
        tag: string,
        index: number,
        text: string
    ): string;

    /**
     * Inserts the given text into the given tag and space at the given index.
     * Returns the resulting raw tag mask value.
     * @param bot The bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index The index that the text should be inserted at.
     * @param text The text that should be inserted.
     * @param space The space that the tag exists in. If not specified then the tempLocal space will be used.
     */
    insertTagMaskText(
        bot: Bot,
        tag: string,
        index: number,
        text: string,
        space?: BotSpace
    ): string;

    /**
     * Deletes the specified number of characters from the given tag.
     * Returns the resulting raw tag value.
     * @param bot The bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index The index that the text should be deleted at.
     * @param count The number of characters to delete.
     */
    deleteTagText(
        bot: Bot,
        tag: string,
        index: number,
        count: number
    ): string;

    /**
     * Deletes the specified number of characters from the given tag mask.
     * Returns the resulting raw tag mask value.
     * @param bot The bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index The index that the text should be deleted at.
     * @param count The number of characters to delete.
     * @param space The space that the tag mask exists in. If not specified then the tempLocal space will be used.
     */
    deleteTagMaskText(
        bot: Bot,
        tag: string,
        index: number,
        count: number,
        space?: string
    ): string;

    /**
     * Creates a mod from declareed mod data.
     * @param bot The mod data that should be loaded.
     * @param tags The tags that should be included in the output mod.
     * @returns The mod that was loaded from the data.
     */
    getMod(bot: any, ...tags: (string | RegExp)[]): Mod;

    /**
     * Gets the position that the given bot is at in the given dimension.
     * @param bot The bot or bot ID.
     * @param dimension The dimension that the bot's position should be retrieved for.
     */
    getBotPosition(
        bot: Bot | string,
        dimension: string
    ): Vector3;

    /**
     * Gets the rotation that the given bot is at in the given dimension.
     * @param bot The bot or bot ID.
     * @param dimension The dimension that the bot's rotation should be retrieved for.
     */
    getBotRotation(
        bot: Bot | string,
        dimension: string
    ): Rotation;

    /**
     * Applies the given diff to the given bot.
     * @param bot The bot.
     * @param diff The diff to apply.
     */
    applyMod(bot: any, ...diffs: Mod[]): void;

    /**
     * subrtacts the given diff from the given bot.
     * @param bot The bot.
     * @param diff The diff to apply.
     */
    subtractMods(bot: any, ...diffs: Mod[]): void;

    /**
     * Produces HTML from the given HTML strings and expressions.
     * Best used with a tagged template string.
     */
    html: HtmlFunction;

    /**
     * Defines a set of functions that relate to common OS operations.
     */
    os: Os;

    /**
     * Defines a set of functions that relate to AI operations.
     */
    ai: Ai;

    /**
     * Defines a set of functions that relate to common server operations.
     * Typically, these operations are instance-independent.
     */
    server: Server;

    /**
     * Defines a set of functions that handle actions.
     */
    action: Actions;

    /**
     * Defines a set of functions that relate to common math operations.
     */
    math: Math;

    /**
     * Defines a set of functions that are used to create and transform mods.
     */
    mod: ModFuncs;
    
    /**
     * Defines a set of functions that are used to transform byte arrays.
     */
    bytes: Bytes;

    // @ts-ignore: Ignore redeclaration
    crypto: Crypto;

    /**
     * Defines a set of experimental functions.
     */
    experiment: Experiment;

    /**
     * Defines a set of performance related functions.
     */
    perf: Perf;

    /**
     * Defines a set of analytics-related functions.
     */
    analytics: Analytics;
}

/**
 * Defines an interface that represents a debugger.
 */
interface Debugger extends DebuggerBase {
    /**
     * Creates a new bot and returns it.
     * @param parent The bot that should be the parent of the new bot.
     * @param mods The mods which specify the new bot's tag values. If given a mod with no tags, then an error will be thrown.
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
    create(...mods: Mod[]): Bot | Bot[];

     /**
      * Destroys the given bot, bot ID, or list of bots.
      * @param bot The bot, bot ID, or list of bots to destroy.
      */
    destroy(bot: Bot | string | Bot[]): void;

     /**
     * Shouts the given events in order until a bot returns a result.
     * Returns the result that was produced or undefined if no result was produced.
     * @param eventNames The names of the events to shout.
     * @param arg The argument to shout.
     */
    priorityShout(eventNames: string[], arg?: any): any;

    /**
     * Asks every bot in the inst to run the given action.
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
    shout(name: string, arg?: any): any[];

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
    whisper(
        bot: (Bot | string)[] | Bot | string,
        eventName: string,
        arg?: any
    ): any;

    /**
     * Changes the state that the given bot is in.
     * @param bot The bot to change.
     * @param stateName The state that the bot should move to.
     * @param groupName The group of states that the bot's state should change in. (Defaults to "state")
     */
    changeState(bot: Bot, stateName: string, groupName?: string): void;
}

/**
 * Defines an interface that represents a debugger.
 */
interface PausableDebugger extends DebuggerBase {
    /**
     * Creates a new bot and returns it.
     * @param parent The bot that should be the parent of the new bot.
     * @param mods The mods which specify the new bot's tag values. If given a mod with no tags, then an error will be thrown.
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
    create(...mods: Mod[]): Promise<Bot | Bot[]>;

     /**
      * Destroys the given bot, bot ID, or list of bots.
      * @param bot The bot, bot ID, or list of bots to destroy.
      */
    destroy(bot: Bot | string | Bot[]): Promise<void>;

     /**
     * Shouts the given events in order until a bot returns a result.
     * Returns the result that was produced or undefined if no result was produced.
     * @param eventNames The names of the events to shout.
     * @param arg The argument to shout.
     */
    priorityShout(eventNames: string[], arg?: any): Promise<any>;

    /**
     * Asks every bot in the inst to run the given action.
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
    shout(name: string, arg?: any): Promise<any[]>;

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
    whisper(
        bot: (Bot | string)[] | Bot | string,
        eventName: string,
        arg?: any
    ): Promise<any>;

    /**
     * Changes the state that the given bot is in.
     * @param bot The bot to change.
     * @param stateName The state that the bot should move to.
     * @param groupName The group of states that the bot's state should change in. (Defaults to "state")
     */
    changeState(bot: Bot, stateName: string, groupName?: string): Promise<void>;
}

/**
 * Defines an interface that represents the set of additional options that can be provided when recording a file.
 */
interface RecordFileOptions {
    /**
     * The description of the file.
     */
    description?: string;

    /**
     * The MIME type of the file. 
     * See https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types for more information.
     */
    mimeType?: string;
}


/**
 * Defines an interface that contains a bunch of options for starting an animation.
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
 * Defines an interface that contains a bunch of options for stopping an animation.
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
 * Defines an interface that contains animation information.
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
 * Defines an interface that represents a single chat message in a conversation with an AI.
 *
 * @dochash types/ai
 * @docname AIChatMessage
 */
export interface AIChatMessage {
    /**
     * The role of the message.
     *
     * - `system` means that the message was generated by the system. Useful for telling the AI how to behave while.
     * - `user` means that the message was generated by the user.
     * - `assistant` means that the message was generated by the AI assistant.
     * - `function` means that the message contains the results of a function call.
     */
    role: 'system' | 'user' | 'assistant' | 'function';

    /**
     * The contents of the message.
     * This can be a string, an array of objects which represent the contents of the message.
     */
    content: string | AIChatContent[];

    /**
     * The name of the author of the message.
     *
     * This is required if the role is `function`.
     */
    author?: string;

    /**
     * The reason why the message was finished.
     */
    finishReason?: string;
}


/**
 * Defines an interface that represents the contents of an AI chat message.
 *
 * @dochash types/ai
 * @docname AIChatContent
 */
export type AIChatContent = AITextContent | AIDataContent | AIUrlContent;

/**
 * Defines an interface that represents text that is passed to an AI chat model.
 *
 * @dochash types/ai
 * @docname AITextContent
 */
export interface AITextContent {
    /**
     * The text of the content.
     */
    text: string;
}

/**
 * Defines an interface that represents data that is passed to an AI chat model.
 * This data can be used to represent images, videos, or other types of binary data that the model supports.
 * Some models do not support this type of content.
 *
 * @dochash types/ai
 * @docname AIDataContent
 */
export interface AIDataContent {
    /**
     * The base 64 encoded data of the content.
     */
    base64: string;

    /**
     * The MIME type of the content.
     */
    mimeType: string;
}

/**
 * Defines an interface that represents a URL that is passed to an AI chat model.
 * This data can be used to represent images, videos, or other types of data that the model supports fetching.
 * Some models do not support this type of content.
 *
 * @dochash types/ai
 * @docname AIUrlContent
 */
export interface AIUrlContent {
    /**
     * The URL that the content is available at.
     */
    url: string;
}


/**
 * Defines an interface that represents options for {@link ai.chat}.
 *
 * @dochash types/ai
 * @docname AIChatOptions
 */
export interface AIChatOptions extends RecordActionOptions {
    /**
     * The model that should be used.
     *
     * If not specified, then a default will be used.
     *
     * Currently, the following models are supported:
     *
     * - `gpt-4`
     * - `gpt-3.5-turbo`
     */
    preferredModel?: 'gpt-4' | 'gpt-3.5-turbo';

    /**
     * The temperature that should be used.
     *
     * If not specified, then a default will be used.
     */
    temperature?: number;

    /**
     * The nucleus sampling probability.
     */
    topP?: number;

    /**
     * The presence penalty.
     *
     * Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.
     */
    presencePenalty?: number;

    /**
     * The frequency penalty.
     *
     * Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.
     */
    frequencyPenalty?: number;

    /**
     * The list of stop words that should be used.
     * 
     * If the AI generates a sequence of tokens that match one of the given words, then it will stop generating tokens.
     */
    stopWords?: string[];
}

/**
 * Defines an interface that represents options for {@link ai.generateSkybox-string}.
 *
 * @dochash types/ai
 * @docname AIGenerateSkyboxOptions
 */
export interface AIGenerateSkyboxOptions extends RecordActionOptions {
    /**
     * Options that are specific to blockade-labs.
     */
    blockadeLabs?: AIGenerateSkyboxBlockadeLabsOptions;
}

/**
 * Options that are specific to Blockade Labs implementations for {@link ai.generateSkybox-string}.
 *
 * @dochash types/ai
 * @docname AIGenerateSkyboxOptions
 */
export interface AIGenerateSkyboxBlockadeLabsOptions {
    /**
     * The pre-defined style ID for the skybox.
     */
    skyboxStyleId?: number;

    /**
     * The ID of a previously generated skybox.
     */
    remixImagineId?: number;

    /**
     * The random seed to use for generating the skybox.
     */
    seed?: number;
}

/**
 * Defines an interface that represents a request for {@link ai.generateSkybox-request}.
 * 
 * @dochash types/ai
 * @docname AIGenerateSkyboxRequest
 */
export interface AIGenerateSkyboxRequest {
    /**
     * The prompt that describes what the generated skybox should look like.
     */
    prompt: string;

    /**
     * The prompt that that describes what the generated skybox should avoid looking like.
     */
    negativePrompt?: string;

    /**
     * The options that should be included in the request.
     */
    options: AIGenerateSkyboxOptions;
}

/**
 * Defines an interface that represents the result from {@link ai.generateSkybox-request}.
 * 
 * @dochash types/ai
 * @docname AIGenerateSkyboxResult
 */
export interface AIGenerateSkyboxResult {
    /**
     * The URL that the generated skybox is located at.
     */
    fileUrl: string;

    /**
     * The URL that the thumbnail for the generated skybox is located at.
     */
    thumbnailUrl?: string;
}


/**
 * Defines an interface that represents options for {@link ai.generateImage-string}.
 * 
 * @dochash types/ai
 * @docname AIGenerateImageOptions
 */
export interface AIGenerateImageOptions {
    /**
     * The description of what the generated image(s) should look like.
     */
    prompt: string;

    /**
     * The description of what the generated image(s) should not look like.
     */
    negativePrompt?: string;

    /**
     * The model that should be used to generate the image(s).
     */
    model?: string;

    /**
     * The desired width of the image(s) in pixels.
     */
    width?: number;

    /**
     * The desired height of the image(s) in pixels.
     */
    height?: number;

    /**
     * The number of images that should be generated.
     */
    numberOfImages?: number;

    /**
     * The random noise seed that should be used.
     */
    seed?: number;

    /**
     * The number of diffusion steps to run.
     */
    steps?: number;

    /**
     * How strictly the diffusion process adheres to the prompt text.
     * Higher values keep the image closer to the prompt.
     */
    cfgScale?: number;

    /**
     * The sampler to use for the diffusion process.
     */
    sampler?: string;

    /**
     * The clip guidance preset.
     */
    clipGuidancePreset?: string;

    /**
     * The style preset that should be used to guide the image model torwards a specific style.
     */
    stylePreset?: string;
}

/**
 * Defines an interface that represents a result from {@link ai.generateImage-request}.
 * @dochash types/ai
 * @docname AIGenerateImageSuccess
 */
export interface AIGenerateImageSuccess {
    success: true;

    /**
     * The list of images that were generated.
     */
    images: AIGeneratedImage[];
}


/**
 * Defines an interface that represents an AI generated image.
 * 
 * @dochash types/ai
 * @docname AIGeneratedImage
 */
export interface AIGeneratedImage {
    /**
     * The base64 encoded image.
     */
    base64: string;

    /**
     * The URL that can be used to display the image.
     */
    url: string;

    /**
     * The seed of the generated image.
     */
    seed?: number;
}


export type AIHumeGetAccessTokenResult =
    | AIHumeGetAccessTokenSuccess
    | AIHumeGetAccessTokenFailure;

export interface AIHumeGetAccessTokenSuccess {
    success: true;
    /**
     * The access token that was generated.
     */
    accessToken: string;
    /**
     * The number of seconds that the access token is valid for.
     */
    expiresIn: number;

    /**
     * The unix time in seconds that the token was issued at.
     */
    issuedAt: number;

    /**
     * The type of the token. Always "Bearer" for now.
     */
    tokenType: 'Bearer';
}

export interface AIHumeGetAccessTokenFailure {
    success: false;

    errorCode:
        | ServerError
        | NotLoggedInError
        | NotSupportedError
        | NotAuthorizedError
        | 'hume_api_error';
    errorMessage: string;
}


/**
 * The response to a request to generate a model using the Sloyd AI interface.
 * 
 * @dochash types/ai
 * @docname AISloydGenerateModelResponse
 */
export type AISloydGenerateModelResponse =
    | AISloydGenerateModelSuccess
    | AISloydGenerateModelFailure;

/**
 * A successful response to a request to generate a model using the Sloyd AI interface.
 * 
 * @dochash types/ai
 * @docname AISloydGenerateModelSuccess
 */
export interface AISloydGenerateModelSuccess {
    success: true;

    /**
     * The ID of the model that was created.
     */
    modelId: string;

    /**
     * The name of the model.
     */
    name: string;

    /**
     * The confidence of the AI in the created model.
     */
    confidence: number;

    /**
     * The MIME type of the model.
     */
    mimeType: 'model/gltf+json' | 'model/gltf-binary';

    /**
     * The data for the model.
     * If the mimeType is "model/gltf+json", then this will be a JSON string.
     * If the mimeType is "model/gltf-binary", then this will be a base64 encoded string.
     */
    modelData: string;

    /**
     * The base64 encoded thumbnail of the model.
     */
    thumbnailBase64?: string;
}

/**
 * A failed response to a request to generate a model using the Sloyd AI interface.
 * 
 * @dochash types/ai
 * @docname AISloydGenerateModelFailure
 */
export interface AISloydGenerateModelFailure {
    success: false;

    /**
     * The error code.
     */
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotSupportedError
        | NotAuthorizedError;

    /**
     * The error message.
     */
    errorMessage: string;
}


/**
 * The options for generating a model using Sloyd AI.
 * 
 * @dochash types/ai
 * @docname AISloydGenerateModelOptions
 */
export interface AISloydGenerateModelOptions {
    /**
     * The name of the record that should be used.
     * If omitted, then the ID of the user will be used.
     */
    recordName?: string | null;

    /**
     * The prompt to use for the model.
     */
    prompt: string;

    /**
     * The MIME type that should be used for the model.
     * If omitted, then "model/gltf+json" will be used.
     */
    outputMimeType?: 'model/gltf+json' | 'model/gltf-binary';

    /**
     * The level of detail that should be used.
     */
    levelOfDetail?: number;

    /**
     * The ID of the model that the new model should be based on.
     */
    baseModelId?: string;

    /**
     * The options for the thumbnail for the model.
     * If omitted, then no thumbnail will be generated.
     */
    thumbnail?: {
        /**
         * The type of the thumbnail.
         * Currently only "image/png" is supported.
         */
        type: 'image/png';

        /**
         * The desired width of the thumbnail in pixels.
         */
        width: number;

        /**
         * The desired height of the thumbnail in pixels.
         */
        height: number;
    }
}


/**
 * Defines a request to create a new realtime session.
 * 
 * @dochash types/ai
 * @docname RealtimeSessionRequest
 */
export interface CreateRealtimeSessionTokenRequest {
    /**
     * The default system instructions (i.e. system message) prepended to model calls. This field allows the client to guide the model on desired responses. The model can be instructed on response content and format, (e.g. "be extremely succinct", "act friendly", "here are examples of good responses") and on audio behavior (e.g. "talk quickly", "inject emotion into your voice", "laugh frequently"). The instructions are not guaranteed to be followed by the model, but they provide guidance to the model on the desired behavior.
     *
     * Note that the server sets default instructions which will be used if this field is not set and are visible in the session.created event at the start of the session.
     */
    instructions?: string;

    /**
     * The Realtime model used for this session.
     */
    model: string;

    /**
     * The set of modalities the model can respond with. To disable audio, set this to ["text"].
     */
    modalities?: ('audio' | 'text')[];

    /**
     * Maximum number of output tokens for a single assistant response, inclusive of tool calls. Provide an integer between 1 and 4096 to limit output tokens, or inf for the maximum available tokens for a given model. Defaults to inf.
     */
    maxResponseOutputTokens?: number;

    /**
     * The format of input audio. Options are `pcm16`, `g711_ulaw`, or `g711_alaw`. For `pcm16`, input audio must be 16-bit PCM at a 24kHz sample rate, single channel (mono), and little-endian byte order.
     */
    inputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';

    /**
     * Configuration for input audio noise reduction. This can be set to null to turn off. Noise reduction filters audio added to the input audio buffer before it is sent to VAD and the model. Filtering the audio can improve VAD and turn detection accuracy (reducing false positives) and model performance by improving perception of the input audio.
     */
    inputAudioNoiseReduction?: {
        /**
         * Type of noise reduction. `near_field` is for close-talking microphones such as headphones, `far_field` is for far-field microphones such as laptop or conference room microphones.
         */
        type?: 'near_field' | 'far_field';
    } | null;

    /**
     * Configuration for input audio transcription, defaults to off and can be set to `null` to turn off once on. Input audio transcription is not native to the model, since the model consumes audio directly. Transcription runs asynchronously through the /audio/transcriptions endpoint and should be treated as guidance of input audio content rather than precisely what the model heard. The client can optionally set the language and prompt for transcription, these offer additional guidance to the transcription service.
     */
    inputAudioTranscription?: {
        /**
         * The language of the input audio. Supplying the input language in [ISO-639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) (e.g. `en`) format will improve accuracy and latency.
         */
        language?: string;

        /**
         * The model to use for transcription, current options are `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, and `whisper-1`.
         */
        model?: string;

        /**
         * An optional text to guide the model's style or continue a previous audio segment. For `whisper-1`, the prompt is a list of keywords. For `gpt-4o-transcribe` models, the prompt is a free text string, for example "expect words related to technology".
         */
        prompt?: string;
    } | null;

    /**
     * The format of output audio. Options are pcm16, g711_ulaw, or g711_alaw. For pcm16, output audio is sampled at a rate of 24kHz.
     */
    outputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';

    /**
     * Sampling temperature for the model, limited to [0.6, 1.2]. For audio models a temperature of 0.8 is highly recommended for best performance.
     */
    temperature?: number;

    /**
     * How the model chooses tools. Options are `auto`, `none`, `required`, or specify a function.
     */
    toolChoice?: string;

    /**
     * Tools (functions) available to the model.
     */
    tools?: {
        /**
         * The description of the function, including guidance on when and how to call it, and guidance about what to tell the user when calling (if anything).
         */
        description?: string;

        /**
         * The name of the function.
         */
        name?: string;

        /**
         * Parameters of the function in JSON Schema.
         */
        parameters?: any;

        /**
         * The type of the tool, i.e. `function`.
         */
        type?: 'function';
    }[];

    /**
     * Configuration for turn detection, ether Server VAD or Semantic VAD. This can be set to `null` to turn off, in which case the client must manually trigger model response. Server VAD means that the model will detect the start and end of speech based on audio volume and respond at the end of user speech. Semantic VAD is more advanced and uses a turn detection model (in conjuction with VAD) to semantically estimate whether the user has finished speaking, then dynamically sets a timeout based on this probability. For example, if user audio trails off with "uhhm", the model will score a low probability of turn end and wait longer for the user to continue speaking. This can be useful for more natural conversations, but may have a higher latency.
     */
    turnDetection?: {
        /**
         * Whether or not to automatically generate a response when a VAD stop event occurs.
         */
        createResponse?: boolean;

        /**
         * Used only for `semantic_vad` mode. The eagerness of the model to respond. `low` will wait longer for the user to continue speaking, `high` will respond more quickly. `auto` is the default and is equivalent to `medium`.
         */
        eagerness?: 'low' | 'medium' | 'high';

        /**
         * Whether or not to automatically interrupt any ongoing response with output to the default conversation (i.e. `conversation` of `auto`) when a VAD start event occurs.
         */
        interruptResponse?: boolean;

        /**
         * Used only for `server_vad` mode. Amount of audio to include before the VAD detected speech (in milliseconds). Defaults to 300ms.
         */
        prefixPaddingMs?: number;

        /**
         * Used only for `server_vad` mode. Duration of silence to detect speech stop (in milliseconds). Defaults to 500ms. With shorter values the model will respond more quickly, but may jump in on short pauses from the user.
         */
        silenceDurationMs?: number;

        /**
         * Used only for `server_vad` mode. Activation threshold for VAD (0.0 to 1.0), this defaults to 0.5. A higher threshold will require louder audio to activate the model, and thus might perform better in noisy environments.
         */
        threshold?: number;

        /**
         * Type of turn detection.
         */
        type?: 'server_vad' | 'semantic_vad';
    } | null;

    /**
     * The voice the model uses to respond. Voice cannot be changed during the session once the model has responded with audio at least once. Current voice options are `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `onyx`, `nova`, `sage`, `shimmer`, and `verse`.
     */
    voice?: string;
}

/**
 * The response to a request to create a realtime session token using the OpenAI interface.
 * @dochash types/ai
 * @docname AICreateOpenAIRealtimeSessionTokenResult
 */
export type AICreateOpenAIRealtimeSessionTokenResult =
    | AICreateOpenAIRealtimeSessionTokenSuccess
    | AICreateOpenAIRealtimeSessionTokenFailure;

/**
 * A successful response to a request to create a realtime session token using the OpenAI interface.
 * @dochash types/ai
 * @docname AICreateOpenAIRealtimeSessionTokenSuccess
 */
export interface AICreateOpenAIRealtimeSessionTokenSuccess {
    success: true;
    sessionId: string;
    clientSecret: {
        value: string;
        expiresAt: number;
    };
}

/**
 * A unsuccessful response to a request to create a realtime session token using the OpenAI interface.
 * @dochash types/ai
 * @docname AICreateOpenAIRealtimeSessionTokenFailure
 */
export interface AICreateOpenAIRealtimeSessionTokenFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}


/**
 * Defines an interface for a generic HTTP response.
 */
export interface GenericHttpResponse {
    /**
     * The status code for the response.
     * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
     *
     */
    statusCode: number;

    /**
     * The list of headers to include in the response.
     */
    headers?: GenericHttpHeaders;

    /**
     * The body of the response.
     *
     * If given a string, then the body will be set to that string.
     * If given an AsyncIterable, then each chunk will be written to the stream as a separate chunk.
     */
    body?: string | null | AsyncIterable<string>;
}

export interface GenericHttpHeaders {
    [key: string]: string;
}

export type KnownErrorCodes =
    | 'not_logged_in'
    | 'not_supported'
    | 'data_not_found'
    | 'data_too_large'
    | 'record_not_found'
    | 'file_not_found'
    | 'session_not_found'
    | 'operation_not_found'
    | 'studio_not_found'
    | 'user_not_found'
    | 'inst_not_found'
    | 'session_already_revoked'
    | 'invalid_code'
    | 'invalid_key'
    | 'invalid_request'
    | 'invalid_origin'
    | 'invalid_record_key'
    | 'session_expired'
    | 'unacceptable_address'
    | 'unacceptable_user_id'
    | 'unacceptable_code'
    | 'unacceptable_session_key'
    | 'unacceptable_session_id'
    | 'unacceptable_request_id'
    | 'unacceptable_ip_address'
    | 'unacceptable_address_type'
    | 'unacceptable_expire_time'
    | 'unacceptable_request'
    | 'unacceptable_update'
    | 'address_type_not_supported'
    | 'server_error'
    | 'unauthorized_to_create_record_key'
    | 'price_does_not_match'
    | 'user_is_banned'
    | 'rate_limit_exceeded'
    | 'not_authorized'
    | 'not_subscribed'
    | 'invalid_subscription_tier'
    | 'subscription_limit_reached'
    | 'record_already_exists'
    | 'action_not_supported'
    | 'no_session_key'
    | 'unacceptable_studio_id'
    | 'email_already_exists'
    | 'parent_email_already_exists'
    | 'parent_email_required'
    | 'invalid_room_name'
    | 'invalid_username'
    | 'invalid_update_policy'
    | 'invalid_delete_policy'
    | 'unacceptable_url'
    | 'file_already_exists'
    | 'invalid_file_data'
    | 'invalid_model'
    | 'roles_too_large'
    | 'policy_not_found'
    | 'policy_too_large'
    | 'invalid_policy'
    | 'not_completed'
    | 'invalid_display_name'
    | 'permission_already_exists'
    | 'comId_not_found'
    | 'comId_already_taken'
    | 'permission_not_found'
    | 'unacceptable_connection_token'
    | 'invalid_token'
    | 'unacceptable_connection_id'
    | 'message_not_found'
    | 'not_found'
    | 'invalid_connection_state'
    | 'user_already_exists'
    | 'session_is_not_revokable'
    | 'hume_api_error'
    | 'invalid_webhook_target'
    | 'took_too_long';

/**
 * Defines a base interface for a record that can be stored in a CrudStore.
 */
export interface CrudRecord {
    /**
     * The address of the record.
     */
    address: string;

    /**
     * The markers that are associated with the record.
     */
    markers: string[];
}

export type CrudRecordItemResult =
    | CrudRecordItemSuccess
    | CrudRecordItemFailure;

export interface CrudRecordItemSuccess {
    success: true;
    recordName: string;
    address: string;
}

export interface CrudRecordItemFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}

export type CrudGetItemResult<T> = CrudGetItemSuccess<T> | CrudGetItemFailure;

export interface CrudGetItemSuccess<T> {
    success: true;
    item: T;
}

export interface CrudGetItemFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}

export type CrudEraseItemResult = CrudEraseItemSuccess | CrudEraseItemFailure;

export interface CrudEraseItemSuccess {
    success: true;
}

export interface CrudEraseItemFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}


export type CrudListItemsResult<T> =
    | CrudListItemsSuccess<T>
    | CrudListItemsFailure;

export interface CrudListItemsSuccess<T> {
    success: true;
    /**
     * The name of the record that the items are from.
     */
    recordName: string;

    /**
     * The items that were listed.
     */
    items: T[];

    /**
     * The total number of items in the record.
     */
    totalCount: number;

    /**
     * The marker that was listed.
     * If null, then all markers are listed.
     */
    marker?: string;
}

export interface CrudListItemsFailure {
    success: false;
    errorCode:
        | ServerError
        | NotLoggedInError
        | NotAuthorizedError
        | 'data_not_found';
    errorMessage: string;
}


export type HandleWebhookResult = HandleWebhookSuccess | HandleWebhookFailure;

export interface HandleWebhookSuccess {
    success: true;

    /**
     * The result of the webhook.
     */
    response: GenericHttpResponse;
}

export interface HandleWebhookFailure {
    /**
     * Whether the webhook was successfully handled.
     */
    success: false;

    /**
     * The error code if the webhook was not successfully handled.
     */
    errorCode:
        | ServerError
        | 'not_found'
        | NotAuthorizedError
        | 'invalid_webhook_target';

    /**
     * The error message if the webhook was not successfully handled.
     */
    errorMessage: string;
}


/**
 * Defines an interface that represents the options for a list data action.
 *
 * @dochash types/records/data
 * @docName ListDataOptions
 */
export interface ListWebhooksOptions extends RecordActionOptions {
    /**
     * The order that items should be sorted in.
     * - "ascending" means that the items should be sorted in alphebatically ascending order by address.
     * - "descending" means that the items should be sorted in alphebatically descending order by address.
     */
    sort?: 'ascending' | 'descending';
}


/**
 * Defines an interface that represents the options for a list action.
 *
 * @dochash types/records/notifications
 * @docName ListNotificationsOptions
 */
export interface ListNotificationsOptions extends RecordActionOptions {
    /**
     * The order that items should be sorted in.
     * - "ascending" means that the items should be sorted in alphebatically ascending order by address.
     * - "descending" means that the items should be sorted in alphebatically descending order by address.
     */
    sort?: 'ascending' | 'descending';
}


export interface WebhookRecord extends CrudRecord {
    /**
     * The resource kind of the webhook target.
     * - 'file': The webhook target is a file record.
     * - 'inst': The webhook target is an instance record.
     * - 'data': The webhook target is a data record.
     */
    targetResourceKind: 'file' | 'inst' | 'data';

    /**
     * The name of the record that is being targeted by this webhook.
     * Null if the webhook is targeting a public inst.
     */
    targetRecordName: string | null;

    /**
     * The address of the record that is being targeted by this webhook.
     */
    targetAddress: string;

    // TODO:
    /**
     * The calling convention of the webhook.
     * Different calling conventions support different capabilities.
     *
     * - `http`: The webhook is called with a HTTP request. This grants the most flexibility for working with HTTP, and doesn't enforce a strict structure for the request and response.
     * - `rpc`: The webhook is called with a RPC request. This enforces a strict structure for the request and response.
     */
    // callingConvention?: 'http' | 'rpc';

    /**
     * The ID of the user that represents the webhook.
     * This is used to authenticate the webhook for access to resources.
     *
     * If null, then the webhook does not use any authentication.
     */
    userId?: string | null;
}

/**
 * Defines a record that represents a notification.
 * That is, a way for users to be notified of something.
 */
export interface NotificationRecord extends CrudRecord {
    /**
     * The description of the notification.
     */
    description: string | null;
}

export type SubscribeToNotificationResult =
    | SubscribeToNotificationSuccess
    | SubscribeToNotificationFailure;

export interface SubscribeToNotificationSuccess {
    success: true;

    /**
     * The ID of the subscription that was created.
     */
    subscriptionId: string;
}

export interface SubscribeToNotificationFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}


export type UnsubscribeToNotificationResult =
    | UnsubscribeToNotificationSuccess
    | UnsubscribeToNotificationFailure;

export interface UnsubscribeToNotificationSuccess {
    success: true;
}

export interface UnsubscribeToNotificationFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}


export type SendNotificationResult =
    | SendNotificationSuccess
    | SendNotificationFailure;

export interface SendNotificationSuccess {
    success: true;
}

export interface SendNotificationFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}

/**
 * Defines an active subscription to a notification.
 */
export interface NotificationSubscription {
    /**
     * The ID of the subscription.
     */
    id: string;

    /**
     * The name of the record that the subscription is for.
     */
    recordName: string;

    /**
     * The address of the notification in the record.
     */
    notificationAddress: string;

    /**
     * The ID of the user that is subscribed.
     * If null, then notifications should only be sent to the specified push subscription.
     */
    userId: string | null;

    /**
     * The push subscription that the notification should be sent to.
     * If null, then notifications should be sent to all push subscriptions for the user.
     */
    pushSubscriptionId: string | null;
}

export type ListSubscriptionsResult =
    | ListSubscriptionsSuccess
    | ListSubscriptionsFailure;

export interface ListSubscriptionsSuccess {
    success: true;

    /**
     * The list of subscriptions.
     */
    subscriptions: NotificationSubscription[];
}

export interface ListSubscriptionsFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}


export interface PushNotificationPayload {
    /**
     * The title of the push notification.
     * 
     * See https://web.dev/articles/push-notifications-display-a-notification#title_and_body_options
     */
    title: string;

    /**
     * The body of the push notification.
     * 
     * See https://web.dev/articles/push-notifications-display-a-notification#title_and_body_options for more information.
     */
    body?: string;

    /**
     * The URL to the icon that should displayed for the push notification.
     * 
     * See https://web.dev/articles/push-notifications-display-a-notification#icon for more information.
     */
    icon?: string;

    /**
     * The URL to the image that should be used for the badge of the push notification.
     * 
     * See https://web.dev/articles/push-notifications-display-a-notification#badge for more information.
     */
    badge?: string;

    /**
     * Whether the push notification should be silent.
     */
    silent?: boolean;

    /**
     * The tag for the notification.
     * 
     * See https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification#tag
     */
    tag?: string;
    /**
     * The timestamp for the notification.
     * 
     * See https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification#timestamp
     */
    timestamp?: number;

    /**
     * The action that should be performed when the notification is clicked.
     */
    action?: PushNotificationAction;

    /**
     * The actions that should be displayed on the notification.
     */
    actions?: PushNotificationActionOption[];
}

export type PushNotificationAction = PushNotificationOpenUrlAction | PushNotificationWebhookAction;

export interface PushNotificationOpenUrlAction {
    type: 'open_url';
    url: string;
}

export interface PushNotificationWebhookAction {
    type: 'webhook';
    method: 'GET' | 'POST';
    url: string;
    headers?: Record<string, string>;
}

export interface PushNotificationActionOption {
    title: string;
    icon?: string;
    action: PushNotificationAction;
}

/**
 * Defines an interface that represents the options for sending a notification.
 *
 * @dochash types/records/notifications
 * @docName SendNotificationOptions
 */
export interface SendNotificationOptions extends RecordActionOptions {
    /**
     * The topic that the notification is for.
     * Topics can be used to replace existing notifications with a new notification.
     */
    topic?: string;
}


/**
 * Defines an interface for objects that are able to synchronize data between multiple clients.
 */
export interface SharedDocument extends SubscriptionLike {
    /**
     * The name of the record that the document is stored under.
     * If null, then the document is public.
     */
    recordName: string | null;

    /**
     * The address of the document.
     * If null, then the document is stored locally.
     */
    address: string | null;

    /**
     * The branch that was loaded for the document.
     */
    branch: string;

    /**
     * The ID of the remote client that the document is associated with.
     */
    clientId: number;

    /**
     * Gets an observable list that resolves whenever the partition state version is updated.
     */
    onVersionUpdated: Observable<CurrentVersion>;

    /**
     * Gets an observable list of errors from the partition.
     * That is, errors that the client cannot handle.
     */
    onError: Observable<any>;

    /**
     * Gets the observable list of remote events from the partition.
     */
    onEvents: Observable<Action[]>;

    /**
     * Gets the observable list of status updates from the partition.
     */
    onStatusUpdated: Observable<StatusUpdate>;

    /**
     * Gets the observable list of client errors from the document.
     * That is, errors that were caused by the client's behavior.
     */
    onClientError: Observable<ClientError>;

    /**
     * Tells the document to connect to its backing store.
     */
    connect(): void;

    /**
     * Gets a top-level map that can be used to store key/value data.
     * @param name The name of the map.
     */
    getMap<T = any>(name: string): SharedMap<T>;

    /**
     * Gets a top-level array that can be used to store a list of items.
     * @param name The name of the array.
     */
    getArray<T = any>(name: string): SharedArray<T>;

    /**
     * Gets a top-level text object that can be used to store rich text.
     * @param name The name of the text.
     */
    getText(name: string): SharedText;

    /**
     * Creates a new map that can be shared between multiple clients.
     */
    createMap<T = any>(): SharedMap<T>;

    /**
     * Creates a new array that can be shared between multiple clients.
     */
    createArray<T = any>(): SharedArray<T>;

    /**
     * Batches changes that occur within the given callback function into a single transaction.
     * This makes multiple updates more efficient.
     * @param callback The function to execute.
     */
    transact(callback: () => void): void;

    /**
     * Gets the update that represents the current state of the document.
     */
    getStateUpdate(): InstUpdate;

    /**
     * Applies the given updates to the document.
     * @param updates The updates to apply.
     */
    applyStateUpdates(updates: InstUpdate[]): void;
}

export type SharedType = SharedMap | SharedArray | SharedText;

export type SharedTypeChanges =
    | SharedMapChanges<any>
    | SharedArrayChanges<any>
    | SharedTextChanges;

export interface SharedTypeBase {
    /**
     * The document that the map is associated with.
     */
    readonly doc: SharedDocument;

    /**
     * The type that this map is stored in.
     */
    readonly parent: SharedType | null;
}

/**
 * Defines a map that can be shared between multiple clients.
 */
export interface SharedMap<T = any> extends SharedTypeBase {
    /**
     * Gets the number of keys that are in the map.
     */
    readonly size: number;

    /**
     * Sets the given key to the given value.
     * @param key The key to set.
     * @param value The value to set.
     */
    set(key: string, value: T): void;

    /**
     * Gets the value for the given key.
     * @param key The key to get.
     */
    get(key: string): T;

    /**
     * Deletes the given key from the map.
     * @param key Deletes the given key.
     */
    delete(key: string): void;

    /**
     * Determines if the given key exists in the map.
     * @param key The key.
     */
    has(key: string): boolean;

    /**
     * Clears the map.
     */
    clear(): void;

    /**
     * Creates a new map that is a clone of this map.
     */
    clone(): SharedMap;

    /**
     * Transforms this map into an object that can be serialized to JSON.
     */
    toJSON(): { [key: string]: T };

    /**
     * Execute the provided function once on every key/value pair.
     * @param callback The function to execute.
     */
    forEach(callback: (value: T, key: string, map: SharedMap<T>) => void): void;

    /**
     * Gets an iterator for the key/value pairs stored in the map.
     */
    [Symbol.iterator](): IterableIterator<[string, T]>;

    /**
     * Gets an iterator for the key/value pairs stored in the map.
     */
    entries(): IterableIterator<[string, T]>;

    /**
     * Gets an iterator for the keys stored in the map.
     */
    keys(): IterableIterator<string>;

    /**
     * Gets an iterator for the values stored in the map.
     */
    values(): IterableIterator<T>;

    /**
     * Gets an observable that resolves whenever the map is changed.
     */
    readonly changes: Observable<SharedMapChanges<T>>;

    /**
     * Gets an observable that resolves whenever this map or any children are changed.
     */
    readonly deepChanges: Observable<SharedTypeChanges[]>;
}

/**
 * Defines an array that can be shared between multiple clients.
 */
export interface SharedArray<T = any> extends SharedTypeBase {
    /**
     * Gets the number of elements in the array.
     */
    readonly length: number;

    /**
     * Gets the number of elements in the array.
     */
    readonly size: number;

    /**
     * Insert items at the given index.
     * @param index The index to insert the items at. Items at or after this index will be pushed back to make space for the new items. If the index is greater than the length of the array, then the items are appended to the end of the array.
     * @param items The items to insert.
     */
    insert(index: number, items: T[]): void;

    /**
     * Deletes the given number of items, starting at the given index.
     * @param index The index of the first item to be deleted.
     * @param count The number of items to delete.
     */
    delete(index: number, count: number): void;

    /**
     * Applies the given delta to the array.
     * @param delta The delta to apply.
     */
    applyDelta(delta: SharedArrayDelta<T>): void;

    /**
     * Append items to the end of the array.
     * @param items The items to add.
     */
    push(...items: T[]): void;

    /**
     * Removes the last item from the array and returns it.
     */
    pop(): T | undefined;

    /**
     * Prepend items to the beginning of the array.
     * @param items The items to add.
     */
    unshift(...items: T[]): void;

    /**
     * Removes the first item from the array and returns it.
     */
    shift(): T | undefined;

    /**
     * Gets the item at the given index.
     * @param index The index to get.
     */
    get(index: number): T;

    /**
     * Gets a range of items from the array.
     * Negative indexes can be used to start from the end of the array.
     * @param start The index of the first item to retrieve.
     * @param end The index of the last item to retrieve.
     */
    slice(start?: number, end?: number): T[];

    /**
     * Changes the contents of the array by removing or replacing existing elements and/or adding new elements.
     * Returns a JavaScript array containing the removed elements.
     * @param start The index at which to start changing the array.
     * @param deleteCount The number of elements in the array to remove from start.
     * @param items The elements to add to the array.
     */
    splice(start: number, deleteCount: number, ...items: T[]): T[];

    /**
     * Creates a new JavaScript array that is a clone of this array.
     */
    toArray(): T[];

    /**
     * Transforms this map into an array that can be serialized to JSON.
     */
    toJSON(): T[];

    /**
     * Execute the given callback function for each item in the array.
     * @param callback The function to execute.
     */
    forEach(
        callback: (value: T, index: number, array: SharedArray<T>) => void
    ): void;

    /**
     * Creates a new JavaScript array with the results of calling a provided function on every element in this array.
     * @param callback The function to execute.
     */
    map(callback: (value: T, index: number, array: SharedArray<T>) => T): T[];

    /**
     * Creates a new JavaScript array with all elements that pass the test implemented by the provided function.
     * @param predicate The function to execute.
     */
    filter(
        predicate: (value: T, index: number, array: SharedArray<T>) => boolean
    ): T[];

    /**
     * Gets an iterator for the items in the array.
     */
    [Symbol.iterator](): IterableIterator<T>;

    /**
     * Creates a new shared array that is a clone of this array.
     */
    clone(): SharedArray<T>;

    /**
     * Gets an observable that resolves whenever the array is changed.
     */
    readonly changes: Observable<SharedArrayChanges<T>>;

    /**
     * Gets an observable that resolves whenever this array or any children are changed.
     */
    readonly deepChanges: Observable<SharedTypeChanges[]>;
}

/**
 * Defines an object that represents rich text that can be shared between multiple clients.
 */
export interface SharedText extends SharedTypeBase {
    /**
     * Gets the length of the string in UTF-16 code units.
     */
    readonly length: number;

    /**
     * Insert text at the given index.
     * Optionally apply formatting to the inserted text.
     * @param index The index to insert the text at.
     * @param text The text to insert.
     * @param attribtues The formatting attributes to apply to the inserted text.
     */
    insert(index: number, text: string, attribtues?: Record<string, any>): void;

    /**
     * Deletes the given number of items, starting at the given index.
     * @param index The index of the first item to be deleted.
     * @param count The number of items to delete.
     */
    delete(index: number, count: number): void;

    /**
     * Applies the given delta to the text.
     * @param delta The delta to apply.
     */
    applyDelta(delta: SharedTextDelta): void;

    /**
     * Converts this text into a delta that can be applied to another text object.
     */
    toDelta(): SharedTextDelta;

    /**
     * Creates a relative position that is fixed to the code point at the given index.
     * @param index The index of the character to create the relative position for.
     * @param assoc The association of the relative position to the character. < 0 is before, >= 0 is after.
     */
    encodeRelativePosition(index: number, assoc?: number): RelativePosition;

    /**
     * Gets the index that the given relative position is associated with.
     * @param position The relative position to decode.
     */
    decodeRelativePosition(position: RelativePosition): number;

    /**
     * Gets a range of text from this object.
     * Negative indexes can be used to start from the end of the string.
     * @param start The index of the first code point to retrieve.
     * @param end The index of the last code point to retrieve.
     */
    slice(start?: number, end?: number): string;

    /**
     * Creates a new JavaScript string that is a clone of this text.
     */
    toString(): string;

    /**
     * Transforms this text into a string that can be serialized to JSON.
     */
    toJSON(): string;

    /**
     * Creates a new shared array that is a clone of this array.
     */
    clone(): SharedText;

    /**
     * Gets an observable that resolves whenever the array is changed.
     */
    readonly changes: Observable<SharedTextChanges>;

    /**
     * Gets an observable that resolves whenever this array or any children are changed.
     */
    readonly deepChanges: Observable<SharedTextChanges[]>;
}

export interface SharedMapChanges<T> {
    type: 'map';

    /**
     * The map that was changed.
     */
    target: SharedMap<T>;

    /**
     * The keys that were changed, along with their old values.
     */
    changes: Map<string, SharedMapChange<T>>;
}

export interface SharedMapChange<T> {
    /**
     * The action that caused this change.
     */
    action: 'add' | 'update' | 'delete';

    /**
     * The old value of the key.
     */
    oldValue: T | undefined;
}

export interface SharedArrayChanges<T> {
    type: 'array';

    /**
     * The array that was changed.
     */
    target: SharedArray<T>;

    /**
     * The changes that were made to the array.
     */
    delta: SharedArrayDelta<T>;
}

export type SharedArrayDelta<T> = SharedArrayOp<T>[];

export type SharedArrayOp<T> =
    | SharedArrayPreserveOp
    | SharedArrayInsertOp<T>
    | SharedArrayDeleteOp<T>;

export interface SharedArrayPreserveOp {
    type: 'preserve';

    /**
     * The number of items that were preserved.
     */
    count: number;
}

export interface SharedArrayInsertOp<T> {
    type: 'insert';

    /**
     * The values that were inserted.
     */
    values: T[];
}

export interface SharedArrayDeleteOp<T> {
    type: 'delete';

    /**
     * The number of items that were deleted.
     */
    count: number;
}

export interface SharedTextChanges {
    type: 'text';

    /**
     * The text that was changed.
     */
    target: SharedText;

    /**
     * The changes that were made to the array.
     */
    delta: SharedTextDelta;
}

export type SharedTextDelta = SharedTextOp[];

export type SharedTextOp =
    | SharedTextPreserveOp
    | SharedTextInsertOp
    | SharedTextDeleteOp;

export interface SharedTextPreserveOp {
    type: 'preserve';

    /**
     * The number of characters that were preserved.
     */
    count: number;
}

export interface SharedTextInsertOp {
    type: 'insert';

    /**
     * The text that was inserted.
     */
    text: string;

    /**
     * The formatting that was applied to the inserted text.
     */
    attributes: Record<string, any>;
}

export interface SharedTextDeleteOp {
    type: 'delete';

    /**
     * The number of items that were deleted.
     */
    count: number;
}

export interface RelativePosition {}

/**
 * Defines a record that represents a notification.
 * That is, a way for users to be notified of something.
 *
 * @dochash types/records/packages
 * @docName PackageRecord
 */
export interface PackageRecord {
    /**
     * The address of the package.
     */
    address: string;

    /**
     * The ID of the package.
     */
    id: string;
}

/**
 * The scopes that can be used for requested entitlements.
 * This can be used to limit the entitlement to requesting a category of resources.
 * For example, the "personal" scope would limit the entitlement to requesting access to the user's personal resources.
 *
 * - "personal" - The entitlement is for personal (user-specific) records. This would allow the package to request access to resources in the user's player record. Once granted, the package would have access to the user's personal record.
 * - "owned" - The entitlement is for user (user-owned) records. This would allow the package to request access to resources in a record that the user owns. Once granted, the package would have access to the user's owned records.
 * - "studio" - The entitlement is for studio records. This would allow the package to request access to resources in studios in which the user is an admin or member of.
 * - "shared" - The entitlement is for shared records. This would allow the package to request access to records that are either owned or granted to the user.
 * - "designated" - The entitlement is for specific records. This would allow the package to only request access to specific records.
 */
export type EntitlementScope =
    | 'personal'
    | 'owned'
    | 'studio'
    | 'shared'
    | 'designated';

/**
 * The feature categories that entitlements support.
 * Generally, features align with resource kinds, but don't have to.
 */
export type EntitlementFeature =
    | 'data'
    | 'file'
    | 'event'
    | 'inst'
    | 'notification'
    | 'package'
    | 'permissions'
    | 'webhook'
    | 'ai';

/**
 * Defines an interface that represents an entitlement.
 * That is, a feature that can be granted to a package but still requires user approval.
 *
 * In essence, this allows a package to ask the user for permission for a category of permissions.
 */
export interface Entitlement {
    /**
     * The feature category that the entitlement is for.
     * Generally, features align with resource kinds, but don't have to.
     */
    feature: EntitlementFeature;

    /**
     * The scope of the entitlement.
     * This can be used to limit the entitlement to a category of resources.
     * For example, the "personal" scope would limit the entitlement to requesting access to the user's personal resources.
     *
     *
     * - "personal" - The entitlement is for personal (user-specific) records. This would allow the package to request access to resources in the user's player record.
     * - "owned" - The entitlement is for user (user-owned) records. This would allow the package to request access to resources in a record that the user owns.
     * - "studio" - The entitlement is for studio records. This would allow the package to request access to resources in studios in which the user is an admin or member of.
     * - "shared" - The entitlement is for shared records. This would allow the package to request access to records that are either owned or granted to the user.
     * - "designated" - The entitlement is for specific records. This would allow the package to only request access to specific records.
     */
    scope: EntitlementScope;

    /**
     * The list of records that the entitlement is for.
     */
    designatedRecords?: string[];
}


export interface PackageVersion {
    /**
     * The major version of the package.
     */
    major: number;

    /**
     * The minor version of the package.
     */
    minor: number;

    /**
     * The patch version of the package.
     */
    patch: number;

    /**
     * The pre-release version of the package.
     * If empty or null, then this is a stable release.
     */
    tag: string | null;
}

export interface PackageRecordVersion {
    /**
     * The address that the item is stored under.
     */
    address: string;

    /**
     * The key of the item.
     */
    key: PackageVersion;

    /**
     * The ID of the package version.
     */
    id: string;

    /**
     * The name of the aux file that is stored for this version.
     */
    auxFileName: string;

    /**
     * Whether the aux file was created for this version.
     */
    createdFile: boolean;

    /**
     * The SHA-256 hash of the package version.
     */
    sha256: string;

    /**
     * The SHA-256 hash of the aux.
     */
    auxSha256: string;

    /**
     * The list of entitlements that the package requires.
     */
    entitlements: Entitlement[];

    /**
     * Whether the package version requires review.
     * Packages that do not require review are automatically approved and cannot have entitlements that require review.
     */
    requiresReview: boolean;

    /**
     * The description of the package.
     */
    description: string;

    /**
     * The size of the package version in bytes.
     */
    sizeInBytes: number;

    /**
     * The unix time in miliseconds that this package version was created at.
     */
    createdAtMs: number;

    /**
     * The markers for the package version.
     */
    markers: string[];
}

export interface PackageRecordVersionWithMetadata extends PackageRecordVersion {
    /**
     * The ID of the package that the version is stored under.
     */
    packageId: string;

    /**
     * Whether the package version has been approved.
     * If true, then the package either has been manually approved or does not require approval.
     */
    approved: boolean;

    /**
     * The type of approval that was given to the package.
     *
     * - null means that the package has not been approved.
     * - "normal" means that the package was approved by the reviewer, but that individual permissions still need to be approved by the user.
     * - "super" means that the package was approved by the reviewer and that individual permissions will not need to be approved by the user.
     */
    approvalType: null | 'normal' | 'super';
}

/**
 * Defines an interface that represents a package version key specifier.
 * That is, a way to identify a package version by its key.
 */
export interface PackageRecordVersionKeySpecifier {
    /**
     * The major number of the version to load.
     * If omitted, then the latest major version will be loaded.
     */
    major?: number;

    /**
     * The minor number of the version to load.
     * If not specifed, then the latest minor version will be loaded.
     */
    minor?: number;

    /**
     * The patch number of the version to load.
     * If not specified, then the latest patch version will be loaded.
     */
    patch?: number;

    /**
     * The tag of the version to load.
     * If not specified, then the untagged version will be loaded.
     */
    tag?: string | null;

    /**
     * The SHA-256 hash of the version to load.
     * If not specified, then the SHA-256 will not be checked.
     * If specified, then the SHA-256 will be checked against the version that is loaded.
     */
    sha256?: string | null;
}


export type InstallPackageResult =
    | InstallPackageSuccess
    | InstallPackageFailure;
export interface InstallPackageSuccess {
    success: true;

    /**
     * The ID of the record which records that the package was loaded into the inst.
     * Null if the inst is a local inst.
     */
    packageLoadId: string | null;

    /**
     * The package that was loaded.
     */
    package: PackageRecordVersionWithMetadata;
}

export interface InstallPackageFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}


export interface LoadedPackage {
    /**
     * The ID of the loaded package.
     */
    id: string;

    /**
     * The name of the record that the inst is stored in.
     * If null, then the inst is a public inst.
     */
    recordName: string | null;

    /**
     * The name of the inst that the package was loaded into.
     */
    inst: string;

    /**
     * The branch that the package was installed into.
     */
    branch: string;

    /**
     * The ID of the user that loaded the package.
     */
    userId: string | null;

    /**
     * The ID of the pacakge that was loaded.
     */
    packageId: string;

    /**
     * The ID of the package version that was loaded.
     */
    packageVersionId: string;
}

export type ListInstalledPackagesResult =
    | ListInstalledPackagesRequestSuccess
    | ListInstalledPackagesFailure;

export interface ListInstalledPackagesRequestSuccess {
    success: true;
    packages: LoadedPackage[];
}

export interface ListInstalledPackagesFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}

/**
 * The scopes that can be granted for entitlements.
 * Compared to the requested entitlement scopes, the granted entitlement scopes are more restrictive.
 *
 * This ultimately means that while a package can have the ability to request access to a bunch of different records,
 * they can only be granted access to a single record at once (for now).
 *
 * - "designated" - The entitlement is for specific records. This would allow the package to access specific records.
 */
export type GrantedEntitlementScope = 'designated';

/**
 * Defines a request that grants a package entitlements to access a record.
 *
 * @dochash types/records/packages
 * @docname GrantEntitlementsRequest
 */
export interface GrantEntitlementsRequest {
    /**
     * The ID of the package that should be granted entitlements.
     */
    packageId: string;

    /**
     * The scope that the entitlements should have.
     */
    scope: GrantedEntitlementScope;

    /**
     * The name of the record that the entitlements cover.
     */
    recordName: string;

    /**
     * The time that the entitlements should expire.
     */
    expireTimeMs: number;

    /**
     * The features that should be granted.
     */
    features: EntitlementFeature[];
}

export type GrantEntitlementsResult =
    | GrantEntitlementFailure
    | GrantEntitlementsSuccess;

export interface GrantEntitlementsSuccess {
    success: true;

    grantedEntitlements: {
        grantId: string;
        feature: EntitlementFeature;
    }[];
}

export interface GrantEntitlementFailure {
    success: false;
    errorCode: KnownErrorCodes;
    errorMessage: string;
}


export interface RecordPackageVersionApiRequest {
    /**
     * The name of the record that the package version should be recorded to.
     */
    recordName: string;

    /**
     * The address that the package version should be recorded to.
     */
    address: string;

    /**
     * The version of the package that should be recorded.
     */
    key: PackageVersion;

    /**
     * The description that should be included in the package version.
     */
    description: string;

    /**
     * The list of entitlements for the package version.
     * If omitted, then the package version will be recorded without any entitlements.
     */
    entitlements?: Entitlement[];

    /**
     * The bots that should be saved to the package.
     */
    bots: Bot[];

    /**
     * The markers that should be applied to the package version.
     */
    markers?: string[];
}


export type RecordPackageVersionResult =
    | RecordPackageVersionSuccess
    | CrudRecordItemFailure;

export interface RecordPackageVersionSuccess extends CrudRecordItemSuccess {
    /**
     * The result of recording the aux file.
     */
    auxFileResult: RecordFileResult;
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
 * The function signature of a dynamic bot listener.
 *
 * That is, a listener that is registered at runtime by a user script instead of parsed from a tag.
 *
 * @dochash types/core
 * @docgroup 01-core
 * @docname Listener
 * @docid DynamicListener
 */
export type DynamicListener = (
    that: any,
    bot: Bot,
    tagName: string
) => any;

interface Ai {
    /**
     * Sends a chat message to the AI.
     * Returns a promise that contains the response from the AI.
     * Throws a {@link CasualOSError} if an error occurs while sending the message.
     *
     * This function can be useful for creating chat bots, or for using an Artificial Intelligence (AI) to process a message.
     *
     * @param message The message that should be sent to the AI.
     * @param options The options that should be used.
     *
     * @example Send a message to the AI and log the response.
     * const response = await ai.chat("Hello!");
     * console.log(response);
     *
     * @dochash actions/ai
     * @doctitle AI Actions
     * @docsidebar AI
     * @docdescription AI actions are functions that make it easier to work with the AI.
     * @docname ai.chat
     * @docid ai.chat-string
     */
    chat(message: string, options?: AIChatOptions): Promise<string>;

    /**
     * Sends a chat message to the AI.
     * Returns a promise that contains the response from the AI.
     * Throws a {@link CasualOSError} if an error occurs while sending the message.
     *
     * This function can be useful for creating chat bots, or for using an Artificial Intelligence (AI) to process a message.
     *
     * @param message The message that should be sent to the AI.
     * @param options The options that should be used.
     *
     * @example Send a message to the AI and log the response.
     * const response = await ai.chat({
     *     role: "user",
     *     content: "Hello!"
     * });
     * console.log(`${response.role}: ${response.content}`);
     *
     * @dochash actions/ai
     * @docname ai.chat
     * @docid ai.chat-message
     */
    chat(
        message: AIChatMessage,
        options?: AIChatOptions
    ): Promise<AIChatMessage>;

    /**
     * Sends a chat message to the AI.
     * Returns a promise that contains the response from the AI.
     * Throws a {@link CasualOSError} if an error occurs while sending the message.
     *
     * This function can be useful for creating chat bots, or for using an Artificial Intelligence (AI) to process a message.
     *
     * @param message The message that should be sent to the AI.
     * @param options The options that should be used.
     *
     * @example Send a message to the AI and log the response.
     * const response = await ai.chat([
     *      {
     *          role: "system",
     *          content: "You are a helpful assistant."
     *      },
     *     {
     *          role: "user",
     *          content: "Hello!"
     *     }
     * ]);
     * console.log(`${response.role}: ${response.content}`);
     *
     * @example Build a basic chat bot.
     * const messages = [
     *      {
     *          role: "system",
     *          content: "You are a helpful assistant."
     *      },
     * ];
     *
     * while(true) {
     *      const userInput = await os.showInput();
     *      if (!userInput) {
     *          break;
     *      }
     *      messages.push({
     *          role: "user",
     *          content: userInput
     *      });
     *
     *      const response = await ai.chat(messages);
     *      messages.push(response);
     *      os.toast(response.content);
     * }
     *
     * os.toast("Goodbye!");
     *
     * @dochash actions/ai
     * @docname ai.chat
     * @docid ai.chat-messages
     */
    chat(
        messages: AIChatMessage[],
        options?: AIChatOptions
    ): Promise<AIChatMessage>;

    /**
     * Sends a chat message to the AI.
     * Returns a promise that contains the response from the AI.
     * Throws a {@link CasualOSError} if an error occurs while sending the message.
     *
     * This function can be useful for creating chat bots, or for using an Artificial Intelligence (AI) to process a message.
     *
     * @param message The message that should be sent to the AI.
     * @param options The options that should be used.
     *
     * @example Send a message to the AI and log the response.
     * const response = await ai.chat([
     *      {
     *          role: "system",
     *          content: "You are a helpful assistant."
     *      },
     *     {
     *          role: "user",
     *          content: "Hello!"
     *     }
     * ]);
     * console.log(`${response.role}: ${response.content}`);
     *
     * @example Build a basic chat bot.
     * const messages = [
     *      {
     *          role: "system",
     *          content: "You are a helpful assistant."
     *      },
     * ];
     *
     * while(true) {
     *      const userInput = await os.showInput();
     *      if (!userInput) {
     *          break;
     *      }
     *      messages.push({
     *          role: "user",
     *          content: userInput
     *      });
     *
     *      const response = await ai.chat(messages);
     *      messages.push(response);
     *      os.toast(response.content);
     * }
     *
     * os.toast("Goodbye!");
     *
     * @dochash actions/ai
     * @docname ai.chat
     * @docid ai.chat-messages
     */
    chat(
        messages: string | AIChatMessage | AIChatMessage[],
        options?: AIChatOptions
    ): Promise<AIChatMessage | string>;

    /**
     * Generates a [skybox image](https://en.wikipedia.org/wiki/Skybox_%28video_games%29) from the given prompt.
     * 
     * Returns a promise that resolves with a URL to the generated image that can be used as the {@tag formAddress} of a bot that has {@tag form} set to `skybox`.
     * 
     * @param prompt the string that describes what the skybox should look like.
     * @param negativePrompt the string that describes what the skybox should avoid looking like.
     * @param options the additional options that should be used.
     * 
     * @example Generate a skybox from a prompt.
     * const skybox = await ai.generateSkybox("A skybox with a blue sky and green grass.");
     * masks.formAddress = skybox;
     * 
     * @example Generate a skybox from a prompt and a negative prompt
     * const skybox = await ai.generateSkybox("A skybox with a blue sky and green grass.", "A skybox with a red sky and brown grass.");
     * masks.formAddress = skybox;
     * 
     * @dochash actions/ai
     * @docname ai.generateSkybox
     * @docid ai.generateSkybox-string
     */
    generateSkybox(prompt: string, negativePrompt?: string, options?: AIGenerateSkyboxOptions): Promise<string>;

    /**
     * Generates a [skybox image](https://en.wikipedia.org/wiki/Skybox_%28video_games%29) from the given request object.
     * 
     * Returns a promise that resolves with an object that contains a URL to the generated image that can be used as the {@tag formAddress} of a bot that has {@tag form} set to `skybox`.
     * 
     * @param request the request object that describes what the skybox should look like.
     * 
     * @example Generate a skybox from a prompt.
     * const skybox = await ai.generateSkybox("A skybox with a blue sky and green grass.");
     * masks.formAddress = skybox;
     * 
     * @example Generate a skybox from a prompt and a negative prompt
     * const skybox = await ai.generateSkybox("A skybox with a blue sky and green grass.", "A skybox with a red sky and brown grass.");
     * masks.formAddress = skybox;
     * 
     * @dochash actions/ai
     * @docname ai.generateSkybox
     * @docid ai.generateSkybox-request
     */
    generateSkybox(request: AIGenerateSkyboxRequest): Promise<AIGenerateSkyboxResult>;

    /**
     * Generates a [skybox image](https://en.wikipedia.org/wiki/Skybox_%28video_games%29) from the given request object.
     * 
     * Returns a promise that resolves with an object that contains a URL to the generated image that can be used as the {@tag formAddress} of a bot that has {@tag form} set to `skybox`.
     * 
     * @param request the request object that describes what the skybox should look like.
     * @param negativePrompt the string that describes what the skybox should avoid looking like.
     * @param options the additional options that should be used.
     * 
     * @example Generate a skybox from a prompt.
     * const skybox = await ai.generateSkybox("A skybox with a blue sky and green grass.");
     * masks.formAddress = skybox;
     * 
     * @example Generate a skybox from a prompt and a negative prompt
     * const skybox = await ai.generateSkybox("A skybox with a blue sky and green grass.", "A skybox with a red sky and brown grass.");
     * masks.formAddress = skybox;
     * 
     * @dochash actions/ai
     * @docname ai.generateSkybox
     * @docid ai.generateSkybox-request
     */
    generateSkybox(prompt: string | AIGenerateSkyboxRequest, negativePrompt?: string, options?: AIGenerateSkyboxOptions): Promise<string | AIGenerateSkyboxResult>

    /**
     * Generates an image from the given prompt.
     *
     * Returns a promise that resolves with the Base64 data of the generated image that can be used as the {@tag formAddress} of a bot.
     *
     * @param prompt the string that describes what the image should look like.
     * @param negativePrompt the string that describes what the image should avoid looking like.
     * @param options the additional options that should be used.
     *
     * @example Generate an image from a prompt.
     * const image = await ai.generateImage("An oil painting of a grassy field.");
     * masks.formAddress = image;
     *
     * @example Generate a image from a prompt and a negative prompt
     * const image = await ai.generateSkybox("An oil painting of a grassy field.", "realistic");
     * masks.formAddress = image;
     *
     * @dochash actions/ai
     * @docname ai.generateImage
     * @docid ai.generateImage-string
     */
    generateImage(
        prompt: string,
        negativePrompt?: string,
        options?: AIGenerateSkyboxOptions & RecordActionOptions
    ): Promise<string>;

    /**
     * Generates an image from the given prompt.
     *
     * Returns a promise that resolves with the Base64 data of the generated image that can be used as the {@tag formAddress} of a bot.
     *
     * @param request the request object that describes what the image should look like.
     * @param options the options for the request.
     *
     * @example Generate an image from a prompt.
     * const image = await ai.generateImage({
     *     prompt: "An oil painting of a grassy field.",
     * });
     * masks.formAddress = image;
     *
     * @example Generate a image from a prompt and a negative prompt
     * const image = await ai.generateSkybox({
     *     prompt: "An oil painting of a grassy field.",
     *     negativePrompt: "realistic"
     * });
     * masks.formAddress = image;
     *
     * @dochash actions/ai
     * @docname ai.generateImage
     * @docid ai.generateImage-request
     */
    generateImage(
        request: AIGenerateImageOptions,
        options?: RecordActionOptions
    ): Promise<AIGenerateImageSuccess>;

    generateImage(
        prompt: string | AIGenerateImageOptions,
        negativePrompt?: string | RecordActionOptions,
        options?: RecordActionOptions
    ): Promise<string | AIGenerateImageSuccess>;

    hume: {
        /**
         * Gets an access token for the Hume AI API.
         * Returns a promise that resolves with the access token.
         * 
         * @example Get an access token for the Hume AI API.
         * const accessToken = await ai.hume.getAccessToken();
         *
         * @dochash actions/ai
         * @docname ai.hume.getAccessToken
         */
        getAccessToken(): Promise<AIHumeGetAccessTokenResult>;
    }

    sloyd: {
        /**
         * Generates a new 3D model using [sloyd.ai](https://www.sloyd.ai/).
         * @param request The options for the 3D model.
         * @param options The options for the request.
         */
        generateModel(request: AISloydGenerateModelOptions, options?: RecordActionOptions): Promise<AISloydGenerateModelResponse>;
    }

    openai: {
        /**
         * Creates a new OpenAI Realtime Session.
         * @param recordName The name of the record that the session is for.
         * @param request The request options for the session.
         * @param options The options for the records request.
         * 
         * @dochash actions/ai
         * @docname ai.openai.createRealtimeSession
         */
        createRealtimeSession(
            recordName: string,
            request: CreateRealtimeSessionTokenRequest,
            options?: RecordActionOptions
        ): Promise<AICreateOpenAIRealtimeSessionTokenResult>;
    }

    stream: {
        /**
         * Sends a chat message to the AI and streams the response back.
         * Returns a promise that resolves with an [async iterable](https://javascript.info/async-iterators-generators#async-iterables) that contains the responses from the AI.
         * 
         * Throws a {@link CasualOSError} if an error occurs while sending the message.
         *
         * This function can be useful for creating chat bots, or for using an Artificial Intelligence (AI) to process a message.
         *
         * @param message The message that should be sent to the AI.
         * @param options The options that should be used.
         *
         * @example Send a message to the AI and log the response.
         * const response = await ai.stream.chat("Hello!");
         * 
         * for await (let message of response) {
         *    console.log(message);
         * }
         *
         * @dochash actions/ai
         * @doctitle AI Actions
         * @docsidebar AI
         * @docdescription AI actions are functions that make it easier to work with the AI.
         * @docname ai.stream.chat
         * @docid ai.stream.chat-string
         */
        chat(message: string, options?: AIChatOptions): Promise<AsyncIterable<string>>;

        /**
         * Sends a chat message to the AI and streams the response back.
         * Returns a promise that resolves with an [async iterable](https://javascript.info/async-iterators-generators#async-iterables) that contains the responses from the AI.
         * 
         * Throws a {@link CasualOSError} if an error occurs while sending the message.
         *
         * This function can be useful for creating chat bots, or for using an Artificial Intelligence (AI) to process a message.
         *
         * @param message The message that should be sent to the AI.
         * @param options The options that should be used.
         *
         * @example Send a message to the AI and log the response.
         * const response = await ai.chat({
         *     role: "user",
         *     content: "Hello!"
         * });
         * console.log(`${response.role}: ${response.content}`);
         *
         * @example Ask the AI to describe an uploaded image.
         * const files = await os.showUploadFiles();
         * const firstFile = files[0];
         * const base64 = bytes.toBase64String(new Uint8Array(firstFile.data));
         * const response = await ai.stream.chat({
         *    role: 'user',
         *    content: [
         *        {
         *            base64: base64,
         *            mimeType: firstFile.mimeType,
         *        },
         *        {
         *            text: 'please describe the image'
         *        }
         *    ]
         * }, {
         *    preferredModel: 'gemini-pro-vision'
         * });
         * 
         * for await (let message of response) {
             os.toast(message.content);
        * }
        *
        * @dochash actions/ai
        * @docname ai.stream.chat
        * @docid ai.stream.chat-message
        */
        chat(
            message: AIChatMessage,
            options?: AIChatOptions
        ): Promise<AsyncIterable<AIChatMessage>>;

        /**
         * Sends a chat message to the AI.
         * Returns a promise that resolves with an [async iterable](https://javascript.info/async-iterators-generators#async-iterables) that contains the responses from the AI.
         * 
         * Throws a {@link CasualOSError} if an error occurs while sending the message.
         *
         * This function can be useful for creating chat bots, or for using an Artificial Intelligence (AI) to process a message.
         *
         * @param message The message that should be sent to the AI.
         * @param options The options that should be used.
         *
         * @example Send a message to the AI and log the response.
         * const response = await ai.stream.chat([
         *      {
         *          role: "system",
         *          content: "You are a helpful assistant."
         *      },
         *     {
         *          role: "user",
         *          content: "Hello!"
         *     }
         * ]);
         * 
         * for await (let message of response) {
         *    console.log(`${message.role}: ${message.content}`);
         * }
         *
         * @example Build a basic chat bot.
         * const messages = [
         *      {
         *          role: "system",
         *          content: "You are a helpful assistant."
         *      },
         * ];
         *
         * while(true) {
         *      const userInput = await os.showInput();
         *      if (!userInput) {
         *          break;
         *      }
         *      messages.push({
         *          role: "user",
         *          content: userInput
         *      });
         *
         *      const response = await ai.stream.chat(messages);
         * 
         *      for await (let message of response) {
         *          messages.push(message);
         *          os.toast(message.content);
         *      }
         * }
         *
         * os.toast("Goodbye!");
         *
         * @example Ask the AI to describe an uploaded image.
         * const files = await os.showUploadFiles();
         * const firstFile = files[0];
         * const base64 = bytes.toBase64String(new Uint8Array(firstFile.data));
         * const response = await ai.stream.chat([{
         *    role: 'user',
         *    content: [
         *        {
         *            base64: base64,
         *            mimeType: firstFile.mimeType,
         *        },
         *        {
         *            text: 'please describe the image'
         *        }
         *    ]
         * }], {
         *    preferredModel: 'gemini-pro-vision'
         * });
         *
         * for await (let message of response) {
             os.toast(message.content);
        * }
        *
        * @dochash actions/ai
        * @docname ai.stream.chat
        * @docid ai.stream.chat-messages
        */
        chat(
            messages: AIChatMessage[],
            options?: AIChatOptions
        ): Promise<AsyncIterable<AIChatMessage>>;

        chat(
            messages: string | AIChatMessage | AIChatMessage[],
            options?: AIChatOptions
        ): Promise<AsyncIterable<AIChatMessage | string>>;
    }
}

interface Os {

    /**
     * Adds the given listener to the given bot for the given tag.
     * 
     * @param bot The bot that the listener should be added to.
     * @param tagName The name of the tag that the listener should be added to.
     * @param listener The listener that should be added to the bot.
     * 
     * @dochash actions/os/event
     * @docgroup 02-event-actions
     * @docname os.addBotListener
     * @docid os.addBotListener
     */
    addBotListener(bot: Bot, tagName: string, listener: DynamicListener): void;
    
    /**
     * Removes the given listener from a bot for a specific tag.
     * @param bot The bot that the listener should be removed from.
     * @param tagName The name of the tag that the listener should be removed from.
     * @param listener The listener that should be removed from the bot.
     * 
     * @dochash actions/os/event
     * @docgroup 02-event-actions
     * @docname os.removeBotListener
     * @docid os.removeBotListener
     */
    removeBotListener(bot: Bot, tagName: string, listener: DynamicListener): void;

    /**
         * Sleeps for time in ms.
         * @param time Time in ms. 1 second is 1000ms.
         */
    sleep(time: number): Promise<void>;

    /**
     * Derermines whether the player is in the given dimension.
     * @param dimension The dimension.
     */
    isInDimension(dimension: string): string;

    /**
     * Redirects the user to the given dimension.
     * @param dimension The dimension to go to.
     *
     * @example
     * // Send the player to the "welcome" dimension.
     * os.goToDimension("welcome");
     */
    goToDimension(dimension: string): GoToDimensionAction;

    /**
     * Instructs CasualOS to open the built-in developer console.
     * The dev console provides easy access to error messages and debug logs for formulas and actions.
     */
    openDevConsole(): OpenConsoleAction;

    /**
     * Changes the state that the given bot is in.
     * @param bot The bot to change.
     * @param stateName The state that the bot should move to.
     * @param groupName The group of states that the bot's state should change in. (Defaults to "state")
     */
    changeState(bot: Bot, stateName: string, groupName?: string): void;

    /**
     * Enables Augmented Reality features.
     * @param options The options that should be used for the AR session.
     */
    enableAR(options?: EnableXROptions): EnableARAction;

    /**
     * Enables Virtual Reality features.
     * @param options The options that should be used for the VR session.
     */
    enableVR(options?: EnableXROptions): EnableVRAction;

    /**
     * Disables Augmented Reality features.
     */
    disableAR(): EnableARAction;

    /**
     * Disables Virtual Reality features.
     */
    disableVR(): EnableVRAction;

    /**
     * Promise that returns wether or not AR is supported on the device.
     */
    arSupported(): Promise<boolean>;

    /**
     * Promise that returns wether or not VR is supported on the device.
     */
    vrSupported(): Promise<boolean>;

    /**
     * Enables Point-of-View mode.
     * @param center The position that the camera should be placed at. Defaults to (0,0,0)
     * @param imu Whether to use the imuPortal to control the camera rotation while in POV mode. Defaults to false.
     */
    enablePointOfView(center?: Point3D, imu?: boolean): EnablePOVAction;

    /**
     * Disables Point-of-View mode.
     */
    disablePointOfView(): EnablePOVAction;

    /**
     * Requests a wake lock that will keep the device screen awake.
     */
    requestWakeLock(): Promise<void>;

    /**
     * Disables the wake lock.
     */
    disableWakeLock(): Promise<void>;

    /**
     * Retrieves the current wake lock configuration.
     */
    getWakeLockConfiguration(): Promise<WakeLockConfiguration>;

    /**
     * Gets the dimension that is loaded into the given portal for the player.
     * If no dimension is loaded, then null is returned.
     * @param portal The portal type.
     */
    getPortalDimension(portal: PortalType): string;

    /**
     * Gets information about the version of AUX that is running.
     */
    version(): AuxVersion;

    /**
     * Gets information about the device that the player is using.
     */
    device(): AuxDevice;

    /**
     * Gets whether this device has enabled collaborative features.
     */
    isCollaborative(): boolean;

    /**
     * Attempts to enable collaboration features on the device.
     *
     * @example Enable collaboration on this device.
     * await os.enableCollaboration();
     *
     * @dochash actions/os/spaces
     * @docname os.enableCollaboration
     * @docgroup 10-os-info
     */
    enableCollaboration(): Promise<void>;

    /**
     * Attempts to show the "Account Info" dialog.
     * Does nothing if the user is not logged in.
     * 
     * @example Show the "Account Info" dialog.
     * await os.showAccountInfo();
     * 
     * @dochash actions/os/system
     * @docname os.showAccountInfo
     */
    showAccountInfo(): Promise<void>;

    /**
     * Gets media permission for the device.
     * Promise will resolve if permission was granted, otherwise an error will be thrown.
     */
    getMediaPermission(options: { audio?: boolean, video?: boolean }): Promise<void>;

    /**
     * Gets the current average frame rate for the 3D portals in seconds.
     * @returns A promise that resolves with the number of frames over the last second.
     */
    getAverageFrameRate(): Promise<number>;

    /**
     * Attempts to join the given meeting room.
     * @param roomName The name of the meeting room to join.
     * @param options The options for the meeting.
     */
    joinRoom(roomName: string, options?: JoinRoomActionOptions): Promise<JoinRoomResult>;

     /**
      * Attempts to leave the given meeting room.
      * @param roomName The name of the meeting room to leave.
      * @param options The options.
      */
    leaveRoom(roomName: string, options?: LeaveRoomActionOptions): Promise<LeaveRoomResult>;

    /**
     * Attempts to set the options for the given meeting room.
     * Useful for enabling/disabling video, audio, and screensharing.
     * @param roomName The name of the room.
     * @param options The options to set. Omitted properties remain unchanged.
     */
    setRoomOptions(roomName: string, options: Partial<RoomOptions>): Promise<SetRoomOptionsResult>;

    /**
     * Gets the options for the given meeting room.
     * Returns a promise that resolves with the options.
     * @param roomName The name of the room that the options should be retrieved for.
     */
    getRoomOptions(roomName: string): Promise<GetRoomOptionsResult>;

    /**
     * Gets the options for the track with the given address in the given room.
     * @param roomName The name of the room.
     * @param address The address of the track that the options should be retrieved for.
     */
    getRoomTrackOptions(roomName: string, address: string): Promise<GetRoomTrackOptionsResult>;

    /**
     * Sets the options for the track with the given address in the given room.
     * @param roomName The name of the room.
     * @param address The address of the track that the options should be retrieved for.
     * @param options The options that should be set for the track.
     */
    setRoomTrackOptions(roomName: string, address: string, options: SetRoomTrackOptions): Promise<SetRoomTrackOptionsResult>;

    /**
     * Gets the options for the specified remote user in the specified room.
     * @param roomName The name of the room.
     * @param remoteId The ID of the remote user.
     */
    getRoomRemoteOptions(roomName: string, remoteId: string): Promise<GetRoomRemoteOptionsResult>;

    /**
     * Gets the URL that AB1 should be bootstrapped from.
     */
    getAB1BootstrapURL(): string;

    /**
     * Gets whether the player is in the sheet dimension.
     */
    inSheet(): boolean;

    /**
     * Gets the 3D position of the player's camera.
     * @param portal The portal that the camera position should be retrieved for.
     */
    getCameraPosition(portal?: 'grid' | 'miniGrid'): Vector3;

    /**
     * Gets the 3D rotation of the player's camera.
     * @param portal The portal that the camera rotation should be retrieved for.
     */
    getCameraRotation(portal?: 'grid' | 'miniGrid'): Point3D;

    /**
     * Gets the 3D point that the player's camera is focusing on.
     * @param portal The portal that the camera focus point should be retrieved for.
     */
    getFocusPoint(portal?: 'grid' | 'miniGrid'): Vector3;

    /**
     * Gets the 3D position of the player's pointer.
     * @param pointer The position of the pointer to retrieve.
     */
    getPointerPosition(pointer?: 'mouse' | 'left' | 'right'): Vector3;

    /**
     * Gets the 3D rotation of the player's pointer.
     * @param pointer The rotation of the pointer to retrieve.
     */
    getPointerRotation(pointer?: 'mouse' | 'left' | 'right'): Point3D;

    /**
     * Gets the 3D direction that the given pointer is pointing in.
     * @param pointer The pointer to get the direction of.
     */
    getPointerDirection(pointer?: 'mouse' | 'left' | 'right'): Vector3;

    /**
     * Gets the input state of the given button on the mouse.
     * @param controller The name of the controller that should be checked.
     * @param button The name of the button on the controller.
     */
    getInputState(controller: 'mousePointer', button: 'left' | 'right' | 'middle'): null | 'down' | 'held';

    /**
     * Gets the input state of the given button on the left or right controller.
     * @param controller The name of the controller that should be checked.
     * @param button The name of the button on the controller.
     */
    getInputState(controller: 'leftPointer' | 'rightPointer', button: 'primary' | 'squeeze'): null | 'down' | 'held';

    /**
     * Gets the input state of the given button on the keyboard.
     * @param controller The name of the controller that should be checked.
     * @param button The name of the button on the controller.
     */
    getInputState(controller: 'keyboard', button: string): null | 'down' | 'held';

    /**
     * Gets the input state of the given touch.
     * @param controller The name of the controller that should be checked.
     * @param button The index of the finger.
     */
    getInputState(controller: 'touch', button: '0' | '1' | '2' | '3' | '4'): null | 'down' | 'held';

    /**
     * Gets the input state of the given button on the given controller.
     * @param controller The name of the controller that should be checked.
     * @param button The name of the button on the controller.
     */
    getInputState(controller: string, button: string): null | 'down' | 'held';

    /**
     * Gets the list of inputs that are currently available.
     */
    getInputList(): string[];

    /**
     * Shows a toast message to the user.
     * @param message The message to show.
     * @param duration The number of seconds the message should be on the screen. (Defaults to 2)
     */
    toast(message: string | number | boolean | object | Array<any> | null, duration?: number): ShowToastAction;

    /**
     * Shows a tooltip message to the user.
     * @param message The message to show.
     * @param pixelX The X coordinate that the tooltip should be shown at. If null, then the current pointer position will be used.
     * @param pixelY The Y coordinate that the tooltip should be shown at. If null, then the current pointer position will be used.
     * @param duration The duration that the tooltip should be shown in seconds.
     */
    tip(message: string | number | boolean | object | Array<any> | null, pixelX?: number, pixelY?: number, duration?: number): Promise<number>;

    /**
     * Hides the given list of tips.
     * If no tip IDs are provided, then all tips will be hidden.
     * @param tipIds 
     * @returns 
     */
    hideTips(tipIds?: number | number[]): Promise<void>;

    /**
     * Play the given url's audio.
     * Returns a promise that resolves with the sound ID when the sound starts playing.
     * @param url The URL to play.
     * 
     * @example
     * // Play a cow "moo"
     * os.playSound("https://freesound.org/data/previews/58/58277_634166-lq.mp3");
     */
    playSound(url: string): Promise<string>;

    /**
     * Preloads the audio for the given URL.
     * Returns a promise that resolves when the audio has finished loading.
     * @param url The URl to preload.
     * 
     * @example
     * // Preload a cow "moo"
     * os.bufferSound("https://freesound.org/data/previews/58/58277_634166-lq.mp3");
     */
    bufferSound(url: string): Promise<void>;

    /**
     * Cancels the sound with the given ID.
     * Returns a promise that resolves when the audio has been canceled.
     * @param soundID The ID of the sound that is being canceled.
     *
     * @example
     * // Play and cancel a sound
     * const id = await os.playSound("https://freesound.org/data/previews/58/58277_634166-lq.mp3");
     * os.cancelSound(id);
     */
    cancelSound(soundID: number): Promise<void>;

    /**
     * Starts a new audio recording.
     * @param options The options that should be used to record the audio.
     */
    beginAudioRecording(options?: AudioRecordingOptions): Promise<void>;

    /**
     * Finishes an audio recording.
     * Returns a promise that resolves with the recorded blob.
     * If the recording was streamed, then the resolved blob will be null.
     */
    endAudioRecording(): Promise<Blob>;

    /**
     * Sends a command to the Jitsi Meet API.
     * See https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe/#commands for a list of commands.
     * 
     * Returns a promise that resolves when the command has been executed.
     * @param command The name of the command to execute.
     * @param args The arguments for the command (if any).
     */
    meetCommand(command: string, ...args: any[]): Promise<void>;

    /**
     * Executes the given function from the Jitsi Meet API and returns a promise with the result.
     * See https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe/#functions for a list of functions.
     * @param functionName The name of the function to execute.
     * @param args The arguments to provide to the function.
     */
    meetFunction(functionName: string, ...args: any[]): Promise<any>;

    /**
     * Shows a QR Code that contains a link to a inst and dimension.
     * @param inst The inst that should be joined. Defaults to the current inst.
     * @param dimension The dimension that should be joined. Defaults to the current dimension.
     */
    showJoinCode(
        inst?: string,
        dimension?: string
    ): ShowJoinCodeAction;

    /**
     * Requests that AUX enters fullscreen mode.
     * Depending on the web browser, this may ask the player for permission.
     */
    requestFullscreenMode(): RequestFullscreenAction;

    /**
     * Exits fullscreen mode.
     */
    exitFullscreenMode(): ExitFullscreenAction;

    /**
     * Shares some information via the device's social sharing functionality.
     * @param options The options.
     */
    share(options: ShareOptions): ShareAction;

    /**
     * Closes the circle wipe transition effect.
     * @param options The options that should be used for the effect.
     */
    closeCircleWipe(options?: Partial<OpenCircleWipeOptions>): Promise<void>;

    /**
     * Opens the circle wipe transition effect.
     * @param options The options that should be used for the effect.
     */
    openCircleWipe(options?: Partial<OpenCircleWipeOptions>): Promise<void>;

    /**
     * Adds the given list of snap targets to the current drag operation.
     * @param targets The list of targets to add.
     */
    addDropSnap(...targets: SnapTarget[]): AddDropSnapTargetsAction;

    /**
     * Adds the given list of snap targets for when the specified bot is being dropped on.
     * @param bot The bot.
     * @param targets The targets that should be enabled when the bot is being dropped on.
     */
    addBotDropSnap(bot: Bot | string, ...targets: SnapTarget[]): AddDropSnapTargetsAction;

    /**
     * Adds the given list of grids to the current drag operation.
     * @param targets The list of grids to add.
     */
    addDropGrid(...targets: SnapGridTarget[]): AddDropGridTargetsAction;

    /**
     * Adds the given list of grids to the current drag operation for when the specified bot is being dropped on.
     * @param bot The bot.
     * @param targets The list of grids to add.
     */
    addBotDropGrid(bot: Bot | string, ...targets: SnapGridTarget[]): AddDropGridTargetsAction;

    /**
     * Enables custom dragging for the current drag operation.
     * This will disable the built-in logic that moves the bot(s) and
     * enables the "onDragging" and "onAnyBotDragging" listen tags.
     */
    enableCustomDragging(): EnableCustomDraggingAction;

    /**
     * Logs the given data to the developer console.
     * @param args The data to log.
     */
    log(...args: any[]): void;

    /**
     * Gets the geolocation of the device.
     * Returns a promise that resolves with the location.
     */
    getGeolocation(): Promise<GeoLocation>;

    /**
     * Shows some HTML to the user.
     * @param html The HTML to show.
     */
    showHtml(html: string): ShowHtmlAction;

    /**
     * Hides the HTML from the user.
     */
    hideHtml(): HideHtmlAction;

    /**
     * Moves the camera to view the given bot.
     * Returns a promise that resolves when the bot is focused.
     * @param botOrPosition The bot, bot ID, or position to view.
     * @param options The options to use for moving the camera.
     */
    focusOn(
        botOrPosition: Bot | string | { x: number, y: number, z?: number; },
        options: FocusOnOptions
    ): Promise<void>;

    /**
     * Opens the QR Code Scanner.
     * @param camera The camera that should be used.
     */
    openQRCodeScanner(camera?: CameraType): OpenQRCodeScannerAction;

    /**
     * Closes the QR Code Scanner.
     */
    closeQRCodeScanner(): OpenQRCodeScannerAction;

    /**
     * Shows the given QR Code.
     * @param code The code to show.
     */
    showQRCode(code: string): ShowQRCodeAction;

    /**
     * Hides the QR Code.
     */
    hideQRCode(): ShowQRCodeAction;

    /**
     * Opens the barcode scanner.
     * @param camera The camera that should be used.
     */
    openBarcodeScanner(camera?: CameraType): OpenBarcodeScannerAction;

    /**
     * Closes the barcode scanner.
     */
    closeBarcodeScanner(): OpenBarcodeScannerAction;

    /**
     * Opens the photo camera. Returns a promise that resolves once the camera has been opened. Triggers the {@tag onPhotoCameraOpened} shout once opened.
     *
     * While open, each time the user takes a photo the system will send a {@tag @onPhotoCaptured} shout. Optionally accepts which camera to use for scanning. (front/back)
     *
     * @param options the options that should be used for the photo camera.
     *
     * @example Open the photo camera.
     * await os.openPhotoCamera();
     *
     * @example Open the photo camera, defaulting to the front-facing camera.
     * await os.openPhotoCamera({
     *     cameraType: "front"
     * });
     *
     * @dochash actions/os/camera
     * @doctitle Camera Actions
     * @docsidebar Camera
     * @docdescription Actions for taking photos.
     * @docname os.openPhotoCamera
     */
    openPhotoCamera(options?: OpenPhotoCameraOptions): Promise<void>;

    /**
     * Closes the photo camera. Returns a promise that resolves once the camera has been closed. Triggers the {@tag onPhotoCameraClosed} shout once closed.
     *
     * @example Close the photo camera
     * await os.closePhotoCamera();
     * 
     * @dochash actions/os/camera
     * @docname os.closePhotoCamera
     */
    closePhotoCamera(): Promise<void>;

    /**
     * Opens the photo camera for the user to take a single photo. Returns a promise that resolves with the taken photo. Triggers the {@tag onPhotoCameraOpened} shout once opened.
     *
     * While open, each time the user takes a photo the system will send a {@tag @onPhotoCaptured} shout. Optionally accepts which camera to use for scanning. (front/back)
     *
     * @param options the options that should be used for the photo camera.
     *
     * @example Prompt the user to take a single photo.
     * const photo = await os.capturePhoto();
     *
     * @example Take a single photo, defaulting to the front-facing camera.
     * await os.capturePhoto({
     *     cameraType: "front"
     * });
     *
     * @dochash actions/os/camera
     * @doctitle Camera Actions
     * @docsidebar Camera
     * @docdescription Actions for taking photos.
     * @docname os.capturePhoto
     */
    capturePhoto(options?: OpenPhotoCameraOptions): Promise<Photo>;

    /**
     * Captures a screenshot (i.e. photo/picture) from the grid portal.
     * 
     * Returns a promise that resolves with the captured photo.
     * 
     * @param portal the portal to capture the screenshot from. Defaults to the grid portal.
     * 
     * @example Capture a screenshot from the grid portal.
     * const screenshot = await os.capturePortalScreenshot();
     * 
     * @dochash actions/os/portals
     * @docname os.capturePortalScreenshot
     */
    capturePortalScreenshot(): Promise<Photo>;

    /**
     * Shows the given barcode.
     * @param code The code that should be shown.
     * @param format The format that the barcode should be shown in.
     */
    showBarcode(code: string, format?: BarcodeFormat): ShowBarcodeAction;

    /**
     * Hides the barcode.
     */
    hideBarcode(): ShowBarcodeAction;

    /**
     * Shows an image classifier for the given ML Model.
     * Returns a promise that resolves when the image classifier has been opened.
     * @param options The options for the classifier.
     */
    openImageClassifier(options: ImageClassifierOptions): Promise<void>;

    /**
     * Closes the image classifier.
     * Returns a promise that resolves when the image classifier has been closed.
     */
    closeImageClassifier(): Promise<void>;

    /**
     * Classifies the given images using the image classifier. Returns a promise that resolves with the results of the classification.
     * 
     * @param options the options that should be used for the image classification.
     * 
     * @example Classify the given images.
     * const files = await os.showUploadFiles()
     * const classify = os.classifyImages({
     *      modelUrl: "MY_MODEL_URL",
     *      images: files.map((file) => {
     *         return {file}
     *      })
     * })
     * 
     * @dochash actions/os/image-classification
     * @docname os.classifyImages
     * @docgroup 10-image-classifier
    */
    classifyImages(options: ClassifyImagesOptions): Promise<ClassifyImagesResult>

    /**
     * Gets the local device time in miliseconds since January 1st 1970 UTC-0.
     */
    localTime: number;

    /**
     * Gets the current agreed upon inst time in miliseconds since January 1st 1970 UTC-0.
     */
    agreedUponTime: number;

    /**
     * Gets the calculated latency between this device and the inst server.
     */
    instLatency: number;

    /**
     * Gets the calculated time offset between this device and the inst server.
     */
    instTimeOffset: number;

    /**
     * Gets the maximum spread between time offset samples in miliseconds.
     * Useful for determining how closely the agreedUponTime matches the server time.
     */
    instTimeOffsetSpread: number;

    /**
     * Gets the current agreed upon time plus an offset that attempts to ensure that
     * changes/events will have been synchronized between all connected devices by the moment that this time occurrs.
     */
    deadReckoningTime: number;

    /**
     * Shows the chat bar.
     */
    showChat(): ShowChatBarAction;

    /**
     * Shows the chat bar with the given placeholder.
     * @param placeholder The placeholder text that should be in the chat bar.
     */
    showChat(placeholder: string): ShowChatBarAction;

    /**
     * Shows the chat bar with the given options.
     * @param options The options that should be used to show the chat bar.
     */
    showChat(options: ShowChatOptions): ShowChatBarAction;

    /**
     * Shows the run bar.
     * @param placeholderOrOptions The placeholder text or options. (optional)
     */
    showChat(
        placeholderOrOptions?: string | ShowChatOptions
    ): ShowChatBarAction;

    /**
     * Hides the run bar.
     */
    hideChat(): ShowChatBarAction;

    /**
     * Enqueues the given script to execute after this script is done running.
     * @param script The script that should be executed.
     */
    run(script: string): Promise<any>;

    /**
     * Downloads the given data.
     * @param data The data to download. Objects will be formatted as JSON before downloading.
     * @param filename The name of the file that the data should be downloaded as.
     * @param mimeType The MIME type that should be used. If not specified then it will be inferred from the filename.
     */
    download(
        data: string | object | ArrayBuffer | Blob,
        filename: string,
        mimeType?: string
    ): DownloadAction;

    /**
     * Downloads the given list of bots. (Version 1 of the Aux File Format)
     * @param bots The bots that should be downloaded.
     * @param filename The name of the file that the bots should be downloaded as.
     */
    downloadBots(bots: Bot[], filename: string): DownloadAction;

    /**
     * Downloads the given list of bots as an initialization update. (Version 2 of the Aux File Format)
     * @param bots The bots that should be downloaded.
     * @param filename The name of the file that the bots should be downloaded as.
     */
    downloadBotsAsInitialzationUpdate(
        bots: Bot[],
        filename: string
    ): DownloadAction;

    /**
     * Gets the JSON representation of the given bots as an .aux file.
     * 
     * This function is useful for getting the contents of an aux file without downloading it.
     * 
     * @param bots The bots that should be converted to JSON.
     * @param options The options that should be used for the conversion.
     * 
     * @example Get the current bot as an aux file.
     * const myAux = os.getAuxFileForBots([bot]);
     * 
     * @example Download the current bot as an aux file.
     * const myAux = os.getAuxFileForBots([bot]);
     * os.download(myAux, "myAux.aux");
     * 
     * @example Get the current bot as an aux file with version 1.
     * const myAux = os.getAuxFileForBots([bot], { version: 1 });
     * 
     * @dochash actions/os/files
     * @docname os.getAuxFileForBots
     */
    getAuxFileForBots(
        bots: Bot[],
        options?: AuxFileOptions
    ): StoredAux;

    /**
     * Installs the given aux file into the inst.
     * 
     * Depending on the version of the aux file, this may overwrite existing bots.
     * 
     * @param aux The aux file that should be installed.
     * @param mode The mode that should be used to install the bots in the AUX file.
     * - `"default"` indicates that the aux file will be installed as-is.
     *    If the file was already installed, then it will either overwrite bots or do nothing depending on the version of the aux.
     *    Version 1 auxes will overwrite existing bots, while version 2 auxes will do nothing.
     * - `"copy"` indicates that all the bots in the aux file should be given new IDs. This is useful if you want to be able to install an AUX multiple times in the same inst.
     * 
     * @example Install an aux file.
     * await os.installAuxFile(myAux);
     * 
     * @dochash actions/os/files
     * @docname os.installAuxFile
     */
    installAuxFile(
        aux: StoredAux,
        mode?: InstallAuxFileMode
    ): Promise<void>;

    /**
     * Downloads all the shared bots in the inst.
     */
    downloadInst(): DownloadAction;

    /**
     * Shows the "Upload AUX File" dialog.
     */
    showUploadAuxFile(): ShowUploadAuxFileAction;

    /**
     * Shows the "Upload Files" dialog.
     */
    showUploadFiles(): Promise<UploadedFile[]>;

    /**
     * Loads the inst with the given ID.
     * @param id The ID of the inst to load.
     */
    loadInst(id: string): LoadServerAction;

    loadInst()

    /**
     * Loads the given inst into the current browser tab. When the inst is loaded, the {@tag @onInstJoined} shout will be triggered.
     *
     * Note that separate instances cannot interact directly. They must instead interact via super shouts
     *
     * @param id the ID of the inst to load.
     *
     * @example Load the "fun" inst.
     * os.loadInst("fun");
     *
     * @dochash actions/os/spaces
     * @docname os.loadInst
     * @docid os.loadInst
     * @docgroup 10-load-inst
     */
    loadInst(id: string): LoadServerAction | void;
    /**
     * Loads the given inst into the current browser tab. When the inst is loaded, the {@tag @onInstJoined} shout will be triggered.
     *
     * Compared to {@link os.loadInst}, this function allows loading insts that are stored in a different manner from the primary inst. For example, you can use this function to load a static inst even if the primary inst is a public inst.
     * However, using this function will not add the inst to the URL, so any insts loaded in this manner will not be preserved upon refresh.
     *
     * Note that separate instances cannot interact directly. They must instead interact via super shouts
     *
     * @param config the configuration for the loaded inst. Loosely matches the config bot tags.
     *
     * @example Load the "fun" inst.
     * os.loadInst({
     *   inst: 'fun'
     * });
     *
     * @example Load a static inst.
     * os.loadInst({
     *   staticInst: 'fun'
     * });
     *
     * @example Load a player inst.
     * os.loadInst({
     *   owner: 'player',
     *   inst: 'myInst',
     * });
     *
     * @example Load an inst from a record.
     * os.loadInst({
     *   record: 'myRecord',
     *   inst: 'myInst',
     * });
     *
     * @dochash actions/os/spaces
     * @docname os.loadInst
     * @docid os.loadInst-config
     * @docgroup 10-load-inst
     */
    loadInst(config: InstConfig): LoadServerConfigAction | void;

    /**
     * Unloads the inst with the given ID.
     * @param id The ID of the inst to unload.
     */
    unloadInst(id: string): UnloadServerAction;

    /**
     * Unloads the given inst from the current browser tab. When the inst is unloaded, the {@tag @onInstLeave} shout will be triggered.
     *
     * @param id the name of the inst to unload.
     *
     * @example Unload the "fun" inst.
     * os.unloadInst("fun");
     *
     * @dochash actions/os/spaces
     * @docname os.unloadInst
     * @docgroup 10-load-inst
     */
    unloadServer(id: string): UnloadServerAction | void;
    
    /**
     * Unloads the given inst from the current browser tab. When the inst is unloaded, the {@tag @onInstLeave} shout will be triggered.
     *
     * Compared to {@link os.unloadInst}, this function allows unloading insts that are stored in a different manner from the primary inst.
     * For example, you can use this function to unload a static inst even if the primary inst is a public inst.
     * 
     * @param id the name of the inst to unload.
     *
     * @example Unload the "fun" inst.
     * os.unloadInst({
     *    inst: 'fun'
     * });
     * 
     * @example Unload the "fun" static inst.
     * os.unloadInst({
     *    staticInst: 'fun'
     * });
     *
     * @dochash actions/os/spaces
     * @docname os.unloadInst-config
     * @docgroup 10-load-inst
     */
    unloadServer(config: InstConfig): UnloadServerConfigAction | void;

    /**
     * Imports the AUX from the given URL or JSON
     * @param urlOrJSON The URL or JSON to load.
     *                  If given JSON, then it will be imported as if it was a .aux file.
     *                  If given a URL, then it will be downloaded and then imported.
     */
    importAUX(urlOrJSON: string): ImportAUXAction | ApplyStateAction;

    /**
     * Parses the given JSON or PDF data and returns the list of bots that were contained in it.
     * @param jsonOrPdf The JSON or PDF data to parse.
     */
    parseBotsFromData(jsonOrPdf: string): Bot[];

    /**
     * Replaces the bot that the user is beginning to drag.
     * Only works from inside a onDrag() or onAnyBotDrag() listen tag.
     * @param bot The bot or mod that should be dragged instead of the original.
     */
    replaceDragBot(bot: Mod): ReplaceDragBotAction;

    /**
     * Sets the text stored in the player's clipboard.
     * @param text The text to set to the clipboard.
     */
    setClipboard(text: string): SetClipboardAction;

    /**
     * Redirects the user to the given URL.
     * @param url The URL to go to.
     *
     * @example
     * // Send the player to wikipedia.
     * os.goToURL("https://wikipedia.org");
     */
    goToURL(url: string): GoToURLAction;

    /**
     * Redirects the user to the given URL.
     * @param url The URL to go to.
     *
     * @example
     * // Open wikipedia in a new tab.
     * os.openURL("https://wikipedia.org");
     */
    openURL(url: string): OpenURLAction;

    /**
     * Shows an input box to edit the given bot and tag.
     *
     * @param bot The bot or bot ID that should be edited.
     * @param tag The tag which should be edited on the bot.
     * @param options The options that indicate how the input box should be customized.
     *
     * @example
     * // Show an input box for `this` bot's label.
     * os.showInputForTag(this, "label", {
     *            title: "Change the label",
     *            type: "text"
     * });
     *
     * @example
     * // Show a color picker for the bot's color.
     * os.showInputForTag(this, "color", {
     *            title: "Change the color",
     *            type: "color",
     *            subtype: "advanced"
     * });
     */
    showInputForTag(
        bot: Bot | string,
        tag: string,
        options?: Partial<ShowInputOptions>
    ): ShowInputForTagAction;

    /**
     * Shows an input box. Returns a promise that resolves with the new value.
     *
     * @param currentValue The value that the input box should be prefilled with.
     * @param options The options that indicate how the input box should be customized.
     *
     * @example
     * // Show an input box.
     * const result = await os.showInput({
     *    title: "Change the label",
     *    type: "text"
     * });
     */
    showInput: MaskFunc<(
        currentValue?: any,
        options?: Partial<ShowInputOptions>
    ) => Promise<string>>;

    /**
     * Shows a confirmation dialog. Returns a promise that resolves with true if the "Confirm" button is clicked and false if the "Cancel" button is clicked or the dialog is closed.
     * @param options The options that indicate how the confirmation dialog shold be customized.
     */
    showConfirm(options: ShowConfirmOptions): Promise<boolean>;

    /**
     * Gets the dimension that the player is currently viewing.
     */
    getCurrentDimension(): string;

    /**
     * Gets the inst that the player is currently in.
     */
    getCurrentInst(): string;

    /**
     * Gets the distance that the player bot is from the given dimension.
     *
     * Returns 0 if the player bot is in the dimension, 1 if the dimension is in a portal, and -1 if neither are true.
     *
     * @param dimension The dimension to check for.
     */
    getDimensionalDepth(dimension: string): number;

    /**
     * Determines whether the player has the given bot in their miniGridPortal.
     * @param bots The bot or bots to check.
     */
    hasBotInMiniPortal(bots: Bot | Bot[]): boolean;

    /**
     * Gets the current user's bot.
     */
    getBot(): Bot;

    /**
     * Gets the name of the dimension that is used for the current user's menu.
     */
    getMenuDimension(): string;

    /**
     * Gets the name of the dimension that is used for the current user's miniGridPortal.
     */
    getMiniPortalDimension(): string;

    /**
     * Registers a custom app for the given bot with the given options.
     * Apps allow you add custom functionality to the CasualOS frontend and are deeply integrated into the CasualOS platform.
     * 
     * @param id The ID of the app.
     * @param bot The bot that should be used to control the app.
     */
    registerApp(
        id: string,
        bot: Bot | string
    ): Promise<void>;

    /**
     * Removes a custom app from the session.
     * 
     * @param id The ID of the app.
     */
    unregisterApp(
        id: string
    ): Promise<void>;

    /**
     * Sets the output of the given app.
     * @param id The ID of the app.
     * @param output The output that the app should display.
     */
    compileApp(id: string, output: any): SetAppOutputAction;

    appHooks: {
        /**
         * Returns a stateful value, and a function to update it.
         * @param initialState The initial value (or a function that returns the initial value)
         */
        useState<S>(initialState: S | (() => S)): [S, StateUpdater<S>];

        /**
         * Returns a stateful value, and a function to update it.
         */
        useState<S = undefined>(): [
            S | undefined,
            StateUpdater<S | undefined>
        ];

        /**
         * An alternative to `useState`.
         *
         * `useReducer` is usually preferable to `useState` when you have complex state logic that involves
         * multiple sub-values. It also lets you optimize performance for components that trigger deep
         * updates because you can pass `dispatch` down instead of callbacks.
         * @param reducer Given the current state and an action, returns the new state
         * @param initialState The initial value to store as state
         */
        useReducer<S, A>(
            reducer: Reducer<S, A>,
            initialState: S
        ): [S, (action: A) => void];

        /**
         * An alternative to `useState`.
         *
         * `useReducer` is usually preferable to `useState` when you have complex state logic that involves
         * multiple sub-values. It also lets you optimize performance for components that trigger deep
         * updates because you can pass `dispatch` down instead of callbacks.
         * @param reducer Given the current state and an action, returns the new state
         * @param initialArg The initial argument to pass to the `init` function
         * @param init A function that, given the `initialArg`, returns the initial value to store as state
         */
        useReducer<S, A, I>(
            reducer: Reducer<S, A>,
            initialArg: I,
            init: (arg: I) => S
        ): [S, (action: A) => void];

        /**
         * `useRef` returns a mutable ref object whose `.current` property is initialized to the passed argument
         * (`initialValue`). The returned object will persist for the full lifetime of the component.
         *
         * Note that `useRef()` is useful for more than the `ref` attribute. It’s handy for keeping any mutable
         * value around similar to how you’d use instance fields in classes.
         *
         * @param initialValue the initial value to store in the ref object
         */
        useRef<T>(initialValue: T): MutableRef<T>;

        /**
         * `useRef` returns a mutable ref object whose `.current` property is initialized to the passed argument
         * (`initialValue`). The returned object will persist for the full lifetime of the component.
         *
         * Note that `useRef()` is useful for more than the `ref` attribute. It’s handy for keeping any mutable
         * value around similar to how you’d use instance fields in classes.
         *
         * @param initialValue the initial value to store in the ref object
         */
        useRef<T>(initialValue: T | null): Ref<T>;

        /**
         * `useRef` returns a mutable ref object whose `.current` property is initialized to the passed argument
         * (`initialValue`). The returned object will persist for the full lifetime of the component.
         *
         * Note that `useRef()` is useful for more than the `ref` attribute. It’s handy for keeping any mutable
         * value around similar to how you’d use instance fields in classes.
         */
        useRef<T = undefined>(): MutableRef<T | undefined>;

        /**
         * Accepts a function that contains imperative, possibly effectful code.
         * The effects run after browser paint, without blocking it.
         *
         * @param effect Imperative function that can return a cleanup function
         * @param inputs If present, effect will only activate if the values in the list change (using ===).
         */
        useEffect(effect: EffectCallback, inputs?: Inputs): void;

        /**
         * Accepts a function that contains imperative, possibly effectful code.
         * Use this to read layout from the DOM and synchronously re-render.
         * Updates scheduled inside `useLayoutEffect` will be flushed synchronously, after all DOM mutations but before the browser has a chance to paint.
         * Prefer the standard `useEffect` hook when possible to avoid blocking visual updates.
         *
         * @param effect Imperative function that can return a cleanup function
         * @param inputs If present, effect will only activate if the values in the list change (using ===).
         */
        useLayoutEffect(effect: EffectCallback, inputs?: Inputs): void;

        /**
         * Returns a memoized version of the callback that only changes if one of the `inputs`
         * has changed (using ===).
         */
        useCallback<T extends Function>(callback: T, inputs: Inputs): T;

        /**
         * Pass a factory function and an array of inputs.
         * useMemo will only recompute the memoized value when one of the inputs has changed.
         * This optimization helps to avoid expensive calculations on every render.
         * If no array is provided, a new value will be computed whenever a new function instance is passed as the first argument.
         */
        // for `inputs`, allow undefined, but don't make it optional as that is very likely a mistake
        useMemo<T>(factory: () => T, inputs: Inputs | undefined): T;

        /**
         * Customize the displayed value in the devtools panel.
         *
         * @param value Custom hook name or object that is passed to formatter
         * @param formatter Formatter to modify value before sending it to the devtools
         */
        useDebugValue<T>(value: T, formatter?: (value: T) => any): void;

        useErrorBoundary(
            callback?: (error: any) => Promise<void> | void
        ): [any, () => void];

        /**
         * Renders the given virtual DOM into the given parent element.
         * @param vdom The VDOM that should be rendered.
         * @param parent The element that the VDOM should be added inside of.
         * @param replaceNode The element that should be replaced. Can be used as a performance optimization if you know which element was changed by the VDOM.
         */
        render(vdom: any,
            parent: Element | Document | ShadowRoot | DocumentFragment,
            replaceNode?: Element | Text): void;

        /**
         * Creates a hook that can be used to get a reference to the HTML element that a Preact component is attached to.
         */
        createRef<T = any>(): RefObject<T>;

        /**
         * Creates a new context that can be used for sharing values between components.
         * @param defaultValue The value.
         */
        createContext<T>(defaultValue: T): PreactContext<T>;
    };

    appCompat: {
        /**
         * The PureComponent Class.
         * See https://preactjs.com/guide/v10/switching-to-preact/#purecomponent for more details.
         */
        PureComponent: any;

        /**
         * Creates a new component that renders the given component as a PureComponent.
         * See https://preactjs.com/guide/v10/switching-to-preact/#memo for more details.
         * @param component The component that should be converted.
         */
        memo<T>(component: T): T;

        /**
         * Creates a new component that is able to forward a reference further down the tree.
         * See https://preactjs.com/guide/v10/switching-to-preact/#forwardref for more details.
         * @param fn The function that should be used to forward the reference.
         */
        forwardRef(fn: any): any;

        /**
         * Creates a portal that can be used to render components outside of the normal DOM hierarchy.
         * @param children The children that should be rendered.
         * @param container The container for the children.
         */
        createPortal(children: any, container: Element): any;

        /**
         * The Suspense component class.
         * See https://preactjs.com/guide/v10/switching-to-preact/#suspense-experimental for more details.
         */
        Suspense: any;

        /**
         * Creates a component that is lazily rendered.
         * See https://preactjs.com/guide/v10/switching-to-preact/#suspense-experimental for more details.
         * @param fn The function that should be used to render the component.
         */
        lazy<T>(fn: () => Promise<{ default: T } | T>): T;
    };

    /**
     * Gets the list of built-in CasualOS tags.
     */
    listBuiltinTags(): string[];

    /**
     * Shows the "report inst" dialog to the user.
     * 
     * Returns a promise that resolves once the dialog has been closed.
     * 
     * @example Show the "report inst" dialog.
     * await os.reportInst();
     * 
     * @dochash actions/os/moderation
     * @docname os.reportInst
     */
    reportInst(): Promise<void>;

    /**
     * Requests that an "authentication" bot be added to the inst for the current browser tab.
     * Auth bots are useful for discovering general information about the logged in user and are typically associated with a [https://publicos.link](https://publicos.link) user account.
     *
     * Returns a promise that resolves with a bot that contains information about the signed in user session.
     * Resolves with `null` if the user was unable to sign in.
     *
     * On success, the `authBot` global variable will reference the bot that was returned by the promise.
     *
     * See [Auth Bot Tags](page:tags#auth-bot-tags) for more information.
     * 
     * See {@link os.requestAuthBotInBackground} for a version of this function that does not show a popup if the user is not signed in.
     * 
     * @example Request an auth bot for the user
     * await os.requestAuthBot();
     * os.toast("Logged in!");
     *
     * @dochash actions/os/records
     * @doctitle Records Actions
     * @docsidebar Records
     * @docdescription Records are a way to store permenent data in CasualOS.
     * @docgroup 01-records
     * @docname os.requestAuthBot
     */
    requestAuthBot(): Promise<Bot>;

    /**
     * Requests that an "authentication" bot be added to the inst for the current browser tab.
     * Works similarly to {@link os.requestAuthBot}, except that the request will not show a popup if the user is not signed in.
     * 
     * Auth bots are useful for discovering general information about the logged in user and are typically associated with a [https://publicos.link](https://publicos.link) user account.
     *
     * Returns a promise that resolves with a bot that contains information about the signed in user session.
     * Resolves with `null` if the user is not already signed in.
     *
     * On success, the `authBot` global variable will reference the bot that was returned by the promise.
     *
     * See [Auth Bot Tags](page:tags#auth-bot-tags) for more information.
     * 
     * See {@link os.requestAuthBot} for a version of this function that shows a popup if the user is not signed in.
     *
     * @example Request the auth bot in the background.
     * const authBot = await os.requestAuthBotInBackground();
     * if (authBot) {
     *     os.toast("Logged in!");
     * } else {
     *     os.toast("Not logged in.");
     * }
     *
     * @dochash actions/os/records
     * @doctitle Records Actions
     * @docsidebar Records
     * @docdescription Records are a way to store permenent data in CasualOS.
     * @docgroup 01-records
     * @docname os.requestAuthBotInBackground
     */
    requestAuthBotInBackground(): Promise<Bot>;

    /**
     * Gets an access key for the given public record.
     * @param name The name of the record.
     */
    getPublicRecordKey(recordName: string): Promise<CreatePublicRecordKeyResult>;

    /**
     * Gets a subjectless access key for the given public record.
     * @param name The name of the record.
     */
    getSubjectlessPublicRecordKey(
        recordName: string
    ): Promise<CreatePublicRecordKeyResult>;
    
    /**
     * Grants the given permission in the given record.
     *
     * See [Record Security](page:learn/records/security) for more information.
     *
     * @param recordName the name of the record.
     * @param permission the permission that should be added.
     * @param options the options for the operation.
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.grantPermission
     */
    grantPermission(
        recordName: string,
        permission: AvailablePermissions,
        options?: RecordActionOptions
    ): Promise<GrantMarkerPermissionResult | GrantResourcePermissionResult>;

    /**
     * Revokes the permission with the given ID from the the given record.
     *
     * See [Record Security](page:learn/records/security) for more information.
     *
     * @param recordName the name of the record.
     * @param permissionId the ID of the permission that should be removed.
     * @param options the options for the operation.
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.revokePermission
     */
    revokePermission(
        recordName: string,
        permissionId: string,
        options?: RecordActionOptions
    ): Promise<RevokePermissionResult>;

    /**
     * Grants the current inst admin permissions in the given record for the rest of the day.
     * @param recordName The name of the record.
     * @param options The options.
     */
    grantInstAdminPermission(
        recordName: string,
        options?: RecordActionOptions
    ): Promise<GrantRoleResult>;

    /**
     * Grants the given user the given role in the given record for the specified time.
     * @param recordName The name of the record.
     * @param role The role that should be granted.
     * @param userId The ID of the user that should be granted the role.
     * @param expireTimeMs The time that the role grant expires. If null, then the role will not expire.
     * @param options The options.
     */
    grantUserRole(
        recordName: string,
        role: string,
        userId: string,
        expireTimeMs?: number | null,
        options?: RecordActionOptions
    ): Promise<GrantRoleResult>;

    /**
     * Revokes the given role from the given user in the given record.
     * @param recordName The name of the record.
     * @param role The role that should be revoked.
     * @param userId The ID of the user.
     * @param options The options.
     */
    revokeUserRole(
        recordName: string,
        role: string,
        userId: string,
        options?: RecordActionOptions
    ): Promise<RevokeRoleResult>;

    /**
     * Grants the given user the given role in the given record for the specified time.
     * @param recordName The name of the record.
     * @param role The role that should be granted.
     * @param inst The inst that should be granted the role.
     * @param expireTimeMs The time that the role grant expires. If null, then the role will not expire.
     * @param options The options.
     */
    grantInstRole(
        recordName: string,
        role: string,
        inst: string,
        expireTimeMs?: number | null,
        options?: RecordActionOptions
    ): Promise<GrantRoleResult>;

    /**
     * Revokes the given role from the given user in the given record.
     * @param recordName The name of the record.
     * @param role The role that should be revoked.
     * @param inst The inst.
     * @param options The options.
     */
    revokeInstRole(
        recordName: string,
        role: string,
        inst: string,
        options?: RecordActionOptions
    ): Promise<RevokeRoleResult>;

    /**
     * Determines if the given value is a record key.
     * @param key The value to check.
     */
    isRecordKey(key: unknown): boolean;

    /**
     * Records the given data to the given address inside the record for the given record key.
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the data should be stored at inside the record.
     * @param data The data that should be stored.
     * @param optionsOrEndpoint The options that should be used for recording the data. Alternatively, the records endpoint that should be queried. Optional.
     */
    recordData(
        recordKey: string,
        address: string,
        data: any,
        optionsOrEndpoint?: RecordDataOptions | string
    ): Promise<RecordDataResult>;

    /**
     * Gets the data stored in the given record at the given address.
     * @param recordKeyOrName The record that the data should be retrieved from.
     * @param address The address that the data is stored at.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    getData(
        recordKeyOrName: string,
        address: string,
        endpoint?: string
    ): Promise<GetDataResult>;

    /**
     * Lists the data stored in the given record starting with the given address.
     * @param recordKeyOrName The record that the data should be retrieved from.
     * @param startingAddress The address that the list should start with.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    listData(recordKeyOrName: string, startingAddress?: string, endpoint?: string): Promise<ListDataResult>;

    /**
     * Gets a partial list of [data](glossary:data-record) with the given marker that is stored in the given record.
     * Optionally accepts the address before the first item that should be included in the list.
     * Returns a promise that resolves with an object that contains the items (if successful) or information about the error that occurred.
     *
     * @param recordKeyOrName the record name or a record key. This indicates the record that the data should be retrieved from.
     * Note that you don't need a record key in order to retrieve public data from a record. Using a record name will work just fine.
     * @param marker The marker that needs to be assigned to the data items that should be included in the list.
     * e.g. Using "publicRead" will return all data items with the "publicRead" marker.
     * @param startingAddress the address after which items will be included in the list.
     * Since items are ordered within the record by address, this can be used as way to iterate through all the data items in a record.
     * If omitted, then the list will start with the first item.
     * @param options The options for the operation.
     * 
     * @example Get a list of publicRead data items in a record
     * const result = await os.listData('myRecord', 'publicRead');
     * if (result.success) {
     *     os.toast(result.items);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @example List all the items that have the publicRead marker in a record
     * let lastAddress;
     * let items = [];
     * while(true) {
     *     const result = await os.listData('myRecord', 'publicRead', lastAddress);
     *     if (result.success) {
     *         console.log(result.items);
     *         items.push(...result.items);
     *         if (result.items.length > 0) {
     *             lastAddress = result.items[result.items.length - 1].address;
     *         } else {
     *             // result.items is empty, so we can break out of the loop
     *             break;
     *         }
     *     } else {
     *         os.toast("Failed " + result.errorMessage);
     *         break;
     *     }
     * }
     * 
     * @example List publicRead items in descending order
     * const result = await os.listData('myRecord', 'publicRead', null, { sort: 'descending' });
     * if (result.success) {
     *     os.toast(result.items);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     * 
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.listDataByMarker
     */
    listDataByMarker(
        recordKeyOrName: string,
        marker: string,
        startingAddress?: string,
        options?: ListDataOptions
    ): Promise<ListDataResult>;

    /**
     * Erases the data stored in the given record at the given address.
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the data should be erased from.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    eraseData(recordKey: string, address: string, endpoint?: string): Promise<EraseDataResult>;

    /**
     * Records the given data to the given address inside the record for the given record key.
     * This data needs to be manually approved when reading, writing, or erasing it.
     * 
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the data should be stored at inside the record.
     * @param data The data that should be stored.
     * @param optionsOrEndpoint The options that should be used for recording the data. Alternatively, the records endpoint that should be queried. Optional.
     */
    recordManualApprovalData(
        recordKey: string,
        address: string,
        data: any,
        optionsOrEndpoint?: RecordDataOptions | string
    ): Promise<RecordDataResult>;

    /**
     * Gets the data stored in the given record at the given address.
     * This data needs to be manually approved when reading, writing, or erasing it.
     * 
     * @param recordKeyOrName The record that the data should be retrieved from.
     * @param address The address that the data is stored at.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    getManualApprovalData(
        recordKeyOrName: string,
        address: string,
        endpoint?: string
    ): Promise<GetDataResult>;

    /**
     * Erases the data stored in the given record at the given address.
     * This data needs to be manually approved when reading, writing, or erasing it.
     * 
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the data should be erased from.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    eraseManualApprovalData(recordKey: string, address: string, endpoint?: string): Promise<EraseDataResult>;

    
    /**
     * Creates or updates a [webhook](glossary:webhook-record) in the given record using the given options.
     *
     * Returns a promise that resolves with an object that contains whether the operation succeeded.
     *
     * @param recordName the name of the record.
     * @param webhook the webhook that should be created or updated.
     * @param options the options that should be used.
     *
     * @example Create a publically-runnable webhook that runs from an inst.
     * await os.recordWebhook('myRecord', {
     *   address: 'webhookAddress',
     *   targetResourceKind: 'inst',
     *   targetRecordName: 'myRecord',
     *   targetAddress: 'myInst',
     *   markers: ['publicRead']
     * });
     *
     * @example Create a private webhook that runs from a data record.
     * await os.recordWebhook('myRecord', {
     *   address: 'webhookAddress',
     *   targetResourceKind: 'data',
     *   targetRecordName: 'myRecord',
     *   targetAddress: 'myDataAddress',
     * });
     *
     * @example Create a private webhook that runs from a file record.
     * await os.recordWebhook('myRecord', {
     *   address: 'webhookAddress',
     *   targetResourceKind: 'file',
     *   targetRecordName: 'myRecord',
     *   targetAddress: 'myFileName',
     * });
     *
     * @dochash actions/os/records
     * @docgroup 05-records
     * @docname os.recordWebhook
     */
    recordWebhook(
        recordName: string,
        webhook: WebhookRecord,
        options?: RecordActionOptions
    ): Promise<CrudRecordItemResult>;
    
    /**
     * Runs the webhook in the given record with the provided input.
     * @param recordName the name of the record.
     * @param address the address of the webhook.
     * @param input the input to provide to the webhook.
     * @param options the options to use.
     * 
     * @example Run a webhook with some input.
     * const result = await os.runWebhook('myRecord', 'myWebhookAddress', { myInput: 'myValue' });
     * 
     * @dochash actions/os/records
     * @docgroup 05-records
     * @docname os.runWebhook
     */
    runWebhook(recordName: string, address: string, input: any, options?: RecordActionOptions): Promise<HandleWebhookResult>;

    /**
     * Gets the [webhook](glossary:webhook-record) from the given record.
     *
     * Returns a promise that resolves with the webhook data.
     *
     * @param recordName the name of the record.
     * @param address the address of the webhook.
     * @param options the options to use.
     *
     * @dochash actions/os/records
     * @docgroup 05-records
     * @docname os.getWebhook
     */
    getWebhook(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<CrudGetItemResult<WebhookRecord>>;

    /**
     * Deletes the [webhook](glossary:webhook-record) from the given record.
     * @param recordName the name of the record.
     * @param address the address of the webhook.
     * @param options the options to use.
     *
     * @dochash actions/os/records
     * @docgroup 05-records
     * @docname os.eraseWebhook
     */
    eraseWebhook(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<CrudEraseItemResult>;

    /**
     * Lists the webhooks that are in the given record.
     * @param recordName the name of the record.
     * @param startingAddress the address after which items will be included in the list.
     * Since items are ordered within the record by address, this can be used as way to iterate through all the webhooks items in a record.
     * If omitted, then the list will start with the first item.
     * @param options the options to use.
     *
     * @dochash actions/os/records
     * @docgroup 05-records
     * @docname os.listWebhooks
     */
    listWebhooks(
        recordName: string,
        startingAddress?: string,
        options?: ListWebhooksOptions
    ): Promise<CrudListItemsResult<WebhookRecord>>;

    /**
     * Lists the webhooks that are in the given record.
     * @param recordName the name of the record.
     * @param marker The marker that needs to be assigned to the data items that should be included in the list.
     * e.g. Using "publicRead" will return all data items with the "publicRead" marker.
     * @param startingAddress the address after which items will be included in the list.
     * Since items are ordered within the record by address, this can be used as way to iterate through all the webhooks items in a record.
     * If omitted, then the list will start with the first item.
     * @param options the options to use.
     *
     * @dochash actions/os/records
     * @docgroup 05-records
     * @docname os.listWebhooksByMarker
     */
    listWebhooksByMarker(
        recordName: string,
        marker: string,
        startingAddress?: string,
        options?: ListWebhooksOptions
    ): Promise<CrudListItemsResult<WebhookRecord>>;

    /**
     * Creates or updates a [notification](glossary:notification-record) in the given record using the given options.
     *
     * Returns a promise that resolves with an object that contains whether the operation succeeded.
     *
     * @param recordName the name of the record.
     * @param notification the notification that should be created or updated.
     * @param options the options that should be used.
     *
     * @example Create a notification that anyone can subscribe to.
     * await os.recordNotification('myRecord', {
     *   address: 'notificationAddress',
     *   description: 'my notification',
     *   markers: ['publicRead']
     * });
     *
     * @example Create a private notification.
     * await os.recordNotification('myRecord', {
     *   address: 'notificationAddress',
     *   description: 'my notification',
     *   markers: ['private']
     * });
     *
     * @dochash actions/os/records
     * @docgroup 06-records
     * @docname os.recordNotification
     */
    recordNotification(
        recordName: string,
        notification: NotificationRecord,
        options?: RecordActionOptions
    ): Promise<CrudRecordItemResult>;

    /**
     * Gets the [notification](glossary:notification-record) from the given record.
     *
     * Returns a promise that resolves with the notification data.
     *
     * @param recordName the name of the record.
     * @param address the address of the notification.
     * @param options the options to use.
     *
     * @dochash actions/os/records
     * @docgroup 06-records
     * @docname os.getWebhook
     */
    getNotification(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<CrudGetItemResult<NotificationRecord>>;

    /**
     * Deletes the [notification](glossary:notification-record) from the given record.
     * @param recordName the name of the record.
     * @param address the address of the notification.
     * @param options the options to use.
     *
     * @dochash actions/os/records
     * @docgroup 06-records
     * @docname os.eraseNotification
     */
    eraseNotification(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<CrudEraseItemResult>;

    /**
     * Lists the notifications that are in the given record.
     * @param recordName the name of the record.
     * @param startingAddress the address after which items will be included in the list.
     * Since items are ordered within the record by address, this can be used as way to iterate through all the webhooks items in a record.
     * If omitted, then the list will start with the first item.
     * @param options the options to use.
     *
     * @dochash actions/os/records
     * @docgroup 06-records
     * @docname os.listNotifications
     */
    listNotifications(
        recordName: string,
        startingAddress?: string,
        options?: ListNotificationsOptions
    ): Promise<CrudListItemsResult<NotificationRecord>>;

    /**
     * Lists the webhooks that are in the given record.
     * @param recordName the name of the record.
     * @param marker The marker that needs to be assigned to the data items that should be included in the list.
     * e.g. Using "publicRead" will return all data items with the "publicRead" marker.
     * @param startingAddress the address after which items will be included in the list.
     * Since items are ordered within the record by address, this can be used as way to iterate through all the webhooks items in a record.
     * If omitted, then the list will start with the first item.
     * @param options the options to use.
     *
     * @dochash actions/os/records
     * @docgroup 06-records
     * @docname os.listNotificationsByMarker
     */
    listNotificationsByMarker(
        recordName: string,
        marker: string,
        startingAddress?: string,
        options?: ListNotificationsOptions
    ): Promise<CrudListItemsResult<NotificationRecord>>;

    /**
     * Subscribes to the given notification in the given record.
     *
     * Returns a promise that resolves when the operation is complete.
     *
     * @param recordName the name of the record.
     * @param address the address of the notification that should be subscribed to.
     * @param options the options to use.
     *
     * @example Subscribe to a notification.
     * await os.subscribeToNotification('myRecord', 'myNotificationAddress');
     *
     * @dochash actions/os/records
     * @docgroup 06-records
     * @docname os.subscribeToNotification
     */
    subscribeToNotification(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<SubscribeToNotificationResult>;

    /**
     * Unsubscribes from the given notification subscription.
     *
     * Returns a promise that resolves when the operation is complete.
     *
     * @param subscriptionId the ID of the subscription.
     * @param options the options to use.
     *
     * @dochash actions/os/records
     * @docgroup 06-records
     * @docname os.unsubscribeFromNotification
     */
    unsubscribeFromNotification(
        subscriptionId: string,
        options?: RecordActionOptions
    ): Promise<UnsubscribeToNotificationResult>;

    /**
     * Sends a notification to all subscribers of the given notification in the given record.
     *
     * Returns a promise that resolves with the result of the operation.
     *
     * @param recordName the name of the record.
     * @param address the address of the notification.
     * @param payload the payload to send.
     * @param options the options to use.
     *
     * @example Send a notification.
     * await os.sendNotification('myRecord', 'myNotificationAddress', {
     *     title: 'Hello',
     *     body: 'This is your first notification!',
     * });
     *
     * @dochash actions/os/records
     * @docgroup 06-records
     * @docname os.sendNotification
     */
    sendNotification(
        recordName: string,
        address: string,
        payload: PushNotificationPayload,
        options?: SendNotificationOptions
    ): Promise<SendNotificationResult>;

    /**
     * Gets the list of subscriptions for the given notification in the given record.
     * 
     * @param recordName the name of the record.
     * @param address the address of the notification.
     * @param options the options to use.
     * 
     * @example List notification subscriptions.
     * const result = await os.listNotificationSubscriptions('myRecord', 'myNotificationAddress');
     * 
     * @dochash actions/os/records
     * @docgroup 06-records
     * @docname os.listNotificationSubscriptions
     */
    listNotificationSubscriptions(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<ListSubscriptionsResult>;

    /**
     * Gets the list of notification subscriptions for the current user.
     * 
     * @param options the options to use.
     * 
     * @example List the current user's notification subscriptions.
     * const result = await os.listUserNotificationSubscriptions();
     * 
     * @dochash actions/os/records
     * @docgroup 06-records
     * @docname os.listUserNotificationSubscriptions
     */
    listUserNotificationSubscriptions(
        options?: RecordActionOptions
    ): Promise<ListSubscriptionsResult>;

    /**
     * Records the given data as a file.
     * @param recordKey The record that the file should be recorded in.
     * @param data The data that should be recorded.
     * @param options The options that should be used to record the file.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    recordFile(
        recordKey: string,
        data: any,
        options?: RecordFileOptions,
        endpoint?: string
    ): Promise<RecordFileResult>;

    /**
     * Gets the data stored in the given file.
     * @param result The successful result of a os.recordFile() call.
     */
    getFile(result: RecordFileSuccess): Promise<any>;
    /**
     * Gets the data stored in the given file.
     * @param url The URL that the file is stored at.
     */
    getFile(url: string): Promise<any>;
    /**
     * Gets the data stored in the given file.
     * @param urlOrRecordFileResult The URL or the successful result of the record file operation.
     */
    getFile(urlOrRecordFileResult: string | RecordFileSuccess): Promise<any>;

    /**
     * Gets the data stored in the given public file.
     * Only works for files that have the `publicRead` marker.
     * If the file is not public, then this operation will fail.
     * @param result The successful result of a os.recordFile() call.
     * @param endpoint The endpoint that should be queried. Optional.
     */
    getPublicFile(result: RecordFileSuccess): Promise<any>;

    /**
     * Gets the data stored in the given public file.
     * Only works for files that have the `publicRead` marker.
     * If the file is not public, then this operation will fail.
     * @param url The URL that the public file is stored at.
     */
    getPublicFile(url: string): Promise<any>;

    /**
     * Gets the data stored in the given public file.
     * Only works for files that have the `publicRead` marker.
     * If the file is not public, then this operation will fail.
     * @param urlOrRecordFileResult The URL or the successful result of the record file operation.
     */
    getPublicFile(
        urlOrRecordFileResult: string | RecordFileSuccess
    ): Promise<string>;

    /**
     * Gets the data stored in the given private file.
     * @param result The successful result of a os.recordFile() call.
     * @param endpoint The endpoint that should be queried. Optional.
     */
    getPrivateFile(
        result: RecordFileSuccess,
        endpoint?: string
    ): Promise<any>;

    /**
     * Gets the data stored in the given private file.
     * @param url The URL that the public file is stored at.
     * @param endpoint The endpoint that should be queried. Optional.
     */
    getPrivateFile(url: string, endpoint?: string): Promise<any>;

    /**
     * Gets the data stored in the given private file.
     * @param urlOrRecordFileResult The URL or the successful result of the record file operation.
     * @param endpoint The endpoint that should be queried. Optional.
     */
    getPrivateFile(
        urlOrRecordFileResult: string | RecordFileSuccess,
        endpoint?: string
    ): Promise<string>;

    /**
     * Deletes the specified file using the given record key.
     * @param recordKey The key that should be used to delete the file.
     * @param result The successful result of a os.recordFile() call.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    eraseFile(recordKey: string, result: RecordFileSuccess, endpoint?: string): Promise<EraseFileResult>;
    /**
     * Deletes the specified file using the given record key.
     * @param recordKey The key that should be used to delete the file.
     * @param url The URL that the file is stored at.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    eraseFile(recordKey: string, url: string, endpoint?: string): Promise<EraseFileResult>;
    /**
     * Deletes the specified file using the given record key.
     * @param recordKey The key that should be used to delete the file.
     * @param urlOrRecordFileResult The URL or the successful result of the record file operation.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    eraseFile(recordKey: string, fileUrlOrRecordFileResult: string | RecordFileSuccess, endpoint?: string): Promise<EraseFileResult>;

    /**
     * Records that the given event occurred.
     * @param recordKey The key that should be used to record the event.
     * @param eventName The name of the event.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    recordEvent(recordKey: string, eventName: string, endpoint?: string): Promise<AddCountResult>;

    /**
     * Gets the number of times that the given event has been recorded.
     * @param recordNameOrKey The record that the event count should be retrieved from.
     * @param eventName The name of the event.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    countEvents(recordNameOrKey: string, eventName: string, endpoint?: string): Promise<GetCountResult>;

    /**
     * Grants the given entitlements to a package.
     * 
     * @param request The request to grant entitlements.
     * @param options the options for the request.
     * 
     * @dochash actions/os/records
     * @docgroup 01-packages
     * @docname os.grantEntitlements
     */
    grantEntitlements(
        request: GrantEntitlementsRequest,
        options?: RecordActionOptions
    ): Promise<GrantEntitlementsResult>;

    /**
     * Parses the given version number into a version key.
     * @param version The version number to parse.
     *
     * @example Parse a version number
     * const key = os.parseVersionKey('1.0.0');
     * os.toast(key.major); // 1
     * os.toast(key.minor); // 0
     * os.toast(key.patch); // 0
     * os.toast(key.tag); // null
     *
     * @dochash actions/os/records
     * @docname os.parseVersionKey
     */
    parseVersionKey(version: string): PackageVersion;

    /**
     * Formats the given version key into a string.
     *
     * @example Print the version key
     * os.toast(os.formatVersionKey({ major: 1, minor: 0, patch: 0, tag: 'alpha' }));
     *
     * @param key The key to format.
     *
     * @dochash actions/os/records
     * @docname os.formatVersionKey
     */
    formatVersionKey(key: PackageVersion): string;

    /**
     * Records the given package version. Package versions are useful for storing multiple distinct versions of the same AUX.
     * Package versions live inside package containers (also known simply as packages) and are distinguished by `key`.
     *
     * If the package container does not exist, then it will be automatically created with the `private` marker.
     * If no markers are specified, then the markers from the package container are used.
     *
     * @example Record a v1.0.0 package version
     * const result = await os.recordPackageVersion({
     *   recordName: 'myRecord',
     *   address: 'myPackage',
     *   key: os.parseVersionKey('1.0.0'),
     *   description: 'description of the package',
     *   bots: getBots('color', 'red'),
     * });
     *
     * @example Record a package version that can request access to the user's data
     * const result = await os.recordPackageVersion({
     *   recordName: 'myRecord',
     *   address: 'myPackage',
     *   key: os.parseVersionKey('1.0.0'),
     *   description: 'description of the package',
     *   entitlements: [
     *     {
     *        feature: 'data',
     *        scope: 'personal',
     *     }
     *   ],
     *   bots: getBots('color', 'red),
     * });
     *
     * @param request the information about the package version that should be recorded.
     * @param options the options for the request.
     *
     * @dochash actions/os/records
     * @docgroup 01-packages
     * @docname os.recordPackageVersion
     */
    recordPackageVersion(
        request: RecordPackageVersionApiRequest,
        options?: RecordActionOptions
    ): Promise<RecordPackageVersionResult>;

    /**
     * Gets the list of versions for the given package.
     * @param recordName The name of the record that the package is stored in.
     * @param address The address of the package.
     *
     * @example List all the versions of a package
     * const result = await os.listPackageVersions('myRecord', 'myPackage');
     *
     * @dochash actions/os/records
     * @docgroup 01-packages
     * @docname os.listPackageVersions
     */
    listPackageVersions(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<CrudListItemsResult<PackageRecordVersion>>;

    /**
     * Gets metadata about the given package version.
     * @param recordName The name of the record that the package version is stored in.
     * @param address The address of the package version.
     * @param key The key of the package version.
     * @param options The options for the package version.
     *
     * @example Get info about a package version
     * const result = await os.getPackageVersion('myRecord', 'myPackage', os.parseVersionKey('1.0.0'));
     *
     * @dochash actions/os/records
     * @docgroup 01-packages
     * @docname os.getPackageVersion
     */
    getPackageVersion(
        recordName: string,
        address: string,
        key: string | PackageRecordVersionKeySpecifier,
        options?: RecordActionOptions
    ): Promise<CrudGetItemResult<PackageRecordVersion>>;

    /**
     * Erases the given package version.
     * @param recordName the name of the record that the package version should be erased from.
     * @param address the address of the package version that should be erased.
     * @param key the key of the package version that should be erased.
     *
     * @example Erase a package version
     * const result = await os.erasePackageVersion('myRecord', 'myPackage', os.parseVersionKey('1.0.0'));
     *
     * @dochash actions/os/records
     * @docgroup 01-packages
     * @docname os.erasePackageVersion
     */
    erasePackageVersion(
        recordName: string,
        address: string,
        key: PackageVersion,
        options?: RecordActionOptions
    ): Promise<CrudEraseItemResult>;

    /**
     * Records the given package container.
     * Package containers (also known simply as packages) are ways to group multiple package versions together.
     *
     * Markers that are applied to the package container control whether all the package versions can be deleted and also will be used as the default markers for package versions if the version isn't created with a marker.
     *
     * @param recordName The name of the record that the package should be stored in.
     * @param address The address of the package.
     * @param markers The markers that should be applied to the package.
     * @param options The options.
     *
     * @dochash actions/os/records
     * @docgroup 01-packages
     * @docname os.recordPackageContainer
     */
    recordPackageContainer(
        recordName: string,
        address: string,
        markers?: string | string[],
        options?: RecordActionOptions
    ): Promise<CrudRecordItemResult>;

    /**
     * Erases the given package container and any package versions that it contains.
     *
     * @param recordName the name of the record that the package container is in.
     * @param address the address of the package container.
     * @param options the options to use for the request.
     */
    erasePackageContainer(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<CrudEraseItemResult>;

    /**
     * Lists all the package containers that are in the given record.
     * You must have access to the `account` marker in order to list all package containers in a record.
     *
     * @param recordName the name of the record that the package containers should be listed from.
     * @param startingAddress the address that the listing should start after.
     * @param options the options for the request.
     *
     * @example List package containers in a record
     * const result = await os.listPackageContainers('myRecord');
     *
     * @dochash actions/os/records
     * @docgroup 01-packages
     * @docname os.listPackageContainers
     */
    listPackageContainers(
        recordName: string,
        startingAddress?: string,
        options?: ListDataOptions
    ): Promise<CrudListItemsResult<PackageRecord>>;

    /**
     * Lists the package containers that have the given marker in the given record.
     * You must have access to the specified marker in order to list the package containers.
     *
     * @param recordName the name of the record that the package containers should be listed from.
     * @param marker the marker that the package containers should have.
     * @param startingAddress the address that the listing should start after.
     * @param options the options for the request.
     *
     * @example List public package containers in a record
     * const result = await os.listPackageContainersByMarker('myRecord', 'publicRead');
     *
     * @example List private package containers in a record
     * const result = await os.listPackageContainersByMarker('myRecord', 'private');
     *
     * @example List public package containers stored at "myNamespace"
     * const result = await os.listPackageContainersByMarker('myRecord', 'publicRead:myNamespace');
     *
     * @dochash actions/os/records
     * @docgroup 01-packages
     * @docname os.listPackageContainersByMarker
     */
    listPackageContainersByMarker(
        recordName: string,
        marker: string,
        startingAddress?: string,
        options?: ListDataOptions
    ): Promise<CrudListItemsResult<PackageRecord>>;

    /**
     * Gets the package container in the given record at the given address.
     *
     * @param recordName the name of the record that the package container is in.
     * @param address the address that the package container is stored at.
     * @param options the options for the request.
     *
     * @dochash actions/os/records
     * @docgroup 01-packages
     * @docname os.getPackageContainer
     */
    getPackageContainer(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<CrudGetItemResult<PackageRecord>>;

    /**
     * Attempts to install the given package into the inst.
     *
     * @param recordName the name of the record that the package is in.
     * @param address the address of the package that should be loaded.
     * @param key the key that specifies the version of the package that should be loaded. If not specified, then the latest version will be loaded.
     * @param options the options for the request.
     *
     * @dochash actions/os/records
     * @docgroup 01-packages
     * @docname os.installPackage
     */
    installPackage(
        recordName: string,
        address: string,
        key?: string | PackageRecordVersionKeySpecifier,
    ): Promise<InstallPackageResult>;
    
    /**
     * Gets the list of packages that are installed in the inst.
     * @param options the options for the request.
     * 
     * @example List all installed packages
     * const result = await os.listInstalledPackages();
     * 
     * @dochash actions/os/records
     * @docgroup 01-packages
     * @docname os.listInstalledPackages
     */
    listInstalledPackages(options?: RecordActionOptions): Promise<ListInstalledPackagesResult>;

    /**
     * Gets the list of studios that the currently logged in user has access to.
     * 
     * Returns a promise that resolves with an object that contains the list of studios (if successful) or information about the error that occurred.
     * 
     * @param endpoint the HTTP Endpoint of the records website that the data should be retrieved from. If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     * 
     * @example Get the list of studios that the user has access to
     * const result = await os.listUserStudios();
     * 
     * if (result.success) {
     *      os.toast(result.studios.map(s => s.name).join(', '));
     * } else {
     *      os.toast('Failed to get studios ' + result.errorMessage);
     * }
     * 
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.listUserStudios
     */
    listUserStudios(endpoint?: string): Promise<ListStudiosResult>;

    /**
     * Gets the default records endpoint. That is, the records endpoint that is used for records actions when no endpoint is specified.
     * 
     * @example Get the default records endpoint.
     * const endpoint = await os.getRecordsEndpoint();
     * os.toast("The default records endpoint is: " + endpoint);
     * 
     * @dochash actions/os/records
     * @docname os.getRecordsEndpoint
     */
    getRecordsEndpoint(): Promise<string>;

    /**
     * Converts the given geolocation to a what3words (https://what3words.com/) address.
     * @param location The latitude and longitude that should be converted to a 3 word address.
     */
    convertGeolocationToWhat3Words(location: ConvertGeolocationToWhat3WordsOptions): Promise<string>;

    /**
     * Casts a 3D ray into the specified portal from the camera and returns information about the bots that were hit.
     * @param portal The portal that should be tested.
     * @param viewportCoordinates The 2D camera viewport coordinates that the ray should be sent from.
     */
    raycastFromCamera(portal: 'grid' | 'miniGrid' | 'map' | 'miniMap', viewportCoordinates: Vector2): Promise<RaycastResult>;

    /**
     * Casts a 3D ray into the specified portal using the given origin and direction and returns information about the bots that were hit.
     * @param portal The portal that should be tested.
     * @param origin The 3D point that the ray should start at.
     * @param direction The 3D direction that the ray should travel in.
     */
    raycast(portal: 'grid' | 'miniGrid' | 'map' | 'miniMap', origin: Vector3, direction: Vector3): Promise<RaycastResult>;

    /**
     * Calculates the 3D ray that would be projected into the given portal based on the specified camera viewport coordinates.
     * @param portal The portal that the ray should be projected into.
     * @param viewportCoordinates The 2D camera viewport coordinates that the ray should be sent from.
     */
    calculateRayFromCamera(portal: 'grid' | 'miniGrid' | 'map' | 'miniMap', viewportCoordinates: Vector2): Promise<RaycastRay>;

    /**
     * Calculates the viewport coordinates that the given position would be projected to in the camera of the given portal.
     * Returns a promise that resolves with the calculated viewport coordinates.
     * 
     * Viewport coordinates locate a specific point on the image that the camera produces.
     * `(X: 0, Y: 0)` represents the center of the camera while `(X: -1, Y: -1)` represents the lower left corner and `(X: 1, Y: 1)` represents the upper right corner.
     * 
     * This function is useful for converting a position in the portal to a position on the camera viewport (screen position, but the location is not in pixels).
     * 
     * @param portal the name of the portal that should be tested.
     * @param position the 3D position that should be projected to the viewport.
     * 
     * @example Calculate the viewport coordinates of the current bot in the home dimension in the grid portal
     * const botPosition = new Vector3(
     *   thisBot.homeX,
     *   thisBot.homeY,
     *   thisBot.homeZ
     * );
     * const viewportPosition = await os.calculateViewportCoordinatesFromPosition("grid", botPosition);
     * os.toast(viewportPosition);
     */
    calculateViewportCoordinatesFromPosition(portal: 'grid' | 'miniGrid' | 'map' | 'miniMap', position: Vector3): Promise<Vector2>;

    /**
     * Calculates the screen coordinates that the given viewport coordinates map to on the screen.
     * Returns a promise that resolves with the calculated screen coordinates.
     * 
     * Screen coordinates are in pixels and are relative to the top-left corner of the screen.
     * Viewport coordinates locate a specific point on the image that the camera produces.
     * `(X: 0, Y: 0)` represents the center of the camera while `(X: -1, Y: -1)` represents the lower left corner and `(X: 1, Y: 1)` represents the upper right corner.
     * 
     * @param portal the name of the portal that should be tested.
     * @param coordinates the 2D viewport coordinates that should be converted to screen coordinates.
     * 
     * @example Calculate the screen coordinates at the center of grid portal screen
     * const screenCoordinates = await os.calculateScreenCoordinatesFromViewportCoordinates('grid', new Vector2(0, 0));
     * os.toast(screenCoordinates);
     * 
     * @dochash actions/os/portals
     * @docname os.calculateScreenCoordinatesFromViewportCoordinates
     * @docgroup 10-raycast
     */
    calculateScreenCoordinatesFromViewportCoordinates(portal: 'grid' | 'miniGrid' | 'map' | 'miniMap', coordinates: Vector2): Promise<Vector2>;

    /**
     * Calculates the screen coordinates that the given 3D position map to on the screen.
     * Returns a promise that resolves with the calculated screen coordinates.
     * 
     * Screen coordinates are in pixels and are relative to the top-left corner of the screen.
     * 
     * @param portal the name of the portal that should be tested.
     * @param coordinate the 3D position that should be converted to screen coordinates.
     * 
     * @example Calculate the screen coordinates of the bots in the home dimension in the grid portal
     * const botPositions = getBots(inDimension('home')).map(bot => new Vector3(bot.tags.homeX, bot.tags.homeY, bot.tags.homeZ));
     * const coordinates = await os.calculateScreenCoordinatesFromPosition('grid', botPositions);
     * 
     * @dochash actions/os/portals
     * @docname os.calculateScreenCoordinatesFromPosition
     * @docid os.calculateScreenCoordinatesFromPosition
     * @docgroup 10-raycast
     */
    calculateScreenCoordinatesFromPosition(
        portal: 'grid' | 'miniGrid' | 'map' | 'miniMap',
        coordinate: Point3D
    ): Promise<Vector2>;
    /**
     * Calculates the screen coordinates that the given 3D position map to on the screen.
     * Returns a promise that resolves with the calculated screen coordinates.
     * 
     * Screen coordinates are in pixels and are relative to the top-left corner of the screen.
     * 
     * @param portal the name of the portal that should be tested.
     * @param coordinates the 3D positions that should be converted to screen coordinates.
     * 
     * @example Calculate the screen coordinates of the bots in the home dimension in the grid portal
     * const botPositions = getBots(inDimension('home')).map(bot => new Vector3(bot.tags.homeX, bot.tags.homeY, bot.tags.homeZ));
     * const coordinates = await os.calculateScreenCoordinatesFromPosition('grid', botPositions);
     * 
     * @dochash actions/os/portals
     * @docname os.calculateScreenCoordinatesFromPosition
     * @docid os.calculateScreenCoordinatesFromPosition-array
     * @docgroup 10-raycast
     */
    calculateScreenCoordinatesFromPosition(
        portal: 'grid' | 'miniGrid' | 'map' | 'miniMap',
        coordinates: Point3D[]
    ): Promise<Vector2[]>;
    /**
     * Calculates the screen coordinates that the given 3D position map to on the screen.
     * Returns a promise that resolves with the calculated screen coordinates.
     * 
     * Screen coordinates are in pixels and are relative to the top-left corner of the screen.
     * 
     * @param portal the name of the portal that should be tested.
     * @param coordinates the 3D positions that should be converted to screen coordinates.
     * 
     * @example Calculate the screen coordinates of the bots in the home dimension in the grid portal
     * const botPositions = getBots(inDimension('home')).map(bot => new Vector3(bot.tags.homeX, bot.tags.homeY, bot.tags.homeZ));
     * const coordinates = await os.calculateScreenCoordinatesFromPosition('grid', botPositions);
     */
    calculateScreenCoordinatesFromPosition(
        portal: 'grid' | 'miniGrid' | 'map' | 'miniMap',
        coordinates: Point3D | Point3D[]
    ): Promise<Vector2[] | Vector2>;

    /**
     * Calculates the viewport coordinates that the given screen coordinates map to on the camera.
     * Returns a promise that resolves with the calculated viewport coordinates.
     * 
     * Screen coordinates are in pixels and are relative to the top-left corner of the screen.
     * Viewport coordinates locate a specific point on the image that the camera produces.
     * `(X: 0, Y: 0)` represents the center of the camera while `(X: -1, Y: -1)` represents the lower left corner and `(X: 1, Y: 1)` represents the upper right corner.
     * 
     * @param portal the name of the portal that should be tested.
     * @param coordinates the 2D screen coordinates that should be converted to viewport coordinates.
     * 
     * @example Calculate the viewport coordinates at (0,0) on the screen
     * const viewportCoordinates = await os.calculateViewportCoordinatesFromScreenCoordinates('grid', new Vector2(0, 0));
     * os.toast(viewportCoordinates);
     * 
     * @dochash actions/os/portals
     * @docname os.calculateViewportCoordinatesFromScreenCoordinates
     * @docgroup 10-raycast
     */
    calculateViewportCoordinatesFromScreenCoordinates(portal: 'grid' | 'miniGrid' | 'map' | 'miniMap', coordinates: Vector2): Promise<Vector2>;

    /**
     * Requests that the given address be pre-cached so that it is available for use on a bot.
     * Returns a promise that resolves once the address has been cached.
     * @param address The address that should be cached.
     */
    bufferFormAddressGLTF(address: string): Promise<void>;

    /**
     * Starts the given animation on the given bot.
     * Returns a promise that resolves once the animation has been started.
     * @param bot The Bot that the animation should be started on.
     * @param nameOrIndex The name or index of the animation that should be started.
     * @param options The options that should be used for the animation.
     */
    startFormAnimation(bot: Bot, nameOrIndex: string | number, options?: StartFormAnimationOptions): Promise<void>;
    /**
     * Starts the given animation on the given bot(s).
     * Returns a promise that resolves once the animation(s) have been started.
     * @param botOrBots The bot or list of bots that the animation should be started on.
     * @param nameOrIndex The name of the animation.
     * @param options The options for the animation.
     */
    startFormAnimation(botOrBots: Bot | string | (Bot | string)[], nameOrIndex: string | number, options?: StartFormAnimationOptions): Promise<void>;

    /**
     * Stops the animation on the given bot(s).
     * Returns a promise that resolves when the animations have been stopped.
     * @param botOrBots The bot or list of bots that the animation(s) should be stopped on.
     * @param options The options that should be used.
     */
    stopFormAnimation(botOrBots: Bot | string | (Bot | string)[], options?: StopFormAnimationOptions): Promise<void>;

    /**
     * Gets the list of animations that are included in the given the form or bot.
     * @param botOrAddress The bot, bot ID, or address that the animations should be retrieved from.
     */
    listFormAnimations(botOrAddress: Bot | string): Promise<FormAnimationData[]>;

    /**
     * Counts the number of build steps that exist in the given lego [LDraw](https://ldraw.org/) file.
     * Returns a promise that resolves with the number of build steps.
     * 
     * @param address The address of the file.
     * 
     * @example Count the number of build steps in an example LDraw file
     * const steps = await os.ldrawCountAddressBuildSteps('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/ldraw/officialLibrary/models/car.ldr_Packed.mpd');
     * os.toast("There are " + steps + " build steps in the file.");
     * 
     * @example Animate the build steps of a bot
     * const steps = await os.ldrawCountAddressBuildSteps('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/ldraw/officialLibrary/models/car.ldr_Packed.mpd');
     * for (let i = 0; i < steps; i++) {
     *    masks.formBuildStep = i;
     * }
     * 
     * @dochash actions/os/ldraw
     * @docname os.ldrawCountTextBuildSteps
     */
    ldrawCountAddressBuildSteps(address: string): Promise<number>;

    /**
     * Counts the number of build steps that exist in the given lego [LDraw](https://ldraw.org/) file.
     * Returns a promise that resolves with the number of build steps.
     * 
     * @param text The text content of the file.
     * 
     * @example Count the number of build steps in an uploaded LDraw file
     * const files = await os.showUploadFiles();
     * const file = files[0];
     * const steps = await os.ldrawCountTextBuildSteps(file.data);
     * os.toast("There are " + steps + " build steps in the file.");
     * 
     * @dochash actions/os/ldraw
     * @doctitle LDraw Actions
     * @docsidebar LDraw
     * @docdescription Actions for working with LDraw models and files.
     * @docname os.ldrawCountTextBuildSteps
     */
    ldrawCountTextBuildSteps(text: string): Promise<number>;

    /**
     * Specifies that the given prefix should be interpreted as code.
     * @param prefix The prefix that code tags should start with.
     * @param options The options that should be used for the prefix.
     */
    registerTagPrefix(prefix: string, options?: RegisterPrefixOptions): Promise<void>;

    /**
     * Gets the number of devices that are viewing the current inst.
     * @param inst The inst to get the statistics for. If omitted, then the current inst is used.
     */
    remoteCount(inst?: string): Promise<number>;

    /**
     * Gets a shared document record from this inst by its name.
     * 
     * Shared documents are a way to share data across insts in a easy and secure manner.
     * 
     * Returns a promise that resolves with the shared document.
     * 
     * @param name The name of the shared document.
     * 
     * @example Get a shared document from the current inst by name.
     * const sharedDocument = await os.getSharedDocument('myDocument');
     */
    getSharedDocument(name: string): Promise<SharedDocument>;

    /**
     * Gets a shared document record from the given inst by its name.
     * 
     * Shared documents are a way to share data across insts in a easy and secure manner.
     * 
     * Returns a promise that resolves with the shared document.
     * @param recordName The name of the record. If null, then a public inst will be used.
     * @param inst The name of the inst that the shared document is in.
     * @param branch The name of the branch that the shared document is in.
     */
    getSharedDocument(recordName: string | null, inst: string, name: string): Promise<SharedDocument>;
    getSharedDocument(recordOrName: string, inst?: string, name?: string): Promise<SharedDocument>;

    /**
    * Gets the list of remote IDs that are connected to the inst.
    */
    remotes(): Promise<string[]>;

    /**
     * Gets the list of updates that have been applied to this inst.
     */
    listInstUpdates(): Promise<InstUpdate[]>;

    /**
     * Gets the inst state that was produced by the given set of updates.
     * @param updates The updates.
     */
    getInstStateFromUpdates(updates: InstUpdate[]): Promise<BotsState>;

    /**
     * Creates an inst update that, when applied, ensures that the given bots have been created on the inst.
     * Inst updates have special properties in that they can be applied multiple times and they will only create one set of bots.
     * This is valuable for situations where you want to ensure that all players observe the same state.
     * @param bots The bots.
     */
     createInitializationUpdate(bots: Bot[]): Promise<InstUpdate>;

    /**
     * Applies the given updates to the inst.
     * Inst updates have special properties in that they can be applied multiple times and they will only create one set of bots.
     * This is valuable for situations where you want to ensure that all players observe the same state.
     * @param updates The updates that should be applied to the inst.
     */
    applyUpdatesToInst(updates: InstUpdate[]): Promise<void>;

    /**
     * Gets the current inst update.
     * 
     * This function is somewhat equivalent to calling os.listInstUpdates() followed by os.mergeInstUpdates(), but it uses the locally available state instead of fetching from the server.
     * This makes it more efficient as well as usable even when the server is not available.
     */
    getCurrentInstUpdate(): Promise<InstUpdate>;

    /**
     * Merges the given instance updates into a single update.
     * @param updates The list of updates to merge.
     */
    mergeInstUpdates(updates: InstUpdate[]): InstUpdate;

    /**
    * Gets the total number of devices that are connected to the server.
    */
    totalRemoteCount(): Promise<number>;

    /**
     * Gets the list of instances that are on the server.
     */
    instances(): Promise<string[]>;

    /**
     * Gets the list of instances that are on the server.
     */
    instStatuses(): Promise<{
        inst: string,
        lastUpdateTime: Date
    }[]>;

    /**
     * Creates a new debugger that can be used to test and simulate bots.
     * @param options The options that should be used for the debugger.
     */
    // createDebugger(options?: PausableDebuggerOptions | NormalDebuggerOptions): Debugger;

    /**
     * Creates a new pausable debugger that can be used to test and simulate bots.
     * @param options The options that should be used for the debugger.
     */
    createDebugger(options: PausableDebuggerOptions): Promise<PausableDebugger>;

    /**
     * Creates a new debugger that can be used to test and simulate bots.
     * @param options The options that should be used for the debugger.
     */
    createDebugger(options: NormalDebuggerOptions): Promise<Debugger>;
    /**
     * Gets the debugger that this script is currently running in.
     */
    getExecutingDebugger(): Debugger | PausableDebugger;

    /**
     * Sends an event to attach the given debugger to the CasualOS frontend.
     * @param debug The debugger that should be attached.
     */
    attachDebugger(debug: Debugger, options?: AttachDebuggerOptions): Promise<void>;

    /**
     * Sends an event to detach the given debugger from the CasualOS frontend.
     * @param debug The debugger that should be detached.
     */
    detachDebugger(debug: Debugger): Promise<void>;

    /**
     * Adds a map layer to the map or miniMap portal.
     * 
     * Returns a promise that resolves with the ID of the layer that was added.
     * 
     * @param portal The portal that the layer should be added to. Either 'map' or 'miniMap'.
     * @param layer The layer that should be added.
     * 
     * @example Add a GeoJSON layer to the map portal
     * const layerId = await os.addMapLayer('map', {
     *    type: 'geojson',
     *    data: {
     *       type: "FeatureCollection",
     *       features: [
     *           {
     *               type: "Feature",
     *               geometry: { type: "Point", coordinates: [102.0, 0.5] },
     *               properties: { prop0: "value0" }
     *           },
     *           {
     *               type: "Feature",
     *               geometry: {
     *                   type: "LineString",
     *                   coordinates: [
     *                       [102.0, 0.0], [103.0, 1.0], [104.0, 0.0], [105.0, 1.0]
     *                   ]
     *               },
     *               properties: {
     *                   prop0: "value0",
     *                   prop1: 0.0
     *               }
     *           },
     *           {
     *               type: "Feature",
     *               geometry: {
     *                   type: "Polygon",
     *                   coordinates: [
     *                       [[100.0, 0.0], [101.0, 0.0], [101.0, 1.0],
     *                       [100.0, 1.0], [100.0, 0.0]]
     *                   ]
     *               },
     *               properties: {
     *                   prop0: "value0",
     *                   prop1: { "this": "that" }
     *               }
     *           }
     *       ]
     *   }
     * });
     * 
     * @dochash action/os/maps
     * @doctitle Map Actions
     * @docsidebar Maps
     * @docdescription Actions for working with maps and map layers.
     * @docid os.addMapLayer
     */
    addMapLayer(portal: 'map' | 'miniMap', layer: MapLayer): Promise<string>;
    
    /**
     * Removes a layer from the map or miniMap portal.
     * 
     * Returns a promise that resolves when the layer has been removed.
     * 
     * @param layerId The ID of the layer to remove.
     * @returns A promise that resolves when the layer has been removed.
     * 
     * @example Remove a layer from the map portal
     * await os.removeMapLayer('my-layer-id');
     * 
     * @dochash action/os/maps
     * @docid os.removeMapLayer
     */
    removeMapLayer(layerId: string): Promise<void>;

    /**
     * The global variables that are stored in the OS.
     */
    vars: typeof globalThis;
}

interface Server {

    /**
     * Executes the given shell script on the server.
     * @param script The shell script that should be executed.
     */
    shell(script: string): ShellAction;

    /**
     * Gets the total number of devices that are connected to the server.
     */
    totalRemoteCount(): Promise<number>;

    /**
     * Gets the list of instances that are on the server.
     */
    instances(): Promise<string[]>;

    /**
     * Gets the list of instances that are on the server.
     */
    instStatuses(): Promise<{
        inst: string,
        lastUpdateTime: Date
    }[]>;
};

interface Web {

    /**
     * Sends an HTTP GET request for the given URL using the given options.
     * @param url The URL to request.
     * @param options The options to use.
     * 
     * @example
     * 
     * // Send a HTTP GET request for https://www.example.com
     * const result = await web.get('https://www.example.com');
     */
    get: MaskFunc<(url: string, options?: WebhookOptions) => Promise<WebhookResult>>;

    /**
     * Sends a HTTP POST request to the given URL with the given data.
     *
     * @param url The URL that the request should be sent to.
     * @param data That that should be sent.
     * @param options The options that should be included in the request.
     *
     * @example
     * 
     * // Send a HTTP POST request to https://www.example.com/api/createThing
     * const result = await web.post('https://www.example.com/api/createThing', {
     *   hello: 'world'
     * });
     * 
     */
    post: MaskFunc<(url: string, data?: any, options?: WebhookOptions) => Promise<WebhookResult>>;

    /**
     * Sends a web request based on the given options.
     * @param options The options that specify where and what to send in the web request.
     *
     * @example
     * 
     * // Send a HTTP GET request to https://example.com
     * const result = await web.hook({
     *   method: 'GET',
     *   url: 'https://example.com'
     * });
     * 
     * os.toast(result);
     */
    hook: MaskFunc<(options: WebhookOptions) => Promise<WebhookResult>>;
};


interface Actions {
    /**
     * Performs the given action.
     * @param action The action to perform.
     */
    perform(action: any): BotAction;

    /**
     * Rejects the given action.
     * @param action The action to reject.
     */
    reject(action: any): BotAction;
};

interface Math {
    /**
     * Sums the given array of numbers and returns the result.
     * If any value in the list is not a number, it will be converted to one.
     * If the given value is not an array, then it will be converted to a number and returned.
     *
     * @param list The value that should be summed. If it is a list, then the result will be the sum of the items in the list.
     *             If it is not a list, then the result will be the value converted to a number.
     */
    sum(list: any): number;

    /**
     * Calculates the average of the numbers in the given list and returns the result.
     * @param list The value that should be averaged.
     *             If it is a list, then the result will be sum(list)/list.length.
     *             If it is not a list, then the result will be the value converted to a number.
     */
    avg(list: any): number;

    /**
     * Calculates the square root of the given number.
     * @param value The number.
     */
    sqrt(value: any): number;

    /**
     * Calculates the absolute value of a number.
     * @param number The number to get the absolute value of.
     */
    abs(number: any): number;

    /**
     * Calculates the standard deviation of the numbers in the given list and returns the result.
     *
     * @param list The value that the standard deviation should be calculated for.
     */
    stdDev(list: any): number;

    /**
     * Creates a new random number generator and returns it.
     * @param seed The value that should be used to seed the random number generator.
     */
    getSeededRandomNumberGenerator(seed?: number | string): PseudoRandomNumberGenerator;

    /**
     * Sets the seed that should be used for random numbers.
     * @param seed The seed that should be used. If given null, then the numbers will be unseeded.
     */
    setRandomSeed(seed: number | string): void;

    /**
     * Generates a random integer number between min and max.
     * @param min The smallest allowed value.
     * @param max The largest allowed value.
     */
    randomInt(min?: number, max?: number): number;

    /**
     * Generates a random number between min and max.
     * @param min The smallest allowed value.
     * @param max The largest allowed value.
     */
    random(min?: number, max?: number): number;

    /**
     * Gets the forward direction for the given rotation.
     * @param pointerRotation The rotation that the pointer has represented in radians.
     */
    getForwardDirection(pointerRotation: RawRotation | Rotation): Vector3;

    /**
     * Finds the point at which the the given ray and ground plane intersect.
     * Returns null if the ray does not intersect the ground plane.
     * @param origin The origin of the ray.
     * @param direction The direction that the ray is pointing.
     * @param planeNormal The direction that the face of the plane is pointing.
     * @param planeOrigin The position that the center of the plane should pass through.
     */
    intersectPlane(origin: Point3D, direction: Point3D, planeNormal?: Point3D, planeOrigin?: Point3D): Vector3;

    /**
     * Gets the position offset for the given bot anchor point.
     * This is useful for doing custom math using anchor points.
     * @param anchorPoint The anchor point to get the offset for.
     */
    getAnchorPointOffset(anchorPoint: BotAnchorPoint): Vector3;

    /**
     * Adds the given vectors together and returns the result.
     * @param vectors The vectors that should be added together.
     */
    addVectors<T>(...vectors: T[]): T;

    /**
     * Subtracts the given vectors from each other and returns the result.
     * @param vectors The vectors that should be subtracted from each other.
     */
    subtractVectors<T>(...vectors: T[]): T;

    /**
     * Negates the given vector and returns the result.
     * @param vector The vector that should be negated.
     */
    negateVector<T>(vector: T): T;

    /**
     * Normalizes the given vector and returns the result.
     * @param vector The vector that should be normalized.
     */
    normalizeVector<T>(vector: T): T;

    /**
     * Calculates the length of the given vector.
     * @param vector The vector to calculate the length of.
     */
    vectorLength<T>(vector: T): number;

    /**
     * Multiplies each component of the given vector by the given scale and returns the result.
     * @param vector The vector that should be scaled.
     * @param scale The number that the vector should be multiplied by.
     */
    scaleVector<T>(vector: T, scale: number): T;
};

interface ModFuncs {
    /**
     * Converts the given 3D point into a mod that sets the cameraPositionOffset tags.
     * @param point The mod that represents the 3D point.
     */
    cameraPositionOffset(point: Partial<Point3D>): {
        cameraPositionOffsetX: number,
        cameraPositionOffsetY: number,
        cameraPositionOffsetZ: number,
    };

    /**
     * Converts the given 3D rotation into a mod that sets the cameraRotationOffset tags.
     * @param rotation The mod that represents the 3D rotation.
     */
    cameraRotationOffset(rotation: Partial<Point3D>): {
        cameraRotationOffsetX: number,
        cameraRotationOffsetY: number,
        cameraRotationOffsetZ: number,
    };
};

interface Bytes {
    /**
     * Converts the given array of bytes into a base64 string.
     * @param bytes The bytes that should be converted into base64.
     */
    toBase64String(bytes: Uint8Array): string;

     /**
      * Converts the given base64 formatted string into an array of bytes.
      * @param base64 The base64 that should be converted to bytes.
      */
    fromBase64String(base64: string): Uint8Array;

    /**
     * Converts the given array of bytes into a hexadecimal string.
     * @param bytes The bytes that should be converted into hex.
     */
    toHexString(bytes: Uint8Array): string;

    /**
     * Converts the given hexadecimal string into an array of bytes.
     * @param hex The hexadecimal string.
     */
    fromHexString(hex: string): Uint8Array;

    /**
     * Converts the given bytes into a string that contains the [Base64](https://en.wikipedia.org/wiki/Base64) [Data URL](https://developer.mozilla.org/en-US/docs/web/http/basics_of_http/data_urls) representation of the given data.
     * @param bytes The data that should be converted to a Base64 Data URL. If given a string, then it should be valid Base 64 data.
     * @param mimeType The [MIME Type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types) of the data.
     * If omitted, then `image/png` will be used.
     * 
     * @example Convert some bytes to a base 64 image/png data URL
     * const data = bytes.toBase64Url(new Uint8Array([ 255, 254, 253 ]));
     * 
     * @example Convert a base 64 string to a text/plain base 64 data URL
     * const data = bytes.toBase64Url('aGVsbG8=', 'text/plain'); // "hello" encoded in Base64
     * 
     * @dochash actions/bytes
     * @docname bytes.toBase64Url
     */
    toBase64Url(bytes: Uint8Array | string, mimeType?: string): string;

    /**
     * Converts the given [Data URL](https://developer.mozilla.org/en-US/docs/web/http/basics_of_http/data_urls) into a blob object.
     * 
     * Returns a blob that contains the binary data. Returns null if the URL is not a valid Data URL.
     * 
     * @param url The URL.
     * 
     * @example Convert a data URL to a blob
     * const blob = bytes.fromBase64Url('data:image/png;base64,aGVsbG8='); // "hello" encoded in Base64
     * 
     * @dochash actions/bytes
     * @docname bytes.fromBase64Url
     */
    fromBase64Url(url: string): Blob;
}

interface Crypto {

    /**
     * Calculates the cryptographic hash for the given data and returns the result in the specified format.
     * @param algorithm The algorithm that should be used to hash the data.
     * @param format The format that the hash should be returned in.
     *               - "hex" indicates that a hexadecimal string should be returned.
     *               - "base64" indicates that a base64 formatted string should be returned.
     *               - "raw" indicates that an array of bytes should be returned.
     * @param data The data that should be hashed.
     */
    hash(algorithm: 'sha256' | 'sha512' | 'sha1', format: 'hex' | 'base64', ...data: unknown[]): string;

    /**
     * Calculates the cryptographic hash for the given data and returns the result in the specified format.
     * @param algorithm The algorithm that should be used to hash the data.
     * @param format The format that the hash should be returned in.
     *               - "hex" indicates that a hexadecimal string should be returned.
     *               - "base64" indicates that a base64 formatted string should be returned.
     *               - "raw" indicates that an array of bytes should be returned.
     * @param data The data that should be hashed.
     */
    hash(algorithm: 'sha256' | 'sha512' | 'sha1', format: 'raw', ...data: unknown[]): Uint8Array;
 
    /**
     * Calculates the cryptographic hash for the given data and returns the result in the specified format.
     * @param algorithm The algorithm that should be used to hash the data.
     * @param format The format that the hash should be returned in.
     *               - "hex" indicates that a hexadecimal string should be returned.
     *               - "base64" indicates that a base64 formatted string should be returned.
     *               - "raw" indicates that an array of bytes should be returned.
     * @param data The data that should be hashed.
     */
    hash(algorithm: 'sha256' | 'sha512' | 'sha1', format: 'hex' | 'base64' | 'raw', ...data: unknown[]): string | Uint8Array;

    /**
     * Calculates the HMAC of the given data and returns the result in the specified format.
     * HMAC is commonly used to verify that a message was created with a specific key.
     * @param algorithm The algorithm that should be used to hash the data.
     * @param format The format that the hash should be returned in.
     *               - "hex" indicates that a hexadecimal string should be returned.
     *               - "base64" indicates that a base64 formatted string should be returned.
     *               - "raw" indicates that an array of bytes should be returned.
     * @param key The key that should be used to sign the message.
     * @param data The data that should be hashed.
     */
    hmac(algorithm: 'hmac-sha256' | 'hmac-sha512' | 'hmac-sha1', format: 'hex' | 'base64', key: string, ...data: unknown[]): string;

    /**
     * Calculates the HMAC of the given data and returns the result in the specified format.
     * HMAC is commonly used to verify that a message was created with a specific key.
     * @param algorithm The algorithm that should be used to hash the data.
     * @param format The format that the hash should be returned in.
     *               - "hex" indicates that a hexadecimal string should be returned.
     *               - "base64" indicates that a base64 formatted string should be returned.
     *               - "raw" indicates that an array of bytes should be returned.
     * @param key The key that should be used to sign the message.
     * @param data The data that should be hashed.
     */
    hmac(algorithm: 'hmac-sha256' | 'hmac-sha512' | 'hmac-sha1', format: 'raw', key: string, ...data: unknown[]): Uint8Array;
 
    /**
     * Calculates the HMAC of the given data and returns the result in the specified format.
     * HMAC is commonly used to verify that a message was created with a specific key.
     * @param algorithm The algorithm that should be used to hash the data.
     * @param format The format that the hash should be returned in.
     *               - "hex" indicates that a hexadecimal string should be returned.
     *               - "base64" indicates that a base64 formatted string should be returned.
     *               - "raw" indicates that an array of bytes should be returned.
     * @param key The key that should be used to sign the message.
     * @param data The data that should be hashed.
     */
    hmac(algorithm: 'hmac-sha256' | 'hmac-sha512' | 'hmac-sha1', format: 'hex' | 'base64' | 'raw', key: string, ...data: unknown[]): string | Uint8Array

    /**
     * Calculates the SHA-256 hash of the given data.
     * Returns the hexadecimal string of the hash.
     * @param data The data that should be hashed.
     */
    sha256(...data: unknown[]): string;

    /**
     * Calculates the SHA-512 hash of the given data.
     * Returns the hexadecimal string of the hash.
     * @param data The data that should be hashed.
     */
    sha512(...data: unknown[]): string;

    /**
     * Calculates the HMAC SHA-256 hash of the given data.
     * HMAC is commonly used to verify that a message was created with a specific key.
     * Returns the hexadecimal string of the hash.
     * @param key The key that should be used to sign the message.
     * @param data The data that should be hashed.
     */
    hmacSha256(key: string, ...data: unknown[]): string;

    /**
     * Calculates the HMAC SHA-512 hash of the given data.
     * HMAC is commonly used to verify that a message was created with a specific key.
     * Returns the hexadecimal string of the hash.
     * @param key The key that should be used to sign the message.
     * @param data The data that should be hashed.
     */
    hmacSha512(key: string, ...data: unknown[]): string;

    /**
     * Encrypts the given data with the given secret and returns the result.
     * 
     * @description Always choose a strong unique secret. Use a password manager such as LastPass or 1Password to
     * help you create and keep track of them.
     * 
     * Assuming the above, this method will return a string of encrypted data that is confidential (unreadable without the secret),
     * reliable (the encrypted data cannot be changed without making it unreadable), and authentic (decryptability proves that the secret was used to encrypt the data).
     * 
     * As a consequence, encrypting the same data with the same secret will produce different results.
     * This is to ensure that an attacker cannot correlate different pieces of data to potentially deduce the original plaintext.
     * 
     * Encrypts the given data using an authenticated encryption mechanism 
     * based on XSalsa20 (An encryption cipher) and Poly1305 (A message authentication code).
     * 
     * @param secret The secret to use to secure the data.
     * @param data The data to encrypt.
     */
    encrypt(secret: string, data: string): string;

    /**
     * Decrypts the given data using the given secret and returns the result.
     * If the data was unable to be decrypted, null will be returned.
     *
     * @param secret The secret to use to decrypt the data.
     * @param data The data to decrypt.
     */
    decrypt(secret: string, data: string): string;

    /**
     * Determines if the given value has been encrypted with symmetric encryption.
     * @param cyphertext The value to test to see if it is encrypted.
     */
    isEncrypted(cyphertext: string): boolean;

    /**
     * Contains functions useful for asymmetric encryption.
     */
    asymmetric: {
        /**
         * Creates a new keypair that can be used for encrypting and decrypting data.
         *
         * @description Always choose a strong unique secret. Use a password manager such as LastPass or 1Password to
         * help you create and keep track of them.
         * 
         * Keypairs are made up of a private key and a public key.
         * The public key is a special value that can be used to encrypt data and 
         * the private key is a related value that can be used to decrypt data that was encrypted by the public key.
         *
         * The private key is called "private" because it is encrypted using the given secret
         * while the public key is called "public" because it is not encrypted so anyone can use it if they have access to it.
         *
         * Note that both the private and public keys are randomly generated, so while the public key is unencrypted, it won't be able to be used by someone else unless
         * they have access to it.
         *
         * @param secret The secret that should be used to encrypt the private key.
         */
        keypair(secret: string): string;

        /**
         * Determines if the given value is a keypair that can be used to encrypt and decrypt data using
         * asymmetric encryption.
         * @param keypair The value to test to see if it is a keypair that can be used for asymmetric encryption.
         */
        isKeypair(keypair: string): boolean;

        /**
         * Encrypts the given data with the given keypair and returns the result.
         *
         * @description This method will return a string of encrypted data that is confidential (unreadable without the keypair and secret used to encrypt it),
         * reliable (the encrypted data cannot be changed without making it unreadable), and authentic (decryptability proves that the keypair was used to encrypt the data).
         *
         * As a consequence, encrypting the same data with the same keypair will produce different results.
         * This is to ensure that an attacker cannot correlate different pieces of data to potentially deduce the original plaintext.
         *
         * Encrypts the given data using an asymmetric authenticated encryption mechanism
         * based on x25519 (A key-exchange mechanism), XSalsa20 (An encryption cipher) and Poly1305 (A message authentication code).
         * 
         * You may notice that this function does not need a secret to decrypt the keypair.
         * This is because the public key of the keypair is used to encrypt the data.
         * Due to how asymmetric encryption works, only the encrypted private key will be able to decrypt the data.
         *
         * @param keypair The keypair to use to secure the data.
         * @param data The data to encrypt.
         */
        encrypt(keypair: string, data: string): string;

        /**
         * Decrypts the given data with the given keypair and secret and returns the result.
         * If the data was unable to be decrypted, null will be returned.
         *
         * @param keypair The keypair to use to decrypt the data.
         * @param secret The secret to use to decrypt the keypair's private key.
         * @param data The data to decrypt.
         */
        decrypt(keypair: string, secret: string, data: string): string;

        /**
         * Determines if the given value is encrypted using asymmetric encryption.
         * @param cyphertext The value to test to see if it is encrypted.
         */
        isEncrypted(cyphertext: string): boolean;
    };

    /**
     * Creates a new keypair that can be used for signing and verifying data.
     *
     * @description
     * Keypairs are made up of a private key and a public key.
     * The private key is a special value that can be used to create digital signatures and
     * the public key is a related value that can be used to verify that a digitital signature was created by the private key.
     *
     * The private key is called "private" because it is encrypted using the given secret
     * while the public key is called "public" because it is not encrypted so anyone can use it if they have access to it.
     *
     * Note that both the private and public keys are randomly generated, so while the public is unencrypted, it won't be able to be used by someone else unless
     * they have access to it.
     *
     * @param secret The secret that should be used to encrypt the private key.
     */
    keypair(secret: string): string;

    /**
     * Creates a digital signature for the given data using the private key from the given keypair.
     *
     * @description
     * Digital signatures are used to verifying the authenticity and integrity of data.
     *
     * This works by leveraging asymetric encryption but in reverse.
     * 
     * If we can encrypt some data such that only the public key of a keypair can decrypt it, then we can prove that
     * the data was encrypted (i.e. signed) by the corresponding private key.
     * 
     * And since the public key is available to everyone but the private
     * key is only usable when you have the secret, we can use this to prove that a particular piece of data was signed by whoever knows the secret.
     *
     * @param keypair The keypair that should be used to create the signature.
     * @param secret The secret that was used when creating the keypair. Used to decrypt the private key.
     * @param data The data to sign.
     */
    sign(keypair: string, secret: string, data: string): string;

    /**
     * Validates that the given signature for the given data was created by the given keypair.
     * @param keypair The keypair that should be used to validate the signature.
     * @param signature The signature that was returned by the sign() operation.
     * @param data The data that was used in the sign() operation.
     */
    verify(keypair: string, signature: string, data: string): boolean;

    /**
     * Creates a new certified bot that is signed using the given certified bot.
     * @param certificate The certified bot that the new certificate should be signed with. 
     *                    This is commonly known as the signing certificate.
     *                    If given null, then the new certificate will be self-signed.
     * @param secret The signing certificate's secret. This is the secret that was used to create
     *                 the keypair for the signing certificate. If the new certificate will be self-signed, then this
     *                 is the secret that was used to create the given keypair.
     * @param keypair The keypair that the new certificate should use.
     */
    createCertificate(certificate: Bot | string, secret: string, keypair: string): Promise<Bot>;

    /**
     * Signs the tag on the given bot using the given certificate and secret.
     * @param certificate The certificate to use to create the signature.
     * @param secret The secret to use to decrypt the certificate's private key.
     * @param bot The bot that should be signed.
     * @param tag The tag that should be signed.
     */
    signTag(certificate: Bot | string, secret: string, bot: Bot | string, tag: string): Promise<void>;

    /**
     * Verifies that the given tag on the given bot has been signed by a certificate.
     * @param bot The bot.
     * @param tag The tag to check.
     */
    verifyTag(bot: Bot | string, tag: string): boolean;

    /**
     * Revokes the given certificate using the given secret.
     * In effect, this deletes the certificate bot from the server.
     * Additionally, any tags signed with the given certificate will no longer be verified.
     * 
     * If given a signer, then the specified certificate will be used to sign the revocation.
     * This lets you use a parent or grandparent certificate to remove the child.
     * 
     * If no signer is given, then the certificate will be used to revoke itself.
     * 
     * @param certificate The certificate that should be revoked.
     * @param secret The secret that should be used to decrypt the corresponding certificate's private key.
     *                 If given a signer, then this is the secret for the signer certificate. If no signer is given,
     *                 then this is the secret for the revoked certificate.
     * @param signer The certificate that should be used to revoke the aforementioned certificate. If not specified then the revocation will be self-signed.
     */
    revokeCertificate(certificate: Bot | string, secret: string, signer?: Bot | string): Promise<void>;
};

interface Experiment {
    /**
     * Plays the given animation on the given bot locally.
     * Reverts back to the original animation when done playing.
     * @param bot The bot.
     * @param animation The animation to play.
     */
    localFormAnimation(
        bot: Bot | string,
        animation: string | number
    ): LocalFormAnimationAction;

    /**
     * Tweens the position of the given bot.
     * @param bot The bot or bot ID to tween.
     * @param dimension The dimension that the bot should be tweened in.
     * @param position The position that the bot should be tweened to.
     * @param options The options that should be used for the tween.
     */
    localPositionTween(
        bot: Bot | string,
        dimension: string,
        position: { x?: number, y?: number, z?: number },
        options?: TweenOptions
    ): LocalPositionTweenAction;

    /**
     * Tweens the rotation of the given bot.
     * @param bot The bot or bot ID to tween.
     * @param dimension The dimension that the bot should be tweened in.
     * @param rotation The rotation that the bot should be tweened to.
     * @param options The options that should be used for the tween.
     */
    localRotationTween(
        bot: Bot | string,
        dimension: string,
        rotation: { x?: number, y?: number, z?: number },
        options?: TweenOptions
    ): LocalRotationTweenAction;

    /**
     * Gets the position that the center of the given bot would placed at if the bot was using the given anchor point.
     * @param bot The bot.
     * @param dimension The dimension to get the position of.
     * @param anchorPoint The anchor point.
     */
    getAnchorPointPosition(
        bot: Bot,
        dimension: string,
        anchorPoint: BotAnchorPoint
    ): { x: number, y: number, z: number };

    /**
     * Creates a HTML file that, when loaded, will display the given bots in a static version of CasualOS.
     *
     * Returns a promise that resolves with a string containing the HTML file.
     * Resolves with null if the HTML file could not be created.
     *
     * @param bots the bots that should be displayed in the static version of CasualOS.
     * @param templateUrl the URL that the static HTML template file can be found at. If omitted, then the template from the server will be used.
     *
     * @example Create a static HTML file and download it.
     * const bots = getBots(inDimension('home'));
     * const html = await experiment.createStaticHtmlFromBots(bots);
     * await os.download(html, 'static.html');
     *
     * @dochash actions/experimental
     * @docname experiment.createStaticHtmlFromBots
     */
    createStaticHtmlFromBots(
        bots: Bot[],
        templateUrl?: string
    ): Promise<string>;

    /**
     * Starts a new recording.
     * @param options The options for the recording.
     * @returns A promise that resolves when the recording has started.
     */
    beginRecording(options?: RecordingOptions): Promise<void>;

    /**
     * Finishes a recording.
     * Returns a promise that resolves with the recorded data.
     */
    endRecording(): Promise<Recording>;

    /**
     * Speaks the given text.
     * Returns a promise that resolves when the text has been spoken.
     * @param text The text that should be spoken.
     * @param options The options that should be used.
     */
    speakText(text: string, options?: { rate?: number, pitch?: number, voice?: string | SyntheticVoice }): Promise<void>;

    /**
     * Gets the list of synthetic voices that are supported by the system.
     * Returns a promise that resolves with the voices.
     */
    getVoices(): Promise<SyntheticVoice[]>;
};


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

interface Loom {
    /**
     * Records a loom video using the given options.
     * 
     * Returns a promise that resolves with the video data.
     * Resolves with null if the video could not be recorded.
     * 
     * **Note:** Loom requires third-party cookies to be enabled. If third-party cookies are not enabled, then the Loom recording will not work.
     *
     * @param options The options to use for recording the video.
     * 
     * @example Record a loom video using the "SDK Standard".
     * const video = await loom.recordVideo({
     *     publicAppId: 'your-app-id'
     * });
     * 
     * @example Record a loom video using the "SDK Custom".
     * const video = await loom.recordVideo({
     *     recordName: 'your-record-name',
     * });
     * 
     * @dochash actions/loom
     * @doctitle Loom Actions
     * @docsidebar Loom
     * @docdescription Loom actions are useful for recording and sharing videos over loom.
     * @docname loom.recordVideo
     */
    recordVideo(options: RecordLoomOptions): Promise<LoomVideo>;

    /**
     * Displays the given loom video to the user.
     * 
     * Returns a promise that resolves when the video has been loaded.
     * 
     * @param video the loom video that should be displayed.
     * 
     * @example Display a loom video.
     * const video = await loom.recordVideo({
     *   publicAppId: 'your-app-id'
     * });
     * await loom.watchVideo(video);
     * 
     * @dochash actions/loom
     * @docname loom.watchVideo
     * @docid loom.watchVideo-video
     */
    watchVideo(video: LoomVideo): Promise<void>;

    /**
     * Displays the given loom video to the user.
     * 
     * Returns a promise that resolves when the video has been loaded.
     * 
     * @param sharedUrl the shared URL of the loom video that should be displayed.
     * 
     * @example Display a loom video by its URL.
     * await loom.watchVideo(videoUrl);
     * 
     * @dochash actions/loom
     * @docname loom.watchVideo
     * @docid loom.watchVideo-sharedUrl
     */
    watchVideo(sharedUrl: string): Promise<void>;
    
    watchVideo(sharedUrlOrVideo: string | LoomVideo): Promise<void>;

    /**
     * Gets the embed metadata for the given loom video.
     * 
     * @param video the loom video that the embed metadata should be retrieved for.
     * 
     * @example Get the embed metadata for a loom video.
     * const video = await loom.recordVideo({
     *   publicAppId: 'your-app-id'
     * });
     * const metadata = await loom.getVideoEmbedMetadata(video);
     * 
     * @dochash actions/loom
     * @docname loom.getVideoEmbedMetadata
     * @docid loom.getVideoEmbedMetadata-video
     */
    getVideoEmbedMetadata(video: LoomVideo): Promise<LoomVideoEmbedMetadata>

    /**
     * Gets the embed metadata for the given loom video.
     * 
     * @param sharedUrl the shared URL of the the video that the embed metadata should be retrieved for.
     * 
     * @example Get the embed metadata for a loom video.
     * const metadata = await loom.getVideoEmbedMetadata(videoUrl);
     * 
     * @dochash actions/loom
     * @docname loom.getVideoEmbedMetadata
     * @docid loom.getVideoEmbedMetadata-sharedUrl
     */
    getVideoEmbedMetadata(sharedUrl: string): Promise<LoomVideoEmbedMetadata>;
    getVideoEmbedMetadata(sharedUrlOrVideo: string | LoomVideo): Promise<LoomVideoEmbedMetadata>;
}

interface Perf {
    /**
     * Gets the performance stats for the instance.
     */
    getStats(): PerformanceStats;
};

interface Analytics {
    /**
     * Attempts to record the given event to the analytics system.
     * @param name The name of the event.
     * @param metadata The metadata to include in the event. Optional.
     */
    recordEvent(name: string, metadata?: any): Promise<void>;
}
