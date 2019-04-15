import { File, FileTags } from '../Files/File';
import { FileUpdatedEvent, FileEvent, FileAddedEvent, action, FilesState, calculateActionEvents, FileRemovedEvent, fileRemoved, fileAdded, fileUpdated } from "../Files/FilesChannel";
import uuid from 'uuid/v4';
import { every, find } from "lodash";
import { isProxy, proxyObject, FileProxy } from "../Files/FileProxy";
import { 
    FileCalculationContext, 
    calculateFormulaValue, 
    COMBINE_ACTION_NAME, 
    addFileToMenu, 
    getUserMenuId, 
    filesInContext, 
    calculateFileValue, 
    removeFileFromMenu, 
    getFilesInMenu,
    addToContextDiff as calcAddToContextDiff,
    removeFromContextDiff as calcRemoveFromContextDiff,
    setPositionDiff as calcSetPositionDiff,
    isFile
} from '../Files/FileCalculations';

let actions: FileEvent[] = [];
let state: FilesState = null;
let calc: FileCalculationContext = null;
let userFileId: string = null;

export function setActions(value: FileEvent[]) {
    actions = value;
}

export function getActions(): FileEvent[] {
    return actions;
}

export function setFileState(value: FilesState) {
    state = value;
}

export function getFileState(): FilesState {
    return state;
}

export function setCalculationContext(context: FileCalculationContext) {
    calc = context;
}

export function getCalculationContext(): FileCalculationContext {
    return calc;
}

export function getUserId(): string {
    return userFileId;
}

export function setUserId(id: string) {
    userFileId = id;
}

// declare const lib: string;
// export default lib;

/**
 * Sums the given array of numbers and returns the result.
 * If any value in the list is not a number, it will be converted to one.
 * If the given value is not an array, then it will be converted to a number and returned.
 * 
 * @param list The value that should be summed. If it is a list, then the result will be the sum of the items in the list.
 *             If it is not a list, then the result will be the value converted to a number.
 */
export function sum(list: any): number {
    if (!Array.isArray(list)) {
        return parseFloat(list);
    }

    let carry = 0;
    for (let i = 0; i < list.length; i++) {
        const l = list[i];
        if (!Array.isArray(l)) {
            carry += parseFloat(l);
        } else {
            carry += sum(l);
        }
    }
    return carry;
}

/**
 * Calculates the average of the numbers in the given list and returns the result.
 * @param list The value that should be averaged.
 *             If it is a list, then the result will be sum(list)/list.length.
 *             If it is not a list, then the result will be the value converted to a number.
 */
export function avg(list: any) {
    if(!Array.isArray(list)) {
        return parseFloat(list);
    }

    let total = sum(list);
    let count = list.length;
    return total/count;
}

/**
 * Calculates the square root of the given number.
 * @param value The number.
 */
export function sqrt(value: any) {
    return Math.sqrt(parseFloat(value));
}

/**
 * Calculates the absolute value of a number.
 * @param number The number to get the absolute value of.
 */
export function abs(number: any) {
    return Math.abs(parseFloat(number));
}

/**
 * Calculates the standard deviation of the numbers in the given list and returns the result.
 * 
 * @param list The value that the standard deviation should be calculated for.
 */
export function stdDev(list: any) {
    if(!Array.isArray(list)) {
        list = [parseFloat(list)];
    }

    let mean = avg(list);
    let numbersMinusMean = list.map((l: number) => (l - mean) * (l - mean));

    let standardMean = avg(numbersMinusMean);
    return sqrt(standardMean);
}

/**
 * Sorts the given array in ascending order and returns the sorted values in a new array.
 * @param array The array of numbers to sort.
 */
export function sort(array: any[], direction: ('ASC' | 'DESC') = 'ASC'): any[] {
    let newArray = array.slice();
    let isAscending = direction.toUpperCase() !== 'DESC';
    if (isAscending) {
        return newArray.sort((a, b) => a - b);
    } else {
        return newArray.sort((a, b) => b - a);
    }
}

/**
 * Generates a random integer number between min and max.
 * @param min The smallest allowed value.
 * @param max The largest allowed value.
 */
export function randomInt(min: number = 0, max?: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    const rand = Math.random();
    if (max) {
        return Math.floor(rand * (max - min)) + min;
    } else {
        return Math.floor(rand) + min;
    }
}

/**
 * Generates a random number between min and max.
 * @param min The smallest allowed value.
 * @param max The largest allowed value.
 */
export function random(min: number = 0, max?: number): number {
    const rand = Math.random();
    if (max) {
        return rand * (max - min) + min;
    } else {
        return rand + min;
    }
}

/**
 * Joins the given list of values into a single string.
 * @param values The values to make the string out of.
 * @param separator The separator used to separate values.
 */
