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
import type { Action } from './Action';
import type { ConnectionInfo } from './ConnectionInfo';
import { connectionInfoSchema } from './ConnectionInfo';
import { z } from 'zod';

/**
 * An event that is used to indicate an event that was sent from a remote device.
 */
export interface DeviceAction extends Action {
    type: 'device';

    /**
     * The connection which sent the event.
     */
    connection: ConnectionInfo;

    /**
     * The event.
     */
    event: Action;

    /**
     * The ID of the task that this action was sent with.
     */
    taskId?: number | string;
}
export const deviceActionSchema = z.object({
    type: z.literal('device'),
    connection: connectionInfoSchema(),
    event: z.any(),
    taskId: z.union([z.string(), z.number()]).optional(),
});
type ZodDeviceAction = z.infer<typeof deviceActionSchema>;
type ZodDeviceActionAssertion = HasType<ZodDeviceAction, DeviceAction>;

/**
 * An interface that is used to determine which device to send a remote event to.
 */
export interface DeviceSelector {
    /**
     * The ID of the connection that the event should be sent to.
     */
    connectionId?: string;

    /**
     * The ID of the session that the event should be sent to.
     */
    sessionId?: string;

    /**
     * The ID of the user that the event should be sent to.
     */
    userId?: string;

    /**
     * Whether the event should be broadcast to all users.
     */
    broadcast?: boolean;
}
export const deviceSelectorSchema = z.object({
    connectionId: z.string().optional(),
    sessionId: z.string().optional(),
    userId: z.string().optional(),
    broadcast: z.boolean().optional(),
});
type ZodDeviceSelector = z.infer<typeof deviceSelectorSchema>;
type ZodDeviceSelectorAssertion = HasType<ZodDeviceSelector, DeviceSelector>;

export type RemoteActions =
    | RemoteAction
    | RemoteActionResult
    | RemoteActionError;

/**
 * An event that is used to send events from this device to a remote device.
 *
 * @dochash types/os/event
 * @docname RemoteAction
 */
export interface RemoteAction extends Action, DeviceSelector {
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

    /**
     * The ID of the task.
     */
    taskId?: number | string;
}
export const remoteActionSchema = deviceSelectorSchema.extend({
    type: z.literal('remote'),
    event: z.any(),
    allowBatching: z.boolean().optional(),
    taskId: z.union([z.string(), z.number()]).optional(),
});
type ZodRemoteAction = z.infer<typeof remoteActionSchema>;
type ZodRemoteActionAssertion = HasType<ZodRemoteAction, RemoteAction>;

/**
 * An event that is used to respond to remote actions with some arbitrary data.
 */
export interface RemoteActionResult extends Action, DeviceSelector {
    type: 'remote_result';

    /**
     * The data that is included in the result.
     */
    result?: any;

    /**
     * The ID of the task that this is a result for.
     */
    taskId: number | string;
}
export const remoteActionResultSchema = deviceSelectorSchema.extend({
    type: z.literal('remote_result'),
    result: z.any().optional(),
    taskId: z.union([z.string(), z.number()]).optional(),
});
type ZodRemoteActionResult = z.infer<typeof remoteActionResultSchema>;
type ZodRemoteActionResultAssertion = HasType<
    ZodRemoteActionResult,
    RemoteActionResult
>;

/**
 * An event that is used to response to remote actions with an error.
 */
export interface RemoteActionError extends Action, DeviceSelector {
    type: 'remote_error';

    /**
     * The error that occurred.
     */
    error: any;

    /**
     * The ID of the task that this is a result for.
     */
    taskId: number | string;
}
export const remoteActionErrorSchema = deviceSelectorSchema.extend({
    type: z.literal('remote_error'),
    error: z.any(),
    taskId: z.union([z.string(), z.number()]).optional(),
});
type ZodRemoteActionError = z.infer<typeof remoteActionErrorSchema>;
type ZodRemoteActionErrorAssertion = HasType<
    ZodRemoteActionError,
    RemoteActionError
>;

export const remoteActionsSchema = z.discriminatedUnion('type', [
    remoteActionSchema,
    remoteActionResultSchema,
    remoteActionErrorSchema,
]);
type ZodRemoteActions = z.infer<typeof remoteActionsSchema>;
type ZodRemoteActionsAssertion = HasType<ZodRemoteActions, RemoteActions>;

/**
 * An event that is used to respond to remote actions with some arbitrary data.
 */
export interface DeviceActionResult extends Action {
    type: 'device_result';

    /**
     * The data that is included in the result.
     */
    result: any;

