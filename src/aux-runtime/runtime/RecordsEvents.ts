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
    AIChatMessage,
    RecordFileFailure,
    WebhookRecord,
    NotificationRecord,
    PushNotificationPayload,
    GrantEntitlementFailure,
} from '@casual-simulation/aux-records';
import type {
    RecordsClientActions,
    RecordsClientInputs,
} from '@casual-simulation/aux-records/RecordsClient';
import type {
    APPROVED_SYMBOL,
    AsyncAction,
    AvailablePermissions,
    Entitlement,
    EntitlementFeature,
    GrantedEntitlementScope,
    KnownErrorCodes,
    PublicRecordKeyPolicy,
    StoredAux,
} from '@casual-simulation/aux-common';

import type { CreateRealtimeSessionTokenRequest } from '@casual-simulation/aux-records/AIOpenAIRealtimeInterface';
import type {
    PackageRecordVersionKey,
    PackageRecordVersionKeySpecifier,
    PackageRecordVersionWithMetadata,
} from '@casual-simulation/aux-records/packages/version';

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
    | AIChatStreamAction
    | AIGenerateImageAction
    | AIGenerateSkyboxAction
    | AIHumeGetAccessTokenAction
    | AISloydGenerateModelAction
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
    | GetRoomRemoteOptionsAction
    | RecordsCallProcedureAction
    | SubscribeToNotificationAction
    | GrantEntitlementsAction
    | RevokeEntitlementGrantAction
    | RecordPackageVersionAction
    | InstallPackageAction
    | ListInstalledPackagesAction;

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
 * An event that is used to chat with an AI.
 */
export interface AIChatStreamAction extends AsyncAction {
    type: 'ai_chat_stream';

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

    /**
     * The maximum number of tokens to generate in the chat completion.
     */
    max_completion_tokens?: number;

    /**
     * Controls the level of detail in the AI's output.
     */
    verbosity?: 'low' | 'medium' | 'high';

    /**
     * Controls the depth of reasoning the AI uses.
     */
    reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high';

    /**
     * Encourages the AI to plan its response before generating output (supported in reasoning models).
     */
    preamble?: string;

    /**
     * Specifies multiple tool options for the AI to choose from.
     */
    tool_choice?: string[];

    /**
     * Custom tool type for text-based (non-JSON) tool payloads.
     */
    custom_tool_type?: 'custom';

    /**
     * Context-Free Grammar specification for constraining outputs.
     */
    cfg?: string;
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
 * An event that is used to generate an image using AI.
 */
export interface AIHumeGetAccessTokenAction extends RecordsAction {
    type: 'ai_hume_get_access_token';

    /**
     * The name of the record that the access token should be retrieved for.
     */
    recordName?: string;
}

/**
 * An event that is used to generate a model using Sloyd AI.
 */
export interface AISloydGenerateModelAction
    extends RecordsAction,
        AISloydGenerateModelOptions {
    type: 'ai_sloyd_generate_model';
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
     * Higher values will result in more detailed models.
     * Should be between `0.01` and `1`.
     * Defaults to `0.5`.
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
    };
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

export interface WebhookRecordAction extends RecordsAction {}

/**
 * Defines an event that is able to call a procedure on the records server.
 */
export interface RecordsCallProcedureAction extends RecordsAction {
    type: 'records_call_procedure';

    /**
     * The procedure to call.
     */
    procedure: Partial<RecordsClientActions>;
}

/**
 * Defines an event that attempts to subscribe to a notification.
 */
export interface SubscribeToNotificationAction extends RecordsAction {
    type: 'subscribe_to_notification';

    /**
     * The name of the record.
     */
    recordName: string;

