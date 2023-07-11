// This file imports all the files that should be included in the API Documentation generation.
export * from '../../../src/aux-common/math/index';
export { DefaultLibrary, createDefaultLibrary, WebhookOptions, WebhookResult, AnimateTagFunctionOptions, Mod, TagFilter, BotFilter, BotFilterFunction } from '../../../src/aux-common/runtime/AuxLibrary';
export { EaseType, EaseMode, Easing, RecordActionOptions } from '../../../src/aux-common/bots/BotEvents';
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

} from '../../../src/aux-records';