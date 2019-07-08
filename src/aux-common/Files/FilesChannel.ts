import { FilesState, File } from './File';
import { Action, FileEvent } from './FileEvents';
import { FileSandboxContext } from './FileCalculationContext';
import {
    getActiveObjects,
    filtersMatchingArguments,
    calculateFileValue,
    isFileListening,
} from './FileCalculations';
import {
    getActions,
    getCalculationContext,
    getFileState,
    getUserId,
    setActions,
    setFileState,
    setCalculationContext,
} from '../Formulas/formula-lib-globals';
import { flatMap, sortBy } from 'lodash';
import { createCalculationContext } from './FileCalculationContextFactories';

/**
 * Calculates the set of events that should be run as the result of the given action using the given context.
 * The returned events are only events that were added directly from the scripts and not any events that were added via setTag() calls.
 */
export function calculateActionEventsUsingContext(
    state: FilesState,
    action: Action,
    context: FileSandboxContext
) {
    const { files, objects } = getFilesForAction(state, action);
    return calculateFileActionEvents(state, action, context, files);
}

export function getFilesForAction(state: FilesState, action: Action) {
    //here

    const objects = getActiveObjects(state);
    const files = !!action.fileIds
        ? action.fileIds.map(id => state[id])
        : objects;

    let calc = createCalculationContext(objects, action.userId);

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
) {
    return flatMap(files, f =>
        eventActions(
            state,
            files,
            context,
            f,
            action.eventName,
            action.argument
        )
    );
}

function eventActions(
    state: FilesState,
    objects: File[],
    context: FileSandboxContext,
    file: File,
    eventName: string,
    argument: any
): FileEvent[] {
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

    const scripts = filters.map(f => calculateFileValue(context, file, f.tag));

    const events = formulaActions(
        state,
        context,
        sortedObjects,
        argument,
        scripts
    );

    return events;
}

export function formulaActions(
    state: FilesState,
    context: FileSandboxContext,
    sortedObjects: File[],
    argument: any,
    scripts: any[]
) {
    let previous = getActions();
    let prevContext = getCalculationContext();
    let prevState = getFileState();
    let prevUserId = getUserId();
    let actions: FileEvent[] = [];
    let vars: {
        [key: string]: any;
    } = {};
    setActions(actions);
    setFileState(state);
    setCalculationContext(context);
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
    scripts.forEach(s => {
        const result = context.sandbox.run(s, {}, sortedObjects[0], vars);
        if (result.error) {
            throw result.error;
        }
    });
    setActions(previous);
    setFileState(prevState);
    setCalculationContext(prevContext);
    return actions;
}
