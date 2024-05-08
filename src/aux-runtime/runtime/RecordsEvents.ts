import type {
    AIChatMessage,
    PublicRecordKeyPolicy,
    RecordFileFailure,
} from '@casual-simulation/aux-records';
import {
    APPROVED_SYMBOL,
    AsyncAction,
    AvailablePermissions,
} from '@casual-simulation/aux-common';

export type RecordsActions = RecordsAsyncActions;

export type RecordsAsyncActions =
    | RecordDataAction
    | GetRecordDataAction
    | ListRecordDataAction
    | ListRecordDataByMarkerAction
    | EraseRecordDataAction
    | RecordFileAction
    | GetFileAction
    | EraseFileAction
    | RecordEventAction
    | GetEventCountAction
    | AIChatAction
    | AIGenerateImageAction
    | AIGenerateSkyboxAction
    | ListUserStudiosAction
    | GetPublicRecordKeyAction
    | GrantRecordPermissionAction
    | RevokeRecordPermissionAction
    | GrantInstAdminPermissionAction
    | GrantRoleAction
    | RevokeRoleAction
    | JoinRoomAction
    | LeaveRoomAction
    | SetRoomOptionsAction
    | GetRoomOptionsAction
    | GetRoomTrackOptionsAction
    | SetRoomTrackOptionsAction
    | GetRoomRemoteOptionsAction;

/**
 * An event that is used to chat with an AI.
 */
export interface AIChatAction extends AsyncAction {
    type: 'ai_chat';

    /**
     * The options for the action.
     */
    options: AIChatOptions;

    /**
     * The list of messages comprising the conversation so far.
     */
    messages: AIChatMessage[];
}

/**
 * Defines an interface that represents options for {@link ai.chat-string}.
 *
 * @dochash types/ai
 * @doctitle AI Types
 * @docsidebar AI
 * @docdescription Types that are used in AI actions.
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
    preferredModel?: string;

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
}

/**
 * An event that is used to generate a skybox using AI.
 *
 * @dochash types/ai
 * @docname AIGenerateSkyboxAction
 */
export interface AIGenerateSkyboxAction extends AsyncAction {
    type: 'ai_generate_skybox';

    /**
     * The prompt to use for the skybox.
     *
     * Describes things that you want the skybox to look like.
     */
    prompt: string;

    /**
     * The negative prompt to use for the skybox.
     *
     * Describes the things that you don't want the skybox to look like.
     */
    negativePrompt?: string;

