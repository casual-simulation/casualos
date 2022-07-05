import {
    AuxGlobalContext,
    AsyncTask,
    BotTimer,
    TimeoutOrIntervalTimer,
    DEBUG_STRING,
    debugStringifyFunction,
} from './AuxGlobalContext';
import {
    hasValue,
    trimTag,
    isBot,
    BotTags,
    Bot,
    BOT_SPACE_TAG,
    toast as toastMessage,
    tip as tipMessage,
    hideTips as hideTipMessages,
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
    getMediaPermission as calcGetMediaPermission,
    getAverageFrameRate as calcGetAverageFrameRate,
    enableAR as calcEnableAR,
    disableAR as calcDisableAR,
    enableVR as calcEnableVR,
    disableVR as calcDisableVR,
    arSupported as calcARSupported,
    vrSupported as calcVRSupported,
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
    bufferSound as calcBufferSound,
    cancelSound as calcCancelSound,
    setupServer as calcSetupServer,
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
    registerPrefix as calcRegisterPrefix,
    createCertificate as calcCreateCertificate,
    signTag as calcSignTag,
    revokeCertificate as calcRevokeCertificate,
    localPositionTween as calcLocalPositionTween,
    localRotationTween as calcLocalRotationTween,
    animateTag as calcAnimateTag,
    showUploadFiles as calcShowUploadFiles,
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
    getRemoteCount,
    getServers,
    getRemotes,
    listInstUpdates as calcListInstUpdates,
    getInstStateFromUpdates as calcGetInstStateFromUpdates,
    action,
    getServerStatuses,
    setSpacePassword,
    rpioInitPin,
    rpioExitPin,
    rpioOpenPin,
    rpioModePin,
    rpioReadPin,
    rpioReadSequencePin,
    rpioWritePin,
    rpioWriteSequencePin,
    rpioReadpadPin,
    rpioWritepadPin,
    rpioPudPin,
    rpioPollPin,
    rpioClosePin,
    rpioI2CBeginPin,
    rpioI2CSetSlaveAddressPin,
    rpioI2CSetBaudRatePin,
    rpioI2CSetClockDividerPin,
    rpioI2CReadPin,
    rpioI2CWritePin,
    // rpioI2CReadRegisterRestartPin,
    // rpioI2CWriteReadRestartPin,
    rpioI2CEndPin,
    rpioPWMSetClockDividerPin,
    rpioPWMSetRangePin,
    rpioPWMSetDataPin,
    rpioSPIBeginPin,
    rpioSPIChipSelectPin,
    rpioSPISetCSPolarityPin,
    rpioSPISetClockDividerPin,
    rpioSPISetDataModePin,
    rpioSPITransferPin,
    rpioSPIWritePin,
    rpioSPIEndPin,
    serialConnectPin,
    serialOpenPin,
    serialStreamPin,
    serialUpdatePin,
    serialWritePin,
    serialReadPin,
    serialClosePin,
    serialFlushPin,
    serialDrainPin,
    serialPausePin,
    serialResumePin,
    Easing,
    LocalPositionTweenAction,
    LocalRotationTweenAction,
    BotAnchorPoint,
    calculateAnchorPoint,
    calculateAnchorPointOffset,
    getBotPosition as calcGetBotPosition,
    getBotRotation as calcGetBotRotation,
    RuntimeBot,
    isRuntimeBot,
    SET_TAG_MASK_SYMBOL,
    CLEAR_TAG_MASKS_SYMBOL,
    getBotScale,
    EDIT_TAG_SYMBOL,
    BotSpace,
    EDIT_TAG_MASK_SYMBOL,
    AnimateTagOptions,
    EaseType,
    RegisterPrefixOptions,
    OpenCircleWipeOptions,
    circleWipe,
    addDropSnap as calcAddDropSnap,
    addDropGrid as calcAddDropGrid,
    SuperShoutAction,
    ShowToastAction,
    ShowJoinCodeAction,
    RequestFullscreenAction,
    ExitFullscreenAction,
    ShowHtmlAction,
    HideHtmlAction,
    SetClipboardAction,
    FocusOnBotAction,
    ShowChatBarAction,
    EnableARAction,
    EnableVRAction,
    DownloadAction,
    ShowUploadAuxFileAction,
    OpenQRCodeScannerAction,
    ShowQRCodeAction,
    OpenBarcodeScannerAction,
    ShowBarcodeAction,
    LoadServerAction,
    UnloadServerAction,
    ImportAUXAction,
    ReplaceDragBotAction,
    ShowInputForTagAction,
    GoToDimensionAction,
    GoToURLAction,
    OpenURLAction,
    OpenConsoleAction,
    StartCheckoutAction,
    FinishCheckoutAction,
    ShowUploadFilesAction,
    ApplyStateAction,
    RejectAction,
    FocusOnOptions,
    animateToPosition,
    AsyncAction,
    beginAudioRecording as calcBeginAudioRecording,
    endAudioRecording as calcEndAudioRecording,
    beginRecording as calcBeginRecording,
    endRecording as calcEndRecording,
    speakText as calcSpeakText,
    getVoices as calcGetVoices,
    getGeolocation as calcGetGeolocation,
    cancelAnimation,
    SnapTarget,
    AddDropSnapTargetsAction,
    RecordingOptions,
    Recording,
    SyntheticVoice,
    SpeakTextOptions,
    EnablePOVAction,
    disablePOV,
    enablePOV,
    EnableCustomDraggingAction,
    enableCustomDragging as calcEnableCustomDragging,
    MINI_PORTAL,
    registerCustomApp,
    setAppOutput,
    SetAppOutputAction,
    unregisterCustomApp,
    requestAuthData as calcRequestAuthData,
    AuthData,
    createBot,
    defineGlobalBot as calcDefineGlobalBot,
    TEMPORARY_BOT_PARTITION_ID,
    Record,
    RecordReference,
    convertToString,
    GET_TAG_MASKS_SYMBOL,
    PartialBotsState,
    PartialBot,
    isBotLink,
    parseBotLink,
    createBotLink,
    ParsedBotLink,
    convertGeolocationToWhat3Words as calcConvertGeolocationToWhat3Words,
    ConvertGeolocationToWhat3WordsOptions,
    getPublicRecordKey as calcGetPublicRecordKey,
    recordData as calcRecordData,
    getRecordData,
    eraseRecordData,
    recordFile as calcRecordFile,
    BeginAudioRecordingAction,
    eraseFile as calcEraseFile,
    meetCommand as calcMeetCommand,
    MeetCommandAction,
    meetFunction as calcMeetFunction,
    listDataRecord,
    recordEvent as calcRecordEvent,
    getEventCount as calcGetEventCount,
    MediaPermssionOptions,
    MediaPermissionAction,
    openImageClassifier as calcOpenImageClassifier,
    OpenImageClassifierAction,
    ImageClassifierOptions,
    isBotDate,
    DATE_TAG_PREFIX,
    parseBotDate,
    SnapGrid,
    AddDropGridTargetsAction,
    DataRecordOptions,
    RecordActionOptions,
    realNumberOrDefault,
    joinRoom as calcJoinRoom,
    leaveRoom as calcLeaveRoom,
    setRoomOptions as calcSetRoomOptions,
    getRoomOptions as calcGetRoomOptions,
    getRoomTrackOptions as calcGetRoomTrackOptions,
    setRoomTrackOptions as calcSetRoomTrackOptions,
    getRoomRemoteOptions as calcGetRoomRemoteOptions,
    JoinRoomActionOptions,
    RoomOptions,
    RoomTrackOptions,
    SetRoomTrackOptions,
    RoomRemoteOptions,
    InstUpdate,
    raycastFromCamera as calcRaycastFromCamera,
    raycastInPortal as calcRaycastInPortal,
    calculateRayFromCamera as calcCalculateRayFromCamera,
} from '../bots';
import { sortBy, every, cloneDeep, union, isEqual, flatMap } from 'lodash';
import {
    remote as calcRemote,
    DeviceSelector,
    RemoteAction,
} from '@casual-simulation/causal-trees';
import { RanOutOfEnergyError } from './AuxResults';
import '../polyfill/Array.first.polyfill';
import '../polyfill/Array.last.polyfill';
import {
    convertToCopiableValue,
    embedBase64InPdf,
    formatAuthToken,
    getEasing,
    getEmbeddedBase64FromPdf,
    toHexString as utilToHexString,
    fromHexString as utilFromHexString,
} from './Utils';
import {
    sha256 as hashSha256,
    sha512 as hashSha512,
    hmac as calcHmac,
    sha1 as hashSha1,
} from 'hash.js';
import stableStringify from '@casual-simulation/fast-json-stable-stringify';
import {
    encrypt as realEncrypt,
    decrypt as realDecrypt,
    keypair as realKeypair,
    sign as realSign,
    verify as realVerify,
    asymmetricKeypair as realAsymmetricKeypair,
    asymmetricEncrypt as realAsymmetricEncrypt,
    asymmetricDecrypt as realAsymmetricDecrypt,
    isAsymmetricKeypair,
    isAsymmetricEncrypted,
    isEncrypted,
} from '@casual-simulation/crypto';
import { tagValueHash } from '../aux-format-2/AuxOpTypes';
import { apply, del, insert, isTagEdit, preserve } from '../aux-format-2';
import {
    Euler,
    Vector3 as ThreeVector3,
    Plane,
    Ray,
    RGBA_ASTC_10x10_Format,
} from '@casual-simulation/three';
import mime from 'mime';
import TWEEN from '@tweenjs/tween.js';
import './PerformanceNowPolyfill';
import './BlobPolyfill';
import { AuxDevice } from './AuxDevice';
import { AuxVersion } from './AuxVersion';
import { Vector3, Vector2, Quaternion, Rotation } from '../math';
import { Fragment, h } from 'preact';
import htm from 'htm';
import { fromByteArray, toByteArray } from 'base64-js';
import expect, { iterableEquality, Tester } from '@casual-simulation/expect';
import {
    CreatePublicRecordKeyResult,
    GetDataResult,
    parseRecordKey,
    RecordDataResult,
    RecordFileFailure,
    RecordFileResult,
    isRecordKey as calcIsRecordKey,
    EraseDataResult,
    EraseFileResult,
    ListDataResult,
    AddCountResult,
    GetCountResult,
} from '@casual-simulation/aux-records';
import SeedRandom from 'seedrandom';
import { DateTime } from 'luxon';

const _html: HtmlFunction = htm.bind(h) as any;

const html: HtmlFunction = ((...args: any[]) => {
    return _html(...args);
}) as any;
(<any>html).h = h;
(<any>html).f = Fragment;

/**
 * Defines an interface for a function that provides HTML VDOM capabilities to bots.
 */
export interface HtmlFunction {
    (...args: any[]): any;
    h: (name: string | Function, props: any, ...children: any[]) => any;
    f: any;
}

/**
 * Defines an interface for a library of functions and values that can be used by formulas and listeners.
 */
export interface AuxLibrary {
    /**
     * The functions that are part of the general API.
     */
    api: {
        whisper(
            bot: (Bot | string)[] | Bot | string,
            eventName: string,
            arg?: any
        ): any[];
        shout(name: string, arg?: any): any[];
        __energyCheck(): void;
        [key: string]: any;
    };

    /**
     * The functions that are part of the bot-specific API.
     */
    tagSpecificApi: {
        [key: string]: (options: TagSpecificApiOptions) => any;
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
 * The status codes that should be used to retry web requests.
 */
const DEFUALT_RETRY_STATUS_CODES: number[] = [
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
    0, // Network Failure / CORS
];

/**
 * The time to wait until another web request retry unless specified by the webhook options.
 * Defaults to 3 seconds.
 */
const DEFAULT_RETRY_AFTER_MS = 3 * 1000;

/**
 * The maximum amount of time to wait before giving up on a set of requests.
 * Defaults to 1 minute.
 */
const MAX_RETRY_AFTER_MS = 60 * 60 * 1000;

/**
 * The maximum number of times that a web request should be retried for.
 */
const MAX_RETRY_COUNT = 10;

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

    /**
     * The number of retries that should be attempted for the webhook.
     */
    retryCount?: number;

    /**
     * The HTTP response status codes that should allow the web request to be retried.
     */
    retryStatusCodes?: number[];

    /**
     * The number of miliseconds to wait between retry requests.
     */
    retryAfterMs?: number;
}

/**
 * Defines a set of options for animateTag().
 */
export interface AnimateTagFunctionOptions {
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

export interface BotFilterFunction {
    (bot: Bot): boolean;
    sort?: (bot: Bot) => any;
    [DEBUG_STRING]?: string;
}

export interface RecordFilter {
    recordFilter: true;
    [DEBUG_STRING]?: string;
}

export interface AuthIdRecordFilter extends RecordFilter {
    authID: string;
}

export interface SpaceFilter extends BotFilterFunction, RecordFilter {
    space: string;
    toJSON: () => RecordFilter;
}

export interface AddressRecordFilter extends RecordFilter {
    address: string;
}

export interface IDRecordFilter extends BotFilterFunction, RecordFilter {
    id: string;
    toJSON: () => RecordFilter;
}

export type RecordFilters =
    | AuthIdRecordFilter
    | SpaceFilter
    | AddressRecordFilter
    | IDRecordFilter
    | RecordReference;

/**
 * Defines a set of options for a tween.
 */
export interface TweenOptions {
    /**
     * The easing for the tween.
     */
    easing?: Easing;

    /**
     * The duration of the tween in seconds.
     */
    duration?: number;
}

/**
 * Defines an interface that contains performance statistics about a inst.
 */
export interface PerformanceStats {
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
}

/**
 * Options needed for the Bot-specific API.
 */
export interface TagSpecificApiOptions {
    /**
     * The Bot that the API is for.
     */
    bot: Bot;
    /**
     * The tag that the API is for.
     */
    tag: string;

    /**
     * The bot that is set as the creator of the current bot.
     */
    creator: RuntimeBot;

    /**
     * The bot that is set as the config of the current bot.
     */
    config: RuntimeBot;
}

/**
 * Defines an interface that represents a set of records that were retrieved.
 */
export interface GetRecordsResult {
    /**
     * The set of records that were retrieved.
     */
    records: Record[];

    /**
     * The total number of records that the query would have returned.
     */
    totalCount: number;

    /**
     * Whether there are more records available to retrieve for the query.
     */
    hasMoreRecords: boolean;

    /**
     * Gets the set page of records.
     */
    getMoreRecords(): Promise<GetRecordsResult>;
}

/**
 * Defines an interface that contains options for an aux debugger.
 */
export interface AuxDebuggerOptions {
    /**
     * Whether to use "real" UUIDs instead of predictable ones.
     */
    useRealUUIDs: boolean;

    /**
     * Whether to allow scripts to be asynchronous.
     * If false, then all scripts will be forced to be synchronous.
     * Defaults to false.
     */
    allowAsynchronousScripts: boolean;

    /**
     * The data that the configBot should be created from.
     * Can be a mod or another bot.
     */
    configBot: Bot | BotTags;
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

export interface MaskableFunction {
    mask(...args: any[]): MaskedFunction;
}

export interface MaskedFunction {
    returns(value: any): void;
}

export interface WebhookInterface extends MaskableFunction {
    (options: WebhookOptions): void;
    post: ((
        url: string,
        data?: any,
        options?: WebhookOptions
    ) => Promise<any>) &
        MaskableFunction;
}

/**
 * Defines an interface that represents the result of a webhook.
 */
export interface WebhookResult {
    /**
     * The data that was returned from the webhook.
     */
    data: any;

    /**
     * The HTTP Status Code that was returned from the webhook.
     * See https://developer.mozilla.org/en-US/docs/Web/HTTP/Status for more information.
     */
    status: number;

    /**
     * The HTTP Headers that were included in the response.
     * See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers for more information.
     */
    headers: {
        [name: string]: string;
    };
}

export type RecordFileApiResult = RecordFileApiSuccess | RecordFileApiFailure;

export interface RecordFileApiSuccess {
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

export interface RecordFileApiFailure {
    success: false;
    errorCode:
        | RecordFileFailure['errorCode']
        | 'file_already_exists'
        | 'invalid_file_data';
    errorMessage: string;
}

export interface SnapGridTarget {
    /**
     * The 3D position that the grid should appear at.
     */
    position?: { x: number; y: number; z: number };

