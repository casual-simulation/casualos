// This file imports all the files that should be included in the API Documentation generation.
export * from '../../../src/aux-common/math/index';
export {
    DefaultLibrary,
    createDefaultLibrary,
    WebhookOptions,
    WebhookResult,
    AnimateTagFunctionOptions,
    Mod,
    TagFilter,
    BotFilter,
    BotFilterFunction,
    RecordFileApiResult,
    RecordFileApiSuccess,
    RecordFileApiFailure,
    SnapGridTarget,
    UploadedFile,
    RaycastResult,
    RaycastRay,

    JoinRoomResult,
    JoinRoomSuccess,
    JoinRoomFailure,

    LeaveRoomResult,
    LeaveRoomSuccess,
    LeaveRoomFailure,

    GetRoomOptionsResult,
    GetRoomOptionsSuccess,
    GetRoomOptionsFailure,

    SetRoomOptionsResult,
    SetRoomOptionsSuccess,
    SetRoomOptionsFailure,

    GetRoomTrackOptionsResult,
    GetRoomTrackOptionsSuccess,
    GetRoomTrackOptionsFailure,

    SetRoomTrackOptionsResult,
    SetRoomTrackOptionsSuccess,
    SetRoomTrackOptionsFailure,

    GetRoomRemoteOptionsResult,
    GetRoomRemoteOptionsSuccess,
    GetRoomRemoteOptionsFailure,

    Debugger,
    NormalDebugger,
    PausableDebugger,
    PossiblePauseTriggerLocation,
    PossiblePauseTriggerStates,
    PauseTrigger,
    PauseTriggerOptions,
    DebuggerCallFrame,
    DebuggerTagMaskUpdate,
    DebuggerTagUpdate,
    NormalDebuggerOptions,
    PausableDebuggerOptions,
    DebuggerPause,
    DebuggerFunctionLocation,
    DebuggerVariable,
    AttachDebuggerOptions,
    TweenOptions,
    SpeakTextApiOptions,

    PseudoRandomNumberGenerator,
    AIGenerateSkyboxRequest,
    AIGenerateSkyboxResult,

    AIGenerateImageAPISuccess,
    AIGeneratedImageAPI,

    SessionSelector,
} from '../../../src/aux-runtime/runtime/AuxLibrary';
export { 
    TransactionAction,
    PasteStateOptions,
    PasteStateAction,
    ReplaceDragBotAction,
    ShellAction,
    ShowToastAction,
    ShowTooltipAction,
    HideTooltipAction,
    ShowHtmlAction,
    HideHtmlAction,
    UpdateHtmlAppAction,
    HtmlAppEventAction,
    HtmlAppMethodCallAction,
    SerializableMutationRecord,

    FocusOnBotAction,
    FocusOnPositionAction,
    CancelAnimationAction,

    EaseType,
    EaseMode,
    Easing,
    
    Geolocation,
    SuccessfulGeolocation,
    UnsuccessfulGeolocation,
    ConvertGeolocationToWhat3WordsOptions,
    DefineGlobalBotAction,
    ConvertGeolocationToWhat3WordsAction,
    SnapAxis,
    SnapPoint,
    SnapTarget,
    ShowChatOptions,
    ShareOptions,
    FocusOnOptions,
    FocusOnRotation,
    AddDropSnapAction,
    AddDropSnapTargetsAction,
    SnapGrid,
    EnableCustomDraggingAction,

    CameraType,
    BarcodeFormat,
    ImageClassifierOptions,
    ShowInputOptions,
    ShowInputType,
    ShowInputSubtype,
    ShowConfirmOptions,
    ShowConfirmAction,
    OpenQRCodeScannerAction,
    OpenBarcodeScannerAction,
    OpenPhotoCameraAction,

    OpenConsoleAction,
    ShowQRCodeAction,
    ShowBarcodeAction,
    OpenImageClassifierAction,
    LoadServerAction,
    UnloadServerAction,
    ImportAUXAction,
    SuperShoutAction,
    SendWebhookAction,
    AnimateTagAction,
    GetRemotesAction,
    ListInstUpdatesAction,
    GetInstStateFromUpdatesAction,
    CreateInitializationUpdateAction,
    ApplyUpdatesToInstAction,
    GetCurrentInstUpdateAction,
    GoToDimensionAction,
    ShowInputForTagAction,
    OpenURLAction,
    PlaySoundAction,
    BufferSoundAction,
    CancelSoundAction,
    DownloadAction,
    RejectAction,
    SetClipboardAction,
    ShowChatBarAction,
    RunScriptAction,
    ShowUploadAuxFileAction,
    ShowUploadFilesAction,
    LoadSpaceAction,

    MediaPermssionOptions,
    EnableXROptions,
    StartFormAnimationOptions,
    StopFormAnimationAction,
    StopFormAnimationOptions,
    StartFormAnimationAction,
    FormAnimationData,
    ListFormAnimationsAction,

    
    RegisterPrefixOptions,

    Recording,
    RecordedFile,
    RecordingOptions,
    SyntheticVoice,
    OpenPhotoCameraOptions,
    Photo,
    
    EnableCollaborationAction,
    LoadBotsAction,
    LocalFormAnimationAction,
    LocalTweenAction,
    LocalPositionTweenAction,
    EnableARAction,
    ARSupportedAction,
    VRSupportedAction,
    EnableVRAction,
    EnablePOVAction,
    ShowJoinCodeAction,
    RequestFullscreenAction,
    ExitFullscreenAction,
    ShareAction,
    RegisterBuiltinPortalAction,

    CustomAppOutputType,
    CustomPortalOutputMode,
    CustomAppContainerAvailableAction,

    RegisterCustomAppAction,
    UnregisterCustomAppAction,
    RegisterHtmlAppAction,
    UnregisterHtmlAppAction,

    SetAppOutputAction,

    OpenCircleWipeAction,
    OpenCircleWipeOptions,

    BeginRecordingAction,
    EndRecordingAction,

    MeetCommandAction,
    MeetFunctionAction,
    SpeakTextAction,
    GetVoicesAction,
    GetGeolocationAction,
    GoToTagAction,

    RequestAuthDataAction,
    AuthData,

    MediaPermissionAction,
    GetAverageFrameRateAction,
    RaycastFromCameraAction,
    RaycastInPortalAction,
    CalculateRayFromCameraAction,

    ConfigureWakeLockAction,
    GetWakeLockConfigurationAction,
    WakeLockConfiguration,
    AnalyticsRecordEventAction,

    BufferFormAddressGLTFAction,
} from '../../../src/aux-common/bots/BotEvents';
export {
    RecordActionOptions,
    JoinRoomActionOptions,
    RoomJoinOptions,
    RoomOptions,
    RoomTrackOptions,
    RoomRemoteOptions,
    SetRoomTrackOptions,
    AIChatOptions,
    AIGenerateSkyboxOptions,
    AIGenerateSkyboxBlockadeLabsOptions,

    AIGenerateImageOptions,
} from '../../../src/aux-runtime/runtime/RecordsEvents';
export { 
    RuntimeBot,
    Bot,
    BotTags,
    BotSpace,
    ScriptTags,
    CompiledBotListeners,
    BotTagMasks,
    RuntimeBotVars,
    RuntimeBotLinks,
    CompiledBotListener,
    BotsState,
    PartialBotsState,
    ParsedBotLink,
    PortalType,
} from '../../../src/aux-common/bots/Bot';
export { 
    AuxVersion
} from '../../../src/aux-runtime/runtime/AuxVersion';
export { 
    AuxDevice
} from '../../../src/aux-runtime/runtime/AuxDevice';
export { InstUpdate } from '../../../src/aux-common/bots/StoredAux';
export {
    GenericError,
    CasualOSError
} from '../../../src/aux-runtime/runtime/CasualOSError';