    /**
     * The address of the notification.
     */
    address: string;
}

// /**
//  * Defines an event that publishes data to a record.
//  */
// export interface RecordWebhookAction extends WebhookRecordAction {
//     type: 'record_webhook';

//     /**
//      * The record name the webhook should be recorded in.
//      */
//     recordName: string;

//     /**
//      * The item to record.
//      */
//     item: WebhookRecord;
// }

// /**
//  * Defines an event that requests info on a webhook.
//  */
// export interface GetWebhookAction extends WebhookRecordAction {
//     type: 'get_webhook';

//     /**
//      * The name of the record.
//      */
//     recordName: string;

//     /**
//      * The address of the webhook that should be retrieved.
//      */
//     address: string;
// }

// export interface ListWebhooksAction extends WebhookRecordAction {
//     type: 'list_webhooks';

//     /**
//      * The name of the record.
//      */
//     recordName: string;

//     /**
//      * The address that the list should start with.
//      */
//     startingAddress?: string;

//     /**
//      * The options for the action.
//      */
//     options: ListWebhooksOptions;
// }

// export interface ListWebhooksByMarkerAction
//     extends Omit<ListWebhooksAction, 'type'> {
//     type: 'list_webhooks_by_marker';

//     /**
//      * The marker that should be used to filter the list.
//      */
//     marker: string;
// }

/**
 * Defines an interface that represents the options for a list data action.
 *
 * @dochash types/records/webhooks
 * @docName ListWebhooksOptions
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

// /**
//  * Defines an event that erases a webhook from a record.
//  */
// export interface EraseWebhookAction extends WebhookRecordAction {
//     type: 'erase_webhook';

//     /**
//      * The name of the record.
//      */
//     recordName: string;

//     /**
//      * The address that the data from.
//      */
//     address: string;
// }

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

export interface InstallPackageAction extends RecordsAction {
    type: 'install_package';

    /**
     * The name of the record that the package should be loaded from.
     */
    recordName: string;

    /**
     * The address of the package that should be loaded.
     */
    address: string;

    /**
     * The key for the package version that should be loaded.
     * If null, then the latest version will be loaded.
     */
    key: string | PackageRecordVersionKeySpecifier | null;

    /**
     * The options for the request.
     */
    options: RecordActionOptions;
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

export interface ListInstalledPackagesAction extends RecordsAction {
    type: 'list_installed_packages';
}

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

/**
 * Defines an action that grants a package entitlements to access a record.
 */
export interface GrantEntitlementsAction extends RecordsAction {
    type: 'grant_record_entitlements';

    request: GrantEntitlementsRequest;
}

/**
 * Defines a request that revokes an entitlement grant from a package.
 * @dochash types/records/packages
 * @docname GrantRecordEntitlementsRequest
 */
export interface RevokeEntitlementGrantRequest {
    /**
     * The ID of the entitlement grant to revoke.
     */
    grantId: string;
}

export interface RevokeEntitlementGrantAction extends RecordsAction {
    type: 'revoke_record_entitlements';

    request: RevokeEntitlementGrantRequest;
}

export interface RecordPackageVersionRequest {
    /**
     * The record that the package version should be stored in.
     */
    recordName: string;

    /**
     * The address that the package version should be stored in.
     */
    address: string;

    /**
     * The key for the package version.
     */
    key: PackageRecordVersionKey;

    /**
     * The list of entitlements that the package version can request.
     */
    entitlements: Entitlement[];

    /**
     * The description for the package version.
     */
    description: string;

    /**
     * The state that should be saved in the package.
     */
    state: StoredAux;

    /**
     * The markers that should be set on the package version.
     */
    markers?: string[];
}

export interface RecordPackageVersionAction extends RecordsAction {
    type: 'record_package_version';

