import {
    AsyncAction,
    AsyncActions,
    BotAction,
    LocalActions,
} from '@casual-simulation/aux-common';
import { AuxRuntime } from './AuxRuntime';
import { RecordsActions, RecordsAsyncActions } from './RecordsEvents';

export type RuntimeActions =
    | LocalActions
    | BotAction
    | AttachRuntimeAction
    | DetachRuntimeAction
    | RecordsActions;

export type RuntimeAsyncActions = AsyncActions | RecordsAsyncActions;

/**
 * Defines an interface for a tag mapper.
 */
export interface TagMapper {
    /**
     * Maps a tag name from its internal name to the name that should be used by the frontend.
     */
    forward?: (name: string) => string;

    /**
     * Maps a tag name from its frontend name to the name that is used internally.
     */
    reverse?: (name: string) => string;
}

/**
 * An action that is used to attach a runtime to the CasualOS frontend.
 */
export interface AttachRuntimeAction extends AsyncAction {
    type: 'attach_runtime';

    /**
     * The runtime that should be attached.
     */
    runtime: AuxRuntime;

    /**
     * The tag mapper that should be used.
     */
    tagNameMapper?: TagMapper;

    uncopiable: true;
}

/**
 * An action that is used to detach a runtime from the CasualOS frontend.
 */
export interface DetachRuntimeAction extends AsyncAction {
    type: 'detach_runtime';

    /**
     * The runtime that should be detached.
     */
    runtime: AuxRuntime;

    uncopiable: true;
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

/**
 * Defines an interface for a debugger trace that is sent right before when the debugger starts executing a script.
 */
export interface DebuggerScriptEnterTrace {
    /**
     * The ID of the bot that the debugger started executing.
     */
    botId: string;

    /**
     * The tag of the bot that the debugger started executing.
     */
    tag: string;

    /**
     * The type of entry into the script.
     * - "call" means that the script was started by a function call.
     * - "task" means that execution in the script was started by the resumption of a task (setTimeout(), setInterval(), async/await, etc).
     */
    enterType: 'call' | 'task';
}

/**
 * Defines an interface for a debugger trace that is sent right after when the debugger stops executing a script.
 */
export interface DebuggerScriptExitTrace {
    /**
     * The ID of the bot.
     */
    botId: string;

    /**
     * The ID of the tag that the debugger stopped executing.
     */
    tag: string;

    /**
     * The type of exit from the script.
     * - "return" means the script stopped because it returned a value.
     * - "throw" means the script stopped because it
     */
    exitType: 'return' | 'throw';
}

/**
 * Creates a AttachRuntimeAction.
 * @param runtime The runtime that should be attached.
 * @param tagNameMapper The function that should be used to map tag names.
 * @param taskId The ID of the async task.
 */
export function attachRuntime(
    runtime: AuxRuntime,
    tagNameMapper?: AttachRuntimeAction['tagNameMapper'],
    taskId?: number | string
): AttachRuntimeAction {
    return {
        type: 'attach_runtime',
        uncopiable: true,
        runtime,
        tagNameMapper,
        taskId,
    };
}

/**
 * Creates a DetachRuntimeAction.
 * @param runtime The runtime that should be attached.
 * @param taskId The ID of the async task.
 */
export function detachRuntime(
    runtime: AuxRuntime,
    taskId?: number | string
): DetachRuntimeAction {
    return {
        type: 'detach_runtime',
        uncopiable: true,
        runtime,
        taskId,
    };
}
