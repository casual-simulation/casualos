import { File, FileTags } from '../Files/File';
import {
    FileUpdatedEvent,
    FileEvent,
    FileAddedEvent,
    action,
    FilesState,
    calculateActionEvents,
    FileRemovedEvent,
    fileRemoved,
    fileAdded,
    toast as toastMessage,
    tweenTo as calcTweenTo,
    openQRCodeScanner as calcOpenQRCodeScanner,
    loadSimulation as calcLoadSimulation,
    unloadSimulation as calcUnloadSimulation,
    superShout as calcSuperShout,
    showQRCode as calcShowQRCode,
    goToContext as calcGoToContext,
} from '../Files/FilesChannel';
import uuid from 'uuid/v4';
import { every, find } from 'lodash';
import { isProxy, proxyObject, FileProxy } from '../Files/FileProxy';
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
    isFile,
    isFormulaObject,
    unwrapProxy,
    CREATE_ACTION_NAME,
    DESTROY_ACTION_NAME,
    isFileInContext,
} from '../Files/FileCalculations';

let actions: FileEvent[] = [];
let state: FilesState = null;
let calc: FileCalculationContext = null;
// let userFileId: string = null;

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
    if (calc) {
        return calc.sandbox.interface.userId();
    } else {
        return null;
    }
}

// declare const lib: string;
// export default lib;

/**
 * Defines a type that represents a file diff.
 * That is, a set of tags that can be applied to another file.
 */
