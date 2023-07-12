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
} from '../../../src/aux-common/runtime/AuxLibrary';
export { 
    EaseType,
    EaseMode,
    Easing,
    RecordActionOptions,
    Geolocation,
    SuccessfulGeolocation,
    UnsuccessfulGeolocation,
    ConvertGeolocationToWhat3WordsOptions,
    SnapAxis,
    SnapPoint,
    SnapTarget,
    ShowChatOptions,
} from '../../../src/aux-common/bots/BotEvents';
export { RuntimeBot, Bot, BotTags, BotSpace, ScriptTags, CompiledBotListeners, BotTagMasks, RuntimeBotVars, RuntimeBotLinks, CompiledBotListener, BotsState, PartialBotsState, ParsedBotLink } from '../../../src/aux-common/bots/Bot';

export {
    CreatePublicRecordKeyResult,
    CreatePublicRecordKeySuccess,
    CreatePublicRecordKeyFailure,

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

    IncrementEventPermission,
    CountEventPermission,
    UpdateEventPermission,

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

} from '../../../src/aux-records';