    /**
     * The 3D rotation that the grid should appear at.
     */
    rotation?: { x: number; y: number; z: number; w?: number };

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
    bounds?: { x: number; y: number };

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
}

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

export type SetRoomOptionsResult =
    | SetRoomOptionsSuccess
    | SetRoomOptionsFailure;

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

export type GetRoomOptionsResult =
    | GetRoomOptionsSuccess
    | GetRoomOptionsFailure;

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

const botsEquality: Tester = function (first: unknown, second: unknown) {
    if (isRuntimeBot(first) && isRuntimeBot(second)) {
        expect(getBotSnapshot(first)).toEqual(getBotSnapshot(second));
        return true;
    }
    return undefined;
};

expect.extend({
    toEqual(received: unknown, expected: unknown) {
        // Copied from https://github.com/facebook/jest/blob/7bb400c373a6f90ba956dd25fe24ee4d4788f41e/packages/expect/src/matchers.ts#L580
        // Added the testBots matcher to make testing against bots easier.
        const matcherName = 'toEqual';
        const options = {
            comment: 'deep equality',
            isNot: this.isNot,
            promise: this.promise,
        };

        const pass = this.equals(received, expected, [
            botsEquality,
            iterableEquality,
        ]);

        const message = pass
            ? () =>
                  this.utils.matcherHint(
                      matcherName,
                      undefined,
                      undefined,
                      options
                  ) +
                  '\n\n' +
                  `Expected: not ${this.utils.printExpected(expected)}\n` +
                  (this.utils.stringify(expected) !==
                  this.utils.stringify(received)
                      ? `Received:     ${this.utils.printReceived(received)}`
                      : '')
            : () =>
                  this.utils.matcherHint(
                      matcherName,
                      undefined,
                      undefined,
                      options
                  ) +
                  '\n\n' +
                  this.utils.printDiffOrStringify(
                      expected,
                      received,
                      'Expected',
                      'Received',
                      this.expand !== false
                  );

        // Passing the actual and expected objects so that a custom reporter
        // could access them, for example in order to display a custom visual diff,
        // or create a different error message
        return { actual: received, expected, message, name: matcherName, pass };
    },
});

function getBotSnapshot(bot: Bot) {
    let b = {
        id: bot.id,
        space: bot.space,
        tags:
            typeof bot.tags.toJSON === 'function'
                ? bot.tags.toJSON()
                : bot.tags,
    } as Bot;

    let masks = isRuntimeBot(bot)
        ? bot[GET_TAG_MASKS_SYMBOL]()
        : cloneDeep(bot.masks ?? {});
    if (Object.keys(masks).length > 0) {
        b.masks = masks;
    }
    return b;
}

/**
 * Defines an interface that represents the set of additional options that can be provided when recording a file.
 */
export interface RecordFileOptions {
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

const DEAD_RECKONING_OFFSET = 50;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Creates a library that includes the default functions and APIs.
 * @param context The global context that should be used.
 */
export function createDefaultLibrary(context: AuxGlobalContext) {
    // TODO: Remove deprecated functions
    webhook.post = function (
        url: string,
        data?: any,
        options?: WebhookOptions
    ) {
        return webhook({
            ...options,
            method: 'POST',
            url: url,
            data: data,
        });
    };

    const webhookFunc = makeMockableFunction(webhook, 'webhook');
    webhookFunc.post = makeMockableFunction(webhook.post, 'webhook.post');

    const shoutImpl: {
        (name: string, arg?: any): any[];
        [name: string]: (arg?: any) => any[];
    } = shout as any;

    const shoutProxy = new Proxy(shoutImpl, {
        get(target, name: string, reciever) {
            return (arg?: any) => {
                return shout(name, arg);
            };
        },
    });

    return {
        api: {
            getBots,
            getBot,
            getBotTagValues,
            getMod,
            getBotPosition,
            getBotRotation,
            getID,
            getJSON,
            getFormattedJSON,
            getSnapshot,
            diffSnapshots,
            applyDiffToSnapshot,

            getTag,
            setTag,
            setTagMask,
            clearTagMasks,
            insertTagText,
            insertTagMaskText,
            deleteTagText,
            deleteTagMaskText,
            removeTags,
            renameTag,
            applyMod,
            subtractMods,

            destroy,
            changeState,
            getLink: createBotLinkApi,
            getBotLinks,
            updateBotLinks,

            getDateTime,
            DateTime,

            Vector2,
            Vector3,
            Quaternion,
            Rotation,

            superShout,
            priorityShout,
            shout: shoutProxy,
            whisper,

            byTag,
            byID,
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
            sendRemoteData: remoteWhisper,
            remoteWhisper,
            remoteShout,
            uuid,
            animateTag,
            clearAnimations,

            // TODO: Remove deprecated functions
            webhook: <WebhookInterface>(<any>webhookFunc),
            sleep,

            __energyCheck,
            clearTimeout,
            clearInterval,
            clearWatchBot,
            clearWatchPortal,
            assert,
            assertEqual,
            expect,

            html,

            os: {
                sleep,
                toast,
                tip,
                hideTips,
                showJoinCode,
                requestFullscreenMode,
                exitFullscreenMode,
                showHtml,
                hideHtml,
                setClipboard,
                tweenTo,
                moveTo,
                focusOn,
                showChat,
                hideChat,
                run,
                version,
                device,
                isCollaborative,
                getAB1BootstrapURL,
                enableAR,
                disableAR,
                enableVR,
                disableVR,
                arSupported,
                vrSupported,
                enablePointOfView,
                disablePointOfView,
                download: downloadData,
                downloadBots,

                downloadServer,
                downloadInst: downloadServer,

                showUploadAuxFile,
                showUploadFiles,
                openQRCodeScanner,
                closeQRCodeScanner,
                showQRCode,
                hideQRCode,
                openBarcodeScanner,
                closeBarcodeScanner,
                showBarcode,
                hideBarcode,

                openImageClassifier,
                closeImageClassifier,

                /**
                 * Gets the local device time in Miliseconds since January 1st 1970 UTC-0.
                 */
                get localTime() {
                    return Date.now();
                },

                /**
                 * Gets the current agreed upon inst time in miliseconds since January 1st 1970 UTC-0.
                 */
                get agreedUponTime() {
                    return Date.now() + context.instTimeOffset;
                },

                /**
                 * Gets the calculated latency (in miliseconds) between this device and the inst server.
                 */
                get instLatency() {
                    return context.instLatency;
                },

                /**
                 * Gets the calculated time offset between this device and the inst server in miliseconds.
                 */
                get instTimeOffset() {
                    return context.instTimeOffset;
                },

                /**
                 * Gets the maximum spread between time offset samples in miliseconds.
                 * Useful for determining how closely the agreedUponTime matches the server time.
                 */
                get instTimeOffsetSpread() {
                    return context.instTimeOffsetSpread;
                },

                /**
                 * Gets the current agreed upon time plus an offset that attempts to ensure that
                 * changes/events will have been synchronized between all connected devices by the moment that this time occurrs.
                 */
                get deadReckoningTime() {
                    return (
                        Date.now() +
                        context.instTimeOffset +
                        DEAD_RECKONING_OFFSET
                    );
                },

                loadServer,
                unloadServer,
                loadInst: loadServer,
                unloadInst: unloadServer,

                importAUX,
                parseBotsFromData,
                replaceDragBot,
                isInDimension,
                getCurrentDimension,
                getCurrentServer,
                getCurrentInst: getCurrentServer,
                getMenuDimension,
                getMiniPortalDimension,
                getPortalDimension,
                getDimensionalDepth,
                showInputForTag,
                showInput: makeMockableFunction(showInput, 'os.showInput'),
                goToDimension,
                goToURL,
                openURL,
                openDevConsole,
                checkout,
                playSound,
                bufferSound,
                cancelSound,
                hasBotInMiniPortal,
                share,
                closeCircleWipe,
                openCircleWipe,
                addDropSnap,
                addBotDropSnap,
                addDropGrid,
                addBotDropGrid,
                enableCustomDragging,
                log,
                getGeolocation,
                inSheet,

                getCameraPosition,
                getCameraRotation,
                getFocusPoint,
                getPointerPosition,
                getPointerRotation,
                getPointerDirection,
                getInputState,
                getInputList,
                getMediaPermission,
                getAverageFrameRate,

                joinRoom,
                leaveRoom,
                setRoomOptions,
                getRoomOptions,
                getRoomTrackOptions,
                setRoomTrackOptions,
                getRoomRemoteOptions,

                registerTagPrefix: registerPrefix,

                registerApp: registerApp,
                unregisterApp,
                compileApp: setAppContent,
                requestAuthBot,

                getPublicRecordKey,
                getSubjectlessPublicRecordKey,
                isRecordKey,
                recordData,
                recordManualApprovalData,
                getData,
                getManualApprovalData,
                listData,
                eraseData,
                eraseManualApprovalData,

                recordFile,
                getFile,
                eraseFile,

                recordEvent,
                countEvents,

                convertGeolocationToWhat3Words,

                raycastFromCamera,
                raycast,

                setupInst: setupServer,
                remotes,
                listInstUpdates,
                getInstStateFromUpdates,
                instances: servers,
                remoteCount: serverRemoteCount,
                totalRemoteCount: totalRemoteCount,
                instStatuses: serverStatuses,

                beginAudioRecording,
                endAudioRecording,

                meetCommand,
                meetFunction,

                get vars() {
                    return context.global;
                },
            },

            portal: {
                registerPrefix,
            },

            server: {
                setupServer,
                rpioInit,
                rpioExit,
                rpioOpen,
                rpioMode,
                rpioRead,
                rpioReadSequence,
                rpioWrite,
                rpioWriteSequence,
                rpioReadpad,
                rpioWritepad,
                rpioPud,
                rpioPoll,
                rpioClose,
                rpioI2CBegin,
                rpioI2CSetSlaveAddress,
                rpioI2CSetBaudRate,
                rpioI2CSetClockDivider,
                rpioI2CRead,
                rpioI2CWrite,
                // rpioI2CReadRegisterRestart,
                // rpioI2CWriteReadRestart,
                rpioI2CEnd,
                rpioPWMSetClockDivider,
                rpioPWMSetRange,
                rpioPWMSetData,
                rpioSPIBegin,
                rpioSPIChipSelect,
                rpioSPISetCSPolarity,
                rpioSPISetClockDivider,
                rpioSPISetDataMode,
                rpioSPITransfer,
                rpioSPIWrite,
                rpioSPIEnd,
                serialConnect,
                serialStream,
                serialOpen,
                serialUpdate,
                serialWrite,
                serialRead,
                serialClose,
                serialFlush,
                serialDrain,
                serialPause,
                serialResume,
                shell,
                backupToGithub,
                backupAsDownload,
                finishCheckout,
                markHistory,
                browseHistory,
                restoreHistoryMark,
                restoreHistoryMarkToServer,
                restoreHistoryMarkToInst: restoreHistoryMarkToServer,
                loadFile,
                saveFile,
                serverRemoteCount,
                totalRemoteCount,
                serverStatuses,
                remotes,
                servers,

                // TODO: Remove deprecated function names
                stories: servers,
                players: remotes,
                serverPlayerCount: serverRemoteCount,
                totalPlayerCount: totalRemoteCount,
            },

            action: {
                perform,
                reject,
            },

            adminSpace: {
                unlock: unlockAdminSpace,
                setPassword: setAdminSpacePassword,
            },

            experiment: {
                localFormAnimation,
                localPositionTween,
                localRotationTween,
                getAnchorPointPosition,
                beginAudioRecording,
                endAudioRecording,
                beginRecording,
                endRecording,
                speakText,
                getVoices,
            },

            math: {
                sum,
                avg,
                sqrt,
                abs,
                stdDev,
                getSeededRandomNumberGenerator,
                setRandomSeed,
                randomInt,
                random,
                degreesToRadians,
                radiansToDegrees,
                getForwardDirection,
                intersectPlane,
                getAnchorPointOffset,
                addVectors,
                subtractVectors,
                negateVector,
                normalizeVector,
                vectorLength,
                scaleVector,
                areClose,
            },

            mod: {
                cameraPositionOffset,
                cameraRotationOffset,
            },

            bytes: {
                toBase64String,
                fromBase64String,
                toHexString,
                fromHexString,
            },

            crypto: {
                hash,
                sha256,
                sha512,
                hmac,
                hmacSha256,
                hmacSha512,
                encrypt,
                decrypt,
                isEncrypted,
                asymmetric: {
                    keypair: asymmetricKeypair,
                    isKeypair: isAsymmetricKeypair,
                    encrypt: asymmetricEncrypt,
                    decrypt: asymmetricDecrypt,
                    isEncrypted: isAsymmetricEncrypted,
                },
                keypair,
                sign,
                verify,
                createCertificate,
                signTag,
                verifyTag,
                revokeCertificate,
            },

            perf: {
                getStats,
            },

            web: {
                get: makeMockableFunction(webGet, 'web.get'),
                post: makeMockableFunction(webPost, 'web.post'),
                hook: makeMockableFunction(webhook, 'web.hook'),
            },
        },

        tagSpecificApi: {
            create:
                (options: TagSpecificApiOptions) =>
                (...args: any[]) =>
                    create(options.bot?.id, ...args),
            setTimeout: botTimer('timeout', setTimeout, true),
            setInterval: botTimer('interval', setInterval, false),
            watchPortal: watchPortalBots(),
            watchBot: watchBot(),
        },
    };

    function botTimer(
        type: TimeoutOrIntervalTimer['type'],
        func: (handler: Function, timeout: number, ...args: any[]) => number,
        clearAfterHandlerIsRun: boolean
    ) {
        return (options: TagSpecificApiOptions) =>
            function (handler: Function, timeout?: number, ...args: any[]) {
                if (!options.bot) {
                    throw new Error(
                        `Timers are not supported when there is no current bot.`
                    );
                }

                let timer: number;
                if (clearAfterHandlerIsRun) {
                    timer = func(
                        function () {
                            try {
                                handler(...arguments);
                            } finally {
                                context.removeBotTimer(
                                    options.bot.id,
                                    type,
                                    timer
                                );
                            }
                        },
                        timeout,
                        ...args
                    );
                } else {
                    timer = func(handler, timeout, ...args);
                }
                context.recordBotTimer(options.bot.id, {
                    timerId: timer,
                    type: type,
                });

                return timer;
            };
    }

    function clearTimeout(id: number) {
        context.cancelAndRemoveTimers(id);
    }

    function clearInterval(id: number) {
        context.cancelAndRemoveTimers(id);
    }

    function watchPortalBots() {
        let timerId = 0;
        return (options: TagSpecificApiOptions) =>
            function (portalId: string, handler: () => void) {
                let id = timerId++;
                context.recordBotTimer(options.bot.id, {
                    type: 'watch_portal',
                    timerId: id,
                    portalId,
                    tag: options.tag,
                    handler,
                });

                return id;
            };
    }

    function watchBot() {
        let timerId = 0;
        return (options: TagSpecificApiOptions) =>
            function (
                bot: (Bot | string)[] | Bot | string,
                handler: () => void
            ) {
                let id = timerId++;
                let botIds = Array.isArray(bot)
                    ? bot.map((b) => getID(b))
                    : [getID(bot)];
                const finalHandler = () => {
                    try {
                        return handler();
                    } catch (err) {
                        context.enqueueError(err);
                    }
                };

                for (let botId of botIds) {
                    context.recordBotTimer(options.bot.id, {
                        type: 'watch_bot',
                        timerId: id,
                        botId: botId,
                        tag: options.tag,
                        handler: finalHandler,
                    });
                }
                return id;
            };
    }

    function clearWatchBot(id: number) {
        context.cancelAndRemoveTimers(id, 'watch_bot');
    }

    function clearWatchPortal(id: number) {
        context.cancelAndRemoveTimers(id, 'watch_portal');
    }

    /**
     * Asserts that the given condition is true.
     * Throws an error if the condition is not true.
     * @param condition The condition to check.
     * @param message The message to use in the error if the condition is not true.
     */
    function assert(condition: boolean, message?: string) {
        if (!condition) {
            if (hasValue(message)) {
                throw new Error('Assertion failed. ' + message);
            } else {
                throw new Error('Assertion failed.');
            }
        }
    }

    function getAssertionValue(value: any) {
        if (value instanceof Error) {
            return value.toString();
        }
        return value;
    }

    /**
     * Asserts that the given values contain the same data.
     * Throws an error if they are not equal.
     * @param first The first value to test.
     * @param second The second value to test.
     */
    function assertEqual(first: any, second: any) {
        expect(first).toEqual(second);
        // const json = getFormattedJSON(getAssertionValue(first));
        // const json2 = getFormattedJSON(getAssertionValue(second));

        // if (json !== json2) {
        //     throw new Error(
        //         `Assertion failed.\n\nExpected: ${json2}\nReceived: ${json}`
        //     );
        // }
    }

    /**
     * Gets a list of all the bots.
     *
     * @example
     * // Gets all the bots in the inst.
     * let bots = getBots();
     */
    function getBots(...args: any[]): RuntimeBot[] {
        if (args.length > 0 && typeof args[0] === 'function') {
            const filtered = context.bots.filter((b) =>
                args.every((f) => f(b))
            );

            const sortFuncs = args
                .filter((f) => typeof f.sort === 'function')
                .map((f) => f.sort);
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
                return context.bots.filter((b) => filter(b.tags[tag]));
            } else if (tag === 'id' && typeof filter === 'string') {
                const bot = context.state[filter];
                return bot ? [bot] : [];
            } else {
                return context.bots.filter((b) => b.tags[tag] === filter);
            }
        } else {
            return context.bots.filter((b) => hasValue(b.tags[tag]));
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
            .map((b) => getTag(b, tag))
            .filter((t) => hasValue(t));
        if (hasValue(filter)) {
            if (typeof filter === 'function') {
                return values.filter((val) => filter(val));
            } else {
                return values.filter((val) => val === filter);
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

        let tagsObj: BotTags;
        let botTags: string[];
        if (isBot(bot)) {
            tagsObj = bot.tags;
            botTags = tagsOnBot(bot);
        } else if (hasValue(bot[ORIGINAL_OBJECT])) {
            tagsObj = bot[ORIGINAL_OBJECT];
            botTags = Object.keys(tagsObj);
        } else {
            tagsObj = bot;
            botTags = Object.keys(tagsObj);
        }

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
     * Gets the position that the given bot is at in the given dimension.
     * @param bot The bot or bot ID.
     * @param dimension The dimension that the bot's position should be retrieved for.
     */
    function getBotPosition(
        bot: RuntimeBot | string,
        dimension: string
    ): Vector3 {
        if (!bot) {
            throw new Error('The given bot must not be null.');
        }
        const finalBot = typeof bot === 'string' ? context.state[bot] : bot;
        if (!finalBot) {
            throw new Error(
                `Could not find the bot with the given ID (${bot}).`
            );
        }
        const position = calcGetBotPosition(null, finalBot, dimension);
        return new Vector3(position.x, position.y, position.z);
    }

    /**
     * Gets the rotation that the given bot is at in the given dimension.
     * @param bot The bot or bot ID.
     * @param dimension The dimension that the bot's rotation should be retrieved for.
     */
    function getBotRotation(
        bot: RuntimeBot | string,
        dimension: string
    ): Rotation {
        if (!bot) {
            throw new Error('The given bot must not be null.');
        }
        const finalBot = typeof bot === 'string' ? context.state[bot] : bot;
        if (!finalBot) {
            throw new Error(
                `Could not find the bot with the given ID (${bot}).`
            );
        }
        return calcGetBotRotation(null, finalBot, dimension);
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
            return (bot) => {
                let val = bot.tags[tag];
                return hasValue(val) && filter(val);
            };
        } else if (hasValue(filter)) {
            if (isBotLink(filter)) {
                const ids = parseBotLink(filter);
                if (ids.length === 0) {
                    return (bot) => {
                        let val = bot.tags[tag];
                        return val === filter;
                    };
                } else if (ids.length === 1) {
                    return (bot) => {
                        let val = bot.tags[tag];
                        return (
                            ids[0] === val ||
                            (isBotLink(val) &&
                                parseBotLink(val).some((id) => id === ids[0]))
                        );
                    };
                } else {
                    return (bot) => {
                        let val = bot.tags[tag];
                        const valIds = parseBotLink(val);
                        return (
                            !!valIds &&
                            ids.every((id1) =>
                                valIds.some((id2) => id1 === id2)
                            )
                        );
                    };
                }
            } else {
                return (bot) => {
                    let val = bot.tags[tag];
                    return hasValue(val) && filter === val;
                };
            }
        } else if (filter === null) {
            return (bot) => {
                let val = bot.tags[tag];
                return !hasValue(val);
            };
        } else {
            return (bot) => {
                let val = bot.tags[tag];
                return hasValue(val);
            };
        }
    }

    /**
     * Creates a filter function that checks whether bots have the given ID.
     * @param id The ID to check for.
     *
     * @example
     * // Find all the bots with the ID "bob".
     * let bobs = getBots(byId("bob"));
     */
    function byID(id: string): IDRecordFilter {
        let filter: IDRecordFilter = ((bot: Bot) => {
            return bot.id === id;
        }) as any;

        filter.recordFilter = true;
        filter.id = id;
        filter.toJSON = () => {
            return {
                recordFilter: true,
                id: id,
            };
        };
        filter[DEBUG_STRING] = debugStringifyFunction('byID', [id]);

        return filter;
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
        let filters = Object.keys(tags).map((k) => byTag(k, tags[k]));
        return (bot) => filters.every((f) => f(bot));
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
        const atX = byTag(`${dimension}X`, (bx) => areClose(bx, x));
        const atY = byTag(`${dimension}Y`, (by) => areClose(by, y));
        const filter: BotFilterFunction = (b) => inCtx(b) && atX(b) && atY(b);
        filter.sort = (b) => getTag(b, `${dimension}SortOrder`) || 0;
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
    function bySpace(space: string): SpaceFilter {
        let func = byTag(BOT_SPACE_TAG, space) as SpaceFilter;
        func.recordFilter = true;
        func.space = space;
        func.toJSON = () => {
            return {
                recordFilter: true,
                space: space,
            };
        };
        func[DEBUG_STRING] = debugStringifyFunction('bySpace', [space]);
        return func;
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
        return (bot) => filters.some((f) => f(bot));
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
        return (bot) => !filter(bot);
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
        if (hasValue(data?.[ORIGINAL_OBJECT])) {
            return stableStringify(data[ORIGINAL_OBJECT]);
        }
        return stableStringify(data);
    }

    /**
     * Gets formatted JSON for the given data.
     * @param data The data.
     */
    function getFormattedJSON(data: any): string {
        if (hasValue(data?.[ORIGINAL_OBJECT])) {
            return stableStringify(data[ORIGINAL_OBJECT], { space: 2 });
        }
        return stableStringify(data, { space: 2 });
    }

    /**
     * Gets a snapshot of the data that the bots contain.
     * This is useful for getting all the tags and masks that are attached to the given bots.
     * @param bots The array of bots to get the snapshot for.
     */
    function getSnapshot(bots: Bot[] | Bot): BotsState {
        if (!Array.isArray(bots)) {
            return getSnapshot([bots]);
        }
        let state = {} as BotsState;
        for (let bot of bots) {
            let b = (state[bot.id] = {
                id: bot.id,
                tags: {
                    ...(typeof bot.tags.toJSON === 'function'
                        ? bot.tags.toJSON()
                        : bot.tags),
                },
            } as Bot);

            if (bot.space) {
                b.space = bot.space;
            }

            let masks = isRuntimeBot(bot)
                ? bot[GET_TAG_MASKS_SYMBOL]()
                : cloneDeep(bot.masks ?? {});
            if (Object.keys(masks).length > 0) {
                b.masks = masks;
            }
        }
        return state;
    }

    /**
     * Calculates the difference between the two given snapshots.
     * @param first The first snapshot.
     * @param second The second snapshot.
     */
    function diffSnapshots(
        first: BotsState,
        second: BotsState
    ): PartialBotsState {
        const allIds = union(Object.keys(first), Object.keys(second));
        let diff: PartialBotsState = {};
        for (let id of allIds) {
            const inFirst = id in first;
            const inSecond = id in second;
            if (inFirst && inSecond) {
                // possibly updated
                const firstBot = first[id];
                const secondBot = second[id];
                if (firstBot && secondBot) {
                    let botDiff = {} as PartialBot;
                    let tagsDiff = diffTags(firstBot.tags, secondBot.tags);
                    if (!!tagsDiff) {
                        botDiff.tags = tagsDiff;
                    }

                    const firstBotMasks = firstBot.masks || {};
                    const secondBotMasks = secondBot.masks || {};
                    let masksDiff = {} as PartialBot['masks'];
                    let hasMasksDiff = false;
                    const allMaskSpaces = union(
                        Object.keys(firstBotMasks),
                        Object.keys(secondBotMasks)
                    );
                    for (let space of allMaskSpaces) {
                        const firstMasks = firstBotMasks[space] || {};
                        const secondMasks = secondBotMasks[space] || {};

                        let tagsDiff = diffTags(firstMasks, secondMasks);
                        if (!!tagsDiff) {
                            hasMasksDiff = true;
                            masksDiff[space] = tagsDiff;
                        }
                    }

                    if (hasMasksDiff) {
                        botDiff.masks = masksDiff;
                    }

                    if (!!tagsDiff || hasMasksDiff) {
                        diff[id] = botDiff;
                    }
                }
            } else if (inFirst) {
                // deleted
                diff[id] = null;
            } else if (inSecond) {
                // added
                diff[id] = second[id];
            }
        }
        return diff;

        function diffTags(firstTags: BotTags, secondTags: BotTags): BotTags {
            let tagsDiff = {} as BotTags;
            let hasTagsDiff = false;
            const allTags = union(
                Object.keys(firstTags),
                Object.keys(secondTags)
            );
            for (let tag of allTags) {
                const firstValue = firstTags[tag];
                const secondValue = secondTags[tag];
                if (!isEqual(firstValue, secondValue)) {
                    // updated, deleted, or added
                    hasTagsDiff = true;
                    tagsDiff[tag] = hasValue(secondValue) ? secondValue : null;
                }
            }
            return hasTagsDiff ? tagsDiff : null;
        }
    }

    /**
     * Applies the given delta to the given snapshot and returns the result.
     * This is essentially the opposite of diffSnapshots().
     * @param snapshot The snapshot that the diff should be applied to.
     * @param diff The delta that should be applied to the snapshot.
     */
    function applyDiffToSnapshot(
        snapshot: BotsState,
        diff: PartialBotsState
    ): BotsState {
        return apply(snapshot, diff);
    }

    /**
     * Converts the given array of bytes into a base64 string.
     * @param bytes The bytes that should be converted into base64.
     */
    function toBase64String(bytes: Uint8Array): string {
        return fromByteArray(bytes);
    }

    /**
     * Converts the given base64 formatted string into an array of bytes.
     * @param base64 The base64 that should be converted to bytes.
     */
    function fromBase64String(base64: string): Uint8Array {
        return toByteArray(base64);
    }

    /**
     * Converts the given array of bytes into a hexadecimal string.
     * @param bytes The bytes that should be converted into hex.
     */
    function toHexString(bytes: Uint8Array): string {
        return utilToHexString(bytes);
    }

    /**
     * Converts the given hexadecimal string into an array of bytes.
     * @param hex The hexadecimal string.
     */
    function fromHexString(hex: string): Uint8Array {
        return utilFromHexString(hex);
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
    ): ShowToastAction {
        return addAction(
            toastMessage(convertToCopiableValue(message), duration)
        );
    }

    /**
     * Shows a tooltip message to the user.
     * @param message The message to show.
     * @param pixelX The X coordinate that the tooltip should be shown at. If null, then the current pointer position will be used.
     * @param pixelY The Y coordinate that the tooltip should be shown at. If null, then the current pointer position will be used.
     * @param duration The duration that the tooltip should be shown in seconds.
     */
    function tip(
        message: string | number | boolean | object | Array<any> | null,
        pixelX?: number,
        pixelY?: number,
        duration?: number
    ): Promise<number> {
        const task = context.createTask();
        const action = tipMessage(
            convertToCopiableValue(message),
            pixelX ?? null,
            pixelY ?? null,
            (duration ?? 2) * 1000,
            task.taskId
        );
        return addAsyncAction(task, action);
    }

    /**
     * Hides the given list of tips.
     * If no tip IDs are provided, then all tips will be hidden.
     * @param tipIds
     * @returns
     */
    function hideTips(tipIds?: number | number[]): Promise<void> {
        const ids =
            arguments.length <= 0
                ? null
                : typeof tipIds === 'number'
                ? [tipIds]
                : tipIds;
        const task = context.createTask();
        const action = hideTipMessages(ids, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Shows a QR Code that contains a link to a inst and dimension.
     * @param inst The inst that should be joined. Defaults to the current inst.
     * @param dimension The dimension that should be joined. Defaults to the current dimension.
     */
    function showJoinCode(
        inst?: string,
        dimension?: string
    ): ShowJoinCodeAction {
        return addAction(calcShowJoinCode(inst, dimension));
    }

    /**
     * Requests that AUX enters fullscreen mode.
     * Depending on the web browser, this may ask the player for permission.
     */
    function requestFullscreenMode(): RequestFullscreenAction {
        return addAction(requestFullscreen());
    }

    /**
     * Exits fullscreen mode.
     */
    function exitFullscreenMode(): ExitFullscreenAction {
        return addAction(exitFullscreen());
    }

    /**
     * Shows some HTML to the user.
     * @param html The HTML to show.
     */
    function showHtml(html: string): ShowHtmlAction {
        return addAction(htmlMessage(html));
    }

    /**
     * Hides the HTML from the user.
     */
    function hideHtml(): HideHtmlAction {
        return addAction(hideHtmlMessage());
    }

    /**
     * Sets the text stored in the player's clipboard.
     * @param text The text to set to the clipboard.
     */
    function setClipboard(text: string): SetClipboardAction {
        return addAction(calcSetClipboard(text));
    }

    /**
     * Tweens the user's camera to view the given bot.
     * @param bot The bot to view.
     * @param zoomValue The zoom value to use.
     * @param rotX The value to use for the X rotation. Units in degrees.
     * @param rotY The value to use for the Y rotation. Units in degrees.
     */
    function tweenTo(
        bot: Bot | string,
        zoomValue?: number,
        rotX?: number,
        rotY?: number,
        duration?: number
    ): FocusOnBotAction {
        return addAction(
            calcTweenTo(getID(bot), {
                zoom: zoomValue,
                rotation:
                    hasValue(rotX) || hasValue(rotY)
                        ? {
                              x: hasValue(rotX) ? rotX * (Math.PI / 180) : null,
                              y: hasValue(rotY) ? rotY * (Math.PI / 180) : null,
                          }
                        : undefined,
                duration,
            })
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
    ): FocusOnBotAction {
        return tweenTo(bot, zoomValue, rotX, rotY, 0);
    }

    /**
     * Moves the camera to view the given bot.
     * Returns a promise that resolves when the bot is focused.
     * @param botOrPosition The bot, bot ID, or position to view. If null, then any active camera animation will be canceled.
     * @param options The options to use for moving the camera.
     */
    function focusOn(
        botOrPosition: Bot | string | { x: number; y: number; z?: number },
        options: FocusOnOptions = {}
    ): Promise<void> {
        const task = context.createTask();
        const finalOptions: FocusOnOptions = {
            duration: 1,
            easing: 'quadratic',
            ...(options ?? {}),
        };
        let action: AsyncActions;
        if (botOrPosition === null) {
            action = cancelAnimation(task.taskId);
        } else if (botOrPosition === undefined) {
            throw new Error(
                'Cannot focus on an undefined bot. Maybe a getBot() is returning undefined?'
            );
        } else if (typeof botOrPosition === 'string' || isBot(botOrPosition)) {
            action = calcTweenTo(
                getID(botOrPosition),
                finalOptions,
                task.taskId
            );
        } else {
            action = animateToPosition(
                botOrPosition,
                finalOptions,
                task.taskId
            );
        }

        return addAsyncAction(task, action);
    }

    /**
     * Shows the chat bar.
     * @param placeholderOrOptions The placeholder text or options. (optional)
     */
    function showChat(
        placeholderOrOptions?: string | ShowChatOptions
    ): ShowChatBarAction {
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
    function hideChat(): ShowChatBarAction {
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
    function version(): AuxVersion {
        return context.version;
    }

    /**
     * Gets information about the device that the player is using.
     */
    function device(): AuxDevice {
        if (context.device) {
            return context.device;
        }
        return {
            supportsAR: null as boolean,
            supportsVR: null as boolean,
            isCollaborative: null as boolean,
            ab1BootstrapUrl: null as string,
        };
    }

    /**
     * Gets whether this device has enabled collaborative features.
     */
    function isCollaborative(): boolean {
        if (context.device) {
            return context.device.isCollaborative;
        }

        return true;
    }

    /**
     * Gets the URL that AB1 should be bootstrapped from.
     */
    function getAB1BootstrapURL(): string {
        if (context.device) {
            return context.device.ab1BootstrapUrl;
        }

        return 'https://bootstrap.casualos.com/ab1.aux';
    }

    /**
     * Enables Augmented Reality features.
     */
    function enableAR(): EnableARAction {
        return addAction(calcEnableAR());
    }

    /**
     * Disables Augmented Reality features.
     */
    function disableAR(): EnableARAction {
        return addAction(calcDisableAR());
    }

    /**
     * Gets wether this device supported AR or not.
     */
    function arSupported() {
        const task = context.createTask();
        const event = calcARSupported(task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Enables Virtual Reality features.
     */
    function enableVR(): EnableVRAction {
        return addAction(calcEnableVR());
    }

    /**
     * Disables Virtual Reality features.
     */
    function disableVR(): EnableVRAction {
        return addAction(calcDisableVR());
    }

    /**
     * Gets wether this device supported VR or not.
     */
    function vrSupported() {
        const task = context.createTask();
        const event = calcVRSupported(task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Enables Point-of-View mode.
     */
    function enablePointOfView(
        center: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
        imu?: boolean
    ): EnablePOVAction {
        return addAction(enablePOV(center, imu));
    }

    /**
     * Disables Point-of-View mode.
     */
    function disablePointOfView(): EnablePOVAction {
        return addAction(disablePOV());
    }

    /**
     * Downloads the given data.
     * @param data The data to download. Objects will be formatted as JSON before downloading.
     * @param filename The name of the file that the data should be downloaded as.
     * @param mimeType The MIME type that should be used. If not specified then it will be inferred from the filename.
     */
    function downloadData(
        data: string | object | ArrayBuffer | Blob,
        filename: string,
        mimeType: string = mime.getType(filename) || 'text/plain'
    ): DownloadAction {
        if (typeof filename !== 'string') {
            throw new Error('The filename must be a string.');
        }
        if (typeof mimeType !== 'string') {
            throw new Error('The mimeType must be a string.');
        }

        if (data instanceof Blob) {
            mimeType = data.type;
        }

        if (!hasExtension(filename)) {
            const extension = mime.getExtension(mimeType);
            if (hasValue(extension)) {
                filename = `${filename}.${extension}`;
            }
        }

        if (typeof data === 'string') {
            return addAction(download(data, filename, mimeType));
        } else if (data instanceof ArrayBuffer) {
            return addAction(download(data, filename, mimeType));
        } else if (data instanceof Blob) {
            return addAction(download(data, filename, mimeType));
        } else if (typeof data === 'object') {
            return addAction(
                download(JSON.stringify(data), filename, mimeType)
            );
        }

        throw new Error(
            'The data must be either a string, object, or ArrayBuffer.'
        );
    }

    /**
     * Determines if the given filename has an extension.
     * Returns null if the file has no extension.
     * @param filename The name of the file.
     */
    function hasExtension(filename: string) {
        const dot = filename.lastIndexOf('.');
        return dot >= 0;
    }

    /**
     * Downloads the given list of bots.
     * @param bots The bots that should be downloaded.
     * @param filename The name of the file that the bots should be downloaded as.
     */
    function downloadBots(bots: Bot[], filename: string): DownloadAction {
        let state: BotsState = {};
        for (let bot of bots) {
            state[bot.id] = bot;
        }

        let data = JSON.stringify(getDownloadState(state));
        if (isPdf(filename)) {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(data);
            const base64 = fromByteArray(bytes);
            data = embedBase64InPdf(base64);
        }

        const downloadedFilename = formatAuxFilename(filename);

        return addAction(
            download(
                data,
                downloadedFilename,
                mime.getType(downloadedFilename) || 'application/json'
            )
        );
    }

    /**
     * Downloads all the shared bots in the inst.
     */
    function downloadServer(): DownloadAction {
        return downloadBots(
            getBots(bySpace('shared')),
            `${getCurrentServer()}.aux`
        );
    }

    /**
     * Shows the "Upload AUX File" dialog.
     */
    function showUploadAuxFile(): ShowUploadAuxFileAction {
        return addAction(calcShowUploadAuxFile());
    }

    /**
     * Shows the "Upload File" dialog.
     */
    function showUploadFiles() {
        const task = context.createTask();
        const action = calcShowUploadFiles(task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Opens the QR Code Scanner.
     * @param camera The camera that should be used.
     */
    function openQRCodeScanner(camera?: CameraType): OpenQRCodeScannerAction {
        const event = calcOpenQRCodeScanner(true, camera);
        return addAction(event);
    }

    /**
     * Closes the QR Code Scanner.
     */
    function closeQRCodeScanner(): OpenQRCodeScannerAction {
        const event = calcOpenQRCodeScanner(false);
        return addAction(event);
    }

    /**
     * Shows the given QR Code.
     * @param code The code to show.
     */
    function showQRCode(code: string): ShowQRCodeAction {
        const event = calcShowQRCode(true, code);
        return addAction(event);
    }

    /**
     * Hides the QR Code.
     */
    function hideQRCode(): ShowQRCodeAction {
        const event = calcShowQRCode(false);
        return addAction(event);
    }

    /**
     * Opens the barcode scanner.
     * @param camera The camera that should be used.
     */
    function openBarcodeScanner(camera?: CameraType): OpenBarcodeScannerAction {
        const event = calcOpenBarcodeScanner(true, camera);
        return addAction(event);
    }

    /**
     * Closes the barcode scanner.
     */
    function closeBarcodeScanner(): OpenBarcodeScannerAction {
        const event = calcOpenBarcodeScanner(false);
        return addAction(event);
    }

    /**
     * Shows the given barcode.
     * @param code The code that should be shown.
     * @param format The format that the barcode should be shown in.
     */
    function showBarcode(
        code: string,
        format?: BarcodeFormat
    ): ShowBarcodeAction {
        const event = calcShowBarcode(true, code, format);
        return addAction(event);
    }

    /**
     * Hides the barcode.
     */
    function hideBarcode(): ShowBarcodeAction {
        const event = calcShowBarcode(false);
        return addAction(event);
    }

    /**
     * Shows an image classifier for the given ML Model.
     * Returns a promise that resolves when the image classifier has been opened.
     * @param options The options for the classifier.
     */
    function openImageClassifier(
        options: ImageClassifierOptions
    ): Promise<void> {
        const task = context.createTask();
        const action = calcOpenImageClassifier(true, options, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Hides the image classifier.
     * Returns a promise that resolves when the image classifier has been hidden.
     */
    function closeImageClassifier(): Promise<void> {
        const task = context.createTask();
        const action = calcOpenImageClassifier(false, {}, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Loads the instance with the given ID.
     * @param id The ID of the inst to load.
     */
    function loadServer(id: string): LoadServerAction {
        const event = loadSimulation(id);
        return addAction(event);
    }

    /**
     * Unloads the instance with the given ID.
     * @param id The ID of the instance to unload.
     */
    function unloadServer(id: string): UnloadServerAction {
        const event = unloadSimulation(id);
        return addAction(event);
    }

    /**
     * Imports the AUX from the given URL or JSON
     * @param urlOrJSON The URL or JSON to load.
     *                  If given JSON, then it will be imported as if it was a .aux file.
     *                  If given a URL, then it will be downloaded and then imported.
     */
    function importAUX(urlOrJSON: string): ImportAUXAction | ApplyStateAction {
        try {
            const bots = parseBotsFromData(urlOrJSON);
            if (bots) {
                let state: BotsState = {};
                for (let bot of bots) {
                    state[bot.id] = bot;
                }
                const uploaded = getUploadState(state);
                const event = addState(uploaded);
                return addAction(event);
            }
        } catch {}
        const event = calcImportAUX(urlOrJSON);
        return addAction(event);
    }

    /**
     * Parses the given JSON or PDF data and returns the list of bots that were contained in it.
     * @param jsonOrPdf The JSON or PDF data to parse.
     */
    function parseBotsFromData(jsonOrPdf: string): Bot[] {
        let data: any;

        try {
            data = JSON.parse(jsonOrPdf);
        } catch (e) {
            try {
                data = getEmbeddedBase64FromPdf(jsonOrPdf);
                const bytes = toByteArray(data);
                const decoder = new TextDecoder();
                const text = decoder.decode(bytes);
                data = JSON.parse(text);
            } catch (err) {
                data = null;
            }
        }

        if (!hasValue(data)) {
            return null;
        }

        const state = getUploadState(data);
        let bots = [] as Bot[];

        for (let bot in state) {
            const b = state[bot];
            if (hasValue(b)) {
                bots.push(b);
            }
        }

        return bots;
    }

    /**
     * Replaces the bot that the user is beginning to drag.
     * Only works from inside a onDrag() or onAnyBotDrag() listen tag.
     * @param bot The bot or mod that should be dragged instead of the original.
     */
    function replaceDragBot(bot: Mod): ReplaceDragBotAction {
        const event = calcReplaceDragBot(context.unwrapBot(bot));
        return addAction(event);
    }

    /**
     * Derermines whether the player is in the given dimension.
     * @param dimension The dimension.
     */
    function isInDimension(dimension: string): boolean {
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
            const dimension = getTag(user, 'gridPortal');
            if (hasValue(dimension)) {
                return dimension.toString();
            }
            return undefined;
        }
        return undefined;
    }

    /**
     * Gets the instance that the player is currently in.
     */
    function getCurrentServer(): string {
        const user = context.playerBot;
        if (user) {
            let inst = getTag(user, 'inst');
            if (hasValue(inst)) {
                return inst.toString();
            }
            return undefined;
        }
        return undefined;
    }

    /**
     * Gets the name of the dimension that is used for the current user's miniGridPortal.
     */
    function getMiniPortalDimension(): string {
        const user = context.playerBot;
        if (user) {
            const miniGridPortal = getTag(user, MINI_PORTAL);
            if (hasValue(miniGridPortal)) {
                return miniGridPortal.toString();
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
    function getPortalDimension(portal: PortalType): string {
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
            KNOWN_PORTALS.some((portal) => getTag(bot, portal) === dimension)
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
    function showInputForTag(
        bot: Bot | string,
        tag: string,
        options?: Partial<ShowInputOptions>
    ): ShowInputForTagAction {
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
     * const result = await os.showInput({
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
     * os.goToDimension("welcome");
     */
    function goToDimension(dimension: string): GoToDimensionAction {
        const event = calcGoToDimension(dimension);
        return addAction(event);
    }

    /**
     * Redirects the user to the given URL.
     * @param url The URL to go to.
     *
     * @example
     * // Send the player to wikipedia.
     * os.goToURL("https://wikipedia.org");
     */
    function goToURL(url: string): GoToURLAction {
        const event = calcGoToURL(url);
        return addAction(event);
    }

    /**
     * Redirects the user to the given URL.
     * @param url The URL to go to.
     *
     * @example
     * // Open wikipedia in a new tab.
     * os.openURL("https://wikipedia.org");
     */
    function openURL(url: string): OpenURLAction {
        const event = calcOpenURL(url);
        return addAction(event);
    }

    /**
     * Instructs CasualOS to open the built-in developer console.
     * The dev console provides easy access to error messages and debug logs for formulas and actions.
     */
    function openDevConsole(): OpenConsoleAction {
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
     * os.checkout({
     *   productId: '10_cookies',
     *   title: '10 Cookies',
     *   description: '$5.00',
     *   processingServer: 'cookies_checkout'
     * });
     *
     */
    function checkout(options: StartCheckoutOptions): StartCheckoutAction {
        const event = calcCheckout(options);
        return addAction(event);
    }

    /**
     * Play given url's audio.
     * Returns a promise that resolves once the sound starts playing.
     *
     * @example
     * // Play a cow "moo"
     * os.playSound("https://freesound.org/data/previews/58/58277_634166-lq.mp3");
     */
    function playSound(url: string) {
        const task = context.createTask();
        const event = calcPlaySound(url, task.taskId, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Preloads the audio for the given URL.
     * Returns a promise that resolves when the audio has finished loading.
     * @param url The URl to preload.
     *
     * @example
     * // Preload a cow "moo"
     * os.bufferSound("https://freesound.org/data/previews/58/58277_634166-lq.mp3");
     */
    function bufferSound(url: string) {
        const task = context.createTask();
        const event = calcBufferSound(url, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Cancels the sound with the given ID.
     * Returns a promise that resolves when the audio has been canceled.
     * @param soundId The ID of the sound that is being canceled.
     *
     * @example
     * // Play and cancel a sound
     * const id = await os.playSound("https://freesound.org/data/previews/58/58277_634166-lq.mp3");
     * os.cancelSound(id);
     */
    function cancelSound(soundId: number | string | object) {
        const task = context.createTask();
        const id =
            typeof soundId === 'object'
                ? getOriginalObject(soundId).soundID
                : soundId;
        const event = calcCancelSound(id, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Determines whether the player has the given bot in their miniGridPortal.
     * @param bots The bot or bots to check.
     */
    function hasBotInMiniPortal(bots: Bot | Bot[]): boolean {
        if (!Array.isArray(bots)) {
            bots = [bots];
        }
        let miniGridPortal = getMiniPortalDimension();
        if (!hasValue(miniGridPortal)) {
            return false;
        }
        return every(bots, (f) => getTag(f, miniGridPortal) === true);
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
     * Closes the circle wipe transition effect.
     * @param options The options that should be used for the effect.
     */
    function closeCircleWipe(
        options?: Partial<OpenCircleWipeOptions>
    ): Promise<void> {
        const task = context.createTask();
        const event = circleWipe(
            false,
            {
                color: options?.color || 'black',
                duration: options?.duration || 1,
            },
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Opens the circle wipe transition effect.
     * @param options The options that should be used for the effect.
     */
    function openCircleWipe(
        options?: Partial<OpenCircleWipeOptions>
    ): Promise<void> {
        const task = context.createTask();
        const event = circleWipe(
            true,
            {
                color: options?.color || 'black',
                duration: options?.duration || 1,
            },
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Adds the given list of snap targets to the current drag operation.
     * @param targets The list of targets to add.
     */
    function addDropSnap(...targets: SnapTarget[]): AddDropSnapTargetsAction {
        return addAction(calcAddDropSnap(null, targets));
    }

    /**
     * Adds the given list of snap targets for when the specified bot is being dropped on.
     * @param bot The bot.
     * @param targets The targets that should be enabled when the bot is being dropped on.
     */
    function addBotDropSnap(
        bot: RuntimeBot | string,
        ...targets: SnapTarget[]
    ): AddDropSnapTargetsAction {
        return addAction(calcAddDropSnap(getID(bot), targets));
    }

    /**
     * Adds the given list of grids to the current drag operation.
     * @param targets The list of grids to add.
     */
    function addDropGrid(
        ...targets: SnapGridTarget[]
    ): AddDropGridTargetsAction {
        return addAction(calcAddDropGrid(null, mapSnapGridTargets(targets)));
    }

    /**
     * Adds the given list of grids to the current drag operation for when the specified bot is being dropped on.
     * @param bot The bot.
     * @param targets The list of grids to add.
     */
    function addBotDropGrid(
        bot: Bot | string,
        ...targets: SnapGridTarget[]
    ): AddDropGridTargetsAction {
        return addAction(
            calcAddDropGrid(getID(bot), mapSnapGridTargets(targets))
        );
    }

    function mapSnapGridTargets(targets: SnapGridTarget[]): SnapGrid[] {
        return targets.map((t) => ({
            position: t.position,
            rotation: t.rotation,
            bounds: t.bounds,
            portalBotId: hasValue(t.portalBot) ? getID(t.portalBot) : undefined,
            portalTag: t.portalTag,
            priority: t.priority,
            showGrid: t.showGrid,
        }));
    }

    /**
     * Enables custom dragging for the current drag operation.
     * This will disable the built-in logic that moves the bot(s) and
     * enables the "onDragging" and "onAnyBotDragging" listen tags.
     */
    function enableCustomDragging(): EnableCustomDraggingAction {
        return addAction(calcEnableCustomDragging());
    }

    /**
     * Logs the given data.
     * @param args The data that should be logged.
     */
    function log(...args: any[]) {
        console.log(...args);
    }

    /**
     * Gets the geolocation of the device.
     * Returns a promise that resolves with the location.
     */
    function getGeolocation(): Promise<Geolocation> {
        const task = context.createTask();
        const event = calcGetGeolocation(task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Specifies that the given prefix should be interpreted as code.
     * @param prefix The prefix that code tags should start with.
     * @param options The options for the prefix.
     */
    function registerPrefix(
        prefix: string,
        options: RegisterPrefixOptions = {}
    ): Promise<void> {
        if (typeof prefix !== 'string') {
            throw new Error('A prefix must be provided.');
        }

        const task = context.createTask();
        const event = calcRegisterPrefix(
            prefix,
            {
                language: options?.language || 'javascript',
            },
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Registers a custom portal for the given bot with the given options.
     * @param portalId The ID of the portal.
     * @param bot The bot that should be used to render the portal.
     */
    function registerApp(portalId: string, bot: Bot | string): Promise<void> {
        const task = context.createTask();
        const event = registerCustomApp(portalId, getID(bot), task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Unregisters a custom portal for the given bot with the given options.
     * @param portalId The ID of the portal.
     */
    function unregisterApp(portalId: string): Promise<void> {
        const task = context.createTask();
        const event = unregisterCustomApp(portalId, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Sets the output of the given portal.
     * @param portalId The ID of the portal.
     * @param output The output that the portal should display.
     */
    function setAppContent(portalId: string, output: any): SetAppOutputAction {
        const event = setAppOutput(portalId, output);
        return addAction(event);
    }

    /**
     * Requests an Auth Bot for the current session.
     */
    async function requestAuthBot(): Promise<Bot> {
        const data = await requestAuthData();

        if (!data) {
            return null;
        }

        let bot = getBot('id', data.userId);

        if (!bot) {
            bot = context.createBot(
                createBot(
                    data.userId,
                    {
                        avatarAddress: data.avatarUrl,
                        avatarPortraitAddress: data.avatarPortraitUrl,
                        name: data.name,
                    },
                    TEMPORARY_BOT_PARTITION_ID
                )
            );
        }

        await defineGlobalBot('auth', bot.id);
        return bot;
    }

    function requestAuthData(): Promise<AuthData> {
        const task = context.createTask();
        const event = calcRequestAuthData(task.taskId);
        return addAsyncAction(task, event);
    }

    function defineGlobalBot(name: string, botId: string): Promise<void> {
        const task = context.createTask();
        const event = calcDefineGlobalBot(name, botId, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Gets an access key for the given public record.
     * @param name The name of the record.
     */
    function getPublicRecordKey(
        name: string
    ): Promise<CreatePublicRecordKeyResult> {
        const task = context.createTask();
        const event = calcGetPublicRecordKey(name, 'subjectfull', task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Gets a subjectless access key for the given public record.
     * @param name The name of the record.
     */
    function getSubjectlessPublicRecordKey(
        name: string
    ): Promise<CreatePublicRecordKeyResult> {
        const task = context.createTask();
        const event = calcGetPublicRecordKey(name, 'subjectless', task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Determines if the given value is a record key.
     * @param key The value to check.
     */
    function isRecordKey(key: unknown): boolean {
        return calcIsRecordKey(key);
    }

    /**
     * Records the given data to the given address inside the record for the given record key.
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the data should be stored at inside the record.
     * @param data The data that should be stored.
     * @param endpointOrOptions The options that should be used. Optional.
     */
    function recordData(
        recordKey: string,
        address: string,
        data: any,
        endpointOrOptions?: string | DataRecordOptions
    ) {
        return baseRecordData(
            recordKey,
            address,
            data,
            false,
            endpointOrOptions
        );
    }

    /**
     * Records the given data to the given address inside the record for the given record key.
     * Requires manual approval in order to read, write, or erase this data.
     *
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the data should be stored at inside the record.
     * @param data The data that should be stored.
     * @param endpointOrOptions The options that should be used. Optional.
     */
    function recordManualApprovalData(
        recordKey: string,
        address: string,
        data: any,
        endpointOrOptions?: string | DataRecordOptions
    ) {
        return baseRecordData(
            recordKey,
            address,
            data,
            true,
            endpointOrOptions
        );
    }

    /**
     * Records the given data to the given address inside the record for the given record key.
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the data should be stored at inside the record.
     * @param data The data that should be stored.
     * @param endpointOrOptions The options that should be used. Optional.
     */
    function baseRecordData(
        recordKey: string,
        address: string,
        data: any,
        requiresApproval: boolean,
        endpointOrOptions: string | DataRecordOptions = null
    ): Promise<RecordDataResult> {
        const task = context.createTask();
        let options: DataRecordOptions = {};
        if (hasValue(endpointOrOptions)) {
            if (typeof endpointOrOptions === 'string') {
                options.endpoint = endpointOrOptions;
            } else {
                options = endpointOrOptions;
            }
        }
        const event = calcRecordData(
            recordKey,
            address,
            convertToCopiableValue(data),
            requiresApproval,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the data stored in the given record at the given address.
     * @param recordKeyOrName The record that the data should be retrieved from.
     * @param address The address that the data is stored at.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function getData(
        recordKeyOrName: string,
        address: string,
        endpoint: string = null
    ): Promise<GetDataResult> {
        return baseGetData(recordKeyOrName, address, false, endpoint);
    }

    /**
     * Gets the data stored in the given record at the given address.
     * @param recordKeyOrName The record that the data should be retrieved from.
     * @param address The address that the data is stored at.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function getManualApprovalData(
        recordKeyOrName: string,
        address: string,
        endpoint: string = null
    ): Promise<GetDataResult> {
        return baseGetData(recordKeyOrName, address, true, endpoint);
    }

    /**
     * Gets the data stored in the given record at the given address.
     * @param recordKeyOrName The record that the data should be retrieved from.
     * @param address The address that the data is stored at.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function baseGetData(
        recordKeyOrName: string,
        address: string,
        requiresApproval: boolean,
        endpoint: string
    ): Promise<GetDataResult> {
        let recordName = isRecordKey(recordKeyOrName)
            ? parseRecordKey(recordKeyOrName)[0]
            : recordKeyOrName;
        let options: RecordActionOptions = {};
        if (hasValue(endpoint)) {
            options.endpoint = endpoint;
        }
        const task = context.createTask();
        const event = getRecordData(
            recordName,
            address,
            requiresApproval,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Lists the data stored in the given record starting with the given address.
     * @param recordKeyOrName The record that the data should be retrieved from.
     * @param startingAddress The address that the list should start with.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function listData(
        recordKeyOrName: string,
        startingAddress: string = null,
        endpoint: string = null
    ): Promise<ListDataResult> {
        let recordName = isRecordKey(recordKeyOrName)
            ? parseRecordKey(recordKeyOrName)[0]
            : recordKeyOrName;
        let options: RecordActionOptions = {};
        if (hasValue(endpoint)) {
            options.endpoint = endpoint;
        }
        const task = context.createTask();
        const event = listDataRecord(
            recordName,
            startingAddress,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Erases the data stored in the given record at the given address.
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the data should be erased from.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function eraseData(
        recordKey: string,
        address: string,
        endpoint: string = null
    ): Promise<EraseDataResult> {
        return baseEraseData(recordKey, address, false, endpoint);
    }

    /**
     * Erases the data stored in the given record at the given address.
     *
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the data should be erased from.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function eraseManualApprovalData(
        recordKey: string,
        address: string,
        endpoint: string = null
    ): Promise<EraseDataResult> {
        return baseEraseData(recordKey, address, true, endpoint);
    }

    /**
     * Erases the data stored in the given record at the given address.
     * @param recordKey The key that should be used to access the record.
     * @param address The address that the data should be erased from.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function baseEraseData(
        recordKey: string,
        address: string,
        requiresApproval: boolean,
        endpoint: string = null
    ): Promise<EraseDataResult> {
        if (!hasValue(recordKey)) {
            throw new Error('A recordKey must be provided.');
        } else if (typeof recordKey !== 'string') {
            throw new Error('recordKey must be a string.');
        }

        if (!hasValue(address)) {
            throw new Error('A address must be provided.');
        } else if (typeof address !== 'string') {
            throw new Error('address must be a string.');
        }
        let options: RecordActionOptions = {};
        if (hasValue(endpoint)) {
            options.endpoint = endpoint;
        }

        const task = context.createTask();
        const event = eraseRecordData(
            recordKey,
            address,
            requiresApproval,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Records the given data as a file.
     * @param recordKey The record that the file should be recorded in.
     * @param data The data that should be recorded.
     * @param options The options that should be used to record the file.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function recordFile(
        recordKey: string,
        data: any,
        options?: RecordFileOptions,
        endpoint: string = null
    ): Promise<RecordFileApiResult> {
        if (!hasValue(recordKey)) {
            throw new Error('A recordKey must be provided.');
        } else if (typeof recordKey !== 'string') {
            throw new Error('recordKey must be a string.');
        }

        if (!hasValue(data)) {
            throw new Error('data must be provided.');
        }

        let recordOptions: RecordActionOptions = {};
        if (hasValue(endpoint)) {
            recordOptions.endpoint = endpoint;
        }

        const task = context.createTask();
        const event = calcRecordFile(
            recordKey,
            convertToCopiableValue(data),
            options?.description,
            options?.mimeType,
            recordOptions,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the data stored in the given file.
     * @param result The successful result of a os.recordFile() call.
     */
    function getFile(result: RecordFileApiSuccess): Promise<any>;
    /**
     * Gets the data stored in the given file.
     * @param url The URL that the file is stored at.
     */
    function getFile(url: string): Promise<any>;
    /**
     * Gets the data stored in the given file.
     * @param urlOrRecordFileResult The URL or the successful result of the record file operation.
     */
    function getFile(
        urlOrRecordFileResult: string | RecordFileApiSuccess
    ): Promise<any> {
        if (!hasValue(urlOrRecordFileResult)) {
            throw new Error(
                'A url or successful os.recordFile() result must be provided.'
            );
        }

        let url: string;
        if (typeof urlOrRecordFileResult === 'string') {
            url = urlOrRecordFileResult;
        } else {
            if (!urlOrRecordFileResult.success) {
                throw new Error(
                    'The result must be a successful os.recordFile() result.'
                );
            }
            url = urlOrRecordFileResult.url;
        }

        let promise = webGet(url);
        let action: any = (promise as any)[ORIGINAL_OBJECT];

        let final = promise.then((result) => {
            return result.data;
        });
        (final as any)[ORIGINAL_OBJECT] = action;
        return final;
    }

    /**
     * Deletes the specified file using the given record key.
     * @param recordKey The key that should be used to delete the file.
     * @param result The successful result of a os.recordFile() call.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function eraseFile(
        recordKey: string,
        result: RecordFileApiSuccess,
        endpoint?: string
    ): Promise<EraseFileResult>;
    /**
     * Deletes the specified file using the given record key.
     * @param recordKey The key that should be used to delete the file.
     * @param url The URL that the file is stored at.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function eraseFile(
        recordKey: string,
        url: string,
        endpoint?: string
    ): Promise<EraseFileResult>;
    /**
     * Deletes the specified file using the given record key.
     * @param recordKey The key that should be used to delete the file.
     * @param urlOrRecordFileResult The URL or the successful result of the record file operation.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function eraseFile(
        recordKey: string,
        fileUrlOrRecordFileResult: string | RecordFileApiSuccess,
        endpoint: string = null
    ): Promise<EraseFileResult> {
        if (!hasValue(recordKey)) {
            throw new Error('A recordKey must be provided.');
        } else if (typeof recordKey !== 'string') {
            throw new Error('recordKey must be a string.');
        }

        if (!hasValue(fileUrlOrRecordFileResult)) {
            throw new Error(
                'A url or successful os.recordFile() result must be provided.'
            );
        }

        let url: string;
        if (typeof fileUrlOrRecordFileResult === 'string') {
            url = fileUrlOrRecordFileResult;
        } else {
            if (!fileUrlOrRecordFileResult.success) {
                throw new Error(
                    'The result must be a successful os.recordFile() result.'
                );
            }
            url = fileUrlOrRecordFileResult.url;
        }

        let options: RecordActionOptions = {};
        if (hasValue(endpoint)) {
            options.endpoint = endpoint;
        }

        const task = context.createTask();
        const event = calcEraseFile(recordKey, url, options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Records that the given event occurred.
     * @param recordKey The key that should be used to record the event.
     * @param eventName The name of the event.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function recordEvent(
        recordKey: string,
        eventName: string,
        endpoint: string = null
    ): Promise<AddCountResult> {
        if (!hasValue(recordKey)) {
            throw new Error('A recordKey must be provided.');
        } else if (typeof recordKey !== 'string') {
            throw new Error('recordKey must be a string.');
        }

        if (!hasValue(eventName)) {
            throw new Error('A eventName must be provided.');
        } else if (typeof eventName !== 'string') {
            throw new Error('eventName must be a string.');
        }

        let options: RecordActionOptions = {};
        if (hasValue(endpoint)) {
            options.endpoint = endpoint;
        }

        const task = context.createTask();
        const event = calcRecordEvent(
            recordKey,
            eventName,
            1,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the number of times that the given event has been recorded.
     * @param recordNameOrKey The name of the record.
     * @param eventName The name of the event.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function countEvents(
        recordNameOrKey: string,
        eventName: string,
        endpoint: string = null
    ): Promise<GetCountResult> {
        if (!hasValue(recordNameOrKey)) {
            throw new Error('A recordNameOrKey must be provided.');
        } else if (typeof recordNameOrKey !== 'string') {
            throw new Error('recordNameOrKey must be a string.');
        }

        if (!hasValue(eventName)) {
            throw new Error('A eventName must be provided.');
        } else if (typeof eventName !== 'string') {
            throw new Error('eventName must be a string.');
        }

        let recordName = isRecordKey(recordNameOrKey)
            ? parseRecordKey(recordNameOrKey)[0]
            : recordNameOrKey;

        let options: RecordActionOptions = {};
        if (hasValue(endpoint)) {
            options.endpoint = endpoint;
        }

        const task = context.createTask();
        const event = calcGetEventCount(
            recordName,
            eventName,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Converts the given geolocation to a what3words (https://what3words.com/) address.
     * @param location The latitude and longitude that should be converted to a 3 word address.
     */
    function convertGeolocationToWhat3Words(
        location: ConvertGeolocationToWhat3WordsOptions
    ): Promise<string> {
        const task = context.createTask();
        const event = calcConvertGeolocationToWhat3Words(location, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Casts a 3D ray into the specified portal from the camera and returns information about the bots that were hit.
     * @param portal The portal that should be tested.
     * @param viewportCoordinates The 2D camera viewport coordinates that the ray should be sent from.
     */
    function raycastFromCamera(
        portal: 'grid' | 'miniGrid' | 'map' | 'miniMap',
        viewportCoordinates: Vector2
    ): Promise<RaycastResult> {
        const task = context.createTask();
        const event = calcRaycastFromCamera(
            portal,
            { x: viewportCoordinates.x, y: viewportCoordinates.y },
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Casts a 3D ray into the specified portal using the given origin and direction and returns information about the bots that were hit.
     * @param portal The portal that should be tested.
     * @param origin The 3D point that the ray should start at.
     * @param direction The 3D direction that the ray should travel in.
     */
    function raycast(
        portal: 'grid' | 'miniGrid' | 'map' | 'miniMap',
        origin: Vector3,
        direction: Vector3
    ): Promise<RaycastResult> {
        const task = context.createTask();
        const normalized = direction.normalize();
        const event = calcRaycastInPortal(
            portal,
            {
                x: origin.x,
                y: origin.y,
                z: origin.z,
            },
            {
                x: normalized.x,
                y: normalized.y,
                z: normalized.z,
            },
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Sends an event to the server to setup a new instance if it does not exist.
     * @param inst The instance.
     * @param botOrMod The bot or mod that should be cloned into the new inst.
     */
    function setupServer(inst: string, botOrMod?: Mod) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcSetupServer(inst, convertToCopiableValue(botOrMod)),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Sends an event to the server to initialize rpio with provided settings
     * @param options An object containing values to initilize with.
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
    function rpioInit(options: object) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioInitPin(options),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Shuts down rpio, unmaps, and clears everything.
     */
    function rpioExit() {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioExitPin(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Sends an event to the server to open a pin as input or output.
     * @param pin The physical pin number.
     * @param mode The mode of the pin.
     * @param options The state you want to initialize your pin as.
     */
    function rpioOpen(
        pin: number,
        mode: 'INPUT' | 'OUTPUT' | 'PWM',
        options?: 'HIGH' | 'LOW' | 'PULL_OFF' | 'PULL_DOWN' | 'PULL_UP'
    ) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioOpenPin(pin, mode, options),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Sends an event to the server to change the mode of a pin as input or output.
     * @param pin The physical pin number.
     * @param mode The mode of the pin.
     * @param options The state you want to initialize your pin as.
     */
    function rpioMode(
        pin: number,
        mode: 'INPUT' | 'OUTPUT' | 'PWM',
        options?: 'HIGH' | 'LOW' | 'PULL_OFF' | 'PULL_DOWN' | 'PULL_UP'
    ) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioModePin(pin, mode, options),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Sends an event to the server to read the value of a pin.
     * @param pin The physical BCM pin number.
     */
    function rpioRead(pin: number) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioReadPin(pin),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Reads a pin's current buffer.
     * @param pin The physical BCM Pin on the server.
     * @param length The length of the buffer.
     */
    function rpioReadSequence(pin: number, length: number) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioReadSequencePin(pin, length),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Sends an event to the server to write to a pin and set it as HIGH or LOW.
     * @param pin The physical pin number.
     * @param value The mode of the pin.
     */
    function rpioWrite(pin: number, value: 'HIGH' | 'LOW') {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioWritePin(pin, value),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Writes to a pin's current buffer.
     * @param pin The physical BCM Pin on the server.
     * @param buffer The buffer to write to  the pin.
     */
    function rpioWriteSequence(pin: number, buffer: number[]) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioWriteSequencePin(pin, buffer),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
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
     */
    function rpioReadpad(
        group: 'PAD_GROUP_0_27' | 'PAD_GROUP_28_45' | 'PAD_GROUP_46_53',
        bitmask: 'slew' | 'hysteresis' | 'current'
    ) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioReadpadPin(group, bitmask),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
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
     */
    function rpioWritepad(
        group: 'PAD_GROUP_0_27' | 'PAD_GROUP_28_45' | 'PAD_GROUP_46_53',
        slew?: boolean,
        hysteresis?: boolean,
        current?: 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16
    ) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioWritepadPin(group, slew, hysteresis, current),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Configure the pin's internal pullup or pulldown resistors.
     * @param pin The pin that you want to use.
     * @param state Configure the pin's resistors as: 'PULL_OFF', 'PULL_DOWN' or 'PULL_UP'
     */
    function rpioPud(pin: number, state: 'PULL_OFF' | 'PULL_DOWN' | 'PULL_UP') {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioPudPin(pin, state),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Watch `pin` for changes and execute the callback `cb()` on events.
     * @param pin The pin that you want to use.
     * @param cb The callback executed on events.
     * @param options Optional. Used to watch for specific events.
     */
    function rpioPoll(
        pin: number,
        cb: any,
        options?: 'POLL_LOW' | 'POLL_HIGH' | 'POLL_BOTH'
    ) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioPollPin(pin, cb, options),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Sends an event to the server to close a pin and what state to leave it in.
     * @param pin The physical pin number.
     * @param options The state to leave the pin in upon closing.
     */
    function rpioClose(pin: number, options: 'PIN_RESET' | 'PIN_PRESERVE') {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioClosePin(pin, options),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Initializes i2c for use.
     */
    function rpioI2CBegin() {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioI2CBeginPin(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Configure the slave address.
     * @param address The slave address to set.
     */
    function rpioI2CSetSlaveAddress(address: number) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioI2CSetSlaveAddressPin(address),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Set the baud rate. Directly set the speed in hertz.
     * @param rate The i2c refresh rate in hertz.
     */
    function rpioI2CSetBaudRate(rate: number) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioI2CSetBaudRatePin(rate),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Set the baud rate. Set it based on a divisor of the base 250MHz rate.
     * @param rate The i2c refresh rate based on a divisor of the base 250MHz rate.
     */
    function rpioI2CSetClockDivider(rate: number) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioI2CSetClockDividerPin(rate),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Read from the i2c slave.
     * @param rx Buffer to read.
     * @param length Optional. Length of the buffer to read.
     */
    function rpioI2CRead(rx: number[], length?: number) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioI2CReadPin(rx, length),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Write to the i2c slave.
     * @param tx Buffer to write.
     * @param length Optional. Length of the buffer to write.
     */
    function rpioI2CWrite(tx: number[], length?: number) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioI2CWritePin(tx, length),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     *
     */
    // function rpioI2CReadRegisterRestart() {
    //     const task = context.createTask(true, true);
    //     const event = calcRemote(
    //         rpioI2CReadRegisterRestartPin(),
    //         undefined,
    //         undefined,
    //         task.taskId
    //     );
    //     return addAsyncAction(task, event);
    // }

    /**
     *
     */
    // function rpioI2CWriteReadRestart() {
    //     const task = context.createTask(true, true);
    //     const event = calcRemote(
    //         rpioI2CWriteReadRestartPin(),
    //         undefined,
    //         undefined,
    //         task.taskId
    //     );
    //     return addAsyncAction(task, event);
    // }

    /**
     * Turn off the i²c interface and return the pins to GPIO.
     */
    function rpioI2CEnd() {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioI2CEndPin(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * This is a power-of-two divisor of the base 19.2MHz rate, with a maximum value of 4096 (4.6875kHz).
     * @param rate The PWM refresh rate.
     */
    function rpioPWMSetClockDivider(rate: number) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioPWMSetClockDividerPin(rate),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * This determines the maximum pulse width.
     * @param pin The physical pin number.
     * @param range The PWM range for a pin.
     */
    function rpioPWMSetRange(pin: number, range: number) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioPWMSetRangePin(pin, range),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Set the width for a given pin.
     * @param pin The physical pin number.
     * @param width The PWM width for a pin.
     */
    function rpioPWMSetData(pin: number, width: number) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioPWMSetDataPin(pin, width),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Initiate SPI mode.
     */
    function rpioSPIBegin() {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioSPIBeginPin(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Choose which of the chip select / chip enable pins to control.
     *  Value | Pin
     *  ------|---------------------
     *    0   | SPI_CE0 (24 / GPIO8)
     *    1   | SPI_CE1 (26 / GPIO7)
     *    2   | Both
     * @param value The value correlating to pin(s) to control.
     */
    function rpioSPIChipSelect(value: 0 | 1 | 2) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioSPIChipSelectPin(value),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * If your device's CE pin is active high, use this to change the polarity.
     * *  Value | Pin
     *  ------|---------------------
     *    0   | SPI_CE0 (24 / GPIO8)
     *    1   | SPI_CE1 (26 / GPIO7)
     *    2   | Both
     * @param value The value correlating to pin(s) to control.
     * @param polarity Set the polarity it activates on. HIGH or LOW
     */
    function rpioSPISetCSPolarity(value: 0 | 1 | 2, polarity: 'HIGH' | 'LOW') {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioSPISetCSPolarityPin(value, polarity),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Set the SPI clock speed.
     * @param rate It is an even divisor of the base 250MHz rate ranging between 0 and 65536.
     */
    function rpioSPISetClockDivider(rate: number) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioSPISetClockDividerPin(rate),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
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
     */
    function rpioSPISetDataMode(mode: 0 | 1 | 2 | 3) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioSPISetDataModePin(mode),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     *
     */
    function rpioSPITransfer(tx: number[]) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioSPITransferPin(tx),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     *
     */
    function rpioSPIWrite(tx: number[]) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioSPIWritePin(tx),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Release the pins back to general purpose use.
     */
    function rpioSPIEnd() {
        const task = context.createTask(true, true);
        const event = calcRemote(
            rpioSPIEndPin(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Establish the connection to the bluetooth serial device
     * @param name A friendly device name. Example: Brush01
     * @param device The device path. Example: /dev/rfcomm0
     * @param mac The device MAC address. Example: AA:BB:CC:DD:EE
     * @param channel The device channel. Example: 1
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
     */
    function serialConnect(
        name: string,
        device: string,
        mac: string,
        channel: number,
        options?: object,
        cb?: any
    ) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            serialConnectPin(name, device, mac, channel, options, cb),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Parses and returns the serial stream to the event tag 'onSerialData'.
     * @param bot The id of the bot you want data streamed to. The bot needs the 'onSerialData' tag.
     * @param name A friendly device name. Example: Brush01
     */
    function serialStream(bot: string, name: string) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            serialStreamPin(bot, name),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Opens the serial connection if you set the option in serialConnect to {autoOpen: false}
     * @param name A friendly device name. Example: Brush01
     */
    function serialOpen(name: string) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            serialOpenPin(name),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Updates the SerialPort object with a new baudRate.
     * @param name A friendly device name. Example: Brush01
     * @param options {number=} [baudRate=9600] The baud rate of the port to be opened. This should match one of the commonly available baud rates, such as 110, 300, 1200, 2400, 4800, 9600, 14400, 19200, 38400, 57600, or 115200. Custom rates are supported best effort per platform. The device connected to the serial port is not guaranteed to support the requested baud rate, even if the port itself supports that baud rate.
     * @param cb
     */
    function serialUpdate(name: string, options: object, cb?: any) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            serialUpdatePin(name, options, cb),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Writes the provided data/command to the device
     * @param name A friendly device name. Example: Brush01
     * @param data The data/command to send
     * @param encoding The encoding, if chunk is a string. Defaults to 'utf8'. Also accepts 'utf16le', 'latin1', 'ascii', 'base64', 'binary', 'ucs2', and 'hex'
     * @param cb
     * @param taskId The ID of the async task.
     */
    function serialWrite(
        name: string,
        data: string | number[],
        encoding?: string,
        cb?: any
    ) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            serialWritePin(name, data, encoding, cb),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Request a number of bytes from the SerialPort.
     * @param name A friendly device name. Example: Brush01
     * @param size Specify how many bytes of data to return, if available.
     * @param taskId The ID of the async task.
     */
    function serialRead(name: string, size?: number) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            serialReadPin(name, size),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Closes an open connection.
     * @param name A friendly device name. Example: Brush01
     * @param cb
     * @param device The device path. Example: /dev/rfcomm0
     * @param taskId The ID of the async task.
     */
    function serialClose(name: string, device: string, cb?: any) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            serialClosePin(name, device, cb),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Flush discards data that has been received but not read, or written but not transmitted by the operating system.
     * @param name A friendly device name. Example: Brush01
     */
    function serialFlush(name: string) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            serialFlushPin(name),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Waits until all output data is transmitted to the serial port. After any pending write has completed, it calls `tcdrain()` or `FlushFileBuffers()` to ensure it has been written to the device.
     * @param name A friendly device name. Example: Brush01
     */
    function serialDrain(name: string) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            serialDrainPin(name),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Causes a stream in flowing mode to stop emitting 'data' events, switching out of flowing mode. Any data that becomes available remains in the internal buffer.
     * @param name A friendly device name. Example: Brush01
     */
    function serialPause(name: string) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            serialPausePin(name),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Causes an explicitly paused, Readable stream to resume emitting 'data' events, switching the stream into flowing mode.
     * @param name A friendly device name. Example: Brush01
     */
    function serialResume(name: string) {
        const task = context.createTask(true, true);
        const event = calcRemote(
            serialResumePin(name),
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
    function shell(script: string): RemoteAction | RemoteAction[] {
        return remote(calcShell(script));
    }

    /**
     * Backs up all the AUX instances to a Github Gist.
     * @param auth The Github Personal Access Token that should be used to grant access to your Github account. See https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line
     */
    function backupToGithub(auth: string): RemoteAction | RemoteAction[] {
        return remote(calcBackupToGithub(auth));
    }

    /**
     * Backs up all the AUX instances to a zip bot.
     */
    function backupAsDownload(
        target: SessionSelector
    ): RemoteAction | RemoteAction[] {
        return remote(calcBackupAsDownload(convertSessionSelector(target)));
    }

    /**
     * Finishes the checkout process by charging the payment fee to the user.
     *
     * @param options The options for finishing the checkout.
     *
     * @example
     * // Finish the checkout process
     * inst.finishCheckout({
     *   secretKey: 'YOUR_SECRET_API_KEY',
     *   token: 'token from onCheckout',
     *
     *   // 1000 cents == $10.00
     *   amount: 1000,
     *   currency: 'usd',
     *   description: 'Description for purchase'
     * });
     */
    function finishCheckout(
        options: FinishCheckoutOptions
    ): FinishCheckoutAction {
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
     * inst.markHistory({
     *   message: "Save recent changes"
     * });
     */
    function markHistory(options: MarkHistoryOptions): Promise<void> {
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
     * Loads the "history" space into the inst.
     */
    function browseHistory(): Promise<void> {
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
    function restoreHistoryMark(mark: Bot | string): Promise<void> {
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
     * @param inst The inst that the mark should be restored to.
     */
    function restoreHistoryMarkToServer(
        mark: Bot | string,
        inst: string
    ): Promise<void> {
        const id = getID(mark);
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcRestoreHistoryMark(id, inst),
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
    function loadFile(path: string, options?: LoadFileOptions): Promise<any> {
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
    function saveFile(
        path: string,
        data: string,
        options?: SaveFileOptions
    ): Promise<any> {
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
     * Gets the number of remotes that are viewing the current inst.
     * @param inst The instance to get the statistics for. If omitted, then the current instance is used.
     */
    function serverRemoteCount(inst?: string): Promise<number> {
        const task = context.createTask(true, true);
        const actualServer = hasValue(inst) ? inst : getCurrentServer();
        const event = calcRemote(
            getRemoteCount(actualServer),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the total number of remotes that are connected to the server.
     */
    function totalRemoteCount(): Promise<number> {
        const task = context.createTask(true, true);
        const event = calcRemote(
            getRemoteCount(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the list of instances that are on the server.
     */
    function servers(): Promise<string[]> {
        const task = context.createTask(true, true);
        const event = calcRemote(
            getServers(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the list of instances that are on the server.
     */
    function serverStatuses(): Promise<
        {
            inst: string;
            lastUpdateTime: Date;
        }[]
    > {
        const task = context.createTask(true, true);
        const event = calcRemote(
            getServerStatuses(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the list of remote IDs that are connected to the instance.
     */
    function remotes(): Promise<string[]> {
        const task = context.createTask(true, true);
        const event = calcRemote(
            getRemotes(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the list of updates that have been applied to this inst.
     */
    function listInstUpdates(): Promise<InstUpdate[]> {
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcListInstUpdates(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the inst state that was produced by the given set of updates.
     * @param updates The updates.
     */
    function getInstStateFromUpdates(
        updates: InstUpdate[]
    ): Promise<BotsState> {
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcGetInstStateFromUpdates(updates),
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
    ): RemoteAction | RemoteAction[] {
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
     * Sends the given shout to the given remote or list of remotes.
     * The other remotes will recieve an onRemoteWhisper event for this whisper.
     *
     * In effect, this allows remotes to communicate with each other by sending arbitrary events.
     *
     * @param remoteId The ID of the other remote or remotes to whisper to.
     * @param name The name of the event.
     * @param arg The optional argument to include in the whisper.
     */
    function remoteWhisper(
        remoteId: string | string[],
        name: string,
        arg?: any
    ): RemoteAction | RemoteAction[] {
        return remote(action(name, null, null, arg), remoteId);
    }

    /**
     * Sends the given shout to all remotes.
     * The other remotes will recieve an onRemoteWhisper event for this whisper.
     *
     * In effect, this allows remotes to communicate with each other by sending arbitrary events.
     *
     * @param name The name of the event.
     * @param arg The optional argument to include in the whisper.
     */
    function remoteShout(
        name: string,
        arg?: any
    ): RemoteAction | RemoteAction[] {
        return remote(action(name, null, null, arg), {
            broadcast: true,
        });
    }

    /**
     * Sends an HTTP GET request for the given URL using the given options.
     * @param url The URL to request.
     * @param options The options to use.
     */
    function webGet(
        url: string,
        options: WebhookOptions = {}
    ): Promise<WebhookResult> {
        return webhook({
            ...options,
            method: 'GET',
            url,
        });
    }

    /**
     * Sends a HTTP POST request to the given URL with the given data and options.
     * @param url The URL that the request should be sent to.
     * @param data The data that should be included in the request.
     * @param options The options to use.
     */
    function webPost(
        url: string,
        data?: any,
        options?: WebhookOptions
    ): Promise<WebhookResult> {
        return webhook({
            ...options,
            method: 'POST',
            url,
            data,
        });
    }

    /**
     * Creates a new function that is mockable based on if the context is currently mocking async actions.
     * @param func The function to mock.
     * @param functionName The name of the function.
     * @returns
     */
    function makeMockableFunction<T>(
        func: T,
        functionName: string
    ): T & MaskableFunction {
        if (context.mockAsyncActions) {
            let mock: any = (...args: any[]) => {
                return context.getNextMockReturn(func, functionName, args);
            };
            mock.mask = (...args: any) => ({
                returns(value: any) {
                    context.setMockReturn(func, args, value);
                },
            });
            mock[ORIGINAL_OBJECT] = func;
            return mock;
        } else {
            return func as any;
        }
    }

    /**
     * Sends an HTTP request based on the given options.
     * @param options The options that should be used to send the webhook.
     */
    function webhook(options: WebhookOptions): Promise<WebhookResult> {
        if (options.retryCount > 0) {
            return _retryWebhook(options);
        } else {
            return _webhook(options);
        }
    }

    async function _retryWebhook(options: WebhookOptions) {
        const retryCount = Math.min(options.retryCount, MAX_RETRY_COUNT);
        const timeToWait = Math.max(
            0,
            Math.min(
                options.retryAfterMs ?? DEFAULT_RETRY_AFTER_MS,
                MAX_RETRY_AFTER_MS
            )
        );
        const statusCodes =
            options.retryStatusCodes ?? DEFUALT_RETRY_STATUS_CODES;
        let retries = 0;
        while (true) {
            try {
                return await _webhook(options);
            } catch (err) {
                if (retries >= retryCount) {
                    throw err;
                } else if (!statusCodes.includes(err.response?.status ?? 0)) {
                    throw err;
                }
                await sleep(timeToWait);
                retries += 1;
            }
        }
    }

    function _webhook(options: WebhookOptions): Promise<WebhookResult> {
        const task = context.createTask();
        const event = calcWebhook(
            {
                method: options.method,
                url: options.url,
                responseShout: options.responseShout,
                data: options.data,
                headers: options.headers,
            },
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Creates a Universally Unique IDentifier (UUID).
     */
    function uuid(): string {
        return context.uuid();
    }

    /**
     * Sleeps for time in ms.
     * @param time The Time to sleep in ms. 1 second is 1000 ms.
     */
    function sleep(time: number): Promise<void> {
        let sleepy = new Promise<void>((resolve) => setTimeout(resolve, time));
        return sleepy;
    }

    /**
     * Animates the given tag. Returns a promise when the animation is finished.
     * @param bot The bot or list of bots that should be animated.
     * @param tag The tag that should be animated.
     * @param options The options for the animation.
     */
    function animateTag(
        bot: RuntimeBot | (RuntimeBot | string)[] | string,
        tag: string,
        options: AnimateTagFunctionOptions
    ): Promise<void>;

    /**
     * Animates the given tags. Returns a promise when the animation is finished.
     * @param bot The bot or list of bots that should be animated.
     * @param options The options for the animation. fromValue should be an object which contains the starting tag values and toValue should be an object that contains the ending tag values.
     */
    function animateTag(
        bot: RuntimeBot | (RuntimeBot | string)[] | string,
        options: AnimateTagFunctionOptions
    ): Promise<void>;
    /**
     * Animates the given tag. Returns a promise when the animation is finished.
     * @param bot The bot or list of bots that should be animated.
     * @param tag The tag that should be animated.
     * @param options The options for the animation.
     */
    function animateTag(
        bot: RuntimeBot | (RuntimeBot | string)[] | string,
        tagOrOptions: string | AnimateTagFunctionOptions,
        options?: AnimateTagFunctionOptions
    ): Promise<void> {
        if (Array.isArray(bot)) {
            const bots = bot
                .map((b) => (typeof b === 'string' ? getBot('id', b) : b))
                .filter((b) => !!b);

            const promises = bots.map((b) =>
                animateBotTag(b, tagOrOptions, options)
            );

            const allPromises = Promise.all(promises);
            return <Promise<void>>(<any>allPromises);
        } else if (typeof bot === 'string') {
            const finalBot = getBot('id', bot);
            if (finalBot) {
                return animateBotTag(finalBot, tagOrOptions, options);
            } else {
                return Promise.resolve();
            }
        } else {
            return animateBotTag(bot, tagOrOptions, options);
        }
    }

    function animateBotTag(
        bot: RuntimeBot,
        tagOrOptions: string | AnimateTagFunctionOptions,
        options: AnimateTagFunctionOptions
    ): Promise<void> {
        if (!hasValue(bot)) {
            return Promise.reject(
                new Error('animateTag() cannot accept null bots')
            );
        }
        if (typeof tagOrOptions === 'string') {
            return animateSingleTag(bot, tagOrOptions, options);
        } else {
            return animateMultipleTags(bot, tagOrOptions);
        }
    }

    async function animateMultipleTags(
        bot: RuntimeBot,
        options: AnimateTagFunctionOptions
    ) {
        if (typeof options.fromValue !== 'object') {
            throw new Error(
                'You must provide an object as fromValue when not specifying a tag.'
            );
        }
        if (typeof options.toValue !== 'object') {
            throw new Error(
                'You must provide an object as toValue when not specifying a tag.'
            );
        }
        if (typeof options.duration !== 'number') {
            throw new Error('You must provide a duration.');
        }

        const keys = Object.keys(options.fromValue);
        const groupId = uuid();
        await Promise.all(
            keys.map((k) =>
                animateSingleTag(
                    bot,
                    k,
                    {
                        ...options,
                        fromValue: options.fromValue[k],
                        toValue: options.toValue[k],
                    },
                    groupId
                )
            )
        );
    }

    function animateSingleTag(
        bot: RuntimeBot,
        tag: string,
        options: AnimateTagFunctionOptions,
        groupId?: string
    ) {
        if (!options) {
            clearAnimations(bot, tag);
            return Promise.resolve();
        }
        if (typeof options.duration !== 'number') {
            throw new Error('You must provide a duration.');
        }

        return new Promise<void>((resolve, reject) => {
            let initialValue = hasValue(options.fromValue)
                ? options.fromValue
                : bot.tags[tag];
            const easing = getEasing(options.easing);
            const startTime = hasValue(options.startTime)
                ? options.startTime - context.startTime
                : context.localTime;
            let targetValue = options.toValue;
            let getValue = (elapsed: number) => {
                return valueHolder[tag];
            };

            if (targetValue instanceof Vector3) {
                const startValue = new Vector3(
                    realNumberOrDefault(initialValue.x, 0),
                    realNumberOrDefault(initialValue.y, 0),
                    realNumberOrDefault(initialValue.z, 0)
                );
                initialValue = {
                    x: startValue.x,
                    y: startValue.y,
                    z: startValue.z,
                };
                getValue = (elapsed: number) => {
                    return Vector3.interpolatePosition(
                        startValue,
                        targetValue,
                        easing(elapsed)
                    );
                };
            } else if (targetValue instanceof Vector2) {
                const startValue = new Vector2(
                    realNumberOrDefault(initialValue.x, 0),
                    realNumberOrDefault(initialValue.y, 0)
                );
                initialValue = {
                    x: startValue.x,
                    y: startValue.y,
                };
                getValue = (elapsed: number) => {
                    return Vector2.interpolatePosition(
                        startValue,
                        targetValue,
                        easing(elapsed)
                    );
                };
            } else if (targetValue instanceof Rotation) {
                const startValue =
                    initialValue instanceof Rotation
                        ? initialValue
                        : initialValue instanceof Quaternion
                        ? new Rotation(initialValue)
                        : new Rotation();
                initialValue = {
                    x: startValue.quaternion.x,
                    y: startValue.quaternion.y,
                    z: startValue.quaternion.z,
                    w: startValue.quaternion.w,
                };
                getValue = (elapsed: number) => {
                    return Rotation.interpolate(
                        startValue,
                        targetValue,
                        easing(elapsed)
                    );
                };
            }
            let valueHolder = {
                [tag]: initialValue,
            };
            const tween = new TWEEN.Tween<any>(valueHolder)
                .to({
                    [tag]: targetValue,
                })
                .duration(options.duration * 1000)
                .easing(easing)
                .onUpdate((obj, elapsed) => {
                    if (
                        options.tagMaskSpace === false ||
                        options.tagMaskSpace === getBotSpace(bot)
                    ) {
                        setTag(bot, tag, getValue(elapsed));
                    } else {
                        setTagMask(
                            bot,
                            tag,
                            getValue(elapsed),
                            options.tagMaskSpace || 'tempLocal'
                        );
                    }
                })
                .onComplete(() => {
                    context.removeBotTimer(bot.id, 'animation', tween.getId());
                    resolve();
                })
                .start(startTime);

            context.recordBotTimer(bot.id, {
                type: 'animation',
                timerId: tween.getId(),
                tag: tag,
                groupId,
                cancel: () => {
                    tween.stop();
                    reject(new Error('The animation was canceled.'));
                },
            });
        });
    }

    /**
     * Cancels the animations that are running on the given bot(s).
     * @param bot The bot or list of bots that should cancel their animations.
     * @param tag The tag or list of tags that the animations should be canceld for. If omitted then all tags will be canceled.
     */
    function clearAnimations(
        bot: RuntimeBot | (RuntimeBot | string)[] | string,
        tag?: string | string[]
    ) {
        const bots = Array.isArray(bot)
            ? bot
                  .map((b) => (typeof b === 'string' ? getBot('id', b) : b))
                  .filter((b) => !!b)
            : typeof bot === 'string'
            ? getBots('id', bot)
            : [bot];

        let tags = (
            !hasValue(tag) ? null : Array.isArray(tag) ? tag : [tag]
        ) as string[];

        let groups = [] as string[];
        for (let bot of bots) {
            if (!bot) {
                continue;
            }
            const timers = context.getBotTimers(bot.id);
            for (let timer of timers) {
                if (timer.type === 'animation' && timer.cancel) {
                    if (!hasValue(tag) || tags.indexOf(timer.tag) >= 0) {
                        if (hasValue(timer.groupId)) {
                            groups.push(timer.groupId);
                        }
                        timer.cancel();
                        context.removeBotTimer(
                            bot.id,
                            timer.type,
                            timer.timerId
                        );
                    }
                }
            }
        }

        clearGroupAnimations(bots, groups);
    }

    function clearGroupAnimations(bots: RuntimeBot[], groups: string[]) {
        if (groups.length <= 0) {
            return;
        }
        for (let bot of bots) {
            const timers = context.getBotTimers(bot.id);
            for (let timer of timers) {
                if (timer.type === 'animation' && timer.cancel) {
                    if (
                        hasValue(timer.groupId) &&
                        groups.indexOf(timer.groupId) >= 0
                    ) {
                        timer.cancel();
                        context.removeBotTimer(
                            bot.id,
                            timer.type,
                            timer.timerId
                        );
                    }
                }
            }
        }
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
    function perform(action: any): any {
        const event: BotAction = action;
        if (event.type === 'update_bot') {
            if (event.update.tags) {
                for (let tag in event.update.tags) {
                    const val = event.update.tags[tag];
                    if (isTagEdit(val)) {
                        val.isRemote = true;
                    }
                }
            }
            if (event.update.masks) {
                for (let space in event.update.masks) {
                    const tags = event.update.masks[space];
                    if (tags) {
                        for (let tag in tags) {
                            const val = tags[tag];
                            if (isTagEdit(val)) {
                                val.isRemote = true;
                            }
                        }
                    }
                }
            }
        }
        return addAction(action);
    }

    /**
     * Rejects the given action.
     * @param action The action to reject.
     */
    function reject(action: any): RejectAction {
        const original = getOriginalObject(action);
        const event = Array.isArray(original)
            ? calcReject(...original)
            : calcReject(original);
        return addAction(event);
    }

    /**
     * Unlocks admin space using the given password.
     * Returns a promise that resolves when the space is unlocked.
     * @param password The password to use to unlock admin space.
     */
    function unlockAdminSpace(password: string): Promise<void> {
        const task = context.createTask();
        const event = unlockSpace('admin', password, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Sets the password that should be used for admin space.
     * @param oldPassword The old password for the admin space.
     * @param newPassword The new password that should be used.
     */
    function setAdminSpacePassword(
        oldPassword: string,
        newPassword: string
    ): Promise<void> {
        const task = context.createTask();
        const event = setSpacePassword(
            'admin',
            oldPassword,
            newPassword,
            task.taskId
        );
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
     * Tweens the position of the given bot.
     * @param bot The bot or bot ID to tween.
     * @param dimension The dimension that the bot should be tweened in.
     * @param position The position that the bot should be tweened to.
     * @param options The options that should be used for the tween.
     */
    function localPositionTween(
        bot: Bot | string,
        dimension: string,
        position: { x: number; y: number; z?: number },
        options?: TweenOptions
    ): Promise<void> {
        const task = context.createTask();
        const action = calcLocalPositionTween(
            getID(bot),
            dimension,
            position,
            options ? options.easing : undefined,
            options ? options.duration : undefined,
            task.taskId
        );
        return addAsyncAction(task, action);
    }

    /**
     * Tweens the rotation of the given bot.
     * @param bot The bot or bot ID to tween.
     * @param dimension The dimension that the bot should be tweened in.
     * @param rotation The rotation that the bot should be tweened to.
     * @param options The options that should be used for the tween.
     */
    function localRotationTween(
        bot: Bot | string,
        dimension: string,
        rotation: { x: number; y: number; z?: number },
        options?: TweenOptions
    ): Promise<void> {
        const task = context.createTask();
        const action = calcLocalRotationTween(
            getID(bot),
            dimension,
            rotation,
            options ? options.easing : undefined,
            options ? options.duration : undefined,
            task.taskId
        );
        return addAsyncAction(task, action);
    }

    /**
     * Gets the position that the center of the given bot would placed at if it had the given anchor point.
     * @param bot The bot.
     * @param dimension The dimension to get the position of.
     * @param anchorPoint The anchor point.
     */
    function getAnchorPointPosition(
        bot: Bot,
        dimension: string,
        anchorPoint: BotAnchorPoint
    ): { x: number; y: number; z: number } {
        const offset = getAnchorPointOffset(anchorPoint);
        const scale = getBotScale(null, bot, 1);
        const position = calcGetBotPosition(null, bot, dimension);

        return {
            x: position.x + offset.x * scale.x,
            y: position.y + offset.y * scale.y,
            z: position.z + offset.z * scale.z,
        };
    }

    /**
     * Starts a new audio recording.
     */
    function beginAudioRecording(
        options?: Omit<BeginAudioRecordingAction, 'type' | 'taskId'>
    ): Promise<void> {
        const task = context.createTask();
        const action = calcBeginAudioRecording(options ?? {}, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Finishes an audio recording.
     * Returns a promise that resolves with the recorded blob.
     */
    function endAudioRecording(): Promise<Blob> {
        const task = context.createTask();
        const action = calcEndAudioRecording(task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Starts a new recording.
     * @param options The options for the recording.
     * @returns A promise that resolves when the recording has started.
     */
    function beginRecording(
        options: RecordingOptions = { audio: true, video: true, screen: false }
    ): Promise<void> {
        const task = context.createTask();
        const action = calcBeginRecording(options, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Finishes a recording.
     * Returns a promise that resolves with the recorded data.
     */
    function endRecording(): Promise<Recording> {
        const task = context.createTask();
        const action = calcEndRecording(task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Sends commands to the Jitsi Meet API.
     * See https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe/#commands for a list of commands.
     * Returns a promise that resolves when the command has been executed.
     * @param command The command to execute.
     * @param args The args for the command (if any).
     */
    function meetCommand(command: string, ...args: any): Promise<void> {
        const task = context.createTask();
        const action = calcMeetCommand(command, args, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Executes the given function from the Jitsi Meet API and returns a promise with the result.
     * See https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe/#functions for a list of functions.
     * @param functionName The name of the function to execute.
     * @param args The arguments to provide to the function.
     */
    function meetFunction(functionName: string, ...args: any[]): Promise<any> {
        const task = context.createTask();
        const action = calcMeetFunction(functionName, args, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Speaks the given text.
     * Returns a promise that resolves when the text has been spoken.
     * @param text The text that should be spoken.
     * @param options The options that should be used.
     */
    function speakText(
        text: string,
        options: {
            rate?: number;
            pitch?: number;
            voice?: string | SyntheticVoice;
        } = {}
    ): Promise<void> {
        const task = context.createTask();
        const voice =
            typeof options.voice === 'object'
                ? options.voice?.name
                : options.voice;
        const action = calcSpeakText(
            text,
            {
                ...options,
                voice,
            },
            task.taskId
        );
        return addAsyncAction(task, action);
    }

    /**
     * Gets the list of synthetic voices that are supported by the system.
     * Returns a promise that resolves with the voices.
     */
    function getVoices(): Promise<SyntheticVoice[]> {
        const task = context.createTask();
        const action = calcGetVoices(task.taskId);
        return addAsyncAction(task, action);
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
    function avg(list: any): number {
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
    function sqrt(value: any): number {
        return Math.sqrt(parseFloat(value));
    }

    /**
     * Calculates the absolute value of a number.
     * @param number The number to get the absolute value of.
     */
    function abs(number: any): number {
        return Math.abs(parseFloat(number));
    }

    /**
     * Calculates the standard deviation of the numbers in the given list and returns the result.
     *
     * @param list The value that the standard deviation should be calculated for.
     */
    function stdDev(list: any): number {
        if (!Array.isArray(list)) {
            list = [parseFloat(list)];
        }

        let mean = avg(list);
        let numbersMinusMean = list.map((l: number) => (l - mean) * (l - mean));

        let standardMean = avg(numbersMinusMean);
        return sqrt(standardMean);
    }

    /**
     * Creates a new random number generator and returns it.
     * @param seed The value that should be used to seed the random number generator.
     */
    function getSeededRandomNumberGenerator(
        seed?: number | string
    ): PseudoRandomNumberGenerator {
        if (hasValue(seed)) {
            let s = typeof seed !== 'string' ? seed.toString() : seed;
            return _wrapPrng(seed, SeedRandom(s));
        }

        return _wrapPrng(null, SeedRandom());
    }

    function _wrapPrng(
        seed: number | string,
        prng: SeedRandom.prng
    ): PseudoRandomNumberGenerator {
        return {
            seed: seed,
            random(min?: number, max?: number): number {
                return randomBase(min, max, prng);
            },
            randomInt(min: number, max: number) {
                return randomIntBase(min, max, prng);
            },
        };
    }

    /**
     * Sets the seed that should be used for random numbers.
     * @param seed The seed that should be used. If given null, then the numbers will be unseeded.
     */
    function setRandomSeed(seed: number | string): void {
        if (!hasValue(seed)) {
            context.pseudoRandomNumberGenerator = null;
            return;
        }
        if (typeof seed !== 'string') {
            seed = seed.toString();
        }

        context.pseudoRandomNumberGenerator = SeedRandom(seed);
    }

    /**
     * Generates a random integer number between min and max.
     * @param min The smallest allowed value.
     * @param max The largest allowed value.
     */
    function randomInt(min: number = 0, max?: number): number {
        return randomIntBase(min, max, context.pseudoRandomNumberGenerator);
    }

    /**
     * Generates a random number between min and max.
     * @param min The smallest allowed value.
     * @param max The largest allowed value.
     */
    function random(min: number = 0, max?: number): number {
        return randomBase(min, max, context.pseudoRandomNumberGenerator);
    }

    function randomBase(
        min: number = 0,
        max: number,
        prng: SeedRandom.prng
    ): number {
        const rand = _random(prng);
        if (max) {
            return rand * (max - min) + min;
        } else {
            return rand + min;
        }
    }

    function randomIntBase(
        min: number,
        max: number,
        prng: SeedRandom.prng
    ): number {
        min = Math.ceil(min);
        max = Math.floor(max);
        const rand = _random(prng);
        if (max) {
            return Math.floor(rand * (max - min)) + min;
        } else {
            return Math.floor(rand) + min;
        }
    }

    function _random(prng: SeedRandom.prng): number {
        if (prng) {
            return prng();
        }
        return Math.random();
    }

    /**
     * Converts the given number of degrees to radians and returns the result.
     * @param degrees The number of degrees.
     */
    function degreesToRadians(degrees: number): number {
        return degrees * DEG_TO_RAD;
    }

    /**
     * Converts the given number of radians to degrees and returns the result.
     * @param radians The number of radians.
     */
    function radiansToDegrees(radians: number): number {
        return radians * RAD_TO_DEG;
    }

    /**
     * Gets the forward direction for the given rotation.
     * @param pointerRotation The rotation that the pointer has represented in radians.
     */
    function getForwardDirection(
        pointerRotation:
            | {
                  x: number;
                  y: number;
                  z: number;
                  w?: number;
              }
            | Rotation
    ): Vector3 {
        const rotation =
            pointerRotation instanceof Rotation
                ? pointerRotation
                : 'w' in pointerRotation
                ? new Rotation({
                      quaternion: new Quaternion(
                          pointerRotation.x,
                          pointerRotation.y,
                          pointerRotation.z,
                          pointerRotation.w
                      ),
                  })
                : new Rotation({
                      euler: {
                          x: pointerRotation.x,
                          y: pointerRotation.y,
                          z: pointerRotation.z,
                      },
                  });
        const direction = new Vector3(0, 1, 0);
        return rotation.rotateVector3(direction);
    }

    /**
     * Finds the point at which the the given ray and ground plane intersect.
     * @param origin The origin of the ray.
     * @param direction The direction that the ray is pointing.
     */
    function intersectPlane(
        origin: { x: number; y: number; z: number },
        direction: { x: number; y: number; z: number }
    ): Vector3 {
        let plane = new Plane(new ThreeVector3(0, 0, 1));
        let final = new ThreeVector3();
        let ray = new Ray(
            new ThreeVector3(origin.x, origin.y, origin.z),
            new ThreeVector3(direction.x, direction.y, direction.z)
        );
        let result = ray.intersectPlane(plane, final);

        if (result) {
            return new Vector3(result.x, result.y, result.z);
        } else {
            return null;
        }
    }

    /**
     * Gets the position offset for the given bot anchor point.
     * @param anchorPoint The anchor point to get the offset for.
     */
    function getAnchorPointOffset(anchorPoint: BotAnchorPoint): Vector3 {
        const value = calculateAnchorPoint(anchorPoint);
        const offset = calculateAnchorPointOffset(value);
        return new Vector3(offset.x, -offset.y, offset.z);
    }

    /**
     * Adds the given vectors together and returns the result.
     * @param vectors The vectors that should be added together.
     */
    function addVectors<T>(...vectors: T[]): T {
        if (vectors.length <= 0) {
            return {} as T;
        }
        let hasX = false;
        let hasY = false;
        let hasZ = false;
        let hasOther = false;
        let result = {} as any;

        for (let i = 0; i < vectors.length; i++) {
            const v = vectors[i] as any;
            if (!hasValue(v)) {
                continue;
            }
            const keys = Object.keys(v);
            for (let key of keys) {
                if (key === 'x') {
                    hasX = true;
                } else if (key === 'y') {
                    hasY = true;
                } else if (key === 'z') {
                    hasZ = true;
                } else {
                    hasOther = true;
                }

                if (key in result) {
                    result[key] += v[key];
                } else {
                    result[key] = v[key];
                }
            }
        }

        if (hasX && hasY && !hasZ && !hasOther) {
            return new Vector2(result.x, result.y) as any;
        } else if (hasX && hasY && hasZ && !hasOther) {
            return new Vector3(result.x, result.y, result.z) as any;
        }
        return result;
    }

    /**
     * Subtracts the given vectors from each other and returns the result.
     * @param vectors The vectors that should be subtracted from each other.
     */
    function subtractVectors<T>(...vectors: T[]): T {
        if (vectors.length <= 0) {
            return {} as T;
        }
        let hasX = false;
        let hasY = false;
        let hasZ = false;
        let hasOther = false;
        let result = {} as any;

        for (let i = 0; i < vectors.length; i++) {
            const v = vectors[i] as any;
            if (!hasValue(v)) {
                continue;
            }
            const keys = Object.keys(v);
            for (let key of keys) {
                if (key === 'x') {
                    hasX = true;
                } else if (key === 'y') {
                    hasY = true;
                } else if (key === 'z') {
                    hasZ = true;
                } else {
                    hasOther = true;
                }

                if (key in result) {
                    result[key] -= v[key];
                } else {
                    result[key] = v[key];
                }
            }
        }

        if (hasX && hasY && !hasZ && !hasOther) {
            return new Vector2(result.x, result.y) as any;
        } else if (hasX && hasY && hasZ && !hasOther) {
            return new Vector3(result.x, result.y, result.z) as any;
        }
        return result;
    }

    /**
     * Negates the given vector and returns the result.
     * @param vector The vector that should be negated.
     */
    function negateVector<T>(vector: T): T {
        if (!hasValue(vector)) {
            return vector;
        }
        if (vector instanceof Vector2) {
            return vector.negate() as any;
        } else if (vector instanceof Vector3) {
            return vector.negate() as any;
        }
        let result = {} as any;

        const keys = Object.keys(vector);
        for (let key of keys) {
            result[key] = -(vector as any)[key];
        }

        return result;
    }

    /**
     * Normalizes the given vector and returns the result.
     * @param vector The vector that should be normalized.
     */
    function normalizeVector<T>(vector: T): T {
        if (!hasValue(vector)) {
            return vector;
        }
        if (vector instanceof Vector2) {
            return vector.normalize() as any;
        } else if (vector instanceof Vector3) {
            return vector.normalize() as any;
        }
        let result = {} as any;
        const length = vectorLength(vector);

        if (length === 0) {
            return vector;
        }

        const keys = Object.keys(vector);
        for (let key of keys) {
            const val = (vector as any)[key];
            result[key] = val / length;
        }

        return result;
    }

    /**
     * Calculates the length of the given vector.
     * @param vector The vector to calculate the length of.
     */
    function vectorLength<T>(vector: T): number {
        if (!hasValue(vector)) {
            return null;
        }
        let result = 0;

        const keys = Object.keys(vector);
        for (let key of keys) {
            const val = (vector as any)[key];
            result += val * val;
        }

        return Math.sqrt(result);
    }

    /**
     * Multiplies each component of the given vector by the given scale and returns the result.
     * @param vector The vector that should be scaled.
     * @param scale The number that the vector should be multiplied by.
     */
    function scaleVector<T>(vector: T, scale: number): T {
        if (!hasValue(vector)) {
            return vector;
        }
        if (vector instanceof Vector2) {
            return vector.multiplyScalar(scale) as any;
        } else if (vector instanceof Vector3) {
            return vector.multiplyScalar(scale) as any;
        }
        let result = {} as any;

        const keys = Object.keys(vector);
        for (let key of keys) {
            result[key] = (vector as any)[key] * scale;
        }

        return result;
    }

    /**
     * Determines if the two given numbers within 2 decimal places of each other.
     * @param first The first number to check.
     * @param second The second number to check.
     */
    function areClose(first: number, second: number): boolean {
        const maxDelta = 0.005;
        const delta = Math.abs(first - second);
        return delta < maxDelta;
    }

    /**
     * Converts the given 3D point into a mod that sets the cameraPositionOffset tags.
     * @param point The mod that represents the 3D point.
     */
    function cameraPositionOffset(point: {
        x?: number;
        y?: number;
        z?: number;
    }) {
        let result = {} as any;
        if ('x' in point) {
            result.cameraPositionOffsetX = point.x;
        }
        if ('y' in point) {
            result.cameraPositionOffsetY = point.y;
        }
        if ('z' in point) {
            result.cameraPositionOffsetZ = point.z;
        }

        return result;
    }

    /**
     * Converts the given 3D rotation into a mod that sets the cameraRotationOffset tags.
     * @param rotation The mod that represents the 3D rotation.
     */
    function cameraRotationOffset(rotation: {
        x?: number;
        y?: number;
        z?: number;
    }) {
        let result = {} as any;
        if ('x' in rotation) {
            result.cameraRotationOffsetX = rotation.x;
        }
        if ('y' in rotation) {
            result.cameraRotationOffsetY = rotation.y;
        }
        if ('z' in rotation) {
            result.cameraRotationOffsetZ = rotation.z;
        }

        return result;
    }

    /**
     * Calculates the cryptographic hash for the given data and returns the result in the specified format.
     * @param algorithm The algorithm that should be used to hash the data.
     * @param format The format that the hash should be returned in.
     *               - "hex" indicates that a hexadecimal string should be returned.
     *               - "base64" indicates that a base64 formatted string should be returned.
     *               - "raw" indicates that an array of bytes should be returned.
     * @param data The data that should be hashed.
     */
    function hash(
        algorithm: 'sha256' | 'sha512' | 'sha1',
        format: 'hex' | 'base64',
        ...data: unknown[]
    ): string;

    /**
     * Calculates the cryptographic hash for the given data and returns the result in the specified format.
     * @param algorithm The algorithm that should be used to hash the data.
     * @param format The format that the hash should be returned in.
     *               - "hex" indicates that a hexadecimal string should be returned.
     *               - "base64" indicates that a base64 formatted string should be returned.
     *               - "raw" indicates that an array of bytes should be returned.
     * @param data The data that should be hashed.
     */
    function hash(
        algorithm: 'sha256' | 'sha512' | 'sha1',
        format: 'raw',
        ...data: unknown[]
    ): Uint8Array;

    /**
     * Calculates the cryptographic hash for the given data and returns the result in the specified format.
     * @param algorithm The algorithm that should be used to hash the data.
     * @param format The format that the hash should be returned in.
     *               - "hex" indicates that a hexadecimal string should be returned.
     *               - "base64" indicates that a base64 formatted string should be returned.
     *               - "raw" indicates that an array of bytes should be returned.
     * @param data The data that should be hashed.
     */
    function hash(
        algorithm: 'sha256' | 'sha512' | 'sha1',
        format: 'hex' | 'base64' | 'raw',
        ...data: unknown[]
    ): string | Uint8Array {
        let h =
            algorithm === 'sha256'
                ? hashSha256()
                : algorithm === 'sha512'
                ? hashSha512()
                : algorithm === 'sha1'
                ? hashSha1()
                : null;

        if (!h) {
            throw new Error('Not supported algorithm: ' + algorithm);
        }

        return _hash(h, data, format as any);
    }

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
    function hmac(
        algorithm: 'hmac-sha256' | 'hmac-sha512' | 'hmac-sha1',
        format: 'hex' | 'base64',
        key: string,
        ...data: unknown[]
    ): string;

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
    function hmac(
        algorithm: 'hmac-sha256' | 'hmac-sha512' | 'hmac-sha1',
        format: 'raw',
        key: string,
        ...data: unknown[]
    ): Uint8Array;

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
    function hmac(
        algorithm: 'hmac-sha256' | 'hmac-sha512' | 'hmac-sha1',
        format: 'hex' | 'base64' | 'raw',
        key: string,
        ...data: unknown[]
    ): string | Uint8Array {
        let h =
            algorithm === 'hmac-sha256'
                ? hashSha256
                : algorithm === 'hmac-sha512'
                ? hashSha512
                : algorithm === 'hmac-sha1'
                ? hashSha1
                : null;

        if (!h) {
            throw new Error('Not supported algorithm: ' + algorithm);
        }

        if (!hasValue(key)) {
            throw new Error('The key must not be empty, null, or undefined');
        }

        if (typeof key !== 'string') {
            throw new Error('The key must be a string');
        }

        let hmac = calcHmac(<any>h, key);
        return _hash(hmac, data, format as any);
    }

    /**
     * Calculates the SHA-256 hash of the given data.
     * @param data The data that should be hashed.
     */
    function sha256(...data: unknown[]): string {
        let sha = hashSha256();
        return _hash(sha, data, 'hex');
    }

    /**
     * Calculates the SHA-512 hash of the given data.
     * @param data The data that should be hashed.
     */
    function sha512(...data: unknown[]): string {
        let sha = hashSha512();
        return _hash(sha, data, 'hex');
    }

    /**
     * Calculates the HMAC SHA-256 hash of the given data.
     * HMAC is commonly used to verify that a message was created with a specific key.
     * @param key The key that should be used to sign the message.
     * @param data The data that should be hashed.
     */
    function hmacSha256(key: string, ...data: unknown[]): string {
        if (!hasValue(key)) {
            throw new Error('The key must not be empty, null, or undefined');
        }
        if (typeof key !== 'string') {
            throw new Error('The key must be a string');
        }
        let sha = calcHmac(<any>hashSha256, key);
        return _hash(sha, data, 'hex');
    }

    /**
     * Calculates the HMAC SHA-512 hash of the given data.
     * HMAC is commonly used to verify that a message was created with a specific key.
     * @param key The key that should be used to sign the message.
     * @param data The data that should be hashed.
     */
    function hmacSha512(key: string, ...data: unknown[]): string {
        if (!hasValue(key)) {
            throw new Error('The key must not be empty, null, or undefined');
        }
        if (typeof key !== 'string') {
            throw new Error('The key must be a string');
        }
        let sha = calcHmac(<any>hashSha512, key);
        return _hash(sha, data, 'hex');
    }

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
    function encrypt(secret: string, data: string): string {
        if (typeof data === 'string') {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(data);
            return realEncrypt(secret, bytes);
        } else {
            throw new Error('The data to encrypt must be a string.');
        }
    }

    /**
     * Decrypts the given data using the given secret and returns the result.
     * If the data was unable to be decrypted, null will be returned.
     *
     * @param secret The secret to use to decrypt the data.
     * @param data The data to decrypt.
     */
    function decrypt(secret: string, data: string): string {
        if (typeof data === 'string') {
            const bytes = realDecrypt(secret, data);
            if (!bytes) {
                return null;
            }
            const decoder = new TextDecoder();
            return decoder.decode(bytes);
        } else {
            throw new Error('The data to encrypt must be a string.');
        }
    }

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
    function asymmetricKeypair(secret: string): string {
        return realAsymmetricKeypair(secret);
    }

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
    function asymmetricEncrypt(keypair: string, data: string): string {
        if (typeof data === 'string') {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(data);
            return realAsymmetricEncrypt(keypair, bytes);
        } else {
            throw new Error('The data to encrypt must be a string.');
        }
    }

    /**
     * Decrypts the given data with the given keypair and secret and returns the result.
     * If the data was unable to be decrypted, null will be returned.
     *
     * @param keypair The keypair to use to decrypt the data.
     * @param secret The secret to use to decrypt the keypair's private key.
     * @param data The data to decrypt.
     */
    function asymmetricDecrypt(
        keypair: string,
        secret: string,
        data: string
    ): string {
        if (typeof data === 'string') {
            const bytes = realAsymmetricDecrypt(keypair, secret, data);
            if (!bytes) {
                return null;
            }
            const decoder = new TextDecoder();
            return decoder.decode(bytes);
        } else {
            throw new Error('The data to encrypt must be a string.');
        }
    }

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
     * Note that both the private and public keys are randomly generated, so while the public key is unencrypted, it won't be able to be used by someone else unless
     * they have access to it.
     *
     * @param secret The secret that should be used to encrypt the private key.
     */
    function keypair(secret: string): string {
        return realKeypair(secret);
    }

    /**
     * Creates a digital signature for the given data using the private key from the given keypair.
     *
     * @description
     * Digital signatures are used to verifying the authenticity and integrity of data.
     *
     * This works by leveraging asymetric encryption but in reverse.
     * If we can encrypt some data such that only the public key of a keypair can decrypt it, then we can prove that
     * the data was encrypted (i.e. signed) by the corresponding private key. And since the public key is available to everyone but the private
     * key is only usable when you have the secret, we can use this to prove that a particular piece of data was signed by whoever knows the secret.
     *
     * @param keypair The keypair that should be used to create the signature.
     * @param secret The secret that was used when creating the keypair. Used to decrypt the private key.
     * @param data The data to sign.
     */
    function sign(keypair: string, secret: string, data: string): string {
        if (typeof data === 'string') {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(data);
            return realSign(keypair, secret, bytes);
        } else {
            throw new Error('The data to encrypt must be a string.');
        }
    }

    /**
     * Validates that the given signature for the given data was created by the given keypair.
     * @param keypair The keypair that should be used to validate the signature.
     * @param signature The signature that was returned by the sign() operation.
     * @param data The data that was used in the sign() operation.
     */
    function verify(keypair: string, signature: string, data: string): boolean {
        if (typeof data === 'string') {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(data);
            return realVerify(keypair, signature, bytes);
        } else {
            throw new Error('The data to encrypt must be a string.');
        }
    }

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
    function createCertificate(
        certificate: Bot | string,
        secret: string,
        keypair: string
    ): Promise<RuntimeBot> {
        const signingBotId = getID(certificate);
        const task = context.createTask();
        const action = hasValue(signingBotId)
            ? calcCreateCertificate(
                  {
                      keypair: keypair,
                      signingBotId: signingBotId,
                      signingPassword: secret,
                  },
                  task.taskId
              )
            : calcCreateCertificate(
                  {
                      keypair: keypair,
                      signingPassword: secret,
                  },
                  task.taskId
              );

        return addAsyncAction(task, action);
    }

    /**
     * Signs the tag on the given bot using the given certificate and secret.
     * @param certificate The certificate to use to create the signature.
     * @param secret The secret to use to decrypt the certificate's private key.
     * @param bot The bot that should be signed.
     * @param tag The tag that should be signed.
     */
    function signTag(
        certificate: Bot | string,
        secret: string,
        bot: Bot | string,
        tag: string
    ): Promise<void> {
        tag = trimTag(tag);
        const signingBotId = getID(certificate);
        const realBot = getBot('id', getID(bot));
        const value = realBot.raw[tag];
        const task = context.createTask();
        const action = calcSignTag(
            signingBotId,
            secret,
            realBot.id,
            tag,
            value,
            task.taskId
        );
        return addAsyncAction(task, action);
    }

    /**
     * Verifies that the given tag on the given bot has been signed by a certificate.
     * @param bot The bot.
     * @param tag The tag to check.
     */
    function verifyTag(bot: RuntimeBot | string, tag: string): boolean {
        tag = trimTag(tag);
        const id = getID(bot);
        const realBot = isRuntimeBot(bot) ? bot : getBot('id', id);
        if (!realBot.signatures) {
            return false;
        }
        const value = realBot.raw[tag];
        const sig = tagValueHash(id, tag, value);
        return realBot.signatures[sig] === tag;
    }

    /**
     * Revokes the given certificate using the given secret.
     * In effect, this deletes the certificate bot from the inst.
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
    function revokeCertificate(
        certificate: Bot | string,
        secret: string,
        signer?: Bot | string
    ): Promise<void> {
        const certId = getID(certificate);
        const signerId = getID(signer || certificate);
        const task = context.createTask();
        const action = calcRevokeCertificate(
            signerId,
            secret,
            certId,
            task.taskId
        );
        return addAsyncAction(task, action);
    }

    /**
     * Gets performance stats from the runtime.
     */
    function getStats(): PerformanceStats {
        return {
            numberOfBots: context.bots.length,
            shoutTimes: context.getShoutTimers(),
            numberOfActiveTimers: context.getNumberOfActiveTimers(),
        };
    }

    function _hash(
        hash: MessageDigest<any>,
        data: unknown[],
        format: 'hex' | 'base64'
    ): string;
    function _hash(
        hash: MessageDigest<any>,
        data: unknown[],
        format: 'raw'
    ): Uint8Array;
    function _hash(
        hash: MessageDigest<any>,
        data: unknown[],
        format: 'hex' | 'base64' | 'raw'
    ): string | Uint8Array {
        for (let d of data) {
            if (!hasValue(d)) {
                d = '';
            } else if (typeof d === 'object') {
                d = stableStringify(d);
            } else if (typeof d !== 'string') {
                d = d.toString();
            }
            hash.update(d);
        }

        if (!!format && format !== 'hex') {
            const result = hash.digest();
            const array = new Uint8Array(result);
            if (format === 'base64') {
                return fromByteArray(array);
            } else {
                return array;
            }
        }

        return hash.digest('hex');
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
        if (isRuntimeBot(value)) {
            throw new Error(
                `It is not possible to save bots as tag values. (Setting '${tag}')`
            );
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
    function setTagMask(
        bot: RuntimeBot | RuntimeBot[],
        tag: string,
        value: any,
        space?: string
    ): any {
        tag = trimTag(tag);
        if (tag === 'id' || tag === BOT_SPACE_TAG) {
            return value;
        }
        if (Array.isArray(bot) && bot.length > 0) {
            for (let b of bot) {
                setTagMask(b, tag, value, space);
            }
            return value;
        } else if (bot && isRuntimeBot(bot)) {
            bot[SET_TAG_MASK_SYMBOL](tag, value, space);
            return value;
        }
    }

    /**
     * Clears the tag masks from the given bot.
     * @param bot The bot or bots that the tag masks should be cleared from.
     * @param space The space that the tag masks should be cleared from. If not specified, then all spaces will be cleared.
     */
    function clearTagMasks(
        bot: RuntimeBot | RuntimeBot[],
        space?: string
    ): void {
        if (Array.isArray(bot) && bot.length > 0) {
            for (let b of bot) {
                clearTagMasks(b, space);
            }
        } else if (bot && isRuntimeBot(bot)) {
            bot[CLEAR_TAG_MASKS_SYMBOL](space);
        }
    }

    /**
     * Inserts the given text into the given tag at the given index.
     * Returns the resulting raw tag value.
     * @param bot The bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index The index that the text should be inserted at.
     * @param text The text that should be inserted.
     */
    function insertTagText(
        bot: RuntimeBot,
        tag: string,
        index: number,
        text: string
    ): string {
        const currentValue = convertToString(bot.raw[tag]);
        if (index < 0) {
            index += currentValue.length;
        }
        index = Math.max(0, Math.min(index, currentValue.length));
        bot[EDIT_TAG_SYMBOL](tag, [preserve(index), insert(text)]);
        return bot.raw[tag];
    }

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
        bot: RuntimeBot,
        tag: string,
        index: number,
        text: string,
        space?: BotSpace
    ): string {
        const currentValue = convertToString(bot.masks[tag]);
        if (index < 0) {
            index += currentValue.length;
        }
        index = Math.max(0, Math.min(index, currentValue.length));
        bot[EDIT_TAG_MASK_SYMBOL](tag, [preserve(index), insert(text)], space);
        return bot.masks[tag];
    }

    /**
     * Deletes the specified number of characters from the given tag.
     * Returns the resulting raw tag value.
     * @param bot The bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index The index that the text should be deleted at.
     * @param count The number of characters to delete.
     */
    function deleteTagText(
        bot: RuntimeBot,
        tag: string,
        index: number,
        count: number
    ): string {
        const currentValue = convertToString(bot.raw[tag]);
        if (index < 0) {
            index += currentValue.length;
        }
        index = Math.max(0, Math.min(index, currentValue.length));
        count = Math.min(count, currentValue.length - index);
        if (count > 0) {
            bot[EDIT_TAG_SYMBOL](tag, [preserve(index), del(count)]);
        }
        return bot.raw[tag] || '';
    }

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
        bot: RuntimeBot,
        tag: string,
        index: number,
        count: number,
        space?: string
    ): string {
        const currentValue = convertToString(bot.masks[tag]);
        if (index < 0) {
            index += currentValue.length;
        }
        index = Math.max(0, Math.min(index, currentValue.length));
        count = Math.min(count, currentValue.length - index);
        if (count > 0) {
            bot[EDIT_TAG_MASK_SYMBOL](
                tag,
                [preserve(index), del(count)],
                space
            );
        }
        return bot.masks[tag] || '';
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
    function removeTags(bot: Bot | Bot[], tagSection: string | RegExp): void {
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
    function renameTag(
        bot: Bot | Bot[],
        originalTag: string,
        newTag: string
    ): void {
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
    function applyMod(bot: any, ...diffs: Mod[]): void {
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
    function subtractMods(bot: any, ...diffs: Mod[]): void {
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
    function create(botId: string, ...mods: Mod[]) {
        return createBase(botId, () => context.uuid(), ...mods);
    }

    function createBase(
        botId: string,
        idFactory: () => string,
        ...datas: Mod[]
    ) {
        let parentDiff = botId ? { creator: botId } : {};
        return createFromMods(idFactory, parentDiff, ...datas);
    }

    /**
     * Creates a new bot that contains the given tags.
     * @param mods The mods that specify what tags to set on the bot.
     */
    function createFromMods(
        idFactory: () => string,
        ...mods: (Mod | Mod[])[]
    ): RuntimeBot | RuntimeBot[] {
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

        let bots: Bot[] = variants.map((v) => {
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

        if (bots.some((b) => Object.keys(b.tags).length <= 0)) {
            throw new Error('Cannot create a bot with zero tags.');
        }

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
    ): void {
        if (typeof bot === 'object' && Array.isArray(bot)) {
            bot.forEach((f) => destroyBot(f));
        } else {
            destroyBot(bot);
        }
    }

    /**
     * Removes the given bot or bot ID from the simulation.
     * @param bot The bot or bot ID to remove from the simulation.
     */
    function destroyBot(bot: RuntimeBot | string | Bot): void {
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

    function destroyChildren(id: string): void {
        const children = getBots(byTag('creator', createBotLink([id])));
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
    ): void {
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
     * Creates a tag value that can be used to link to the given bots.
     * @param bots The bots that the link should point to.
     */
    function createBotLinkApi(
        ...bots: (Bot | string | (Bot | string)[])[]
    ): string {
        let targets = flatMap(bots);
        let result = [] as string[];
        for (let t of targets) {
            if (isBot(t)) {
                result.push(t.id);
            } else {
                let links = parseBotLink(t);
                if (links) {
                    result.push(...links);
                } else {
                    result.push(t);
                }
            }
        }
        return createBotLink(result);
    }

    /**
     * Gets the list of bot links that are stored in this bot's tags.
     * @param bot The bot to get the links for.
     */
    function getBotLinks(bot: Bot): ParsedBotLink[] {
        let links = [] as ParsedBotLink[];
        for (let tag of Object.keys(bot.tags)) {
            const val = bot.tags[tag];
            const ids = parseBotLink(val);
            if (ids) {
                links.push({
                    tag,
                    botIDs: ids,
                });
            }
        }

        return links;
    }

    /**
     * Updates all the links in the given bot using the given ID map.
     * Useful if you know that the links in the given bot are outdated and you know which IDs map to the new IDs.
     * @param bot The bot to update.
     * @param idMap The map of old IDs to new IDs that should be used.
     */
    function updateBotLinks(
        bot: Bot,
        idMap: Map<string, string | Bot> | { [id: string]: string | Bot }
    ): void {
        let map: Map<string, string | Bot>;
        if (idMap instanceof Map) {
            map = idMap;
        } else if (typeof idMap === 'object') {
            map = new Map();
            for (let key in idMap) {
                const newId = idMap[key];
                if (typeof newId === 'string') {
                    map.set(key, newId);
                } else if (isBot(newId)) {
                    map.set(key, newId.id);
                }
            }
        } else {
            return;
        }

        for (let tag of Object.keys(bot.tags)) {
            const val = bot.tags[tag];
            const ids = parseBotLink(val);
            if (ids) {
                const mapped = ids.map((id) => {
                    if (map.has(id)) {
                        const newId = map.get(id);
                        if (typeof newId === 'string') {
                            return newId;
                        } else if (isBot(newId)) {
                            return newId.id;
                        }
                    }
                    return id;
                });
                bot.tags[tag] = createBotLink(mapped);
            }
        }
    }

    /**
     * Parses the given value into a date time object.
     * Returns null if the value could not be parsed into a date time.
     * @param value The value to parse.
     */
    function getDateTime(value: unknown): DateTime {
        if (typeof value === 'string') {
            if (!isBotDate(value)) {
                value = DATE_TAG_PREFIX + value;
            }

            return parseBotDate(value);
        } else if (value instanceof DateTime) {
            return value;
        } else if (value instanceof Date) {
            return DateTime.fromJSDate(value);
        } else {
            return null;
        }
    }

    /**
     * Shouts the given event to every bot in every loaded simulation.
     * @param eventName The name of the event to shout.
     * @param arg The argument to shout. This gets passed as the `that` variable to the other scripts.
     */
    function superShout(eventName: string, arg?: any): SuperShoutAction {
        const event = calcSuperShout(trimEvent(eventName), arg);
        return addAction(event);
    }

    /**
     * Shouts the given events in order until a bot returns a result.
     * Returns the result that was produced or undefined if no result was produced.
     * @param eventNames The names of the events to shout.
     * @param arg The argument to shout.
     */
    function priorityShout(eventNames: string[], arg?: any) {
        for (let name of eventNames) {
            let results: any = event(name, null, arg, undefined, true);

            if (results.hasResult) {
                return results[results.length - 1];
            }
        }

        return undefined;
    }

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
    function shout(name: string, arg?: any) {
        if (!hasValue(name) || typeof name !== 'string') {
            throw new Error('shout() name must be a string.');
        }
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
        if (!hasValue(eventName) || typeof eventName !== 'string') {
            throw new Error('whisper() eventName must be a string.');
        }
        let bots;
        if (Array.isArray(bot)) {
            bots = bot;
        } else if (hasValue(bot)) {
            bots = [bot];
        } else {
            return [];
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
    function getCameraPosition(portal: 'grid' | 'miniGrid' = 'grid'): Vector3 {
        const bot = context.global[`${portal}PortalBot`];
        if (!bot) {
            return new Vector3(NaN, NaN, NaN);
        }

        return new Vector3(
            bot.tags[`cameraPositionX`],
            bot.tags[`cameraPositionY`],
            bot.tags[`cameraPositionZ`]
        );
    }

    /**
     * Gets the 3D rotation of the player's camera.
     * @param portal The portal that the camera rotation should be retrieved for.
     */
    function getCameraRotation(portal: 'grid' | 'miniGrid' = 'grid'): {
        x: number;
        y: number;
        z: number;
    } {
        const bot = context.global[`${portal}PortalBot`];
        if (!bot) {
            return {
                x: NaN,
                y: NaN,
                z: NaN,
            };
        }

        return {
            x: bot.tags[`cameraRotationX`],
            y: bot.tags[`cameraRotationY`],
            z: bot.tags[`cameraRotationZ`],
        };
    }

    /**
     * Gets the 3D point that the player's camera is focusing on.
     * @param portal The portal that the camera focus point should be retrieved for.
     */
    function getFocusPoint(portal: 'grid' | 'miniGrid' = 'grid'): Vector3 {
        const bot = context.global[`${portal}PortalBot`];
        if (!bot) {
            return new Vector3(NaN, NaN, NaN);
        }

        return new Vector3(
            bot.tags[`cameraFocusX`],
            bot.tags[`cameraFocusY`],
            bot.tags[`cameraFocusZ`]
        );
    }

    /**
     * Gets the 3D position of the player's pointer.
     * @param pointer The position of the pointer to retrieve.
     */
    function getPointerPosition(
        pointer: 'mouse' | 'left' | 'right' = 'mouse'
    ): Vector3 {
        const user = context.playerBot;
        if (!user) {
            return new Vector3(NaN, NaN, NaN);
        }

        return new Vector3(
            user.tags[`${pointer}PointerPositionX`],
            user.tags[`${pointer}PointerPositionY`],
            user.tags[`${pointer}PointerPositionZ`]
        );
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
     * Gets the 3D direction that the given pointer is pointing in.
     * @param pointer The pointer to get the direction of.
     */
    function getPointerDirection(
        pointer: 'mouse' | 'left' | 'right' = 'mouse'
    ): Vector3 {
        const rotation = getPointerRotation(pointer);
        if (isNaN(rotation.x) || isNaN(rotation.y) || isNaN(rotation.z)) {
            return new Vector3(NaN, NaN, NaN);
        }
        return getForwardDirection(rotation);
    }

    /**
     * Gets the input state of the given button on the given controller.
     * @param controller The name of the controller that should be checked.
     * @param button The name of the button on the controller.
     */
    function getInputState(
        controller: string,
        button: string
    ): null | 'down' | 'held' {
        const user = context.playerBot;
        if (!user) {
            return null;
        }

        return user.tags[`${controller}_${button}`] || null;
    }

    /**
     * Gets the list of inputs that are currently available.
     */
    function getInputList(): string[] {
        const user = context.playerBot;
        if (!user) {
            return [];
        }

        return user.tags.inputList || [];
    }

    /**
     * Gets permission from user to access audio and/or video streams from the device.
     * @param options The options.
     */
    function getMediaPermission(options: MediaPermssionOptions) {
        const task = context.createTask();
        const event = calcGetMediaPermission(options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Gets the current average frame rate for the 3D portals in seconds.
     * @returns A promise that resolves with the number of frames over the last second.
     */
    function getAverageFrameRate(): Promise<number> {
        const task = context.createTask();
        const event = calcGetAverageFrameRate(task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Attempts to join the given meeting room.
     * @param roomName The name of the meeting room to join.
     * @param options The options for the meeting.
     */
    function joinRoom(
        roomName: string,
        options: JoinRoomActionOptions = {}
    ): Promise<JoinRoomResult> {
        const task = context.createTask();
        const event = calcJoinRoom(roomName, options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Attempts to leave the given meeting room.
     * @param roomName THe name of the meeting room to leave.
     * @param options The options.
     */
    function leaveRoom(
        roomName: string,
        options: RecordActionOptions = {}
    ): Promise<LeaveRoomResult> {
        const task = context.createTask();
        const event = calcLeaveRoom(roomName, options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Attempts to set the options for the given meeting room.
     * Useful for enabling/disabling video, audio, and screensharing.
     * @param roomName The name of the room.
     * @param options The options to set. Omitted properties remain unchanged.
     */
    function setRoomOptions(
        roomName: string,
        options: Partial<RoomOptions>
    ): Promise<SetRoomOptionsResult> {
        const task = context.createTask();
        const event = calcSetRoomOptions(roomName, options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Gets the options for the given meeting room.
     * Returns a promise that resolves with the options.
     * @param roomName The name of the room that the options should be retrieved for.
     */
    function getRoomOptions(roomName: string): Promise<GetRoomOptionsResult> {
        const task = context.createTask();
        const event = calcGetRoomOptions(roomName, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Gets the options for the track with the given address in the given room.
     * @param roomName The name of the room.
     * @param address The address of the track that the options should be retrieved for.
     */
    function getRoomTrackOptions(
        roomName: string,
        address: string
    ): Promise<GetRoomTrackOptionsResult> {
        const task = context.createTask();
        const event = calcGetRoomTrackOptions(roomName, address, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Sets the options for the track with the given address in the given room.
     * @param roomName The name of the room.
     * @param address The address of the track that the options should be retrieved for.
     * @param options The options that should be set for the track.
     */
    function setRoomTrackOptions(
        roomName: string,
        address: string,
        options: SetRoomTrackOptions
    ): Promise<SetRoomTrackOptionsResult> {
        const task = context.createTask();
        const event = calcSetRoomTrackOptions(
            roomName,
            address,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the options for the specified remote user in the specified room.
     * @param roomName The name of the room.
     * @param remoteId The ID of the remote user.
     */
    function getRoomRemoteOptions(
        roomName: string,
        remoteId: string
    ): Promise<GetRoomRemoteOptionsResult> {
        const task = context.createTask();
        const event = calcGetRoomRemoteOptions(roomName, remoteId, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Runs an event on the given bots.
     * @param name The name of the event to run.
     * @param bots The bots that the event should be executed on. If null, then the event will be run on every bot.
     * @param arg The argument to pass.
     * @param sort Whether to sort the Bots before processing. Defaults to true.
     * @param shortCircuit Whether to stop processing bots when one returns a value.
     */
    function event(
        name: string,
        bots: (Bot | string)[],
        arg?: any,
        sendListenEvents: boolean = true,
        shortCircuit: boolean = false
    ): any[] {
        const startTime = globalThis.performance.now();
        let tag = trimEvent(name);

        let ids = !!bots
            ? bots.map((bot) => {
                  return !!bot
                      ? typeof bot === 'string'
                          ? bot
                          : bot.id
                      : null;
              })
            : context.getBotIdsWithListener(tag);

        let results = [] as any[];

        let targets = [] as RuntimeBot[];
        let listeners = [] as RuntimeBot[];
        let checkedEnergy = false;
        let stop = false;

        for (let id of ids) {
            if (stop) {
                break;
            }
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
                if (!checkedEnergy) {
                    checkedEnergy = true;
                    __energyCheck();
                }
                try {
                    const result = listener(arg);

                    if (result instanceof Promise) {
                        result.catch((ex) => {
                            context.enqueueError(ex);
                        });
                    }
                    results.push(result);

                    if (shortCircuit && result !== undefined) {
                        stop = true;
                    }
                } catch (ex) {
                    context.enqueueError(ex);
                    results.push(undefined);
                }
                listeners.push(bot);
            }
        }

        const endTime = globalThis.performance.now();
        const delta = endTime - startTime;
        context.addShoutTime(name, delta);

        if (sendListenEvents) {
            const listenArg = {
                name: name,
                that: arg,
                responses: results,
                targets,
                listeners,
            };
            event('onListen', listeners, listenArg, false);
            event('onAnyListen', null, listenArg, false);
        }

        if (shortCircuit && stop) {
            (<any>results).hasResult = true;
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

    function getDownloadState(state: BotsState): {
        version: number;
        state: BotsState;
    } {
        return {
            version: 1,
            state,
        };
    }

    function isPdf(filename: string): boolean {
        return filename.endsWith('.pdf');
    }

    function formatAuxFilename(filename: string): string {
        if (filename.endsWith('.aux')) {
            return filename;
        } else if (isPdf(filename)) {
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