    /**
     * The ID of the task that this is a result for.
     */
    taskId: number | string;

    /**
     * The connection which sent the event.
     */
    connection: ConnectionInfo;
}
export const deviceActionResultSchema = z.object({
    type: z.literal('device_result'),
    result: z.any(),
    taskId: z.union([z.string(), z.number()]).optional(),
    connection: connectionInfoSchema(),
});
type ZodDeviceActionResult = z.infer<typeof deviceActionResultSchema>;
type ZodDeviceActionResultAssertion = HasType<
    ZodDeviceActionResult,
    DeviceActionResult
>;

/**
 * An event that is used to respond to remote actions with an error.
 */
export interface DeviceActionError extends Action {
    type: 'device_error';

    /**
     * The error that is included in the result.
     */
    error: any;

    /**
     * The ID of the task that this is a result for.
     */
    taskId: number | string;

    /**
     * The connection which sent the event.
     */
    connection: ConnectionInfo;
}
export const deviceActionErrorSchema = z.object({
    type: z.literal('device_error'),
    error: z.any(),
    taskId: z.union([z.string(), z.number()]).optional(),
    connection: connectionInfoSchema(),
});
type ZodDeviceActionError = z.infer<typeof deviceActionErrorSchema>;
type ZodDeviceActionErrorAssertion = HasType<
    ZodDeviceActionError,
    DeviceActionError
>;

export type DeviceActions =
    | DeviceAction
    | DeviceActionResult
    | DeviceActionError;

export const deviceActionsSchema = z.discriminatedUnion('type', [
    deviceActionSchema,
    deviceActionResultSchema,
    deviceActionErrorSchema,
]);
type ZodDeviceActions = z.infer<typeof deviceActionsSchema>;
type ZodDeviceActionsAssertion = HasType<ZodDeviceActions, DeviceActions>;

/**
 * Creates a new remote event.
 * @param event The event.
 * @param selector The selector that should be used to determine which devices this event should be sent to.
 * @param allowBatching Whether this action is allowed to be batched with other remote actions.
 *                      Batching will preserve ordering between remote actions but may
 *                      break ordering with respect to bot actions. Defaults to true.
 * @param taskId The ID of the task that this remote action represents.
 */
export function remote(
    event: Action,
    selector?: DeviceSelector,
    allowBatching?: boolean,
    taskId?: number | string
): RemoteAction {
    return {
        type: 'remote',
        event: event,
        allowBatching,
        taskId,
        ...selector,
    };
}

/**
 * Creates a new remote event that represents a result to an async task.
 * @param result The result data.
 * @param selector The selector that should be used to determine which devices this event should be sent to.
 * @param taskId The ID of the task that this remote action represents.
 */
export function remoteResult(
    result: any,
    selector?: DeviceSelector,
    taskId?: number | string
): RemoteActionResult {
    return {
        type: 'remote_result',
        result,
        taskId,
        ...selector,
    };
}

/**
 * Creates a new remote event that represents an error result to an async task.
 * @param result The result data.
 * @param selector The selector that should be used to determine which devices this event should be sent to.
 * @param taskId The ID of the task that this remote action represents.
 */
export function remoteError(
    error: any,
    selector?: DeviceSelector,
    taskId?: number | string
): RemoteActionError {
    return {
        type: 'remote_error',
        error,
        taskId,
        ...selector,
    };
}

/**
 * Creates a new device event.
 * @param info The info about the device that is sending the event.
 * @param data The data included in the result.
 * @param taskId The ID of the task that this device action represents.
 */
export function device(
    info: ConnectionInfo,
    event: Action,
    taskId?: number | string
): DeviceAction {
    return {
        type: 'device',
        connection: info,
        event: event,
        taskId,
    };
}

/**
 * Creates a new device event that represents the result of an async task.
 * @param info The info about the device that is sending the event.
 * @param result The result data included in the result.
 * @param taskId The ID of the task that this device action represents.
 */
export function deviceResult(
    info: ConnectionInfo,
    result: any,
    taskId?: number | string
): DeviceActionResult {
    return {
        type: 'device_result',
        connection: info,
        result,
        taskId,
    };
}

/**
 * Creates a new device event that represents an error of an async task.
 * @param info The info about the device that is sending the event.
 * @param error The error data included in the result.
 * @param taskId The ID of the task that this device action represents.
 */
export function deviceError(
    info: ConnectionInfo,
    error: any,
    taskId?: number | string
): DeviceActionError {
    return {
        type: 'device_error',
        connection: info,
        error,
        taskId,
    };
}

type HasType<T, Q extends T> = Q;