    /**
     * The options that should be included in the request.
     */
    options: AIGenerateSkyboxOptions;
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
 * @docname AIGenerateSkyboxBlockadeLabsOptions
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
 * An event that is used to generate an image using AI.
 */
export interface AIGenerateImageAction
    extends AsyncAction,
        AIGenerateImageOptions {
    type: 'ai_generate_image';

    /**
     * The options for the action.
     */
    options: RecordActionOptions;
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
 * Defines an interface that represents the base for options for a records action.
 *
 * @dochash types/records/extra
 * @doctitle Extra Record Types
 * @docsidebar Extra
 * @docdescription Extra types that are used for records.
 * @docname RecordActionOptions
 */
export interface RecordActionOptions {
    /**
     * The HTTP endpoint that the request should interface with.
     */
    endpoint?: string;
}

/**
 * Defines an interface that represents the base for actions that deal with records.
 */
export interface RecordsAction extends AsyncAction {
    /**
     * The options that the action should use.
     */
    options: RecordActionOptions;
}

/**
 * Defines a type that represents a policy that indicates which users are allowed to affect a record.
 *
 * - `true` indicates that any user can edit the record.
 * - An array of strings indicates the list of users that are allowed to edit the record.
 *
 * @dochash types/records/extra
 * @docname RecordUserPolicyType
 */
export type RecordUserPolicyType = true | string[];

/**
 * The options for data record actions.
 *
 * @dochash types/records/data
 * @docName DataRecordOptions
 */
export interface DataRecordOptions extends RecordActionOptions {
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
 * Defines an interface that represents the base for actions that deal with data records.
 */
export interface DataRecordAction extends RecordsAction {
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

    options: DataRecordOptions;
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

export interface ListRecordDataAction extends DataRecordAction {
    type: 'list_record_data';

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The address that the list should start with.
     */
    startingAddress?: string;

    /**
     * The options for the action.
     */
    options: ListDataOptions;
}

export interface ListRecordDataByMarkerAction
    extends Omit<ListRecordDataAction, 'type'> {
    type: 'list_record_data_by_marker';

    /**
     * The marker that should be used to filter the list.
     */
    marker: string;
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

export interface RecordFileActionOptions extends RecordActionOptions {
    /**
     * The markers that should be applied to the record.
     */
    markers?: string[];
}

/**
 * Defines an event that publishes a file to a record.
 */
export interface RecordFileAction extends RecordsAction {
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

    /**
     * The options for the action.
     */
    options: RecordFileActionOptions;
}

/**
 * Defines an event that requests a file from a record.
 */
export interface GetFileAction extends RecordsAction {
    type: 'get_file';

    /**
     * The URL that the file is stored at.
     */
    fileUrl: string;
}

/**
 * Defines an event that erases a file from a record.
 */
export interface EraseFileAction extends RecordsAction {
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

/**
 * Defines an action that records that an event happened.
 */
export interface RecordEventAction extends RecordsAction {
    type: 'record_event';

    /**
     * The key that should be used to access the record.
     */
    recordKey: string;

    /**
     * The name of the event.
     */
    eventName: string;

    /**
     * The number of events to record.
     */
    count: number;
}

/**
 * Defines an action that retrieves the number of times an event has happened.
 */
export interface GetEventCountAction extends RecordsAction {
    type: 'get_event_count';

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The name of the event.
     */
    eventName: string;
}

/**
 * Defines an action that retrieves the list of studios that the user has access to.
 */
export interface ListUserStudiosAction extends RecordsAction {
    type: 'list_user_studios';
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

    /**
     * The policy that the record key should have.
     */
    policy?: PublicRecordKeyPolicy;
}

/**
 * Defines an interface that represents an action that grants a permission to a record marker.
 */
export interface GrantRecordPermissionAction extends RecordsAction {
    type: 'grant_record_permission';

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The permission that should be granted.
     */
    permission: AvailablePermissions;
}

/**
 * Defines an interface that represents an action that revokes a permission from a record marker.
 */
export interface RevokeRecordPermissionAction extends RecordsAction {
    type: 'revoke_record_permission';

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The ID of the permission that should be revoked.
     */
    permissionId: string;
}

/**
 * Defines an action that represents an action that grants admin permissions to the inst for the day.
 */
export interface GrantInstAdminPermissionAction extends RecordsAction {
    type: 'grant_inst_admin_permission';

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * Whether this action has been manually approved.
     *
     * Uses a symbol to ensure that it cannot be copied across security boundaries.
     * As a result, it should be impossible to generate actions that are pre-approved.
     */
    [APPROVED_SYMBOL]?: boolean;
}

/**
 * Defines an action that grants a role to a user or inst.
 */
export interface GrantRoleAction extends RecordsAction {
    type: 'grant_role';

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The role that should be granted.
     */
    role: string;

    /**
     * The ID of the user that should be granted the role.
     */
    userId?: string;

    /**
     * The ID of the inst that should be granted the role.
     */
    inst?: string;

    /**
     * The Unix time (in miliseconds) that the role grant expires.
     */
    expireTimeMs: number | null;
}

/**
 * Defines an action that revokes a role from a user or inst.
 */
export interface RevokeRoleAction extends RecordsAction {
    type: 'revoke_role';

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The role that should be revoked.
     */
    role: string;

    /**
     * The ID of the user that should be revoked the role.
     */
    userId?: string;

    /**
     * The ID of the inst that should be revoked the role.
     */
    inst?: string;
}

/**
 * @docid JoinRoomActionOptions
 * @docrename RoomJoinOptions
 */
export type JoinRoomActionOptions = RecordActionOptions &
    Partial<RoomJoinOptions>;

/**
 * Defines an event that attempts to join a meeting room.
 */
export interface JoinRoomAction extends RecordsAction {
    type: 'join_room';

    /**
     * The name of the room that should be joined.
     */
    roomName: string;

    /**
     * The options that should be used to join the room.
     */
    options: JoinRoomActionOptions;
}

/**
 * Defines an event that attempts to leave a meeting room.
 */
export interface LeaveRoomAction extends RecordsAction {
    type: 'leave_room';

    /**
     * The name of the room that should be exited.
     */
    roomName: string;
}

/**
 * Defines an event that attempts to set some options on a meeting room.
 */
export interface SetRoomOptionsAction extends AsyncAction {
    type: 'set_room_options';

    /**
     * The name of the room whose options should be changed.
     */
    roomName: string;

    /**
     * The options that should be set.
     */
    options: Partial<RoomOptions>;
}

/**
 * Defines a set of options that the local user can have for a room.
 *
 * @dochash types/os/portals
 * @docname RoomOptions
 */
export interface RoomOptions {
    /**
     * Whether to stream video.
     */
    video: boolean;

    /**
     * Whether to stream audio.
     */
    audio: boolean;

    /**
     * Whether to stream the screen.
     */
    screen: boolean;
}

/**
 * Defines a set of options that the local usr can specify when joining a room.
 *
 * @dochash types/os/portals
 * @docname RoomJoinOptions
 */
export interface RoomJoinOptions extends RoomOptions {
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

/**
 * Defines an event that retrieves the set of options that the local user has for a room.
 */
export interface GetRoomOptionsAction extends AsyncAction {
    type: 'get_room_options';

    /**
     * The name of the room.
     */
    roomName: string;
}

/**
 * Defines an event that retrieves the set of options that the local user has for a track.
 */
export interface GetRoomTrackOptionsAction extends AsyncAction {
    type: 'get_room_track_options';

    /**
     * The name of the room.
     */
    roomName: string;

    /**
     * The address of the track.
     */
    address: string;
}

export interface SetRoomTrackOptionsAction extends AsyncAction {
    type: 'set_room_track_options';

    /**
     * The name of the room.
     */
    roomName: string;

    /**
     * The address of the track.
     */
    address: string;

    /**
     * The options that should be set for the track.
     */
    options: SetRoomTrackOptions;
}

/**
 * Defines an interface that represents the set of options that can be set on a room video/audio track.
 *
 * @dochash types/os/portals
 * @docname SetRoomTrackOptions
 */
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

/**
 * Defines an interface that represents the options that a audio/video track has.
 *
 * @dochash types/os/rooms
 * @doctitle Rooms Types
 * @docsidebar Rooms
 * @docdescription Types that are used for rooms actions.
 * @docname RoomTrackOptions
 */
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
    dimensions?: { width: number; height: number };

    /**
     * The aspect ratio of the video if the track represents a video.
     */
    aspectRatio?: number;
}

/**
 * The possible kinds for a room track.
 *
 * @dochash types/records/rooms
 * @docname TrackKind
 */
export type TrackKind = 'video' | 'audio';

/**
 * The possible sources for a room track.
 *
 * @dochash types/records/rooms
 * @docname TrackSource
 */
export type TrackSource =
    | 'camera'
    | 'microphone'
    | 'screen_share'
    | 'screen_share_audio';

/**
 * Defines the possible qualities that a track can stream at.
 *
 * @dochash types/os/rooms
 * @docname TrackVideoQuality
 */
export type TrackVideoQuality = 'high' | 'medium' | 'low' | 'off';

/**
 * Defines an event that retrieves the options for a remote multimedia chat room user.
 */
export interface GetRoomRemoteOptionsAction extends AsyncAction {
    type: 'get_room_remote_options';

    /**
     * The name of the room.
     */
    roomName: string;

    /**
     * The ID of the remote user.
     */
    remoteId: string;
}

/**
 * Defines an interface that contains options for a remote room user.
 *
 * @dochash types/os/portals
 * @docname RoomRemoteOptions
 */
export interface RoomRemoteOptions {
    /**
     * Gets the connection quality of the remote user.
     */
    connectionQuality: 'excellent' | 'good' | 'poor' | 'lost' | 'unknown';

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
 * Creates a new AIChatAction.
 *
 * @param messages The messages to include in the chat.
 * @param options The options for the chat.
 * @param taskId The ID of the async task.
 */
export function aiChat(
    messages: AIChatMessage[],
    options?: AIChatOptions,
    taskId?: number | string
): AIChatAction {
    return {
        type: 'ai_chat',
        messages,
        options: options ?? {},
        taskId,
    };
}

/**
 * Creates a new AIGenerateSkyboxAction.
 * @param prompt The prompt that describes what the generated skybox should look like.
 * @param negativePrompt The negative prompt that describes what the generated skybox should not look like.
 * @param options The options for the skybox.
 * @param taskId The ID of the async task.
 */
export function aiGenerateSkybox(
    prompt: string,
    negativePrompt: string | null | undefined,
    options?: AIGenerateSkyboxOptions,
    taskId?: number | string
): AIGenerateSkyboxAction {
    return {
        type: 'ai_generate_skybox',
        prompt,
        negativePrompt,
        options: options ?? {},
        taskId,
    };
}

/**
 * Creates a new AIGenerateImageAction.
 * @param options The options.
 * @param taskId The ID of the async task.
 */
export function aiGenerateImage(
    parameters: AIGenerateImageOptions,
    options?: RecordActionOptions,
    taskId?: number | string
): AIGenerateImageAction {
    return {
        type: 'ai_generate_image',
        ...parameters,
        options: options ?? {},
        taskId,
    };
}

/**
 * Creates a GetPublicRecordKeyAction.
 * @param recordName The name of the record.
 * @param policy The policy that the requested record key should have.
 * @param taskId The ID of the task.
 */
export function getPublicRecordKey(
    recordName: string,
    policy: PublicRecordKeyPolicy,
    taskId: number | string
): GetPublicRecordKeyAction {
    return {
        type: 'get_public_record_key',
        recordName,
        policy,
        taskId,
    };
}

/**
 * Creates a GrantRecordPermissionAction.
 * @param recordName The name of the record.
 * @param permission The permission that should be granted.
 * @param options The options for the action.
 * @param taskId The ID of the task.
 */
export function grantRecordPermission(
    recordName: string,
    permission: AvailablePermissions,
    options: RecordActionOptions,
    taskId: number | string
): GrantRecordPermissionAction {
    return {
        type: 'grant_record_permission',
        recordName,
        permission,
        options,
        taskId,
    };
}

/**
 * Creates a RevokeRecordPermissionAction.
 * @param recordName The name of the record.
 * @param marker The marker.
 * @param permissionId The ID of the permission that should be revoked.
 * @param options The options for the action.
 * @param taskId The ID of the task.
 */
export function revokeRecordPermission(
    recordName: string,
    permissionId: string,
    options: RecordActionOptions,
    taskId: number | string
): RevokeRecordPermissionAction {
    return {
        type: 'revoke_record_permission',
        recordName,
        permissionId,
        options,
        taskId,
    };
}

/**
 * Creates a GrantRoleAction for a user.
 * @param recordName The name of the record.
 * @param role The role that should be granted.
 * @param userId The ID of the user.
 * @param expireTimeMs The Unix time (in miliseconds) that the role grant expires.
 * @param options The options for the action.
 * @param taskId The ID of the task.
 */
export function grantUserRole(
    recordName: string,
    role: string,
    userId: string,
    expireTimeMs: number | null,
    options: RecordActionOptions,
    taskId: number | string
): GrantRoleAction {
    return {
        type: 'grant_role',
        recordName,
        role,
        userId,
        expireTimeMs,
        options,
        taskId,
    };
}

/**
 * Creates a GrantRoleAction for an inst.
 * @param recordName The name of the record.
 * @param role The role that should be granted.
 * @param inst The ID of the inst.
 * @param expireTimeMs The Unix time (in miliseconds) that the role grant expires.
 * @param options The options for the action.
 * @param taskId The ID of the task.
 */
export function grantInstRole(
    recordName: string,
    role: string,
    inst: string,
    expireTimeMs: number | null,
    options: RecordActionOptions,
    taskId: number | string
): GrantRoleAction {
    return {
        type: 'grant_role',
        recordName,
        role,
        inst,
        expireTimeMs,
        options,
        taskId,
    };
}

/**
 * Creates a GrantRoleAction for a user.
 * @param recordName The name of the record.
 * @param role The role that should be granted.
 * @param userId The ID of the user.
 * @param options The options for the action.
 * @param taskId The ID of the task.
 */
export function revokeUserRole(
    recordName: string,
    role: string,
    userId: string,
    options: RecordActionOptions,
    taskId: number | string
): RevokeRoleAction {
    return {
        type: 'revoke_role',
        recordName,
        role,
        userId,
        options,
        taskId,
    };
}

/**
 * Creates a revokeRoleAction for an inst.
 * @param recordName The name of the record.
 * @param role The role that should be revokeed.
 * @param inst The ID of the inst.
 * @param options The options for the action.
 * @param taskId The ID of the task.
 */
export function revokeInstRole(
    recordName: string,
    role: string,
    inst: string,
    options: RecordActionOptions,
    taskId: number | string
): RevokeRoleAction {
    return {
        type: 'revoke_role',
        recordName,
        role,
        inst,
        options,
        taskId,
    };
}

/**
 * Creates a GrantInstAdminPermissionAction.
 * @param recordName The name of the record.
 * @param options The options for the action.
 * @param taskId The ID of the task.
 */
export function grantInstAdminPermission(
    recordName: string,
    options: RecordActionOptions,
    taskId: number | string
): GrantInstAdminPermissionAction {
    return {
        type: 'grant_inst_admin_permission',
        recordName,
        options,
        taskId,
    };
}

/**
 * Creates a RecordDataAction.
 * @param recordKey The key that should be used to access the record.
 * @param address The address that the data should be stored at in the record.
 * @param data The data to store.
 * @param requiresApproval Whether to try to record data that requires approval.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function recordData(
    recordKey: string,
    address: string,
    data: any,
    requiresApproval: boolean,
    options: DataRecordOptions,
    taskId: number | string
): RecordDataAction {
    return {
        type: 'record_data',
        recordKey,
        address,
        data,
        requiresApproval,
        options,
        taskId,
    };
}

/**
 * Creates a GetRecordDataAction.
 * @param recordName The name of the record to retrieve.
 * @param address The address of the data to retrieve.
 * @param requiresApproval Whether to try to get a record that requires manual approval.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function getRecordData(
    recordName: string,
    address: string,
    requiresApproval: boolean,
    options: RecordActionOptions,
    taskId?: number | string
): GetRecordDataAction {
    return {
        type: 'get_record_data',
        recordName,
        address,
        requiresApproval,
        options,
        taskId,
    };
}

/**
 * Creates a ListRecordDataAction.
 * @param recordName The name of the record.
 * @param startingAddress The address that the list should start with.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function listDataRecord(
    recordName: string,
    startingAddress: string,
    options: ListDataOptions,
    taskId?: number | string
): ListRecordDataAction {
    return {
        type: 'list_record_data',
        recordName,
        startingAddress,
        requiresApproval: false,
        options,
        taskId,
    };
}

/**
 * Creates a ListRecordDataAction.
 * @param recordName The name of the record.
 * @param marker The marker.
 * @param startingAddress The address that the list should start with.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function listDataRecordByMarker(
    recordName: string,
    marker: string,
    startingAddress: string,
    options: ListDataOptions,
    taskId?: number | string
): ListRecordDataByMarkerAction {
    return {
        type: 'list_record_data_by_marker',
        recordName,
        marker,
        startingAddress,
        requiresApproval: false,
        options,
        taskId,
    };
}

/**
 * Creates a EraseRecordDataAction.
 * @param recordKey The key that should be used to access the record.
 * @param address The address of the data to erase.
 * @param requiresApproval Whether to try to erase a record that requires manual approval.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function eraseRecordData(
    recordKey: string,
    address: string,
    requiresApproval: boolean,
    options: RecordActionOptions,
    taskId?: number | string
): EraseRecordDataAction {
    return {
        type: 'erase_record_data',
        recordKey,
        address,
        requiresApproval,
        options,
        taskId,
    };
}

/**
 * Creates a RecordFileAction.
 * @param recordKey The key that should be used to access the record.
 * @param data The data to store.
 * @param description The description of the file.
 * @param mimeType The MIME type of the file.
 * @param markers The markers to associate with the file.
 * @param options The options that should be used for the action.
 */
export function recordFile(
    recordKey: string,
    data: any,
    description: string,
    mimeType: string,
    options: RecordFileActionOptions,
    taskId?: number | string
): RecordFileAction {
    return {
        type: 'record_file',
        recordKey,
        data,
        description,
        mimeType,
        options,
        taskId,
    };
}

/**
 * Creates a GetFileAction.
 * @param recordKey The key that should be used to access the record.
 * @param fileUrl The URL that the file was stored at.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function getFile(
    fileUrl: string,
    options: RecordActionOptions,
    taskId?: number | string
): GetFileAction {
    return {
        type: 'get_file',
        fileUrl,
        options,
        taskId,
    };
}

/**
 * Creates a EraseFileAction.
 * @param recordKey The key that should be used to access the record.
 * @param fileUrl The URL that the file was stored at.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function eraseFile(
    recordKey: string,
    fileUrl: string,
    options: RecordActionOptions,
    taskId?: number | string
): EraseFileAction {
    return {
        type: 'erase_file',
        recordKey,
        fileUrl,
        options,
        taskId,
    };
}

/**
 * Creates a RecordEventAction.
 * @param recordKey The key that should be used to access the record.
 * @param eventName The name of the event.
 * @param count The number of times that the event occurred.
 * @param options The options that should be used for the action.
 * @param taskId The Id of the task.
 */
export function recordEvent(
    recordKey: string,
    eventName: string,
    count: number,
    options: RecordActionOptions,
    taskId?: number | string
): RecordEventAction {
    return {
        type: 'record_event',
        recordKey,
        eventName,
        count,
        options,
        taskId,
    };
}

/**
 * Creates a GetEventCountAction.
 * @param recordName The name of the record.
 * @param eventName The name of the events.
 * @param options The options that should be used for the action.
 * @param taskId The ID.
 */
export function getEventCount(
    recordName: string,
    eventName: string,
    options: RecordActionOptions,
    taskId?: number | string
): GetEventCountAction {
    return {
        type: 'get_event_count',
        recordName,
        eventName,
        options,
        taskId,
    };
}

/**
 * Creates a ListUserStudiosAction.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function listUserStudios(
    options: RecordActionOptions,
    taskId?: number | string
): ListUserStudiosAction {
    return {
        type: 'list_user_studios',
        options,
        taskId,
    };
}

/**
 * Creates a new JoinRoomAction.
 * @param roomName The name of the room.
 * @param options The options to use for the event.
 * @param taskId The ID of the async task.
 */
export function joinRoom(
    roomName: string,
    options: JoinRoomActionOptions,
    taskId?: number | string
): JoinRoomAction {
    return {
        type: 'join_room',
        roomName,
        options,
        taskId,
    };
}

/**
 * Creates a new LeaveRoomAction.
 * @param roomName The name of the room.
 * @param options The options to use for the event.
 * @param taskId The ID of the async task.
 */
export function leaveRoom(
    roomName: string,
    options: RecordActionOptions,
    taskId?: number | string
): LeaveRoomAction {
    return {
        type: 'leave_room',
        roomName,
        options,
        taskId,
    };
}

/**
 * Creates a new SetRoomOptionsAction.
 * @param roomName The name of the room.
 * @param options The options to use for the event.
 * @param taskId The ID of the async task.
 */
export function setRoomOptions(
    roomName: string,
    options: Partial<RoomOptions>,
    taskId?: number | string
): SetRoomOptionsAction {
    return {
        type: 'set_room_options',
        roomName,
        options,
        taskId,
    };
}

/**
 * Creates a new GetRoomOptionsAction.
 * @param roomName The name of the room.
 * @param taskId The ID of the async task.
 */
export function getRoomOptions(
    roomName: string,
    taskId?: number | string
): GetRoomOptionsAction {
    return {
        type: 'get_room_options',
        roomName,
        taskId,
    };
}

/**
 * Creates a new GetRoomTrackOptionsAction.
 * @param roomName The name of the room.
 * @param address The address of the track.
 * @param taskId The ID of the task.
 */
export function getRoomTrackOptions(
    roomName: string,
    address: string,
    taskId?: number | string
): GetRoomTrackOptionsAction {
    return {
        type: 'get_room_track_options',
        roomName,
        address,
        taskId,
    };
}

/**
 * Creates a new SetRoomTrackOptionsAction.
 * @param roomName The name of the room.
 * @param address The address of the track.
 * @param options The options that should be set.
 * @param taskId The ID of the task.
 */
export function setRoomTrackOptions(
    roomName: string,
    address: string,
    options: SetRoomTrackOptions,
    taskId?: number | string
): SetRoomTrackOptionsAction {
    return {
        type: 'set_room_track_options',
        roomName,
        address,
        options,
        taskId,
    };
}

/**
 * Creates a new GetRoomRemoteOptionsAction.
 * @param roomName The name of the room.
 * @param remoteId The ID of the remote user.
 * @param taskId The ID of the task.
 */
export function getRoomRemoteOptions(
    roomName: string,
    remoteId: string,
    taskId?: number | string
): GetRoomRemoteOptionsAction {
    return {
        type: 'get_room_remote_options',
        roomName,
        remoteId,
        taskId,
    };
}