    request: RecordPackageVersionRequest;
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
 * Creates a new AIChatStreamAction.
 *
 * @param messages The messages to include in the chat.
 * @param options The options for the chat.
 * @param taskId The ID of the async task.
 */
export function aiChatStream(
    messages: AIChatMessage[],
    options?: AIChatOptions,
    taskId?: number | string
): AIChatStreamAction {
    return {
        type: 'ai_chat_stream',
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
 * Creates a new AIHumeGetAccessTokenAction.
 * @param options The options for the action.
 * @param taskId The ID of the async task.
 */
export function aiHumeGetAccessToken(
    recordName?: string,
    options?: RecordActionOptions,
    taskId?: number | string
): AIHumeGetAccessTokenAction {
    return {
        type: 'ai_hume_get_access_token',
        recordName,
        options: options ?? {},
        taskId,
    };
}

/**
 * Creates a new AISloydGenerateModelAction.
 * @param parameters The parameters for the action.
 * @param options The options for the action.
 * @param taskId The ID of the async task.
 */
export function aiSloydGenerateModel(
    parameters: AISloydGenerateModelOptions,
    options?: RecordActionOptions,
    taskId?: number | string
): AISloydGenerateModelAction {
    return {
        type: 'ai_sloyd_generate_model',
        ...parameters,
        options,
        taskId,
    };
}

/**
 * Creates a new action that is able to request that a realtime session be created.
 * @param recordName The name of the record that the realtime session is being created for.
 * @param request The request that should be used to create the realtime session.
 * @param options The options for the action.
 * @param taskId The ID of the async task.
 */
export function aiOpenAICreateRealtimeSession(
    recordName: string,
    request: CreateRealtimeSessionTokenRequest,
    options?: RecordActionOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return {
        type: 'records_call_procedure',
        procedure: {
            createOpenAIRealtimeSession: {
                input: {
                    recordName,
                    request,
                },
            },
        },
        options,
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
 * Creates a RecordsCallProcedureAction.
 * @param procedure The procedure to call.
 * @param options The options.
 * @param taskId The ID of the async task.
 */
export function recordsCallProcedure(
    procedure: Partial<RecordsClientActions>,
    options: RecordActionOptions,
    taskId: number | string
): RecordsCallProcedureAction {
    return {
        type: 'records_call_procedure',
        procedure,
        options,
        taskId,
    };
}

/**
 * Creates a RecordWebhookAction.
 * @param recordName The name of the record.
 * @param item The item to record.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function recordWebhook(
    recordName: string,
    item: WebhookRecord,
    options: RecordActionOptions,
    taskId: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            recordWebhook: {
                input: {
                    recordName,
                    item: {
                        address: item.address,
                        targetResourceKind: item.targetResourceKind,
                        targetRecordName: item.targetRecordName,
                        targetAddress: item.targetAddress,
                        markers: item.markers as any,
                    },
                },
            },
        },
        options,
        taskId
    );
}

/**
 * Creates a RunWebhookAction.
 * @param recordName The name of the record.
 * @param address The address of the webhook to run.
 * @param input The input for the webhook.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function runWebhook(
    recordName: string,
    address: string,
    input: any,
    options: RecordActionOptions,
    taskId: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            runWebhook: {
                query: {
                    recordName,
                    address,
                },
                input: input,
            },
        },
        options,
        taskId
    );
}

/**
 * Creates a GetWebhookAction.
 * @param recordName The name of the record to retrieve.
 * @param address The address of the data to retrieve.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function getWebhook(
    recordName: string,
    address: string,
    options: RecordActionOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            getWebhook: {
                input: {
                    recordName,
                    address,
                },
            },
        },
        options,
        taskId
    );
}

/**
 * Creates a ListWebhooksAction.
 * @param recordName The name of the record.
 * @param startingAddress The address that the list should start with.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function listWebhooks(
    recordName: string,
    startingAddress: string,
    options: ListWebhooksOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            listWebhooks: {
                input: {
                    recordName,
                    address: startingAddress,
                    sort: options?.sort,
                },
            },
        },
        options,
        taskId
    );
}

/**
 * Creates a ListWebhooksByMarkerAction.
 * @param recordName The name of the record.
 * @param marker The marker.
 * @param startingAddress The address that the list should start with.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function listWebhooksByMarker(
    recordName: string,
    marker: string,
    startingAddress: string,
    options: ListWebhooksOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            listWebhooks: {
                input: {
                    recordName,
                    address: startingAddress,
                    sort: options?.sort,
                    marker: marker,
                },
            },
        },
        options,
        taskId
    );
}

/**
 * Creates a EraseWebhookAction.
 * @param recordKey The name of the record.
 * @param address The address of the data to erase.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function eraseWebhook(
    recordName: string,
    address: string,
    options: RecordActionOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            eraseWebhook: {
                input: {
                    recordName,
                    address,
                },
            },
        },
        options,
        taskId
    );
}

/**
 * Creates a SubscribeToNotificationAction.
 * @param recordName The name of the record.
 * @param address The address of the notification to subscribe to.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the async task.
 */
export function subscribeToNotification(
    recordName: string,
    address: string,
    options: RecordActionOptions,
    taskId?: number | string
): SubscribeToNotificationAction {
    return {
        type: 'subscribe_to_notification',
        recordName,
        address,
        options,
        taskId,
    };
}

/**
 * Creates an action that is able to unsubscribe from a notification.
 * @param subscriptionId The ID of the subscription.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the async task.
 */
export function unsubscribeFromNotification(
    subscriptionId: string,
    options: RecordActionOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            unsubscribeFromNotification: {
                input: {
                    subscriptionId,
                },
            },
        },
        options,
        taskId
    );
}

/**
 * Creates an action that is able to record a notification.
 * @param recordName The name of the record.
 * @param item The item to record.
 * @param options The options.
 * @param taskId The ID of the async task.
 */
export function recordNotification(
    recordName: string,
    item: NotificationRecord,
    options: RecordActionOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            recordNotification: {
                input: {
                    recordName,
                    item: {
                        address: item.address,
                        description: item.description,
                        markers: item.markers as any,
                    },
                },
            },
        },
        options,
        taskId
    );
}

/**
 * Creates an action that is able to get information about a notification.
 * @param recordName The name of the record.
 * @param address The address of the notification.
 * @param options The options.
 * @param taskId The ID of the async task.
 */
export function getNotification(
    recordName: string,
    address: string,
    options: RecordActionOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            getNotification: {
                input: {
                    recordName,
                    address,
                },
            },
        },
        options,
        taskId
    );
}

/**
 * Creates an action that is able to list the notifications in a record.
 * @param recordName The name of the record.
 * @param startingAddress The address that the list should start with.
 * @param options The options.
 * @param taskId The ID of the async task.
 */
export function listNotifications(
    recordName: string,
    startingAddress: string,
    options: RecordActionOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            listNotifications: {
                input: {
                    recordName,
                    address: startingAddress,
                },
            },
        },
        options,
        taskId
    );
}

