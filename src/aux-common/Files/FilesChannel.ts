import { FilesState, File } from './File';
import { Action, FileEvent } from './FileEvents';
import { FileSandboxContext } from './FileCalculationContext';
import {
    getActiveObjects,
    filtersMatchingArguments,
    calculateFileValue,
    isFileListening,
    DEFAULT_ENERGY,
    hasValue,
} from './FileCalculations';
import {
    getActions,
    getCalculationContext,
    getFileState,
    getUserId,
    setActions,
    setFileState,
    setCalculationContext,
    getEnergy,
    setEnergy,
} from '../Formulas/formula-lib-globals';
import { flatMap, sortBy } from 'lodash';

/**
 * Calculates the set of events that should be run as the result of the given action using the given context.
 * The returned events are only events that were added directly from the scripts and not any events that were added via setTag() calls.
 */
export function calculateActionEventsUsingContext(
    state: FilesState,
    action: Action,
    context: FileSandboxContext
): FileEvent[] {
    let [events] = calculateActionResultsUsingContext(state, action, context);
    return events;
}

/**
 * Calculates the results of the given action run against the given state in the given context.
 * @param state The current files state that the action should use.
 * @param action The action to run.
 * @param context The context that the action should be run in.
 */
export function calculateActionResultsUsingContext(
    state: FilesState,
    action: Action,
    context: FileSandboxContext
): [FileEvent[], any[]] {
    const { files, objects } = getFilesForAction(state, action, context);
    return calculateFileActionEvents(state, action, context, files);
}

export function getFilesForAction(
    state: FilesState,
    action: Action,
    calc: FileSandboxContext
) {
    //here

    const objects = getActiveObjects(state);
    let files = !!action.fileIds
        ? action.fileIds.map(id => state[id])
        : objects;

    files = action.sortFileIds ? sortBy(files, f => f.id) : files;

    for (let i = files.length - 1; i >= 0; i--) {
        if (isFileListening(calc, files[i]) == false) {
            files.splice(i, 1);
        }
    }

    return { files, objects };
}

export function calculateFileActionEvents(
    state: FilesState,
    action: Action,
    context: FileSandboxContext,
    files: File[]
): [FileEvent[], any[]] {
    let events: FileEvent[] = [];
    let results: any[] = [];

    for (let f of files) {
        const [e, r] = eventActions(
            state,
            files,
            context,
            f,
            action.eventName,
            action.argument
        );
        events.push(...e);
        results.push(...r);
    }

    return [events, results];
}

function eventActions(
    state: FilesState,
    objects: File[],
    context: FileSandboxContext,
    file: File,
    eventName: string,
    argument: any
): [FileEvent[], any[]] {
    if (file === undefined) {
        return;
    }
    const otherObjects = objects.filter(o => o !== file);
    const sortedObjects = sortBy(objects, o => o !== file);

    const filters = filtersMatchingArguments(
        context,
        file,
        eventName,
        otherObjects
    );

    const scripts = filters
        .map(f => {
            const result = calculateFileValue(context, file, f.tag);
            if (result) {
                return `(function() { ${result.toString()} }).call(this)`;
            } else {
                return result;
            }
        })
        .filter(r => hasValue(r));

    const result = formulaActions(
        state,
        context,
        sortedObjects,
        argument,
        scripts
    );

    return result;
}

export function formulaActions(
    state: FilesState,
    context: FileSandboxContext,
    sortedObjects: File[],
    argument: any,
    scripts: string[]
): [FileEvent[], any[]] {
    let previous = getActions();
    let prevContext = getCalculationContext();
    let prevState = getFileState();
    let prevUserId = getUserId();
    let prevEnergy = getEnergy();
    let actions: FileEvent[] = [];
    let vars: {
        [key: string]: any;
    } = {};
    setActions(actions);
    setFileState(state);
    setCalculationContext(context);

    // TODO: Allow configuring energy per action
    setEnergy(DEFAULT_ENERGY);

    if (typeof argument === 'undefined') {
        sortedObjects.forEach((obj, index) => {
            if (index === 1) {
                vars['that'] = obj;
            }
            vars[`arg${index}`] = obj;
        });
    } else {
        vars['that'] = argument;
    }

    let results: any[] = [];
    for (let script of scripts) {
        const result = context.sandbox.run(script, {}, sortedObjects[0], vars);
        if (result.error) {
            throw result.error;
        }
        results.push(result.result);
    }
    setActions(previous);
    setFileState(prevState);
    setCalculationContext(prevContext);
    setEnergy(prevEnergy);
    return [actions, results];
}
