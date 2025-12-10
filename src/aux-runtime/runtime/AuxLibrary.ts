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
    AuxGlobalContext,
    AsyncTask,
    TimeoutOrIntervalTimer,
    AsyncIterableTask,
} from './AuxGlobalContext';
import { DEBUG_STRING, debugStringifyFunction } from './AuxGlobalContext';
import type {
    BotTags,
    Bot,
    ShowChatOptions,
    BotAction,
    BotsState,
    CameraType,
    BarcodeFormat,
    PortalType,
    ShowInputOptions,
    LocalFormAnimationAction,
    AsyncActions,
    ShareOptions,
    Easing,
    BotAnchorPoint,
    RuntimeBot,
    BotSpace,
    EaseType,
    RegisterPrefixOptions,
    OpenCircleWipeOptions,
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
    ReplaceDragBotAction,
    ShowInputForTagAction,
    GoToDimensionAction,
    GoToURLAction,
    OpenURLAction,
    OpenConsoleAction,
    RejectAction,
    FocusOnOptions,
    SnapTarget,
    AddDropSnapTargetsAction,
    RecordingOptions,
    Recording,
    SyntheticVoice,
    EnablePOVAction,
    EnableCustomDraggingAction,
    SetAppOutputAction,
    AuthData,
    PartialBotsState,
    PartialBot,
    ParsedBotLink,
    ConvertGeolocationToWhat3WordsOptions,
    BeginAudioRecordingAction,
    MediaPermssionOptions,
    ImageClassifierOptions,
    ClassifyImagesOptions,
    ClassifyImagesResult,
    SnapGrid,
    AddDropGridTargetsAction,
    InstUpdate,
    StartFormAnimationOptions,
    StopFormAnimationOptions,
    FormAnimationData,
    WakeLockConfiguration,
    EnableXROptions,
    ShowConfirmOptions,
    ShowAlertOptions,
    StoredAux,
    StoredAuxVersion2,
    StoredAuxVersion1,
    Geolocation,
    OpenPhotoCameraOptions,
    Photo,
    Point2D,
    RecordLoomOptions,
    LoomVideo,
    LoomVideoEmbedMetadata,
    InstallAuxFileMode,
    LoadServerConfigAction,
    InstConfig,
    UnloadServerConfigAction,
    Point3D,
    MapLayer,
    DynamicListener,
    HideLoadingScreenAction,
    AddBotMapLayerAction,
    RemoveBotMapLayerAction,
    TrackConfigBotTagsAction,
    GenerateQRCodeOptions,
} from '@casual-simulation/aux-common/bots';
import {
    hasValue,
    trimTag,
    isBot,
    BOT_SPACE_TAG,
    toast as toastMessage,
    getScriptIssues as scriptIssues,
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
    generateQRCode as calcGenerateQRCode,
    openBarcodeScanner as calcOpenBarcodeScanner,
    showBarcode as calcShowBarcode,
    importAUX as calcImportAUX,
    showInputForTag as calcShowInputForTag,
    showInput as calcShowInput,
    showConfirm as calcShowConfirm,
    showAlert as calcShowAlert,
    replaceDragBot as calcReplaceDragBot,
    goToDimension as calcGoToDimension,
    goToURL as calcGoToURL,
    openURL as calcOpenURL,
    playSound as calcPlaySound,
    bufferSound as calcBufferSound,
    cancelSound as calcCancelSound,
    shell as calcShell,
    reject as calcReject,
    localFormAnimation as calcLocalFormAnimation,
    webhook as calcWebhook,
    superShout as calcSuperShout,
    share as calcShare,
    registerPrefix as calcRegisterPrefix,
    localPositionTween as calcLocalPositionTween,
    localRotationTween as calcLocalRotationTween,
    showUploadFiles as calcShowUploadFiles,
    download,
    loadSimulation,
    unloadSimulation,
    getUploadState,
    addState,
    getPortalTag,
    KNOWN_PORTALS,
    openConsole,
    tagsOnBot,
    getOriginalObject,
    getBotSpace,
    trimEvent,
    CREATE_ACTION_NAME,
    CREATE_ANY_ACTION_NAME,
    DESTROY_ACTION_NAME,
    ORIGINAL_OBJECT,
    getRemoteCount,
    getRemotes,
    listInstUpdates as calcListInstUpdates,
    getInstStateFromUpdates as calcGetInstStateFromUpdates,
    action,
    calculateAnchorPoint,
    calculateAnchorPointOffset,
    getBotPosition as calcGetBotPosition,
    getBotRotation as calcGetBotRotation,
    isRuntimeBot,
    SET_TAG_MASK_SYMBOL,
    CLEAR_TAG_MASKS_SYMBOL,
    getBotScale,
    EDIT_TAG_SYMBOL,
    EDIT_TAG_MASK_SYMBOL,
    circleWipe,
    addDropSnap as calcAddDropSnap,
    addDropGrid as calcAddDropGrid,
    animateToPosition,
    beginAudioRecording as calcBeginAudioRecording,
    endAudioRecording as calcEndAudioRecording,
    beginRecording as calcBeginRecording,
    endRecording as calcEndRecording,
    speakText as calcSpeakText,
    getVoices as calcGetVoices,
    getGeolocation as calcGetGeolocation,
    cancelAnimation,
    disablePOV,
    enablePOV,
    enableCustomDragging as calcEnableCustomDragging,
    MINI_PORTAL,
    registerCustomApp,
    setAppOutput,
    unregisterCustomApp,
    requestAuthData as calcRequestAuthData,
    signOut as calcSignOut,
    createBot,
    defineGlobalBot as calcDefineGlobalBot,
    TEMPORARY_BOT_PARTITION_ID,
    convertToString,
    GET_TAG_MASKS_SYMBOL,
    isBotLink,
    parseBotLink,
    createBotLink,
    convertGeolocationToWhat3Words as calcConvertGeolocationToWhat3Words,
    meetCommand as calcMeetCommand,
    meetFunction as calcMeetFunction,
    openImageClassifier as calcOpenImageClassifier,
    classifyImages as calcOpenClassifyImages,
    isBotDate,
    DATE_TAG_PREFIX,
    parseBotDate,
    realNumberOrDefault,
    raycastFromCamera as calcRaycastFromCamera,
    raycastInPortal as calcRaycastInPortal,
    calculateRayFromCamera as calcCalculateRayFromCamera,
    bufferFormAddressGltf,
    startFormAnimation as calcStartFormAnimation,
    stopFormAnimation as calcStopFormAnimation,
    listFormAnimations as calcListFormAnimations,
    calculateStringTagValue,
    createInitializationUpdate as calcCreateInitalizationUpdate,
    applyUpdatesToInst as calcApplyUpdatesToInst,
    configureWakeLock,
    getWakeLockConfiguration as calcGetWakeLockConfiguration,
    analyticsRecordEvent as calcAnalyticsRecordEvent,
    KNOWN_TAGS,
    isStoredVersion2,
    getCurrentInstUpdate as calcGetCurrentInstUpdate,
    openPhotoCamera as calcOpenPhotoCamera,
    getEasing,
    enableCollaboration as calcEnableCollaboration,
    showAccountInfo as calcShowAccountInfo,
    reportInst as calcReportInst,
    getRecordsEndpoint as calcGetRecordsEndpoint,
    ldrawCountAddressBuildSteps as calcLdrawCountAddressBuildSteps,
    ldrawCountTextBuildSteps as calcLdrawCountTextBuildSteps,
    calculateViewportCoordinatesFromPosition as calcCalculateViewportCoordinatesFromPosition,
    calculateScreenCoordinatesFromViewportCoordinates as calcCalculateScreenCoordinatesFromViewportCoordinates,
    calculateViewportCoordinatesFromScreenCoordinates as calcCalculateViewportCoordinatesFromScreenCoordinates,
    capturePortalScreenshot as calcCapturePortalScreenshot,
    createStaticHtml as calcCreateStaticHtmlFromBots,
    recordLoom,
    watchLoom,
    getLoomMetadata,
    loadSharedDocument,
    installAuxFile as calcInstallAuxFile,
    calculateStringListTagValue,
    calculateScreenCoordinatesFromPosition as calcCalculateScreenCoordinatesFromPosition,
    addMapLayer as calcAddMapLayer,
    removeMapLayer as calcRemoveMapLayer,
    GET_DYNAMIC_LISTENERS_SYMBOL,
    ADD_BOT_LISTENER_SYMBOL,
    REMOVE_BOT_LISTENER_SYMBOL,
    trackConfigBotTags as calcTrackConfigBotTags,
} from '@casual-simulation/aux-common/bots';
import type {
    AIChatOptions,
    AIGenerateSkyboxOptions,
    AIGenerateSkyboxAction,
    AIGenerateImageOptions,
    AIGenerateImageAction,
    RecordFileActionOptions,
    JoinRoomActionOptions,
    RoomOptions,
    RoomTrackOptions,
    SetRoomTrackOptions,
    RoomRemoteOptions,
    DataRecordOptions,
    RecordActionOptions,
    ListDataOptions,
    AISloydGenerateModelOptions,
    ListWebhooksOptions,
    ListNotificationsOptions,
    SendNotificationOptions,
    GrantEntitlementsRequest,
    GrantEntitlementsResult,
    InstallPackageResult,
    ListPermissionsRequest,
    ListedChatModel,
    StoreItem,
    PurchasableItemReference,
} from './RecordsEvents';
import {
    aiChat,
    aiChatStream,
    aiListChatModels,
    aiGenerateSkybox,
    aiGenerateImage,
    grantRecordPermission as calcGrantRecordPermission,
    revokeRecordPermission as calcRevokeRecordPermission,
    listPermissions as calcListPermissions,
    grantInstAdminPermission as calcGrantInstAdminPermission,
    grantUserRole as calcGrantUserRole,
    revokeUserRole as calcRevokeUserRole,
    grantInstRole as calcGrantInstRole,
    revokeInstRole as calcRevokeInstRole,
    listUserStudios as calcListUserStudios,
    listStudioRecords as calcListStudioRecords,
    joinRoom as calcJoinRoom,
    leaveRoom as calcLeaveRoom,
    setRoomOptions as calcSetRoomOptions,
    getRoomOptions as calcGetRoomOptions,
    getRoomTrackOptions as calcGetRoomTrackOptions,
    setRoomTrackOptions as calcSetRoomTrackOptions,
    getRoomRemoteOptions as calcGetRoomRemoteOptions,
    listDataRecord,
    recordEvent as calcRecordEvent,
    getEventCount as calcGetEventCount,
    getFile as calcGetFile,
    eraseFile as calcEraseFile,
    getPublicRecordKey as calcGetPublicRecordKey,
    recordData as calcRecordData,
    getRecordData,
    eraseRecordData,
    recordFile as calcRecordFile,
    listDataRecordByMarker,
    aiHumeGetAccessToken,
    aiSloydGenerateModel,
    recordWebhook as calcRecordWebhook,
    getWebhook as calcGetWebhook,
    listWebhooks as calcListWebhooks,
    listWebhooksByMarker as calcListWebhooksByMarker,
    eraseWebhook as calcEraseWebhook,
    runWebhook as calcRunWebhook,
    recordNotification as calcRecordNotification,
    getNotification as calcGetNotification,
    listNotifications as calcListNotifications,
    listNotificationsByMarker as calcListNotificationsByMarker,
    eraseNotification as calcEraseNotification,
    subscribeToNotification as calcSubscribeToNotification,
    unsubscribeFromNotification as calcUnsubscribeFromNotification,
    sendNotification as calcSendNotification,
    listNotificationSubscriptions as calcListNotificationSubscriptions,
    listUserNotificationSubscriptions as calcListUserNotificationSubscriptions,
    // getXpUserMeta,
    // createXpContract,
    aiOpenAICreateRealtimeSession,
    grantEntitlements as calcGrantEntitlements,
    recordPackageVersion as calcRecordPackageVersion,
    erasePackageVersion as calcErasePackageVersion,
    listPackageVersions as calcListPackageVersions,
    getPackageVersion as calcGetPackageVersion,
    recordPackageContainer as calcRecordPackageContainer,
    erasePackageContaienr as calcErasePackageContainer,
    listPackageContainers as calcListPackageContainers,
    listPackageContainersByMarker as calcListPackageContainersByMarker,
    getPackageContainer as calcGetPackageContainer,
    installPackage as calcInstallPackage,
    listInstalledPackages as calcListInstalledPackages,
    listInsts as calcListInsts,
    listInstsByMarker as calcListInstsByMarker,
    recordsCallProcedure,
    recordStoreItem as calcRecordStoreItem,
    getStoreItem as calcGetStoreItem,
    eraseStoreItem as calcEraseStoreItem,
    listStoreItems as calcListStoreItems,
    listStoreItemsByMarker as calcListStoreItemsByMarker,
    purchaseStoreItem as calcPurchaseStoreItem,
} from './RecordsEvents';
import { sortBy, cloneDeep, union, isEqual } from 'es-toolkit/compat';
import type {
    DeviceSelector,
    RemoteAction,
    AvailablePermissions,
    Entitlement,
    VersionNumber,
    GenericResult,
    SimpleError,
    GenericSuccess,
    JSONAccountBalance,
} from '@casual-simulation/aux-common';
import {
    remote as calcRemote,
    DEFAULT_BRANCH_NAME,
    formatVersionNumber,
    parseVersionNumber,
    PRIVATE_MARKER,
} from '@casual-simulation/aux-common';
import { RanOutOfEnergyError } from './AuxResults';
import '@casual-simulation/aux-common/polyfill/Array.first.polyfill';
import '@casual-simulation/aux-common/polyfill/Array.last.polyfill';
import {
    embedBase64InPdf,
    getEmbeddedBase64FromPdf,
    toHexString as utilToHexString,
    fromHexString as utilFromHexString,
} from './Utils';
import { convertToCopiableValue } from '@casual-simulation/aux-common/partitions/PartitionUtils';
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
import {
    apply,
    del,
    insert,
    isTagEdit,
    preserve,
} from '@casual-simulation/aux-common/bots';
import { Vector3 as ThreeVector3, Plane, Ray } from '@casual-simulation/three';
import mime from 'mime';
import TWEEN from '@tweenjs/tween.js';
import './PerformanceNowPolyfill';
import '@casual-simulation/aux-common/BlobPolyfill';
import type { AuxDevice } from './AuxDevice';
import type { AuxVersion } from './AuxVersion';
import {
    Vector3,
    Vector2,
    Quaternion,
    Rotation,
} from '@casual-simulation/aux-common/math';
import { Fragment, h } from 'preact';
import htm from 'htm';
import { fromByteArray, toByteArray } from 'base64-js';
import type { Tester } from '@casual-simulation/expect';
import expect, { iterableEquality } from '@casual-simulation/expect';
import {
    parseRecordKey,
    isRecordKey as calcIsRecordKey,
} from '@casual-simulation/aux-common';
import type {
    AIChatInterfaceStreamResponse,
    AIChatMessage,
    CreateRecordResult,
    GrantResourcePermissionResult,
    ListStudiosResult,
    ListRecordsResult,
    ListSubscriptionsResult,
    NotificationRecord,
    PushNotificationPayload,
    RevokePermissionResult,
    ListPermissionsResult,
    SendNotificationResult,
    SubscribeToNotificationResult,
    UnsubscribeToNotificationResult,
    WebhookRecord,
    CreatePublicRecordKeyResult,
    GetDataResult,
    RecordDataResult,
    RecordFileFailure,
    EraseDataResult,
    EraseFileResult,
    ListDataResult,
    AddCountResult,
    GetCountResult,
    GrantMarkerPermissionResult,
    GrantRoleResult,
    RevokeRoleResult,
    PackageRecord,
    ListInstalledPackagesResult,
    ListInstsResult,
    EraseInstResult,
    PurchasableItem,
    PayoutDestination,
    ContractPricing,
} from '@casual-simulation/aux-records';
import SeedRandom from 'seedrandom';
import { DateTime } from 'luxon';
import * as hooks from 'preact/hooks';
import { render, createRef, createContext } from 'preact';
import * as compat from 'preact/compat';
import type {
    Breakpoint,
    InterpreterContinuation,
    InterpreterStop,
} from '@casual-simulation/js-interpreter';
import {
    isGenerator,
    UNCOPIABLE,
    unwind,
} from '@casual-simulation/js-interpreter/InterpreterUtils';
import { INTERPRETABLE_FUNCTION } from './AuxCompiler';
import type { AuxRuntime } from './AuxRuntime';
import {
    constructInitializationUpdate,
    mergeInstUpdates as calcMergeInstUpdates,
} from '@casual-simulation/aux-common/partitions/PartitionUtils';
import type { AxiosResponse } from 'axios';
import { CasualOSError } from './CasualOSError';
import type {
    AICreateOpenAIRealtimeSessionTokenResult,
    AIGenerateImageSuccess,
    AIHumeGetAccessTokenResult,
    AISloydGenerateModelResponse,
} from '@casual-simulation/aux-records/AIController';
import type {
    RuntimeActions,
    RuntimeAsyncActions,
    TagMapper,
} from './RuntimeEvents';
import { attachRuntime, detachRuntime } from './RuntimeEvents';
import type {
    CrudEraseItemResult,
    CrudGetItemResult,
    CrudListItemsResult,
    CrudRecordItemResult,
} from '@casual-simulation/aux-records/crud/CrudRecordsController';
import type { HandleWebhookResult } from '@casual-simulation/aux-records/webhooks/WebhookRecordsController';
import type { SharedDocument } from '@casual-simulation/aux-common/documents/SharedDocument';
import type { CreateRealtimeSessionTokenRequest } from '@casual-simulation/aux-records/AIOpenAIRealtimeInterface';
import type {
    PackageRecordVersion,
    PackageRecordVersionKey,
    PackageRecordVersionKeySpecifier,
    RecordPackageVersionResult,
} from '@casual-simulation/aux-records/packages/version';
import type {
    EraseDocumentResult,
    SearchCollectionSchema,
    SearchDocument,
    SearchRecord,
    SearchRecordOutput,
    StoreDocumentResult,
} from '@casual-simulation/aux-records/search';
import type {
    DatabaseRecordOutput,
    DatabaseStatement,
    QueryResult,
} from '@casual-simulation/aux-records/database';
import { query as q } from './database/DatabaseUtils';
import type {
    ContractInvoice,
    ContractRecord,
    InvoicePayoutDestination,
} from '@casual-simulation/aux-records/contracts/ContractRecordsStore';
import type { ContractRecordInput } from '@casual-simulation/aux-records/contracts/ContractRecordsController';
// import type { PurchasableItem } from '@casual-simulation/aux-records/casualware/PurchasableItemRecordsStore';

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    h: (name: string | Function, props: any, ...children: any[]) => any;
    f: any;
}

export interface APIPurchaseContractRequest {
    recordName: string;
    address: string;
    expectedCost: number;
    currency: 'usd';

    returnUrl: string;
    successUrl: string;
}
export interface APIInvoiceContractRequest {
    contractId: string;
    amount: number;
    note?: string;
    payoutDestination: InvoicePayoutDestination;
}
export interface APIPayoutRequest {
    amount?: number;
    destination?: PayoutDestination;
}

/**
 * Creates a new interpretable function based on the given function.
 * @param interpretableFunc
 */
export function createInterpretableFunction<TArg extends Array<any>, R>(
    interpretableFunc: (...args: TArg) => Generator<any, R, any>
): {
    (...args: TArg): R;
    [INTERPRETABLE_FUNCTION]: (...args: TArg) => Generator<any, R, any>;
} {
    const normalFunc = ((...args: TArg) =>
        unwind(interpretableFunc(...args))) as any;

    (normalFunc as any)[INTERPRETABLE_FUNCTION] = interpretableFunc;
    return normalFunc as any;
}

/**
 * Sets the INTERPRETABLE_FUNCTION property on the given object (semantically a function) to the given interpretable version and returns the object.
 * @param interpretableFunc The version of the function that should be used as the interpretable version of the function.
 * @param normalFunc The function that should be tagged.
 */
export function tagAsInterpretableFunction<T, N>(
    interpretableFunc: T,
    normalFunc: N
): N & {
    [INTERPRETABLE_FUNCTION]: T;
} {
    (normalFunc as any)[INTERPRETABLE_FUNCTION] = interpretableFunc;
    return normalFunc as any;
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

/**
 * Defines the possible values that can be used as a tag filter.
 *
 * @dochash types/core
 * @docgroup 01-core
 * @docname TagFilter
 */
export type TagFilter =
    | ((value: any) => boolean)
    | string
    | number
    | boolean
    | null
    | undefined;

/**
 * Defines a type that represents a mod.
 * That is, a set of tags that can be applied to another bot.
 *
 * @dochash types/core
 * @docgroup 01-core
 * @docname Mod
 */
export type Mod = BotTags | Bot;

/**
 * An interface that is used to say which user/device/session an event should be sent to.
 *
 * @dochash types/os/event
 * @docname SessionSelector
 */
export interface SessionSelector {
    userId?: string;
    sessionId?: string;
    connectionId?: string;
    broadcast?: boolean;
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
 *
 * @dochash types/web
 * @doctitle Web Types
 * @docsidebar Web
 * @docdescription These types are used for web requests.
 * @docname WebhookOptions
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
     *
     * @docsource Headers
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
    options?: AIGenerateSkyboxOptions;
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
 * Defines an interface that represents a result from {@link ai.generateImage-request}.
 * @dochash types/ai
 * @docname AIGenerateImageSuccess
 */
export interface AIGenerateImageAPISuccess {
    success: true;

    /**
     * The list of images that were generated.
     */
    images: AIGeneratedImageAPI[];
}

/**
 * Defines an interface that represents an AI generated image.
 *
 * @dochash types/ai
 * @docname AIGeneratedImage
 */
export interface AIGeneratedImageAPI {
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

    /**
     * The MIME Type of the image data.
     */
    mimeType: string;
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
    key: PackageRecordVersionKey;

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

/**
 * Defines an interface that represents a request for {@link recordSearchCollection}.
 *
 * @dochash types/records/search
 * @docname RecordSearchCollectionRequest
 */
export interface RecordSearchCollectionApiRequest {
    /**
     * The name of the record that the collection should be recorded to.
     */
    recordName: string;

    /**
     * The address that the collection should be recorded to.
     */
    address: string;

    /**
     * The schema that should be used for the collection.
     */
    schema: SearchCollectionSchema;

    /**
     * The markers that should be applied to the collection.
     */
    markers?: string[];
}

/**
 * Defines an interface that represents a request for {@link recordSearchDocument}.
 *
 * @dochash types/records/search
 * @docname RecordSearchDocumentRequest
 */
export interface RecordSearchDocumentApiRequest {
    recordName: string;
    address: string;
    document: SearchDocument;
}

/**
 * Defines an interface that represents a request for {@link recordDatabase}.
 *
 * @dochash types/records/database
 * @docname RecordDatabaseRequest
 */
export interface RecordDatabaseApiRequest {
    /**
     * The name of the record that the database should be recorded to.
     */
    recordName: string;

    /**
     * The address that the database should be recorded to.
     */
    address: string;

    /**
     * The markers that should be applied to the database.
     */
    markers?: string[];
}

/**
 * Defines a set of options for {@link animateTag-byTag}.
 *
 * @dochash types/animation
 * @doctitle Animation Types
 * @docsidebar Animation
 * @docdescription These types are used for animating tags.
 * @docname AnimateTagOptions
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

/**
 * Defines a bot filter function.
 *
 * Common bot filters are {@link byTag}
 *
 * @dochash types/core
 * @docgroup 01-core
 * @docname BotFilter
 */
export type BotFilter = ((bot: Bot) => boolean) | null;

/**
 * Defines a bot filter function.
 */
export interface BotFilterFunction {
    (bot: Bot): boolean;
    sort?: (bot: Bot) => any;
    [DEBUG_STRING]?: string;
}

/**
 * Defines the options for {@link experiment.speakText}.
 *
 * @dochash types/experimental
 * @docname SpeakTextOptions
 */
export interface SpeakTextApiOptions {
    /**
     * The rate that the text should be spoken at.
     * This can be any positive number.
     */
    rate?: number;

    /**
     * The pitch that the text should be spoken at.
     * This can be any positive number.
     */
    pitch?: number;

    /**
     * The voice that the text should be spoken with.
     * This can be the voice object or the name of a voice.
     * Note that not all browsers support the same voices.
     */
    voice?: string | SyntheticVoice;
}

/**
 * Defines a set of options for a tween.
 *
 * @dochash types/experimental
 * @docname TweenOptions
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

    loadTimes: {
        [key: string]: number;
    };
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
    config?: RuntimeBot;
}

export const GET_RUNTIME = Symbol('get_runtime');

/**
 * Defines an interface for objects that represent a debugger and can retrieve their internal runtime.
 */
export interface DebuggerInterface {
    /**
     * Gets the runtime for the debugger.
     */
    [GET_RUNTIME]: () => AuxRuntime;
}

export interface DebuggerBase {
    // /**
    //  * Gets the config bot from the debugger.
    //  * May be null.
    //  */
    // get configBot(): Bot;

    /**
     * Gets the list of portal bots in the debugger.
     */
    getPortalBots(): Map<string, Bot>;

    /**
     * Gets the list of action objects that have been performed by bots in the current debugger.
     * Action objects are used by CasualOS to represent changes to bots or external effects that should be performed.
     * Examples of this are {@link create}, {@link os.toast} and {@link os.enableVR}.
     *
     * @example Get the list of bot changes and actions that have been performed in a debugger
     * const debug = await os.createDebugger();
     * debug.create({
     *     test: '@os.toast("Hello")'
     * });
     * debug.shout("test");
     *
     * const actions = debug.getAllActions();
     *
     * assertEqual(actions, [
     *     {
     *         type: 'add_bot',
     *         id: 'uuid-1',
     *         bot: {
     *             id: 'uuid-1',
     *             tags: {
     *                 test: '@os.toast("Hello")'
     *             }
     *         }
     *     },
     *     {
     *         type: 'show_toast',
     *         message: 'Hello',
     *         duration: 2000
     *     }
     * ]);
     */
    getAllActions(): BotAction[];

    /**
     * Gets the list of common action objects that have been performed by bots in the current debugger. Action objects are used by CasualOS to represent changes to bots or external effects that should be performed.
     * Common actions are actions that do not immediately change bots or bot tags or masks.
     *
     * Examples of common actions are {@link os.toast} and {@link os.enableVR}.
     *
     * @example Get the list of actions that have been performed in a debugger
     * const debug = await os.createDebugger();
     * debug.create({
     *     test: '@os.toast("Hello")'
     * });
     * debug.shout("test");
     *
     * const actions = debug.getCommonActions();
     *
     * assertEqual(actions, [
     *     {
     *         type: 'show_toast',
     *         message: 'Hello',
     *         duration: 2000
     *     }
     * ]);
     */
    getCommonActions(): BotAction[];

    /**
     * Gets the list of bot actions that have been performed by bots in the current debugger.
     * Action objects are used by CasualOS to represent changes to bots or external effects that should be performed.
     * Bot actions are actions that immediately change bots or bot tags or masks.
     *
     * Examples of bot actions are {@link create}, {@link destroy} or {@link setTagMask}.
     *
     * @example Get the list of bot changes that have been performed in a debugger
     * const debug = await os.createDebugger();
     * debug.create({
     *     test: '@os.toast("Hello")'
     * });
     * debug.shout("test");
     *
     * const actions = debug.getBotActions();
     *
     * assertEqual(actions, [
     *     {
     *         type: 'add_bot',
     *         id: 'uuid-1',
     *         bot: {
     *             id: 'uuid-1',
     *             tags: {
     *                 test: '@os.toast("Hello")'
     *             }
     *         }
     *     },
     * ]);
     */
    getBotActions(): BotAction[];

    /**
     * Gets the list of errors that have occurred in the current debugger. Errors occur when an exceptional event happens in a script and prevents the rest of the script from executing.
     *
     * Debuggers capture these errors and let you inspect them afterwards.
     *
     * @example Get the list of errors that have happened in a debugger
     * const debug = await os.createDebugger();
     * debug.create({
     *     test: '@throw new Error("My Error")'
     * });
     * debug.shout("test");
     *
     * const errors = debug.getErrors();
     *
     * assertEqual(errors.length, 1);
     * assertEqual(errors[0].error, new Error("My Error"));
     * assertEqual(errors[0].tag, "test");
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
     * Registers the given handler function to be called before a user action is performed in the debugger.
     *
     * User actions are like normal actions, except they are generated by the CasualOS frontend.
     * Generally, this only happens for built-in shouts and whispers.
     * Additionally, these actions can only be automatically created for debuggers that are attached using {@link os.attachDebugger}.
     *
     * @param listener the function that should be called before a user action is performed.
     *
     * @example Listen for tag updates in a debugger
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     *
     * // Register a listener that gets called whenever a user action is about to be performed.
     * debug.onBeforeUserAction(update => {
     *     console.log('user action', update);
     * });
     *
     * // Because the debugger is pausable, the create() function returns a promise
     * // because it calls @onCreate which could cause a pause trigger to be hit.
     * const debuggerBot = await debug.create({
     *     home: true,
     * });
     *
     * // Attach the debugger to the front end
     * await os.attachDebugger(debug);
     *
     * @docname onBeforeUserAction
     * @docid debug.onBeforeUserAction
     */
    onBeforeUserAction(listener: (action: BotAction) => void): void;

    /**
     * Registers the given handler function to be called by the debugger whenever a script enqueues an action.
     * This occurrs for common actions like {@link os.toast} and {@link os.showInput}.
     *
     * Every action that is enqueued ends up being performed.
     *
     * @param listener the function that should be called whenever an action is scheduled to be performed.
     *
     * @example Listen for actions to be enqueued in a debugger
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     *
     * // Register a listener that gets called whenever an action is scheduled to be performed.
     * debug.onScriptActionEnqueued(action => {
     *     console.log('action enqueued', action);
     * });
     *
     * // Because the debugger is pausable, the create() function returns a promise
     * // because it calls @onCreate which could cause a pause trigger to be hit.
     * const debuggerBot = await debug.create({
     *     test: '@let abc = 123; os.toast(abc);'
     * });
     *
     * // Send a shout. Just like the create() function above, we recieve a promise that we can await.
     * await debug.shout('test');
     */
    onScriptActionEnqueued(listener: (action: BotAction) => void): void;

    /**
     * Registers the given handler function to be called after any tag is updated in the debugger.
     *
     * @param listener the function that should be called when a tag is updated.
     *
     * @example Listen for tag updates in a debugger
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     *
     * // Register a listener that gets called whenever a tag is updated.
     * debug.onAfterScriptUpdatedTag(update => {
     *     console.log('tag updated', update);
     * });
     *
     * // Because the debugger is pausable, the create() function returns a promise
     * // because it calls @onCreate which could cause a pause trigger to be hit.
     * const debuggerBot = await debug.create({
     *     test: '@tags.message = "hello, world";'
     * });
     *
     * // Send a shout. Just like the create() function above, we recieve a promise that we can await.
     * await debug.shout('test');
     */
    onAfterScriptUpdatedTag(
        listener: (update: DebuggerTagUpdate) => void
    ): void;

    /**
     * Registers the given handler function to be called after any tag mask is updated in the debugger.
     *
     * @param listener the function that should be called when a tag mask is updated.
     *
     * @example Listen for tag mask updates in a debugger
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     *
     * // Register a listener that gets called whenever a tag mask is updated.
     * debug.onAfterScriptUpdatedTagMask(update => {
     *     console.log('tag mask updated', update);
     * });
     *
     * // Because the debugger is pausable, the create() function returns a promise
     * // because it calls @onCreate which could cause a pause trigger to be hit.
     * const debuggerBot = await debug.create({
     *     test: '@masks.message = "hello, world";'
     * });
     *
     * // Send a shout. Just like the create() function above, we recieve a promise that we can await.
     * await debug.shout('test');
     */
    onAfterScriptUpdatedTagMask(
        listener: (update: DebuggerTagMaskUpdate) => void
    ): void;

    /**
     * Performs the given actions in order as if they were user actions.
     *
     * This function works similarly to {@link action.perform} except that actions performed with it will also call handlers registered with {@link debug.onBeforeUserAction}.
     * @param actions the actions that should be performed.
     */
    performUserAction(...actions: BotAction[]): Promise<(any[] | null)[]>;

    // /**
    //  * Produces HTML from the given HTML strings and expressions.
    //  * Best used with a tagged template string.
    //  */
    // html: object;

    /**
     * The web actions that are available in this debugger.
     *
     * @docreferenceactions ^web\.
     * @docsource WebActions
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    web: {};

    /**
     * The OS actions that are available in this debugger.
     *
     * @docreferenceactions ^os\.
     * @docsource OSActions
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    os: {};

    // /**
    //  * Defines a set of functions that relate to common server operations.
    //  * Typically, these operations are instance-independent.
    //  */
    // server: object;

    /**
     * The action-related actions that are available in this debugger.
     *
     * @docreferenceactions ^action\.
     * @docsource ActionActions
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    action: {};

    // /**
    //  * Defines a set of functions that relate to common math operations.
    //  */
    // math: object;

    // /**
    //  * Defines a set of functions that are used to create and transform mods.
    //  */
    // mod: object;

    // /**
    //  * Defines a set of functions that are used to transform byte arrays.
    //  */
    // bytes: object;

    // // @ts-ignore: Ignore redeclaration
    // crypto: Crypto;

    // /**
    //  * Defines a set of experimental functions.
    //  */
    // experiment: object;

    // /**
    //  * Defines a set of performance related functions.
    //  */
    // perf: object;

    // /**
    //  * Defines a set of analytics-related functions.
    //  */
    // analytics: object;
}

/**
 * Defines the possible types that represent a debugger.
 *
 * @dochash types/debuggers
 * @docname Debugger
 */
export type Debugger = NormalDebugger | PausableDebugger;

/**
 * Defines an interface that represents a debugger.
 *
 * @dochash types/debuggers/debugger
 * @doctitle Debugger
 * @docsidebar Debugger
 * @docdescription Defines an interface that represents a debugger.
 * @docname Debugger
 * @docreferenceactions ^\w+$
 */
export interface NormalDebugger extends DebuggerBase {}

/**
 * Defines an interface that represents a pausable debugger.
 *
 * @dochash types/debuggers/pausable-debugger
 * @doctitle Pausable Debugger
 * @docsidebar Pausable Debugger
 * @docdescription Defines an interface that represents a pausable debugger.
 * @docname PausableDebugger
 * @docreferenceactions ^\w+$
 */
export interface PausableDebugger extends DebuggerBase {
    /**
     * Registers the given function to be called whenever the debugger is paused by hitting a pause trigger.
     *
     * @param handler the function that should be called when the debugger is paused.
     *
     * @example Listen for pauses on a debugger
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     *
     * debug.onPause(pause => {
     *     console.log('pause happened!', pause);
     * });
     *
     * @docname onPause
     * @docid debug.onPause
     */
    onPause(handler: (pause: DebuggerPause) => void): void;

    /**
     * Registers or updates a pause trigger with a debugger. Returns the newly created trigger.
     *
     * Pause triggers can be used to tell the debugger where you want it to temporarily stop execution. You specify the bot, tag, line and column numbers, and the debugger will stop before it executes the code at that location.
     * Additionally, the debugger will call all handlers that have been registered with {@link debug.onPause}.
     *
     * @param trigger The trigger that should be registered or updated.
     *
     * @docname setPauseTrigger
     * @docid debug.setPauseTrigger-trigger
     */
    _setPauseTrigger_trigger(trigger: PauseTrigger): PauseTrigger;

    /**
     * Registers or updates a pause trigger with this debugger.
     * Pause triggers can be used to tell the debugger when you want it to stop execution.
     * You specify the bot, tag, line and column numbers and the debugger will stop before/after it executes the code at that location.
     * @param botOrIdOrTrigger the bot, or bot ID that should be registered.
     * @param tag the name of the tag that the trigger should be set on.
     * @param options The options that go with this pause trigger.
     * 
     * @example Set a pause trigger on a script
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     * 
     * const b = await debug.create({
     *     test: '@os.toast("Hello, World!")'
     * });
     * 
     * const trigger = debug.setPauseTrigger(b, 'test', {
     *     lineNumber: 1,
     *     columnNumber: 1
     * });
     * 
     * @example Update a pause trigger on a script
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     * 
     * const b = await debug.create({
     *     test: '@os.toast("Hello, World!")'
     * });
     * 
     * let trigger = debug.setPauseTrigger(b, 'test', {
     *     lineNumber: 1,
     *     columnNumber: 1
     * });
     * 
     * trigger = debug.setPauseTrigger({
     *     ...trigger,
     *     states: ['before', 'after']
     * });

     * @docname setPauseTrigger
     * @docid debug.setPauseTrigger-botOrId
     */
    _setPauseTrigger_botOrId(
        botOrIdOrTrigger: Bot | string,
        tag?: string,
        options?: PauseTriggerOptions
    ): PauseTrigger;

    /**
     * Removes the given pause trigger from the debugger.
     * @param triggerOrId the trigger or trigger ID that should be removed from the debugger.
     *
     * @example Remove a pause trigger
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     *
     * const b = await debug.create({
     *     test: '@os.toast("Hello, World!")'
     * });
     *
     * const trigger = debug.setPauseTrigger(b, 'test', {
     *     lineNumber: 1,
     *     columnNumber: 1
     * });
     *
     * debug.removePauseTrigger(trigger);
     */
    removePauseTrigger(triggerOrId: string | PauseTrigger): void;

    /**
     * Disables the given pause trigger.
     * Disabled pause triggers will continue to be listed with {@link debug.listPauseTriggers}, but will not cause a pause to happen while they are disabled.
     *
     * @param triggerOrId The trigger or trigger ID that should be disabled.
     *
     * @example Disable a pause trigger
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     *
     * const b = await debug.create({
     *     test: '@os.toast("Hello, World!")'
     * });
     *
     * const trigger = debug.setPauseTrigger(b, 'test', {
     *     lineNumber: 1,
     *     columnNumber: 1
     * });
     *
     * debug.disablePauseTrigger(trigger);
     */
    disablePauseTrigger(triggerOrId: string | PauseTrigger): void;

    /**
     * Enables the given pause trigger
     * @param triggerOrId The trigger or trigger ID that should be enabled.
     *
     * @example Enable a pause trigger
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     *
     * const b = await debug.create({
     *     test: '@os.toast("Hello, World!")'
     * });
     *
     * const trigger = debug.setPauseTrigger(b, 'test', {
     *     lineNumber: 1,
     *     columnNumber: 1,
     *     enabled: false
     * });
     *
     * debug.enablePauseTrigger(trigger);
     */
    enablePauseTrigger(triggerOrId: string | PauseTrigger): void;

    /**
     * Gets the list of pause triggers that have been registered with this debugger.
     *
     * @example List the triggers that are set on this debugger
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     *
     * const b = await debug.create({
     *     test: '@os.toast("Hello, World!")'
     * });
     *
     * const trigger = debug.setPauseTrigger(b, 'test', {
     *     lineNumber: 1,
     *     columnNumber: 1,
     *     enabled: false
     * });
     *
     * const triggers = debug.listPauseTriggers();
     *
     * @docname listPauseTriggers
     * @docid debug.listPauseTriggers
     */
    listPauseTriggers(): PauseTrigger[];

    /**
     * Gets a list of common trigger locations for the specified tag on the specified bot. Returns an array containing the list of possible pause trigger locations.
     *
     * @param botOrId the bot or bot ID that the locations should be listed for.
     * @param tag the name of the tag that the locations should be listed for.
     *
     * @example List common trigger locations for a script
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     *
     * const b = await debug.create({
     *     test: '@os.toast("Hello, World!")'
     * });
     *
     * const triggerLocations = debug.listCommonPauseTriggers(b, 'test');
     *
     * @example Register a trigger from a common location
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     *
     * const b = await debug.create({
     *     test: '@os.toast("Hello, World!")'
     * });
     *
     * const triggerLocations = debug.listCommonPauseTriggers(b, 'test');
     *
     * const trigger = debug.setPauseTrigger(b, 'test', {
     *     lineNumber: triggerLocations[0].lineNumber,
     *     columnNumber: triggerLocations[0].columnNumber,
     *     states: triggerLocations[0].possibleStates
     * });
     */
    listCommonPauseTriggers(
        botOrId: Bot | string,
        tag: string
    ): PossiblePauseTriggerLocation[];

    /**
     * Resumes the debugger execution from the given pause.
     * @param pause the debugger pause that was passed to the handler of {@link debug.onPause}.
     *
     * @example Resume execution on a debugger
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     *
     * // Register a listener that gets called whenever a pause happens in this debugger.
     * debug.onPause(pause => {
     *     // Get the current stack frame from the pause
     *     const currentFrame = pause.callStack[pause.callStack.length - 1];
     *
     *     // Set the abc variable to 999
     *     currentFrame.setVariableValue('abc', 999);
     *
     *     // Resume execution after the pause.
     *     debug.resume(pause);
     * });
     *
     * // Because the debugger is pausable, the create() function returns a promise
     * // because it calls @onCreate which could cause a pause trigger to be hit.
     * const debuggerBot = await debug.create({
     *     test: '@let abc = 123; os.toast(abc);'
     * });
     *
     * // Set a pause trigger in the "test" script of the bot we just created
     * // at line 1 column 16
     * const trigger = debug.setPauseTrigger(debuggerBot, 'test', {
     *     lineNumber: 1,
     *     columnNumber: 16
     * });
     *
     * // Send a shout. Just like the create() function above, we recieve a promise that we can await.
     * await debug.shout('test');
     *
     * // Get the resulting actions from the debugger
     * // and perform the first one. This should be the os.toast(), but instead of printing 123,
     * // it should print 999 because we changed the value of abc during the debugger pause.
     * const actions = debug.getCommonActions();
     * action.perform(actions[0]);
     */
    resume(pause: DebuggerPause): void;

    /**
     * Gets the current call stack for the debugger. Call stacks are useful for determining program flow and how scripts interact with each other.
     *
     * @example Get the call stack from a debugger
     * const debug = os.createDebugger({
     *     pausable: true
     * });
     *
     * const callStack = debug.getCallStack();
     */
    getCallStack(): DebuggerCallFrame[];

    /**
     * Creates a new bot and returns it.
     * @param parent The bot that should be the parent of the new bot.
     * @param mods The mods which specify the new bot's tag values. If given a mod with no tags, then an error will be thrown.
     * @returns The bot(s) that were created.
     *
     * @example Create a red bot without a parent.
     * let debugger = await os.createDebugger({
     *     pausable: true
     * });
     * let redBot = await debugger.create(null, { "color": "red" });
     *
     * @example Create a red bot and a blue bot with `this` as the parent.
     * let debugger = await os.createDebugger({
     *     pausable: true
     * });
     * let [redBot, blueBot] = await debugger.create(this, [
     *    { "color": "red" },
     *    { "color": "blue" }
     * ]);
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
     * @example Tell every bot to reset themselves.
     * let debugger = await os.createDebugger({
     *     pausable: true
     * });
     * await debugger.shout("reset()");
     *
     * @example Ask every bot for its name.
     * let debugger = await os.createDebugger({
     *     pausable: true
     * });
     * const names = await debugger.shout("getName()");
     *
     * @example Tell every bot say "Hi" to you.
     * let debugger = await os.createDebugger({
     *     pausable: true
     * });
     * await debugger.shout("sayHi()", "My Name");
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

/**
 * Defines an interface for a possible pause trigger location.
 *
 * @dochash types/debuggers/common
 * @docname PossiblePauseTriggerLocation
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
 * The possible states that a pause trigger can be set to.
 *
 * @dochash types/debuggers/common
 * @docname PossiblePauseTriggerStates
 */
export type PossiblePauseTriggerStates =
    | ['before' | 'after']
    | ['before', 'after'];

/**
 * Defines an interface for a debugger trace that represents when a tag was updated.
 *
 * @dochash types/debuggers/common
 * @docname DebuggerTagUpdate
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
 *
 * @dochash types/debuggers/common
 * @docname DebuggerTagMaskUpdate
 */
export interface DebuggerTagMaskUpdate extends DebuggerTagUpdate {
    /**
     * The space of the tag mask.
     */
    space: string;
}

/**
 * Defines an interface that contains options for attaching a debugger.
 *
 * @dochash types/debuggers/common
 * @doctitle Common
 * @docsidebar Common
 * @docdescription Defines common interfaces related to debuggers.
 * @docname AttachDebuggerOptions
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
    useRealUUIDs?: boolean;

    /**
     * Whether to allow scripts to be asynchronous.
     * If false, then all scripts will be forced to be synchronous.
     * Defaults to true.
     */
    allowAsynchronousScripts?: boolean;

    /**
     * The data that the configBot should be created from.
     * Can be a mod or another bot.
     */
    configBot?: Bot | BotTags;
}

/**
 * Defines an interface that contains options for a normal debugger.
 * That is, a debugger that is not pausable.
 *
 * @dochash types/debuggers/common
 * @docname NormalDebuggerOptions
 */
export interface NormalDebuggerOptions extends CommonDebuggerOptions {
    pausable?: false;
}

/**
 * Defines an interface that contains options for a pausable debugger.
 * That is, a debugger that is pausable.
 *
 * @dochash types/debuggers/common
 * @docname PausableDebuggerOptions
 */
export interface PausableDebuggerOptions extends CommonDebuggerOptions {
    pausable: true;
}

/**
 * Defines an interface that contains options for an aux debugger.
 *
 * @dochash types/debuggers/common
 * @docname DebuggerOptions
 */
export interface AuxDebuggerOptions {
    /**
     * Whether the debugger should be pausable.
     */
    pausable: boolean;

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

/**
 * Defines an interface that contains options for a pause trigger.
 *
 * @dochash types/debuggers/common
 * @docname PauseTriggerOptions
 */
export interface PauseTriggerOptions {
    /**
     * The line number that the trigger starts at.
     */
    lineNumber: number;

    /**
     * The column number that the trigger starts at.
     */
    columnNumber: number;

    /**
     * The states that the trigger should use.
     * Defaults to ["before"] if not specified.
     */
    states?: Breakpoint['states'];

    /**
     * Whether the trigger is enabled.
     * Defaults to true.
     */
    enabled?: boolean;
}

/**
 * Defines an interface that represents a pause trigger.
 *
 * @dochash types/debuggers/common
 * @docname PauseTrigger
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
 * Defines an interface that contains information about the current debugger pause state.
 * @dochash types/debuggers/common
 * @docname DebuggerPause
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
     */
    result?: any;

    /**
     * The call stack that the debugger currently has.
     */
    callStack: DebuggerCallFrame[];
}

/**
 * Defines an interface that contains information about a single call stack frame.
 *
 * @dochash types/debuggers/common
 * @docname DebuggerCallFrame
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
 *
 * @dochash types/debuggers/common
 * @docname DebuggerFunctionLocation
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
 *
 * @dochash types/debuggers/common
 * @docname DebuggerVariable
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
 * Defines an interface for a random number generator.
 *
 * @dochash types/core
 * @docname PseudoRandomNumberGenerator
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
 *
 * @dochash types/web
 * @docname WebhookResult
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
     *
     * @docsource Headers
     */
    headers: {
        [name: string]: string;
    };
}

/**
 * Defines the possible results of a "record file" request.
 *
 * @dochash types/records/files
 * @docgroup 01-create
 * @docorder 1
 * @docname RecordFileResult
 */
export type RecordFileApiResult = RecordFileApiSuccess | RecordFileApiFailure;

/**
 * Defines an interface that represents a successful "record file" request.
 *
 * @dochash types/records/files
 * @docgroup 01-create
 * @docorder 2
 * @docname RecordFileSuccess
 */
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

/**
 * Defines an interface that represents a failed "record file" request.
 *
 * @dochash types/records/files
 * @doctitle File Types
 * @docsidebar Files
 * @docdescription File types are used for uploading and downloading files.
 * @docgroup 01-create
 * @docorder 3
 * @docname RecordFileFailure
 */
export interface RecordFileApiFailure {
    success: false;

    /**
     * The error code that describes why the request failed.
     */
    errorCode:
        | RecordFileFailure['errorCode']
        | 'file_already_exists'
        | 'invalid_file_data';

    /**
     * The error message that describes why the request failed.
     */
    errorMessage: string;

    /**
     * The URL that the file is available at if it has already been uploaded.
     */
    existingFileUrl?: string;
}

/**
 * Defines an interface that contains options for a snap grid for {@link os.addDropGrid}.
 *
 * @dochash types/os/portals
 * @docname SnapGridTarget
 */
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
 * The possible results for a "join room" request.
 *
 * @dochash types/os/portals
 * @docname JoinRoomResult
 */
export type JoinRoomResult = JoinRoomSuccess | JoinRoomFailure;

/**
 * Defines an interface that represents a successful "join room" request.
 *
 * @dochash types/os/portals
 * @docname JoinRoomSuccess
 */
export interface JoinRoomSuccess {
    success: true;
    /**
     * The name of the room that was joined.
     */
    roomName: string;
}

/**
 * Defines an interface that represents a failed "join room" request.
 *
 * @dochash types/os/portals
 * @docname JoinRoomFailure
 */
export interface JoinRoomFailure {
    success: false;

    /**
     * The name of the room that was attempted to be joined.
     */
    roomName: string;

    /**
     * The error code that describes why the request failed.
     */
    errorCode: string;

    /**
     * The error message that describes why the request failed.
     */
    errorMessage: string;
}

/**
 * The possible results for a "leave room" request.
 *
 * @dochash types/os/portals
 * @docname LeaveRoomResult
 */
export type LeaveRoomResult = LeaveRoomSuccess | LeaveRoomFailure;

/**
 * Defines an interface that represents a successful "leave room" request.
 *
 * @dochash types/os/portals
 * @docname LeaveRoomSuccess
 */
export interface LeaveRoomSuccess {
    success: true;

    /**
     * The name of the room that was left.
     */
    roomName: string;
}

/**
 * Defines an interface that represents a failed "leave room" request.
 *
 * @dochash types/os/portals
 * @docname LeaveRoomFailure
 */
export interface LeaveRoomFailure {
    success: false;

    /**
     * The name of the room that was attempted to be left.
     */
    roomName: string;
    /**
     * The error code that describes why the request failed.
     */
    errorCode: string;

    /**
     * The error message that describes why the request failed.
     */
    errorMessage: string;
}

/**
 * The possible results for a "set room options" request.
 *
 * @dochash types/os/portals
 * @docname SetRoomOptionsResult
 */
export type SetRoomOptionsResult =
    | SetRoomOptionsSuccess
    | SetRoomOptionsFailure;

/**
 * Defines an interface that represents a successful "set room options" request.
 *
 * @dochash types/os/portals
 * @docname SetRoomOptionsSuccess
 */
export interface SetRoomOptionsSuccess {
    success: true;
    /**
     * The name of the room that the options were set on.
     */
    roomName: true;
}

/**
 * Defines an interface that represents a failed "set room options" request.
 *
 * @dochash types/os/portals
 * @docname SetRoomOptionsFailure
 */
export interface SetRoomOptionsFailure {
    success: false;

    /**
     * The name of the room that the options were attempted to be set on.
     */
    roomName: string;

    /**
     * The error code that describes why the request failed.
     */
    errorCode: string;

    /**
     * The error message that describes why the request failed.
     */
    errorMessage: string;
}

/**
 * The possible results for a "get room options" request.
 *
 * @dochash types/os/portals
 * @docname GetRoomOptionsResult
 */
export type GetRoomOptionsResult =
    | GetRoomOptionsSuccess
    | GetRoomOptionsFailure;

/**
 * Defines an interface that represents a successful "get room options" request.
 *
 * @dochash types/os/portals
 * @docname GetRoomOptionsSuccess
 */
export interface GetRoomOptionsSuccess {
    success: true;
    /**
     * The name of the room that the options were retrieved from.
     */
    roomName: string;

    /**
     * The options that were retrieved.
     */
    options: RoomOptions;
}

/**
 * Defines an interface that represents a failed "get room options" request.
 *
 * @dochash types/os/portals
 * @docname GetRoomOptionsFailure
 */
export interface GetRoomOptionsFailure {
    success: false;

    /**
     * The error code that describes why the request failed.
     */
    errorCode: string;

    /**
     * The error message that describes why the request failed.
     */
    errorMessage: string;
}

/**
 * The possible results for a "get room track options" request.
 *
 * @dochash types/os/portals
 * @docname GetRoomTrackOptionsResult
 */
export type GetRoomTrackOptionsResult =
    | GetRoomTrackOptionsSuccess
    | GetRoomTrackOptionsFailure;

/**
 * Defines an interface that represents a successful "get room track options" request.
 *
 * @dochash types/os/portals
 * @docname GetRoomTrackOptionsSuccess
 */
export interface GetRoomTrackOptionsSuccess {
    success: true;
    /**
     * The name of the room that the options were retrieved from.
     */
    roomName: string;

    /**
     * The address of the track that the options were retrieved from.
     */
    address: string;

    /**
     * The options that were retrieved.
     */
    options: RoomTrackOptions;
}

/**
 * Defines an interface that represents a failed "get room track options" request.
 *
 * @dochash types/os/portals
 * @docname GetRoomTrackOptionsFailure
 */
export interface GetRoomTrackOptionsFailure {
    success: false;

    /**
     * The error code that describes why the request failed.
     */
    errorCode: string;

    /**
     * The error message that describes why the request failed.
     */
    errorMessage: string;

    /**
     * The name of the room that the options were attempted to be retrieved from.
     */
    roomName: string;

    /**
     * The address of the track that the options were attempted to be retrieved from.
     */
    address: string;
}

/**
 * The possible results for a "set room track options" request.
 *
 * @dochash types/os/portals
 * @docname SetRoomTrackOptionsResult
 */
export type SetRoomTrackOptionsResult =
    | SetRoomTrackOptionsSuccess
    | SetRoomTrackOptionsFailure;

/**
 * Defines an interface that represents a successful "set room track options" request.
 *
 * @dochash types/os/portals
 * @docname SetRoomTrackOptionsSuccess
 */
export interface SetRoomTrackOptionsSuccess {
    success: true;

    /**
     * The name of the room that the options were set on.
     */
    roomName: string;

    /**
     * The address of the track that the options were set on.
     */
    address: string;

    /**
     * The options that were set.
     */
    options: RoomTrackOptions;
}

/**
 * Defines an interface that represents a failed "set room track options" request.
 *
 * @dochash types/os/portals
 * @docname SetRoomTrackOptionsFailure
 */
export interface SetRoomTrackOptionsFailure {
    success: false;

    /**
     * The error code that describes why the request failed.
     */
    errorCode: string;

    /**
     * The error message that describes why the request failed.
     */
    errorMessage: string;

    /**
     * The name of the room that the options were attempted to be set on.
     */
    roomName: string;

    /**
     * The address of the track that the options were attempted to be set on.
     */
    address: string;
}

/**
 * The possible results for a "get room remote options" request.
 *
 * @dochash types/os/portals
 * @docname GetRoomRemoteOptionsResult
 */
export type GetRoomRemoteOptionsResult =
    | GetRoomRemoteOptionsSuccess
    | GetRoomRemoteOptionsFailure;

/**
 * Defines an interface that represents a successful "get room remote options" request.
 *
 * @dochash types/os/portals
 * @docname GetRoomRemoteOptionsSuccess
 */
export interface GetRoomRemoteOptionsSuccess {
    success: true;

    /**
     * The name of the room that the options were retrieved from.
     */
    roomName: string;

    /**
     * The ID of the remote that the options were retrieved from.
     */
    remoteId: string;

    /**
     * The options that were retrieved.
     */
    options: RoomRemoteOptions;
}

/**
 * Defines an interface that represents a failed "get room remote options" request.
 *
 * @dochash types/os/portals
 * @docname GetRoomRemoteOptionsFailure
 */
export interface GetRoomRemoteOptionsFailure {
    success: false;

    /**
     * The error code that describes why the request failed.
     */
    errorCode: string;

    /**
     * The error message that describes why the request failed.
     */
    errorMessage: string;

    /**
     * The name of the room that the options were attempted to be retrieved from.
     */
    roomName: string;

    /**
     * The ID of the remote that the options were attempted to be retrieved from.
     */
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

    /**
     * The marker that should be applied to the file.
     */
    marker?: string;

    /**
     * The markers that should be applied to the file.
     */
    markers?: string[];
}

/**
 * Defines an interface that represents the result of a raycast operation.
 *
 * @dochash types/os/portals
 * @docname RaycastResult
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
 *
 * @dochash types/os/portals
 * @docname BotIntersection
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
 * Defines an interface that represents a ray. That is, a line that has a start position and a direction, but no end.
 *
 * @dochash types/os/portals
 * @docname RaycastRay
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

/**
 * Defines an interface that represents a file that was uploaded.
 *
 * @dochash types/os/files
 * @docname UploadedFile
 */
export interface UploadedFile {
    /**
     * The name of the file that was uploaded.
     */
    name: string;

    /**
     * The size of the file in bytes.
     */
    size: number;

    /**
     * The data that the file contains.
     */
    data: string | ArrayBuffer;
}

const DEAD_RECKONING_OFFSET = 50;

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Defines the result of an API query.
 *
 * @dochash types/records/database
 * @docname QueryResult
 */
export interface ApiQueryResult {
    /**
     * The rows that were returned from the query.
     */
    rows: Record<string, any>[];

    /**
     * The number of rows that were modified by the query.
     */
    affectedRowCount: number;

    /**
     * The ID of the last row that was inserted by the query.
     */
    lastInsertId?: number | string;
}

/**
 * Defines the result of a batch query.
 *
 * @dochash types/records/database
 * @docname BatchResult
 */
export interface BatchResult {
    /**
     * The results of the individual statements.
     */
    results: ApiQueryResult[];
}

/**
 * Represents a connection to a database record.
 *
 * @dochash types/records/database
 * @docname Database
 *
 * @example Get a database connection.
 * const database = os.getDatabase('myRecord', 'myDatabase');
 */
export class ApiDatabase {
    private _recordName: string;
    private _address: string;
    private _options: RecordActionOptions;
    private _context: AuxGlobalContext;

    constructor(
        recordName: string,
        address: string,
        options: RecordActionOptions,
        context: AuxGlobalContext
    ) {
        this._recordName = recordName;
        this._address = address;
        this._options = options;
        this._context = context;
    }

    /**
     * Constructs a database statement from the given [template string literal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals).
     *
     * Once constructed, the returned statement can be used with `run()` or `batch()`.
     *
     * @param templates The string templates.
     * @param params The parameters to interpolate into the templates.
     * @returns A database statement.
     *
     * @example Create a database statement from a SQL query
     * const statement = database.sql`SELECT * FROM items`;
     *
     * @example Use a parameter in a database statement
     * const itemId = 'abc';
     * const statement = database.sql`SELECT * FROM items WHERE id = ${itemId}`;
     */
    sql(
        templates: TemplateStringsArray,
        ...params: unknown[]
    ): DatabaseStatement {
        return q(templates, ...params);
    }

    /**
     * Creates a new database statement from the given SQL and parameters.
     * @param sql The SQL query string.
     * @param params The parameters to include in the query.
     * @returns A new database statement.
     */
    statement(sql: string, ...params: unknown[]): DatabaseStatement {
        return {
            query: sql,
            params,
        };
    }

    /**
     * Runs the given readonly query against the database.
     * This method requires queries to be read-only. This means that queries can only select data, they cannot insert, update, or delete data.
     *
     * Supports [template string literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) for parameterized queries.
     *
     * **Warning:** To avoid [SQL Injection attacks](https://en.wikipedia.org/wiki/SQL_injection), always use template literals with expressions. Never use the `+` operator to concatenate strings containing SQL code.
     *
     * @param templates The string templates.
     * @param params The parameters that should be used.
     * @returns A promise that resolves when the query has completed.
     *
     * @example Select all items from a table
     * const result = await database.query`SELECT * FROM items`;
     *
     * @example Use a parameter in a query
     * const itemId = 'abc';
     * const result = await database.query`SELECT * FROM items WHERE id = ${itemId}`;
     */
    async query(
        templates: TemplateStringsArray,
        ...params: unknown[]
    ): Promise<GenericResult<ApiQueryResult, SimpleError>> {
        return this.run(q(templates, ...params), true);
    }

    /**
     * Runs the given SQL on the database and returns the result.
     * This method supports read-write queries. This means that queries can be used to select, insert, update, and delete data.
     *
     * Supports [template string literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) for parameterized queries.
     *
     * **Warning:** To avoid [SQL Injection attacks](https://en.wikipedia.org/wiki/SQL_injection), always use template literals with expressions. Never use the `+` operator to concatenate strings containing SQL code.
     *
     * @param templates The string templates.
     * @param params The parameters that should be used.
     * @returns A promise that resolves when the SQL has completed.
     *
     * @example Insert a new item into a table
     * const name = "New Item";
     * const value = 100;
     * const result = await database.execute`INSERT INTO items (name, value) VALUES (${name}, ${value})`;
     *
     */
    async execute(
        templates: TemplateStringsArray,
        ...params: unknown[]
    ): Promise<GenericResult<ApiQueryResult, SimpleError>> {
        return this.run(q(templates, ...params), false);
    }

    /**
     * Runs the given statements in a single transaction. Transactions can be used to group multiple statements together.
     * If one statement fails, then none of the statements will have any effect.
     *
     * @param func The function that should be used to build the statements.
     * @param readonly Whether the statements are read-only. If true, then the statements cannot modify data.
     *
     * @example Run multiple select queries at once
     * const results = await database.batch([
     *      database.sql`SELECT * FROM items WHERE id = 'abc'`,
     *      database.sql`SELECT * FROM items WHERE id = 'def'`,
     *      database.sql`SELECT * FROM items WHERE id = 'ghi'`,
     * ]);
     *
     * @example Insert multiple items at once
     * const results = await database.batch([
     *      database.sql`INSERT INTO items (name, value) VALUES ('Item 1', 100)`,
     *      database.sql`INSERT INTO items (name, value) VALUES ('Item 2', 200)`,
     *      database.sql`INSERT INTO items (name, value) VALUES ('Item 3', 300)`,
     * ], false);
     */
    async batch(
        statements: DatabaseStatement[],
        readonly: boolean = true
    ): Promise<GenericResult<BatchResult, SimpleError>> {
        const result = await this._run(statements, readonly);
        if (result.success === false) {
            return result;
        } else {
            return {
                success: true,
                results: result.items.map((r) => this._mapResult(r)),
            };
        }
    }

    /**
     * Runs the given database statement.
     *
     * @param statement The statement to run.
     * @param readonly Whether the statement is read-only. If true, then the statement cannot modify data.
     */
    async run(
        statement: DatabaseStatement,
        readonly: boolean = true
    ): Promise<GenericResult<ApiQueryResult, SimpleError>> {
        const batch = await this.batch([statement], readonly);
        if (batch.success === false) {
            return batch;
        } else {
            const firstResult = batch.results[0];
            return {
                success: true,
                ...firstResult,
            };
        }
    }

    /**
     * Gets an interface to the database that returns unmodified query results.
     */
    get raw() {
        return {
            sql: this.sql.bind(this),
            query: (templates: TemplateStringsArray, ...params: unknown[]) => {
                return this._run([q(templates, ...params)], true);
            },
            execute: (
                templates: TemplateStringsArray,
                ...params: unknown[]
            ) => {
                return this._run([q(templates, ...params)], false);
            },
            batch: (
                statements: DatabaseStatement[],
                readonly: boolean = true
            ) => {
                return this._run(statements, readonly);
            },
            run: (statement: DatabaseStatement, readonly: boolean = true) => {
                return this._run([statement], readonly);
            },
        };
    }

    private _mapResult(result: QueryResult): ApiQueryResult {
        const rows: ApiQueryResult['rows'] = [];
        for (let row of result.rows) {
            const value: Record<string, any> = {};
            for (let i = 0; i < result.columns.length; i++) {
                value[result.columns[i]] = row[i];
            }
            rows.push(value);
        }
        return {
            rows,
            lastInsertId: result.lastInsertId,
            affectedRowCount: result.affectedRowCount,
        };
    }

    private _run(
        statements: DatabaseStatement[],
        readonly: boolean
    ): Promise<GenericResult<QueryResult[], SimpleError>> {
        const task = this._context.createTask();
        const action = recordsCallProcedure(
            {
                queryDatabase: {
                    input: {
                        recordName: this._recordName,
                        address: this._address,
                        statements,
                        readonly,
                    },
                },
            },
            this._options,
            task.taskId
        );
        this._context.enqueueAction(action);
        let promise = task.promise;
        (<any>promise)[ORIGINAL_OBJECT] = action;
        return promise;
    }
}

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
    } = ((name: string, arg?: any) => unwind(shout(name, arg))) as any;

    const shoutProxy = new Proxy(shoutImpl, {
        get(target, name: string, reciever) {
            if (
                typeof name === 'symbol' ||
                (typeof target === 'function' && name in Function.prototype)
            ) {
                return Reflect.get(target, name, reciever);
            }
            return (arg?: any) => {
                return unwind(shout(name, arg));
            };
        },
    });

    const interpretableShoutImpl: {
        (name: string, arg?: any): Generator<any, any[], any>;
        [name: string]: (arg?: any) => Generator<any, any[], any>;
    } = shout as any;
    const interpretableShoutProxy = new Proxy(interpretableShoutImpl, {
        get(target, name: string, reciever) {
            if (
                typeof name === 'symbol' ||
                (typeof target === 'function' && name in Function.prototype)
            ) {
                return Reflect.get(target, name, reciever);
            }
            return (arg?: any) => {
                return shout(name, arg);
            };
        },
    });

    return {
        api: {
            _getBots,
            __getBots,
            getBots,
            _getBot,
            __getBot,
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

            _create,
            _destroy,
            destroy: createInterpretableFunction(destroy),

            _changeState,
            changeState: createInterpretableFunction(changeState),
            getLink: createBotLinkApi,
            getBotLinks,

            _updateBotLinks,
            updateBotLinks,

            getDateTime,

            DateTime,

            /**
             * @hidden
             */
            Vector2,

            /**
             * @hidden
             */
            Vector3,

            /**
             * @hidden
             */
            Quaternion,

            /**
             * @hidden
             */
            Rotation,

            superShout,

            _priorityShout,
            priorityShout: createInterpretableFunction(priorityShout),

            _shout,
            shout: tagAsInterpretableFunction(
                interpretableShoutProxy,
                shoutProxy
            ),

            _whisper,
            whisper: createInterpretableFunction(whisper),

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

            _animateTag,
            __animateTag,
            animateTag,
            clearAnimations,

            // TODO: Remove deprecated functions
            webhook: <WebhookInterface>(<any>webhookFunc),

            /**
             * @hidden
             */
            sleep,

            /**
             * @hidden
             */
            __energyCheck,

            clearTimeout,
            clearInterval,
            clearWatchBot,
            clearWatchPortal,
            assert,
            assertEqual,
            expect,

            html,

            /**
             * Gets the config bot (formerly known as the player bot).
             * This is the bot that represents the player's browser tab.
             *
             * It is `tempLocal` and is used to configure various portals.
             *
             * @example Get the config bot and set a username on it.
             * configBot.tags.username = "bob";
             *
             * @example Open the sheetPortal to "testDimension".
             * configBot.tags.sheetPortal = "testDimension";
             *
             * @dochash actions/os/system
             * @doctitle System Actions
             * @docsidebar System
             * @docdescription System actions are used to get information about the current session.
             * @docname configBot
             * @docgroup 01-os
             */
            get _configBot(): RuntimeBot {
                return null;
            },

            ai: {
                chat,
                listChatModels,
                generateSkybox,
                generateImage,
                hume: {
                    getAccessToken: getHumeAccessToken,
                },

                sloyd: {
                    generateModel: generateSloydModel,
                },

                stream: {
                    chat: chatStream,
                },

                openai: {
                    createRealtimeSession: createOpenAIRealtimeSession,
                },
            },

            os: {
                [UNCOPIABLE]: true,

                addBotListener,
                removeBotListener,

                sleep,
                toast,
                getScriptIssues,
                tip,
                hideTips,
                showJoinCode,
                requestFullscreenMode,
                exitFullscreenMode,

                hideLoadingScreen,

                showHtml,
                hideHtml,
                setClipboard,
                tweenTo,
                moveTo,
                _focusOn_bot,
                _focusOn_position,
                focusOn,
                _showChat_placeholder,
                _showChat_options,
                showChat,
                hideChat,
                run,
                version,
                device,
                isCollaborative,
                enableCollaboration,
                showAccountInfo,
                getAB1BootstrapURL,
                enableAR,
                disableAR,
                enableVR,
                disableVR,
                arSupported,
                vrSupported,
                enablePointOfView,
                disablePointOfView,
                requestWakeLock,
                disableWakeLock,
                getWakeLockConfiguration,
                download: downloadData,
                downloadBots,
                downloadBotsAsInitialzationUpdate,

                getAuxFileForBots,
                installAuxFile,

                downloadServer,
                downloadInst: downloadServer,

                showUploadAuxFile,
                showUploadFiles,
                openQRCodeScanner,
                closeQRCodeScanner,
                showQRCode,
                hideQRCode,
                generateQRCode,
                openBarcodeScanner,
                closeBarcodeScanner,
                showBarcode,
                hideBarcode,

                openImageClassifier,
                closeImageClassifier,
                classifyImages,

                openPhotoCamera,
                capturePhoto,
                closePhotoCamera,

                capturePortalScreenshot,

                /**
                 * Gets the device-local time as the number of miliseconds since midnight January 1st, 1970 UTC-0 (i.e. the Unix Epoch). This is what your device's clock thinks the current time is.
                 *
                 * @example Toast the number of miliseconds since the Unix Epoch
                 * os.toast(os.localTime);
                 *
                 * @dochash actions/os/time
                 * @doctitle Time Actions
                 * @docsidebar Time
                 * @docdescription Time actions make working with time across devices easy.
                 * @docgroup 01-time
                 * @docname os.localTime
                 */
                get localTime() {
                    return Date.now();
                },

                /**
                 * Gets the shared time that has been agreed upon between devices in the inst as the number of miliseconds since midnight January 1st, 1970 UTC-0 (i.e. the Unix Epoch).
                 * This is what your device's clock thinks the inst clock says.
                 *
                 * If an agreed upon time cannot be determined (for example, because collaboration is disabled in the inst), then this value will always be `NaN`.
                 *
                 * @example Toast the current shared time
                 * os.toast(os.agreedUponTime);
                 *
                 * @dochash actions/os/time
                 * @docgroup 01-time
                 * @docname os.agreedUponTime
                 */
                get agreedUponTime() {
                    return Date.now() + context.instTimeOffset;
                },

                /**
                 * Gets the average latency between this device's clock and the inst clock in miliseconds. Lower values tend to indicate a good connection while higher values tend to indicate a bad connection.
                 *
                 * If an agreed upon time cannot be determined (for example, because collaboration is disabled in the inst), then this value will always be `NaN`.
                 *
                 * @dochash actions/os/time
                 * @docgroup 01-time
                 * @docname os.instLatency
                 */
                get instLatency() {
                    return context.instLatency;
                },

                /**
                 * Gets the calculated time offset between the inst clock and the local clock. This value is equivalent to `os.agreedUponTime - os.localTime`.
                 *
                 * If an agreed upon time cannot be determined (for example, because collaboration is disabled in the inst), then this value will always be `NaN`.
                 *
                 * @dochash actions/os/time
                 * @docgroup 01-time
                 * @docname os.instTimeOffset
                 */
                get instTimeOffset() {
                    return context.instTimeOffset;
                },

                /**
                 * Gets the spread between calculated time offsets. Higher values indicate that {@link os.agreedUponTime} is less accurate. Lower values indicate that {@link os.agreedUponTime} is more accurate.
                 *
                 * If an agreed upon time cannot be determined (for example, because collaboration is disabled in the inst), then this value will always be `NaN`.
                 *
                 * @dochash actions/os/time
                 * @docgroup 01-time
                 * @docname os.instTimeOffsetSpread
                 */
                get instTimeOffsetSpread() {
                    return context.instTimeOffsetSpread;
                },

                /**
                 * Gets the shared time that has been agreed upon between devices but with an additional 50ms offset added.
                 * This offset attempts to ensure that changes/events will be recieved by all connected devices by the time it occurs, thereby making synchronized actions easier to perform.
                 *
                 * If an agreed upon time cannot be determined (for example, because collaboration is disabled in the inst), then this value will always be `NaN`.
                 *
                 * @dochash actions/os/time
                 * @docgroup 01-time
                 * @docname os.deadReckoningTime
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
                getCurrentInstRecord,
                getMenuDimension,
                getMiniPortalDimension,
                getPortalDimension,
                getDimensionalDepth,
                showInputForTag,
                _showInput: showInput,
                showInput: makeMockableFunction(showInput, 'os.showInput'),
                showConfirm,
                showAlert,
                goToDimension,
                goToURL,
                openURL,
                syncConfigBotTagsToURL,
                openDevConsole,
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
                appHooks: { ...hooks, render, createRef, createContext },
                appCompat: { ...compat },
                listBuiltinTags,
                reportInst,
                requestAuthBot,
                requestAuthBotInBackground,
                signOut,

                createRecord,
                getPublicRecordKey,
                getSubjectlessPublicRecordKey,
                grantPermission,
                revokePermission,
                listPermissions,
                grantInstAdminPermission,
                grantUserRole,
                revokeUserRole,
                grantInstRole,
                revokeInstRole,
                isRecordKey,
                recordData,
                recordManualApprovalData,
                getData,
                getManualApprovalData,
                listData,
                listDataByMarker,
                eraseData,
                eraseManualApprovalData,

                listInsts,
                listInstsByMarker,
                eraseInst,

                recordWebhook,
                runWebhook,
                getWebhook,
                eraseWebhook,
                listWebhooks,
                listWebhooksByMarker,

                recordNotification,
                getNotification,
                eraseNotification,
                listNotifications,
                listNotificationsByMarker,
                subscribeToNotification,
                unsubscribeFromNotification,
                sendNotification,
                listNotificationSubscriptions,
                listUserNotificationSubscriptions,

                recordFile,
                getFile,
                getPublicFile,
                getPrivateFile,
                eraseFile,

                recordEvent,
                countEvents,

                parseVersionKey,
                formatVersionKey,

                grantEntitlements,
                recordPackageVersion,
                erasePackageVersion,
                listPackageVersions,
                getPackageVersion,

                recordPackageContainer,
                erasePackageContainer,
                listPackageContainers,
                listPackageContainersByMarker,
                getPackageContainer,
                installPackage,
                listInstalledPackages,

                recordSearchCollection,
                getSearchCollection,
                eraseSearchCollection,
                listSearchCollections,
                listSearchCollectionsByMarker,
                recordSearchDocument,
                eraseSearchDocument,

                recordDatabase,
                getDatabase,
                eraseDatabase,
                listDatabases,
                listDatabasesByMarker,

                listUserStudios,
                listStudioRecords,

                getRecordsEndpoint,

                recordStoreItem,
                getStoreItem,
                eraseStoreItem,
                listStoreItems,
                listStoreItemsByMarker,
                purchaseStoreItem,

                convertGeolocationToWhat3Words,

                raycastFromCamera,
                raycast,
                calculateRayFromCamera,
                calculateViewportCoordinatesFromPosition,
                calculateScreenCoordinatesFromViewportCoordinates,
                calculateScreenCoordinatesFromPosition,
                calculateViewportCoordinatesFromScreenCoordinates,
                bufferFormAddressGLTF,
                startFormAnimation,
                stopFormAnimation,
                listFormAnimations,
                ldrawCountAddressBuildSteps,
                ldrawCountTextBuildSteps,
                attachDebugger,
                detachDebugger,

                addMapLayer,
                removeMapLayer,
                addBotMapLayer,
                removeBotMapLayer,

                remotes,
                listInstUpdates,
                getInstStateFromUpdates,
                createInitializationUpdate,
                applyUpdatesToInst,
                getCurrentInstUpdate,
                mergeInstUpdates,
                remoteCount: serverRemoteCount,
                totalRemoteCount: totalRemoteCount,

                getSharedDocument,
                getLocalDocument,
                getMemoryDocument,

                beginAudioRecording,
                endAudioRecording,

                meetCommand,
                meetFunction,

                get vars() {
                    return context.global;
                },

                _createDebugger_normal,
                _createDebugger_pausable,
                _getExecutingDebugger,
                _attachDebugger,
                _detachDebugger,
            },

            xp: {
                recordContract: xpRecordContract,
                getContract: xpGetContract,
                listContracts: xpListContracts,
                getContractPricing: xpGetContractPricing,
                purchaseContract: xpPurchaseContract,
                cancelContract: xpCancelContract,
                invoiceContract: xpInvoiceContract,
                cancelInvoice: xpCancelInvoice,
                listInvoices: xpListInvoices,
                payInvoice: xpPayInvoice,
                payout: xpPayout,
                getAccountBalances: xpGetAccountBalances,
            },

            portal: {
                registerPrefix,
            },

            server: {
                shell,
                serverRemoteCount,
                totalRemoteCount,
                remotes,

                players: remotes,
                serverPlayerCount: serverRemoteCount,
                totalPlayerCount: totalRemoteCount,
            },

            action: {
                perform,
                reject,
            },

            experiment: {
                localFormAnimation,
                localPositionTween,
                localRotationTween,
                getAnchorPointPosition,
                createStaticHtmlFromBots,
                beginAudioRecording,
                endAudioRecording,
                beginRecording,
                endRecording,
                speakText,
                getVoices,
            },

            loom: {
                recordVideo: loomRecordVideo,
                watchVideo: loomWatchVideo,
                getVideoEmbedMetadata: loomGetVideoEmbedMetadata,
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
                toBase64Url,
                fromBase64Url,
            },

            crypto: {
                _hash_raw,
                _hash_string,

                hash,
                sha256,
                sha512,

                _hmac_string,
                _hmac_raw,
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
            },

            perf: {
                getStats,
            },

            web: {
                _webGet,
                _webPost,
                _webHook,
                get: makeMockableFunction(webGet, 'web.get'),
                post: makeMockableFunction(webPost, 'web.post'),
                hook: makeMockableFunction(webhook, 'web.hook'),
            },

            analytics: {
                recordEvent: analyticsRecordEvent,
            },
        },

        tagSpecificApi: {
            create: tagAsInterpretableFunction(
                (options: TagSpecificApiOptions) =>
                    (...args: any[]) =>
                        create(options.bot?.id, ...args),
                (options: TagSpecificApiOptions) =>
                    (...args: any[]) =>
                        unwind(create(options.bot?.id, ...args))
            ),
            setTimeout: botTimer('timeout', setTimeout, true),
            setInterval: botTimer('interval', setInterval, false),
            watchPortal: watchPortalBots(),
            watchBot: watchBot(),
        },
    };

    function botTimer(
        type: TimeoutOrIntervalTimer['type'],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        func: (handler: Function, timeout: number, ...args: any[]) => number,
        clearAfterHandlerIsRun: boolean
    ) {
        return (options: TagSpecificApiOptions) =>
            function (
                handler: (
                    ...args: any[]
                ) => void | Generator<
                    InterpreterStop,
                    any,
                    InterpreterContinuation
                >,
                timeout?: number,
                ...args: any[]
            ) {
                if (!options.bot) {
                    throw new Error(
                        `Timers are not supported when there is no current bot.`
                    );
                }

                if (typeof handler !== 'function') {
                    throw new Error('A handler function must be provided.');
                }

                let timer: number;
                if (clearAfterHandlerIsRun) {
                    timer = func(
                        function () {
                            let result: ReturnType<typeof handler>;
                            try {
                                // eslint-disable-next-line prefer-rest-params
                                result = handler(...arguments);
                            } finally {
                                context.removeBotTimer(
                                    options.bot.id,
                                    type,
                                    timer
                                );
                            }

                            context.processBotTimerResult(result);
                        },
                        timeout,
                        ...args
                    );
                } else {
                    timer = func(
                        function () {
                            context.processBotTimerResult(
                                // eslint-disable-next-line prefer-rest-params
                                handler(...arguments)
                            );
                        },
                        timeout,
                        ...args
                    );
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
            function (
                portalId: string,
                handler: () => void | Generator<
                    InterpreterStop,
                    any,
                    InterpreterContinuation
                >
            ) {
                let id = timerId++;
                const finalHandler = () => {
                    try {
                        let result = handler();
                        return wrapGenerator(result);
                    } catch (err) {
                        context.enqueueError(err);
                    }
                };

                context.recordBotTimer(options.bot.id, {
                    type: 'watch_portal',
                    timerId: id,
                    portalId,
                    tag: options.tag,
                    handler: finalHandler,
                });

                return id;
            };
    }

    function watchBot() {
        let timerId = 0;
        return (options: TagSpecificApiOptions) =>
            function (
                bot: (Bot | string)[] | Bot | string,
                handler: () => void | Generator<
                    InterpreterStop,
                    any,
                    InterpreterContinuation
                >
            ) {
                let id = timerId++;
                let botIds = Array.isArray(bot)
                    ? bot.map((b) => getID(b))
                    : [getID(bot)];
                const finalHandler = () => {
                    try {
                        let result = handler();
                        return wrapGenerator(result);
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

    function wrapGenerator(
        result: Generator<InterpreterStop, any, InterpreterContinuation> | void
    ) {
        if (isGenerator(result)) {
            const gen = result;
            let valid = true;
            const generatorWrapper: Generator<
                InterpreterStop,
                any,
                InterpreterContinuation
            > = {
                [Symbol.iterator]: () => generatorWrapper,
                [Symbol.dispose]: () => {},
                next(value) {
                    if (!valid) {
                        return {
                            done: true,
                            value: undefined,
                        };
                    }
                    try {
                        return gen.next(value);
                    } catch (err) {
                        valid = false;
                        context.enqueueError(err);
                        return {
                            done: true,
                            value: undefined,
                        };
                    }
                },
                return(value) {
                    if (!valid) {
                        return {
                            done: true,
                            value: undefined,
                        };
                    }
                    try {
                        return gen.return(value);
                    } catch (err) {
                        valid = false;
                        context.enqueueError(err);
                        return {
                            done: true,
                            value: undefined,
                        };
                    }
                },
                throw(e) {
                    if (!valid) {
                        return {
                            done: true,
                            value: undefined,
                        };
                    }
                    try {
                        return gen.throw(e);
                    } catch (err) {
                        valid = false;
                        context.enqueueError(err);
                        return {
                            done: true,
                            value: undefined,
                        };
                    }
                },
            };

            return generatorWrapper;
        } else {
            return result;
        }
    }

    function clearWatchBot(id: number) {
        context.cancelAndRemoveTimers(id, 'watch_bot');
    }

    function clearWatchPortal(id: number) {
        context.cancelAndRemoveTimers(id, 'watch_portal');
    }

    /**
     * Verifies that the given condition is true.
     * If it is not, then an error is thrown with the given message.
     * This function is useful for automated testing since tests should ideally throw an error if the test fails.
     * It can also be useful to make sure that some important code is only run if a precondition is met.
     *
     * @param condition the condition that should be verified.
     * @param message the message that should be included in the error.
     *
     * @example Assert that the tag color is "blue"
     * assert(tags.color === "blue", "The tag color is not blue!");
     *
     * @dochash actions/debuggers
     * @docname assert
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
     * Verifies that the given values are equal to each other.
     * If they are not, then an error is thrown.
     * This function is useful for automated testing since tests should ideally throw an error if the test fails.
     * It can also be useful to make sure that some important code is only run if a precondition is met.
     *
     * @param first The first value to test.
     * @param second The second value to test.
     *
     * @example Assert that the tag color is "blue"
     * assertEqual(tags.color, "blue");
     *
     * @example Assert that the bot contains some specific tag values
     * assertEqual(tags, {
     *     color: "blue",
     *     home: true,
     *     homeX: 0,
     *     homeY: 0
     * });
     *
     * @dochash actions/debuggers
     * @docname assertEqual
     */
    function assertEqual(first: any, second: any) {
        expect(first).toEqual(second);
    }

    /**
     * Gets an array of bots that match the given tag and value. The returned array is sorted alphabetically by the {@tag id} tag.
     *
     * @param tag the name of the tag. Bots that have this tag will be included as long as they also match the second parameter.
     * @param value the value the tag should match. If not specified, then all bots with the tag will be included. If specified, then only bots that have the same tag and value will be included. If you specify a function as the value, then it will be used to match tag values.
     *
     * @example Find all the bots with #name set to "bob"
     * let bots = getBots("#name", "bob");
     *
     * @example Find all bots with a #height larger than 2
     * let bots = getBots("#height", height => height > 2);
     *
     * @example Find all bots with the #test tag
     * let bots = getBots("#test");
     *
     * @dochash actions/data
     * @doctitle Data Actions
     * @docsidebar Data
     * @docdescription The Data Actions are used to get and set data on bots.
     * @docgroup 01-data-actions
     * @docgrouptitle Data Actions
     * @docname getBots
     * @docid getbots-tag
     */
    function __getBots(tag: string, value?: any): RuntimeBot[] {
        return null;
    }

    /**
     * Gets an array of bots that match all of the given filter(s). The returned array is sorted alphabetically by the {@tag id} tag.
     *
     * @param filters If no filters are specified, then all bots in the inst are returned. If multiple filters are specified, then only the bots that match all of the filters are returned.
     *
     * @example Gets all the bots in the inst.
     * let bots = getBots();
     *
     * @example Find all bots with the "test" tag
     * let bots = getBots(byTag("#test"));
     *
     * @example Find all bots with #name set to "bob" and in the #people dimension
     * let bots = getBots(byTag("#name", "bob"), inDimension("people"));
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname getBots
     * @docid getbots-filters
     */
    function _getBots(...filters: BotFilter[]): RuntimeBot[] {
        return null;
    }

    /**
     * @hidden
     */
    function getBots(...filters: any[]): RuntimeBot[] {
        if (filters.length > 0 && typeof filters[0] === 'function') {
            const filtered = context.bots.filter((b) =>
                filters.every((f) => f(b))
            );

            const sortFuncs = filters
                .filter((f) => typeof f.sort === 'function')
                .map((f) => f.sort);
            const sorted =
                sortFuncs.length > 0
                    ? sortBy(filtered, ...sortFuncs)
                    : filtered;

            return sorted;
        }

        let tag: string = filters[0];
        if (typeof tag === 'undefined') {
            return context.bots.slice();
        } else if (!tag) {
            return [];
        }
        tag = trimTag(tag);
        const filter = filters[1];

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
     * Get the first bot that matches all of the given filter(s).
     * If multiple bots match the given filter(s), then bots are sorted alphabetically by the [#id](tags:id) tag and the first one is returned.
     * If no bots match the given filter(s), then `undefined` is returned.
     *
     * @param filters If no filters are specified, then all bots in the inst are returned. If multiple filters are specified, then only the bots that match all of the filters are returned.
     *
     * @example Find a bot with the #test tag
     * let foundBot = getBot(byTag("#test"));
     *
     * @example Find a bot with #name set to "bob" and in the #people dimension
     * let foundBot = getBot(byTag("#name", "bob"), inDimension("people"));
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docid getbot-filters
     * @docname getBot
     */
    function _getBot(...filters: BotFilter[]): RuntimeBot {
        return null;
    }

    /**
     * Gets the first bot that matches the given tag and value.
     * If multiple bots match the given tag and value, then bots are sorted alphabetically by the [#id](tags:id) tag and the first one is returned.
     * If no bots match the given tag and value, then `undefined` is returned.
     * @param tag the name of the tag to search for.
     * @param value the value the tag should match. If not specified, then the first bot with the tag will be returned. If specified, then the first bot that has the same tag and value will be returned. If you specify a function as the value, then it will be used to match tag values.
     *
     * @example Find the first bot with #name set to "bob"
     * let foundBot = getBot("#name", "bob");
     *
     * @example Find the first bot with a #height larger than 2
     * let foundBot = getBot("#height", height => height > 2);
     *
     * @example Find the first bot with the #test tag
     * let foundBot = getBot("#test");
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docid getbot-tag
     * @docname getBot
     */
    function __getBot(tag: string, value?: any): RuntimeBot {
        return null;
    }

    function getBot(...args: any[]): RuntimeBot {
        const bots = getBots(...args);
        return bots.first();
    }

    /**
     * Gets a list of all the values in the inst for the given tag. Optionally accepts a filter for the tag values.
     *
     * @param tag the name of the tag to search for.
     * @param filter the filter that the tag values should match. If not specified, then all the tag values are included. If it is a function, then it will be used to match values. Otherwise, only tags that match the value will be included.
     *
     * @example Find the number of bots named bob and print it
     * const numberOfBobs = getBotTagValues("#name", "bob").length;
     * os.toast(numberOfBobs);
     *
     * @example Find all the bot ages above 10
     * const agesOver10 = getBotTagValues("#age", age => age > 10);
     *
     * @dochash actions/data
     * @docname getBotTagValues
     * @docgroup 01-data-actions
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
     *
     * @dochash actions/mods
     * @docgroup 01-mod-actions
     * @docname getMod
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
            tagsObj = bot[ORIGINAL_OBJECT] as BotTags;
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
     * Gets the 3D position of the given bot in the given dimension.
     * @param bot the bot or bot ID whose position should be retrieved.
     * @param dimension the dimension that the position should be retrieved for.
     *
     * @example Get the position of this bot in the #home dimension
     * let position = getBotPosition(thisBot, "home");
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname getBotPosition
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
     * Gets the 3D rotation of the given bot in the given dimension.
     * @param bot the bot or bot ID whose rotation should be retrieved.
     * @param dimension the dimension that the rotation should be retrieved for.
     *
     * @example Get the rotation of this bot in the #home dimension
     * let rotation = getBotRotation(thisBot, "home");
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname getBotRotation
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
     * Creates a bot filter that includes bots that have the given tag that matches the given value.
     *
     * @param tag the name of the tag. Bots that have this tag will be included as long as they also match the second parameter.
     * @param filter the value that the tag should match. If not specified, then all bots with the tag will be included. If specified, then only bots that have the same tag value will be included. If you specify a function as the value, then it will be used to match tag values.
     *
     * @example Find all the bots with #name set to "bob".
     * let bots = getBots(byTag("#name", "bob"));
     *
     * @example Find all bots with a height larger than 2.
     * let bots = getBots(byTag("#height", height => height > 2));
     *
     * @example Find all bots with the "test" tag.
     * let bots = getBots(byTag("#test"));
     *
     * @dochash actions/bot-filters
     * @doctitle Bot Filters
     * @docsidebar Bot Filters
     * @docdescription Bot Filters are functions that are useful for filtering bots.
     * @docgroup 01-filters
     * @docname byTag
     */
    function byTag(tag: string, filter?: TagFilter): BotFilter {
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
     * Creates a bot filter that includes the bot with the given ID.
     * @param id the ID of the bot.
     *
     * @example Find the bot with the ID '123'
     * let bot = getBot(byID("123"));
     *
     * @dochash actions/bot-filters
     * @docgroup 01-filters
     * @docname byID
     */
    function byID(id: string): BotFilter {
        let filter: any = ((bot: Bot) => {
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
     * Creates a bot filter that includes bots that match the given mod.
     *
     * @param mod the bot or mod that the other bots should match.
     *
     * @example Find all the bots with #height set to 1 and #color set to red.
     * const bots = getBots(byMod({
     *     height: 1,
     *     color: "red"
     * }));
     *
     * @dochash actions/bot-filters
     * @docgroup 01-filters
     * @docname byMod
     */
    function byMod(mod: Mod): BotFilter {
        let tags = isBot(mod) ? mod.tags : mod;
        let filters = Object.keys(tags).map((k) => byTag(k, tags[k]));
        return (bot) => filters.every((f) => f(bot));
    }

    /**
     * Creates a bot filter that includes bots that are in the given dimension. That is, they have the given tag set to true.
     *
     * > This function behaves exactly like {@link byTag} with the `value` parameter set to `true`.
     *
     * @param dimension the name of the dimension.
     * @returns A function that returns true if the given bot is in the dimension and false if it is not.
     *
     * @example Find all the bots in the "test" dimension.
     * let bots = getBots(inDimension("test"));
     *
     * @dochash actions/bot-filters
     * @docgroup 01-filters
     * @docname inDimension
     */
    function inDimension(dimension: string): BotFilter {
        return byTag(dimension, true);
    }

    /**
     * Creates a bot filter that includes bots that are in the given dimension and at the given X and Y position.
     *
     * When this filter is used with {@link getbots-filters}, the returned bots are sorted in the same order that they are stacked. This means that the first bot in the array is at the bottom of the stack and the last bot is at the top of the stack (assuming they're stackable).
     *
     * @param dimension the name of the dimension.
     * @param x the X position. That is, the left-right position of the bots in the dimension.
     * @param y the Y position. That is, the forward-backward position of the bots in the dimension.
     *
     * @example Find all the bots at (1, 2) in the "test" dimension.
     * let bots = getBots(atPosition("test", 1, 2));
     *
     * @dochash actions/bot-filters
     * @docgroup 01-filters
     * @docname atPosition
     */
    function atPosition(dimension: string, x: number, y: number): BotFilter {
        const inCtx = inDimension(dimension);
        const atX = byTag(`${dimension}X`, (bx) => areClose(bx, x));
        const atY = byTag(`${dimension}Y`, (by) => areClose(by, y));
        const filter: BotFilterFunction = (b) => inCtx(b) && atX(b) && atY(b);
        filter.sort = (b) => getTag(b, `${dimension}SortOrder`) || 0;
        return filter;
    }

    /**
     * Creates a bot filter that includes bots in the same stack as the given bot. The given bot will always be included by this filter as long the given bot is in the given dimension.
     *
     * When this filter is used with {@link getbots-filters}, the returned bots are sorted in the same order that they are stacked. This means that the first bot in the array is at the bottom of the stack and the last bot is at the top of the stack (assuming they're stackable).
     *
     * @param bot the bot that other bots should be in the same stack with.
     * @param dimension the name of the dimension.
     *
     * @example Find all bots in the same stack as thisBot in the "test" dimension.
     * let bots = getBots(inStack(this, "test"));
     *
     * @dochash actions/bot-filters
     * @docgroup 01-filters
     * @docname inStack
     */
    function inStack(bot: Bot, dimension: string): BotFilter {
        return atPosition(
            dimension,
            getTag(bot, `${dimension}X`),
            getTag(bot, `${dimension}Y`)
        );
    }

    /**
     * Creates a bot filter that includes bots which are neighboring the given bot. Optionally takes a direction that the neighboring bots must be in.
     *
     * @param bot the bot that the other bots need to be neighboring.
     * @param dimension the dimension that the other bots need to be in.
     * @param direction the neighboring direction to check. If not specified, then all of the supported directions will be checked. Currently, the supported directions are front, right, back, and left. If an unsupported direction is specified, then no bots will be included.
     *
     * @example Find all bots in front of this bot in the test dimension.
     * const bots = getBots(neighboring(this, "test", "front"));
     *
     * @example Find all bots around this bot in the test dimension.
     * const bots = getBots(neighboring(this, "test"));
     *
     * @dochash actions/bot-filters
     * @docgroup 01-filters
     * @docname neighboring
     */
    function neighboring(
        bot: Bot,
        dimension: string,
        direction?: 'front' | 'left' | 'right' | 'back'
    ): BotFilter {
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
     * Creates a bot filter that includes bots in the given space. That is, they have {@tag space} set to the given value.
     *
     * > This function behaves exactly like `byTag("space", getID(bot))`.
     *
     * @param space the space that the bots are in.
     *
     * @example Find all bots in the tempLocal space.
     * let bots = getBots(bySpace("tempLocal"));
     *
     * @dochash actions/bot-filters
     * @docgroup 01-filters
     * @docname bySpace
     */
    function bySpace(space: string): BotFilter {
        let func = byTag(BOT_SPACE_TAG, space) as any;
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
     * Creates a bot filter that includes bots created by the given bot.
     * That is, they have {@tag creator} set to the {@tag id} of the given bot.
     *
     * > This function behaves exactly like `byTag("creator", getID(bot))`.
     *
     * @param bot the bot that created the other bots.
     *
     * @example Find all the bots created by this bot.
     * let bots = getBots(byCreator(thisBot));
     *
     * @dochash actions/bot-filters
     * @docgroup 01-filters
     * @docname byCreator
     */
    function byCreator(bot: Bot | string): BotFilter {
        const id = getID(bot);
        return byTag('creator', id);
    }

    /**
     * Creates a bot filter that includes bots which match any (i.e. one or more) of the given filters.
     *
     * @param filters the filters that should be used.
     *
     * @example Find all bots with the #name bob or a #height of 2
     * const bots = getBots(
     *     either(
     *         byTag("#name", "bob"),
     *         byTag("height", 2)
     *     )
     * );
     *
     * @dochash actions/bot-filters
     * @docgroup 01-filters
     * @docname either
     */
    function either(...filters: BotFilter[]): BotFilter {
        return (bot) => filters.some((f) => f(bot));
    }

    /**
     * Creates a function that includes bots which _do not_ match the given filter.
     *
     * @param filter the bot filter whose results should be negated.
     *
     * @example Find all bots that are not in the test dimension
     * const bots = getBots(not(inDimension("test")));
     *
     * @dochash actions/bot-filters
     * @docgroup 01-filters
     * @docname not
     */
    function not(filter: BotFilter): BotFilter {
        return (bot) => !filter(bot);
    }

    /**
     * Gets the given tag value from the given bot.
     * @param bot the bot that the tag should be retrieved from.
     * @param tag the tag that should be retrieved.
     *
     * @example Get the "color" tag from this bot.
     * let color = getTag(thisBot, "color");
     *
     * @dochash actions/data
     * @docgroup 02-data-actions
     * @docname getTag
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
     * Gets the {@tag id} of the given bot.
     * @param bot the bot whose ID should be retrieved. If given a bot ID, then it will be returned. If given null or something that is not a bot, then null will be returned.
     *
     * @example Get the ID of the current bot
     * let id = getID(thisBot);
     *
     * @example Get the ID of a bot with #name set to "bob"
     * let id = getID(getBot("#name", "bob"));
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname getID
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
     * Gets the [JSON](https://en.wikipedia.org/wiki/JSON) representation of the given data.
     * @param data the data that should be [cloned](https://en.wikipedia.org/wiki/Serialization) into the JSON format. If given a bot, then the returned JSON will be able to be able to be converted back into a mod via {@link getMod}.
     *
     * @example Store a copy of a bot in a tag
     * let bob = getBot("#name", "bob");
     * tags.savedBot = getJSON(bob);
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname getJSON
     */
    function getJSON(data: any): string {
        if (hasValue(data?.[ORIGINAL_OBJECT])) {
            return stableStringify(data[ORIGINAL_OBJECT]);
        }
        return stableStringify(data);
    }

    /**
     * Gets the [JSON](https://en.wikipedia.org/wiki/JSON) representation of the given data formatted in a human-readable manner.
     *
     * @param data the data that should be [cloned](https://en.wikipedia.org/wiki/Serialization) into the JSON format. If given a bot, then the returned JSON will be able to be able to be converted back into a mod via {@link getMod}.
     *
     * @example Sort a nicely formatted copy of a bot in a tag
     * let bob = getBot("#name", "bob");
     * tags.savedBot = getFormattedJSON(bob);
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname getFormattedJSON
     */
    function getFormattedJSON(data: any): string {
        if (hasValue(data?.[ORIGINAL_OBJECT])) {
            return stableStringify(data[ORIGINAL_OBJECT], { space: 2 });
        }
        return stableStringify(data, { space: 2 });
    }

    /**
     * Gets a snapshot of the given bots. Snapshots are like mods (see {@link getMod}) except they contain multiple bots and include the ID, space, tags, and tag masks of the bots.
     *
     * @param bots the bot or list of bots that a snapshot should be created out of.
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname getSnapshot
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
     * The returned value is such that if you were to apply the changes (using {@link applyDiffToSnapshot}) it represents to the first snapshot you would end up with the second snapshot.
     * @param first the snapshot that should be used as the baseline for the diff.
     * @param second the snapshot that should be used as the target for the diff.
     *
     * @example Calculate the diff between two snapshots
     * const first = getSnapshot([thisBot]);
     * thisBot.tags.color = 'red';
     * const second = getSnapshot([thisBot]);
     * const diff = diffSnapshots(first, second);
     *
     * console.log(diff);
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname diffSnapshots
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
     * Applies the given difference to the given snapshot and returns a new snapshot that represents the result.
     *
     * @param snapshot the snapshot that the delta should be applied to. This is also called the baseline snapshot.
     * @param diff the delta that should be applied to the snapshot. You can create a delta from two snapshots by using the {@link diffSnapshots} function.
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname applyDiffToSnapshot
     */
    function applyDiffToSnapshot(
        snapshot: BotsState,
        diff: PartialBotsState
    ): BotsState {
        return apply(snapshot, diff);
    }

    /**
     * Formats the given bytes into a string that contains the [Base64](https://en.wikipedia.org/wiki/Base64) representation of the given data.
     * Returns the Base64 string.
     *
     * @param bytes the bytes that should be formatted into Base64.
     *
     * @example Format a byte array into Base64
     * os.toast(bytes.toBase64String(new Uint8Array([ 255, 254, 253 ])));
     *
     * @dochash actions/bytes
     * @doctitle Bytes Actions
     * @docsidebar Bytes
     * @docdescription Bytes actions are functions that make it easier to work with arrays of bytes and transform them into different formats.
     * @dochash actions/bytes
     * @docname bytes.toBase64String
     */
    function toBase64String(bytes: Uint8Array | ArrayBuffer): string {
        if (bytes instanceof ArrayBuffer || bytes instanceof Uint8Array) {
            const byteArray =
                bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
            return fromByteArray(byteArray);
        } else {
            throw new Error(
                'Invalid input. Expected Uint8Array or ArrayBuffer.'
            );
        }
    }

    /**
     * Converts the given [Base64](https://en.wikipedia.org/wiki/Base64) string into a byte array that contains the data represented by the string.
     * Returns the new Uint8Array array.
     * @param base64 the Base64 formatted string that should be converted to a Uint8Array byte array.
     *
     * @example Convert a Base64 string into bytes
     * const data = bytes.fromBase64String('aGVsbG8='); // "hello" encoded in Base64
     *
     * @dochash actions/bytes
     * @docname bytes.fromBase64String
     */
    function fromBase64String(base64: string): Uint8Array {
        return toByteArray(base64);
    }

    /**
     * Formats the given bytes into a string that contains the [hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal) representation of the given data.
     * Returns the hex string.
     *
     * @param bytes the bytes that should be formatted into hexadecimal.
     *
     * @example Format a byte array into hexadecimal
     * os.toast(bytes.toHexString(new Uint8Array([ 255, 254, 253 ]))); // fffefd in bytes
     *
     * @dochash actions/bytes
     * @docname bytes.toHexString
     */
    function toHexString(bytes: Uint8Array): string {
        return utilToHexString(bytes);
    }

    /**
     * Converts the given [hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal) string into a byte array that contains the data represented by the string. Returns the new Uint8Array array.
     * @param hex the hexadecimal string that should be converted to a byte array.
     *
     * @example Convert a hex string into bytes
     * const data = bytes.fromHexString('fffefd'); // 255, 254, 253 in hex
     *
     * @dochash actions/bytes
     * @docname bytes.fromHexString
     */
    function fromHexString(hex: string): Uint8Array {
        return utilFromHexString(hex);
    }

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
    function toBase64Url(
        bytes: Uint8Array | ArrayBuffer | string,
        mimeType?: string
    ): string {
        if (
            bytes instanceof ArrayBuffer ||
            bytes instanceof Uint8Array ||
            typeof bytes === 'string'
        ) {
            let base64: string =
                typeof bytes === 'string' ? bytes : toBase64String(bytes);
            return `data:${mimeType || 'image/png'};base64,${base64}`;
        } else {
            throw new Error(
                'Invalid input. Expected Uint8Array or ArrayBuffer.'
            );
        }
    }

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
    function fromBase64Url(url: string): Blob {
        const indexOfData = url.indexOf('data:');
        if (indexOfData !== 0) {
            return null;
        }

        const withoutData = url.slice(indexOfData + 5);
        const indexOfSemiColon = withoutData.indexOf(';');
        const mimeType = withoutData.slice(0, indexOfSemiColon);
        const parameters = withoutData.slice(indexOfSemiColon + 1);
        const indexOfBase64 = parameters.indexOf('base64,');
        if (indexOfBase64 < 0) {
            return null;
        }
        const base64 = parameters.slice(indexOfBase64 + 7);
        const bytes = fromBase64String(base64);
        return new Blob([bytes], { type: mimeType });
    }

    // Actions

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
    function chat(message: string, options?: AIChatOptions): Promise<string>;

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
     * @example Ask the AI to describe an uploaded image.
     * const files = await os.showUploadFiles();
     * const firstFile = files[0];
     * const base64 = bytes.toBase64String(new Uint8Array(firstFile.data));
     * const response = await ai.chat({
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
     * os.toast(response.content);
     *
     *
     * @dochash actions/ai
     * @docname ai.chat
     * @docid ai.chat-message
     */
    function chat(
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
     * @example Ask the AI to describe an uploaded image.
     * const files = await os.showUploadFiles();
     * const firstFile = files[0];
     * const base64 = bytes.toBase64String(new Uint8Array(firstFile.data));
     * const response = await ai.chat([{
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
     * os.toast(response.content);
     *
     * @dochash actions/ai
     * @docname ai.chat
     * @docid ai.chat-messages
     */
    function chat(
        messages: AIChatMessage[],
        options?: AIChatOptions
    ): Promise<AIChatMessage>;

    function chat(
        messages: string | AIChatMessage | AIChatMessage[],
        options?: AIChatOptions
    ): Promise<AIChatMessage | string> {
        const task = context.createTask();

        const returnString = typeof messages === 'string';
        const inputMessages: AIChatMessage[] = [];
        if (typeof messages === 'string') {
            inputMessages.push({
                role: 'user',
                content: messages,
            });
        } else if (Array.isArray(messages)) {
            inputMessages.push(...messages);
        } else if (typeof messages === 'object') {
            inputMessages.push(messages);
        }

        const action = aiChat(inputMessages, options, task.taskId);
        const final = addAsyncResultAction(task, action).then((result) => {
            const choice = result.choices[0];
            if (returnString) {
                return choice?.content;
            }
            return choice;
        });
        (final as any)[ORIGINAL_OBJECT] = action;
        return final;
    }

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
    function chatStream(
        message: string,
        options?: AIChatOptions
    ): Promise<AsyncIterable<string>>;

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
    function chatStream(
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
    function chatStream(
        messages: AIChatMessage[],
        options?: AIChatOptions
    ): Promise<AsyncIterable<AIChatMessage>>;

    function chatStream(
        messages: string | AIChatMessage | AIChatMessage[],
        options?: AIChatOptions
    ): Promise<AsyncIterable<AIChatMessage | string>> {
        const task = context.createIterable();

        const returnString = typeof messages === 'string';
        const inputMessages: AIChatMessage[] = [];
        if (typeof messages === 'string') {
            inputMessages.push({
                role: 'user',
                content: messages,
            });
        } else if (Array.isArray(messages)) {
            inputMessages.push(...messages);
        } else if (typeof messages === 'object') {
            inputMessages.push(messages);
        }

        const action = aiChatStream(inputMessages, options, task.taskId);
        const promise = addAsyncResultIterableAction(task, action).then(
            (iterable: AsyncIterable<AIChatInterfaceStreamResponse>) => {
                async function* generator(): AsyncGenerator<
                    AIChatMessage | string
                > {
                    for await (let result of iterable) {
                        if (result.choices.length <= 0) {
                            continue;
                        }
                        const choice = result.choices[0];
                        if (!hasValue(choice)) {
                            continue;
                        }
                        if (returnString) {
                            const content = choice?.content;
                            if (!hasValue(content)) {
                                continue;
                            }
                            yield content;
                        } else {
                            yield choice;
                        }
                    }
                }

                return generator();
            }
        );

        (promise as any)[ORIGINAL_OBJECT] = action;
        return promise;
    }

    /**
     * Lists the available chat models that the user can use.
     * Returns a promise that resolves with an array of available chat models.
     * Throws a {@link CasualOSError} if an error occurs.
     *
     * @example List available chat models
     * const models = await ai.listChatModels();
     * console.log(models);
     *
     * @dochash actions/ai
     * @docname ai.listChatModels
     */
    function listChatModels(
        options?: RecordActionOptions
    ): Promise<ListedChatModel[]> {
        const task = context.createTask();
        const action = aiListChatModels(options, task.taskId);
        const final = addAsyncResultAction(task, action).then(
            (result: GenericSuccess<ListedChatModel[]>) => result.items
        );
        (final as any)[ORIGINAL_OBJECT] = action;
        return final;
    }

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
    function generateSkybox(
        prompt: string,
        negativePrompt?: string,
        options?: AIGenerateSkyboxOptions
    ): Promise<string>;

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
    function generateSkybox(
        request: AIGenerateSkyboxRequest
    ): Promise<AIGenerateSkyboxResult>;

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
     */
    function generateSkybox(
        prompt: string | AIGenerateSkyboxRequest,
        negativePrompt?: string,
        options?: AIGenerateSkyboxOptions
    ): Promise<string | AIGenerateSkyboxResult> {
        const task = context.createTask();

        const returnObject = typeof prompt === 'object';
        let action: AIGenerateSkyboxAction;
        if (typeof prompt === 'object') {
            action = aiGenerateSkybox(
                prompt.prompt,
                prompt.negativePrompt,
                prompt.options,
                task.taskId
            );
        } else {
            action = aiGenerateSkybox(
                prompt,
                negativePrompt,
                options,
                task.taskId
            );
        }

        const final = addAsyncResultAction(task, action).then((result) => {
            if (returnObject) {
                return result;
            } else {
                return result.fileUrl;
            }
        });
        (final as any)[ORIGINAL_OBJECT] = action;
        return final;
    }

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
     * const image = await ai.generateImage("An oil painting of a grassy field.", "realistic");
     * masks.formAddress = image;
     *
     * @example Generate a image and upload it as a file record
     * const image = await ai.generateImage("An oil painting of a grassy field.");
     * const blob = bytes.fromBase64Url(image);
     * const file = await os.recordFile(recordKey, blob);
     * console.log('file url', file.url);
     *
     * @dochash actions/ai
     * @docname ai.generateImage
     * @docid ai.generateImage-string
     */
    function generateImage(
        prompt: string,
        negativePrompt?: string,
        options?: AIGenerateImageOptions & RecordActionOptions
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
     * const imageResult = await ai.generateImage({
     *     prompt: "An oil painting of a grassy field.",
     * });
     * masks.formAddress = imageResult.images[0].url;
     *
     * @example Generate a image from a prompt and a negative prompt
     * const imageResult = await ai.generateImage({
     *     prompt: "An oil painting of a grassy field.",
     *     negativePrompt: "realistic"
     * });
     * masks.formAddress = imageResult.images[0].url;
     *
     * @example Generate a image and upload it as a file record
     * const imageResult = await ai.generateImage({
     *     prompt: "An oil painting of a grassy field.",
     *     negativePrompt: "realistic"
     * });
     * const image = imageResult.images[0];
     * const blob = bytes.fromBase64Url(image.url);
     * const file = await os.recordFile(recordKey, blob);
     * console.log('file url', file.url);
     *
     * @dochash actions/ai
     * @docname ai.generateImage
     * @docid ai.generateImage-request
     */
    function generateImage(
        request: AIGenerateImageOptions,
        options?: RecordActionOptions
    ): Promise<AIGenerateImageAPISuccess>;

    function generateImage(
        prompt: string | AIGenerateImageOptions,
        negativePrompt?: string | RecordActionOptions,
        options?: RecordActionOptions
    ): Promise<string | AIGenerateImageAPISuccess> {
        const task = context.createTask();

        const returnObject = typeof prompt === 'object';
        let action: AIGenerateImageAction;
        if (typeof prompt === 'object') {
            action = aiGenerateImage(
                prompt,
                negativePrompt as RecordActionOptions,
                task.taskId
            );
        } else {
            let { endpoint, ...parameters } = options ?? {};
            action = aiGenerateImage(
                {
                    ...parameters,
                    prompt,
                    negativePrompt: negativePrompt as string,
                },
                {
                    endpoint,
                },
                task.taskId
            );
        }

        const final = addAsyncResultAction(task, action).then(
            (result: AIGenerateImageSuccess) => {
                if (returnObject) {
                    return {
                        ...result,
                        images: result.images.map((image) => ({
                            ...image,
                            url: toBase64Url(
                                image.base64,
                                image.mimeType ?? 'image/png'
                            ),
                        })),
                    };
                } else {
                    const image = result.images[0];
                    const base64 = image.base64;
                    return toBase64Url(base64, image.mimeType ?? 'image/png');
                }
            }
        );
        (final as any)[ORIGINAL_OBJECT] = action;
        return final;
    }

    /**
     * Gets an access token for the Hume AI API.
     * Returns a promise that resolves with the access token.
     *
     * @param recordName The name of the record that the access token should be generated for. If omitted, then the user's studio record will be used.
     *
     * @example Get an access token for the Hume AI API.
     * const accessToken = await ai.hume.getAccessToken();
     *
     * @example Get an access token for the Hume AI API for the given record.
     * const accessToken = await ai.hume.getAccessToken('recordName');
     *
     * @dochash actions/ai
     * @docname ai.hume.getAccessToken
     */
    function getHumeAccessToken(
        recordName?: string
    ): Promise<AIHumeGetAccessTokenResult> {
        const task = context.createTask();
        const action = aiHumeGetAccessToken(recordName, {}, task.taskId);
        const final = addAsyncResultAction(task, action);
        (final as any)[ORIGINAL_OBJECT] = action;
        return final;
    }

    /**
     * Generates a new 3D model using [sloyd.ai](https://www.sloyd.ai/).
     * @param request The options for the 3D model.
     * @param options The options for the request.
     *
     * @example Generate a chair model using Sloyd
     * const model = await ai.sloyd.generateModel({
     *     prompt: 'a chair'
     * });
     *
     * @example Generate a chair using a studio subscription
     * const model = await ai.sloyd.generateModel({
     *     recordName: 'studioID',
     *     prompt: 'a chair'
     * });
     *
     * @dochash actions/ai
     * @docname ai.sloyd.generateModel
     */
    function generateSloydModel(
        request: AISloydGenerateModelOptions,
        options: RecordActionOptions = {}
    ): Promise<AISloydGenerateModelResponse> {
        const task = context.createTask();
        const action = aiSloydGenerateModel(request, options, task.taskId);
        const final = addAsyncResultAction(task, action);
        (final as any)[ORIGINAL_OBJECT] = action;
        return final;
    }

    /**
     * Creates a new OpenAI Realtime Session.
     * @param recordName The name of the record that the session is for.
     * @param request The request options for the session.
     * @param options The options for the records request.
     *
     *
     * @example Create a new OpenAI Realtime Session.
     * const model = "gpt-4o-realtime-preview-2024-12-17";
     * const result = await ai.openai.createRealtimeSession(authBot.id, {
     *    model,
     * });
     *
     * @example Use WebRTC to create a new OpenAI Realtime Session.
     * async function init() {
     *   await os.requestAuthBot();
     *   const recordName = authBot.id;
     *   const model = "gpt-4o-realtime-preview-2024-12-17";
     *   const result = await ai.openai.createRealtimeSession(recordName, {
     *       model,
     *   });
     *
     *   // Get an ephemeral key from your server - see server code below
     *   const EPHEMERAL_KEY = result.clientSecret.value;
     *
     *   // Create a peer connection
     *   const pc = new RTCPeerConnection();
     *
     *   // Set up to play remote audio from the model
     *   const audioEl = document.createElement("audio");
     *   audioEl.autoplay = true;
     *   pc.ontrack = e => audioEl.srcObject = e.streams[0];
     *
     *   // Add local audio track for microphone input in the browser
     *   const ms = await navigator.mediaDevices.getUserMedia({
     *     audio: true
     *   });
     *   pc.addTrack(ms.getTracks()[0]);
     *
     *   // Set up data channel for sending and receiving events
     *   const dc = pc.createDataChannel("oai-events");
     *   dc.addEventListener("message", (e) => {
     *     // Realtime server events appear here!
     *     console.log(e);
     *   });
     *
     *   // Start the session using the Session Description Protocol (SDP)
     *   const offer = await pc.createOffer();
     *   await pc.setLocalDescription(offer);
     *
     *   const baseUrl = "https://api.openai.com/v1/realtime";
     *   debugger;
     *   const sdpResponse = await window.fetch.bind(window)(`${baseUrl}?model=${model}`, {
     *     method: "POST",
     *     body: offer.sdp,
     *     headers: {
     *       Authorization: `Bearer ${EPHEMERAL_KEY}`,
     *       "Content-Type": "application/sdp"
     *     },
     *   });
     *
     *   const answer = {
     *     type: "answer",
     *     sdp: await sdpResponse.text(),
     *   };
     *   await pc.setRemoteDescription(answer);
     * }
     *
     * init();
     *
     * @dochash actions/ai
     * @docname ai.openai.createRealtimeSession
     */
    function createOpenAIRealtimeSession(
        recordName: string,
        request: CreateRealtimeSessionTokenRequest,
        options: RecordActionOptions = {}
    ): Promise<AICreateOpenAIRealtimeSessionTokenResult> {
        const task = context.createTask();
        const action = aiOpenAICreateRealtimeSession(
            recordName,
            request,
            options,
            task.taskId
        );
        const final = addAsyncResultAction(task, action);
        (final as any)[ORIGINAL_OBJECT] = action;
        return final;
    }

    /**
     * Shows a temporary "toast" notification to the player at the bottom of the screen with the given message.
     * Optionally accepts a duration parameter which is the number of seconds that the message should be on the screen.
     *
     * @param message the text that the toast message should show.
     * @param duration the number of seconds that the message should be on the screen. (Default is 2)
     *
     * @example Show a "Hello!" toast message.
     * os.toast("Hello!");
     *
     * @example Show the player a code for 5 seconds.
     * os.toast("this is the code", 5);
     *
     * @dochash actions/os/portals
     * @doctitle Portal Actions
     * @docsidebar Portals
     * @docdescription Portal actions are functions that make it easier to work with the player's portals.
     * @docname os.toast
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
     *Retrieves a list of issues for the script stored under the specified tag.
     *
     *The getScriptIssues function takes in a bot instance and a tag of that bot, then analyzes
     *the script associated with the given tag. It gathers all issues that have been
     *raised, including syntax errors, semantic inconsistencies, and suggestions for
     *improvement. This function helps in identifying and addressing potential problems
     *in the script.
     *
     * @param bot the bot to get the script issues for.
     * @param tag the tag of the bot to get the script issues for.
     *
     * @example Get the script issues for a bot.
     * const issues = await os.getScriptIssues(bot, 'tag');
     * console.log(issues);
     */
    function getScriptIssues(
        bot: Bot | string,
        tag: string
    ): Promise<string[]> {
        const botId = typeof bot === 'string' ? bot : bot.id;
        const task = context.createTask();
        const action = scriptIssues(botId, tag, task.taskId);

        return addAsyncAction(task, action);
    }

    /**
     * Shows a temporary "tooltip" message on the screen. Optionally placed at the specified position and shown for the given duration.
     * Returns a promise that resolves with the ID of the new tooltip.
     *
     * If a position is not specified, then a position just below the current mouse position will be used.
     * If on mobile, then the last touch position will be used or the center of the screen if the user has not touched the screen.
     * Additionally, if a position is not specified then the tooltip will be automatically hidden if the user moves the mouse significantly away from the position that the mouse was at when the tooltip was shown.
     *
     * @param message the text that the tooltip message should show.
     * @param pixelX the horizontal pixel position that the tooltip should be shown at on the screen. If not specified then the current mouse position will be used.
     * @param pixelY the vertical position that the tooltip should be shown at on the screen. If not specified then a position just below the current mouse position will be used.
     * @param duration the number of seconds that the toast should be shown for before automatically being hidden. (Default is 2)
     *
     * @example Show a "Hello!" tip message.
     * os.tip("Hello!");
     *
     * @example Show a tip at the center of the screen.
     * os.tip("This is in the center of the screen.", gridPortalBot.tags.pixelWidth / 2, gridPortalBot.tags.pixelHeight / 2);
     *
     * @example Show a tip near the mouse cursor for 5 seconds.
     * os.tip("5 second tip.", null, null, 5);
     *
     * @example Show a tip and record its ID in a tag mask.
     * masks.tipID = await os.tip("Hello!");
     *
     * @dochash actions/os/portals
     * @docname os.tip
     * @docgroup 10-tip
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
     * Hides the tooltips that have the specified IDs. If no arguments are specified, then all tooltips will be hidden.
     * Returns a promise that resolves when the tooltips have been hidden.
     *
     * @param tipIds the tooltip ID or array of tooltip IDs that should be hidden.
     *
     * @example Show and hide a tooltip message.
     * const id = await os.tip("Hello!");
     * await os.sleep(1000);
     * await os.hideTips(id);
     *
     * @dochash actions/os/portals
     * @docname os.hideTips
     * @docgroup 10-tip
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
     * Shows a [QR Code](https://en.wikipedia.org/wiki/QR_code) with a link to join the given inst and dimension.
     * If the inst and dimension are omitted, then the current inst and dimension will be used.
     *
     * @param inst the inst that the code should be shown for. Defaults to the current inst.
     * @param dimension the dimension that the code should be shown for. Defaults to the current dimension.
     *
     * @example Show a join QR Code for the current inst.
     * os.showJoinCode();
     *
     * @example Show a join QR Code for a inst and dimension.
     * os.showJoinCode("inst", "dimension");
     *
     * @dochash actions/os/barcodes
     * @docname os.showJoinCode
     * @docgroup 10-qr-code
     */
    function showJoinCode(
        inst?: string,
        dimension?: string
    ): ShowJoinCodeAction {
        return addAction(calcShowJoinCode(inst, dimension));
    }

    /**
     * Attempts to enter fullscreen mode. Depending on which web browser the player is using, this might ask for permission to go fullscreen.
     *
     * Note that iPhones currently don't support fullscreen mode.
     *
     * @example Enter fullscreen mode.
     * os.requestFullscreenMode();
     *
     * @dochash actions/os/portals
     * @docname os.requestFullscreenMode
     * @docgroup 10-fullscreen
     */
    function requestFullscreenMode(): RequestFullscreenAction {
        return addAction(requestFullscreen());
    }

    /**
     * Exits fullscreen mode.
     *
     * @example Exit fullscreen mode.
     * os.exitFullscreenMode();
     *
     * @dochash actions/os/portals
     * @docname os.exitFullscreenMode
     * @docgroup 10-fullscreen
     */
    function exitFullscreenMode(): ExitFullscreenAction {
        return addAction(exitFullscreen());
    }

    /**
     * Hides the loading screen.
     *
     * Returns a promise that resolves when the loading screen has been hidden.
     *
     * @example Hide the loading screen.
     * await os.hideLoadingScreen();
     *
     * @dochash actions/os/portals
     * @docname os.hideLoadingScreen
     * @docgroup 11-loading
     */
    function hideLoadingScreen(): Promise<void> {
        const task = context.createTask();
        const action: HideLoadingScreenAction = {
            type: 'hide_loading_screen',
            taskId: task.taskId,
        };
        return addAsyncAction(task, action);
    }

    /**
     * Shows some HTML to the player in a popup modal. This can be useful for loading a separate webpage or providing some formatted text.
     *
     * @param html the HTML that should be shown to the user.
     *
     * @example Show a header with some text.
     * os.showHtml(`
     *   <h1>This is some text!</h1>
     * `);
     *
     * @example Show a YouTube video.
     * os.showHtml(`
     *   <iframe
     *       width="560"
     *       height="315"
     *       src="https://www.youtube.com/embed/BHACKCNDMW8"
     *       frameborder="0"
     *       allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
     *       allowfullscreen>
     *   </iframe>
     * `);
     *
     * @dochash actions/os/portals
     * @docname os.showHtml
     * @docgroup 10-html
     */
    function showHtml(html: string): ShowHtmlAction {
        return addAction(htmlMessage(html));
    }

    /**
     * Closes the HTML popup modal.
     *
     * @example Hide the HTML popup.
     * os.hideHtml();
     *
     * @dochash actions/os/portals
     * @docname os.hideHtml
     * @docgroup 10-html
     */
    function hideHtml(): HideHtmlAction {
        return addAction(hideHtmlMessage());
    }

    /**
     * Copies the given text to the player's clipboard. On Chrome and Firefox, this will act like a `Ctrl+C`/`Cmd+C`.
     * On Safari and all iOS browsers this will open a popup which prompts the player to copy the text.
     *
     * @param text the text that should be copied to the player's clipboard.
     *
     * @example Copy "hello" to the player's clipboard.
     * os.setClipboard("hello");
     *
     * @dochash actions/os/clipboard
     * @doctitle Clipboard Actions
     * @docsidebar Clipboard
     * @docdescription Clipboard actions are functions that make it easier to work with the player's clipboard.
     * @docname os.setClipboard
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
     * @param duration The duration of the tween in seconds.
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
     * Focuses on the given bot. For bots in the bot or miniGridPortals, this animates the camera such that the portal focus point is placed on the given bot or position.
     * For input bots in menu portal, this gives keyboard focus to them.
     *
     * Returns a promise which resolves when the bot has been focused.
     * For the bot and miniGridPortals this is when the animation finishes and rejects if the user takes control of the camera during the animation. For menu bots this is when the input field is focused and rejects if the bot is not a input bot.
     *
     * @param botOrPosition the bot, or bot ID that should be focused. If null, then the current focus animation will be canceled.
     * @param options the additional options to use for the focus operation. This can be used to change how the camera moves or to specify which portal the bot should be focused in.
     *
     * @example Move the player's view to show a bot named bob.
     * await os.focusOn(getBot("#name", "bob"));
     *
     * @example Move the player's view to show this bot from the top.
     * await os.focusOn(thisBot, {
     *     rotation: {
     *         x: 0,
     *         y: 0
     *     }
     * });
     *
     * @example Move the player's view to show this bot with a particular zoom value.
     * await os.focusOn(thisBot, {
     *     zoom: 15
     * });
     *
     * @example Focus on this bot in the menu portal
     * await os.focusOn(thisBot, {
     *     portal: 'menu'
     * });
     *
     * @example Rotate the camera around the focus point 3 times.
     * await os.focusOn(thisBot, {
     *     rotation: {
     *         y: (Math.PI * 2) * 3,
     *         normalize: false
     *     }
     * });
     *
     * @example Focus the onClick tag in the systemPortal
     * await os.focusOn(thisBot, {
     *     tag: 'onClick',
     *     portal: 'system'
     * });
     *
     * @example Focus line 2 in the onClick tag in the sheetPortal
     * await os.focusOn(thisBot, {
     *     tag: 'onClick',
     *     lineNumber: 2,
     *     portal: 'sheet'
     * });
     *
     * @example Focus index 9 through 15 in the onClick tag in the tagPortal
     * await os.focusOn(thisBot, {
     *     tag: 'onClick',
     *     startIndex: 9,
     *     endIndex: 15,
     *     portal: 'tag'
     * });
     *
     * @dochash actions/os/portals
     * @docname os.focusOn
     * @docid os.focusOn-bot
     */
    function _focusOn_bot(
        bot: Bot | string,
        options?: FocusOnOptions
    ): Promise<void> {
        return null;
    }

    /**
     * Focuses on the given position.
     *
     * Returns a promise which resolves when the position has been focused.
     *
     * @param botOrPosition the position that should be focused. If null, then the current focus animation will be canceled.
     * @param options the additional options to use for the focus operation. This can be used to change how the camera moves or to specify which portal the bot should be focused in.
     *
     * @example Move the player's view to a specific position.
     * await os.focusOn({
     *     x: 15,
     *     y: 9.5
     * });
     *
     * @example Focus on Buckingham Palace in the map portal
     * await os.focusOn({
     *     x: -0.141329,
     *     y: 51.501541
     * }, {
     *     portal: 'map',
     *     zoom: 10000
     * });
     *
     * @dochash actions/os/portals
     * @docname os.focusOn
     * @docid os.focusOn-position
     */
    function _focusOn_position(
        position: { x: number; y: number; z?: number },
        options?: FocusOnOptions
    ): Promise<void> {
        return null;
    }

    function focusOn(
        botOrPosition: Bot | string | { x: number; y: number; z?: number },
        options?: FocusOnOptions
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
     * Shows the "chat bar" at the top of the screen in CasualOS, optionally using the given text as the placeholder.
     * Typing in the chat bar will send {@tag @onChatTyping} shouts and pressing Enter will send a {@tag @onChat} shout and clear the chat bar.
     *
     * @param placeholder the text that the chat bar should show as the placeholder.
     *
     * @example Show the chat bar.
     * os.showChat();
     *
     * @example Show the chat bar with some placeholder text.
     * os.showChat("hello");
     *
     * @dochash actions/os/input
     * @doctitle Input Actions
     * @docsidebar Input
     * @docdescription Input actions are functions that make it easier accept input from the user.
     * @docname os.showChat
     * @docid showChat-placeholder
     * @docgroup 10-chat
     */
    function _showChat_placeholder(placeholder?: string) {}

    /**
     * Shows the "chat bar" at the top of the screen in CasualOS, optionally using the given text as the placeholder.
     * Typing in the chat bar will send {@tag @onChatTyping} shouts and pressing Enter will send a {@tag @onChat} shout and clear the chat bar.
     *
     * @param options the options that the chat bar should use.
     *
     * @example Show the chat bar with a placeholder.
     * os.showChat({
     *     placeholder: "hello"
     * });
     *
     * @example Show the chat bar with some prefilled text.
     * os.showChat({
     *     prefill: "this is prefilled"
     * });
     *
     * @example Show the chat bar with some prefilled text and a placeholder.
     * os.showChat({
     *     prefill: "this is prefilled",
     *     placeholder: "hello"
     * });
     *
     * @example Show the chat bar with a custom placeholder color.
     * os.showChat({
     *     placeholder: "hello",
     *     placeholderColor: '#44a471'
     * });
     *
     * @example Show the chat bar with a custom background color.
     * os.showChat({
     *     placeholder: "hello",
     *     backgroundColor: '#f1abe2'
     * });
     *
     * @example Show the chat bar with a custom foreground color.
     * os.showChat({
     *     placeholder: "hello",
     *     foregroundColor: '#531234'
     * });
     *
     * @dochash actions/os/input
     * @docname os.showChat
     * @docid showChat-options
     * @docgroup 10-chat
     */
    function _showChat_options(options?: ShowChatOptions) {}

    /**
     * Shows the "chat bar" at the top of the screen in CasualOS, optionally using the given text as the placeholder.
     * Typing in the chat bar will send {@tag @onChatTyping} shouts and pressing Enter will send a {@tag @onChat} shout and clear the chat bar.
     *
     * @param placeholderOrOptions the text that the chat bar should show as the placeholder.
     *
     * @example Show the chat bar.
     * os.showChat();
     *
     * @example Show the chat bar with some placeholder text.
     * os.showChat("hello");
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
     * Hides the "chat bar" at the top of the screen in CasualOS.
     *
     * @example Hide the chat bar.
     * os.hideChat();
     *
     * @dochash actions/os/input
     * @docname os.hideChat
     * @docgroup 10-chat
     */
    function hideChat(): ShowChatBarAction {
        return addAction(calcHideChat());
    }

    /**
     * Runs the given script.
     * The script will be executed in a separate environment with no `bot`, `tags`, `this`, `thisBot`, `data`, and `that` variables.
     * This means that you need to use the {@link getbot-filters} or {@link getbots-filters} functions to read bot data.
     *
     * Returns a promise that resolves with the returned script value after it has been executed.
     *
     * @param script The script that should be executed.
     *
     * @example Run a script that says "hello".
     * os.run("os.toast('hello');");
     *
     * @example Run a script from the #script tag on the current bot.
     * os.run(tags.script);
     *
     * @example Run a script and toast the result.
     * const result = await os.run("return 594 + 391");
     * os.toast(result);
     *
     * @dochash actions/os/system
     * @docname os.run
     */
    function run(script: string) {
        const task = context.createTask();
        const event = runScript(script, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Gets information about the version of CasualOS.
     *
     * @example Get the current version and popup a message with it.
     * const info = os.version();
     * os.toast(info.version);
     *
     * @example Check whether the current inst is for playing AUXes.
     * const info = os.version();
     * const isPlayer = info.playerMode === "player";
     * os.toast('Is Player: ' + isPlayer);
     *
     * @dochash actions/os/system
     * @docname os.version
     * @docgroup 10-os-info
     */
    function version(): AuxVersion {
        return context.version;
    }

    /**
     * Gets information about the device that the player is using.
     *
     * @example Get the device info and popup a message with it.
     * const info = os.device();
     * os.toast(info);
     *
     * @dochash actions/os/system
     * @docname os.device
     * @docgroup 10-os-info
     */
    function device(): AuxDevice {
        if (context.device) {
            return context.device;
        }
        return {
            supportsAR: null as boolean,
            supportsVR: null as boolean,
            supportsDOM: null as boolean,
            isCollaborative: null as boolean,
            allowCollaborationUpgrade: null as boolean,
            ab1BootstrapUrl: null as string,
            comID: null as string,
        };
    }

    /**
     * Gets whether the current session was loaded with collaborative features enabled.
     *
     * When `true`, CasualOS will attempt to sync the `shared` (including `tempShared` and `remoteTempShared`) spaces with other players.
     * When `false`, CasualOS will treat all the shared spaces like they are all `tempLocal`.
     *
     * @example Toast whether the current session is collaborative.
     * const isCollaborative = os.isCollaborative();
     * os.toast(isCollaborative ? "We are collaborative!" : "We are not collaborative!");
     *
     * @dochash actions/os/spaces
     * @doctitle Space Actions
     * @docsidebar Spaces
     * @docdescription Space actions are functions that make it easier to work with the spaces in CasualOS.
     * @docname os.isCollaborative
     * @docgroup 10-os-info
     */
    function isCollaborative(): boolean {
        if (context.device) {
            return context.device.isCollaborative;
        }

        return true;
    }

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
    function enableCollaboration(): Promise<void> {
        if (context.device) {
            if (!context.device.isCollaborative) {
                if (!context.device.allowCollaborationUpgrade) {
                    return Promise.reject(
                        new Error(
                            'Collaboration cannot be enabled on this device'
                        )
                    );
                }
                const task = context.createTask();
                const event = calcEnableCollaboration(task.taskId);
                return addAsyncAction(task, event);
            }
        }

        return Promise.resolve();
    }

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
    function showAccountInfo(): Promise<void> {
        const task = context.createTask();
        const event = calcShowAccountInfo(task.taskId);
        return addAsyncAction(task, event);
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
     * Enables augmented reality on the device.
     * You can check for device support by calling {@link os.arSupported}.
     *
     * If enabled successfully, the {@tag @onEnterAR} shout is sent to all bots.
     *
     * @param options the options that should be used for the AR session.
     *
     * @example Enable AR.
     * os.enableAR();
     *
     * @example Enable AR running at half the resolution of normal.
     * os.enableAR({
     *     frameBufferScaleFactor: 0.5
     * });
     *
     * @dochash actions/os/xr
     * @docname os.enableAR
     * @docgroup 11-ar
     */
    function enableAR(options?: EnableXROptions): EnableARAction {
        return addAction(calcEnableAR(options));
    }

    /**
     * Disables augmented reality on the device.
     *
     * When disabled, {@tag @onExitAR} shout is sent to all bots.
     *
     * @example Disable AR.
     * os.disableAR();
     *
     * @dochash actions/os/xr
     * @docname os.disableAR
     * @docgroup 11-ar
     */
    function disableAR(): EnableARAction {
        return addAction(calcDisableAR());
    }

    /**
     * Gets whether this device supports AR or not.
     *
     * Returns a promise that resolves with a boolean indicating wether or not augmented reality is supported by the device.
     *
     * @example Check if AR is supported:
     * const supported = await os.arSupported();
     *
     * @dochash actions/os/xr
     * @doctitle XR Actions
     * @docsidebar XR
     * @docdescription Actions for enabling and disabling XR (AR & VR) features.
     * @docname os.arSupported
     * @docgroup 11-ar
     */
    function arSupported(): Promise<boolean> {
        const task = context.createTask();
        const event = calcARSupported(task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Enables virtual reality on the device.
     * You can check for device support by calling {@link os.vrSupported}.
     *
     * If enabled successfully, the {@tag @onEnterVR} shout is sent to all bots.
     *
     * @param options the options that should be used for the VR session.
     *
     * @example Enable VR.
     * os.enableVR();
     *
     * @example Enable VR running at half the resolution of normal.
     * os.enableVR({
     *     frameBufferScaleFactor: 0.5
     * });
     *
     * @dochash actions/os/xr
     * @docname os.enableVR
     * @docgroup 11-vr
     */
    function enableVR(options?: EnableXROptions): EnableVRAction {
        return addAction(calcEnableVR(options));
    }

    /**
     * Disables virtual reality on the device.
     *
     * When disabled, {@tag @onExitVR} shout is sent to all bots.
     *
     * @example Disable VR.
     * os.disableVR();
     *
     * @dochash actions/os/xr
     * @docname os.disableVR
     * @docgroup 11-vr
     */
    function disableVR(): EnableVRAction {
        return addAction(calcDisableVR());
    }

    /**
     * Gets whether this device supports VR or not.
     *
     * Returns a promise that resolves with a boolean indicating wether or not virtual reality is supported by the device.
     *
     * @example Check if VR is supported:
     * const supported = await os.vrSupported();
     *
     * @dochash actions/os/xr
     * @docname os.vrSupported
     * @docgroup 11-vr
     */
    function vrSupported(): Promise<boolean> {
        const task = context.createTask();
        const event = calcVRSupported(task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Enables Point-of-View mode on the device.
     * Useful for getting a "ground level" view in the grid portal.
     * This will move the camera to the given position, set the camera type to `perspective`, and change the camera controls so that dragging the screen causes the camera to look around.
     *
     * It is not possible to manually move the camera in this mode, however it is still possible to use {@link os.focusOn-bot} to move the camera.
     *
     * @param center the position that the camera should be placed at. If not specified, then the camera will be placed at `(0, 0, 0)`.
     * @param imu whether the imuPortal should be used to control the camera rotation while in Point-of-View mode.
     *
     * @example Enable POV mode.
     * os.enablePointOfView();
     *
     * @example Enable POV mode at `(5, 0, 3)`.
     * os.enablePointOfView({
     *     x: 5,
     *     y: 0,
     *     z: 3
     * });
     *
     * @example Enable POV mode with the IMU.
     * os.enablePointOfView(undefined, true);
     *
     * @dochash actions/os/portals
     * @docname os.enablePointOfView
     * @docgroup 10-pov
     */
    function enablePointOfView(
        center: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
        imu?: boolean
    ): EnablePOVAction {
        return addAction(enablePOV(center, imu));
    }

    /**
     * Disables Point-of-View mode on the device. This will return the camera to its original position, set the camera type back to what it was before, and change the camera controls to the defaults.
     *
     * @example Disable POV mode.
     * os.disablePointOfView();
     *
     * @dochash actions/os/portals
     * @docname os.disablePointOfView
     * @docgroup 10-pov
     */
    function disablePointOfView(): EnablePOVAction {
        return addAction(disablePOV());
    }

    /**
     * Requests a wake lock that will keep the device screen awake.
     * This will ask the user for permission to keep the screen awake.
     * Returns a promise that resolves once the wake lock has been granted. If the wake lock is denied, then an error will be thrown.
     *
     * Useful for a kiosk mode where the screen is always supposed to be on.
     *
     * @example Request a wake lock from the user.
     * await os.requestWakeLock();
     *
     * @dochash actions/os/portals
     * @docname os.requestWakeLock
     * @docgroup 10-wake-lock
     */
    function requestWakeLock(): Promise<void> {
        const task = context.createTask();
        const action = configureWakeLock(true, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Disables the wake lock that was previously enabled. Returns a promise that resolves once the wake lock has been disabled.
     *
     * @example Disable the wake lock
     * await os.disableWakeLock();
     *
     * @dochash actions/os/portals
     * @docname os.disableWakeLock
     * @docgroup 10-wake-lock
     */
    function disableWakeLock(): Promise<void> {
        const task = context.createTask();
        const action = configureWakeLock(false, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Retrieves the current wake lock state. Returns a promise that resolves with an object that contains information about the current wake lock state.
     *
     * @example Get the current wake lock state
     * const configuration = await os.getWakeLockConfiguration();
     *
     * if (configuration.enabled) {
     *     os.toast('Wake lock is enabled!');
     * } else {
     *     os.toast('Wake lock is disabled.');
     * }
     *
     * @dochash actions/os/portals
     * @docname os.getWakeLockConfiguration
     * @docgroup 10-wake-lock
     */
    function getWakeLockConfiguration(): Promise<WakeLockConfiguration> {
        const task = context.createTask();
        const action = calcGetWakeLockConfiguration(task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Downloads the given data with the given filename and [MIME Type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types).
     *
     * @param data the data that should be downloaded. This can be a string, object, or binary data in the form of an [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) or [Blob](https://developer.mozilla.org/en-us/docs/Web/API/Blob).
     * @param filename the name of the file that should be downloaded.
     * @param mimeType the [MIME Type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types) that the downloaded file should have. If not provided, then it will be inferred from the provided filename.
     *
     * @example Download a text file named "test.txt" that contains "abc".
     * os.download("abc", "test.txt");
     *
     * @dochash actions/os/files
     * @doctitle File Actions
     * @docsidebar Files
     * @docdescription Actions for uploading and downloading files.
     * @docname os.download
     * @docgroup 10-download
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
     * Downloads the given array of bots as a `.aux` or a `.pdf` file with the given filename. Useful for quickly backing up a set of bots.
     *
     * The downloaded bots will be stored in the Version 1 format of the [AUX File Format](glossary:aux), which is well suited for most scenarios.
     * For scenarios where you want conflict-free initialization of a shared inst, you should use {@link os.downloadBotsAsInitialzationUpdate}.
     *
     * @param bots the array of bots that should be downloaded.
     * @param filename the name of the file that the bots should be stored in. If the filename ends with `.pdf`, then a PDF file will be downloaded with the bots as embedded data. Otherwise, `.aux` will automatically be added to the end of the filename.
     *
     * @example Download all the bots in the "abc" dimension as "abcBots.aux".
     * os.downloadBots(getBots(inDimension("abc")), "abcBots");
     *
     * @example Download the current bot as "currentBot.aux".
     * os.downloadBots([bot], "currentBot");
     *
     * @example Download all bots as "myServer.pdf".
     * os.downloadBots(getBots(), "myServer.pdf");
     *
     * @dochash actions/os/files
     * @docname os.downloadBots
     * @docgroup 10-download
     */
    function downloadBots(bots: Bot[], filename: string): DownloadAction {
        let state: BotsState = {};
        for (let bot of bots) {
            state[bot.id] = bot;
        }

        if (!filename) {
            throw new Error('Filename must be provided. Try again.');
        }

        let data = JSON.stringify(getVersion1DownloadState(state));
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
     * Downloads the given array of bots as a `.aux` or a `.pdf` file with the given filename.
     *
     * The downloaded bots will be stored in the Version 2 format of the [AUX File Format](glossary:aux), which is better suited towards scenarios which require conflict-free initialization of a shared inst from the AUX file.
     * For an archive of the current state, you should use {@link os.downloadBots} which is better for scenarios which require direct access to the bot data.
     *
     * @param bots the array of bots that should be downloaded.
     * @param filename the name of the file that the bots should be stored in. If the filename ends with `.pdf`, then a PDF file will be downloaded with the bots as embedded data. Otherwise, `.aux` will automatically be added to the end of the filename.
     *
     * @example Download all the bots in the "abc" dimension as "abcBots.aux".
     * os.downloadBotsAsInitialzationUpdate(getBots(inDimension("abc")), "abcBots");
     *
     * @example Download the current bot as "currentBot.aux".
     * os.downloadBotsAsInitialzationUpdate([bot], "currentBot");
     *
     * @example Download all bots as "myServer.pdf".
     * os.downloadBotsAsInitialzationUpdate(getBots(), "myServer.pdf");
     *
     * @dochash actions/os/files
     * @docname os.downloadBotsAsInitialzationUpdate
     * @docgroup 10-download
     */
    function downloadBotsAsInitialzationUpdate(
        bots: Bot[],
        filename: string
    ): DownloadAction {
        bots = bots.map((b) =>
            isRuntimeBot(b) ? createBot(b.id, b.tags.toJSON(), b.space) : b
        );
        const update = constructInitializationUpdate(
            calcCreateInitalizationUpdate(bots)
        );

        let data = JSON.stringify(getVersion2DownloadState(update));
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
    function getAuxFileForBots(
        bots: Bot[],
        options?: AuxFileOptions
    ): StoredAux {
        const version = options?.version ?? 2;

        if (version === 1) {
            let state: BotsState = {};
            for (let bot of bots) {
                if (isRuntimeBot(bot)) {
                    state[bot.id] = createBot(
                        bot.id,
                        bot.tags.toJSON(),
                        bot.space
                    );
                } else {
                    state[bot.id] = bot;
                }
            }

            return getVersion1DownloadState(state);
        } else {
            bots = bots.map((b) =>
                isRuntimeBot(b) ? createBot(b.id, b.tags.toJSON(), b.space) : b
            );
            const update = constructInitializationUpdate(
                calcCreateInitalizationUpdate(bots)
            );

            return getVersion2DownloadState(update);
        }
    }

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
    function installAuxFile(
        aux: StoredAux,
        mode?: InstallAuxFileMode
    ): Promise<void> {
        const task = context.createTask(true, true);
        const action = calcRemote(
            calcInstallAuxFile(aux, mode ?? 'default'),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, action);
    }

    /**
     * Downloads all of the shared bots into a `.aux` file on the player's computer. The file will have the same name as the inst.
     *
     * Note that this function is almost exactly the same as {@link os.downloadBots}. The only difference is that all bots in the shared space are included and the file is named for you automatically.
     *
     * @example Download the entire inst.
     * os.downloadInst();
     *
     * @dochash actions/os/files
     * @docname os.downloadInst
     * @docgroup 10-download
     */
    function downloadServer(): DownloadAction {
        return downloadBots(
            getBots(bySpace('shared')),
            `${getCurrentServer()}.aux`
        );
    }

    /**
     * Shows the "Upload AUX File" dialog which lets the user select a .aux file to upload to the inst.
     *
     * @example Show the "Upload AUX File" dialog.
     * os.showUploadAuxFile();
     *
     * @dochash actions/os/files
     * @docname os.showUploadAuxFile
     * @docgroup 10-upload
     */
    function showUploadAuxFile(): ShowUploadAuxFileAction {
        return addAction(calcShowUploadAuxFile());
    }

    /**
     * Shows the "Upload Files" dialog which lets the user select some files to upload to the inst.
     * Returns a promise that resolves with the list of files that were uploaded.
     *
     * @example Show the "Upload Files" dialog.
     * const files = await os.showUploadFiles();
     * os.toast("You uploaded " + files.length + " file(s)!");
     *
     * @dochash actions/os/files
     * @docname os.showUploadFiles
     * @docgroup 10-upload
     */
    function showUploadFiles(): Promise<UploadedFile[]> {
        const task = context.createTask();
        const action = calcShowUploadFiles(task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Opens the [QR Code](https://en.wikipedia.org/wiki/QR_code) scanner.
     * While open, each scanned QR Code will send a {@tag @onQRCodeScanned} shout.
     * Optionally accepts which camera to use for scanning. (front/back)
     *
     * @param camera a string specifing which camera to use. Defaults to 'rear'. If the given camera type is not available, then the default camera will be used. Possible values are `"rear"` and "`front`".
     *
     * @example Open the QR Code scanner.
     * os.openQRCodeScanner();
     *
     * @example Open the QR Code scanner for the front-facing camera.
     * os.openQRCodeScanner("front");
     *
     * @dochash actions/os/barcodes
     * @docname os.openQRCodeScanner
     * @docgroup 10-qr-code-scanner
     */
    function openQRCodeScanner(camera?: CameraType): OpenQRCodeScannerAction {
        const event = calcOpenQRCodeScanner(true, camera);
        return addAction(event);
    }

    /**
     * Closes the QR Code scanner.
     *
     * @example Close the QR Code scanner.
     * os.closeQRCodeScanner();
     *
     * @dochash actions/os/barcodes
     * @docname os.closeQRCodeScanner
     * @docgroup 10-qr-code-scanner
     */
    function closeQRCodeScanner(): OpenQRCodeScannerAction {
        const event = calcOpenQRCodeScanner(false);
        return addAction(event);
    }

    /**
     * Shows a [QR Code](https://en.wikipedia.org/wiki/QR_code) for the given data.
     *
     * @param code the text or data that the generated QR Code should represent.
     *
     * @example Show a QR Code that contains the data "hello".
     * os.showQRCode("hello");
     *
     * @example Show a QR Code that links to https://example.com
     * os.showQRCode("https://example.com")
     *
     * @dochash actions/os/barcodes
     * @docname os.showQRCode
     * @docgroup 10-qr-code
     */
    function showQRCode(code: string): ShowQRCodeAction {
        const event = calcShowQRCode(true, code);
        return addAction(event);
    }

    /**
     * Closes the QR Code popup modal.
     *
     * @example Hides the QR Code popup modal.
     * os.hideQRCode();
     *
     * @dochash actions/os/barcodes
     * @docname os.hideQRCode
     * @docgroup 10-qr-code
     */
    function hideQRCode(): ShowQRCodeAction {
        const event = calcShowQRCode(false);
        return addAction(event);
    }

    /**
     * Generates a [QR Code](https://en.wikipedia.org/wiki/QR_code) for the given data and returns a [Data URL](https://developer.mozilla.org/en-US/docs/web/http/basics_of_http/data_urls) that can be used in an img tag or as a {@tag formAddress}.
     *
     * Returns a promise that resolves with the data URL string.
     *
     * @param code the text or data that the generated QR Code should represent.
     * @param options the options that should be used when generating the QR Code.
     *
     * @example Generate a QR Code that contains the data "hello".
     * const qrCodeUrl = await os.generateQRCode("hello");
     * masks.formAddress = qrCodeUrl;
     *
     * @example Generate a QR Code that links to https://example.com
     * const qrCodeUrl = await os.generateQRCode("https://example.com");
     * masks.formAddress = qrCodeUrl;
     *
     * @example Generate a QR Code with custom colors.
     * const qrCodeUrl = await os.generateQRCode("Custom QR Code", {
     *   color: {
     *    dark: "#0000FFFF",
     *    light: "#FFFF00FF"
     *   }
     * });
     * masks.formAddress = qrCodeUrl;
     *
     * @dochash actions/os/barcodes
     * @docname os.generateQRCode
     * @docgroup 10-qr-code
     */
    function generateQRCode(
        code: string,
        options?: GenerateQRCodeOptions
    ): Promise<string> {
        const task = context.createTask();
        const event = calcGenerateQRCode(code, options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Opens the [Barcode](https://en.wikipedia.org/wiki/Barcode) scanner.
     * While open, each scanned Barcode will send a {@tag @onBarcodeScanned} shout. Optionally accepts which camera to use for scanning. (front/back)
     *
     * @param camera a string specifing which camera to use. Defaults to 'rear'. If the given camera type is not available, then the default camera will be used. Possible values are `"rear"` and "`front`".
     *
     * @example Open the Barcode scanner.
     * os.openBarcodeScanner();
     *
     * @example Open the Barcode scanner for the front-facing camera.
     * os.openBarcodeScanner("front");
     *
     * @dochash actions/os/barcodes
     * @docname os.openBarcodeScanner
     * @docgroup 10-barcode-scanner
     */
    function openBarcodeScanner(camera?: CameraType): OpenBarcodeScannerAction {
        const event = calcOpenBarcodeScanner(true, camera);
        return addAction(event);
    }

    /**
     * Closes the barcode scanner.
     *
     * @example Close the Barcode scanner.
     * os.closeBarcodeScanner();
     *
     * @dochash actions/os/barcodes
     * @docname os.closeBarcodeScanner
     * @docgroup 10-barcode-scanner
     */
    function closeBarcodeScanner(): OpenBarcodeScannerAction {
        const event = calcOpenBarcodeScanner(false);
        return addAction(event);
    }

    /**
     * Shows a [Barcode](https://en.wikipedia.org/wiki/Barcode) for the given data.
     * Optionally accepts the format that the barcode should be displayed in.
     *
     * @param code the text or data that the generated Barcode should represent.
     * @param format the format that the barcode should be displayed in. Defaults to `"code128"`
     *
     * @example Show a Barcode that contains the data "hello".
     * os.showBarcode("hello");
     *
     * @example Show a UPC Barcode that contains the data "123456".
     * os.showBarcode("123456", 'upc');
     *
     * @dochash actions/os/barcodes
     * @docname os.showBarcode
     * @docgroup 10-barcode
     * @docorder 0
     */
    function showBarcode(
        code: string,
        format?: BarcodeFormat
    ): ShowBarcodeAction {
        const event = calcShowBarcode(true, code, format);
        return addAction(event);
    }

    /**
     * Closes the Barcode popup modal.
     *
     * @example Hides the Barcode popup modal.
     * os.hideBarcode();
     *
     * @dochash actions/os/barcodes
     * @doctitle Barcode Actions
     * @docsidebar Barcodes
     * @docdescription Actions for scanning and displaying QR Codes and Barcodes.
     * @docname os.hideBarcode
     * @docgroup 10-barcode
     */
    function hideBarcode(): ShowBarcodeAction {
        const event = calcShowBarcode(false);
        return addAction(event);
    }

    /**
     * Opens the [image classifier](glossary:image-classification) with the given options. Returns a promise that resolves once the image classifier has been opened.
     *
     * Sends the {@tag @onImageClassifierOpened} shout once opened and the {@tag @onImageClassified} shout every time an image has been classified.
     *
     * @param options the options that should be used for the image classifier.
     *
     * @example Open the image classifier.
     * await os.openImageClassifier({
     *     modelUrl: 'MY_MODEL_URL'
     * });
     *
     * @example Open the image classifier with a specific camera.
     * await os.openImageClassifier({
     *     modelUrl: 'MY_MODEL_URL',
     *     cameraType: 'front'
     * });
     *
     * @dochash actions/os/image-classification
     * @doctitle Image Classification Actions
     * @docsidebar Image Classification
     * @docdescription Actions for classifying images using AI.
     * @docname os.openImageClassifier
     * @docgroup 10-image-classifier
     * @docorder 0
     */
    function openImageClassifier(
        options: ImageClassifierOptions
    ): Promise<void> {
        const task = context.createTask();
        const action = calcOpenImageClassifier(true, options, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Closes the image classifier.
     * Returns a promise that resolves once the image classifier has been closed.
     *
     * Also sends the {@tag @onImageClassifierClosed} shout once closed.
     *
     * @example Close the image classifier.
     * await os.closeImageClassifier();
     *
     * @dochash actions/os/image-classification
     * @docname os.closeImageClassifier
     * @docgroup 10-image-classifier
     */
    function closeImageClassifier(): Promise<void> {
        const task = context.createTask();
        const action = calcOpenImageClassifier(false, {}, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Classifies the given images using the image classifier. Returns a promise that resolves with the results of the classification.
     *
     * @param options the options that should be used for the image classification.
     *
     * @example Classify the given images.
     * const files = await os.showUploadFiles()
     * const classify = await os.classifyImages({
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
    function classifyImages(
        options: ClassifyImagesOptions
    ): Promise<ClassifyImagesResult> {
        const task = context.createTask();
        const action = calcOpenClassifyImages(options, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Opens the photo camera. Returns a promise that resolves once the camera has been opened. Triggers the {@tag @onPhotoCameraOpened} shout once opened.
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
    function openPhotoCamera(options?: OpenPhotoCameraOptions): Promise<void> {
        const task = context.createTask();
        const action = calcOpenPhotoCamera(true, false, options, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Opens the photo camera for the user to take a single photo. Returns a promise that resolves with the taken photo. Triggers the {@tag @onPhotoCameraOpened} shout once opened.
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
     * @example Take a single photo, skipping the confirmation user step.
     * await os.capturePhoto({
     *    skipConfirm: true
     * });
     *
     * @example Take a single photo after a 3 second delay.
     * await os.capturePhoto({
     *    takePhotoAfterSeconds: 3
     * });
     *
     * @dochash actions/os/camera
     * @doctitle Camera Actions
     * @docsidebar Camera
     * @docdescription Actions for taking photos.
     * @docname os.capturePhoto
     */
    function capturePhoto(options?: OpenPhotoCameraOptions): Promise<Photo> {
        const task = context.createTask();
        const action = calcOpenPhotoCamera(true, true, options, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Closes the photo camera. Returns a promise that resolves once the camera has been closed. Triggers the {@tag @onPhotoCameraClosed} shout once closed.
     *
     * @example Close the photo camera
     * await os.closePhotoCamera();
     *
     * @dochash actions/os/camera
     * @docname os.closePhotoCamera
     */
    function closePhotoCamera(): Promise<void> {
        const task = context.createTask();
        const action = calcOpenPhotoCamera(
            false,
            false,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, action);
    }

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
     * @example Display a screenshot from the grid portal on a bot.
     * const screenshot = await os.capturePortalScreenshot();
     * masks.formAddress = bytes.toBase64Url(await screenshot.data.arrayBuffer());
     *
     * @dochash actions/os/portals
     * @docname os.capturePortalScreenshot
     */
    function capturePortalScreenshot(): Promise<Photo> {
        const task = context.createTask();
        const action = calcCapturePortalScreenshot('grid', task.taskId);
        return addAsyncAction(task, action);
    }

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
    function loadServer(id: string): LoadServerAction | void;
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
    function loadServer(config: InstConfig): LoadServerConfigAction | void;
    function loadServer(
        idOrConfig: string | InstConfig
    ): LoadServerAction | LoadServerConfigAction | void {
        if (typeof idOrConfig === 'string') {
            if (!context.playerBot) {
                return addAction(loadSimulation(idOrConfig));
            }
            const list = calculateStringListTagValue(
                null,
                context.playerBot,
                'inst',
                []
            );
            if (list.indexOf(idOrConfig) < 0) {
                setTag(context.playerBot, 'inst', [...list, idOrConfig]);
            }
        } else {
            // The are different in static, owner, or record
            return addAction(loadSimulation(idOrConfig));
        }
    }

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
    function unloadServer(id: string): UnloadServerAction | void;
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
    function unloadServer(config: InstConfig): UnloadServerConfigAction | void;
    function unloadServer(
        idOrConfig: string | InstConfig
    ): UnloadServerAction | UnloadServerConfigAction | void {
        if (typeof idOrConfig === 'string') {
            if (!context.playerBot) {
                return addAction(unloadSimulation(idOrConfig));
            }
            const list = calculateStringListTagValue(
                null,
                context.playerBot,
                'inst',
                []
            );
            const index = list.indexOf(idOrConfig);
            if (index >= 0) {
                list.splice(index, 1);
                setTag(context.playerBot, 'inst', list.slice());
            }
        } else {
            return addAction(unloadSimulation(idOrConfig));
        }
    }

    /**
     * Imports an AUX file from the given string.
     *
     * If the string contains JSON, then the JSON will be imported as if it was a .aux file. If the string is a [URL](https://en.wikipedia.org/wiki/URL), then it will be downloaded and imported.
     *
     * This is useful to quickly download a AUX file and load it into the current inst from a site such as https://gist.github.com/.
     *
     * @param urlOrJSON the URL or JSON to load.
     *                  If given JSON, then it will be imported as if it was a `.aux` file.
     *                  If given a URL, then it will be downloaded and then imported.
     *
     * @example Import an AUX file from a file.
     * const path = '/drives/myFile.aux';
     * os.importAUX(path);
     *
     * @example Import an AUX file from JSON.
     * os.importAUX(`{
     *     "version": 1,
     *     "state": {
     *         "079847e4-6a58-423d-9a86-8d4ef8be5970": {
     *             "id": "079847e4-6a58-423d-9a86-8d4ef8be5970",
     *             "tags": {
     *                 "color": "red"
     *             }
     *         }
     *     }
     * }`);
     *
     * @dochash actions/os/files
     * @docname os.importAUX
     * @docgroup 10-upload
     */
    function importAUX(urlOrJSON: string): Promise<void> {
        try {
            const aux = parseStoredAuxFromData(urlOrJSON);
            if (aux) {
                if (isStoredVersion2(aux)) {
                    return applyUpdatesToInst(aux.updates);
                } else {
                    const state = getUploadState(aux);
                    if (state) {
                        const event = addState(state);
                        addAction(event);
                        let promise = Promise.resolve();
                        (<any>promise)[ORIGINAL_OBJECT] = event;
                        return promise;
                    }
                }
            }
        } catch {
            // Ignore errors
        }
        const task = context.createTask();
        const event = calcImportAUX(urlOrJSON, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Parses a list of bot mods from the given string of data.
     * The data can be JSON or the contents of a PDF file.
     * Returns an array of mods where each mod has the structure of a bot (i.e. it has `id` and `tags` properties).
     * Returns `null` if the data is not valid JSON or PDF.
     *
     * @param jsonOrPdf the JSON data or the contents of the PDF file that should parsed.
     *
     * @example Parse the list of bots in an \@onFileUpload
     * let bots = os.parseBotsFromData(that.file.data);
     *
     * @dochash actions/os/files
     * @docname os.parseBotsFromData
     * @docgroup 10-download
     */
    function parseBotsFromData(jsonOrPdf: string | ArrayBuffer): Bot[] {
        let data: any;

        if (typeof jsonOrPdf === 'string') {
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
        } else {
            try {
                const str = new TextDecoder().decode(jsonOrPdf);
                data = getEmbeddedBase64FromPdf(str);
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

        const state = getUploadState(data as StoredAux | BotsState);
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
     * Parses the given JSON or PDF data and returns the list of bots that were contained in it.
     * @param jsonOrPdf The JSON or PDF data to parse.
     */
    function parseStoredAuxFromData(
        jsonOrPdf: string | ArrayBuffer
    ): StoredAux {
        let data: any;

        if (typeof jsonOrPdf === 'string') {
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
        } else {
            try {
                const str = new TextDecoder().decode(jsonOrPdf);
                data = getEmbeddedBase64FromPdf(str);
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

        return data as StoredAux;
    }

    /**
     * Replaces the bot that the user is dragging with the given bot.
     *
     * If called when the user is not dragging anything, then the given bot or mod will be dragged using the current input method. When in VR, the current input method is the most recently used VR controller. Otherwise it is the mouse/touchscreen.
     *
     * @param bot the bot that should be dragged. If given a bot while dragging, then that bot's {@tag @onDrag} will be skippped but {@tag @onDrop} will be called. If given a bot when not dragging, then that bot's {@tag @onDrag} and {@tag @onDrop} will be called.
     *
     * @example Drag a clone of this bot.
     * let clone = create(thisBot);
     * os.replaceDragBot(clone);
     *
     * @dochash actions/os/portals
     * @docname os.replaceDragBot
     */
    function replaceDragBot(bot: RuntimeBot): ReplaceDragBotAction {
        const event = calcReplaceDragBot(context.unwrapBot(bot));
        return addAction(event);
    }

    /**
     * Gets whether the given dimension is loaded into the {@tag gridPortal} portal.
     *
     * @param dimension the dimension to check for.
     *
     * @example Show a toast if the player is viewing the abc dimension.
     * if (os.isInDimension("abc")) {
     *     os.toast("In the dimension!");
     * }
     *
     * @dochash actions/os/portals
     * @docname os.isInDimension
     * @docgroup 10-config-values
     */
    function isInDimension(dimension: string): boolean {
        return (
            getCurrentDimension() === dimension &&
            getCurrentDimension() != undefined
        );
    }

    /**
     * Gets the dimension that is loaded into the {@tag gridPortal} portal.
     *
     * > This function behaves exactly like {@link os.getPortalDimension} when given "gridPortal".
     *
     * @example Show a message of the dimension that is currently in the #gridPortal portal.
     * const dimension = os.getCurrentDimension();
     * os.toast(dimension);
     *
     * @dochash actions/os/portals
     * @doctitle Portal Actions
     * @docsidebar Portals
     * @docdescription Actions for working with portals.
     * @docname os.getCurrentDimension
     * @docgroup 10-config-values
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
     * Gets the inst that is loaded.
     *
     * @example Show a message of the current inst.
     * const inst = os.getCurrentInst();
     * os.toast(inst);
     *
     * @dochash actions/os/portals
     * @docname os.getCurrentInst
     * @docgroup 10-config-values
     */
    function getCurrentServer(): string {
        const user = context.playerBot;
        if (user) {
            let inst =
                getTag(user, 'inst') ??
                getTag(user, 'staticInst') ??
                getTag(user, 'tempInst');
            if (hasValue(inst)) {
                if (Array.isArray(inst)) {
                    return inst[0].toString();
                }
                return inst.toString();
            }
            return undefined;
        }
        return undefined;
    }

    /**
     * Gets the record that the inst was loaded from.
     * Null if the inst is local or public.
     *
     * @dochash actions/os/portals
     * @docname os.getCurrentInstRecord
     * @docgroup 10-config-values
     */
    function getCurrentInstRecord(): string | null {
        const user = context.playerBot;
        if (user) {
            return getTag(user, 'record') ?? null;
        }

        return null;
    }

    /**
     * Gets the dimension that is loaded into the #miniGridPortal portal.
     *
     * > This function behaves exactly like {@link os.getPortalDimension} when given "miniGridPortal".
     *
     * @example Show a message of the dimension that is currently in the #miniGridPortal portal.
     * const dimension = os.getMiniPortalDimension();
     * os.toast(dimension);
     *
     * @dochash actions/os/portals
     * @docname os.getMiniPortalDimension
     * @docgroup 10-config-values
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
     * Gets the dimension that is loaded into the {@tag menuPortal} portal.
     *
     * > This function behaves exactly like {@link os.getPortalDimension} when given "menuPortal".
     *
     * @example Show a message of the dimension that is currently in the #menuPortal portal.
     * const dimension = os.getMenuDimension();
     * os.toast(dimension);
     *
     * @dochash actions/os/portals
     * @docname os.getMenuDimension
     * @docgroup 10-config-values
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
     * Gets the dimension that is loaded into the given portal.
     * If no dimension is loaded, then `null` is returned.
     *
     * @param portal the portal that the dimension should be retrieved for
     *
     * @example Get the dimension that is currently showing in the #gridPortal.
     * const dimension = os.getPortalDimension('grid');
     *
     * @example Get the dimension that is currently showing in the #miniGridPortal.
     * const dimension = os.getPortalDimension('miniGrid');
     *
     * @dochash actions/os/portals
     * @docname os.getPortalDimension
     * @docgroup 10-config-values
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
     * Returns `0` if the player bot is in the dimension, `1` if the dimension is in a portal, and `-1` if neither are true.
     *
     * @param dimension The dimension to check for.
     *
     * @example Get the distance to the "fun" dimension.
     * const distance = os.getDimensionalDepth("fun");
     * if (distance === 0) {
     *     os.toast("Player is in the fun dimension");
     * } else if(distance === 1) {
     *     os.toast("Player is viewing the fun dimension");
     * } else {
     *     os.toast("Player cannot access the fun dimension");
     * }
     *
     * @dochash actions/os/portals
     * @docname os.getDimensionalDepth
     * @docgroup 10-config-values
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
     * Shows an input modal for the given bot and tag with the given options.
     * When shown, the player will be able to change the value stored in the given tag.
     * Triggers the {@tag @onSaveInput} whisper when the modal is closed with saving and the {@tag @onCloseInput} whisper when the modal is closed without saving.
     *
     * @param bot the bot or bot ID that the input should be shown for.
     * @param tag the tag that should be edited on the bot.
     * @param options the possible cusomization options for the input modal.
     *
     * @example Show a basic text input modal for the #name tag on this bot.
     * os.showInputForTag(this, "name");
     *
     * @example Show a text input modal with a placeholder for the #name tag.
     * os.showInputForTag(this, "name", {
     *     placeholder: 'Enter a name'
     * });
     *
     * @example Show a input modal with a custom title.
     * os.showInputForTag(this, "name", {
     *     title: 'Edit name'
     * });
     *
     * @example Show a color input modal with a custom title.
     * os.showInputForTag(this, "color", {
     *     type: 'color',
     *     title: 'Enter a custom color'
     * });
     *
     * @dochash actions/os/portals
     * @docname os.showInputForTag
     * @docgroup 10-showInput
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
     * Shows an input modal with the given value and options. When shown, the player will be able to change the value.
     *
     * Returns a Promise that resolves with the final value when the user is finished editing.
     * This function is similar to {@link os.showInputForTag} except it doesn't require a bot and a tag.
     *
     * @param currentValue the value that should be shown in the input modal.
     * @param options the options that indicate how the input box should be customized.
     *
     * @example Show a basic text input modal and displays a toast message with the input value.
     * const value = await os.showInput();
     * os.toast(value);
     *
     * @example Show a text input modal with a placeholder.
     * const name = await os.showInput(null, {
     *     placeholder: 'Enter a name'
     * });
     * os.toast(name);
     *
     * @example Show a input modal with a custom title.
     * const name = await os.showInput('My Name', {
     *     title: 'Edit name'
     * });
     * os.toast(name);
     *
     * @example Show a color input modal with a custom title.
     * const color = await os.showInput('green', {
     *     type: 'color',
     *     title: 'Enter a custom color'
     * });
     * os.toast(color);
     *
     * @example Show an input for entering secrets (like passwords).
     * const secret = await os.showInput('', {
     *     type: 'secret',
     *     title: 'Enter a secret key'
     * });
     * os.toast(secret);
     *
     * @example Show an input for entering dates.
     * const date = await os.showInput('', {
     *     type: 'date',
     *     title: 'Enter a date'
     * });
     * os.toast(date);
     *
     * @example Show an input with a list of options.
     * // Null means nothing is selected
     * // To pre-select an item, pass in the index of the item you want selected.
     * const selectedItem = await os.showInput(null, {
     *     title: 'Select your favorite superhero',
     *     type: 'list',
     *     placeholder: 'Superhero',
     *     items: [
     *         {
     *             label: 'Superman',
     *             value: 1
     *         },
     *         {
     *             label: 'Iron Man',
     *             value: 2
     *         },
     *         {
     *             label: 'Batman',
     *             value: 3
     *         },
     *         {
     *             label: 'Wonder Woman',
     *             value: 4
     *         }
     *     ]
     * });
     * os.toast(selectedItem);
     *
     * @example Show an input with a list of checkboxes.
     * // Empty array means nothing is selected.
     * // To pre-select items, pass in an array with the indexes of the items you want selected.
     * const selectedItems = await os.showInput([], {
     *     title: 'Check your favorite superheroes',
     *     type: 'list',
     *     subtype: 'checkbox',
     *     items: [
     *         {
     *             label: 'Superman',
     *             value: 1
     *         },
     *         {
     *             label: 'Iron Man',
     *             value: 2
     *         },
     *         {
     *             label: 'Batman',
     *             value: 3
     *         },
     *         {
     *             label: 'Wonder Woman',
     *             value: 4
     *         }
     *     ]
     * });
     * os.toast(selectedItems);
     *
     * @example Show an input with a dropdown of checkboxes.
     * // Empty array means nothing is selected.
     * // To pre-select items, pass in an array with the indexes of the items you want selected.
     * const selectedItems = await os.showInput([], {
     *     title: 'Select your favorite superheroes',
     *     type: 'list',
     *     subtype: 'multiSelect',
     *     placeholder: 'Superhero',
     *     items: [
     *         {
     *             label: 'Superman',
     *             value: 1
     *         },
     *         {
     *             label: 'Iron Man',
     *             value: 2
     *         },
     *         {
     *             label: 'Batman',
     *             value: 3
     *         },
     *         {
     *             label: 'Wonder Woman',
     *             value: 4
     *         }
     *     ]
     * });
     * os.toast(selectedItems);
     *
     * @example Show an input with a list of radio buttons.
     * // Null means nothing is selected.
     * // To pre-select an item, pass in the index of the item you want selected.
     * const selectedItem = await os.showInput(null, {
     *     title: 'Check your favorite superheroe',
     *     type: 'list',
     *     subtype: 'radio',
     *     placeholder: 'Superhero',
     *     items: [
     *         {
     *             label: 'Superman',
     *             value: 1
     *         },
     *         {
     *             label: 'Iron Man',
     *             value: 2
     *         },
     *         {
     *             label: 'Batman',
     *             value: 3
     *         },
     *         {
     *             label: 'Wonder Woman',
     *             value: 4
     *         }
     *     ]
     * });
     * os.toast(selectedItem);
     *
     * @dochash actions/os/portals
     * @docname os.showInput
     * @docgroup 10-showInput
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
     * Shows a confirmation dialog using the given options. Confirmation dialogs are useful for giving users the ability to quickly confirm or cancel an action.
     *
     * Returns a promise that resolves with `true` if the user clicked the "Confirm" button and `false` if they closed the dialog or clicked the "Cancel" button.
     *
     * @param options the options that should be used for the confirmation dialog.
     *
     * @example Show a confirmation dialog
     * let confirmed = await os.showConfirm({
     *     title: 'Confirm',
     *     content: 'Please confirm the action.'
     * });
     *
     * os.toast('Confirmed: ' + (confirmed ? 'Yes' : 'No'));
     *
     * @example Show a confirmation dialog with custom button text
     * let confirmed = await os.showConfirm({
     *     title: 'Confirm',
     *     content: 'Are you sure?',
     *     confirmText: 'Yes',
     *     cancelText: 'No'
     * });
     *
     * os.toast('Confirmed: ' + (confirmed ? 'Yes' : 'No'));
     *
     * @dochash actions/os/portals
     * @docname os.showConfirm
     * @docgroup 10-showInput
     */
    function showConfirm(options: ShowConfirmOptions): Promise<boolean> {
        if (!options) {
            throw new Error(
                'You must provide an options object for os.showConfirm()'
            );
        }
        const task = context.createTask();
        const event = calcShowConfirm(options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Shows an alert dialog using the given options. Alert dialogs are useful for displaying information that needs to be manually dismissed by the user.
     *
     * Returns a promise that resolves when the user dismisses the alert.
     *
     * @param options the options that should be used for the alert dialog.
     *
     * @example Show a basic alert
     * await os.showAlert({
     *     title: 'Alert',
     *     content: 'This is an important message.'
     * });
     *
     * os.toast('Alert dismissed');
     *
     * @example Show an alert with custom button text
     * await os.showAlert({
     *     title: 'Warning',
     *     content: 'Please read this carefully.',
     *     dismissText: 'Got it'
     * });
     *
     * @dochash actions/os/portals
     * @docname os.showAlert
     * @docgroup 10-showInput
     */
    function showAlert(options: ShowAlertOptions): Promise<void> {
        if (!options) {
            throw new Error(
                'You must provide an options object for os.showAlert()'
            );
        }
        const task = context.createTask();
        const event = calcShowAlert(options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Loads the given dimension into the {@tag gridPortal} portal. Triggers the {@tag @onPortalChanged} shout for the gridPortal.
     * @param dimension the dimension that should be loaded.
     *
     * @example Load the abc dimension.
     * os.goToDimension("abc");
     *
     * @dochash actions/os/portals
     * @docname os.goToDimension
     * @docgroup 10-go-to
     */
    function goToDimension(dimension: string): GoToDimensionAction {
        const event = calcGoToDimension(dimension);
        return addAction(event);
    }

    /**
     * Redirects the current tab to the given URL. Useful for sending the player to another webpage or ambient experience.
     *
     * @param url the [URL](https://en.wikipedia.org/wiki/URL) that the player should be sent to. Usually this is a website like `https://example.com`.
     *
     * @example Send the player to https://example.com.
     * os.goToURL("https://example.com");
     *
     * @dochash actions/os/portals
     * @docname os.goToURL
     * @docgroup 10-go-to
     */
    function goToURL(url: string): GoToURLAction {
        const event = calcGoToURL(url);
        return addAction(event);
    }

    /**
     * Opens a new tab with the given URL. Useful for opening another webpage without redirecting the current tab.
     *
     * @param url the [URL](https://en.wikipedia.org/wiki/URL) that the player should be sent to. Usually this is a website like `https://example.com`.
     *
     * @example Open https://example.com in a new tab.
     * os.openURL("https://example.com");
     *
     * @dochash actions/os/portals
     * @docname os.openURL
     * @docgroup 10-go-to
     */
    function openURL(url: string): OpenURLAction {
        const event = calcOpenURL(url);
        return addAction(event);
    }

    /**
     * Tells CasualOS to sync the given list of config bot tags in the URL query.
     *
     * @param tags The tags that should be synced to the URL.
     * @param fullHistory Whether the a history entry should be created for every change to these tags. If false, then the URL will be updated but no additional history entries will be created. If true, then each change to the parameters will create a new history entry. Defaults to true.
     *
     * @example Sync the "page" config bot tag to the URL
     * os.syncConfigBotTagsToURL(['page']);
     *
     * @example Sync the "scrollPosition" config bot tag to the URL, but don't create a history entry for every change
     * os.syncConfigBotTagsToURL(['scrollPosition'], false);
     *
     * @dochash actions/os/portals
     * @docname os.syncConfigBotTagsToURL
     * @docgroup 10-go-to
     */
    function syncConfigBotTagsToURL(
        tags: string[],
        fullHistory: boolean = true
    ): TrackConfigBotTagsAction {
        const event = calcTrackConfigBotTags(tags, fullHistory);
        return addAction(event);
    }

    /**
     * Instructs CasualOS to open the built-in developer console.
     * The dev console provides easy access to error messages and debug logs for formulas and actions.
     *
     * @example Open the developer console.
     * os.openDevConsole();
     *
     * @dochash actions/os/system
     * @docname os.openDevConsole
     * @docgroup 12-dev
     */
    function openDevConsole(): OpenConsoleAction {
        const event = openConsole();
        return addAction(event);
    }

    /**
     * Loads and plays the audio (MP3, WAV, etc.) from the given URL.
     *
     * Returns a promise that resolves with the ID of the sound when the sound starts playing. The sound ID can then be used with {@link os.cancelSound} to stop the sound.
     *
     * @param url the [URL](https://en.wikipedia.org/wiki/URL) of the audio/music/sound clip that should be played.
     *
     * @example Play a MP3 file from another website.
     * os.playSound("https://www.testsounds.com/track06.mp3");
     *
     * @dochash actions/os/audio
     * @doctitle Audio Actions
     * @docsidebar Audio
     * @docdescription Actions for working with audio and sound files.
     * @docname os.playSound
     * @docgroup 10-sound
     */
    function playSound(url: string) {
        const task = context.createTask();
        const event = calcPlaySound(url, task.taskId, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Loads the audio from the given URL without playing it. Returns a promise that resolves once the sound has been loaded.
     *
     * This is useful for pre-loading a sound so that there will be no delay when playing it with {@link os.playSound}.
     *
     * @param url the [URL](https://en.wikipedia.org/wiki/URL) of the audio/music/sound clip that should be loaded.
     *
     * @example Pre-load a MP3 file from another website.
     * os.bufferSound("https://www.testsounds.com/track06.mp3");
     *
     * @dochash actions/os/audio
     * @docname os.bufferSound
     * @docgroup 10-sound
     */
    function bufferSound(url: string) {
        const task = context.createTask();
        const event = calcBufferSound(url, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Cancels the sound with the given ID. Returns a promise that resolves once the sound has been canceled.
     *
     * @param soundId the ID of the sound that was returned from {@link os.playSound}.
     *
     * @example Cancel a sound that is playing.
     * const id = await os.playSound("https://www.testsounds.com/track06.mp3");
     * os.cancelSound(id);
     *
     * @dochash actions/os/audio
     * @docname os.cancelSound
     * @docgroup 10-sound
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
     * Determines if the given bot is in the dimension that is currently loaded into the {@tag miniGridPortal} portal.
     *
     * @param bots the bot or bots that should be checked.
     *
     * @example Show a message if a bot named "bob" is in the miniGridPortal.
     * const bob = getBot("#name", "bob");
     * if (os.hasBotInMiniPortal(bob)) {
     *     os.toast("bob is in the miniGridPortal!");
     * }
     *
     * @dochash actions/os/portals
     * @docname os.hasBotInMiniPortal
     * @docgroup 10-config-values
     */
    function hasBotInMiniPortal(bots: Bot | Bot[]): boolean {
        if (!Array.isArray(bots)) {
            bots = [bots];
        }
        let miniGridPortal = getMiniPortalDimension();
        if (!hasValue(miniGridPortal)) {
            return false;
        }
        return bots.every((f) => getTag(f, miniGridPortal) === true);
    }

    /**
     * Shares the given URL or text via the device's social share capabilities. Returns a Promise that resolves when sharing has succeeded or failed.
     *
     * @param options the options for sharing.
     *
     * @example Share a URL.
     * os.share({
     *     url: 'https://example.com'
     * });
     *
     * @example Share some text.
     * os.share({
     *     text: 'abcdefghijklmnopqrstuvwxyz'
     * });
     *
     * @dochash actions/os/input
     * @docname os.share
     */
    function share(options: ShareOptions): Promise<void> {
        const task = context.createTask();
        const event = calcShare(options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Causes a circular wipe animation to close around the screen.
     * This can be used to cover the grid portal while transitioning between scenes.
     * Returns a promise that resolves when the animation has finished running.
     * The promise will throw an exception if {@link os.openCircleWipe} is called while the animation is running.
     *
     * @param options the options that should be used for the effect.
     *
     * @example Hide the grid portal with a circular wipe animation.
     * await os.closeCircleWipe();
     * os.toast("Hidden!");
     *
     * @example Hide the grid portal and show it after an additional second.
     * await os.closeCircleWipe();
     * await os.sleep(1000);
     * await os.openCircleWipe();
     *
     * @example Use a custom color for the circle wipe.
     * await os.closeCircleWipe({
     *     color: '#63f1aa'
     * });
     *
     * @example Make the circle wipe take 5 seconds to complete.
     * await os.closeCircleWipe({
     *     duration: 5
     * });
     *
     * @dochash actions/os/portals
     * @docname os.closeCircleWipe
     * @docgroup 10-circle-wipe
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
     * Causes the circular wipe animation to open around the screen.
     * This can be used to reveal the grid portal after transitioning between screens.
     * Returns a promise that resolves when the animation has finished running.
     * The promise will throw an exception if {@link os.closeCircleWipe} is called while the animation is running.
     *
     * @param options the options that should be used for the effect.
     *
     * @example Reveal the grid portal with a circular wipe animation.
     * await os.openCircleWipe();
     * os.toast("Revealed!");
     *
     * @example Hide the grid portal and show it after an additional second.
     * await os.closeCircleWipe();
     * await os.sleep(1000);
     * await os.openCircleWipe();
     *
     * @example Use a custom color for the circle wipe.
     * await os.openCircleWipe({
     *     color: '#63f1aa'
     * });
     *
     * @example Make the circle wipe take 5 seconds to complete.
     * await os.openCircleWipe({
     *     duration: 5
     * });
     *
     * @dochash actions/os/portals
     * @docname os.openCircleWipe
     * @docgroup 10-circle-wipe
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
     * Specifies a list of snap targets that can be used to position the currently dragged bot.
     *
     * If called when the user is not dragging anything, then this function does nothing.
     *
     * @param targets The list of snap targets to add.
     *
     * @example Snap the dragged bot to the grid.
     * os.addDropSnap("grid");
     *
     * @example Snap the dragged bot to other bot faces.
     * os.addDropSnap("face");
     *
     * @example Snap the dragged bot to a point.
     * os.addDropSnap({
     *     position: {
     *         x: 0,
     *         y: 0,
     *         z: 3,
     *     },
     *     distance: 1
     * });
     *
     * @example Snap the dragged bot to the global X axis.
     * os.addDropSnap({
     *     direction: {
     *         x: 1,
     *         y: 0,
     *         z: 0,
     *     },
     *     origin: {
     *         x: 0,
     *         y: 0,
     *         z: 0
     *     },
     *     distance: 2
     * });
     *
     * @example Snap the dragged bot to the center or bot faces.
     * os.addDropSnap({
     *     position: {
     *         x: 0,
     *         y: 0,
     *         z: 0,
     *     },
     *     distance: 1
     * }, "face");
     *
     * @dochash actions/os/portals
     * @docname os.addDropSnap
     */
    function addDropSnap(...targets: SnapTarget[]): AddDropSnapTargetsAction {
        return addAction(calcAddDropSnap(null, targets));
    }

    /**
     * Specifies a list of snap targets that can be used to position the currently dragged bot when it is being dropped on the given bot. This function is useful for making some bots act like a "selector" or mask for drop areas.
     *
     * If called when the user is not dragging anything, then this function does nothing.
     *
     * @param bot the bot which, when the dragged bot is being dropped onto it (as indicated by {@tag @onDropEnter}/{@tag @onDropExit}), the specified snap targets will take effect.
     * @param targets the snap targets that should be enabled when the bot is being dropped on.
     *
     * @example Snap the dragged bot to the grid when it is being dropped on this bot.
     * os.addBotDropSnap(thisBot, "grid");
     *
     * @example Snap the dragged bot to this bot's faces.
     * os.addBotDropSnap(thisBot, "face");
     *
     * @example Snap the dragged bot to a point when it is being dropped on this bot.
     * os.addBotDropSnap(thisBot, {
     *     position: {
     *         x: 0,
     *         y: 0,
     *         z: 3,
     *     },
     *     distance: 1
     * });
     *
     * @example Snap the dragged bot to the center or bot faces when it is being dropped on this bot.
     * os.addBotDropSnap(thisBot, {
     *     position: {
     *         x: 0,
     *         y: 0,
     *         z: 0,
     *     },
     *     distance: 1
     * }, "face");
     *
     * @dochash actions/os/portals
     * @docname os.addBotDropSnap
     */
    function addBotDropSnap(
        bot: RuntimeBot | string,
        ...targets: SnapTarget[]
    ): AddDropSnapTargetsAction {
        return addAction(calcAddDropSnap(getID(bot), targets));
    }

    /**
     * Specifies a list of grids that can be used to position the currently dragged bot.
     *
     * If called when the user is not dragging anything, then this function does nothing.
     *
     * @param targets the list of grids to add.
     *
     * @example Add a grid for the portal that the bot currently exists in.
     * os.addDropGrid({});
     *
     * @example Add a grid with a 60 degree X rotation.
     * os.addDropGrid({
     *     position: { x: 0, y: 0, z: 0 },
     *     rotation: { x: 60 * (Math.PI / 180), y: 0, z: 0 },
     * });
     *
     * @example Add a grid for a specific portal bot.
     * os.addDropGrid({
     *     portalBot: getBot(byTag('form', 'portal'), byTag('formAddress', 'myDimension')),
     * });
     *
     * @example Add a grid with a custom size.
     * os.addDropGrid({
     *     position: { x: 0, y: 0, z: 3 },
     *     bounds: { x: 20, y: 10 }
     * });
     *
     * @example Add a grid that the user can see.
     * os.addDropGrid({
     *     position: { x: 0, y: 0, z: 3 },
     *     showGrid: true
     * });
     *
     * @example Add multiple grids with custom priorities
     * os.addDropGrid({
     *     position: { x: 0, y: 0, z: 3 },
     *     bounds: { x: 10, y: 10 },
     *     showGrid: true,
     *     priority: 10
     * }, {
     *     position: { x: 0, y: 0, z: 0 },
     *     bounds: { x: 20, y: 20 },
     *     showGrid: true,
     *     priority: 20
     * });
     *
     * @example Add a spherical grid that the user can see.
     * os.addDropGrid({
     *     type: "sphere",
     *     position: { x: 0, y: 0, z: 3 },
     *     showGrid: true
     * });
     *
     * @dochash actions/os/portals
     * @docname os.addDropGrid
     */
    function addDropGrid(
        ...targets: SnapGridTarget[]
    ): AddDropGridTargetsAction {
        return addAction(calcAddDropGrid(null, mapSnapGridTargets(targets)));
    }

    /**
     * Specifies a list of grids that can be used to position the currently dragged bot when it is being dropped on the given bot.
     *
     * If called when the user is not dragging anything, then this function does nothing.
     *
     * @param bot the bot which, when the dragged bot is being dropped onto it (as indicated by {@tag @onDropEnter}/{@tag @onDropExit}), the specified snap targets will take effect.
     * @param targets the list of grids to add.
     *
     * @example Add a grid for the portal that the bot currently exists in when it is being dropped on this bot.
     * os.addDropGrid(thisBot, {});
     *
     * @example Add a grid with a 60 degree X rotation when it is being dropped on this bot.
     * os.addBotDropGrid(thisBot, {
     *     position: { x: 0, y: 0, z: 0 },
     *     rotation: { x: 60 * (Math.PI / 180), y: 0, z: 0 },
     * });
     *
     * @example Add a grid for a specific portal bot when it is being dropped on this bot.
     * os.addBotDropGrid(thisBot, {
     *     portalBot: getBot(byTag('form', 'portal'), byTag('formAddress', 'myDimension')),
     * });
     *
     * @example Add a grid with a custom size when it is being dropped on this bot.
     * os.addBotDropGrid(thisBot, {
     *     position: { x: 0, y: 0, z: 3 },
     *     bounds: { x: 20, y: 10 }
     * });
     *
     * @example Add a grid that the user can see when it is being dropped on this bot.
     * os.addBotDropGrid(thisBot, {
     *     position: { x: 0, y: 0, z: 3 },
     *     showGrid: true
     * });
     *
     * @example Add multiple grids with custom priorities when it is being dropped on this bot.
     * os.addBotDropGrid(thisBot, {
     *     position: { x: 0, y: 0, z: 3 },
     *     bounds: { x: 10, y: 10 },
     *     showGrid: true,
     *     priority: 10
     * }, {
     *     position: { x: 0, y: 0, z: 0 },
     *     bounds: { x: 20, y: 20 },
     *     showGrid: true,
     *     priority: 20
     * });
     *
     * @example Add a spherical grid that the user can see.
     * os.addBotDropGrid(thisBot, {
     *     type: "sphere",
     *     position: { x: 0, y: 0, z: 3 },
     *     showGrid: true
     * });
     *
     * @dochash actions/os/portals
     * @docname os.addBotDropGrid
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
            type:
                t.type && (t.type === 'sphere' || t.type === 'grid')
                    ? t.type
                    : undefined,
        }));
    }

    /**
     * Enables "custom dragging" for the current bot drag operation.
     *
     * Custom dragging tells CasualOS to not move the bot to the dragged position. Instead, it will calculate where the bot would be dragged and send that information in the {@tag @onDragging} and {@tag @onAnyBotDragging} listeners.
     *
     * This is useful for custom bot dragging behavior like choosing to scale or rotate a bot instead of moving it.
     *
     * @example Enable custom dragging for the current drag operation
     * os.enableCustomDragging();
     *
     * @dochash actions/os/portals
     * @docname os.enableCustomDragging
     */
    function enableCustomDragging(): EnableCustomDraggingAction {
        return addAction(calcEnableCustomDragging());
    }

    /**
     * Logs the given data to the developer console.
     *
     * @param args the data that should be logged.
     *
     * @example Log "Hello, World!" to the browser developer console.
     * os.log("Hello, World!");
     *
     * @dochash actions/os/system
     * @docname os.log
     */
    function log(...args: any[]) {
        console.log(...args);
    }

    /**
     * Gets the geographic location that the current device is at in the world.
     *
     * Returns a promise that resolves with the location.
     *
     * @example Get the current geolocation.
     * const location = await os.getGeolocation();
     *
     * if (location.success) {
     *     os.toast(`You are at (${location.latitude}, ${location.longitude})`);
     * } else {
     *     os.toast(location.errorMessage);
     * }
     *
     * @dochash actions/os/geolocation
     * @doctitle Geolocation Actions
     * @docsidebar Geolocation
     * @docdescription Actions for working with the device's geolocation.
     * @docname os.getGeolocation
     * @docgroup 10-geolocation
     */
    function getGeolocation(): Promise<Geolocation> {
        const task = context.createTask();
        const event = calcGetGeolocation(task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Creates a new contract record in the XP system.
     *
     * @param recordName The name of the record that the contract should be stored in.
     * @param contract The contract record data.
     * @param options The options for the request.
     *
     * @dochash actions/xp
     * @doctitle xpExchange Actions
     * @docsidebar xpExchange
     * @docdescription Actions for working with the xpExchange.
     * @docname xp.recordContract
     */
    function xpRecordContract(
        recordName: string,
        contract: ContractRecordInput,
        options: RecordActionOptions = {}
    ): Promise<void> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                recordContract: {
                    input: {
                        recordName,
                        item: contract as any,
                    },
                },
            },
            options,
            task.taskId
        );

        return addAsyncAction(task, event);
    }

    /**
     * Gets the contract with the given address.
     *
     * @param recordName The name of the record that the contract is stored in.
     * @param address The address of the contract.
     * @param options The options for the request.
     *
     * @dochash actions/xp
     * @docname xp.getContract
     */
    function xpGetContract(
        recordName: string,
        address: string,
        options: RecordActionOptions = {}
    ): Promise<ContractRecord | null> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                getContract: {
                    input: {
                        recordName,
                        address,
                    },
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets a list of contracts from the given record.
     *
     * @param recordName The name of the record that the contracts are stored in.
     * @param address The address that the contracts should be listed after. If null, then the first page of contracts will be returned.
     * @param options The options for the request.
     * @returns A promise that resolves with the list of contracts.
     *
     * @dochash actions/xp
     * @docname xp.listContracts
     */
    function xpListContracts(
        recordName: string,
        address: string = null,
        options: RecordActionOptions = {}
    ): Promise<ContractRecord[]> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                listContracts: {
                    input: {
                        recordName,
                        address,
                    },
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the pricing for the given contract.
     *
     * @param recordName The name of the record that the contracts are stored in.
     * @param address The address of the contract.
     * @param options The options for the request.
     * @returns A promise that resolves with the pricing details for the contract.
     *
     * @dochash actions/xp
     * @docname xp.getContractPricing
     */
    function xpGetContractPricing(
        recordName: string,
        address: string = null,
        options: RecordActionOptions = {}
    ): Promise<GenericResult<ContractPricing, SimpleError>> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                getContractPricing: {
                    input: {
                        recordName,
                        address,
                    },
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Attempts to purchase a contract via the xpExchange.
     *
     * @param request The request for the purchase.
     * @param options The options for the request.
     * @returns A promise that resolves when the purchase is complete. Returns a URL to redirect the user to if additional payment details need to be collected.
     *
     * @dochash actions/xp
     * @docname xp.purchaseContract
     */
    function xpPurchaseContract(
        request: APIPurchaseContractRequest,
        options: RecordActionOptions = {}
    ): Promise<
        GenericResult<
            {
                /**
                 * The URL that the user should be directed to to complete the purchase.
                 */
                url?: string;

                /**
                 * The ID of the checkout session.
                 */
                sessionId: string;
            },
            SimpleError
        >
    > {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                purchaseContract: {
                    input: {
                        recordName: request.recordName,
                        contract: {
                            address: request.address,
                            expectedCost: request.expectedCost,
                            currency: request.currency,
                        },
                        returnUrl: request.returnUrl,
                        successUrl: request.successUrl,
                    },
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Cancels a contract contract via the xpExchange and refunds any funds.
     *
     * @param recordName The name of the record that the contract is stored in.
     * @param address The address of the contract to cancel.
     * @param options The options for the request.
     * @returns A promise that resolves when the contract is cancelled.
     *
     * @dochash actions/xp
     * @docname xp.cancelContract
     */
    function xpCancelContract(
        recordName: string,
        address: string,
        options: RecordActionOptions = {}
    ): Promise<GenericResult<void, SimpleError>> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                cancelContract: {
                    input: {
                        recordName: recordName,
                        address: address,
                    },
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Creates a new invoice for the given contract.
     *
     * @param request The request for the invoice.
     * @param options The options for the request.
     * @returns A promise that resolves when the invoice is created.
     *
     * @dochash actions/xp
     * @docname xp.invoiceContract
     */
    function xpInvoiceContract(
        request: APIInvoiceContractRequest,
        options: RecordActionOptions = {}
    ): Promise<GenericResult<{ invoiceId: string }, SimpleError>> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                invoiceContract: {
                    input: {
                        contractId: request.contractId,
                        amount: request.amount,
                        note: request.note,
                        payoutDestination: request.payoutDestination,
                    },
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Voids (cancels) an invoice.
     *
     * @param invoiceId The ID of the invoice to void.
     * @param options The options for the request.
     * @returns A promise that resolves when the invoice is voided.
     *
     * @dochash actions/xp
     * @docname xp.voidInvoice
     */
    function xpCancelInvoice(
        invoiceId: string,
        options: RecordActionOptions = {}
    ): Promise<GenericResult<void, SimpleError>> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                cancelInvoice: {
                    input: {
                        invoiceId,
                    },
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Lists the invoices for the given contract.
     *
     * @param contractId The ID of the contract to list invoices for.
     * @param options The options for the request.
     * @returns A promise that resolves with the invoices for the contract.
     *
     * @dochash actions/xp
     * @docname xp.listInvoices
     */
    function xpListInvoices(
        contractId: string,
        options: RecordActionOptions = {}
    ): Promise<GenericResult<ContractInvoice[], SimpleError>> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                listContractInvoices: {
                    input: {
                        contractId,
                    },
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Pays an invoice. This will attempt to transfer funds from the contract account to the user holding the contract.
     *
     * @param invoiceId The ID of the invoice to pay.
     * @param options The options for the request.
     * @returns A promise that resolves when the invoice is paid.
     */
    function xpPayInvoice(
        invoiceId: string,
        options: RecordActionOptions = {}
    ): Promise<GenericResult<void, SimpleError>> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                payContractInvoice: {
                    input: {
                        invoiceId,
                    },
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Attempts to payout funds from the user's account to their linked payout destination.
     *
     * @param request The payout request.
     * @param options The options for the request.
     * @returns A promise that resolves when the payout is complete.
     *
     * @dochash actions/xp
     * @docname xp.payout
     */
    function xpPayout(
        request: APIPayoutRequest,
        options: RecordActionOptions = {}
    ): Promise<GenericResult<void, SimpleError>> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                payoutAccount: {
                    input: {
                        amount: request.amount,
                        destination: request.destination,
                    },
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Attempts to retrieve the account balances for the user's account.
     *
     * @param options The options for the request.
     * @returns A promise that resolves with the account balances.
     *
     * @dochash actions/xp
     * @docname xp.getAccountBalances
     */
    function xpGetAccountBalances(
        options: RecordActionOptions = {}
    ): Promise<GenericResult<JSONAccountBalance, SimpleError>> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                getBalances: {
                    input: {},
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Specifies that the given prefix should be used to indicate that the tag contains script content.
     * Use this function to specify custom prefixes that function similarly to `@` or `🧬`.
     * @param prefix the prefix that should indicate that the rest of the tag value is a script.
     * @param options the options that should be used for the prefix.
     *
     * @example Add 📖 as an script prefix.
     * await os.registerTagPrefix("📖");
     *
     * @example Register some arbitrary text as a prefix.
     * await os.registerTagPrefix("myPrefix");
     *
     * @example Register a prefix as JSX code.
     * await os.registerTagPrefix("🔺", {
     *     language: "jsx"
     * });
     *
     * @example Register a prefix with a name.
     * await os.registerTagPrefix("🔺", {
     *     language: "jsx"
     *     name: 'Triangle'
     * });
     *
     * @dochash actions/os/app
     * @docname os.registerTagPrefix
     */
    function registerPrefix(
        prefix: string,
        options?: RegisterPrefixOptions
    ): Promise<void> {
        if (typeof prefix !== 'string') {
            throw new Error('A prefix must be provided.');
        }

        const task = context.createTask();
        const event = calcRegisterPrefix(
            prefix,
            {
                language: options?.language || 'javascript',
                name: options?.name,
            },
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Registers a app with the given ID, bot, and options. Returns a promise that resolves when the app has been registered. Can be called multiple times with new options to override previous options.
     *
     * Once setup, CasualOS will send a {@tag @onAppSetup} whisper to the given bot.
     * At this point, you can call {@link os.compileApp} to set what the app displays.
     *
     * CasualOS will also define a global variable `{app}Bot` that points to the given bot.
     *
     * Apps work by running the HTML you give it by calling {@link os.compileApp} with the HTML you want the app to show.
     * Since JavaScript does not natively support HTML, we are using a special extension called [JSX](https://reactjs.org/docs/introducing-jsx.html) that adds HTML-like syntax to JavaScript.
     *
     * At the most basic, JSX is like writing HTML inside JavaScript:
     *
     * ```typescript
     * let htmlData = <div>
     *     <h1>Hello World</h1>
     * </div>;
     * ```
     *
     * See this article for more information: [Introducing JSX](https://reactjs.org/docs/introducing-jsx.html)
     *
     * CasualOS also includes a helper called `html` that can be used to make HTML objects out of a string.
     * You can use it to convert a string into HTML by adding it before a string that uses backticks, like this:
     *
     * ```typescript
     * let htmlData = html`
     *     <div>
     *         <h1>Hello World</h1>
     *     </div>
     * `;
     * ```
     *
     * JSX is the preferred way to write HTML inside JavaScript since CasualOS can properly detect it and add helpful features like syntax highlighting and error messages.
     *
     * @param portalId the ID that the app should have.
     * @param bot the bot that should represent the app. This is the bot that recieves the {@tag @onAppSetup} whisper and should generally be in charge of calling {@link os.compileApp}.
     *
     * @example Setup a basic app
     * await os.registerApp('basicApp', thisBot);
     * os.compileApp('basicApp', <h1>Hello World!</h1>);
     *
     * @example Setup an app with a button
     * await os.registerApp('buttonApp', thisBot);
     *
     * os.compileApp('buttonApp',
     *     <button onClick={ () => os.toast("You clicked the button!") }>
     *         Click Me!
     *     </button>
     * );
     *
     * @example Setup an app with an input box
     * await os.registerApp('inputApp', thisBot);
     *
     * os.compileApp('inputApp',
     *     <input onInput={ (e) => { tags.label = e.target.value } }>
     * );
     *
     * @dochash actions/os/app
     * @doctitle App Actions
     * @docsidebar App
     * @docdescription Actions for working with custom apps.
     * @docname os.registerApp
     */
    function registerApp(portalId: string, bot: Bot | string): Promise<void> {
        const task = context.createTask();
        const event = registerCustomApp(portalId, getID(bot), task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Unregisters and removes the app with the given ID. Returns a promise that resolves when the app has been removed.
     *
     * @param appId the ID of the app.
     *
     * @example Unregister an app
     * await os.unregisterApp('myApp');
     *
     * @dochash actions/os/app
     * @docname os.unregisterApp
     */
    function unregisterApp(appId: string): Promise<void> {
        const task = context.createTask();
        const event = unregisterCustomApp(appId, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Compiles the app with the given ID to display the given content. Each time this function is called, the app will be cleared and will display the specified content.
     *
     * Used in tandem with {@link os.registerApp} to create custom apps.
     *
     * @param appId the ID of the app.
     * @param output the content that the app should display.
     *
     * @example Display a header
     * os.compileApp('myApp', <h1>Hello World!</h1>);
     *
     * @example Display a button
     * os.compileApp('myApp',
     *     <button onClick={ () => os.toast("You clicked the button!")}>
     *         Click Me!
     *     </button>
     * );
     *
     * @example Display an input box
     * os.compileApp('myApp',
     *     <input onInput={ (e) => { tags.label = e.target.value } } />
     * );
     *
     * @example Display a slider input
     * os.compileApp('myApp',
     *     <input type="range" min="0" max="100" onInput={ (e) => { tags.label = e.target.value } } />
     * );
     *
     * @dochash actions/os/app
     * @docname os.compileApp
     */
    function setAppContent(appId: string, content: any): SetAppOutputAction {
        const event = setAppOutput(appId, content);
        return addAction(event);
    }

    /**
     * Gets the list of tag names that are built-in to CasualOS.
     *
     * Includes tags like {@tag color} and {@tag gridPortal}, but not user-defined ones like {@tag [dimension]}.
     *
     * @example Get the list of built-in tags
     * const builtinTags = os.listBuiltinTags();
     * os.toast(builtinTags);
     *
     * @dochash actions/os/app
     * @docname os.listBuiltinTags
     */
    function listBuiltinTags(): string[] {
        return KNOWN_TAGS.slice();
    }

    /**
     * Shows the "report inst" dialog to the user.
     *
     * Returns a promise that resolves once the dialog has been closed.
     *
     * @example Show the "report inst" dialog.
     * await os.reportInst();
     *
     * @dochash actions/os/moderation
     * @doctitle Moderation Actions
     * @docsidebar Moderation
     * @docdescription Actions for working with moderation features.
     * @docname os.reportInst
     */
    function reportInst(): Promise<void> {
        const task = context.createTask();
        const event = calcReportInst(task.taskId);
        return addAsyncAction(task, event);
    }

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
    function requestAuthBot(): Promise<Bot> {
        return _requestAuthBot(false);
    }

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
    function requestAuthBotInBackground(): Promise<Bot> {
        return _requestAuthBot(true);
    }

    async function _requestAuthBot(background: boolean) {
        const data = await requestAuthData(background);

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
                        hasActiveSubscription: data.hasActiveSubscription,
                        subscriptionTier: data.subscriptionTier,
                        privacyFeatures: data.privacyFeatures,
                    },
                    TEMPORARY_BOT_PARTITION_ID
                )
            );
        }

        await defineGlobalBot('auth', bot.id);
        return bot;
    }

    function requestAuthData(background: boolean): Promise<AuthData> {
        const task = context.createTask();
        const event = calcRequestAuthData(background, task.taskId);
        return addAsyncAction(task, event);
    }

    function defineGlobalBot(name: string, botId: string): Promise<void> {
        const task = context.createTask();
        const event = calcDefineGlobalBot(name, botId, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Signs out the current user by revoking their session.
     * Returns a promise that resolves when the sign out request has been processed.
     *
     * @example Sign out the current user
     * await os.signOut();
     * os.toast("Signed out!");
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.signOut
     */
    function signOut(): Promise<void> {
        const task = context.createTask();
        const event = calcSignOut(task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Creates a record with the given name. If a studio is specified, then the record will be created in the given studio.
     * If not specified, then the record will be owned by the current user.
     *
     * Returns a promise that resolves with an object that indicates if the request was successful.
     *
     * Permissions: User must be logged in. If a studio is specified, then the user must be a member of the studio.
     *
     * @param recordName the name of the record to create.
     * @param studioId the ID of the studio that should own the record. If not specified, the record will be owned by the current user.
     *
     * @example Create a record owned by the current user.
     * const result = await os.createRecord('myRecord');
     *
     * if (result.success) {
     *     os.toast('Record created successfully!');
     * } else {
     *     os.toast('Failed to create record: ' + result.errorMessage);
     * }
     *
     * @example Create a record in a studio.
     * const result = await os.createRecord('myStudioRecord', 'myStudioId');
     *
     * if (result.success) {
     *     os.toast('Studio record created successfully!');
     * } else {
     *     os.toast('Failed to create studio record: ' + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docid os.createRecord
     * @docname os.createRecord
     * @docgroup 01-records
     */
    function createRecord(
        recordName: string,
        studioId?: string
    ): Promise<CreateRecordResult> {
        if (!hasValue(recordName)) {
            throw new Error('recordName must be provided.');
        } else if (typeof recordName !== 'string') {
            throw new Error('recordName must be a string.');
        }

        if (hasValue(studioId) && typeof studioId !== 'string') {
            throw new Error('studioId must be a string.');
        }

        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                createRecord: {
                    input: {
                        recordName,
                        studioId,
                    },
                },
            },
            {},
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Requests an [access key](glossary:record-key) for the [public record](glossary:record) with the given name.
     * Returns a promise that resolves with an object that contains the record key (if successful) or information about the error that occurred.
     *
     * @param name the name of the record to get the key for.
     *
     * @example Request an access key for a public record.
     * const result = await os.getPublicRecordKey('myPublicRecord');
     *
     * if (result.success) {
     *     os.toast(result.recordKey);
     * } else {
     *     os.toast('Failed ' + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.getPublicRecordKey
     */
    function getPublicRecordKey(
        name: string
    ): Promise<CreatePublicRecordKeyResult> {
        const task = context.createTask();
        const event = calcGetPublicRecordKey(name, 'subjectfull', task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Requests an subjectless [access key](glossary:record-key) for the [public record](glossary:record) with the given name.
     * Returns a promise that resolves with an object that contains the record key (if successful) or information about the error that occurred.
     *
     * This function works similarly to {@link os.getPublicRecordKey}, except that it does not require the user to be signed in when the resulting key is used.
     * Usage of subjectless keys should therefore be limited, since they do not record who is using the key and therefore make moderation more difficult.
     *
     * @param name the name of the record.
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.getSubjectlessPublicRecordKey
     */
    function getSubjectlessPublicRecordKey(
        name: string
    ): Promise<CreatePublicRecordKeyResult> {
        const task = context.createTask();
        const event = calcGetPublicRecordKey(name, 'subjectless', task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Grants the given permission in the given record.
     *
     * See [Record Security](page:learn/records/security) for more information.
     *
     * @param recordName the name of the record.
     * @param permission the permission that should be added.
     * @param options the options for the operation.
     *
     * @example Grant a permission in "recordName" to the "myRole" role to access all resources with the "secret" marker.
     * const result = await os.grantPermission('recordName', {
     *     marker: 'secret',
     *
     *     // any kind of resource
     *     resourceKind: null,
     *
     *     // all actions
     *     action: null,
     *
     *     subjectType: 'role',
     *     subjectId: 'myRole',
     *
     *     options: {},
     *
     *     // Never expire
     *     expireTimeMs: null
     * });
     *
     * @example Grant a permission to access the data record at "myAddress".
     * const result = await os.grantPermission('recordName', {
     *     resourceKind: 'data',
     *     resourceId: 'myAddress',
     *
     *     // all actions
     *     action: null,
     *
     *     subjectType: 'role',
     *     subjectId: 'myRole',
     *
     *     options: {},
     *
     *     // Never expire
     *     expireTimeMs: null
     * });
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.grantPermission
     */
    function grantPermission(
        recordName: string,
        permission: AvailablePermissions,
        options?: RecordActionOptions
    ): Promise<GrantMarkerPermissionResult | GrantResourcePermissionResult> {
        const task = context.createTask();
        const event = calcGrantRecordPermission(
            recordName,
            permission,
            options ?? {},
            task.taskId
        );
        return addAsyncAction(task, event);
    }

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
    function revokePermission(
        recordName: string,
        permissionId: string,
        options?: RecordActionOptions
    ): Promise<RevokePermissionResult> {
        const task = context.createTask();
        const event = calcRevokeRecordPermission(
            recordName,
            permissionId,
            options ?? {},
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the list of permissions that have been assigned in the given record.
     *
     * @param request the request containing the record name and optional filters.
     * @param options the options for the operation.
     *
     * @example List all permissions in a record.
     * const result = await os.listPermissions({
     *     recordName: 'myRecord'
     * });
     *
     * @example List permissions for a specific marker.
     * const result = await os.listPermissions({
     *     recordName: 'myRecord',
     *     marker: 'secret'
     * });
     *
     * @example List permissions for a specific resource.
     * const result = await os.listPermissions({
     *     recordName: 'myRecord',
     *     resourceKind: 'data',
     *     resourceId: 'address'
     * });
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docid os.listPermissions
     * @docname os.listPermissions
     */
    function listPermissions(
        request: ListPermissionsRequest
    ): Promise<ListPermissionsResult> {
        const task = context.createTask();
        const event = calcListPermissions(request, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Attempts to grant the current inst admin permissions in the given record for the rest of the day.
     *
     * When called, the user will be prompted to accept/deny the request.
     *
     * See [Record Security](page:learn/records/security) for more information.
     *
     * @param recordName the name of the record.
     * @param options the options for the operation.
     *
     * @example Grant the current inst admin permissions in the "myRecord" record.
     * const result = await os.grantInstAdminPermission('myRecord');
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.grantInstAdminPermission
     */
    function grantInstAdminPermission(
        recordName: string,
        options?: RecordActionOptions
    ): Promise<GrantRoleResult> {
        const task = context.createTask();
        const event = calcGrantInstAdminPermission(
            recordName,
            options ?? {},
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Grants the given user the given role in the given record for the specified time.
     *
     * See [Record Security](page:learn/records/security) for more information.
     *
     * @param recordName the name of the record.
     * @param role the role that should be granted to the user.
     * @param userId the ID of the user that should be granted the role.
     * @param expireTimeMs the time that the role grant expires. If `null`, then the role will not expire.
     * @param options the options for the operation.
     *
     * @example Grant the "myRole" role to the user with the ID "myUserId" in the "myRecord" record.
     * const result = await os.grantUserRole('myRecord', 'myRole', 'myUserId');
     *
     * @example Grant a role to a user for 24 hours.
     * const result = await os.grantUserRole('myRecord', 'myRole', 'myUserId', DateTime.now().plus({ hours: 24 }).toMillis());
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.grantUserRole
     */
    function grantUserRole(
        recordName: string,
        role: string,
        userId: string,
        expireTimeMs: number = null,
        options?: RecordActionOptions
    ): Promise<GrantRoleResult> {
        const task = context.createTask();
        const event = calcGrantUserRole(
            recordName,
            role,
            userId,
            expireTimeMs,
            options ?? {},
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Revokes the given role from the given user in the given record.
     *
     * See [Record Security](page:learn/records/security) for more information.
     *
     * @param recordName the name of the record.
     * @param role the role that should be revoked from the user.
     * @param userId the ID of the user.
     * @param options the options for the operation.
     *
     * @example Revoke the "myRole" role from the user with the ID "myUserId" in the "myRecord" record.
     * const result = await os.revokeUserRole('myRecord', 'myRole', 'myUserId');
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.revokeUserRole
     */
    function revokeUserRole(
        recordName: string,
        role: string,
        userId: string,
        options?: RecordActionOptions
    ): Promise<RevokeRoleResult> {
        const task = context.createTask();
        const event = calcRevokeUserRole(
            recordName,
            role,
            userId,
            options ?? {},
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Grants the given inst the given role in the given record for the specified time.
     *
     * See [Record Security](page:learn/records/security) for more information.
     *
     * @param recordName the name of the record.
     * @param role the role that should be granted.
     * @param inst the inst that should be granted the role.
     * @param expireTimeMs the time that the role grant expires. If null, then the role will not expire.
     * @param options the options for the operation.
     *
     * @example Grant the "myRole" role to a public inst with the name "myInst" in the "myRecord" record.
     * const result = await os.grantInstRole('myRecord', 'myRole', '/myInst');
     *
     * @example Grant the "myRole" role to a studio inst with the name "myInst" in the "myRecord" record.
     * const result = await os.grantInstRole('myRecord', 'myRole', 'myRecord/myInst');
     *
     * @example Grant a role to an inst for 24 hours.
     * const result = await os.grantInstRole('myRecord', 'myRole', 'myInst/myInst', DateTime.now().plus({ hours: 24 }).toMillis());
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.grantInstRole
     */
    function grantInstRole(
        recordName: string,
        role: string,
        inst: string,
        expireTimeMs: number = null,
        options: RecordActionOptions = {}
    ): Promise<GrantRoleResult> {
        const task = context.createTask();
        const event = calcGrantInstRole(
            recordName,
            role,
            inst,
            expireTimeMs,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Revokes the given role from the given inst in the given record.
     *
     * See [Record Security](page:learn/records/security) for more information.
     *
     * @param recordName The name of the record.
     * @param role the role that should be revoked from the inst.
     * @param inst the inst that the role should be revoked from.
     * @param options the options for the operation.
     *
     * @example Revoke the "myRole" role from a public inst with the name "myInst" in the "myRecord" record.
     * const result = await os.revokeInstRole('myRecord', 'myRole', '/myInst');
     *
     * @example Revoke the "myRole" role from a studio inst with the name "myInst" in the "myRecord" record.
     * const result = await os.revokeInstRole('myRecord', 'myRole', 'myRecord/myInst');
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.revokeInstRole
     */
    function revokeInstRole(
        recordName: string,
        role: string,
        inst: string,
        options?: RecordActionOptions
    ): Promise<RevokeRoleResult> {
        const task = context.createTask();
        const event = calcRevokeInstRole(
            recordName,
            role,
            inst,
            options ?? {},
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Determines if the given value represents a [record key](glossary:record-key).
     *
     * Returns `true` if the value is a record key and `false` if the value is not a record key.
     *
     * @param key the value to test to see if it is a record key.
     *
     * @example Determine if a value is a record key.
     * const isRecordKey = os.isRecordKey(tags.myRecordKey);
     * os.toast(tags.myRecordKey ' is ' + (isRecordKey ? 'a' : 'not a') + ' record key.');
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.isRecordKey
     */
    function isRecordKey(key: unknown): boolean {
        return calcIsRecordKey(key);
    }

    /**
     * Stores the given [data](glossary:data-record) in the given [record](glossary:record) at the given address.
     * If data already exists at the given address, it will be overwritten.
     *
     * Returns a promise that resolves with an object that indicates if the request was successful.
     * @param recordKeyOrRecordName the key that should be used to access the record. You can request a record key by using {@link os.getPublicRecordKey}.
     * @param address the address that the data should be stored at.
     * @param data the data that should be stored. This can be any value that can be serialized to JSON.
     * Must be less than 300KB in size.
     * If you need to store data larger than 300KB, you can use {@link os.recordFile}.
     * @param endpointOrOptions the options that should be used to record the data.
     *
     * @example Publish some data to a record
     * const recordKeyResult = await os.getPublicRecordKey('myRecord');
     * if (!recordKeyResult.success) {
     *     os.toast("Failed to get a record key! " + recordKeyResult.errorMessage);
     *     return;
     * }
     * const result = await os.recordData(recordKeyResult.recordKey, 'myAddress', 'myData');
     *
     * if (result.success) {
     *     os.toast("Success!");
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @example Record data to the user's personal record
     * const result = await os.recordData(authBot.id, 'myAddress', 'myData');
     *
     * if (result.success) {
     *     os.toast("Success!");
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @example Record data with a custom marker
     * const result = await os.recordData(authBot.id, 'myAddress', 'myData', {
     *     marker: 'myMarker'
     * });
     *
     * if (result.success) {
     *     os.toast("Success!");
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.recordData
     */
    function recordData(
        recordKeyOrRecordName: string,
        address: string,
        data: any,
        endpointOrOptions?: string | DataRecordOptions
    ) {
        return baseRecordData(
            recordKeyOrRecordName,
            address,
            data,
            false,
            endpointOrOptions
        );
    }

    /**
     * Stores the given [manual approval data](glossary:manual-approval-data-record) in the given record at the given address. If data already exists at the given address, it will be overwritten.
     *
     * Returns a promise that resolves with an object that indicates if the request was successful.
     *
     * Works the same as {@link os.recordData} except that manual approval data records require the user to allow the operation manually.
     *
     * @param recordKeyOrRecordName the key that should be used to access the record. You can request a record key by using {@link os.getPublicRecordKey}.
     * @param address the address that the data should be stored at.
     * @param data the data that should be stored. This can be any value that can be serialized to JSON.
     * Must be less than 300KB in size.
     * If you need to store data larger than 300KB, you can use {@link os.recordFile}.
     * @param endpointOrOptions the options that should be used to record the data.
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.recordManualApprovalData
     */
    function recordManualApprovalData(
        recordKeyOrRecordName: string,
        address: string,
        data: any,
        endpointOrOptions?: string | DataRecordOptions
    ) {
        return baseRecordData(
            recordKeyOrRecordName,
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
                let { marker, ...rest } = endpointOrOptions;
                options = rest;
                if (hasValue(marker)) {
                    options.markers = [
                        endpointOrOptions.marker,
                        ...(endpointOrOptions.markers ?? []),
                    ];
                }
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
     * Gets the data stored at the given address in the given record.
     * Returns a promise that resolves with an object that contains the data (if successful) or information about the error that occurred.
     *
     *
     * @param recordKeyOrName the record name or a record key. This indicates the record that the data should be retrieved from.
     * Note that you don't need a record key in order to retrieve public data from a record. Using a record name will work just fine.
     * @param address the address that the data should be retrieved from.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to.
     * If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     *
     * @example Get some data from a record
     * const result = await os.getData('myRecord', 'myAddress');
     *
     * if (result.success) {
     *     os.toast(result.data);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.getData
     */
    function getData(
        recordKeyOrName: string,
        address: string,
        endpoint: string = null
    ): Promise<GetDataResult> {
        return baseGetData(recordKeyOrName, address, false, endpoint);
    }

    /**
     * Gets the [manual approval data](glossary:manual-approval-data-record) stored at the given address in the given record.
     *
     * Works the same as {@link os.getData} except that manual approval data records require the user to allow the operation manually.
     *
     * @param recordKeyOrName the record name or a record key. This indicates the record that the data should be retrieved from.
     * Note that you don't need a record key in order to retrieve public data from a record. Using a record name will work just fine.
     * @param address the address that the data should be retrieved from.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to.
     * If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.getManualApprovalData
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
     * Gets a partial list of [data](glossary:data-record) that is stored in the given record.
     * Optionally accepts the address before the first item that should be included in the list.
     * Returns a promise that resolves with an object that contains the items (if successful) or information about the error that occurred.
     *
     * On [publicos.link](https://publicos.link), the returned list is limited to 25 items.
     *
     * @param recordKeyOrName the record name or a record key. This indicates the record that the data should be retrieved from.
     * Note that you don't need a record key in order to retrieve public data from a record. Using a record name will work just fine.
     * @param startingAddress the address after which items will be included in the list.
     * Since items are ordered within the record by address, this can be used as way to iterate through all the data items in a record.
     * If omitted, then the list will start with the first item.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to. If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     *
     * @example Get a list of data items in a record
     * const result = await os.listData('myRecord');
     * if (result.success) {
     *     os.toast(result.items);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @example List all the items in a record
     * let lastAddress;
     * let items = [];
     * while(true) {
     *     const result = await os.listData('myRecord', lastAddress);
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
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.listData
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
     * const result = await os.listDataByMarker('myRecord', 'publicRead');
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
     *     const result = await os.listDataByMarker('myRecord', 'publicRead', lastAddress);
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
     * const result = await os.listDataByMarker('myRecord', 'publicRead', null, { sort: 'descending' });
     * if (result.success) {
     *     os.toast(result.items);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @example List publicRead items stored at "myContainer" in descending order
     * const result = await os.listDataByMarker('myRecord', 'publicRead:myContainer', null, { sort: 'descending' });
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
    function listDataByMarker(
        recordKeyOrName: string,
        marker: string,
        startingAddress: string = null,
        options: ListDataOptions = {}
    ): Promise<ListDataResult> {
        const recordName = isRecordKey(recordKeyOrName)
            ? parseRecordKey(recordKeyOrName)[0]
            : recordKeyOrName;
        const task = context.createTask();
        const event = listDataRecordByMarker(
            recordName,
            marker,
            startingAddress,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the list of insts that are in the record with the given name.
     * Returns a promise that resolves with an object that contains the list of insts (if successful) or information about the error that occurred.
     * @param recordName the name of the record that the insts should be listed from.
     * @param startingInst the inst that the list should start at. This can be used to paginate through the list of insts. If omitted, then the list will start from the beginning.
     * @param endpoint the HTTP Endpoint of the records website that the insts should be listed from.
     * If omitted, then the preconfigured records endpoint will be used.
     *
     * @example List insts in a record
     * const result = await os.listInsts('myRecord');
     *
     * if (result.success) {
     *     os.toast(`Found ${result.insts.length} insts!`);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.listInsts
     * @docid os.listInsts
     */
    function listInsts(
        recordName: string,
        startingInst: string | null = null,
        endpoint: string | null = null
    ): Promise<ListInstsResult> {
        let options: RecordActionOptions = {};
        if (hasValue(endpoint)) {
            options.endpoint = endpoint;
        }
        const task = context.createTask();
        const event = calcListInsts(
            recordName,
            startingInst,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the list of insts that are in the record with the given name and given marker.
     * Returns a promise that resolves with an object that contains the list of insts (if successful) or information about the error that occurred.
     * @param recordName the name of the record that the insts should be listed from.
     * @param marker the marker that the insts should have.
     * @param startingInst the inst that the list should start at. This can be used to paginate through the list of insts. If omitted, then the list will start from the beginning.
     * @param options the options that should be used for the action.
     *
     * @example List insts by marker in a record
     * const result = await os.listInstsByMarker('myRecord', 'public');
     *
     * if (result.success) {
     *     os.toast(`Found ${result.insts.length} insts!`);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.listInstsByMarker
     * @docid os.listInstsByMarker
     */
    function listInstsByMarker(
        recordName: string,
        marker: string,
        startingInst: string | null = null,
        options: RecordActionOptions = {}
    ): Promise<ListInstsResult> {
        const task = context.createTask();
        const event = calcListInstsByMarker(
            recordName,
            marker,
            startingInst,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Erases the inst with the given name from the given record.
     * Returns a promise that resolves with an object that indicates if the operation was successful or not.
     * @param recordKeyOrName the record key or record name that should be used to access the record. You can request a record key by using {@link os.getPublicRecordKey}.
     * @param instName the name of the inst that should be deleted.
     * @param options the options for the request.
     *
     * @example Erase an inst from a record
     * const result = await os.eraseInst('myRecord', 'myInst');
     *
     * if (result.success) {
     *     os.toast("Inst deleted!");
     * } else {
     *     os.toast("Failed: " + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.eraseInst
     * @docid eraseInst
     */
    function eraseInst(
        recordKeyOrName: string,
        instName: string,
        options: RecordActionOptions = {}
    ): Promise<EraseInstResult> {
        if (!hasValue(recordKeyOrName)) {
            throw new Error('recordKeyOrName must be provided.');
        } else if (typeof recordKeyOrName !== 'string') {
            throw new Error('recordKeyOrName must be a string.');
        }

        if (!hasValue(instName)) {
            throw new Error('instName must be provided.');
        } else if (typeof instName !== 'string') {
            throw new Error('instName must be a string.');
        }

        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                deleteInst: {
                    input: {
                        recordKey: isRecordKey(recordKeyOrName)
                            ? recordKeyOrName
                            : undefined,
                        recordName: !isRecordKey(recordKeyOrName)
                            ? recordKeyOrName
                            : undefined,
                        inst: instName,
                    },
                },
            },
            options,
            task.taskId
        );

        return addAsyncAction(task, event);
    }

    /**
     * Erases the [data](glossary:data-record) stored at the given address in the given [record](glossary:record).
     * Returns a promise that resolves with an object that contains the data (if successful) or information about the error that occurred.
     * @param recordKeyOrName the record key or record name that should be used to access the record. You can request a record key by using {@link os.getPublicRecordKey}.
     * @param address the address that the data is stored at.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to.
     * If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     *
     * @example Erase some data from a record
     * const recordKeyResult = await os.getPublicRecordKey('myRecord');
     * if (!recordKeyResult.success) {
     *     os.toast("Failed to get a record key! " + recordKeyResult.errorMessage);
     *     return;
     * }
     * const result = await os.eraseData(recordKeyResult.recordKey, 'myAddress');
     *
     * if (result.success) {
     *     os.toast("Success!");
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.eraseData
     */
    function eraseData(
        recordKeyOrName: string,
        address: string,
        endpoint: string = null
    ): Promise<EraseDataResult> {
        return baseEraseData(recordKeyOrName, address, false, endpoint);
    }

    /**
     * Erases the [manual approval data](glossary:manual-approval-data-record) stored at the given address in the given record. Returns a promise that resolves with an object that contains the data (if successful) or information about the error that occurred.
     *
     * Works the same as {@link os.eraseData} except that manual approval data records require the user to allow the operation manually.
     *
     * @param recordKeyOrName the record key or record name that should be used to access the record. You can request a record key by using {@link os.getPublicRecordKey}.
     * @param address the address that the data is stored at.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to.
     * If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.eraseManualApprovalData
     */
    function eraseManualApprovalData(
        recordKeyOrName: string,
        address: string,
        endpoint: string = null
    ): Promise<EraseDataResult> {
        return baseEraseData(recordKeyOrName, address, true, endpoint);
    }

    /**
     * Erases the data stored in the given record at the given address.
     * @param recordKeyOrName The key that should be used to access the record.
     * @param address The address that the data should be erased from.
     * @param endpoint The records endpoint that should be queried. Optional.
     */
    function baseEraseData(
        recordKeyOrName: string,
        address: string,
        requiresApproval: boolean,
        endpoint: string = null
    ): Promise<EraseDataResult> {
        if (!hasValue(recordKeyOrName)) {
            throw new Error('recordKeyOrName must be provided.');
        } else if (typeof recordKeyOrName !== 'string') {
            throw new Error('recordKeyOrName must be a string.');
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
            recordKeyOrName,
            address,
            requiresApproval,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

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
    function recordWebhook(
        recordName: string,
        webhook: WebhookRecord,
        options?: RecordActionOptions
    ): Promise<CrudRecordItemResult> {
        const task = context.createTask();
        const event = calcRecordWebhook(
            recordName,
            webhook,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function runWebhook(
        recordName: string,
        address: string,
        input: any,
        options?: RecordActionOptions
    ): Promise<HandleWebhookResult> {
        const task = context.createTask();
        const event = calcRunWebhook(
            recordName,
            address,
            input,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function getWebhook(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<CrudGetItemResult<WebhookRecord>> {
        const task = context.createTask();
        const event = calcGetWebhook(
            recordName,
            address,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function eraseWebhook(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<CrudEraseItemResult> {
        const task = context.createTask();
        const event = calcEraseWebhook(
            recordName,
            address,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function listWebhooks(
        recordName: string,
        startingAddress: string = null,
        options?: ListWebhooksOptions
    ): Promise<CrudListItemsResult<WebhookRecord>> {
        const task = context.createTask();
        const event = calcListWebhooks(
            recordName,
            startingAddress,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function listWebhooksByMarker(
        recordName: string,
        marker: string,
        startingAddress: string = null,
        options?: ListWebhooksOptions
    ): Promise<CrudListItemsResult<WebhookRecord>> {
        const task = context.createTask();
        const event = calcListWebhooksByMarker(
            recordName,
            marker,
            startingAddress,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function recordNotification(
        recordName: string,
        notification: NotificationRecord,
        options?: RecordActionOptions
    ): Promise<CrudRecordItemResult> {
        const task = context.createTask();
        const event = calcRecordNotification(
            recordName,
            notification,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function getNotification(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<CrudGetItemResult<NotificationRecord>> {
        const task = context.createTask();
        const event = calcGetNotification(
            recordName,
            address,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function eraseNotification(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<CrudEraseItemResult> {
        const task = context.createTask();
        const event = calcEraseNotification(
            recordName,
            address,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function listNotifications(
        recordName: string,
        startingAddress: string = null,
        options?: ListNotificationsOptions
    ): Promise<CrudListItemsResult<NotificationRecord>> {
        const task = context.createTask();
        const event = calcListNotifications(
            recordName,
            startingAddress,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function listNotificationsByMarker(
        recordName: string,
        marker: string,
        startingAddress: string = null,
        options?: ListNotificationsOptions
    ): Promise<CrudListItemsResult<NotificationRecord>> {
        const task = context.createTask();
        const event = calcListNotificationsByMarker(
            recordName,
            marker,
            startingAddress,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function subscribeToNotification(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<SubscribeToNotificationResult> {
        const task = context.createTask();
        const event = calcSubscribeToNotification(
            recordName,
            address,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function unsubscribeFromNotification(
        subscriptionId: string,
        options?: RecordActionOptions
    ): Promise<UnsubscribeToNotificationResult> {
        const task = context.createTask();
        const event = calcUnsubscribeFromNotification(
            subscriptionId,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function sendNotification(
        recordName: string,
        address: string,
        payload: PushNotificationPayload,
        options?: SendNotificationOptions
    ): Promise<SendNotificationResult> {
        const task = context.createTask();
        const event = calcSendNotification(
            recordName,
            address,
            payload,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function listNotificationSubscriptions(
        recordName: string,
        address: string,
        options?: RecordActionOptions
    ): Promise<ListSubscriptionsResult> {
        const task = context.createTask();
        const event = calcListNotificationSubscriptions(
            recordName,
            address,
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

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
    function listUserNotificationSubscriptions(
        options?: RecordActionOptions
    ): Promise<ListSubscriptionsResult> {
        const task = context.createTask();
        const event = calcListUserNotificationSubscriptions(
            options ?? {},
            task.taskId
        );
        const final = addAsyncResultAction(task, event);
        (final as any)[ORIGINAL_OBJECT] = event;
        return final;
    }

    /**
     * Stores the given [file data](glossary:file-record) in the given record using the given options for the file. The file can later be retrieved by using os.getFile(urlOrRecordFileResult).
     *
     * Returns a promise that resolves with an object that contains the URL that the file was stored at (if successful) or information about the error that occurred.
     *
     * @param recordKeyOrName the record key or record name that should be used to access the record. You can request a record key by using {@link os.getPublicRecordKey}.
     * @param data the data that should be stored in the record. This can be a string, an object, a blob, or an ArrayBuffer.
     * @param options The options that should be used to record the file.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to. If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     *
     * @example Upload a file
     * const files = await os.showUploadFiles();
     *
     * if (files.length <= 0) {
     *     return;
     * }
     *
     * const file = files[0];
     * const result = await os.recordFile(tags.recordKey, file);
     *
     * if (result.success) {
     *     tags.uploadUrl = result.url;
     *     os.toast("Success! Uploaded to " + result.url);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @example Upload a string to a file record
     * const recordKeyResult = await os.getPublicRecordKey('myRecord');
     * if (!recordKeyResult.success) {
     *     os.toast("Failed to get a record key! " + recordKeyResult.errorMessage);
     *     return;
     * }
     * const result = await os.recordFile(recordKeyResult.recordKey, 'my file data');
     *
     * if (result.success) {
     *     tags.uploadUrl = result.url;
     *     os.toast("Success! Uploaded to " + result.url);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @example Upload red bots to a file record
     * const recordKeyResult = await os.getPublicRecordKey('myRecord');
     * if (!recordKeyResult.success) {
     *     os.toast("Failed to get a record key! " + recordKeyResult.errorMessage);
     *     return;
     * }
     * const result = await os.recordFile(recordKeyResult.recordKey, getBots("color", "red"), {
     *     description: 'my bots'
     * });
     *
     * if (result.success) {
     *     tags.uploadUrl = result.url;
     *     os.toast("Success! Uploaded to " + result.url);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @example Upload a file to a custom endpoint
     * const files = await os.showUploadFiles();
     *
     * if (files.length <= 0) {
     *     return;
     * }
     *
     * const file = files[0];
     * const result = await os.recordFile(tags.recordKey, file, undefined, 'https://myendpoint.com');
     *
     * if (result.success) {
     *     tags.uploadUrl = result.url;
     *     os.toast("Success! Uploaded to " + result.url);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.recordFile
     */
    function recordFile(
        recordKeyOrName: string,
        data: any,
        options?: RecordFileOptions,
        endpoint: string = null
    ): Promise<RecordFileApiResult> {
        if (!hasValue(recordKeyOrName)) {
            throw new Error('recordKeyOrName must be provided.');
        } else if (typeof recordKeyOrName !== 'string') {
            throw new Error('recordKeyOrName must be a string.');
        }

        if (!hasValue(data)) {
            throw new Error('data must be provided.');
        }

        let recordOptions: RecordFileActionOptions = {};
        if (hasValue(options)) {
            let { marker, markers } = options;
            recordOptions.markers = markers;
            if (hasValue(marker)) {
                recordOptions.markers = [
                    options.marker,
                    ...(options.markers ?? []),
                ];
            }
        }
        if (hasValue(endpoint)) {
            recordOptions.endpoint = endpoint;
        }

        const task = context.createTask();
        const event = calcRecordFile(
            recordKeyOrName,
            convertToCopiableValue(data),
            options?.description,
            options?.mimeType,
            recordOptions,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Downloads the [file](glossary:file-record) that is specified in the given {@link os.recordFile} result.
     *
     * Returns a promise that resolves with the file data.
     *
     * @param result the result of a {@link os.recordFile} call.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to. If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint. Only used for private files.
     *
     * @example Get a file that was uploaded
     * const recordKeyResult = await os.getPublicRecordKey('myRecord');
     * if (!recordKeyResult.success) {
     *     os.toast("Failed to get a record key! " + recordKeyResult.errorMessage);
     *     return;
     * }
     * const result = await os.recordFile(recordKeyResult.recordKey, getBots("color", "red"), {
     *     description: 'my bots'
     * });
     *
     * if (result.success) {
     *     tags.uploadResult = result;
     *     os.toast("Success! Uploaded to " + result.url);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * // Download the file later
     * const fileData = await os.getFile(tags.uploadResult);
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.getFile
     * @docid os.getFile-result
     */
    function getFile(
        result: RecordFileApiSuccess,
        endpoint?: string
    ): Promise<any>;
    /**
     * Downloads the [file](glossary:file-record) at the given URL.
     *
     * Returns a promise that resolves with the file data.
     *
     * @param url the URL that the file is stored at.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to. If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint. Only used for private files.
     *
     * @example Get a file that was uploaded
     * const recordKeyResult = await os.getPublicRecordKey('myRecord');
     * if (!recordKeyResult.success) {
     *     os.toast("Failed to get a record key! " + recordKeyResult.errorMessage);
     *     return;
     * }
     * const result = await os.recordFile(recordKeyResult.recordKey, getBots("color", "red"), {
     *     description: 'my bots'
     * });
     *
     * if (result.success) {
     *     tags.uploadUrl = result.url;
     *     os.toast("Success! Uploaded to " + result.url);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * // Download the file later
     * const fileData = await os.getFile(tags.uploadUrl);
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.getFile
     * @docid os.getFile-url
     */
    function getFile(url: string, endpoint?: string): Promise<any>;
    /**
     * Downloads the [file](glossary:file-record) at the given URL or at the URL that was specified in the given {@link os.recordFile} result.
     *
     * Returns a promise that resolves with the file data.
     *
     * @param urlOrRecordFileResult the URL that the file is stored at. It can also be the result of a {@link os.recordFile} call.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to. If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint. Only used for private files.
     *
     * @example Get a file that was uploaded
     * const recordKeyResult = await os.getPublicRecordKey('myRecord');
     * if (!recordKeyResult.success) {
     *     os.toast("Failed to get a record key! " + recordKeyResult.errorMessage);
     *     return;
     * }
     * const result = await os.recordFile(recordKeyResult.recordKey, getBots("color", "red"), {
     *     description: 'my bots'
     * });
     *
     * if (result.success) {
     *     tags.uploadUrl = result.url;
     *     os.toast("Success! Uploaded to " + result.url);
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * // Download the file later
     * const fileData = await os.getFile(tags.uploadUrl);
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.getFile
     */
    function getFile(
        urlOrRecordFileResult: string | RecordFileApiSuccess,
        endpoint?: string
    ): Promise<any> {
        if (!hasValue(urlOrRecordFileResult)) {
            throw new Error(
                'A url or successful os.recordFile() result must be provided.'
            );
        }

        let url = getFileUrl(urlOrRecordFileResult);
        let promise = webGet(url);
        let action: any = (promise as any)[ORIGINAL_OBJECT];

        let final = promise.then(
            (result) => {
                return result.data;
            },
            (err) => {
                const response = err.response as AxiosResponse;
                if (
                    response &&
                    response.status < 500 &&
                    response.status >= 400
                ) {
                    let options: RecordActionOptions = {};
                    if (hasValue(endpoint)) {
                        options.endpoint = endpoint;
                    }
                    return getPrivateFileFromUrl(url, options);
                } else {
                    throw err;
                }
            }
        );
        (final as any)[ORIGINAL_OBJECT] = action;
        return final;
    }

    /**
     * Gets the data stored in the given public [file](glossary:file-record).
     * Only works for files that have the `publicRead` marker.
     * If the file is not public, then this operation will fail.
     *
     * Returns a promise that resolves with the file data.
     *
     * @param result the result of a {@link os.recordFile} call.
     *
     * @example Get a public file
     * const fileData = await os.getFile(recordFileResult);
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.getPublicFile
     * @docid os.getPublicFile-result
     */
    function getPublicFile(result: RecordFileApiSuccess): Promise<any>;

    /**
     * Gets the data stored in the given public [file](glossary:file-record).
     * Only works for files that have the `publicRead` marker.
     * If the file is not public, then this operation will fail.
     *
     * Returns a promise that resolves with the file data.
     *
     * @param url the URL that the file is stored at.
     *
     * @example Get a public file
     * let fileUrl = 'ENTER_FILE_URL_HERE';
     * const fileData = await os.getFile(fileUrl);
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.getPublicFile
     * @docid os.getPublicFile-url
     */
    function getPublicFile(url: string): Promise<any>;

    /**
     * Gets the data stored in the given public [file](glossary:file-record).
     * Only works for files that have the `publicRead` marker.
     * If the file is not public, then this operation will fail.
     *
     * Returns a promise that resolves with the file data.
     *
     * @param urlOrRecordFileResult the URL that the file is stored at. It can also be the result of a {@link os.recordFile} call.
     *
     * @example Get a public file
     * let fileUrl = 'ENTER_FILE_URL_HERE';
     * const fileData = await os.getFile(fileUrl);
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.getPublicFile
     */
    function getPublicFile(
        urlOrRecordFileResult: string | RecordFileApiSuccess
    ): Promise<string> {
        if (!hasValue(urlOrRecordFileResult)) {
            throw new Error(
                'A url or successful os.recordFile() result must be provided.'
            );
        }

        let url = getFileUrl(urlOrRecordFileResult);
        let promise = webGet(url);
        let action: any = (promise as any)[ORIGINAL_OBJECT];
        let final = promise.then((result) => {
            return result.data;
        });
        (final as any)[ORIGINAL_OBJECT] = action;
        return final;
    }

    /**
     * Gets the data stored in the given private [file](glossary:file-record).
     *
     * Returns a promise that resolves with the file data.
     *
     * @param result the result of a {@link os.recordFile} call.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to. If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     *
     * @example Get a private file
     * const result = await os.getPrivateFile(recordFileResult);
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.getPrivateFile
     * @docid os.getPrivateFile-result
     */
    function getPrivateFile(
        result: RecordFileApiSuccess,
        endpoint?: string
    ): Promise<any>;

    /**
     * Gets the data stored in the given private [file](glossary:file-record).
     *
     * Returns a promise that resolves with the file data.
     *
     * @param url the URL that the file is stored at.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to. If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     *
     * @example Get a private file
     * const fileUrl = 'ENTER_FILE_URL_HERE';
     * const result = await os.getPrivateFile(fileUrl);
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.getPrivateFile
     * @docid os.getPrivateFile-url
     */
    function getPrivateFile(url: string, endpoint?: string): Promise<any>;

    /**
     * Gets the data stored in the given private [file](glossary:file-record).
     *
     * Returns a promise that resolves with the file data.
     *
     * @param urlOrRecordFileResult the URL that the file is stored at. It can also be the result of a {@link os.recordFile} call.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to. If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     *
     * @example Get a private file
     * const fileUrl = 'ENTER_FILE_URL_HERE';
     * const result = await os.getPrivateFile(fileUrl);
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.getPrivateFile
     */
    function getPrivateFile(
        urlOrRecordFileResult: string | RecordFileApiSuccess,
        endpoint?: string
    ): Promise<string> {
        if (!hasValue(urlOrRecordFileResult)) {
            throw new Error(
                'A url or successful os.recordFile() result must be provided.'
            );
        }

        let url = getFileUrl(urlOrRecordFileResult);
        let options: RecordActionOptions = {};
        if (hasValue(endpoint)) {
            options.endpoint = endpoint;
        }

        return getPrivateFileFromUrl(url, options);
    }

    function getFileUrl(
        urlOrRecordFileResult: string | RecordFileApiSuccess
    ): string {
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

        return url;
    }

    function getPrivateFileFromUrl(
        url: string,
        options: RecordActionOptions
    ): Promise<any> {
        const task = context.createTask();
        const event = calcGetFile(url, options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Erases the [file](glossary:file-record) referenced in the given {@link os.recordFile} result.
     * Returns a promise that resolves with an object that indicates if the file was deleted or if an error occurred.
     *
     * @param recordKeyOrName The record key or name that should be used to delete the file.
     * @param result The successful result of a os.recordFile() call.
     * @param endpoint The records endpoint that should be queried. Optional.
     *
     * @example Delete a file
     * const result = await os.eraseFile(tags.recordKey, recordFileResult);
     *
     * if (result.success) {
     *     os.toast("Success!");
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.eraseFile
     * @docid os.eraseFile-result
     */
    function eraseFile(
        recordKeyOrName: string,
        result: RecordFileApiSuccess,
        endpoint?: string
    ): Promise<EraseFileResult>;
    /**
     * Erases the [file](glossary:file-record) at the given URL.
     * Returns a promise that resolves with an object that indicates if the file was deleted or if an error occurred.
     *
     * @param recordKeyOrName the record key or record name that should be used to access the record. You can request a record key by using {@link os.getPublicRecordKey}.
     * @param url the URL that the file is stored at.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to. If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     *
     * @example Delete a file
     * const result = await os.eraseFile(tags.recordKey, fileUrl);
     *
     * if (result.success) {
     *     os.toast("Success!");
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.eraseFile
     * @docid os.eraseFile-url
     */
    function eraseFile(
        recordKeyOrName: string,
        url: string,
        endpoint?: string
    ): Promise<EraseFileResult>;
    /**
     * Erases the [file](glossary:file-record) at the given URL or at the URL that was specified in the given {@link os.recordFile} result.
     *
     * Returns a promise that resolves with an object that indicates if the file was deleted or if an error occurred.
     *
     * @param recordKeyOrName the record key or record name that should be used to access the record. You can request a record key by using {@link os.getPublicRecordKey}.
     * @param urlOrRecordFileResult the URL that the file is stored at. It can also be the result of a {@link os.recordFile} call.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to. If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     *
     * @example Delete a file
     * const result = await os.eraseFile(tags.recordKey, fileUrl);
     *
     * if (result.success) {
     *     os.toast("Success!");
     * } else {
     *     os.toast("Failed " + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.eraseFile
     */
    function eraseFile(
        recordKeyOrName: string,
        fileUrlOrRecordFileResult: string | RecordFileApiSuccess,
        endpoint: string = null
    ): Promise<EraseFileResult> {
        if (!hasValue(recordKeyOrName)) {
            throw new Error('A recordKeyOrName must be provided.');
        } else if (typeof recordKeyOrName !== 'string') {
            throw new Error('recordKeyOrName must be a string.');
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
        const event = calcEraseFile(recordKeyOrName, url, options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Records that the given [event](glossary:event-record) occurred in the given record.
     *
     * Returns a promise that resolves with an object that indicates whether the operation was successful or unsuccessful.
     *
     * @param recordKeyOrName the record key or record name that should be used to record the event.
     * @param eventName the name of the event whose count should be incremented.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to. If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     *
     * @example Record that a click event happened
     * await os.recordEvent(myRecordKey, 'click');
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.recordEvent
     */
    function recordEvent(
        recordKeyOrName: string,
        eventName: string,
        endpoint: string = null
    ): Promise<AddCountResult> {
        if (!hasValue(recordKeyOrName)) {
            throw new Error('A recordKeyOrName must be provided.');
        } else if (typeof recordKeyOrName !== 'string') {
            throw new Error('recordKeyOrName must be a string.');
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
            recordKeyOrName,
            eventName,
            1,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the number of times that the given [event](glossary:event-record) has been recorded in the given record.
     *
     * Returns a promise that resolves with an object that indicates whether the operation was successful or unsuccessful.
     *
     * @param recordNameOrKey the name of the record that the event count should be retrieved from. It can also be a record key.
     * @param eventName the name of the event whose count should be retrieved.
     * @param endpoint the HTTP Endpoint of the records website that the data should be recorded to. If omitted, then the preconfigured records endpoint will be used. Note that when using a custom endpoint, the record key must be a valid record key for that endpoint.
     *
     * @example Get the number of times the click event has happened
     * const result = await os.countEvents(myRecord, 'click');
     *
     * if (result.success) {
     *     os.toast(result.count);
     * } else {
     *     os.toast('Failed to get count ' + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docname os.countEvents
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
     * Grants the given entitlements to a package.
     *
     * @param request The request to grant entitlements.
     * @param options the options for the request.
     *
     * @dochash actions/os/records
     * @docgroup 01-packages
     * @docname os.grantEntitlements
     */
    function grantEntitlements(
        request: GrantEntitlementsRequest,
        options: RecordActionOptions = {}
    ): Promise<GrantEntitlementsResult> {
        const task = context.createTask();
        const event = calcGrantEntitlements(request, options, task.taskId);
        return addAsyncAction(task, event);
    }

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
    function parseVersionKey(version: string): VersionNumber {
        const key = parseVersionNumber(version);
        if (key.major === null) {
            return null;
        }

        return key;
    }

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
    function formatVersionKey(key: PackageRecordVersionKey): string {
        return formatVersionNumber(key.major, key.minor, key.patch, key.tag);
    }

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
    function recordPackageVersion(
        request: RecordPackageVersionApiRequest,
        options: RecordActionOptions = {}
    ): Promise<RecordPackageVersionResult> {
        const task = context.createTask();
        const event = calcRecordPackageVersion(
            {
                recordName: request.recordName,
                address: request.address,
                key: request.key,
                entitlements: request.entitlements ?? [],
                description: request.description,
                markers: request.markers,
                state: {
                    version: 2,
                    updates: [
                        constructInitializationUpdate(
                            calcCreateInitalizationUpdate(request.bots)
                        ),
                    ],
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

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
    function listPackageVersions(
        recordName: string,
        address: string,
        options: RecordActionOptions = {}
    ): Promise<CrudListItemsResult<PackageRecordVersion>> {
        const task = context.createTask();
        const event = calcListPackageVersions(
            recordName,
            address,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

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
    function getPackageVersion(
        recordName: string,
        address: string,
        key?: string | PackageRecordVersionKeySpecifier,
        options: RecordActionOptions = {}
    ): Promise<CrudGetItemResult<PackageRecordVersion>> {
        const task = context.createTask();
        const event = calcGetPackageVersion(
            recordName,
            address,
            key,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

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
    function erasePackageVersion(
        recordName: string,
        address: string,
        key: PackageRecordVersionKey,
        options: RecordActionOptions = {}
    ): Promise<CrudEraseItemResult> {
        const task = context.createTask();
        const event = calcErasePackageVersion(
            recordName,
            address,
            key,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

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
    function recordPackageContainer(
        recordName: string,
        address: string,
        markers?: string | string[],
        options: RecordActionOptions = {}
    ): Promise<CrudRecordItemResult> {
        const task = context.createTask();
        const event = calcRecordPackageContainer(
            recordName,
            address,
            typeof markers === 'string'
                ? [markers]
                : markers ?? [PRIVATE_MARKER],
            options,
            task.taskId
        );

        return addAsyncAction(task, event);
    }

    /**
     * Erases the given package container and any package versions that it contains.
     *
     * @param recordName the name of the record that the package container is in.
     * @param address the address of the package container.
     * @param options the options to use for the request.
     */
    function erasePackageContainer(
        recordName: string,
        address: string,
        options: RecordActionOptions = {}
    ): Promise<CrudEraseItemResult> {
        const task = context.createTask();
        const event = calcErasePackageContainer(
            recordName,
            address,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

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
    function listPackageContainers(
        recordName: string,
        startingAddress?: string,
        options: ListDataOptions = {}
    ): Promise<CrudListItemsResult<PackageRecord>> {
        const task = context.createTask();
        const event = calcListPackageContainers(
            recordName,
            startingAddress,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

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
    function listPackageContainersByMarker(
        recordName: string,
        marker: string,
        startingAddress?: string,
        options: ListDataOptions = {}
    ): Promise<CrudListItemsResult<PackageRecord>> {
        const task = context.createTask();
        const event = calcListPackageContainersByMarker(
            recordName,
            marker,
            startingAddress,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

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
    function getPackageContainer(
        recordName: string,
        address: string,
        options: RecordActionOptions = {}
    ): Promise<CrudGetItemResult<PackageRecord>> {
        const task = context.createTask();
        const event = calcGetPackageContainer(
            recordName,
            address,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Attempts to install the given package into the inst.
     *
     * Returns a promise that resolves with the result of the installation.
     *
     * If the package was successfully installed, then a {@tag @onPackageInstalled} shout will be sent.
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
    function installPackage(
        recordName: string,
        address: string,
        key?: string | PackageRecordVersionKeySpecifier,
        options: RecordActionOptions = {}
    ): Promise<InstallPackageResult> {
        const task = context.createTask();
        const event = calcInstallPackage(
            recordName,
            address,
            key ?? null,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the list of packages that are installed in the inst.
     *
     * @param options the options for the request.
     *
     * @example List all installed packages
     * const result = await os.listInstalledPackages();
     *
     * @dochash actions/os/records
     * @docgroup 01-packages
     * @docname os.listInstalledPackages
     */
    function listInstalledPackages(
        options: RecordActionOptions = {}
    ): Promise<ListInstalledPackagesResult> {
        const task = context.createTask();
        const event = calcListInstalledPackages(options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Creates or updates a search collection in the given record.
     * 
     * Returns a promise that resolves with the result of the operation.
     * 
     * @param request The request to create or update the search collection.
     * @param options the options for the request.
     * @returns A promise that resolves with the result of the operation.
     * 
     * @example Record a search collection with an automatic schema
     * const result = await os.recordSearchCollection({
     *      recordName: 'myRecord',
     *      address: 'mySearchCollection',
     *      schema: {
     *          '.*': {
     *              type: 'auto'
     *           }
     *      }
     * });
     * 
     * @example Record a search collection with a custom schema
     * const result = await os.recordSearchCollection({
     *      recordName: 'myRecord',
     *      address: 'mySearchCollection',
     *      schema: {
               title: {
                  type: 'string',
               },
               description: {
                  type: 'string',
               },
               price: {
                  type: 'int32',
               }
     *      }
     * });
     * 
     * @example Record a private search collection
     * const result = await os.recordSearchCollection({
     *      recordName: 'myRecord',
     *      address: 'mySearchCollection',
     *      schema: {
               '.*': {
     *             type: 'auto'
     *          }
     *      },
     *      markers: ['private']
     * });
     * 
     * @example Record and search through a search collection
     * import Typesense from 'typesense';
     * const result = await os.recordSearchCollection({
     *      recordName: 'myRecord',
     *      address: 'mySearchCollection',
     *      schema: {
     *          '.*': {
     *              type: 'auto'
     *           }
     *      }
     * });
     * 
     * if (!result.success) {
     *   os.toast('Failed to record search collection: ' + result.errorMessage);
     *   return;
     * }
     * 
     * const collection = await os.getSearchCollection('myRecord', 'mySearchCollection');
     * 
     * if (!collection.success) {
     *    os.toast('Failed to get search collection: ' + collection.errorMessage);
     *    return;
     * }
     * 
     * const client = new Typesense.Client({
     *   nodes: collection.item.nodes,
     *   apiKey: collection.item.searchApiKey,
     * });
     *
     * const searchResults = await client.collections(collection.item.collectionName).documents().search({
     *   q: 'search term',
     *   query_by: 'title,description',
     *   sort_by: 'price:asc',
     * });
     * 
     * console.log('search results', searchResults);
     * 
     * 
     * @doctitle Search Actions
     * @docsidebar Search
     * @docdescription Search actions allow you to create and manage search collections in your records. Search collections enable efficient searching and indexing of data within your records, making it easier to retrieve relevant information quickly.
     * @dochash actions/os/records/search
     * @docgroup 02-search
     * @docname os.recordSearchCollection
     */
    function recordSearchCollection(
        request: RecordSearchCollectionApiRequest,
        options: RecordActionOptions = {}
    ): Promise<CrudRecordItemResult> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                recordSearchCollection: {
                    input: {
                        recordName: request.recordName,
                        item: {
                            address: request.address,
                            schema: request.schema,
                            markers: request.markers,
                        },
                    },
                },
            },
            options,
            task.taskId
        );

        return addAsyncAction(task, event);
    }

    /**
     * Deletes a search collection along with all the documents in it.
     *
     * Returns a promise that resolves with the result of the operation.
     *
     * @param recordName The name of the record to delete the search collection from.
     * @param address The address of the search collection to delete.
     * @param options the options for the request.
     * @returns A promise that resolves with the result of the operation.
     *
     * @example Erase a search collection
     * const result = await os.eraseSearchCollection('recordName', 'mySearchCollection');
     *
     * @dochash actions/os/records/search
     * @docgroup 02-search
     * @docname os.eraseSearchCollection
     */
    function eraseSearchCollection(
        recordName: string,
        address: string,
        options: RecordActionOptions = {}
    ): Promise<CrudEraseItemResult> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                eraseSearchCollection: {
                    input: {
                        recordName,
                        address,
                    },
                },
            },
            options,
            task.taskId
        );

        return addAsyncAction(task, event);
    }

    /**
     * Lists the search collections in a record.
     *
     * Returns a promise that resolves with the result of the operation.
     *
     * @param recordName The name of the record to delete the search collection from.
     * @param startingAddress the address that the listing should start after.
     * @param options the options for the request.
     * @returns A promise that resolves with the result of the operation.
     *
     * @example List search collections
     * const result = await os.listSearchCollections('recordName', 'mySearchCollection');
     *
     * @dochash actions/os/records/search
     * @docgroup 02-search
     * @docname os.listSearchCollections
     */
    function listSearchCollections(
        recordName: string,
        startingAddress?: string,
        options: ListDataOptions = {}
    ): Promise<CrudListItemsResult<SearchRecord>> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                listSearchCollections: {
                    input: {
                        recordName,
                        address: startingAddress,
                    },
                },
            },
            options,
            task.taskId
        );

        return addAsyncAction(task, event);
    }

    /**
     * Lists the search collections in a record by a specific marker.
     * @param recordName The name of the record to list the search collections from.
     * @param marker The marker to filter the list by.
     * @param startingAddress The address that the listing should start after.
     * @param options The options for the request.
     * @returns A promise that resolves with the result of the operation.
     *
     * @example List public read search collections
     * const result = await os.listSearchCollectionsByMarker('recordName', 'publicRead');
     *
     * @example List private search collections
     * const result = await os.listSearchCollectionsByMarker('recordName', 'private');
     *
     * @dochash actions/os/records/search
     * @docgroup 02-search
     * @docname os.listSearchCollectionsByMarker
     */
    function listSearchCollectionsByMarker(
        recordName: string,
        marker: string,
        startingAddress?: string,
        options: ListDataOptions = {}
    ): Promise<CrudListItemsResult<SearchRecord>> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                listSearchCollections: {
                    input: {
                        recordName,
                        marker,
                        address: startingAddress,
                        sort: options?.sort,
                    },
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets a search collection from the specified record.
     * @param recordName The name of the record to retrieve the search collection from.
     * @param address The address of the search collection to retrieve.
     * @param options The options for the request.
     * @returns A promise that resolves with the result of the operation.
     *
     * @example Get a search collection
     * const result = await os.getSearchCollection('myRecord', 'mySearchCollection');
     *
     * @example Search through a search collection
     * import Typesense from 'typesense';
     * const collection = await os.getSearchCollection('myRecord', 'mySearchCollection');
     *
     * if (!collection.success) {
     *    os.toast('Failed to get search collection: ' + collection.errorMessage);
     *    return;
     * }
     *
     * const client = new Typesense.Client({
     *   nodes: collection.item.nodes,
     *   apiKey: collection.item.searchApiKey,
     * });
     *
     * const searchResults = await client.collections(collection.item.collectionName).documents().search({
     *   q: 'search term',
     *   query_by: 'title,description',
     *   sort_by: 'price:asc',
     * });
     *
     * console.log('search results', searchResults);
     *
     * @dochash actions/os/records/search
     * @docgroup 02-search
     * @docname os.getSearchCollection
     */
    function getSearchCollection(
        recordName: string,
        address: string,
        options: RecordActionOptions = {}
    ): Promise<CrudGetItemResult<SearchRecordOutput>> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                getSearchCollection: {
                    input: {
                        recordName,
                        address,
                    },
                },
            },
            options,
            task.taskId
        );

        return addAsyncAction(task, event);
    }

    /**
     * Records a search document to the specified search collection in the given record.
     * @param request The request to record the search document.
     * @param options The options for the request.
     * @returns A promise that resolves with the result of the operation.
     *
     * @example Record a search document
     * const result = await os.recordSearchDocument({
     *    recordName: 'myRecord',
     *    address: 'mySearchCollection',
     *    document: {
     *      // ensure that the document matches the schema of the search collection
     *      title: 'My Document',
     *      description: 'This is the content of my document.'
     *      price: 10,
     *    }
     * });
     *
     * @dochash actions/os/records/search
     * @docgroup 02-search
     * @docname os.recordSearchDocument
     */
    function recordSearchDocument(
        request: RecordSearchDocumentApiRequest,
        options: RecordActionOptions = {}
    ): Promise<StoreDocumentResult> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                recordSearchDocument: {
                    input: {
                        recordName: request.recordName,
                        address: request.address,
                        document: request.document,
                    },
                },
            },
            options,
            task.taskId
        );

        return addAsyncAction(task, event);
    }

    /**
     * Erases a search document from the specified search collection in the given record.
     * @param recordName The name of the record that the search document is in.
     * @param address The address of the search collection that the document is in.
     * @param documentId The ID of the document that should be erased.
     * @param options The options for the request.
     * @returns A promise that resolves with the result of the operation.
     *
     * @example Erase a search document
     * const result = await os.eraseSearchDocument('myRecord', 'mySearchCollection', 'documentId');
     *
     * @dochash actions/os/records/search
     * @docgroup 02-search
     * @docname os.eraseSearchDocument
     */
    function eraseSearchDocument(
        recordName: string,
        address: string,
        documentId: string,
        options: RecordActionOptions = {}
    ): Promise<EraseDocumentResult> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                eraseSearchDocument: {
                    input: {
                        recordName: recordName,
                        address: address,
                        documentId: documentId,
                    },
                },
            },
            options,
            task.taskId
        );

        return addAsyncAction(task, event);
    }

    /**
     * Creates or updates a database in the given record.
     *
     * Databases are used to store and manage structured data within a record.
     * They use the [SQL programming language](https://www.sqlite.org/lang.html), which is a powerful programming language designed to manage relational databases.
     *
     * Returns a promise that resolves with the result of the operation.
     *
     * @param request The request to create or update the database.
     * @param options the options for the request.
     * @returns A promise that resolves with the result of the operation.
     *
     * @example Record a database.
     * const result = await os.recordDatabase({
     *      recordName: 'myRecord',
     *      address: 'myDatabase',
     * });
     *
     * @example Record a private database
     * const result = await os.recordDatabase({
     *      recordName: 'myRecord',
     *      address: 'myDatabase',
     *      markers: ['private']
     * });
     *
     *
     * @doctitle Database Actions
     * @docsidebar Database
     * @docdescription Database actions allow you to create and manage databases in your records. Databases enable efficient storage and retrieval of structured data within your records, making it easier to manage and query information.
     * @dochash actions/os/records/database
     * @docgroup 02-database
     * @docname os.recordDatabase
     * @docid recordDatabase
     */
    function recordDatabase(
        request: RecordSearchCollectionApiRequest,
        options: RecordActionOptions = {}
    ): Promise<CrudRecordItemResult> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                recordDatabase: {
                    input: {
                        recordName: request.recordName,
                        item: {
                            address: request.address,
                            markers: request.markers as [string, ...string[]],
                        },
                    },
                },
            },
            options,
            task.taskId
        );

        return addAsyncAction(task, event);
    }

    /**
     * Deletes a database along with all the data in it.
     *
     * Returns a promise that resolves with the result of the operation.
     *
     * @param recordName The name of the record to delete the database from.
     * @param address The address of the database to delete.
     * @param options the options for the request.
     * @returns A promise that resolves with the result of the operation.
     *
     * @example Erase a database
     * const result = await os.eraseDatabase('recordName', 'myDatabase');
     *
     * @dochash actions/os/records/database
     * @docgroup 02-database
     * @docname os.eraseDatabase
     * @docid eraseDatabase
     */
    function eraseDatabase(
        recordName: string,
        address: string,
        options: RecordActionOptions = {}
    ): Promise<CrudRecordItemResult> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                eraseDatabase: {
                    input: {
                        recordName,
                        address,
                    },
                },
            },
            options,
            task.taskId
        );

        return addAsyncAction(task, event);
    }

    /**
     * Lists the databases in a record.
     *
     * Returns a promise that resolves with the result of the operation.
     *
     * @param recordName The name of the record to delete the search collection from.
     * @param startingAddress the address that the listing should start after.
     * @param options the options for the request.
     * @returns A promise that resolves with the result of the operation.
     *
     * @example List databases
     * const result = await os.listDatabases('recordName', 'myDatabase');
     *
     * @dochash actions/os/records/database
     * @docgroup 02-database
     * @docname os.listDatabases
     * @docid listDatabases
     */
    function listDatabases(
        recordName: string,
        startingAddress?: string,
        options: ListDataOptions = {}
    ): Promise<CrudListItemsResult<DatabaseRecordOutput>> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                listDatabases: {
                    input: {
                        recordName,
                        address: startingAddress,
                    },
                },
            },
            options,
            task.taskId
        );

        return addAsyncAction(task, event);
    }

    /**
     * Lists the databases in a record by a specific marker.
     * @param recordName The name of the record to list the databases from.
     * @param marker The marker to filter the list by.
     * @param startingAddress The address that the listing should start after.
     * @param options The options for the request.
     * @returns A promise that resolves with the result of the operation.
     *
     * @example List public read databases
     * const result = await os.listDatabasesByMarker('recordName', 'publicRead');
     *
     * @example List private databases
     * const result = await os.listDatabasesByMarker('recordName', 'private');
     *
     * @dochash actions/os/records/database
     * @docgroup 02-database
     * @docname os.listDatabasesByMarker
     */
    function listDatabasesByMarker(
        recordName: string,
        marker: string,
        startingAddress?: string,
        options: ListDataOptions = {}
    ): Promise<CrudListItemsResult<DatabaseRecordOutput>> {
        const task = context.createTask();
        const event = recordsCallProcedure(
            {
                listDatabases: {
                    input: {
                        recordName,
                        marker,
                        address: startingAddress,
                        sort: options?.sort,
                    },
                },
            },
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets basic info about a database from the specified record.
     *
     * @param recordName The name of the record to retrieve the database from.
     * @param address The address of the database to retrieve.
     * @param options The options for the request.
     *
     * @returns A promise that resolves with the result of the operation.
     *
     * @example Get a database and query a table
     * const db = os.getDatabase('myRecord', 'myDatabase');
     * const result = await db.query`SELECT * FROM myTable`;
     *
     * @example Insert a new row
     * const value1 = 'abc';
     * const value2 = 123;
     * const result = await db.execute`INSERT INTO myTable (column1, column2) VALUES (${value1}, ${value2})`;
     *
     * @example Run multiple queries in a transaction
     * const values = [
     *   ['apple', 10],
     *   ['car', 25000],
     *   ['strawberry', 1],
     *   ['lego', 5]
     * ];
     *
     * const result = await db.batch(
     *   values.map(([name, value]) => db.sql`INSERT INTO data (name, value) VALUES (${name}, ${value})`)
     * );
     *
     * @dochash actions/os/records/database
     * @docgroup 02-database
     * @docname os.getDatabase
     */
    function getDatabase(
        recordName: string,
        address: string,
        options: RecordActionOptions = {}
    ): ApiDatabase {
        return new ApiDatabase(recordName, address, options, context);
    }

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
    function listUserStudios(endpoint?: string): Promise<ListStudiosResult> {
        let options: RecordActionOptions = {};
        if (hasValue(endpoint)) {
            options.endpoint = endpoint;
        }

        const task = context.createTask();
        const event = calcListUserStudios(options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Gets the list of records that are in the studio with the given ID.
     *
     * Returns a promise that resolves with an object that contains the list of records (if successful) or information about the error that occurred.
     * The user must be a member of the studio to access its records.
     *
     * @param studioId The ID of the studio to list records for.
     * @param endpoint the HTTP Endpoint of the records website that the data should be retrieved from. If omitted, then the preconfigured records endpoint will be used.
     *
     * @example Get the list of records in a studio
     * const result = await os.listStudioRecords('studioId123');
     *
     * if (result.success) {
     *      os.toast(`Found ${result.records.length} records in studio`);
     *      for (const record of result.records) {
     *          os.toast(`Record: ${record.name}`);
     *      }
     * } else {
     *      os.toast('Failed to list studio records: ' + result.errorMessage);
     * }
     *
     * @dochash actions/os/records
     * @docgroup 01-records
     * @docid os.listStudioRecords
     * @docname os.listStudioRecords
     */
    function listStudioRecords(
        studioId: string,
        endpoint?: string
    ): Promise<ListRecordsResult> {
        let options: RecordActionOptions = {};
        if (hasValue(endpoint)) {
            options.endpoint = endpoint;
        }

        const task = context.createTask();
        const event = calcListStudioRecords(studioId, options, task.taskId);
        return addAsyncAction(task, event);
    }

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
    function getRecordsEndpoint(): Promise<string> {
        const task = context.createTask();
        const event = calcGetRecordsEndpoint(task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Creates or updates a store item in a record.
     *
     * Returns a promise that resolves with an object that indicates whether the operation was successful or unsuccessful.
     *
     * @param recordName the name of the record that the store item should be created or updated in.
     * @param address the address of the item in the record.
     * @param item the item that should be stored in the record.
     * @param options the options that should be used to store the item.
     *
     * @example Record an item that can be purchased by anyone
     * await os.recordStoreItem('myRecord', 'myItem', {
     *    name: 'My Item',
     *    description: 'Description of my item!'
     *    imageUrls: [],
     *    currency: 'usd',
     *    cost: 100, // $1.00
     *    roleName: 'roleToBeGranted',
     *    roleGrantTimeMs: null,
     *    markers: ['publicRead']
     * });
     *
     * @dochash actions/os/records
     * @docgroup 01-store
     * @docname os.recordStoreItem
     */
    function recordStoreItem(
        recordName: string,
        address: string,
        item: StoreItem,
        options: RecordActionOptions = {}
    ): Promise<CrudRecordItemResult> {
        const task = context.createTask();
        const event = calcRecordStoreItem(
            recordName,
            address,
            item,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the item with the given address from the specified record.
     *
     * Returns a promise that resolves with the item that was stored in the record.
     *
     * @param recordName the name of the record that the store item should be retrieved from.
     * @param address the address of the item in the record.
     * @param options the options that should be used to get the item.
     *
     * @example Get an item by address
     * const item = await os.getStoreItem('myRecord', 'myItem');
     *
     * @dochash actions/os/records
     * @docgroup 01-store
     * @docname os.getStoreItem
     */
    function getStoreItem(
        recordName: string,
        address: string,
        options: RecordActionOptions = {}
    ): Promise<CrudGetItemResult<PurchasableItem>> {
        const task = context.createTask();
        const event = calcGetStoreItem(
            recordName,
            address,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Deletes the item with the given address from the specified record.
     *
     * Returns a promise that resolves with the status of the operation.
     *
     * @param recordName the name of the record that the store item should be deleted from.
     * @param address the address of the item that should be deleted.
     * @param options the options that should be used to get the item.
     *
     * @example Delete an item by address
     * const result = await os.eraseStoreItem('myRecord', 'myItem');
     *
     * @dochash actions/os/records
     * @docgroup 01-store
     * @docname os.eraseStoreItem
     */
    function eraseStoreItem(
        recordName: string,
        address: string,
        options: RecordActionOptions = {}
    ): Promise<CrudEraseItemResult> {
        const task = context.createTask();
        const event = calcEraseStoreItem(
            recordName,
            address,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets a partial list of store items from the given record.
     * You must have permission to access all items in the record to list them.
     *
     * Returns a promise that contains the items in the list.
     *
     * @param recordName the name of the record that the store item should be deleted from.
     * @param startingAddress the address that the items should be listed after.
     * @param options the options that should be used to get the item.
     *
     * @example List all items in the record
     * const result = await os.listStoreItems('myRecord');
     *
     * @dochash actions/os/records
     * @docgroup 01-store
     * @docname os.listStoreItems
     */
    function listStoreItems(
        recordName: string,
        startingAddress: string = null,
        options: RecordActionOptions = {}
    ): Promise<CrudListItemsResult<PurchasableItem>> {
        const task = context.createTask();
        const event = calcListStoreItems(
            recordName,
            startingAddress,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets a partial list of store items that have the given marker from the given record.
     * You must have permission to access the given marker in the record to list them.
     *
     * Returns a promise that contains the items in the list.
     *
     * @param recordName the name of the record that the store item should be deleted from.
     * @param marker the marker that the items should have.
     * @param startingAddress the address that the items should be listed after.
     * @param options the options that should be used to get the item.
     *
     * @example List all items in the record with the 'publicRead' marker
     * const result = await os.listStoreItemsByMarker('myRecord', 'publicRead');
     *
     * @dochash actions/os/records
     * @docgroup 01-store
     * @docname os.listStoreItemsByMarker
     */
    function listStoreItemsByMarker(
        recordName: string,
        marker: string,
        startingAddress: string = null,
        options: RecordActionOptions = {}
    ): Promise<CrudListItemsResult<PurchasableItem>> {
        const task = context.createTask();
        const event = calcListStoreItemsByMarker(
            recordName,
            marker,
            startingAddress,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Attempts to purchase the given store item from the specified record.
     *
     * Returns a promise that resolves when the
     *
     * @param recordName the name of the record that the store item should be purchased from.
     * @param item the item that should be purchased from the store.
     * @param options the options that should be used to purchase the item.
     *
     * @example Purchase an item from the store
     * const item = await os.getStoreItem('myRecord', 'myItem');
     * const result = await os.purchaseStoreItem('myRecord', item);
     *
     * console.log(result);
     *
     * @dochash actions/os/records
     * @docgroup 01-store
     * @docname os.purchaseStoreItem
     */
    function purchaseStoreItem(
        recordName: string,
        item: PurchasableItemReference,
        options: RecordActionOptions = {}
    ): Promise<void> {
        const task = context.createTask();
        const event = calcPurchaseStoreItem(
            recordName,
            item,
            options,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Converts the given geolocation to a [what3words](https://what3words.com/) address. Returns a promise that resolves with the 3 word address.
     * @param location The latitude and longitude that should be converted to a 3 word address.
     *
     * @example Get the current geolocation as a 3 word address
     * const location = await os.getGeolocation();
     *
     * if (location.success) {
     *     const address = await os.convertGeolocationToWhat3Words(location);
     *     os.toast(address);
     * } else {
     *     os.tost("Could not get geolocation");
     * }
     *
     * @example Get the location of the Amway Grand as a 3 word address
     * const address = await os.convertGeolocationToWhat3Words({
     *     latitude: 42.966824756903755,
     *     longitude: -85.67309821404483,
     * });
     * os.toast(address);
     *
     * @dochash actions/os/geolocation
     * @docname os.convertGeolocationToWhat3Words
     * @docgroup 10-geolocation
     */
    function convertGeolocationToWhat3Words(
        location: ConvertGeolocationToWhat3WordsOptions
    ): Promise<string> {
        const task = context.createTask();
        const event = calcConvertGeolocationToWhat3Words(location, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Finds the list of bots that are in the given portal and are intersected by a ray starting at the portal camera and traveling along a path emanating from the given viewport position.
     * Returns a promise that resolves with information about the intersected bots.
     *
     * @param portal the portal that should be tested.
     * @param viewportCoordinates the 2D viewport position that the ray should start at.
     * Viewport positions locate a specific point on the image that the camera produces.
     * `(X: 0, Y: 0)` represents the center of the camera while `(X: -1, Y: -1)` represents the lower left corner and `(X: 1, Y: 1)` represents the upper right corner.
     *
     * @example Find the bots that are in the center of the screen
     * const result = await os.raycastFromCamera("grid", new Vector2(0, 0));
     * os.toast('Found Bots: ' + result.botIntersections.map(b => b.id).join(', '));
     *
     * @example Find the bots that are on the left-center edge of the screen
     * const result = await os.raycastFromCamera("grid", new Vector2(-1, 0));
     * os.toast('Found Bots: ' + result.botIntersections.map(b => b.id).join(', '));
     *
     * @dochash actions/os/portals
     * @docname os.raycastFromCamera
     * @docgroup 10-raycast
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
     * Finds the list of bots that are in the given portal and are intersected by a ray starting at the given origin position and traveling in the given direction.
     * Returns a promise that resolves with information about the intersected bots.
     *
     * @param portal the name of the portal that should be tested.
     * @param origin the 3D position that the ray should start at.
     * @param direction the 3D direction that the ray should travel along.
     *
     * @example Find the bots that are directly to the right of `(0,0,0)` in the grid portal
     * const result = await os.raycast("grid", new Vector3(0, 0, 0), new Vector3(1, 0, 0));
     * os.toast('Found Bots: ' + result.botIntersections.map(b => b.id).join(', '));
     *
     * @example Find the bots that the mouse pointer is pointing at in the grid portal
     * const result = await os.raycast("grid", os.getPointerPosition("mouse"), os.getPointerDirection("mouse"));
     * os.toast('Found Bots: ' + result.botIntersections.map(b => b.id).join(', '));
     *
     * @dochash actions/os/portals
     * @docname os.raycast
     * @docgroup 10-raycast
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
     * Calculates the ray that starts at the given portal camera and travels along the path emanating from the given viewport position.
     * Returns a promise that resolves with information about the calculated ray.
     *
     * @param portal the name of the portal that should be tested.
     * @param viewportCoordinates the 2D viewport position that the ray should start at.
     * Viewport positions locate a specific point on the image that the camera produces.
     * `(X: 0, Y: 0)` represents the center of the camera while `(X: -1, Y: -1)` represents the lower left corner and `(X: 1, Y: 1)` represents the upper right corner.
     *
     * @example Find the ray that passes through the center of the screen
     * const ray = await os.calculateRayFromCamera("grid", new Vector2(0, 0));
     * os.toast('Calculated ray: ' + ray);
     *
     * @example Find the ray that passes through the left-center edge of the screen
     * const ray = await os.raycastFromCamera("grid", new Vector2(-1, 0));
     * os.toast('Calculated ray: ' + ray);
     *
     * @dochash actions/os/portals
     * @docname os.calculateRayFromCamera
     * @docgroup 10-raycast
     */
    function calculateRayFromCamera(
        portal: 'grid' | 'miniGrid' | 'map' | 'miniMap',
        viewportCoordinates: Vector2
    ): Promise<RaycastRay> {
        const task = context.createTask();
        const event = calcCalculateRayFromCamera(
            portal,
            { x: viewportCoordinates.x, y: viewportCoordinates.y },
            task.taskId
        );
        return addAsyncAction(task, event);
    }

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
     *
     * @dochash actions/os/portals
     * @docname os.calculateViewportCoordinatesFromPosition
     * @docgroup 10-raycast
     */
    function calculateViewportCoordinatesFromPosition(
        portal: 'grid' | 'miniGrid' | 'map' | 'miniMap',
        position: Vector3
    ): Promise<Vector2> {
        const task = context.createTask();
        const event = calcCalculateViewportCoordinatesFromPosition(
            portal,
            { x: position.x || 0, y: position.y || 0, z: position.z || 0 },
            task.taskId
        );
        return addAsyncAction(task, event);
    }

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
    function calculateScreenCoordinatesFromViewportCoordinates(
        portal: 'grid' | 'miniGrid' | 'map' | 'miniMap',
        coordinates: Point2D
    ): Promise<Vector2> {
        const task = context.createTask();
        const event = calcCalculateScreenCoordinatesFromViewportCoordinates(
            portal,
            {
                x: coordinates.x || 0,
                y: coordinates.y || 0,
            },
            task.taskId
        );
        return addAsyncAction(task, event);
    }

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
    function calculateScreenCoordinatesFromPosition(
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
    function calculateScreenCoordinatesFromPosition(
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
    function calculateScreenCoordinatesFromPosition(
        portal: 'grid' | 'miniGrid' | 'map' | 'miniMap',
        coordinates: Point3D | Point3D[]
    ): Promise<Vector2[] | Vector2> {
        const task = context.createTask();
        const event = calcCalculateScreenCoordinatesFromPosition(
            portal,
            Array.isArray(coordinates) ? coordinates : [coordinates],
            task.taskId
        );
        const promise = addAsyncAction(task, event);

        if (Array.isArray(coordinates)) {
            return promise;
        } else {
            const final = promise.then((r) => {
                if (Array.isArray(r) && r.length === 1) {
                    return r[0];
                }
                return r;
            });
            (final as any)[ORIGINAL_OBJECT] = event;
            return final;
        }
    }

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
    function calculateViewportCoordinatesFromScreenCoordinates(
        portal: 'grid' | 'miniGrid' | 'map' | 'miniMap',
        coordinates: Point2D
    ): Promise<Vector2> {
        const task = context.createTask();
        const event = calcCalculateViewportCoordinatesFromScreenCoordinates(
            portal,
            {
                x: coordinates.x || 0,
                y: coordinates.y || 0,
            },
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Pre-caches the given GLTF mesh address so that it will load instantly when used on a bot later.
     * Returns a promise that resolves once the address has been cached.
     * @param address The address that should be cached.
     *
     * @example Buffer a specific GLTF
     * await os.bufferFormAddressGLTF('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF/Fox.gltf');
     * os.toast("Buffered!");
     *
     * @dochash actions/os/animations
     * @docname os.bufferFormAddressGLTF
     */
    function bufferFormAddressGLTF(address: string): Promise<void> {
        const task = context.createTask();
        const event = bufferFormAddressGltf(address, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Starts the given animation on the given bot or list of bots using the given options. Returns a promise that resolves once the animation(s) have been started.
     *
     * Triggers the {@tag @onFormAnimationStarted} and {@tag @onAnyFormAnimationStarted} listeners once the animation has started.
     *
     * @param botOrBots the bot or list of bots that the animation should be started on.
     * @param nameOrIndex the name of the animation that should be started. Additionally, it can be the index number of the animation that should be played.
     * @param options the options that should be used to play the animation.
     *
     * @example Start the "Run" animation on this bot
     * await os.startFormAnimation(thisBot, "Run");
     *
     * @example Start the "Run" animation on every bot in the home dimension
     * await os.startFormAnimation(getBots(inDimension("home")), "Run");
     *
     * @example Start an animation that loops 5 times
     * await os.startFormAnimation(thisBot, "Run", {
     *     loop: {
     *         mode: 'repeat',
     *         count: 5
     *     }
     * });
     *
     * @example Start an animation which starts playing 5 seconds in the future
     * await os.startFormAnimation(thisBot, "Run", {
     *     startTime: os.localTime + 5000
     * });
     *
     * @example Start an animation which plays at half its normal speed
     * await os.startFormAnimation(thisBot, "Run", {
     *     timeScale: 0.5
     * });
     *
     * @dochash actions/os/animations
     * @doctitle Animation Actions
     * @docsidebar Animations
     * @docdescription Actions for playing animations on bots.
     * @docname os.startFormAnimation
     * @docgroup 10-animations
     * @docorder 0
     */
    function startFormAnimation(
        botOrBots: Bot | string | (Bot | string)[],
        nameOrIndex: string | number,
        options?: StartFormAnimationOptions
    ): Promise<void> {
        const task = context.createTask();

        const botIds = Array.isArray(botOrBots)
            ? botOrBots.map((b) => (isBot(b) ? b.id : b))
            : [isBot(botOrBots) ? botOrBots.id : botOrBots];

        const event = calcStartFormAnimation(
            botIds,
            nameOrIndex,
            options ?? {},
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Stops the animations that are running on the given bot or list of bots using the given options. Returns a promise that resolves once the animations have been stopped.
     *
     * This function only works for animations that have been started by {@link os.startFormAnimation}.
     *
     * Triggers the {@tag @onFormAnimationStopped} and {@tag @onAnyFormAnimationStopped} listeners once the animation has stopped.
     *
     * @param botOrBots the bot or list of bots whose animations should be stopped.
     * @param options the options that should be used for stopping the animations.
     *
     * @example Stop the animations on this bot
     * await os.stopFormAnimation(thisBot);
     *
     * @example Slowly stop the animations on this bot
     * await os.stopFormAnimation(thisBot, {
     *     fadeDuration: 1000 // Take 1 second to stop the animation
     * });
     *
     * @example Stop the current animation 5 seconds in the future
     * await os.stopFormAnimation(thisBot, {
     *     stopTime: os.localTime + 5000
     * });
     *
     * @dochash actions/os/animations
     * @docname os.stopFormAnimation
     * @docgroup 10-animations
     * @docorder 1
     */
    function stopFormAnimation(
        botOrBots: Bot | string | (Bot | string)[],
        options?: StopFormAnimationOptions
    ): Promise<void> {
        const task = context.createTask();

        const botIds = Array.isArray(botOrBots)
            ? botOrBots.map((b) => (isBot(b) ? b.id : b))
            : [isBot(botOrBots) ? botOrBots.id : botOrBots];

        const event = calcStopFormAnimation(botIds, options ?? {}, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Retrieves the list of animations that are available on the given bot or GLTF mesh address.
     * Returns a promise that resolves with the list of available animations.
     *
     * @param botOrAddress the bot or address that the animation list should be retrieved from
     *
     * @example Get the list of animations on this bot
     * const animations = await os.listFormAnimations(thisBot);
     *
     * @example Get the list of animations for a specific address
     * const animations = await os.listFormAnimations('https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF/Fox.gltf');
     *
     * @dochash actions/os/animations
     * @docname os.listFormAnimations
     * @docgroup 10-animations
     * @docorder 2
     */
    function listFormAnimations(
        botOrAddress: Bot | string
    ): Promise<FormAnimationData[]> {
        let address: string;
        let bot = isBot(botOrAddress)
            ? botOrAddress
            : context.state[botOrAddress];
        if (bot) {
            address =
                calculateStringTagValue(
                    null,
                    bot,
                    'auxFormAnimationAddress',
                    null
                ) ?? calculateStringTagValue(null, bot, 'auxFormAddress', null);
        } else if (typeof botOrAddress === 'string') {
            address = botOrAddress;
        }

        if (!hasValue(address)) {
            return Promise.resolve([]);
        }

        const task = context.createTask();
        const event = calcListFormAnimations(address, task.taskId);
        return addAsyncAction(task, event);
    }

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
    function ldrawCountAddressBuildSteps(address: string): Promise<number> {
        const task = context.createTask();
        const event = calcLdrawCountAddressBuildSteps(address, task.taskId);
        return addAsyncAction(task, event);
    }

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
    function ldrawCountTextBuildSteps(text: string): Promise<number> {
        const task = context.createTask();
        const event = calcLdrawCountTextBuildSteps(text, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Sends an event to attach the given debugger to the CasualOS frontend.
     * @param debug The debugger that should be attached.
     */
    function attachDebugger(
        debug: DebuggerInterface,
        options: AttachDebuggerOptions = {}
    ): Promise<void> {
        const runtime = debug[GET_RUNTIME]();
        const task = context.createTask();
        const event = attachRuntime(
            runtime,
            options.tagNameMapper,
            task.taskId
        );
        return addAsyncAction(task, event as any);
    }

    /**
     * Sends an event to detach the given debugger from the CasualOS frontend.
     * @param debug The debugger that should be detached.
     */
    function detachDebugger(debug: DebuggerInterface): Promise<void> {
        const runtime = debug[GET_RUNTIME]();
        const task = context.createTask();
        const event = detachRuntime(runtime, task.taskId);
        return addAsyncAction(task, event as any);
    }

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
     * @dochash actions/os/maps
     * @doctitle Map Actions
     * @docsidebar Maps
     * @docdescription Actions for working with maps and map layers.
     * @docid os.addMapLayer
     * @docname os.addMapLayer
     */
    function addMapLayer(
        portal: 'map' | 'miniMap',
        layer: MapLayer
    ): Promise<string> {
        const task = context.createTask();
        const event = calcAddMapLayer(portal, layer, task.taskId);
        return addAsyncAction(task, event);
    }

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
     * @dochash actions/os/maps
     * @docid os.removeMapLayer
     * @docname os.removeMapLayer
     */
    function removeMapLayer(layerId: string): Promise<void> {
        const task = context.createTask();
        const event = calcRemoveMapLayer(layerId, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Adds a map layer to a bot with form: "map".
     *
     * Returns a promise that resolves with the ID of the layer that was added.
     *
     * @param bot The bot that should have the layer added.
     * @param overlay The overlay configuration.
     *
     * @example Add a GeoJSON layer to a map bot
     * const layerId = await os.addBotMapLayer(bot, {
     *     type: 'geojson',
     *     data: {
     *         type: "FeatureCollection",
     *         features: [...]
     *     }
     * });
     */
    function addBotMapLayer(
        bot: Bot | string,
        overlay: {
            overlayType?: 'geojson';
            type?: 'geojson';
            data: any;
            overlayId?: string;
        }
    ): Promise<string> {
        const task = context.createTask();
        const botId = typeof bot === 'string' ? bot : bot.id;

        const normalizedOverlay = {
            ...overlay,
            overlayType: overlay.overlayType || overlay.type || 'geojson',
        };

        const action: AddBotMapLayerAction = {
            type: 'add_bot_map_layer',
            botId: botId,
            overlay: normalizedOverlay,
            taskId: task.taskId,
        };
        return addAsyncAction(task, action);
    }

    /**
     * Removes a layer from a bot with form: "map".
     *
     * @param bot The bot that has the layer.
     * @param overlayId The ID of the overlay to remove.
     *
     * @example Remove a layer from a map bot
     * await os.removeBotMapLayer(bot, 'my-layer-id');
     */
    function removeBotMapLayer(
        bot: Bot | string,
        overlayId: string
    ): Promise<void> {
        const task = context.createTask();
        const botId = typeof bot === 'string' ? bot : bot.id;

        const action: RemoveBotMapLayerAction = {
            type: 'remove_bot_map_layer',
            botId: botId,
            overlayId: overlayId,
            taskId: task.taskId,
        };
        return addAsyncAction(task, action);
    }

    /**
     * Executes the given shell script on the server.
     * @param script The shell script  that should be executed.
     */
    function shell(script: string): RemoteAction | RemoteAction[] {
        return remote(calcShell(script));
    }

    /**
     * Gets the number of remotes that are viewing the current inst.
     * Optionally takes a parameter which is the inst that the number of remotes should be retrieved for.
     * If omitted, then the current inst will be checked. Returns a promise that resolves with the number of active remotes.
     *
     * @param inst the name of the inst that the number of remotes should be retrieved for. If not specified, then the current inst current inst will be used.
     *
     * @example Get the number of remotes in the current inst.
     * const numberOfRemotes = await os.remoteCount();
     * os.toast("Number of Remotes: " + numberOfRemotes);
     *
     * @example Get the number of remotes in the `test` inst.
     * const numberOfRemotes = await os.remoteCount('test');
     * os.toast("Number of Remotes: " + numberOfRemotes);
     *
     * @dochash actions/os/remotes
     * @doctitle Remote Actions
     * @docsidebar Remotes
     * @docdescription Actions for getting information about other places or devices (remotes).
     * @docname os.remoteCount
     * @docgroup 10-remotes
     */
    function serverRemoteCount(inst?: string): Promise<number> {
        const task = context.createTask(true, true);
        const actualServer = hasValue(inst) ? inst : getCurrentServer();
        const event = calcRemote(
            getRemoteCount(null, actualServer, DEFAULT_BRANCH_NAME),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets the number of devices that are connected to the server. Returns a promise that resolves with the number of active devices.
     *
     * @example Get the number of devices on the server.
     * const numberOfDevices = await os.totalRemoteCount();
     * os.toast("Number of Devices: " + numberOfDevices);
     *
     * @dochash actions/os/remotes
     * @docname os.totalRemoteCount
     * @docgroup 10-remotes
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
     *
     * @example Get a map from a shared document.
     * const doc = await os.getSharedDocument('myDocument');
     * const map = doc.getMap('myValues');
     * map.set('myKey', 'myValue');
     *
     * @example Get an array from a shared document.
     * const doc = await os.getSharedDocument('myDocument');
     * const array = doc.getArray('myArray');
     * array.push('myValue');
     *
     * @example Get text from a shared document
     * const doc = await os.getSharedDocument('myDocument');
     * const text = doc.getText('myText');
     * text.insert(0, 'Hello, World!');
     *
     * os.toast(text.toString());
     *
     * @example Efficiently batch multiple updates
     * const doc = await os.getSharedDocument('myDocument');
     * doc.transact(() => {
     *    const map = doc.getMap('myValues');
     *    map.set('myKey', 'myValue');
     *    map.set('myKey2', 'myValue2');
     *    map.set('myKey3', 'myValue3');
     * });
     *
     * @dochash actions/os/documents
     * @doctitle Document Actions
     * @docsidebar Documents
     * @docdescription Actions for working with shared documents.
     * @docname os.getSharedDocument
     * @docid os.getShareDocument-name
     */
    function getSharedDocument(name: string): Promise<SharedDocument>;

    /**
     * Gets a shared document record from the given inst by its name.
     *
     * Shared documents are a way to share data across insts in a easy and secure manner.
     *
     * Returns a promise that resolves with the shared document.
     * @param recordName The name of the record. If null, then a public inst will be used.
     * @param inst The name of the inst that the shared document is in.
     * @param branch The name of the branch that the shared document is in.
     *
     * @example Get a shared document from the given inst.
     * const sharedDocument = await os.getSharedDocument('recordName', 'myInst', 'myDocument');
     *
     * @example Get a map from a shared document.
     * const doc = await os.getSharedDocument('recordName', 'myInst', 'myDocument');
     * const map = doc.getMap('myValues');
     * map.set('myKey', 'myValue');
     *
     * @example Get an array from a shared document.
     * const doc = await os.getSharedDocument('recordName', 'myInst', 'myDocument');
     * const array = doc.getArray('myArray');
     * array.push('myValue');
     *
     * @example Get text from a shared document
     * const doc = await os.getSharedDocument('recordName', 'myInst', 'myDocument');
     * const text = doc.getText('myText');
     * text.insert(0, 'Hello, World!');
     *
     * os.toast(text.toString());
     *
     * @example Efficiently batch multiple updates
     * const doc = await os.getSharedDocument('recordName', 'myInst', 'myDocument');
     * doc.transact(() => {
     *    const map = doc.getMap('myValues');
     *    map.set('myKey', 'myValue');
     *    map.set('myKey2', 'myValue2');
     *    map.set('myKey3', 'myValue3');
     * });
     *
     * @dochash actions/os/documents
     * @docname os.getSharedDocument
     * @docid os.getSharedDocument-recordName-inst-name
     */
    function getSharedDocument(
        recordName: string | null,
        inst: string,
        name: string
    ): Promise<SharedDocument>;

    /**
     * Gets a shared document from the current inst with the given options.
     *
     * Shared documents are a way to share data across insts in a easy and secure manner.
     *
     * Returns a promise that resolves with the shared document.
     * @param name The name of the document.
     * @param options The options for the shared document.
     *
     * @example Get a shared document with custom markers.
     * const sharedDocument = await os.getSharedDocument('myDocument', {
     *     markers: ['secret', 'team']
     * });
     *
     * @dochash actions/os/documents
     * @docname os.getSharedDocument
     * @docid os.getSharedDocument-name-options
     */
    function getSharedDocument(
        name: string,
        options: { markers?: string[] }
    ): Promise<SharedDocument>;

    /**
     * Gets a shared document record from the given inst by its name with options.
     *
     * Shared documents are a way to share data across insts in a easy and secure manner.
     *
     * Returns a promise that resolves with the shared document.
     * @param recordName The name of the record. If null, then a public inst will be used.
     * @param inst The name of the inst that the shared document is in.
     * @param branch The name of the branch that the shared document is in.
     * @param options The options for the shared document.
     *
     * @example Get a shared document from the given inst with custom markers.
     * const sharedDocument = await os.getSharedDocument('recordName', 'myInst', 'myDocument', {
     *     markers: ['secret', 'team']
     * });
     *
     * @dochash actions/os/documents
     * @docname os.getSharedDocument
     * @docid os.getSharedDocument-recordName-inst-name-options
     */
    function getSharedDocument(
        recordName: string | null,
        inst: string,
        name: string,
        options: { markers?: string[] }
    ): Promise<SharedDocument>;

    function getSharedDocument(
        recordOrName: string,
        inst?: string | { markers?: string[] },
        name?: string,
        options?: { markers?: string[] }
    ): Promise<SharedDocument> {
        const task = context.createTask();
        let recordName: string;
        let instName: string;
        let branchName: string;
        let markers: string[] | undefined;

        if (typeof inst === 'object' && !name && !options) {
            // Called as getSharedDocument(name, options)
            instName = getCurrentServer();
            recordName = getCurrentInstRecord();
            branchName = recordOrName;
            markers = inst?.markers;
        } else if (!inst && !name) {
            // Called as getSharedDocument(name)
            instName = getCurrentServer();
            recordName = getCurrentInstRecord();
            branchName = recordOrName;
        } else {
            // Called as getSharedDocument(recordName, inst, name) or getSharedDocument(recordName, inst, name, options)
            if (typeof inst === 'object') {
                throw new Error(
                    'The second argument (inst) must be a string when calling getSharedDocument() with three or more arguments.'
                );
            }

            recordName = recordOrName;
            instName = inst;
            branchName = name;
            markers = options?.markers;
        }

        const event = loadSharedDocument(
            recordName,
            instName,
            `doc/${branchName}`,
            task.taskId,
            markers
        );

        return addAsyncAction(task, event);
    }

    /**
     * Gets a shared document that is only stored locally on this device.
     *
     * Note that local documents are inst-specific. This means that they are only accessible within the inst they were created in.
     *
     * @param name The name of the document.
     *
     * @example Get a local document.
     * const doc = await os.getLocalDocument('myDocument');
     *
     * @example Get a map from a local document.
     * const doc = await os.getLocalDocument('myDocument');
     * const map = doc.getMap('myValues');
     * map.set('myKey', 'myValue');
     *
     * @example Get an array from a local document.
     * const doc = await os.getLocalDocument('myDocument');
     * const array = doc.getArray('myArray');
     * array.push('myValue');
     *
     * @example Get text from a local document
     * const doc = await os.getLocalDocument('myDocument');
     * const text = doc.getText('myText');
     * text.insert(0, 'Hello, World!');
     *
     * os.toast(text.toString());
     *
     * @example Efficiently batch multiple updates
     * const doc = await os.getLocalDocument('myDocument');
     * doc.transact(() => {
     *    const map = doc.getMap('myValues');
     *    map.set('myKey', 'myValue');
     *    map.set('myKey2', 'myValue2');
     *    map.set('myKey3', 'myValue3');
     * });
     *
     * @dochash actions/os/documents
     * @docname os.getLocalDocument
     */
    function getLocalDocument(name: string): Promise<SharedDocument> {
        const task = context.createTask();
        const event = loadSharedDocument(
            null,
            null,
            `doc/${name}`,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Gets a document that is not shared or saved to the device.
     *
     * @example Get a memory document.
     * const doc = await os.getMemoryDocument('myDocument');
     *
     * @example Get a map from a memory document.
     * const doc = await os.getMemoryDocument('myDocument');
     * const map = doc.getMap('myValues');
     * map.set('myKey', 'myValue');
     *
     * @example Get an array from a memory document.
     * const doc = await os.getMemoryDocument('myDocument');
     * const array = doc.getArray('myArray');
     * array.push('myValue');
     *
     * @example Get text from a memory document
     * const doc = await os.getMemoryDocument('myDocument');
     * const text = doc.getText('myText');
     * text.insert(0, 'Hello, World!');
     *
     * os.toast(text.toString());
     *
     * @example Get the serialized state of the document.
     * const doc = await os.getMemoryDocument('myDocument');
     * const state = doc.getStateUpdate();
     *
     * @example Efficiently batch multiple updates
     * const doc = await os.getLocalDocument('myDocument');
     * doc.transact(() => {
     *    const map = doc.getMap('myValues');
     *    map.set('myKey', 'myValue');
     *    map.set('myKey2', 'myValue2');
     *    map.set('myKey3', 'myValue3');
     * });
     *
     * @dochash actions/os/documents
     * @docname os.getMemoryDocument
     */
    function getMemoryDocument(): Promise<SharedDocument> {
        const task = context.createTask();
        const event = loadSharedDocument(null, null, null, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Gets the list of remote IDs that are connected to the current inst. Returns a promise that resolves with the list of remote IDs.
     *
     * The resolved list will always have at least one value that represents the current remote.
     *
     * @example Get the list of remote IDs.
     * const remotes = await os.remotes();
     * os.toast("Remotes " + remotes.join(','));
     *
     * @dochash actions/os/remotes
     * @docname os.remotes
     * @docgroup 10-remotes
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
     * Gets the list of updates that have occurred in the shared space. Returns a promise that resolves with the list of updates.
     *
     * Useful when combined with {@link os.getInstStateFromUpdates} to track the history of an inst over time.
     *
     * @example Get a list of updates to shared space
     * const updates = await os.listInstUpdates();
     *
     * @dochash actions/os/spaces
     * @docname os.listInstUpdates
     * @docgroup 10-updates
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
     * Calculates the inst state from the given list of updates. Returns a promise that resolves with the bot state that the updates produce.
     *
     * Useful for tracking the history of an inst over time.
     *
     * @param updates The updates that the state should be calculated from.
     *
     * @example Get the last 5 inst states in the shared space
     * const updates = await os.listInstUpdates();
     *
     * let states = [];
     * for(let i = 5; i >= 0; i--) {
     *     const state = await os.getInstStateFromUpdates(updates.slice(0, updates.length - i));
     *     states.push(state);
     * }
     *
     * console.log('States: ', states);
     *
     * @example Calculate the last deltas from shared space updates
     * const updates = await os.listInstUpdates();
     *
     * let lastState;
     * let deltas = [];
     * for(let i = 5; i >= 0; i--) {
     *     const state = await os.getInstStateFromUpdates(updates.slice(0, updates.length - i));
     *
     *     if (lastState) {
     *         const delta = diffSnapshots(lastState, state);
     *         deltas.push(delta);
     *     }
     *
     *     lastState = state;
     * }
     * console.log('Deltas: ', deltas);
     *
     * @dochash actions/os/spaces
     * @docname os.getInstStateFromUpdates
     * @docgroup 10-updates
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
     * Creates an inst update that, when applied, ensures the given bots are created on this inst. Returns a promise that resolves with the inst update.
     *
     * Note that you can apply the same update multiple times and you will end up with only one version of the bots saved in the update. Additionally, future changes to the bots will be preserved even if the update is applied again.
     *
     * This feature makes inst updates useful when you want to ensure that an experience starts in an initial state but also able to change over time.
     *
     * Unlike {@link os.getCurrentInstUpdate}, this function creates an update that is not linked to this inst. This means that applying the update to the inst it was created in will create duplicate bots.
     *
     * @param bots the list of bots that should be included in the update.
     *
     * @example Create an update with this bot and save it to a tag
     * const update = await os.createInitializationUpdate([thisBot]);
     * tags.savedUpdate = update;
     *
     * @example Create an update with all the bots in the home dimension
     * const update = await os.createInitializationUpdate(getBots(inDimension('home')));
     * tags.savedUpdate = update;
     *
     * @dochash actions/os/spaces
     * @docname os.createInitializationUpdate
     * @docgroup 10-updates
     */
    function createInitializationUpdate(
        bots: RuntimeBot[]
    ): Promise<InstUpdate> {
        const convertedBots = bots.map((b) =>
            isRuntimeBot(b) ? createBot(b.id, b.tags.toJSON(), b.space) : b
        );
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcCreateInitalizationUpdate(convertedBots),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Applies the given updates to the current inst. Returns a promise that resolves once the updates have been applied.
     *
     * Note that you can call this function with the same update multiple times and you will end up with only one version of the bots saved in the update. Additionally, future changes to the bots will be preserved even if the update is applied again.
     *
     * This feature makes inst updates useful when you want to ensure that an experience starts in an initial state but also able to change over time.
     *
     * @param updates the list of updates that should be applied to this inst.
     *
     * @example Apply an update that was saved to a tag
     * await os.applyUpdatesToInst([ tags.savedUpdate ]);
     *
     * @dochash actions/os/spaces
     * @docname os.applyUpdatesToInst
     * @docgroup 10-updates
     */
    function applyUpdatesToInst(updates: InstUpdate[]): Promise<void> {
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcApplyUpdatesToInst(updates),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Retrieves an inst update that represents the current local shared state of the inst. Returns a promise that resolves with the update.
     *
     * Note that the inst update only contains bots and tag masks from the `shared` space. Useful for saving the current shared state of the inst so that it can be restored later or transferred to another inst.
     *
     * Unlike {@link os.createInitializationUpdate}, this function creates an update that is linked to this inst. This means that applying the update to the inst it was created in will not create duplicate bots. It is still possible to apply the update to other insts, but it may create duplicate bots depending on the history of the other inst.
     *
     * @example Save the current inst state to a local bot
     * const update = await os.getCurrentInstUpdate();
     * create({
     *     space: 'local',
     *     backup: true,
     *     timestamp: update.timestamp,
     *     update: update
     * });
     *
     * @example Restore from a local bot
     * const savedUpdates = getBots(bySpace('local'), byTag('backup', true));
     * savedUpdates.sort((a, b) => b.timestamp - a.timestamp);
     *
     * if (savedUpdates.length > 0) {
     *     const update = savedUpdates[0].tags.update;
     *     await os.applyUpdatesToInst([update]);
     *     os.toast("Restored!");
     * }
     *
     * @dochash actions/os/spaces
     * @docname os.getCurrentInstUpdate
     * @docgroup 10-updates
     */
    function getCurrentInstUpdate(): Promise<InstUpdate> {
        const task = context.createTask(true, true);
        const event = calcRemote(
            calcGetCurrentInstUpdate(),
            undefined,
            undefined,
            task.taskId
        );
        return addAsyncAction(task, event);
    }

    /**
     * Merges the given updates into a single update. Returns the merged update.
     *
     * This function is useful for compressing a list of updates into a single update that can be applied to an inst.
     *
     * @param updates the list of updates that should be merged.
     *
     * @example Merge a list of updates
     * const merged = os.mergeInstUpdates(updates);
     *
     * @dochash actions/os/spaces
     * @docname os.mergeInstUpdates
     * @docgroup 10-updates
     */
    function mergeInstUpdates(updates: InstUpdate[]): InstUpdate {
        return calcMergeInstUpdates(updates);
    }

    /**
     * Sends the given action to another remote.
     *
     * In CasualOS, all actions are messages which are placed in a queue and processed one at at time.
     *
     * For example, the {@link os.toast} action queues a message which, when processed, will show a toast message.
     * However, before any action is performed, it is run through the {@tag @onAnyAction} listener which can decide whether to reject an action using {@link action.reject}.
     * This lets you write rules for what actions each player is allowed to take.
     *
     * There are a couple special cases. First, when you send/receive an action from someone else (i.e. they sent an action to you using the {@link remote} function), it won't run by default.
     * Instead it is wrapped as a device action and sent to {@tag @onAnyAction} for processing. This lets you decide whether to allow players to send messages to each other and what the effect of those messages are.
     * If you want to perform the action, you can use {@link action.perform} on the inner device action to queue it for execution.
     *
     * @param action the action to send.
     * @param selector the object specifing which remote to send the action to.
     * If not specified, then the action is sent to the server.
     * If specified, then the action is sent to all remotes that match the given values.
     * If given a string, then the action is sent to the remote with the matching ID.
     *
     * @param allowBatching Whether to allow batching this remote event with other remote events. This will preserve ordering between remote events but may not preserve ordering
     *                      with respect to other events. Defaults to true.
     *
     * @example Send a toast message to another remote.
     * // Get the configBot ID of the other remote.
     * const otherRemoteId = 'otherRemoteId';
     *
     * // Create a toast action
     * const toastAction = os.toast('My message!');
     *
     * // Send the action to the other remote
     * // The toastAction will not be performed locally because
     * // it is being sent to another remote.
     * remote(toastAction, otherRemoteId);
     *
     * @dochash actions/os/event
     * @docgroup 01-event-actions
     * @docname remote
     */
    function remote(
        action: BotAction,
        selector?: SessionSelector | string | (SessionSelector | string)[],
        allowBatching?: boolean
    ): RemoteAction | RemoteAction[] {
        if (!action) {
            return;
        }
        const original = getOriginalObject(action);
        let actions = [];
        let selectors = Array.isArray(selector) ? selector : [selector];
        for (let s of selectors) {
            const r = calcRemote(
                original,
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
     * Sends a {@tag @onRemoteData} shout to the remote with the given ID or remotes if given a list of IDs. This is useful for sending arbitrary messages to specific remotes.
     *
     * In effect, this allows remotes to communicate with each other by sending arbitrary events.
     *
     * @param remoteId the remote ID or list of remote IDs that the shout should be sent to.
     * @param name the name of the event that is being sent. This is useful for telling the difference between different messages.
     * @param arg the that argument to send with the shout. You do not need to specify this parameter if you do not want to.
     *
     * @example Send a "custom" message to another remote.
     * const otherRemoteId = "otherRemoteId";
     *
     * // The other remote will receive a @onRemoteData with
     * // that.name === "custom" and that.that === "Hello"
     * sendRemoteData(otherRemoteId, "custom", "Hello");
     *
     * @example Send a message to all other remotes.
     * const remotes = await os.remotes();
     * const remoteId = getID(configBot);
     * const otherRemotes = remotes.filter(id => id !== remoteId);
     *
     * // All other remotes will receive a @onRemoteData with
     * // that.name === "custom" and that.that === "Hello"
     * sendRemoteData(otherRemotes, "custom", "Hello");
     *
     * @dochash actions/os/event
     * @docgroup 01-event-actions
     * @docname sendRemoteData
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
     *
     * @docgroup 10-event-actions
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
     * Sends a HTTP GET request for the given URL using the given options.
     *
     * @param url the URL that the request should be sent to.
     * @param options the options for the request.
     *
     * @example Send a HTTP GET request for https://example.com and toast the result.
     * const response = await web.get('https://example.com');
     * os.toast(response);
     *
     * @dochash actions/web
     * @doctitle Web Actions
     * @docsidebar Web
     * @docdescription Web actions allow you to send HTTP requests to other servers.
     * @docgroup 01-web-actions
     * @docname web.get
     */
    function _webGet(
        url: string,
        options?: WebhookOptions
    ): Promise<WebhookResult> {
        return null;
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
     * Sends a HTTP POST request to the URL with the given data and using the given options.
     *
     * @param url the URL that the request should be sent to.
     * @param data the data that should be included in the request.
     * @param options the options for the request.
     *
     * @example Send a HTTP POST request to https://example.com and toast the result.
     * const response = await web.post('https://example.com', {
     *      some: 'data'
     * });
     * os.toast(response);
     *
     * @dochash actions/web
     * @docgroup 01-web-actions
     * @docname web.post
     */
    function _webPost(
        url: string,
        data?: any,
        options?: WebhookOptions
    ): Promise<WebhookResult> {
        return null;
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
     * Sends a HTTP request using the given options.
     *
     * @param options the options for the request.
     *
     * @example Send a HTTP GET request to https://example.com and toast the result.
     * const response = await web.hook({
     *    method: 'GET',
     *    url: 'https://example.com',
     * });
     * os.toast(response);
     *
     * @example Send a HTTP PUT request to https://example.com with some data.
     * web.hook({
     *    method: 'PUT',
     *    url: 'https://example.com',
     *    data: {
     *      some: 'data'
     *    }
     * });
     *
     * @dochash actions/web
     * @docgroup 01-web-actions
     * @docname web.hook
     */
    function _webHook(options: WebhookOptions): Promise<WebhookResult> {
        return null;
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
     * Creates a [Universally Unique IDentifier (UUID)](https://en.wikipedia.org/wiki/Universally_unique_identifier).
     * Useful for generating a random identifier that is guaranteed to be unique
     *
     * @example Generate a new UUID and toast it
     * const id = uuid();
     * os.toast(id);
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname uuid
     */
    function uuid(): string {
        return context.uuid();
    }

    /**
     * Waits the amount of time provided, in [miliseconds](https://en.wikipedia.org/wiki/Millisecond).
     *
     * Returns a promise that resolves when the time has been waited.
     *
     * @param time the Time to wait in ms. 1 second is 1000 ms.
     *
     * @example Wait 2 seconds before proceeding.
     * os.toast("Stop!");
     * await os.sleep(2000);
     * os.toast("Hammer Time!");
     *
     * @dochash actions/os/system
     * @docname os.sleep
     */
    function sleep(time: number): Promise<void> {
        let sleepy = new Promise<void>((resolve) => setTimeout(resolve, time));
        return sleepy;
    }

    /**
     * Animates the tag on the given bot based on the specified parameters.
     * Returns a promise that resolves when the animation is finished and throws an error when the animation is canceled.
     * This is useful for gradually changing a tag on a bot over time. For example, moving a bot from point A to point B without teleporting it.
     *
     * {@link animateTag-byTag} is fully integrated with tag masks. This lets you animate tag values in the `tempLocal`, `local`, `player`, and `shared` spaces.
     *
     * @param bot the bot, bot ID, or list of bots that the tag should be animated on.
     * @param tag the tag that should be animated.
     * @param options the options that should be used to animate the tag. If null is used, then any active animations for the tag on these bots will be canceled.
     *
     * @example Animate the #count tag from 0 to 1 over 5 seconds.
     * await animateTag(bot, "count", {
     *     fromValue: 0,
     *     toValue: 1,
     *     duration: 5
     * });
     * os.toast("Animation finished!");
     *
     * @example Run 2 animations in sequence.
     * await animateTag(bot, "homeX", {
     *     fromValue: 0,
     *     toValue: 5,
     *     duration: 2
     * });
     *
     * await animateTag(bot, "homeY", {
     *     fromValue: 0,
     *     toValue: 5,
     *     duration: 2
     * });
     *
     * @example Run an animation while the #loop tag is true.
     * while(tags.loop) {
     *     await animateTag(bot, "homeX", {
     *         fromValue: 0,
     *         toValue: 5,
     *         duration: 2
     *     });
     * }
     *
     * @example Run an animation with a "bouncy" easing mode.
     * await animateTag(bot, "homeX", {
     *     fromValue: 0,
     *     toValue: 5,
     *     duration: 2,
     *     easing: {
     *         type: "elastic",
     *         mode: "out"
     *     }
     * });
     *
     * @example Run an animation with a custom easing function that causes the animation to progress in 10 distinct steps.
     * await animateTag(bot, "homeX", {
     *     fromValue: 0,
     *     toValue: 5,
     *     duration: 2,
     *     easing: (k) => {
     *         return Math.floor(k * 10) / 10;
     *     }
     * });
     *
     * @example Run an animation that starts in 1 second.
     * await animateTag(bot, "homeX", {
     *     fromValue: 0,
     *     toValue: 5,
     *     duration: 2,
     *     startTime: os.localTime + 1000,
     * });
     *
     * @example Animate a tag in tempShared space.
     * await animateTag(bot, "homeX", {
     *     fromValue: 0,
     *     toValue: 5,
     *     duration: 2,
     *     tagMaskSpace: 'tempShared'
     * });
     *
     * @example Cancel animations on the #homeX tag.
     * animateTag(bot, "homeX", {
     *     fromValue: 0,
     *     toValue: 5,
     *     duration: 2
     * }).then(() => {
     *     os.toast("Animation Finished!");
     * }).catch(() => {
     *     os.toast("Animation Canceled!");
     * });
     *
     * await os.sleep(500);
     *
     * animateTag(bot, "homeX", null);
     *
     * @dochash actions/os/animations
     * @docgroup 01-utility-actions
     * @docname animateTag
     * @docid animateTag-byTag
     */
    function _animateTag(
        bot: RuntimeBot | string | (RuntimeBot | string)[],
        tag: string,
        options: AnimateTagFunctionOptions
    ): Promise<void> {
        return null;
    }

    /**
     * Animates multiple tags on the given bot based on the specified parameters.
     *
     * This works similarly to {@link animateTag-byTag} but instead of providing a tag name, you instead provide an object for the fromValue and toValue options which contains the tags that should be animated.
     *
     * Returns a promise that resolves when the animation is finished and throws an error when the animation is canceled. This is useful for gradually changing a set of tags on a bot over time. For example, moving a bot from point A to point B without teleporting it.
     *
     * Unlike calling {@link animateTag-byTag} multiple times, animations started with this function are grouped together. This means that canceling one animation in the group will also cancel the others.
     *
     * This function is fully integrated with tag masks. This lets you animate tag values in the tempLocal, local, player, and shared spaces.
     *
     * @param bot the bot, bot ID, or list of bots that the tag should be animated on.
     * @param tag the tag that should be animated.
     * @param options the options that should be used to animate the tag. If null is used, then any active animations for the tag on these bots will be canceled.
     *
     * @example Animate the #count tag from 0 to 1 over 5 seconds.
     * await animateTag(bot, {
     *     fromValue: {
     *         homeX: 0,
     *         homeY: 0,
     *     },
     *     toValue: {
     *         homeX: 1,
     *         homeY: 1
     *     },
     *     duration: 5
     * });
     *
     * os.toast("Animation finished!");
     *
     * @example Animate tags in tempShared space.
     * await animateTag(bot, {
     *     fromValue: {
     *         homeX: 0,
     *         homeY: 0,
     *     },
     *     toValue: {
     *         homeX: 5,
     *         homeY: 5
     *     },
     *     duration: 2,
     *     tagMaskSpace: 'tempShared'
     * });
     *
     * @dochash actions/os/animations
     * @docgroup 01-utility-actions
     *
     * @docname animateTag
     * @docid animateTag-byOptions
     */
    function __animateTag(
        bot: RuntimeBot | string | (RuntimeBot | string)[],
        options: AnimateTagFunctionOptions
    ): Promise<void> {
        return null;
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
            } else if (
                typeof targetValue === 'number' &&
                typeof initialValue !== 'number'
            ) {
                initialValue = 0;
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
     * If a tag is specified then only animations for the given tag will be canceled.
     *
     * @param bot the bot, bot ID, or list of bots that should cancel their animations.
     * @param tag the tag or list of tags that the animations should be canceled for.
     *
     * @dochash actions/os/animations
     * @docgroup 01-utility-actions
     * @docname clearAnimations
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
     * This function can be used to perform actions that you have stored as data without having to find out which function to call. You can find a list of action types [here](https://github.com/casual-simulation/casualos/blob/develop/src/aux-common/bots/BotEvents.ts#L40).
     *
     * @param action the action that should be performed.
     *
     * @example Perform a toast action
     * action.perform({
     *     type: 'show_toast',
     *     message: 'Hello, world!',
     *     duration: 2000
     * });
     *
     * @example Perform an add bot action
     * action.perform({
     *     type: 'add_bot',
     *     id: 'bot_id',
     *     bot: {
     *         id: 'bot_id',
     *         tags: {
     *             home: true,
     *             label: 'Hello, World!'
     *         }
     *     }
     * });
     *
     * @dochash actions/os/event
     * @docgroup 01-event-actions
     * @docname action.perform
     */
    function perform(action: any): any {
        const event: BotAction = action;
        if (event.type === 'update_bot') {
            let isRejected: boolean = null;

            const checkRejected = () => {
                if (isRejected === null) {
                    let originalEvent = getOriginalObject(event);
                    for (let a of context.actions) {
                        if (
                            a.type === 'reject' &&
                            a.actions.indexOf(originalEvent) >= 0
                        ) {
                            isRejected = true;
                            return true;
                        }
                    }
                    isRejected = false;
                }

                return isRejected;
            };

            if (event.update.tags) {
                for (let tag in event.update.tags) {
                    const val = event.update.tags[tag];
                    if (isTagEdit(val)) {
                        if (!checkRejected()) {
                            val.isRemote = true;
                        }
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
                                if (!checkRejected()) {
                                    val.isRemote = true;
                                }
                            }
                        }
                    }
                }
            }
        }
        return addAction(action);
    }

    /**
     * Prevents a previous action from being performed.
     *
     * This is especially useful when used in a {@tag @onAnyAction} listener since it lets you reject actions before they are performed.
     *
     * @param action the action that should be prevented/rejected.
     *
     * @example Prevent a toast message from being performed.
     * const toastAction = os.toast("my message");
     * action.reject(toastAction);
     *
     * @dochash actions/os/event
     * @docgroup 01-event-actions
     * @docname action.reject
     */
    function reject(action: any): RejectAction {
        const original = getOriginalObject(action);
        const event = Array.isArray(original)
            ? calcReject(...original)
            : calcReject(original);
        return addAction(event);
    }

    /**
     * Locally plays the given animation on the given bot.
     *
     * If an animation is already playing, it will be interrupted.
     * When the given animation is finished playing, the interrupted animation will be restored.
     *
     * @param bot the Bot or Bot ID that the animation should be played on.
     * @param animation the name or index of the animation that should be played.
     *
     * @example Play the "jump" animation on this bot.
     * experiment.localFormAnimation(this, "jump");
     *
     * @dochash actions/experimental
     * @docname experiment.localFormAnimation
     */
    function localFormAnimation(
        bot: Bot | string,
        animation: string | number
    ): LocalFormAnimationAction {
        return addAction(calcLocalFormAnimation(getID(bot), animation));
    }

    /**
     * Locally plays a tween that moves the given bot in the given dimension to the given position.
     * Optionally allows customizing the easing of the tween.
     *
     * Returns a promise that resolves when the tween is finished.
     *
     * While the tween is playing, any updates to the bot's position and rotation are ignored.
     * Once the tween is done playing, any change to the bot will reset the position/rotation.
     *
     *
     *
     * @param bot the bot or ID of the bot that should be tweened.
     * @param dimension the dimension that the bot should be tweened in.
     * Note that the tween will only work if the given dimension is currently in the grid portal or miniGridPortal.
     *
     * @param position the position that the bot should be tweened to. If you exclude a dimension (like `x`, `y`, or `z`), then it will remain unchanged.
     * @param options the options that should be used.
     *
     * @example Tween the bot to X = 10 in the `home` dimension.
     * experiment.localPositionTween(
     *     this,
     *     'home',
     *     {
     *         x: 10,
     *     });
     *
     * @example Tween the bot over 5 seconds.
     * experiment.localPositionTween(
     *     this,
     *     'home',
     *     {
     *         x: 10,
     *     },
     *     {
     *         duration: 5
     *     });
     *
     * @example Tween the bot with quadratic easing.
     * experiment.localPositionTween(
     *     this,
     *     'home',
     *     {
     *         x: 10,
     *     },
     *     {
     *         easing: {
     *             type: 'quadratic',
     *             mode: 'inout'
     *         }
     *     });
     *
     * @dochash actions/experimental
     * @docname experiment.localPositionTween
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
     * Locally plays a tween that rotates the given bot in the given dimension to the given rotation.
     * Optionally allows customizing the easing of the tween.
     *
     * Returns a promise that resolves when the tween is finished.
     *
     * While the tween is playing, any updates to the bot's position and rotation are ignored.
     * Once the tween is done playing, any change to the bot will reset the position/rotation.
     *
     * @param bot the bot or ID of the bot that should be tweened.
     * @param dimension the dimension that the bot should be tweened in.
     * Note that the tween will only work if the given dimension is currently in the grid portal or miniGridPortal.
     *
     * @param rotation the rotation that the bot should be tweened to in radians. If you exclude a dimension (like `x`, `y`, or `z`), then it will remain unchanged.
     * @param options The options that should be used for the tween.
     *
     * @example Tween the bot 90 degrees around the Z axis in the `home` dimension.
     * experiment.localRotationTween(
     *     this,
     *     'home',
     *     {
     *         z: Math.PI / 2,
     *     });
     *
     * @example Tween the bot for 5 seconds.
     * experiment.localRotationTween(
     *     this,
     *     'home',
     *     {
     *         z: Math.PI / 2,
     *     },
     *     {
     *         duration: 5
     *     });
     *
     * @example Tween the bot with quadratic easing.
     * experiment.localRotationTween(
     *     this,
     *     'home',
     *     {
     *         z: Math.PI / 2,
     *     },
     *     {
     *         easing: {
     *             type: 'quadratic',
     *             mode: 'inout'
     *         }
     *     });
     *
     * @dochash actions/experimental
     * @docname experiment.localRotationTween
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
     * Gets the absolute position in the given dimension that the center of the given bot would be placed at if the bot was using the given anchor point.
     *
     * @param bot the bot that the anchor point position should be calculated for.
     * @param dimension the dimension that the anchor point position should be calculated in.
     * @param anchorPoint the anchor point that should be calculated. Can be any valid {@tag anchorPoint} value.
     *
     * @example Get the top anchor point of the current bot in the "home" dimension.
     * const point = experiment.getAnchorPointPosition(bot, "home", "top");
     * os.toast(point);
     *
     * @example Get the back right anchor point of the current bot in the "home" dimension.
     * const point = experiment.getAnchorPointPosition(bot, "home", [ 0.5, -0.5, 0 ]);
     * os.toast(point);
     *
     * @example Place bots at each of the anchor points.
     * let points = [
     *     'top',
     *     'bottom',
     *     'front',
     *     'back',
     *     'left',
     *     'right',
     *     'center',
     * ];
     *
     * for(let point of points) {
     *     let pos = experiment.getAnchorPointPosition(bot, os.getCurrentDimension(), point);
     *     create({
     *         space: 'tempShared',
     *         color: 'green',
     *         [os.getCurrentDimension()]: true,
     *         [os.getCurrentDimension() + "X"]: pos.x,
     *         [os.getCurrentDimension() + "Y"]: pos.y,
     *         [os.getCurrentDimension() + "Z"]: pos.z,
     *         anchorPoint: 'center',
     *         targetAnchorPoint: point,
     *         scale: 0.1,
     *     });
     * }
     *
     * @dochash actions/experimental
     * @docname experiment.getAnchorPointPosition
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
    function createStaticHtmlFromBots(
        bots: Bot[],
        templateUrl?: string
    ): Promise<string> {
        const state: BotsState = {};
        for (let bot of bots) {
            state[bot.id] = createBot(bot.id, bot.tags.toJSON());
        }
        const task = context.createTask();
        const action = calcCreateStaticHtmlFromBots(
            state,
            templateUrl,
            task.taskId
        );
        return addAsyncAction(task, action);
        // try {
        //     const state: BotsState = {};
        //     for (let bot of bots) {
        //         state[bot.id] = bot;
        //     }

        //     const json = JSON.stringify(getVersion1DownloadState(state));

        //     const url = templateUrl
        //         ? templateUrl
        //         : new URL('/static.html', context.device.ab1BootstrapUrl).href;
        //     const result = await fetch(url);

        //     if (result.ok) {
        //         const html = await result.text();
        //         const parsed = new DOMParser().parseFromString(
        //             html,
        //             'text/html'
        //         );

        //         const script = parsed.createElement('script');
        //         script.setAttribute('type', 'text/aux');
        //         script.textContent = json;
        //         parsed.body.appendChild(script);
        //         return `<!DOCTYPE html>\n` + parsed.documentElement.outerHTML;
        //     } else {
        //         console.error(`Unable to fetch`, url);
        //         console.error(result);
        //         console.error(
        //             'It is possible that static HTML builds are not supported on this server.'
        //         );
        //         return null;
        //     }
        // } catch (err) {
        //     console.error(err);
        //     return null;
        // }
    }

    /**
     * Starts a new audio recording.
     * Returns a promise that resolves when recording has started.
     * The returned promise will throw an error if recording could not be started. Reasons for this include insufficient permissions and not having a microphone.
     *
     * Triggers {@tag @onBeginAudioRecording} once recording has started and continuously triggers {@tag @onAudioChunk} if stream is set to true.
     *
     * @param options the options that determines how the audio should be recorded.
     *
     * @example Record some audio for 10 seconds and download the file.
     * await os.beginAudioRecording();
     * await os.sleep(10000);
     * const data = await os.endAudioRecording();
     *
     * os.download(data);
     *
     * @example Stream some raw audio data for 10 seconds.
     * await os.beginAudioRecording({
     *     stream: true,
     *     mimeType: 'audio/x-raw'
     * });
     * // @onAudioChunk will be called whenever a new sample is available.
     * await os.sleep(10000);
     * await os.endAudioRecording();
     *
     * @dochash actions/os/audio
     * @docname os.beginAudioRecording
     * @docgroup 11-audio-recording
     */
    function beginAudioRecording(
        options?: Omit<BeginAudioRecordingAction, 'type' | 'taskId'>
    ): Promise<void> {
        const task = context.createTask();
        const action = calcBeginAudioRecording(options ?? {}, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Stops the audio recording that is in progress.
     * Returns a promise that resolves with the recorded data.
     * If the recording was started with stream: true, then the recorded data will be null.
     *
     * Triggers {@tag @onEndAudioRecording} once recording has finished.
     *
     * @example Record some audio for 10 seconds and download the file.
     * await os.beginAudioRecording();
     * await os.sleep(10000);
     * const data = await os.endAudioRecording();
     *
     * os.download(data);
     *
     * @dochash actions/os/audio
     * @docname os.endAudioRecording
     * @docgroup 11-audio-recording
     */
    function endAudioRecording(): Promise<Blob> {
        const task = context.createTask();
        const action = calcEndAudioRecording(task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Starts a new recording. Returns a promise that resolves when recording has started.
     * The returned promise will throw an error if recording could not be started. Reasons for this include insufficient permissions and not having a microphone.
     * @param options the options that should be used for the recording.
     * Defaults to: `{ audio: true, video: true, screen: false }`
     *
     * @example Record for 10 seconds and download the files.
     * await experiment.beginRecording({
     *     audio: true,
     *     video: true,
     *     screen: false
     * });
     * await os.sleep(10000);
     * const data = await experiment.endRecording();
     * let index = 0;
     * for(let file of data.files) {
     *     os.download(file.data, `file-${index}`);
     *     index += 1;
     * }
     *
     * @example Record the screen with microphone audio.
     * await experiment.beginRecording({
     *     audio: ['microphone'],
     *     video: false,
     *     screen: true
     * });
     * await os.sleep(10000);
     * const data = await experiment.endRecording();
     * let index = 0;
     * for(let file of data.files) {
     *     os.download(file.data, `file-${index}`);
     *     index += 1;
     * }
     *
     * @dochash actions/experimental
     * @doctitle Experimental Actions
     * @docsidebar Experimental
     * @docdescription Experimental actions are actions that are not yet fully supported and may change in the future.
     * @docname experiment.beginRecording
     */
    function beginRecording(options?: RecordingOptions): Promise<void> {
        if (!options) {
            options = { audio: true, video: true, screen: false };
        }
        const task = context.createTask();
        const action = calcBeginRecording(options, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Stops the recording that is in progress. Returns a promise that resolves with the recorded data.
     *
     * @example Record for 10 seconds and download the files.
     * await experiment.beginRecording({
     *     audio: true,
     *     video: true,
     *     screen: false
     * });
     * await os.sleep(10000);
     * const data = await experiment.endRecording();
     * let index = 0;
     * for(let file of data.files) {
     *     os.download(file.data, `file-${index}`);
     *     index += 1;
     * }
     *
     * @dochash actions/experimental
     * @docname experiment.endRecording
     */
    function endRecording(): Promise<Recording> {
        const task = context.createTask();
        const action = calcEndRecording(task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Send a [command](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe-commands) to the Jitsi Meet API. The commands are only valid if the meet portal is fully loaded (see {@tag @onMeetLoaded}).
     *
     * Returns a promise that resolves when the command has been executed.
     *
     * @param command the command to execute.
     * @param args The arguments for the command (if any).
     *
     * @example Change user's meet display name
     * os.meetCommand('displayName', 'ABC123');
     *
     * @example Close the meet.
     * os.meetCommand('hangup')
     *
     * @dochash actions/os/meets
     * @doctitle Meet Actions
     * @docsidebar Meets
     * @docdescription Actions that are able to control the meetPortal.
     * @docname os.meetCommand
     * @docgroup 12-meet
     */
    function meetCommand(command: string, ...args: any): Promise<void> {
        const task = context.createTask();
        const action = calcMeetCommand(command, args, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Executes the given [function](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe-functions) on the Jitsi Meet API and returns a promise that resolves with the result. The functions are only valid if the meet portal is fully loaded (see @onMeetLoaded).
     *
     * @param functionName the name of the function to execute.
     * @param args the arguments to provide to the function.
     *
     * @example Get a list of all the participants.
     * const participants = await os.meetFunction('getParticipantsInfo')
     *
     * @example Get a list of available breakout rooms.
     * const rooms = await os.meetFunction('listBreakoutRooms');
     *
     * @dochash actions/os/meets
     * @docname os.meetFunction
     * @docgroup 12-meet
     */
    function meetFunction(functionName: string, ...args: any[]): Promise<any> {
        const task = context.createTask();
        const action = calcMeetFunction(functionName, args, task.taskId);
        return addAsyncAction(task, action);
    }

    /**
     * Creates a debug environment that can be used to simulate bots in isolation from the rest of the inst.
     * Returns a promise that resolves with an object that contains all of the action functions.
     *
     * One of the special things about debug environments is that the bots in the environment are totally isolated from regular bots.
     * This means that functions like {@link getbots-filters} can only access bots that have been created in the debugger and actions like {@link os.toast} don't do anything automatically.
     * This can be useful for automated testing where you want to see what some bots will do without actually letting them do anything.
     *
     * Additionally, debuggers can be configured to be pausable (see {@link os.createDebugger-pausable}).
     * This allows you to set pause triggers (also known as breakpoints) that temporarily stop the debugger at a specific location in a listener and allows you to inspect the current state of the script. Pausable debuggers work like normal debuggers, except that some specific functions return promises instead of a result. This is because those functions can trigger user code that could trigger a pause. When this is possible, the debugger returns a promise to your host code so you can properly handle the pause. (See the examples below for more information)
     *
     * The returned object can be used to create/find bots in the debug environment and simulate interactions. The debug environment also contains several functions that make it easy to observe what has happened inside the environment and therefore determine if everything was performed correctly.
     *
     * @param options the options that should be used to configure the debugger.
     *
     * @example Create a normal debugger and copy this bot into it.
     * // Note: variables cannot be named "debugger" so we use the name "debug" instead.
     * const debug = await os.createDebugger();
     * const debuggerBot = debug.create(thisBot);
     *
     * @example Test a script in the debugger
     * const debug = await os.createDebugger();
     * const debuggerBot = debug.create({
     *     test: '@tags.hit = true;'
     * });
     * debug.shout('test');
     *
     * if (debuggerBot.tags.hit) {
     *     os.toast('Success!');
     * } else {
     *     os.toast('Failed!');
     * }
     *
     * @example Find out what actions a script performs
     * const debug = await os.createDebugger();
     * const debuggerBot = debug.create({
     *     test: '@os.toast("hello!")'
     * });
     * debug.shout('test');
     *
     * const actions = debug.getCommonActions();
     * os.toast(actions);
     *
     * @example Create a debugger with a custom configBot
     * const debug = await os.createDebugger({
     *     configBot: {
     *         test: '@console.log("Hello, World!");'
     *     }
     * });
     * debug.shout('test');
     *
     * @example Mask the web.get() function.
     * const debug = await os.createDebugger();
     * let url = "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/The_star_formation_region_Messier_17.jpg/1200px-The_star_formation_region_Messier_17.jpg";
     * const debuggerBot = debug.create({
     *     url,
     *     test: '@return await web.get(tags.url)'
     * });
     *
     * debug.web.get.mask(url)
     *     .returns({
     *         data: 'test data',
     *         status: 200
     *     });
     *
     * const [result] = debug.shout('test');
     *
     * assertEqual(result, {
     *     data: 'test data',
     *     status: 200
     * });
     * os.toast("Success!");
     *
     * @dochash actions/debuggers
     * @doctitle Debugger Actions
     * @docsidebar Debuggers
     * @docdescription Debugger actions are useful for simulating bots in isolation from the rest of the inst.
     * @docname os.createDebugger
     * @docid os.createDebugger-normal
     */
    function _createDebugger_normal(
        options?: NormalDebuggerOptions
    ): Promise<NormalDebugger> {
        return null;
    }

    /**
     * Creates a pausable debug environment that can be used to simulate bots in isolation from the rest of the inst.
     * Returns a promise that resolves with an object that contains all of the action functions.
     *
     * One of the special things about debug environments is that the bots in the environment are totally isolated from regular bots.
     * This means that functions like {@link getbots-filters} can only access bots that have been created in the debugger and actions like {@link os.toast} don't do anything automatically.
     * This can be useful for automated testing where you want to see what some bots will do without actually letting them do anything.
     *
     * Pausable debuggers allow you to set pause triggers (also known as breakpoints) that temporarily stop the debugger at a specific location in a listener and allows you to inspect the current state of the script. Pausable debuggers work like normal debuggers, except that some specific functions return promises instead of a result. This is because those functions can trigger user code that could trigger a pause. When this is possible, the debugger returns a promise to your host code so you can properly handle the pause. (See the examples below for more information)
     *
     * The returned object can be used to create/find bots in the debug environment and simulate interactions. The debug environment also contains several functions that make it easy to observe what has happened inside the environment and therefore determine if everything was performed correctly.
     *
     * @param options the options that should be used to configure the debugger.
     *
     * @example Create a pausable debugger
     * const debug = await os.createDebugger({
     *     pausable: true
     * });
     *
     * // Register a listener that gets called whenever a pause happens in this debugger.
     * debug.onPause(pause => {
     *     // Get the current stack frame from the pause
     *     const currentFrame = pause.callStack[pause.callStack.length - 1];
     *
     *     // Set the abc variable to 999
     *     currentFrame.setVariableValue('abc', 999);
     *
     *     // Resume execution after the pause.
     *     debug.resume(pause);
     * });
     *
     * // Because the debugger is pausable, the create() function returns a promise
     * // because it calls @onCreate which could cause a pause trigger to be hit.
     * const debuggerBot = await debug.create({
     *     test: '@let abc = 123; os.toast(abc);'
     * });
     *
     * // Set a pause trigger in the "test" script of the bot we just created
     * // at line 1 column 16
     * const trigger = debug.setPauseTrigger(debuggerBot, 'test', {
     *     lineNumber: 1,
     *     columnNumber: 16
     * });
     *
     * // Send a shout. Just like the create() function above, we recieve a promise that we can await.
     * await debug.shout('test');
     *
     * // Get the resulting actions from the debugger
     * // and perform the first one. This should be the os.toast(), but instead of printing 123,
     * // it should print 999 because we changed the value of abc during the debugger pause.
     * const actions = debug.getCommonActions();
     * action.perform(actions[0]);
     *
     * @dochash actions/debuggers
     * @docname os.createDebugger
     * @docid os.createDebugger-pausable
     */
    function _createDebugger_pausable(
        options: PausableDebuggerOptions
    ): Promise<PausableDebugger> {
        return null;
    }

    /**
     * Gets the debugger that is currently executing the script. Returns null if the script is not running in a debugger.
     *
     * @example Get the debugger that this script is running in
     * const debug = os.getExecutingDebugger();
     * console.log(debug);
     *
     * @dochash actions/debuggers
     * @docname os.getExecutingDebugger
     */
    function _getExecutingDebugger(): Debugger {
        return null;
    }

    /**
     * Attaches the given debugger to the CasualOS frontend. This causes the given debugger to be treated like another inst that has been loaded simultaneously with the current inst. This feature makes it useful for inspecting the bots in a debugger or even for setting up a sandbox that you control.
     *
     * Note that because debuggers are entirely separate environments, the debugger gets its own configBot and portal bots. This means that in order for bots to show up in the portals, you need to set the corresponding portal on the debugger's configBot. For portals that are stored in the URL (like the gridPortal), this is done automatically. But for other portals (like the miniGridPortal or the wrist portals), you need to manage this manually.
     *
     * Returns a promise that resolves when the debugger has been attached.
     *
     * @param debug the debugger that you want to be attached to the runtime.
     * @param options the options that should be used to attach the debugger.
     *
     * @example Create and attach a debugger
     * const debug = await os.createDebugger();
     *
     * // Create a bot in the debugger.
     * debug.create({
     *     home: true
     *     label: 'Test'
     * });
     *
     * // Attach the debugger to CasualOS.
     * await os.attachDebugger(debug);
     *
     * @example Attach a debugger with a tag mapper that renames "home" tags to "testHome"
     * const debug = await os.createDebugger();
     *
     * // Create a bot in the debugger.
     * debug.create({
     *     home: true
     *     label: 'Test'
     * });
     *
     * // Attach the debugger to CasualOS.
     * // Because we're providing a tag mapper, the frontend won't see the "home" tag in debugger bots,
     * // instead it will see "testHome" tags.
     * await os.attachDebugger(debug, {
     *     tagNameMapper: {
     *         forward: (tag) => {
     *             if (tag.startsWith('home')) {
     *                 return `testHome${tag.slice('home'.length)}`;
     *             }
     *
     *             return tag;
     *         },
     *         reverse: (tag) => {
     *             if (tag.startsWith('testHome')) {
     *                 return tag.slice('testHome'.length);
     *             }
     *
     *             return tag;
     *         }
     *     }
     * });
     *
     * @dochash actions/debuggers
     * @docname os.attachDebugger
     */
    function _attachDebugger(
        debug: Debugger,
        options?: AttachDebuggerOptions
    ): Promise<void> {
        return null;
    }

    /**
     * Detaches the given debugger from the CasualOS frontend. Returns a promise that resolves when the debugger has been detached.
     *
     * @param debug the debugger that should be detached.
     *
     * @example Detach a debugger
     * const debug = await os.createDebugger();
     *
     * // Create a bot in the debugger.
     * debug.create({
     *     home: true
     *     label: 'Test'
     * });
     *
     * // Attach the debugger to CasualOS.
     * await os.attachDebugger(debug);
     *
     * // Wait for 4 seconds
     * await os.sleep(4000);
     *
     * await os.detachDebugger(debug);
     */
    function _detachDebugger(debug: Debugger): Promise<void> {
        return null;
    }

    /**
     * Speaks the given text using a synthetic voice and options.
     * Note that this is a local effect. The gererated sounds are only played in the current session.
     *
     * Returns a promise that resolves when the text has been spoken.
     * @param text the text that should be spoken.
     * @param options the options that should be used to speak the text.
     *
     * @dochash actions/experimental
     * @docname experiment.speakText
     */
    function speakText(
        text: string,
        options?: SpeakTextApiOptions
    ): Promise<void> {
        options = options ?? {};
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
     *
     * @example Toast the list of voices that are supported.
     * const voices = await experiment.getVoices();
     * os.toast(voices);
     *
     * @example Get the first US English voice.
     * const voices = await experiment.getVoices();
     * const usEnglish = voices.find(v => v.language === "en-US");
     * os.toast(usEnglish);
     *
     * @dochash actions/experimental
     * @docname experiment.getVoices
     */
    function getVoices(): Promise<SyntheticVoice[]> {
        const task = context.createTask();
        const action = calcGetVoices(task.taskId);
        return addAsyncAction(task, action);
    }

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
    function loomRecordVideo(options: RecordLoomOptions): Promise<LoomVideo> {
        const task = context.createTask();
        const action = recordLoom(options, task.taskId);
        return addAsyncAction(task, action);
    }

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
    function loomWatchVideo(video: LoomVideo): Promise<void>;

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
    function loomWatchVideo(sharedUrl: string): Promise<void>;

    function loomWatchVideo(
        sharedUrlOrVideo: string | LoomVideo
    ): Promise<void> {
        const task = context.createTask();
        const action = watchLoom(
            typeof sharedUrlOrVideo === 'string'
                ? sharedUrlOrVideo
                : sharedUrlOrVideo.sharedUrl,
            task.taskId
        );
        return addAsyncAction(task, action);
    }

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
    function loomGetVideoEmbedMetadata(
        video: LoomVideo
    ): Promise<LoomVideoEmbedMetadata>;

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
    function loomGetVideoEmbedMetadata(
        sharedUrl: string
    ): Promise<LoomVideoEmbedMetadata>;
    function loomGetVideoEmbedMetadata(
        sharedUrlOrVideo: string | LoomVideo
    ): Promise<LoomVideoEmbedMetadata> {
        const task = context.createTask();
        const action = getLoomMetadata(
            typeof sharedUrlOrVideo === 'string'
                ? sharedUrlOrVideo
                : sharedUrlOrVideo.sharedUrl,
            task.taskId
        );
        return addAsyncAction(task, action);
    }

    /**
     * Calculates the numerical sum of the given values.
     *
     * If any value in the list is not a number, it will be converted to one.
     * If the given value is not an array, then it will be converted to a number and returned.
     *
     * @param list  the list of values that should be summed up. If any value in the list is not a number, it will be converted to one.
     * If the list is not actually a list, then it will be converted to a number and returned.
     *
     * @example Calculate the sum of a list of numbers.
     * const total = math.sum([92, 123, 21]);
     *
     * @example Calculate the total #age of all the bots.
     * const totalAge = math.sum(getBotTagValues('#age'));
     *
     * @dochash actions/math
     * @doctitle Math Actions
     * @docsidebar Math
     * @docdescription Math actions are useful for performing math operations on bots and numbers.
     * @docname math.sum
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
     * Calculates the arithmetic mean of the given list of values.
     * That is, the sum of the values divided by the number of values.
     *
     * @param list The value that should be averaged.
     *             If it is a list, then the result will be sum(list)/list.length.
     *             If it is not a list, then the result will be the value converted to a number.
     *
     * @example Calculate the average of a list of numbers.
     * const average = math.avg([4, 54.2, 31]);
     *
     * @example Calculate the average #age of all the bots.
     * const averageAge = math.avg(getBotTagValues('#age'));
     *
     * @dochash actions/math
     * @docname math.avg
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
     * Calculates the square root of the given value.
     * @param value the value that the square root should be calculated for.
     *
     * @example Calculate the square root of 4.
     * const rootOf4 = math.sqrt(4);
     *
     * @dochash actions/math
     * @docname math.sqrt
     */
    function sqrt(value: any): number {
        return Math.sqrt(parseFloat(value));
    }

    /**
     * Calculates the absolute value of the given number. That is, the number without its sign.
     * @param number the number that the absolute value should be calculated for.
     *
     * @example Calculate the absolute value for the number -42.
     * const _42 = math.abs(-42);
     *
     * @dochash actions/math
     * @docname math.abs
     */
    function abs(number: any): number {
        return Math.abs(parseFloat(number));
    }

    /**
     *Calculates the [standard deviation](https://en.wikipedia.org/wiki/Standard_deviation for the given list of values.
     *
     * @param list the list of values that the standard deviation should be calculated for.
     *
     * @example Calculate the standard deviation of a list of numbers.
     * const standardDeviation = math.stdDev([2, 97, 745]);
     *
     * @example Calculate the standard deviation of the #age of all the bots.
     * const ageDeviation = math.stdDev(getBotTagValues('#age'));
     *
     * @dochash actions/math
     * @docname math.stdDev
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
     * Creates a new random number generator from the given seed and returns it.
     * Because of how random number generators work, generators created with the same seed will return the same sequence of random numbers.
     *
     * @param seed the number or string that should be used as the seed value for the random number generator.
     * If omitted, then a seed will be chosen in a somewhat unpredictable manner.
     *
     * @example Create two random number generators with the same seed.
     * let random1 = math.getSeededRandomNumberGenerator(123);
     * let random2 = math.getSeededRandomNumberGenerator(123);
     *
     * os.toast(random1.randomInt(0, 10) + ' == ' + random2.randomInt(0, 10) + ' == 9');
     *
     * @example Create a random number generator and store it for later
     * let randomNumberGenerator = math.getSeededRandomNumberGenerator(123);
     *
     * // Store it in the bot variables so it can be used in other scripts.
     * bot.vars.randomNumberGenerator = randomNumberGenerator;
     *
     * @dochash actions/math
     * @docname math.getSeededRandomNumberGenerator
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
        prng: SeedRandom.PRNG
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
     * Sets the seed that should be used for the random numbers generated with {@link math.randomInt} and {@link math.random}.
     * @param seed the number or string that should be used as the seed value for the internal random number generator.
     * If null is provided, then a seed will be chosen in a somewhat unpredictable manner.
     *
     * @example Set the random seed for math.random() and math.randomInt().
     * math.setRandomSeed(123);
     *
     * expect(math.randomInt(0, 10)).toBe(9);
     * expect(math.random()).toBe(0.36078753814001446);
     *
     * @example Clear the random seed.
     * math.setRandomSeed(null);
     *
     * @dochash actions/math
     * @docname math.setRandomSeed
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
     * Generates a random integer number between the given minimum and maximum values.
     * @param min The smallest allowed value.
     * @param max The largest allowed value.
     *
     * @example Generate a random number between 5 and 10.
     * const number = math.randomInt(5, 10);
     *
     * @dochash actions/math
     * @docname math.randomInt
     */
    function randomInt(min: number = 0, max?: number): number {
        return randomIntBase(min, max, context.pseudoRandomNumberGenerator);
    }

    /**
     * Generates a random number between the given minimum and maximum values.
     *
     * @param min The smallest allowed value.
     * @param max The largest allowed value.
     *
     * @example Generate a random number between 0 and Math.PI.
     * const number = math.random(0, Math.PI);
     *
     * @dochash actions/math
     * @docname math.random
     */
    function random(min: number = 0, max?: number): number {
        return randomBase(min, max, context.pseudoRandomNumberGenerator);
    }

    function randomBase(
        min: number = 0,
        max: number,
        prng: SeedRandom.PRNG
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
        prng: SeedRandom.PRNG
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

    function _random(prng: SeedRandom.PRNG): number {
        if (prng) {
            return prng();
        }
        return Math.random();
    }

    /**
     * Converts the given number of [degrees](https://en.wikipedia.org/wiki/Degree_(angle)) to [radians](https://en.wikipedia.org/wiki/Radian) and returns the result.
     *
     * This operation is equivalent to `radians = degrees * (Math.PI / 180)`.
     *
     * @param degrees the number of degrees that should be converted to radians.
     *
     * @example Get the number of radians for a 90 degree angle
     * const radians = math.degreesToRadians(90);
     *
     * @dochash actions/math
     * @docname math.degreesToRadians
     */
    function degreesToRadians(degrees: number): number {
        return degrees * DEG_TO_RAD;
    }

    /**
     * Converts the given number of [radians](https://en.wikipedia.org/wiki/Radian) to [degrees](https://en.wikipedia.org/wiki/Degree_(angle)) and returns the result.
     *
     * This operation is equivalent to `degrees = radians * (180 / Math.PI)`.
     *
     * @param radians the number of radians that should be converted to degrees.
     *
     * @example Get the number of degrees for a Math.PI / 2 angle
     * const degrees = math.radiansToDegrees(Math.PI / 2);
     *
     * @dochash actions/math
     * @docname math.radiansToDegrees
     */
    function radiansToDegrees(radians: number): number {
        return radians * RAD_TO_DEG;
    }

    /**
     * Gets the forward direction for the given rotation.
     *
     * Useful for finding where a bot would be pointing if it has a custom rotation.
     *
     * @param pointerRotation The rotation that the pointer has represented in radians.
     *
     * @example Get the direction that a pointer is pointing.
     * const pointerRotation = os.getPointerRotation('mouse');
     * const pointerDirection = math.getForwardDirection(pointerRotation);
     * os.toast(pointerDirection);
     *
     * @dochash actions/math
     * @docname math.getForwardDirection
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
     * Calculates the 3D point that a ray starting at the given origin point and traveling in the given direction intersects the grid portal ground plane.
     * Returns null if the ray does not intersect the ground plane.
     *
     * Useful for calculating where on the ground something is pointing.
     *
     * @param origin the 3D point that the ray should start at.
     * @param direction the direction that the ray is traveling along.
     * @param planeNormal the normal vector that the plane should use.
     * For 2D planes, the normal vector is the 3D direction that is perpendicular to the the surface of the plane.
     * For example, a plane that covers the entire XY surface has a normal vector equal to `➡️0,0,1`, while a plane that covers the YZ surface has a normal vector equal to `➡️1,0,0`.
     * This parameter defaults to `➡️0,0,1`.
     * @param planeOrigin the 3D position that the center of the plane should travel through. Defaults to `➡️0,0,0`.
     *
     * @example Get the spot on the ground that a pointer is pointing at.
     * const pointerPosition = os.getPointerPosition('mouse');
     * const pointerRotation = os.getPointerRotation('mouse');
     * const pointerDirection = math.getForwardDirection(pointerRotation);
     * const groundPoint = math.intersectPlane(pointerPosition, pointerDirection);
     * os.toast(groundPoint);
     *
     * @dochash actions/math
     * @docname math.intersectPlane
     */
    function intersectPlane(
        origin: { x: number; y: number; z: number },
        direction: { x: number; y: number; z: number },
        planeNormal?: { x: number; y: number; z: number },
        planeOrigin?: { x: number; y: number; z: number }
    ): Vector3 {
        if (!planeNormal) {
            planeNormal = { x: 0, y: 0, z: 1 };
        }
        if (!planeOrigin) {
            planeOrigin = { x: 0, y: 0, z: 0 };
        }
        let plane = new Plane(
            new ThreeVector3(planeNormal.x, planeNormal.y, planeNormal.z)
        );
        let final = new ThreeVector3();
        let ray = new Ray(
            new ThreeVector3(
                origin.x - planeOrigin.x,
                origin.y - planeOrigin.y,
                origin.z - planeOrigin.z
            ),
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
     * Calculates the 3D position offset for the given anchor point and returns it.
     * This is essentially {@link experiment.getAnchorPointPosition} but without the bot's position/scale applied.
     *
     * @param anchorPoint the anchor point that should be calculated. Can be any valid {@tag anchorPoint} value.
     *
     * @example Calculate the anchor point offset for "bottom".
     * const offset = math.getAnchorPointOffset("bottom");
     * os.toast(offset);
     *
     * @dochash actions/math
     * @docname math.getAnchorPointOffset
     */
    function getAnchorPointOffset(anchorPoint: BotAnchorPoint): Vector3 {
        const value = calculateAnchorPoint(anchorPoint);
        const offset = calculateAnchorPointOffset(value);
        return new Vector3(offset.x, -offset.y, offset.z);
    }

    /**
     * Mathematically adds the given vectors to each other and returns the sum result.
     *
     * A vector is a group of numbers which represents a specific point in 2D/3D/4D/etc. space.
     * For example, the vector `{ x: 1, y: 2, z: 3 }` represents the point `(1, 2, 3)` in 3D space where `x`, `y`, and `z` are the names of the dimensions (or axes).
     *
     * @param vectors the vectors that should be added together.
     *
     * @example Add two 3D points together.
     * const result = math.addVectors(
     *     { x: 1, y: 2, z: 3 },
     *     { x: 5, y: 6, z: 7 }
     * );
     *
     * os.toast(result); // { x: 6, y: 8, z: 10 }
     *
     * @example Add arbitrary numbers together.
     * const result = math.addVectors(
     *     { salary: 1000, tax: 50 },
     *     { salary: 5000, tax: 250 },
     *     { salary: 750, tax: 37.5 },
     * );
     *
     * os.toast(result); // { salary: 6750, tax: 337.5 }
     *
     * @dochash actions/math
     * @docname math.addVectors
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
            const v = vectors[i] as Record<string, number>;
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
     * Mathematically subtracts the given vectors from each other and returns the result.
     *
     * A vector is a group of numbers which represents a specific point in 2D/3D/4D/etc. space.
     * For example, the vector `{ x: 1, y: 2, z: 3 }` represents the point `(1, 2, 3)` in 3D space where `x`, `y`, and `z` are the names of the dimensions (or axes).
     *
     * @param vectors the vectors that should be subtracted from each other.
     *
     * @example Subtract two 3D points from each other.
     * const result = math.addVectors(
     *     { x: 5, y: 6, z: 7 },
     *     { x: 1, y: 2, z: 3 },
     * );
     *
     * os.toast(result); // { x: 4, y: 4, z: 4 }
     *
     * @dochash actions/math
     * @docname math.subtractVectors
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
            const v = vectors[i] as Record<string, number>;
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
     * Mathematically negates the given vector and returns the result.
     *
     * A vector is a group of numbers which represents a specific point in 2D/3D/4D/etc. space.
     * For example, the vector `{ x: 1, y: 2, z: 3 }` represents the point `(1, 2, 3)` in 3D space where `x`, `y`, and `z` are the names of the dimensions (or axes).
     *
     * @param vector the vector that should be negated.
     *
     * @example Negate a 3D point.
     * const result = math.negateVector(
     *     { x: 5, y: 6, z: 7 }
     * );
     *
     * os.toast(result); // { x: -5, y: -6, z: -7 }
     *
     * @dochash actions/math
     * @docname math.negateVector
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
     * Normalizes the given vector. The result is a vector that has the same direction as the given vector but has a length/magnitude of 1.
     *
     * Mathemematically, this is the same as finding the {@link math.vectorLength} and dividing each component in the vector by it.
     *
     * A vector is a group of numbers which represents a specific point in 2D/3D/4D/etc. space.
     * For example, the vector `{ x: 1, y: 2, z: 3 }` represents the point `(1, 2, 3)` in 3D space where `x`, `y`, and `z` are the names of the dimensions (or axes).
     *
     * @param vector the vector that should be normalized.
     *
     * @example Normalize a 3D point.
     * const result = math.normalizeVector(
     *     { x: 1, y: 2, z: 3 }
     * );
     *
     * os.toast(result);
     * // x: 0.2672612419124244
     * // y: 0.5345224838248488
     * // z: 0.8017837257372732
     *
     * @dochash actions/math
     * @docname math.normalizeVector
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
     * Calculates the length (i.e. magnitude) of the given vector.
     *
     * Mathemematically, this is equivalent to `length = sqrt(sum(components.map(c => c * c)))`. As a consequence, vectors that are normalized always have a length of 1.
     *
     * A vector is a group of numbers which represents a specific point in 2D/3D/4D/etc. space.
     * For example, the vector `{ x: 1, y: 2, z: 3 }` represents the point `(1, 2, 3)` in 3D space where `x`, `y`, and `z` are the names of the dimensions (or axes).
     *
     * @param vector the vector to calculate the length of.
     *
     * @example Calculate the length of a 3D point
     * const result = math.vectorLength(
     *     { x: 1, y: 2, z: 3 }
     * );
     *
     * os.toast(result); // 3.7416573867739413
     *
     * @dochash actions/math
     * @docname math.vectorLength
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
     * Multiplies each property of the given vector by the given scale and returns the result.
     *
     * A vector is a group of numbers which represents a specific point in 2D/3D/4D/etc. space.
     * For example, the vector `{ x: 1, y: 2, z: 3 }` represents the point `(1, 2, 3)` in 3D space where `x`, `y`, and `z` are the names of the dimensions (or axes).
     *
     * @param vector the vector that should be scaled.
     * @param scale the number that the vector should be multiplied by.
     *
     * @example Scale a 3D point by 5.
     * const result = math.scaleVector(
     *     { x: 5, y: 6, z: 7 },
     *     5
     * );
     *
     * os.toast(result); // { x: 25, y: 30, z: 35 }
     *
     * @dochash actions/math
     * @docname math.scaleVector
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
     * Determines if the given numbers are within 2 decimal places of each other.
     *
     * Because [JavaScript numbers](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) have limited precision, some calculations cannot be represented like they can in normal math.
     * For example, `1/3` is `0.3333...` but in JavaScript `1/3` gives `0.33333333333333331483`.
     * This inaccuracy can cause problems when many calculations are done, which can cause numbers that appear to be the same to actually be different.
     *
     * The solution is to check the difference between two numbers to see if it is below some arbitrary threshold.
     * In this case, the threshold is `0.005`.
     *
     * @param first the first number to check.
     * @param second the second number to check.
     *
     * @example Determine 0.1 + 0.2 is close to 0.3.
     * const first = 0.1 + 0.2;
     * const second = 0.3;
     * const result = math.areClose(first, second);
     * const areEqual = first === second;
     * os.toast("Equal: " + areEqual + ", Close: " + result); // Equal: false, Close: true
     *
     * @dochash actions/math
     * @docname math.areClose
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
     * Calculates the [hash](https://en.wikipedia.org/wiki/Cryptographic_hash_function) of the given data using the specified algorithm and returns the result in the specified format.
     * Returns a [hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal) string, [Base64](https://en.wikipedia.org/wiki/Base64) string, or [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) based on the specified format.
     *
     * Hashes are generally useful for validating that a piece of data did not change or for checking to see if two values are the same thing.
     *
     * Supports calculating hashes of strings, numbers, booleans, objects, arrays, and bots.
     *
     * @param algorithm a string indicating which algorithm should be used for calculating the hash.
     * The following algorithms are supported:
     *
     * -    `"sha256"` (equivalent to {@link crypto.sha256})
     * -    `"sha512"` (equivalent to {@link crypto.sha512})
     * -    `"sha1"` (not recommended unless needed for compatability with external software)
     *
     * @param format a string indicating which format the hash should be output as.
     * The following formats are supported:
     *
     * -    `"hex"`  - The output should be a hexadecimal string.
     * -    `"base64"` - The output should be a Base64 string.
     *
     * @param data the pieces of data that should be included in the hash. If multiple pieces of data are included, they will be concatenated before hashing.
     *
     * @example Calculate the SHA-256 hex hash of a string
     * const hash = crypto.hash("sha256", "hex", "hello, world");
     * os.toast(hash);
     *
     * @example Calculate the SHA-256 base64 hash of a string
     * const hash = crypto.hash("sha256", "base64", "hello, world");
     * os.toast(hash);
     *
     * @example Calculate the SHA-512 hex hash of a string
     * const hash = crypto.hash("sha512", "hex", "hello, world");
     * os.toast(hash);
     *
     * @example Calculate the SHA-1 hex hash of a string
     * const hash = crypto.hash("sha1", "hex", "hello, world");
     * os.toast(hash);
     *
     * @dochash actions/crypto
     * @doctitle Crypto Actions
     * @docsidebar Crypto
     * @docdescription Crypto actions are used for general cryptographic operations like hashing, encryption, and decryption.
     * @docname crypto.hash
     * @docid crypto.hash-string
     */
    function _hash_string(
        algorithm: 'sha256' | 'sha512' | 'sha1',
        format: 'hex' | 'base64',
        ...data: unknown[]
    ): string {
        return null;
    }

    /**
     * Calculates the [hash](https://en.wikipedia.org/wiki/Cryptographic_hash_function) of the given data using the specified algorithm and returns the result as a raw array of bytes.
     * Returns a [hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal) string, [Base64](https://en.wikipedia.org/wiki/Base64) string, or [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) based on the specified format.
     *
     * Hashes are generally useful for validating that a piece of data did not change or for checking to see if two values are the same thing.
     *
     * Supports calculating hashes of strings, numbers, booleans, objects, arrays, and bots.
     *
     * @param algorithm a string indicating which algorithm should be used for calculating the hash.
     * The following algorithms are supported:
     *
     * -    `"sha256"` (equivalent to {@link crypto.sha256})
     * -    `"sha512"` (equivalent to {@link crypto.sha512})
     * -    `"sha1"` (not recommended unless needed for compatability with external software)
     *
     * @param format a string indicating which format the hash should be output as.
     * The following formats are supported:
     *
     * -    `"raw"`  - The output should be a [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)
     *
     * @param data the pieces of data that should be included in the hash. If multiple pieces of data are included, they will be concatenated before hashing.
     *
     * @example Calculate the SHA-256 raw hash of a string
     * const hash = crypto.hash("sha256", "raw", "hello, world");
     * console.log(hash);
     *
     * @dochash actions/crypto
     * @doctitle Crypto Actions
     * @docsidebar Crypto
     * @docdescription Crypto actions are used for general cryptographic operations like hashing, encryption, and decryption.
     * @docname crypto.hash
     * @docid crypto.hash-raw
     */
    function _hash_raw(
        algorithm: 'sha256' | 'sha512' | 'sha1',
        format: 'raw',
        ...data: unknown[]
    ): Uint8Array {
        return null;
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
     * Calculates the [HMAC](https://en.wikipedia.org/wiki/HMAC) [hash](https://en.wikipedia.org/wiki/Cryptographic_hash_function) of the given data using the specified algorithm and returns the result in the specified format.
     * Returns a [hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal) string, [Base64](https://en.wikipedia.org/wiki/Base64) string, or [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) based on the specified format.
     *
     * HMAC hashes are generally useful for validating that a piece of data was sent from someone else who has a particular secret key.
     *
     * Supports calculating hashes of strings, numbers, booleans, objects, arrays, and bots.
     *
     * @param algorithm a string indicating which algorithm should be used for calculating the hash.
     * The following algorithms are supported:
     *
     * -    `"hmac-sha256"` (equivalent to {@link crypto.hmacSha256})
     * -    `"hmac-sha512"` (equivalent to {@link crypto.hmacSha512})
     * -    `"hmac-sha1"` (not recommended unless needed for compatability with external software)
     *
     * @param format a string indicating which format the hash should be output as.
     * The following formats are supported:
     *
     * -    `"hex"`  - The output should be a hexadecimal string.
     * -    `"base64"` - The output should be a Base64 string.
     *
     * @param key the secret key that should be used to create the HMAC.
     *
     * @param data the pieces of data that should be included in the hash. If multiple pieces of data are included, they will be concatenated before hashing.
     *
     * @example Calculate the hexadecimal HMAC-SHA256 of a string with a key
     * const hash = crypto.hmac("hmac-sha256", "hex", "key", "hello, world");
     * os.toast(hash);
     *
     * @example Calculate the Base64 HMAC-SHA256 of a string with a key
     * const hash = crypto.hmac("hmac-sha256", "base64", "key", "hello, world");
     * os.toast(hash);
     *
     * @example Calculate the hexadecimal HMAC-SHA512 of a string with a key
     * const hash = crypto.hmac("hmac-sha512", "hex", "key", "hello, world");
     * os.toast(hash);
     *
     * @example Calculate the hexadecimal HMAC-SHA1 of a string with a key
     * const hash = crypto.hmac("hmac-sha1", "hex", "key", "hello, world");
     * os.toast(hash);
     *
     * @dochash actions/crypto
     * @docname crypto.hmac
     * @docid crypto.hmac-string
     */
    function _hmac_string(
        algorithm: 'sha256' | 'sha512' | 'sha1',
        format: 'hex' | 'base64',
        key: string,
        ...data: unknown[]
    ): string {
        return null;
    }

    /**
     * Calculates the [HMAC](https://en.wikipedia.org/wiki/HMAC) [hash](https://en.wikipedia.org/wiki/Cryptographic_hash_function) of the given data using the specified algorithm and returns the result in the specified format.
     * Returns a [hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal) string, [Base64](https://en.wikipedia.org/wiki/Base64) string, or [Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) based on the specified format.
     *
     * HMAC hashes are generally useful for validating that a piece of data was sent from someone else who has a particular secret key.
     *
     * Supports calculating hashes of strings, numbers, booleans, objects, arrays, and bots.
     *
     * @param algorithm a string indicating which algorithm should be used for calculating the hash.
     * The following algorithms are supported:
     *
     * -    `"hmac-sha256"` (equivalent to {@link crypto.hmacSha256})
     * -    `"hmac-sha512"` (equivalent to {@link crypto.hmacSha512})
     * -    `"hmac-sha1"` (not recommended unless needed for compatability with external software)
     *
     * @param format a string indicating which format the hash should be output as.
     * The following formats are supported:
     *
     * -    `"hex"`  - The output should be a hexadecimal string.
     * -    `"base64"` - The output should be a Base64 string.
     *
     * @param key the secret key that should be used to create the HMAC.
     *
     * @param data the pieces of data that should be included in the hash. If multiple pieces of data are included, they will be concatenated before hashing.
     *
     * @example Calculate the raw HMAC-SHA256 of a string with a key
     * const hash = crypto.hmac("hmac-sha256", "raw", "key", "hello, world");
     * console.log(hash);
     *
     * @dochash actions/crypto
     * @docname crypto.hmac
     * @docid crypto.hmac-raw
     */
    function _hmac_raw(
        algorithm: 'sha256' | 'sha512' | 'sha1',
        format: 'raw',
        key: string,
        ...data: unknown[]
    ): Uint8Array {
        return null;
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
     * Calculates the [SHA-256](https://en.wikipedia.org/wiki/SHA-2) [hash](https://en.wikipedia.org/wiki/Cryptographic_hash_function) of the given data.
     * Returns a [hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal) string that represents the computed hash.
     *
     * Hashes are generally useful for validating that a piece of data did not change or for checking to see if two values are the same thing.
     *
     * Supports calculating hashes of strings, numbers, booleans, objects, arrays, and bots.
     *
     * @param data a piece of data that should be included in the hash. If multiple pieces of data are included, they will be concatenated before hashing.
     *
     * @example Calculate the hash of a string.
     * const hash = crypto.sha256("hello, world");
     * os.toast(hash);
     *
     * @example Calculate the hash of an object.
     * const hash = crypto.sha256({
     *     abc: "def"
     * });
     * os.toast(hash);
     *
     * @dochash actions/crypto
     * @docname crypto.sha256
     */
    function sha256(...data: unknown[]): string {
        let sha = hashSha256();
        return _hash(sha, data, 'hex');
    }

    /**
     * Calculates the [SHA-512](https://en.wikipedia.org/wiki/SHA-2) [hash](https://en.wikipedia.org/wiki/Cryptographic_hash_function) of the given data.
     * Returns a [hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal) string that represents the computed hash.
     *
     * Hashes are generally useful for validating that a piece of data did not change or for checking to see if two values are the same thing.
     *
     * Supports calculating hashes of strings, numbers, booleans, objects, arrays, and bots.
     *
     * @param data a piece of data that should be included in the hash. If multiple pieces of data are included, they will be concatenated before hashing.
     *
     * @example Calculate the hash of a string.
     * const hash = crypto.sha512("hello, world");
     * os.toast(hash);
     *
     * @example Calculate the hash of an object.
     * const hash = crypto.sha512({
     *     abc: "def"
     * });
     * os.toast(hash);
     *
     * @dochash actions/crypto
     * @docname crypto.sha512
     */
    function sha512(...data: unknown[]): string {
        let sha = hashSha512();
        return _hash(sha, data, 'hex');
    }

    /**
     * Calculates the [HMAC](https://en.wikipedia.org/wiki/HMAC) [SHA-256](https://en.wikipedia.org/wiki/SHA-2) [hash](https://en.wikipedia.org/wiki/Cryptographic_hash_function) of the given data.
     * Returns a [hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal) string that represents the computed hash.
     *
     * HMAC hashes are generally useful for validating that a piece of data was sent from someone else who has a particular secret key.
     *
     * Supports calculating hashes of strings, numbers, booleans, objects, arrays, and bots.
     *
     * @param key the secret key that should be used to create the HMAC.
     * @param data the data that should be included in the hash. If multiple pieces of data are included, they will be concatenated before hashing.
     *
     * @example Calculate the HMAC of a string with a key.
     * const hash = crypto.hmacSha256("key", "hello, world");
     * os.toast(hash);
     *
     * @example Calculate the HMAC of an object.
     * const hash = crypto.hmacSha256("key", {
     *     abc: "def"
     * });
     * os.toast(hash);
     *
     * @dochash actions/crypto
     * @docname crypto.hmacSha256
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
     * Calculates the [HMAC](https://en.wikipedia.org/wiki/HMAC) [SHA-215](https://en.wikipedia.org/wiki/SHA-2) [hash](https://en.wikipedia.org/wiki/Cryptographic_hash_function) of the given data.
     * Returns a [hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal) string that represents the computed hash.
     *
     * HMAC hashes are generally useful for validating that a piece of data was sent from someone else who has a particular secret key.
     *
     * Supports calculating hashes of strings, numbers, booleans, objects, arrays, and bots.
     *
     * @param key the secret key that should be used to create the HMAC.
     * @param data the data that should be included in the hash. If multiple pieces of data are included, they will be concatenated before hashing.
     *
     * @example Calculate the HMAC of a string with a key.
     * const hash = crypto.hmacSha512("key", "hello, world");
     * os.toast(hash);
     *
     * @example Calculate the HMAC of an object.
     * const hash = crypto.hmacSha512("key", {
     *     abc: "def"
     * });
     * os.toast(hash);
     *
     * @dochash actions/crypto
     * @docname crypto.hmacSha512
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
     * [Encrypts](https://en.wikipedia.org/wiki/Encryption) the given data using the given secret key (also commonly known as a password) and returns the result.
     *
     * Use the {@link crypto.decrypt} function to decrypt the data.
     *
     * _Always use a strong and unique secret key._
     * Use a password manager such as LastPass or 1Password to help you create and keep track of them.
     *
     * @description Always choose a strong unique secret. Use a password manager such as LastPass or 1Password to
     * help you create and keep track of them.
     *
     * Assuming a strong secret, this method will return a string of encrypted data that is confidential (unreadable without the key), reliable (the encrypted data cannot be changed without making it unreadable), and authentic (decryptability proves that this specific key was used to encrypt the data).
     *
     * As a consequence, encrypting the same data with the same key will produce different results. This is to ensure that an attacker cannot correlate different pieces of data to potentially deduce the original plaintext.
     *
     * Encrypts the given data using an authenticated encryption mechanism based on [XSalsa20](https://libsodium.gitbook.io/doc/advanced/stream_ciphers/xsalsa20) (An encryption cipher)
     * and [Poly1305](https://en.wikipedia.org/wiki/Poly1305) (A message authentication code).
     * Additionally uses [scrypt](https://en.wikipedia.org/wiki/Scrypt) for [password-based key derivation](https://en.wikipedia.org/wiki/Key_derivation_function).
     *
     * @param secret the secret that should be used to encrypt the data. Use a strong an unique secret for maximum security.
     * @param data the string data that should be encrypted.
     *
     * @example Encrypt the given data and toast it.
     * const encrypted = crypto.encrypt("key", "hello, world");
     * os.toast(encrypted);
     *
     * @dochash actions/crypto
     * @docname crypto.encrypt
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
     * [Decrypts](https://en.wikipedia.org/wiki/Encryption) the given data using the given secret key (also commonly known as a password) and returns the result.
     *
     * Use the {@link crypto.encrypt} function to encrypt the data.
     *
     * @param secret the secret that should be used to decrypt the data. This should be the same key that was used to encrypt the data.
     * @param data the data from {@link crypto.encrypt} that should be decrypted.
     *
     * @example Decrypt the given data and toast it.
     * const decrypted = crypto.decrypt("key", "v1.vWUhsdfiKkxXi9Rt+BBNbcP/TiHZpxUL.iikPvWN6rNncY3j045gM0268MoRi0NNf.IpWYgzXQmjRea4MNLDXB1GmrinWLSSOMw+NfqeE=");
     * os.toast(decrypted);
     *
     * @dochash actions/crypto
     * @docname crypto.decrypt
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
     * Creates a keypair that can be used to [encrypt and decrypt](https://en.wikipedia.org/wiki/Encryption) data.
     *
     * Use {@link crypto.asymmetric.encrypt} and {@link crypto.asymmetric.decrypt} to encrypt and decrypt the data.
     *
     * Always use a strong and unique secret key. Use a password manager such as LastPass or 1Password to help you create and keep track of them.
     *
     * Keypairs are made up of a private key and a public key The public key is a special value that can be used to encrypt data and the private key is a related value that can be used to decrypt data that was encrypted by the private key.
     *
     * The private key is called "private" because it is encrypted using the given secret while the public key is called "public" because it is not encrypted so anyone can use it if they have access to it.
     *
     * Note that both the private and public keys are randomly generated, so while the public is unencrypted, it won't be able to be used by someone else unless they have access to it.
     *
     * @param secret the secret that should be used to encrypt the private key of the keypair.
     *
     * @example Create a keypair and toast it.
     * const keypair = crypto.asymmetric.keypair("my secret");
     * os.toast(keypair);
     *
     * @dochash actions/crypto
     * @docname crypto.asymmetric.keypair
     */
    function asymmetricKeypair(secret: string): string {
        return realAsymmetricKeypair(secret);
    }

    /**
     * [Encrypts](https://en.wikipedia.org/wiki/Encryption) the given data using the given keypair's public key and returns the result.
     *
     * Use the {@link crypto.asymmetric.decrypt} function to decrypt the data.
     *
     * This method will return a string of encrypted data that is confidential (unreadable without the keypair and secret used to encrypt it), reliable (the encrypted data cannot be changed without making it unreadable), and authentic (decryptability proves that the keypair was used to encrypt the data).
     *
     * As a consequence, encrypting the same data with the same keypair will produce different results. This is to ensure that an attacker cannot correlate different pieces of data to potentially deduce the original plaintext.
     *
     * Encrypts the given data using an asymmetric authenticated encryption mechanism based on x25519 (A key-exchange mechanism), XSalsa20 (An encryption cipher) and Poly1305 (A message authentication code).
     *
     * You may notice that this function does not need a secret to decrypt the keypair.
     * This is because the public key of the keypair is used to encrypt the data. Due to how asymmetric encryption works, only the encrypted private key will be able to decrypt the data.
     *
     * Encrypts the given data using an authenticated encryption mechanism based on [x25519](https://en.wikipedia.org/wiki/Curve25519), [XSalsa20](https://libsodium.gitbook.io/doc/advanced/stream_ciphers/xsalsa20) (An encryption cipher) and [Poly1305](https://en.wikipedia.org/wiki/Poly1305) (A message authentication code).
     *
     * @param keypair the keypair that should be used to encrypt the data.
     * @param data the string data that should be encrypted.
     *
     * @example Encrypt the given data and toast it.
     * const keypair = 'vEK1.UoNnUjLz7FdgjJ52P+f/sNw1VDsKwyX0kI+Bt7ivoF4=.djEuZmFvL0tOa1RJL3ByVm8wZ2QxYTk5clV4OXZUTk0wMnUuUHpZQUM1aVlYOUUra09vZ2hmamdyNll6T0tJS0ZjQjUuMGx2VGR5UmR2dloxUklWam5OODMrN09ibnk0c2MzbjNKYzZtSmFPYzc0ZXJXMlhHQzJsWW1vWGdFdzBRM2xkSg==';
     * const encrypted = crypto.asymmetric.encrypt(keypair, "hello, world");
     * os.toast(encrypted);
     *
     * @dochash actions/crypto
     * @docname crypto.asymmetric.encrypt
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
     * [Decrypts](https://en.wikipedia.org/wiki/Encryption) the given data with the given keypair and secret and returns the result.
     * If the data was unable to be decrypted (e.g. if the secret was wrong or the data was tampered with), `null` will be returned.
     *
     * Use the {@link crypto.asymmetric.encrypt} function to encrypt the data.
     *
     * @param keypair the keypair that should be used to decrypt the data.
     * @param secret the secret that should be used to decrypt the keypair's private key.
     * @param data the data that should be decrypted.
     *
     * @example Decrypt the given data and toast it.
     * const keypair = 'vEK1.UoNnUjLz7FdgjJ52P+f/sNw1VDsKwyX0kI+Bt7ivoF4=.djEuZmFvL0tOa1RJL3ByVm8wZ2QxYTk5clV4OXZUTk0wMnUuUHpZQUM1aVlYOUUra09vZ2hmamdyNll6T0tJS0ZjQjUuMGx2VGR5UmR2dloxUklWam5OODMrN09ibnk0c2MzbjNKYzZtSmFPYzc0ZXJXMlhHQzJsWW1vWGdFdzBRM2xkSg==';
     * const encrypted = 'vA1.3CC1r0fJP2tPS09C8YrTDQCJmgFczxprNEcMOzY4JD4=.3oiC7nG6N4jblFhBd4usrdid/w4Phwg/.X/9mbZYOGBjRX7YAO4D2zYJvZ3c=';
     * const decrypted = crypto.asymmetric.decrypt(keypair, 'password', encrypted);
     * os.toast(decrypted);
     *
     * @dochash actions/crypto
     * @docname crypto.asymmetric.decrypt
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
     * Creates a keypair that can be used to [digitially sign](https://en.wikipedia.org/wiki/Digital_signature) and verify data.
     *
     * Digital signatures are generally useful for verifying that a piece of data was sent from someone who had access to the keypair.
     *
     * Use {@link crypto.sign} and {@link crypto.verify} to sign and verify the data.
     *
     * Keypairs are made up of a private key and a public key. The private key is a special value that can be used to create digital signatures and the public key is a related value that can be used to verify that a digitital signature was created by the private key.
     *
     * The private key is called "private" because it is encrypted using the given secret while the public key is called "public" because it is not encrypted so anyone can use it if they have access to it.
     *
     * Note that both the private and public keys are randomly generated, so while the public is unencrypted, it won't be able to be used by someone else unless they have access to it.
     *
     * @param secret the secret that should be used to encrypt the private key of the keypair.
     *
     * @example Create a keypair and toast it.
     * const keypair = crypto.keypair("my secret");
     * os.toast(keypair);
     *
     * @dochash actions/crypto
     * @docname crypto.keypair
     */
    function keypair(secret: string): string {
        return realKeypair(secret);
    }

    /**
     * Calculates the digital signature for the given data using the given keypair and secret (also commonly known as a password).
     *
     * Use {@link crypto.keypair} to create a keypair that can be used to create signatures.
     *
     * Use {@link crypto.verify} to validate signatures.
     *
     * Digital signatures are used to verify the authenticity and integrity of data.
     *
     * This works by leveraging asymmetric encryption but in reverse.
     *
     * If we can encrypt some data such that only the public key of a keypair can decrypt it, then we can prove that the data was encrypted (i.e. signed) by the corresponding private key.
     *
     * And since the public key is available to everyone but the private key is only usable when you have the secret, we can use this to prove that a particular piece of data was signed by whoever knows the secret.
     *
     * Note that because of how digital signatures work, signing the same data with the same keypair will produce the same signature.
     *
     * @param keypair the keypair that should be used to sign the data.
     * @param secret the secret that was used to encrypt the private key of the keypair.
     * @param data the string data that should be signed.
     *
     * @example Create a signature for the string "hello".
     * // Returned from crypto.keypair()
     * const keypair = "vK1.ugqz8HzhaQhfORc8Coc6WVHTciMrcmfSUuw99KLRJYk=.djEuak1QNkF5MHFzMTBFMXRHamR1ZFhqTmRTV3AycjVyZUsudzFjSWZWVUFQVUdqK3hTM000NUduYUlNQ094SUhCTUEuanYrZEQwNVJFVGo3UzRPSklQQUkxc3U0anZjUmxrTEM2OW1BajkyMkxxdTFZd2sxNzV5QW9Dc3gwU3RENlQ0cmtNTVk4b2Zna2JRVTIrQmp5OUIrTTJsaFI2ajcyb0lJdmdSWkRXRU9lZE09";
     *
     * const signature = crypto.sign(keypair, "my secret", "hello");
     * os.toast(signature);
     *
     * @dochash actions/crypto
     * @docname crypto.sign
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
     * Validates that the given signature was created by the given keypair for the given data. Returns true if the signature is valid. Returns false otherwise.
     *
     * Use {@link crypto.keypair} to create a keypair that can be used to create signatures.
     *
     * Use {@link crypto.sign} to create signatures.
     *
     * @param keypair the keypair that was used to create the signature.
     * @param signature the signature that was returned from {@link crypto.sign}.
     * @param data the data that was used in the call to {@link crypto.sign}.
     *
     * @dochash actions/crypto
     * @docname crypto.verify
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
     * Gets performance stats from the runtime.
     *
     * @dochash actions/debuggers
     * @docname perf.getStats
     */
    function getStats(): PerformanceStats {
        return {
            numberOfBots: context.bots.length,
            shoutTimes: context.getShoutTimers(),
            numberOfActiveTimers: context.getNumberOfActiveTimers(),
            loadTimes: context.getLoadTimes(),
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
     * Sets the given tag to the given value on the given bot, list of bots, or mod.
     * @param bot the bot, list of bots, or mod that the tag should be set on.
     * @param tag the tag that should be changed.
     * @param value the value that should be placed into the tag(s).
     *
     * @example Set a bot's color to "green".
     * setTag(this, "color", "green");
     *
     * @dochash actions/data
     * @docgroup 02-data-actions
     * @docname setTag
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
     * Sets the given tag mask to the given value on the given bot or list of bots. If a space is specified, then the tag mask will be set inside that space.
     * @param bot the bot or list of bots that the tag mask should be set on.
     * @param tag the tag that should be changed.
     * @param value the value that should be placed into the tag(s).
     * @param space the space that the tag mask should exist in. If omitted, then the tag mask will be created in the `tempLocal` space.
     *
     * @example Set a bot's color to "green".
     * setTagMask(this, "color", "green")
     *
     * @example Set a bot's #color to green in the local space.
     * setTagMask(this, "#color", "green", "local");
     *
     * @dochash actions/data
     * @docgroup 02-data-actions
     * @docname setTagMask
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
     * Clears the tag masks on the given bot or list of bots. If a space is specified, then only the tag masks in that space will be deleted.
     *
     * @param bot the bot or list of bots that the tag mask should be set on.
     * @param space the space that the tag mask should exist in. If omitted, then the tag masks in all spaces will be deleted.
     *
     * @dochash actions/data
     * @docgroup 02-data-actions
     * @docname clearTagMasks
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
     * Inserts the given text into the tag at the given index. Useful for editing the text in a tag without interrupting other players that are editing the same tag.
     * Returns the resulting raw tag value.
     * @param bot the bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index the zero-based index that the text should be inserted at.
     * @param text the string of text that should be inserted.
     *
     * @example Add some text to the end of a tag.
     * insertTagText(thisBot, "myTag", tags.myTag.length, "xyz");
     *
     * @example Add some text to the beginning of a tag.
     * insertTagText(thisBot, "myTag", 0, "abc");
     *
     * @dochash actions/data
     * @docgroup 02-data-actions
     * @docname insertTagText
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
     * Inserts the given text into the tag mask at the given index. Useful for editing the text in a tag without interrupting other players that are editing the same tag.
     * If a space is specified, then only the tag mask in that space will be changed.
     *
     * @param bot The bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index the zero-based index that the text should be inserted at.
     * @param text the string of text that should be inserted.
     * @param space the space that the tag mask is in. If omitted, then the tempLocal space will be used.
     *
     * @example Add some text to the end of a tag mask.
     * insertTagMaskText(thisBot, "myTag", tags.myTag.length, "xyz");
     *
     * @example Add some text to the beginning of a tag mask that is in the local space.
     * insertTagMaskText(thisBot, "myTag", 0, "abc", "local");
     *
     * @dochash actions/data
     * @docgroup 02-data-actions
     * @docname insertTagMaskText
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
     * Deletes the specified number of characters from the given tag at the given index. Useful for editing the text in a tag without interrupting other players that are editing the same tag.
     * Returns the resulting raw tag value.
     *
     * @param bot The bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index the zero-based index that the text should start to be deleted at.
     * @param count the number of characters that should be deleted.
     *
     * @example Delete the last two characters from a tag.
     * deleteTagText(bot, "myTag", tags.myTag.length - 2, 2);
     *
     * @example Delete the first 3 characters from a tag.
     * deleteTagText(bot, "myTag", 0, 3);
     *
     * @dochash actions/data
     * @docgroup 02-data-actions
     * @docname deleteTagText
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
     * Deletes the specified number of characters from the given tag mask at the given index. Useful for editing the text in a tag without interrupting other players that are editing the same tag.
     * If a space is specified, then only the tag mask in that space will be changed.
     *
     * Returns the resulting raw tag value.
     *
     * @param bot The bot that should be edited.
     * @param tag The tag that should be edited.
     * @param index the zero-based index that the text should start to be deleted at.
     * @param count the number of characters that should be deleted.
     * @param space the space that the tag mask is in. If omitted, then the `tempLocal` space will be used.
     *
     * @example Delete the last two characters from a tag mask.
     * deleteTagMaskText(bot, "myTag", tags.myTag.length - 2, 2);
     *
     * @example Delete the first 3 characters from a tag mask in the local space.
     * deleteTagMaskText(bot, "myTag", 0, 3, "local");
     *
     * @dochash actions/data
     * @docgroup 02-data-actions
     * @docname deleteTagMaskText
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
     * Removes all the tags from the given bot that match the given tag section.
     *
     * @param bot the bot or list of bots that should have the tags removed.
     * @param tagSection the string or regex that specifies which tags to remove. If given a string, then all the tags that start with the given string will be removed. If given a regex, then all the tags which match the regex will be removed.
     *
     * @example Remove tags named starting with "abc" from this bot.
     * removeTags(thisBot, "abc");
     *
     * @example Remove tags named "hello" using a case-insensitive regex from this bot.
     * removeTags(thisBot, /^hello$/gi);
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname removeTags
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
     * Renames the given original tag on the given bot or list of bots to the given new tag. If the original tag does not exist on the bot, then no changes will take place. If the new tag already exists on the bot, then it will be overwritten with the contents of the original tag.
     *
     * @param bot the bot or list of bots that should have the tag renamed.
     * @param originalTag the name of the tag that should be renamed.
     * @param newTag the new name that the tag should have.
     *
     * @example Rename the "auxColor" tag to "color"
     * renameTag(thisBot, "auxColor", "color");
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname renameTag
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
     *
     * @param bot the bot thatthe mods should be applied to.
     * @param mods the mods that should be applied to the bot. If two mods have the same tag, then the mod that is last in the list will win.
     *
     * @example Set the "test" tag and "name" tag on a bot
     * applyMod(bot, {
     *    test: true,
     *    name: "bob"
     * });
     *
     * @dochash actions/mods
     * @doctitle Mod Actions
     * @docsidebar Mods
     * @docgroup 01-mod-actions
     * @docname applyMod
     */
    function applyMod(bot: any, ...mods: Mod[]): void {
        let appliedDiffs: BotTags[] = [];
        for (let diff of mods) {
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
     * Removes the tags contained in the given mod(s) from the given bot or mod.
     *
     * @param bot The the bot or mod that the tags should be removed from.
     * @param mods the bots or mods that contain the tags which should be removed from the original bot.
     *
     * @example Remove a mod from this bot
     * const mod = {
     *     color: 'red',
     *     name: 'bob'
     * };
     * subtractMods(this, mod);
     *
     * @example Remove multiple mods from this bot
     * subtractMods(this, {
     *     color: 'red'
     * }, {
     *     name: 'bob'
     * });
     *
     * @dochash actions/mods
     * @docgroup 01-mod-actions
     * @docname subtractMods
     */
    function subtractMods(bot: any, ...mods: Mod[]): void {
        let subtractedDiffs: BotTags[] = [];
        for (let diff of mods) {
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
     * Creates a new bot or combination of bots with the given mods. Also triggers [`@onCreate`](tags:@onCreate) on all the created bots.
     * By default, bots are created with a unique {@tag id}, {@tag creator} set to the current `bot.id`, and {@tag space} set to `shared`.
     * Bots must be created with at least one tag. If `create()` tries to make a bot with zero tags then an error will be thrown.
     *
     * If {@tag creator} references a non-existent bot or a bot with a different {@tag space} than the created bot, then {@tag creator} will be set to `null`.
     *
     * @param mods the mods that should be applied to the new bot(s).
     * If no parameters are specified, then the new bot will have its {@tag creator} set to `bot.id` and {@tag space} set to `shared`.
     * If an array of mods is used for a parameter, then one bot will be created for _each unique combination of mods_.
     *
     * @returns The bot(s) that were created.
     *
     * @example Create a red bot
     * let redBot = create({
     *     color: "red"
     * });
     *
     * @example Create a parent and a child bot
     * let myParentBot = create({
     *   creator: null,
     *    label: "Parent"
     * });
     * let myChildBot = create({
     *    creator: getID(myParentBot),
     *    label: "Child"
     * });
     *
     * @example Create a red bot in the tempLocal  space
     * let myBot = create({ space: "tempLocal", color: "red" });
     *
     * @example Create a bot from multiple mods
     * // myBot is placed in the "myDimension" dimension and is colored green
     * let myBot = create({ myDimension: true }, {
     *     color: "green"
     * });
     *
     * @example Create a red bot and a blue bot
     * let [myRedBot, myBlueBot] = create({ creator: null}, [
     *     {
     *        color: "red"
     *     },
     *     {
     *       color: "blue"
     *     }
     * });
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname create
     */
    function _create(...mods: Mod[]): RuntimeBot | RuntimeBot[] {
        return null;
    }

    function create(botId: string, ...mods: Mod[]) {
        return createBase(botId, () => context.uuid(), ...mods);
    }

    function* createBase(
        botId: string,
        idFactory: () => string,
        ...datas: Mod[]
    ) {
        let parentDiff = botId ? { creator: botId } : {};
        return yield* createFromMods(idFactory, parentDiff, ...datas);
    }

    /**
     * Creates a new bot that contains the given tags.
     * @param mods The mods that specify what tags to set on the bot.
     */
    function* createFromMods(
        idFactory: () => string,
        ...mods: (Mod | Mod[])[]
    ): Generator<any, RuntimeBot | RuntimeBot[], any> {
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
                        bot.space = space as BotSpace;
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

        yield* event(CREATE_ACTION_NAME, ret);
        for (let bot of ret) {
            yield* event(CREATE_ANY_ACTION_NAME, null, {
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
     * Removes the given bot, list of bots, or bot by #id and triggers @onDestroy for each of the destroyed bots.
     *
     * Note that only destroyable bots will be destroyed. Bots that have {@tag destroyable} set to `false` will not be destroyed.
     *
     * Also note that all bots that have {@tag creator} set to the {@tag id} of a destroyed bot will also be destroyed (unless they are not destroyable). This happens recursively until there are no more bots to destroy.
     *
     * @param bot The bot, bot ID, or list of bots to destroy.
     *
     * @example Destroy a the bot with the name "bob"
     * destroy(getBot("#name", "bob"));
     *
     * @example Destroy all bots that are colored red
     * destroy(getBots("#color", "red"));
     *
     * @example Destroy a bot by its ID
     * // Destroy the bot with the #id: "config"
     * destroy("config");
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname destroy
     */
    function _destroy(bot: string | Bot | string[] | Bot[]): void {}

    /**
     * Destroys the given bot, bot ID, or list of bots.
     * @param bot The bot, bot ID, or list of bots to destroy.
     */
    function* destroy(
        bot: RuntimeBot | string | Bot | (RuntimeBot | string | Bot)[]
    ): Generator<any, void, any> {
        if (typeof bot === 'object' && Array.isArray(bot)) {
            for (let b of bot) {
                yield* destroyBot(b);
            }
        } else {
            yield* destroyBot(bot);
        }
    }

    /**
     * Removes the given bot or bot ID from the simulation.
     * @param bot The bot or bot ID to remove from the simulation.
     */
    function* destroyBot(
        bot: RuntimeBot | string | Bot
    ): Generator<any, void, any> {
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
            yield* event(DESTROY_ACTION_NAME, [id]);
            context.destroyBot(realBot);
        }

        yield* destroyChildren(id);
    }

    function* destroyChildren(id: string): Generator<any, void, any> {
        const children = getBots(byTag('creator', createBotLink([id])));
        for (let child of children) {
            yield* destroyBot(child);
        }
    }

    /**
     * Changes the state that the given bot occupies in the given group. If the state was changed, then the [`@[groupName][stateName]OnExit`](tags:@[groupName][stateName]OnExit) and [`@[groupName][stateName]OnEnter`](tags:@[groupName][stateName]OnExit) whispers are sent to the bot.
     *
     * @param bot the bot whose state should be changed.
     * @param stateName the value that should be set on the bot.
     * @param groupName the name of the tag that should be changed on the bot. If not specified, then the `#state` tag will be used.
     *
     * @example Change the #state of the bot to "Running"
     * // Triggers @stateRunningOnEnter
     * changeState(bot, "Running");
     *
     * @example Change the #playbackState of the bot to "Playing"
     * // Triggers @playbackStatePlayingOnEnter
     * changeState(bot, "Playing", "playbackState");
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname changeState
     */
    function _changeState(
        bot: Bot,
        stateName: string,
        groupName?: string
    ): void {}

    /**
     * Changes the state that the given bot is in.
     * @param bot The bot to change.
     * @param stateName The state that the bot should move to.
     * @param groupName The group of states that the bot's state should change in. (Defaults to "state")
     */
    function* changeState(
        bot: Bot,
        stateName: string,
        groupName: string = 'state'
    ): Generator<any, void, any> {
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
            yield* whisper(bot, `${groupName}${previousState}OnExit`, arg);
        }
        yield* whisper(bot, `${groupName}${stateName}OnEnter`, arg);
    }

    /**
     * Creates and returns a bot link that references the given bots. The link can then be stored in a tag to save it. Useful for creating bot links for an arbitrary number of bots.
     * @param bots The bots that the link should point to.
     *
     * @example Create a link to this bot
     * let link = getLink(thisBot);
     *
     * @examples Toast a link to this bot
     * toast(getLink(thisBot));
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname getLink
     */
    function createBotLinkApi(
        ...bots: (Bot | string | (Bot | string)[])[]
    ): string {
        let targets = bots.flatMap((b) => b);
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
     * Gets the list of bot links that are stored in tags on the specified bot.
     *
     * This function can be useful if you want to discover what tags are linking to bots and get those bot IDs.
     *
     * @param bot The bot to get the links for.
     *
     * @example Get the list of bot links on this bot
     * let botLinks = getBotLinks(thisBot);
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname getBotLinks
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
     * Updates the links in the given bot to point to the new Bot IDs specified in the given ID map.
     *
     * This function is useful if you know that the links in the given bot are outdated and you know which IDs map to the new IDs.
     *
     *
     * @param bot The bot whose links should be updated.
     * @param idMap the map of old bot IDs to the new IDs that should replace them. Each property should be an old ID and each value should be a new ID.
     *
     * @example Change all references to "botA" to "botB" on this bot
     * updateBotLinks(thisBot, {
     *    "botA": "botB"
     * });
     *
     * @dochash actions/data
     * @docgroup 01-data-actions
     * @docname updateBotLinks
     */
    function _updateBotLinks(bot: Bot, idMap: object): void {}

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
     * Sends a shout to all of the other instances that are loaded.
     *
     * @param eventName the name of the shout. e.g. Using onClick for the name will trigger all the {@tag @onClick} listeners.
     * @param arg the optional `that` argument to include with the shout.
     *
     * @example Send a hello super shout to all the loaded instances.
     * superShout("hello");
     *
     * @dochash actions/os/event
     * @docgroup 01-event-actions
     * @docname superShout
     */
    function superShout(eventName: string, arg?: any): SuperShoutAction {
        const event = calcSuperShout(trimEvent(eventName), arg);
        return addAction(event);
    }

    /**
     * Shouts to all bots that are {@tag listening} and have a listen tag for the specified events until one of the bots returns a value.
     * Optionally includes a custom that argument.
     * Also triggers {@tag @onListen} and {@tag @onAnyListen} for the bots that the shout was sent to.
     *
     * This function is useful when you want to shout but only want one bot to process the shout.
     *
     * @param eventNames the array of event names that should be shouted. e.g. Using onClick for the name will trigger the {@tag @onClick} listener until a bot returns a value.
     * @param arg the `that` argument to send with the shout. You do not need to specify this parameter if you do not want to.
     *
     * @example Shout to the first bot that handles \@onClick
     * priorityShout(['onClick']);
     *
     * @example Shout to the first bot that handles \@myTest or \@mySecondTest
     * priorityShout(['myTest', 'mySecondTest']);
     *
     * @example Priority shout with a color
     * priorityShout(['myTest', 'mySecondTest'], "blue");
     *
     * @dochash actions/os/event
     * @docgroup 01-event-actions
     * @docname priorityShout
     */
    function _priorityShout(eventNames: string[], arg?: any): any {
        return null;
    }

    /**
     * Shouts the given events in order until a bot returns a result.
     * Returns the result that was produced or undefined if no result was produced.
     * @param eventNames The names of the events to shout.
     * @param arg The argument to shout.
     *
     * @docgroup 10-event-actions
     */
    function* priorityShout(eventNames: string[], arg?: any) {
        for (let name of eventNames) {
            let results: any = yield* event(name, null, arg, undefined, true);

            if (results.hasResult) {
                return results[results.length - 1];
            }
        }

        return undefined;
    }

    /**
     * Sends a shout to all bots that are {@tag listening} and have
     * a listen tag for the specified name. Optionally includes a custom that argument.
     * Also triggers {@tag @onListen} and {@tag @onAnyListen}.
     *
     * @param name the name of the shout. e.g. Using `onClick` for the name will trigger all [@onClick](tags:@onClick) listeners.
     * @param arg the `that` argument to send with the shout. You do not need to specify this parameter if you do not want to.
     * @returns Returns a list which contains the values returned from each script that was run for the shout.
     *
     * @example Send a \@reset event to all bots
     * shout("reset");
     *
     * @example Send a \@hello event with your name
     * shout("hello", "Bob");
     *
     * @dochash actions/os/event
     * @doctitle Event Actions
     * @docsidebar Events
     * @docdescription Event actions are used to send events to bots.
     * @docgroup 01-event-actions
     * @docname shout
     */
    function _shout(name: string, arg?: any): any {}

    function* shout(name: string, arg?: any) {
        if (!hasValue(name) || typeof name !== 'string') {
            throw new Error('shout() name must be a string.');
        }
        return yield* event(name, null, arg);
    }

    /**
     * Sends a whisper to all bots that are {@tag listening} and have
     * a listen tag for the specified name. Optionally includes a custom that argument.
     * Also triggers {@tag @onListen} and {@tag @onAnyListen}.
     *
     * @param bot the bot, array of bots, bot {@tag id}, or array of bot {@tag id} that the whisper should be sent to.
     * @param eventName the name of the whisper. e.g. Using `onClick` for the name will trigger the [`@onClick`](tags:@onClick) listener for the specified bots.
     * @param arg the `that` argument to send with the shout. You do not need to specify this parameter if you do not want to.
     * @returns Returns a list which contains the values returned from each script that was run for the shout.
     *
     * @example Send a \@reset event to all bots named "Bob"
     * let bots = getBots("#name", "Bob");
     * whisper(bots, "reset");
     *
     * @example Send a \@setColor event to ourself
     * whisper(this, "setColor", "red");
     *
     * @dochash actions/os/event
     * @docgroup 01-event-actions
     * @docname whisper
     */
    function _whisper(
        bot: (Bot | string)[] | Bot | string,
        eventName: string,
        arg?: any
    ): any {}

    function* whisper(
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

        return yield* event(eventName, bots, arg);
    }

    /**
     * Adds the given listener to the given bot for the given tag.
     *
     * @param bot The bot that the listener should be added to.
     * @param tagName The name of the tag that the listener should be added to.
     * @param listener The listener that should be added to the bot.
     *
     * @example Add a listener to the bot for the "onClick" tag
     * const listener = (that) => {
     *   os.toast("Clicked on " + that.face);
     * };
     * os.addBotListener(thisBot, "onClick", listener);
     *
     * @dochash actions/os/event
     * @docgroup 02-event-actions
     * @docname os.addBotListener
     * @docid os.addBotListener
     */
    function addBotListener(
        bot: RuntimeBot,
        tagName: string,
        listener: DynamicListener
    ): void {
        bot[ADD_BOT_LISTENER_SYMBOL](tagName, listener);
    }

    /**
     * Removes the given listener from a bot for a specific tag.
     * @param bot The bot that the listener should be removed from.
     * @param tagName The name of the tag that the listener should be removed from.
     * @param listener The listener that should be removed from the bot.
     *
     * @example Remove a listener from the bot for the "onClick" tag
     * os.removeBotListener(thisBot, "onClick", listener);
     *
     * @dochash actions/os/event
     * @docgroup 02-event-actions
     * @docname os.removeBotListener
     * @docid os.removeBotListener
     */
    function removeBotListener(
        bot: RuntimeBot,
        tagName: string,
        listener: DynamicListener
    ): void {
        bot[REMOVE_BOT_LISTENER_SYMBOL](tagName, listener);
    }

    /**
     * Gets whether the player is viewing the sheetPortal
     *
     * @example Show a toast if the player is viewing the sheet.
     * if (os.inSheet()) {
     *     os.toast("You are in the sheet!");
     * }
     *
     * @dochash actions/os/portals
     * @docname os.inSheet
     * @docgroup 10-config-values
     */
    function inSheet(): boolean {
        return getPortalDimension('sheet') !== null;
    }

    /**
     * Gets the 3D position that the player's camera is at in the given portal.
     *
     * @param portal the portal that the camera position should be retrieved for.
     *
     * @example Get the position of the camera in the grid portal.
     * const position = os.getCameraPosition('grid');
     *
     * @example Get the position of the camera in the miniGridPortal.
     * const position = os.getCameraPosition("mini");
     *
     * @dochash actions/os/portals
     * @docname os.getCameraPosition
     * @docgroup 10-positions
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
     * Gets the 3D rotation that the player's camera is at in the given portal.
     *
     * @param portal the portal that the camera rotation should be retrieved for.
     *
     * @example Get the rotation of the player in the grid portal.
     * const rotation = os.getCameraRotation('grid');
     *
     * @example Get the rotation of the player in the miniGridPortal.
     * const rotation = os.getCameraRotation("mini");
     *
     * @dochash actions/os/portals
     * @docname os.getCameraRotation
     * @docgroup 10-positions
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
     * Gets the 3D position that the player's camera is focusing on in the given portal.
     *
     * This is the same point that is highlighted when {@tag portalShowFocusPoint} is enabled for a portal.
     *
     * @param portal the portal that the camera focus point should be retrieved for.
     *
     * @example Get the focus point of the player in the grid portal.
     * const focusPoint = os.getFocusPoint('grid');
     *
     * @example Get the focus point of the player in the miniGridPortal.
     * const focusPoint = os.getFocusPoint("mini");
     *
     * @dochash actions/os/portals
     * @docname os.getFocusPoint
     * @docgroup 10-positions
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
     * Gets the position that the given pointer is at.
     * @param pointer the pointer that the position should be retrieved for.
     *
     * @example Get the position of the mouse pointer.
     * const position = os.getPointerPosition("mouse");
     *
     * @example Get the position of the left pointer.
     * const position = os.getPointerPosition("left");
     *
     * @dochash actions/os/portals
     * @docname os.getPointerPosition
     * @docgroup 10-positions
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
     * Gets the rotation (in euler angles) that the given pointer is at.
     * @param pointer the pointer that the rotation should be retrieved for.
     *
     * @example Get the rotation of the mouse pointer.
     * const rotation = os.getPointerRotation("mouse");
     *
     * @example Get the rotation of the left pointer.
     * const rotation = os.getPointerRotation("left");
     *
     * @dochash actions/os/portals
     * @docname os.getPointerRotation
     * @docgroup 10-positions
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
     * Gets the direction that the given pointer is pointed in.
     *
     * Can be combined with {@link math.intersectPlane} to find where on the ground the pointer is pointing.
     *
     * @param pointer the pointer that the direction should be retrieved for.
     *
     * @example Get the direction of the mouse pointer.
     * const direction = os.getPointerDirection("mouse");
     *
     * @example Get the direction of the left pointer.
     * const direction = os.getPointerDirection("left");
     *
     * @example Find where the mouse is pointing on the ground.
     * const position = os.getPointerPosition();
     * const direction = os.getPointerDirection();
     * const groundPosition = math.intersectPlane(position, direction);
     *
     * @dochash actions/os/portals
     * @docname os.getPointerDirection
     * @docgroup 10-positions
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
     * Gets the state of the given button on the given controller.
     *
     * @param controller The name of the controller that should be checked.
     * Possible values are:
     *
     * -    `mousePointer` - The mouse.
     * -    `leftPointer` - The left controller.
     * -    `rightPointer` - The right controller.
     * -    `keyboard` - The keyboard.
     * -    `touch` - The touchscreen.
     *
     * @param button the name of the button that you want to get the state of.
     * Possible values are:
     *
     * -    `left` - The left mouse button. Only available on the mouse pointer. On mobile devices this will also be the state of the first touch.
     * -    `right` - The right mouse button. Only available on the mouse pointer.
     * -    `middle` - The middle mouse button. Only available on the mouse pointer.
     * -    `primary` - The primary controller button. Only available on the left and right pointers.
     * -    `squeeze` - The squeeze controller button. Only available on the left and right pointers.
     * -    `Any` Key - The button for the given key. Only available on the keyboard.
     * -    `0` - The first touch. Only available on the touchscreen.
     * -    `1` - The second touch. Only available on the touchscreen.
     * -    `2` - The third touch. Only available on the touchscreen.
     * -    `3` - The fourth touch. Only available on the touchscreen.
     * -    `5` - The fifth touch. Only available on the touchscreen.
     *
     * @example Send a toast if the left mouse button is clicked.
     * const state = os.getInputState("mousePointer", "left");
     * if (state) {
     *     os.toast("Left mouse button is down!");
     * }
     *
     * @example Send a toast if the shift key is down.
     * const state = os.getInputState("keyboard", "Shift");
     * if (state) {
     *     os.toast("Shift is down!");
     * }
     *
     * @dochash actions/os/portals
     * @docname os.getInputState
     * @docgroup 10-input
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
     * Gets the list of supported inputs. The returned strings can be used for the controller property in {@link os.getInputState} calls.
     *
     * @example Get a list of inputs and toast them.
     * const state = os.getInputList();
     * os.toast(state);
     *
     * @dochash actions/os/portals
     * @docname os.getInputList
     * @docgroup 10-input
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
     *
     * Returns a promise that resolves if the user grants the specified media permission(s).
     * If the user blocks permission or has previously blocked permission or any other problem occurs, an error will be thrown.
     *
     * @param options The options that should be used for requesting media permissions. At least one of `audio` or `video` must be set to `true`.
     *
     * @example Get permission for the device's microphone.
     * try {
     *     await os.getMediaPermission({ audio: true });
     * } catch (e) {
     *     console.error('Could not get permission for microphone:', e);
     * }
     *
     * @example Get permission for the device's microphone and camera.
     * try {
     *     await os.getMediaPermission({ audio: true, video: true });
     * } catch (e) {
     *     console.error('Could not get permission for microphone and/or camera:', e);
     * }
     *
     * @dochash actions/os/media
     * @doctitle Media Actions
     * @docsidebar Media
     * @docdescription Actions that are used to manage media permissions.
     * @docname os.getMediaPermission
     */
    function getMediaPermission(options: MediaPermssionOptions) {
        const task = context.createTask();
        const event = calcGetMediaPermission(options, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Gets the number of frames that have occurred over the last second.
     * Returns a promise that resolves with the number of frames that have ocurred in the last second.
     *
     * @example Get the current frames per second.
     * let fps = await os.getAverageFrameRate();
     *
     * @example Create a basic FPS counter.
     * setInterval(async () => {
     *     masks.label = await os.getAverageFrameRate();
     * }, 1000);
     *
     * @dochash actions/os/portals
     * @docname os.getAverageFrameRate
     */
    function getAverageFrameRate(): Promise<number> {
        const task = context.createTask();
        const event = calcGetAverageFrameRate(task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Attempts to join the given meeting room using the given options.
     * Returns a promise that resolves with an object that indicates whether the operation was successful.
     *
     * Triggers the {@tag @onRoomJoined} listener once the room has been successfully joined.
     *
     * Additionally, the following listeners will be triggered when the relevent events occur in the chat room:
     * -    {@tag @onRoomTrackSubscribed}
     * -    {@tag @onRoomTrackUnsubscribed}
     * -    {@tag @onRoomStreamLost}
     * -    {@tag @onRoomStreaming}
     * -    {@tag @onRoomSpeakersChanged}
     * -    {@tag @onRoomRemoteJoined}
     * -    {@tag @onRoomRemoteLeave}
     * -    {@tag @onRoomOptionsChanged}
     *
     * @param roomName the name of the room that should be joined. Any valid string can be used as a room name. Additionally, rooms are shared across instances.
     * @param options the additional options for joining the room.
     *
     * @example Join the "myChat" room
     * const result = await os.joinRoom("myChat");
     * if (result.success) {
     *     os.toast("Joined the room!");
     * } else {
     *     os.toast("Failed to join the room: " + result.errorMessage);
     * }
     *
     * @example Join a room with the video stream disabled
     * const result = await os.joinRoom("myChat", {
     *     video: false
     * });
     * if (result.success) {
     *     os.toast("Joined the room!");
     * } else {
     *     os.toast("Failed to join the room: " + result.errorMessage);
     * }
     *
     * @dochash actions/os/rooms
     * @doctitle Room Actions
     * @docsidebar Rooms
     * @docdescription Room actions are actions that make it easy to create your own custom multimedia chat rooms.
     * @docname os.joinRoom
     */
    function joinRoom(
        roomName: string,
        options?: JoinRoomActionOptions
    ): Promise<JoinRoomResult> {
        const task = context.createTask();
        const event = calcJoinRoom(roomName, options ?? {}, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Attempts to exit the given room using the given options. Returns a promise that resolves with an object which indicates whether the operation was successful.
     *
     * Triggers the {@tag @onRoomLeave} listener once the room has been left.
     *
     * @param roomName the name of the room that should be exited.
     * @param options the additional options for leaving the room.
     *
     * @example Leave the "myChat" room
     * const result = await os.leaveRoom("myChat");
     * if (result.success) {
     *     os.toast("Left the room!");
     * } else {
     *     os.toast("Failed to leave the room: " + result.errorMessage);
     * }
     *
     * @dochash actions/os/rooms
     * @docname os.leaveRoom
     */
    function leaveRoom(
        roomName: string,
        options?: RecordActionOptions
    ): Promise<LeaveRoomResult> {
        const task = context.createTask();
        const event = calcLeaveRoom(roomName, options ?? {}, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Attempts to set the options for the given chat room.
     * Useful for enabling/disabling video, audio, and screensharing. Returns a promise that resolves with an object indicating if the operation was successful and what the current state of the room is.
     *
     * Triggers the {@tag @onRoomOptionsChanged} and {@tag @onRoomTrackSubscribed}/{@tag @onRoomTrackUnsubscribed} listeners as needed for the specified changes.
     *
     * @param roomName the name of the room that the options should be changed in.
     * @param options the options to set. Omitted properties remain unchanged.
     *
     * @example Start screensharing
     * const result = await os.setRoomOptions("myChat", {
     *     screen: true
     * });
     * if (result.success) {
     *     os.toast("Screensharing started!");
     * } else {
     *     os.toast("Failed to start screensharing: " + result.errorMessage);
     * }
     *
     * @example Mute the microphone
     * const result = await os.setRoomOptions("myChat", {
     *     audio: false
     * });
     * if (result.success) {
     *     os.toast("Microphone muted!");
     * } else {
     *     os.toast("Failed to mute microphone: " + result.errorMessage);
     * }
     *
     * @dochash actions/os/rooms
     * @docname os.setRoomOptions
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
     * Attempts to get the current options for the given chat room. Useful for determining the current state of the local video (camera), audio (microphone), and screen streams. Returns a promise that resolves with an object that contains the information.
     *
     * @param roomName The name of the room that the options should be retrieved for.
     *
     * @example Get the current options for a room
     * const result = await os.getRoomOptions("myChat");
     * if (result.success) {
     *     os.toast("Room options: " + JSON.stringify(result.options));
     * } else {
     *     os.toast("Failed to get the options: " + result.errorMessage);
     * }
     *
     * @dochash actions/os/rooms
     * @docname os.getRoomOptions
     */
    function getRoomOptions(roomName: string): Promise<GetRoomOptionsResult> {
        const task = context.createTask();
        const event = calcGetRoomOptions(roomName, task.taskId);
        return addAsyncAction(task, event);
    }

    /**
     * Attempts to get the current options for the specified audio/video track in the specified room.
     * Returns a promise that resolves with an object that contains the information.
     *
     * This function is useful for getting basic information about a track, like the video aspect ratio or if it is sourced from a camera or the screen.
     *
     * @param roomName the name of the room.
     * @param address the address of the audio/video track. Track addresses can be obtained via the {@tag @onRoomTrackSubscribed} listener.
     *
     * @example Get the options for a track
     * const result = await os.getRoomTrackOptions("myChat", "myTrack");
     * if (result.success) {
     *     os.toast("Track options: " + JSON.stringify(result.options));
     * } else {
     *     os.toast("Failed to get the options: " + result.errorMessage);
     * }
     *
     * @dochash actions/os/rooms
     * @docname os.getRoomTrackOptions
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
     * Attempts to set the current options for the specified audio/video track in the specified room. Returns a promise that resolves with an object that indicates whether the operation was successful.
     *
     * This function is useful for locally muting a track or setting the video quality you want it to stream at.
     *
     * @param roomName the name of the room.
     * @param address the address of the audio/video track. Track addresses can be obtained via the {@tag @onRoomTrackSubscribed} listener.
     * @param options the options that should be set for the track.
     *
     * @example Stop streaming a track
     * const result = await os.setRoomTrackOptions("myChat", "myTrack", {
     *     muted: true
     * });
     * if (result.success) {
     *     os.toast("Track muted!");
     * } else {
     *     os.toast("Failed to mute the track: " + result.errorMessage);
     * }
     *
     * @example Set the video quality on a track
     * const result = await os.setRoomTrackOptions("myChat", "myTrack", {
     *     videoQuality: 'low'
     * });
     * if (result.success) {
     *     os.toast("Track video quality changed!");
     * } else {
     *     os.toast("Failed to set video quality on the track: " + result.errorMessage);
     * }
     *
     * @dochash actions/os/rooms
     * @docname os.setRoomTrackOptions
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
     * Attempts to get the current options for the specified remote user in the specified room. Returns a promise that resolves with an object that contains information about the remote user.
     *
     * This function is useful for determining if the user is streaming audio or video and how good their network connection is.
     *
     * @param roomName the name of the room.
     * @param remoteId the ID of the remote user whose options should be retrieved. Remote IDs can be obtained via the {@tag @onRoomRemoteJoined} listener.
     *
     * @example Get the options for a remote user
     * const result = await os.getRoomRemoteOptions("myChat", "myRemote");
     * if (result.success) {
     *     os.toast("Remote options: " + JSON.stringify(result.options));
     * } else {
     *     os.toast("Failed to get the options: " + result.errorMessage);
     * }
     *
     * @dochash actions/os/rooms
     * @docname os.getRoomRemoteOptions
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
     * Attempts to record the given event to the analytics system.
     * @param name The name of the event.
     * @param metadata The metadata to include in the event. Optional.
     */
    function analyticsRecordEvent(name: string, metadata?: any): Promise<void> {
        const task = context.createTask();
        const event = calcAnalyticsRecordEvent(
            name,
            hasValue(metadata) ? metadata : null,
            task.taskId
        );
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
    function* event(
        name: string,
        bots: (Bot | string)[],
        arg?: any,
        sendListenEvents: boolean = true,
        shortCircuit: boolean = false
    ): Generator<any, any[], any> {
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

            let addedListener = false;
            let listener = bot.listeners[tag];
            if (listener) {
                if (!checkedEnergy) {
                    checkedEnergy = true;
                    __energyCheck();
                }
                try {
                    let result: any;
                    if (INTERPRETABLE_FUNCTION in listener) {
                        result = yield* (listener as any)[
                            INTERPRETABLE_FUNCTION
                        ](arg);
                    } else {
                        result = listener(arg, bot, tag);
                    }

                    if (isGenerator(result)) {
                        result = yield* result;
                    }

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
                if (!addedListener) {
                    listeners.push(bot);
                    addedListener = true;
                }
            }

            const dynamicListeners = bot[GET_DYNAMIC_LISTENERS_SYMBOL](tag);
            if (dynamicListeners) {
                for (let listener of dynamicListeners) {
                    if (!checkedEnergy) {
                        checkedEnergy = true;
                        __energyCheck();
                    }
                    try {
                        let result: any;
                        if (INTERPRETABLE_FUNCTION in listener) {
                            result = yield* (listener as any)[
                                INTERPRETABLE_FUNCTION
                            ](arg, bot, tag);
                        } else {
                            result = listener(arg, bot, tag);
                        }

                        if (isGenerator(result)) {
                            result = yield* result;
                        }

                        if (result instanceof Promise) {
                            result.catch((ex) => {
                                context.enqueueError(ex);
                            });
                        }
                    } catch (ex) {
                        context.enqueueError(ex);
                    }
                    if (!addedListener) {
                        listeners.push(bot);
                        addedListener = true;
                    }
                }
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
            yield* event('onListen', listeners, listenArg, false);
            yield* event('onAnyListen', null, listenArg, false);
        }

        if (shortCircuit && stop) {
            (<any>results).hasResult = true;
        }

        return results;
    }

    /**
     * @hidden
     */
    function __energyCheck() {
        let current = context.energy;
        current -= 1;
        context.energy = current;
        if (current <= 0) {
            throw new RanOutOfEnergyError();
        }
    }

    // Helpers
    function addAction<T extends RuntimeActions>(action: T) {
        context.enqueueAction(action);
        return action;
    }

    function addAsyncAction<T extends RuntimeAsyncActions>(
        task: AsyncTask,
        action: T
    ) {
        addAction(action);
        let promise = task.promise;
        (<any>promise)[ORIGINAL_OBJECT] = action;
        return promise;
    }

    async function addAsyncResultAction<T extends RuntimeAsyncActions>(
        task: AsyncTask,
        action: T
    ) {
        const result = await addAsyncAction(task, action);
        if (!result.success) {
            throw new CasualOSError(result);
        }
        return result;
    }

    function addAsyncIterableAction<T extends RuntimeAsyncActions>(
        task: AsyncIterableTask,
        action: T
    ) {
        addAction(action);
        const iterable = task.iterable;
        (<any>iterable)[ORIGINAL_OBJECT] = action;
        return iterable;
    }

    async function addAsyncResultIterableAction<T extends RuntimeAsyncActions>(
        task: AsyncIterableTask,
        action: T
    ) {
        addAsyncIterableAction(task, action);
        const result = await task.promise;
        if (!result.result.success) {
            throw new CasualOSError(result.result);
        }
        return result.iterable;
    }

    function getVersion1DownloadState(state: BotsState): StoredAuxVersion1 {
        return {
            version: 1,
            state,
        };
    }

    function getVersion2DownloadState(update: InstUpdate): StoredAuxVersion2 {
        return {
            version: 2,
            updates: [update],
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
                connectionId: selector,
            };
        }
        return selector
            ? {
                  sessionId: selector.sessionId,
                  userId: selector.userId,
                  connectionId: selector.connectionId,
                  broadcast: selector.broadcast,
              }
            : undefined;
    }
}

export type DefaultLibrary = ReturnType<typeof createDefaultLibrary>;