/**
 * Creates an action that is able to list the notifications in a record.
 * @param recordName The name of the record.
 * @param marker The marker.
 * @param startingAddress The address that the list should start with.
 * @param options The options.
 * @param taskId The ID of the async task.
 */
export function listNotificationsByMarker(
    recordName: string,
    marker: string,
    startingAddress: string,
    options: ListNotificationsOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            listNotifications: {
                input: {
                    recordName,
                    marker,
                    address: startingAddress,
                    sort: options?.sort,
                },
            },
        },
        options,
        taskId
    );
}

/**
 * Creates an action that is able to erase a notification.
 * @param recordName The name of the record.
 * @param address The address of the notification.
 * @param options The options.
 * @param taskId The ID of the async task.
 */
export function eraseNotification(
    recordName: string,
    address: string,
    options: RecordActionOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            eraseNotification: {
                input: {
                    recordName,
                    address,
                },
            },
        },
        options,
        taskId
    );
}

/**
 * Creates an action that can be used to send a notification.
 * @param recordName The name of the record.
 * @param address The address of the notification.
 * @param payload The payload to send.
 * @param options The options.
 * @param taskId The ID of the task.
 */
export function sendNotification(
    recordName: string,
    address: string,
    payload: PushNotificationPayload,
    options: SendNotificationOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            sendNotification: {
                input: {
                    recordName,
                    address,
                    payload,
                    topic: options?.topic,
                },
            },
        },
        options,
        taskId
    );
}

/**
 * Creates an action that can be used to list the notification subscriptions for a record.
 * @param recordName The name of the record.
 * @param address The address of the notification.
 * @param options The options.
 * @param taskId The ID of the task.
 */
export function listNotificationSubscriptions(
    recordName: string,
    address: string,
    options: RecordActionOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            listNotificationSubscriptions: {
                input: {
                    recordName,
                    address,
                },
            },
        },
        options,
        taskId
    );
}

/**
 * Creates an action that can be used to list the notification subscriptions a user.
 * @param userId The ID of the user.
 * @param options The options.
 * @param taskId The ID of the task.
 */
