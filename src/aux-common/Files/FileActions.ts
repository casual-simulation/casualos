import { File, FilesState } from './File';
import {
    calculateFileValue,
    getActiveObjects,
    calculateFormulaValue,
    isDestroyable,
} from './FileCalculations';
import { FileCalculationContext } from './FileCalculationContext';
import { Action, fileRemoved, FileEvent } from './FileEvents';
import {
    createCalculationContextFromState,
    createCalculationContext,
} from './FileCalculationContextFactories';
import {
    calculateFileActionEvents,
    getFilesForAction,
    formulaActions,
} from './FilesChannel';
import { SandboxFactory } from '../Formulas/Sandbox';
import { values } from 'lodash';

interface FileChanges {
    [key: string]: {
        changedTags: string[];
        newValues: string[];
    };
}

/**
 * Executes the given formula on the given file state and returns the results.
 * @param formula The formula to run.
 * @param state The file state to use.
 * @param options The options.
 */
export function searchFileState(
    formula: string,
    state: FilesState,
    { includeDestroyed }: { includeDestroyed?: boolean } = {},
    createSandbox?: SandboxFactory
) {
    includeDestroyed = includeDestroyed || false;
    const context = createCalculationContextFromState(
        state,
        includeDestroyed,
        createSandbox
    );
    const result = calculateFormulaValue(context, formula);
    return result;
}

export function calculateActionResults(
    state: FilesState,
    action: Action,
    sandboxFactory?: SandboxFactory
): [FileEvent[], any[]] {
    const allObjects = values(state);
    const calc = createCalculationContext(
        allObjects,
        action.userId,
        undefined,
        sandboxFactory
    );
    const { files, objects } = getFilesForAction(state, action, calc);
    const context = createCalculationContext(
        objects,
        action.userId,
        undefined,
        sandboxFactory
    );

    const [fileEvents, results] = calculateFileActionEvents(
        state,
        action,
        context,
        files
    );
    let events = [...fileEvents, ...context.sandbox.interface.getFileUpdates()];

    return [events, results];
}

/**
 * Calculates the set of events that should be run for the given action.
 * @param state The current file state.
 * @param action The action to process.
 * @param context The calculation context to use.
 * @param sandboxFactory The sandbox factory to use.
 */
export function calculateActionEvents(
    state: FilesState,
    action: Action,
    sandboxFactory?: SandboxFactory
) {
    const allObjects = values(state);
    const calc = createCalculationContext(
        allObjects,
        action.userId,
        undefined,
        sandboxFactory
    );
    const { files, objects } = getFilesForAction(state, action, calc);
    const context = createCalculationContext(
        objects,
        action.userId,
        undefined,
        sandboxFactory
    );

    const [fileEvents] = calculateFileActionEvents(
        state,
        action,
        context,
        files
    );
    let events = [...fileEvents, ...context.sandbox.interface.getFileUpdates()];

    return {
        events,
        hasUserDefinedEvents: events.length > 0,
    };
}

/**
 * Calculates the set of events that should be run for the given formula.
 * @param state The current file state.
 * @param formula The formula to run.
 * @param userId The ID of the user to run the script as.
 * @param argument The argument to include as the "that" variable.
 */
export function calculateFormulaEvents(
    state: FilesState,
    formula: string,
    userId: string = null,
    argument: any = null,
    sandboxFactory?: SandboxFactory
) {
    const objects = getActiveObjects(state);
    const context = createCalculationContext(
        objects,
        userId,
        undefined,
        sandboxFactory
    );

    let [fileEvents] = formulaActions(state, context, [], null, [formula]);

    return [...fileEvents, ...context.sandbox.interface.getFileUpdates()];
}

/**
 * Calculates the list of events needed to destroy the given file and all of its decendents.
 * @param calc The file calculation context.
 * @param file The file to destroy.
 */
export function calculateDestroyFileEvents(
    calc: FileCalculationContext,
    file: File
): FileEvent[] {
    if (!isDestroyable(calc, file)) {
        return [];
    }
    let events: FileEvent[] = [];
    let id: string;
    if (typeof file === 'object') {
        id = file.id;
    } else if (typeof file === 'string') {
        id = file;
    }

    if (id) {
        events.push(fileRemoved(id));
    }

    destroyChildren(calc, events, id);

    return events;
}

function destroyChildren(
    calc: FileCalculationContext,
    events: FileEvent[],
    id: string
) {
    const result = calc.objects.filter(
        o => calculateFileValue(calc, o, 'aux.creator') === id
    );

    result.forEach(child => {
        if (!isDestroyable(calc, child)) {
            return;
        }
        events.push(fileRemoved(child.id));
        destroyChildren(calc, events, child.id);
    });
}