export function join(values: any, separator: string = ','): string {
    if (Array.isArray(values)) {
        return values.join(separator);
    } else {
        return values;
    }
}

/**
 * Removes the given file or file ID from the simulation.
 * @param file The file or file ID to remove from the simulation.
 */
export function destroy(file: File | string) {
    let id: string;
    if (typeof file === 'object') {
        id = file.id;
    } else if (typeof file === 'string') {
        id = file;
    }

    if (id) {
        actions.push(fileRemoved(id));
    }

    destroyChildren(id);
}

function destroyChildren(id: string) {
    const result = calculateFormulaValue(calc, `@aux._creator("${id}")`);
    if (result.success) {
        const children = result.result;
        let all: File[] = [];
        if (children) {
            if (Array.isArray(children)) {
                all = children;
            } else {
                all = [children];
            }
        }

        all.forEach(child => {
            actions.push(fileRemoved(child.id));
            destroyChildren(child.id);
        });
    }
}

/**
 * Creates a new file that contains the given tags.
 * @param datas The objects that specifies what tags to set on the file.
 */
export function create(...datas: FileTags[]) {
    let id = uuid();

    let tags: FileTags = {};
    datas.forEach((d: any) => {
        if (d[isProxy]) {
            let val = d[proxyObject];
            if (isFile(val)) {
                d = val.tags;
            } else {
                d = val;
            }
        }
        for (let key in d) {
            let val = d[key];
            if (val[isProxy]) {
                tags[key] = val[proxyObject];
            } else {
                tags[key] = val;
            }
        }
    });

    let file: File = {
        id: id,
        tags: tags
    };

    let event: FileAddedEvent = fileAdded(file);

    actions.push(event);
    return calc.sandbox.interface.addFile(file);
}

/**
 * Creates a new file that contains tags from the given files or objects.
 * @param files The files or objects to use for the new file's tags.
 */
export function clone(...files: any[]) {
    let id = uuid();

    let originals = files.map(f => {
        return (f && f[isProxy]) ? f[proxyObject].tags : f;
    });

    let newFile: File = {
        id: id,
        tags: {},
    };

    originals.forEach(o => {
        for (let key in o) {
            let val = o[key];
            if (val[isProxy]) {
                newFile.tags[key] = val[proxyObject];
            } else {
                newFile.tags[key] = val;
            }
        }
    });

    delete newFile.tags._converted;
    delete newFile.tags._original;
    delete newFile.tags.id;

    let event: FileAddedEvent = fileAdded(newFile);

    actions.push(event);
    return calc.sandbox.interface.addFile(newFile);
}

/**
 * Creates a new file that contains tags from and is parented under the given file.
 * @param file The file that the clone should be a child of.
 * @param data The files or objects to use for the new file's tags.
 */
export function cloneFrom(file: FileProxy | string, ...data: any[]) {
    let parentId: string;
    if (typeof file === 'string') {
        parentId = file;
    } else if (file) {
        let original = file[isProxy] ? file[proxyObject] : file;
        parentId = original.id;
    }
    let parent = file ? {
        'aux._creator': parentId
    } : {};
    return clone(file, parent, ...data);
}

/**
 * Creates a new file that is a child of the given file.
 * @param parent The file that should be the parent of the new file.
 * @param data The object that specifies the new file's tag values.
 */
export function createFrom(parent: FileProxy | string, ...datas: FileTags[]) {
    let parentId: string;
    if (typeof parent === 'string') {
        parentId = parent;
    } else if(parent) {
        let original = parent[isProxy] ? parent[proxyObject] : parent;
        parentId = original.id;
    }
    let parentDiff = parentId ? {
        'aux._creator': parentId
    } : {}; 
    return create(parentDiff, ...datas);
}

/**
 * Combines the two given files.
 * @param first The first file.
 * @param second The second file.
 */
export function combine(first: File | string, second: File | string) {
    event(COMBINE_ACTION_NAME, [first, second]);
}

/**
 * Runs an event on the given files.
 * @param name The name of the event to run.
 * @param files The files that the event should be executed on. If null, then the event will be run on every file.
 */
export function event(name: string, files: (File | string)[]) {
    if (!!state) {
        let ids = !!files ? files.map(f => typeof f === 'string' ? f : f.id) : null;
        let results = calculateActionEvents(state, action(name, ids, userFileId));
        actions.push(...results.events);
    }
}

/**
 * Shouts the given event to every file.
 * @param name The event name.
 */
export function shout(name: string) {
    event(name, null);
}

/**
 * Redirects the user to a context in the given simulation and context.
 * @param simulationId The ID of the simulation to go to.
 * @param context The context to go to. If not provided then the simulation ID will be used as the context.
 */