export type FileDiff = FileTags | FileProxy;

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
    if (!Array.isArray(list)) {
        return parseFloat(list);
    }

    let total = sum(list);
    let count = list.length;
    return total / count;
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
    if (!Array.isArray(list)) {
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
export function sort(array: any[], direction: 'ASC' | 'DESC' = 'ASC'): any[] {
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
export function destroyFile(file: FileProxy | string) {
    let id: string;
    if (typeof file === 'object') {
        id = file.id;
    } else if (typeof file === 'string') {
        id = file;
    }

    if (id) {
        event(DESTROY_ACTION_NAME, [id]);
        actions.push(fileRemoved(id));
    }

    destroyChildren(id);
}

/**
 * Destroys the given file, file ID, or list of files.
 * @param file The file, file ID, or list of files to destroy.
 */
export function destroy(file: FileProxy | string | FileProxy[]) {
    if (typeof file === 'object' && Array.isArray(file)) {
        file.forEach(f => destroyFile(f));
    } else {
        destroyFile(file);
    }
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
 * @param diffs The diffs that specify what tags to set on the file.
 */
export function create(...diffs: (FileDiff | FileDiff[])[]) {
    let variants: FileDiff[][] = new Array<FileDiff[]>(1);
    variants[0] = [];

    for (let i = 0; i < diffs.length; i++) {
        let diff = diffs[i];
        if (Array.isArray(diff)) {
            let newVariants: FileDiff[][] = new Array<FileDiff[]>(
                variants.length * diff.length
            );

            for (let b = 0; b < newVariants.length; b++) {
                let diffIdx = Math.floor(b / variants.length);
                let d = diff[diffIdx];
                let variantIdx = b % variants.length;
                let newVariant = variants[variantIdx].slice();
                newVariant.push(d);
                newVariants[b] = newVariant;
            }

            variants = newVariants;
        } else {
            for (let b = 0; b < variants.length; b++) {
                variants[b].push(diff);
            }
        }
    }

    let files: File[] = variants.map(v => {
        let file = {
            id: uuid(),
            tags: {},
        };
        applyDiff(file.tags, ...v);
        return file;
    });

    actions.push(...files.map(f => fileAdded(f)));

    let ret = new Array<FileProxy>(files.length);
    for (let i = 0; i < files.length; i++) {
        ret[i] = calc.sandbox.interface.addFile(files[i]);
        state = Object.assign({}, state, {
            [files[i].id]: files[i],
        });
    }

    event(CREATE_ACTION_NAME, files);

    if (ret.length === 1) {
        return ret[0];
    } else {
        return ret;
    }
}

/**
 * Gets the file ID from the given file.
 * @param file The file or string.
 */
export function getFileId(file: FileProxy | string): string {
    if (typeof file === 'string') {
        return file;
    } else if (file) {
        let original = file[isProxy] ? file[proxyObject] : file;
        return original.id;
    }
}

/**
 * Creates a new file that is a child of the given file.
 * @param parent The file that should be the parent of the new file.
 * @param data The object that specifies the new file's tag values.
 */
export function createFrom(parent: FileProxy | string, ...datas: FileDiff[]) {
    let parentId = getFileId(parent);
    let parentDiff = parentId
        ? {
              'aux._creator': parentId,
          }
        : {};
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
 * @param arg The argument to pass.
 */
export function event(name: string, files: (File | string)[], arg?: any) {
    if (!!state) {
        let ids = !!files
            ? files.map(f => {
                  const file = unwrapProxy(f);
                  return typeof file === 'string' ? file : file.id;
              })
            : null;
        let results = calculateActionEvents(
            state,
            action(name, ids, getUserId(), arg)
        );
        actions.push(...results.events);
    }
}

/**
 * Shouts the given event to every file.
 * @param name The event name.
 */
export function shout(name: string, arg?: any) {
    event(name, null, arg);
}

/**
 * Shouts the given event to every file in every loaded simulation.
 * @param eventName The name of the event to shout.
 * @param arg The argument to shout. This gets passed as the `that` variable to the other scripts.
 */
export function superShout(eventName: string, arg?: any) {
    actions.push(calcSuperShout(eventName, arg));
}

/**
 * Sends the given event to the given file.
 * @param file The file to send the event to.
 * @param eventName The name of the event to send.
 * @param arg The argument to pass.
 */
export function whisper(file: File | string, eventName: string, arg?: any) {
    event(eventName, [file], arg);
}

/**
 * Redirects the user to a context in the given simulation and context.
 * @param simulationId The ID of the simulation to go to.
 * @param context The context to go to. If not provided then the simulation ID will be used as the context.
 */
export function goToContext(simulationId: string, context?: string) {
    actions.push(calcGoToContext(simulationId, context));
}

/**
 * Derermines whether the player is in the given context.
 * @param context The context.
 */
export function isInContext(givenContext: string) {
    let currentContext = window.location.pathname.split('/')[2];

    return currentContext === givenContext;
}

/**
 * Determines whether the player has the given file in their inventory.
 * @param files The file or files to check.
 */
export function hasFileInInventory(files: FileProxy | FileProxy[]): boolean {
    if (!Array.isArray(files)) {
        files = [files];
    }

    return every(files, f =>
        isFileInContext(
            getCalculationContext(),
            <any>f,
            getUserInventoryContext()
        )
    );
}

/**
 * Gets the current user's file.
 */
export function getUser() {
    if (!getUserId()) {
        return null;
    }
    const user = calc.sandbox.interface.listObjectsWithTag('id', getUserId());
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
        return user['aux._userMenuContext'];
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
        return user['aux._userInventoryContext'];
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
export function applyDiff(file: any, ...diffs: FileDiff[]) {
    diffs.forEach(diff => {
        if (!diff) {
            return;
        }
        if (isFormulaObject(diff)) {
            diff = unwrapProxy(diff).tags;
        } else {
            diff = unwrapProxy(diff);
        }
        for (let key in diff) {
            file[key] = unwrapProxy(diff[key]);
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
export function addToContextDiff(
    context: string,
    x: number = 0,
    y: number = 0,
    index?: number
) {
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
export function addToContext(
    file: FileProxy,
    context: string,
    x: number = 0,
    y: number = 0,
    index?: number
) {
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
export function setPositionDiff(
    context: string,
    x?: number,
    y?: number,
    index?: number
) {
    return calcSetPositionDiff(calc, context, x, y, index);
}

/**
 * Gets a diff that adds a file to the current user's menu.
 */
export function addToMenuDiff(): FileTags {
    const context = getUserMenuContext();
    return {
        ...addToContextDiff(context),
        [`${context}.id`]: uuid(),
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
        [`${context}.id`]: null,
    };
}

/**
 * Removes the given file from the current user's menu.
 * @param file The file to remove from the menu.
 */
export function removeFromMenu(file: FileProxy) {
    applyDiff(file, removeFromMenuDiff());
}

/**
 * Shows a toast message to the user.
 * @param message The message to show.
 */
export function toast(message: string) {
    actions.push(toastMessage(message));
}

/**
 * Tweens the user's camera to view the given file.
 * @param file The file to view.
 * @param zoomValue The zoom value to use.
 */
export function tweenTo(file: FileProxy | string, zoomValue?: number) {
    actions.push(calcTweenTo(getFileId(file), zoomValue));
}

/**
 * Opens the QR Code Scanner.
 */
export function openQRCodeScanner() {
    actions.push(calcOpenQRCodeScanner(true));
}

/**
 * Closes the QR Code Scanner.
 */
export function closeQRCodeScanner() {
    actions.push(calcOpenQRCodeScanner(false));
}

/**
 * Shows the given QR Code.
 * @param code The code to show.
 */
export function showQRCode(code: string) {
    actions.push(calcShowQRCode(true, code));
}

/**
 * Hides the QR Code.
 */
export function hideQRCode() {
    actions.push(calcShowQRCode(false));
}

/**
 * Loads the channel with the given ID.
 * @param id The ID of the channel to load.
 */
export function loadChannel(id: string) {
    actions.push(calcLoadSimulation(id));
}

/**
 * Unloads the channel with the given ID.
 * @param id The ID of the channel to unload.
 */
export function unloadChannel(id: string) {
    actions.push(calcUnloadSimulation(id));
}

/**
 * Determines if the user is currently connected to the server.
 */
export function isConnected(): boolean {
    const user = getUser();
    if (user) {
        const val = user['aux.connected'];
        if (val) {
            return val.valueOf() || false;
        }
    }
    return false;
}

/**
 * Defines a set of functions that are able to make File Diffs.
 */
export const diff = {
    addToContext: addToContextDiff,
    removeFromContext: removeFromContextDiff,
    addToMenu: addToMenuDiff,
    removeFromMenu: removeFromMenuDiff,
    setPosition: setPositionDiff,
};

/**
 * Defines a set of functions that relate to common player operations.
 */
export const player = {
    isInContext,
    goToContext,
    getFile: getUser,
    getMenuContext: getUserMenuContext,
    getInventoryContext: getUserInventoryContext,
    toast,
    tweenTo,
    openQRCodeScanner,
    closeQRCodeScanner,
    loadChannel,
    unloadChannel,
    hasFileInInventory,
    showQRCode,
    hideQRCode,
    isConnected,
};

/**
 * Defines a set of functions that relate to common math operations.
 */
export const math = {
    sum,
    avg,
    sqrt,
    abs,
    stdDev,
    randomInt,
    random,
};

/**
 * Defines a set of functions that relate to common data operations.
 */
export const data = {
    sort,
    join,
};

export default {
    // Namespaces
    data,
    diff,
    math,
    player,

    // Global functions
    applyDiff,
    combine,
    create: createFrom,
    destroy,
    event,
    getFilesInContext,
    shout,
    superShout,
    whisper,
};