export function listUserNotificationSubscriptions(
    options: RecordActionOptions,
    taskId?: number | string
): RecordsCallProcedureAction {
    return recordsCallProcedure(
        {
            listUserNotificationSubscriptions: {
                input: {},
            },
        },
        options,
        taskId
    );
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
 * Creates a GrantRecordEntitlementsAction.
 * @param request The request that should be used to grant the entitlements.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function grantEntitlements(
    request: GrantEntitlementsRequest,
    options: RecordActionOptions,
    taskId?: number | string
): GrantEntitlementsAction {
    return {
        type: 'grant_record_entitlements',
        request,
        options,
        taskId,
    };
}

/**
 * Creates a RevokeEntitlementGrantAction.
 * @param request The request that should be used to revoke the entitlement.
 * @param options The options that should be used for the action.
 * @param taskId The ID of the task.
 */
export function revokeEntitlement(
    request: RevokeEntitlementGrantRequest,
    options: RecordActionOptions,
    taskId?: number | string
): RevokeEntitlementGrantAction {
    return {
        type: 'revoke_record_entitlements',
        request,
        options,
        taskId,
    };
}

export function recordPackageVersion(
    request: RecordPackageVersionRequest,
    options: RecordActionOptions,
    taskId?: number | string
): RecordPackageVersionAction {
    return {
        type: 'record_package_version',
        request,
        options,
        taskId,
    };
}

export function listPackageVersions(
    recordName: string,
    address: string,
    options: RecordActionOptions,
    taskId?: number | string
) {
    return recordsCallProcedure(
        {
            listPackageVersions: {
                input: {
                    recordName,
                    address,
                },
            },
        },
        options,
        taskId
    );
}

export function getPackageVersion(
    recordName: string,
    address: string,
    key: string | PackageRecordVersionKeySpecifier,
    options: RecordActionOptions,
    taskId?: number | string
) {
    let input: RecordsClientInputs['getPackageVersion'] = {
        recordName,
        address,
    };

    if (typeof key === 'string') {
        input.key = key;
    } else if (key) {
        input = {
            ...input,
            ...key,
        };
    }

    return recordsCallProcedure(
        {
            getPackageVersion: {
                input,
            },
        },
        options,
        taskId
    );
}

export function erasePackageVersion(
    recordName: string,
    address: string,
    key: PackageRecordVersionKey,
    options: RecordActionOptions,
    taskId?: number | string
) {
    return recordsCallProcedure(
        {
            erasePackageVersion: {
                input: {
                    recordName,
                    address,
                    key,
                },
            },
        },
        options,
        taskId
    );
}

export function recordPackageContainer(
    recordName: string,
    address: string,
    markers: string[],
    options: RecordActionOptions,
    taskId?: number | string
) {
    return recordsCallProcedure(
        {
            recordPackage: {
                input: {
                    recordName,
                    item: {
                        address,
                        markers: markers as [string, ...string[]],
                    },
                },
            },
        },
        options,
        taskId
    );
}

export function erasePackageContaienr(
    recordName: string,
    address: string,
    options: RecordActionOptions,
    taskId?: number | string
) {
    return recordsCallProcedure(
        {
            erasePackage: {
                input: {
                    recordName,
                    address,
                },
            },
        },
        options,
        taskId
    );
}

export function listPackageContainers(
    recordName: string,
    address: string,
    options: ListDataOptions,
    taskId?: number | string
) {
    return recordsCallProcedure(
        {
            listPackages: {
                input: {
                    recordName,
                    address,
                    sort: options?.sort,
                },
            },
        },
        options,
        taskId
    );
}

export function listPackageContainersByMarker(
    recordName: string,
    marker: string,
    address: string,
    options: ListDataOptions,
    taskId?: number | string
) {
    return recordsCallProcedure(
        {
            listPackages: {
                input: {
                    recordName,
                    address,
                    sort: options?.sort,
                    marker,
                },
            },
        },
        options,
        taskId
    );
}

export function getPackageContainer(
    recordName: string,
    address: string,
    options: ListDataOptions,
    taskId?: number | string
) {
    return recordsCallProcedure(
        {
            getPackage: {
                input: {
                    recordName,
                    address,
                },
            },
        },
        options,
        taskId
    );
}

export function installPackage(
    recordName: string,
    address: string,
    key: string | Partial<PackageRecordVersionKey> | null,
    options: RecordActionOptions,
    taskId?: number | string
): InstallPackageAction {
    return {
        type: 'install_package',
        recordName,
        address,
        key,
        options,
        taskId,
    };
}

export function listInstalledPackages(
    options: RecordActionOptions,
    taskId?: number | string
): ListInstalledPackagesAction {
    return {
        type: 'list_installed_packages',
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