export function goToContext(simulationId: string, context?: string) {
    if (!context) {
        // Go to context in same simulation
        context = simulationId;
        
        // Grab the simulation ID from the current URL.
        // pathname always starts with a '/' so the first part is actually the second
        // element.
        simulationId = window.location.pathname.split('/')[1];
    }

    // Go to context and simulation
    window.location.pathname = `${simulationId}/${context}`;
}

/**
 * Gets the current user's file.
 */
export function getUser() {
    if (!userFileId) {
        return null;
    }
    const user = calc.sandbox.interface.listObjectsWithTag('id', userFileId);
    if (Array.isArray(user)) {
        if (user.length === 1) {
            return user[0];
        } else {
            return null;
        }
    }
    return user || null;
}

/**
 * Gets the name of the context that is used for the current user's menu.
 */
export function getUserMenuContext(): string {
    const user = getUser();
    if (user) {
        return user._userMenuContext;
    } else {
        return null;
    }
}

/**
 * Gets the name of the context that is used for the current user's inventory.
 */
export function getUserInventoryContext(): string {
    const user = getUser();
    if (user) {
        return user._userInventoryContext;
    } else {
        return null;
    }
}

/**
 * Gets the list of files that are in the given context.
 * @param context The context.
 */
export function getFilesInContext(context: string): FileProxy[] {
    const result = calc.sandbox.interface.listObjectsWithTag(context, true);
    if (Array.isArray(result)) {
        return result;
    } else {
        return [result];
    }
}

/**
 * Applies the given diff to the given file.
 * @param file The file.
 * @param diff The diff to apply.
 */
export function applyDiff(file: FileProxy, ...diffs: FileTags[]) {
    diffs.forEach(diff => {
        for (let key in diff) {
            file[key] = diff[key];
        }
    });
}

/**
 * Gets a diff that adds a file to the given context.
 * @param context The context.
 * @param x The X position that the file should be added at.
 * @param y The Y position that the file should be added at.
 * @param index The index that the file should be added at.
 */
export function addToContextDiff(context: string, x: number = 0, y: number = 0, index?: number) {
    return calcAddToContextDiff(calc, context, x, y, index);
}

/**
 * Gets a diff that removes a file from the given context.
 * @param context The context.
 */
export function removeFromContextDiff(context: string) {
    return calcRemoveFromContextDiff(calc, context);
}

/**
 * Adds the given file to the given context.
 * @param file The file.
 * @param context The context.
 * @param x The X position that the file should be added at.
 * @param y The Y position that the file should be added at.
 * @param index The index that the file should be added at.
 */
export function addToContext(file: FileProxy, context: string, x: number = 0, y: number = 0, index?: number) {
    applyDiff(file, addToContextDiff(context, x, y, index));
}

/**
 * Removes the given file from the given context.
 * @param file The file.
 * @param context The context.
 */
export function removeFromContext(file: FileProxy, context: string) {
    applyDiff(file, removeFromContextDiff(context));
}

/**
 * Gets a diff that sets the position of a file in the given context when applied.
 * @param context The context.
 * @param x The X position.
 * @param y The Y position.
 * @param index The index.
 */
export function setPositionDiff(context: string, x?: number, y?: number, index?: number) {
    return calcSetPositionDiff(calc, context, x, y, index); 
}

/**
 * Gets a diff that adds a file to the current user's menu.
 */
export function addToMenuDiff(): FileTags {
    const context = getUserMenuContext();
    return { 
        ...addToContextDiff(context),
        [`${context}.id`]: uuid()
    };
}

/**
 * Adds the given file to the current user's menu.
 * @param file The file to add to the menu.
 */
export function addToMenu(file: FileProxy) {
    applyDiff(file, addToMenuDiff());
}

/**
 * Gets a diff that removes a file from the current user's menu.
 */
export function removeFromMenuDiff(): FileTags {
    const context = getUserMenuContext();
    return { 
        ...removeFromContextDiff(context),
        [`${context}.id`]: null
    };
}

/**
 * Removes the given file from the current user's menu.
 * @param file The file to remove from the menu.
 */
export function removeFromMenu(file: FileProxy) {
    applyDiff(file, removeFromMenuDiff());
}

export default {
    sum,
    avg,
    sqrt,
    abs,
    stdDev,
    sort,
    randomInt,
    random,
    join,
    destroy,
    clone: cloneFrom,
    create: createFrom,
    combine,
    event,
    shout,
    goToContext,
    getUser,
    getUserMenuContext,
    getUserInventoryContext,

    getFilesInContext,
    applyDiff,
    addToContextDiff,
    removeFromContextDiff,
    addToMenuDiff,
    removeFromMenuDiff,
    setPositionDiff,
    addToContext,
    removeFromContext,

    addToMenu,
    removeFromMenu
};