export {
    AIChatMessage,
} from '../../../src/aux-records/AIChatInterface';
export {
    AvailablePermissions,
    CreateDataPermission,
    ReadDataPermission,
    UpdateDataPermission,
    ListDataPermission,
    DeleteDataPermission,

    CreateFilePermission,
    ReadFilePermission,
    UpdateFilePermission,
    DeleteFilePermission,
    ListFilePermission,

    IncrementEventPermission,
    CountEventPermission,
    UpdateEventPermission,
    ListEventPermission,

    GrantRolePermission,
    RevokeRolePermission,
    ReadRolePermission,
    UpdateRolePermission,
    ListRolesPermission,

    GrantPermissionToPolicyPermission,
    RevokePermissionFromPolicyPermission,
    AssignPolicyPermission,
    UnassignPolicyPermission,
    ReadPolicyPermission,
    ListPoliciesPermission,
} from '../../../src/aux-common';
export {
    CreatePublicRecordKeyResult,
    CreatePublicRecordKeySuccess,
    CreatePublicRecordKeyFailure,

    RecordDataResult,
    RecordDataSuccess,
    RecordDataFailure,

    GetDataResult,
    GetDataSuccess,
    GetDataFailure,

    EraseDataResult,
    EraseDataSuccess,
    EraseDataFailure,

    ListDataResult,
    ListDataSuccess,
    ListDataFailure,

    // RecordFileRequest,
    // RecordFileResult,
    // RecordFileSuccess,
    // RecordFileFailure,

    EraseFileResult,
    EraseFileSuccess,
    EraseFileFailure,

    AddCountResult,
    AddCountSuccess,
    AddCountFailure,

    GetCountResult,
    GetCountSuccess,
    GetCountFailure,

    UpdateEventRecordResult,
    UpdateEventRecordSuccess,
    UpdateEventRecordFailure,

    GrantRoleResult,
    GrantRoleSuccess,
    GrantRoleFailure,

    RevokeRoleResult,
    RevokeRoleSuccess,
    RevokeRoleFailure,

    GrantMarkerPermissionResult,
    GrantMarkerPermissionSuccess,
    GrantMarkerPermissionFailure,

    RevokeMarkerPermissionResult,
    RevokeMarkerPermissionSuccess,
    RevokeMarkerPermissionFailure,

    ListStudiosResult,
    ListStudiosSuccess,
    ListStudiosFailure,

    ListedStudio,

} from '../../../src/aux-records';
export {
    RemoteAction
} from '../../../src/aux-common/common/RemoteActions';

export {
    isEncrypted,
    isAsymmetricKeypair,
    isAsymmetricEncrypted,
} from '../../../src/crypto/Encryption';