import { File, FileTags, GLOBALS_FILE_ID } from '../Files/File';
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
    importAUX as calcImportAUX,
    showInputForTag as calcShowInputForTag,
    ShowInputOptions,
    fileUpdated,
    calculateActionEventsUsingContext,
} from '../Files/FilesChannel';
import uuid from 'uuid/v4';
import { every, find, sortBy } from 'lodash';
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
    // isFormulaObject,
    // unwrapProxy,
    CREATE_ACTION_NAME,
    DESTROY_ACTION_NAME,
    isFileInContext,
    tagsOnFile,
    isDestroyable,
    isInUsernameList,
    getFileUsernameList,
    DIFF_ACTION_NAME,
} from '../Files/FileCalculations';

import '../polyfill/Array.first.polyfill';
import '../polyfill/Array.last.polyfill';

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
export type FileDiff = FileTags | File;

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

    if (typeof id === 'object') {
        id = (<any>id).valueOf();
    }

    const realFile = getFileState()[id];
    if (!realFile) {
        return;
    }

    if (!isDestroyable(calc, realFile)) {
        return;
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

/**
 * Destroys the given file section, file ID, or list of files.
 * @param file The file, file ID, or list of files to destroy the tag sections of.
 * @param tagSection The tag section to remove on the file.
 */
export function removeTags(file: File | File[], tagSection: string | RegExp) {
    if (typeof file === 'object' && Array.isArray(file)) {
        let fileList: any[] = file;

        for (let h = 0; h < file.length; h++) {
            let tags = tagsOnFile(fileList[h]);

            for (let i = tags.length - 1; i >= 0; i--) {
                if (tagSection instanceof RegExp) {
                    if (tagSection.test(tags[i])) {
                        fileList[h][tags[i]] = null;
                    }
                } else if (tags[i].includes(tagSection)) {
                    let doRemoveTag = false;

                    if (tags[i].includes('.')) {
                        if (tags[i].split('.')[0] === tagSection) {
                            doRemoveTag = true;
                        }
                    } else {
                        if (tags[i] === tagSection) {
                            doRemoveTag = true;
                        }
                    }

                    if (doRemoveTag) {
                        fileList[h][tags[i]] = null;
                    }
                }
            }
        }
    } else {
        let tags = tagsOnFile(file);

        for (let i = tags.length - 1; i >= 0; i--) {
            // if the tag section is relevant to the curretn tag at all
            if (tagSection instanceof RegExp) {
                if (tagSection.test(tags[i])) {
                    setTag(file, tags[i], null);
                }
            } else if (tags[i].includes(tagSection)) {
                let doRemoveTag = false;
                // if this tag has a period in it, check for first word to match
                if (tags[i].includes('.')) {
                    if (tags[i].split('.')[0] === tagSection) {
                        doRemoveTag = true;
                    }
                } else {
                    // check if tag is equal to the tag section and that it doesn't just have the tagsection as a part of its
                    if (tags[i] === tagSection) {
                        doRemoveTag = true;
                    }
                }

                // if it has been verified that the tag matches the tag section for removal
                if (doRemoveTag) {
                    setTag(file, tags[i], null);
                }
            }
        }
    }
}

function destroyChildren(id: string) {
    const result = calculateFormulaValue(calc, `@aux.creator("${id}")`);
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
            if (!isDestroyable(calc, child)) {
                return;
            }
            actions.push(fileRemoved(child.id));
            destroyChildren(child.id);
        });
    }
}

/**
 * Creates a new file that contains the given tags.
 * @param diffs The diffs that specify what tags to set on the file.
 */
function create(...diffs: (FileDiff | FileDiff[])[]) {
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

    let ret = new Array<File>(files.length);
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
function getFileId(file: File | string): string {
    if (typeof file === 'string') {
        return file;
    } else if (file) {
        return file.id;
    }
}

/**
 * Creates a new file that is a child of the given file.
 * @param parent The file that should be the parent of the new file.
 * @param data The object that specifies the new file's tag values.
 */
function createFrom(parent: File | string, ...datas: FileDiff[]) {
    let parentId = getFileId(parent);
    let parentDiff = parentId
        ? {
              'aux.creator': parentId,
          }
        : {};
    return create(parentDiff, ...datas);
}

/**
 * Combines the two given files.
 * @param first The first file.
 * @param second The second file.
 */
function combine(first: File | string, second: File | string) {
    event(COMBINE_ACTION_NAME, [first, second]);
}

/**
 * Runs an event on the given files.
 * @param name The name of the event to run.
 * @param files The files that the event should be executed on. If null, then the event will be run on every file.
 * @param arg The argument to pass.
 */
function event(name: string, files: (File | string)[], arg?: any) {
    if (!!state) {
        let ids = !!files
            ? files.map(file => {
                  return typeof file === 'string' ? file : file.id;
              })
            : null;

        let events = calculateActionEventsUsingContext(
            state,
            action(name, ids, getUserId(), arg),
            getCalculationContext()
        );

        actions.push(...events);
    }
}

/**
 * Shouts the given event to every file.
 * @param name The event name.
 */
function shout(name: string, arg?: any) {
    event(name, null, arg);
}

/**
 * Shouts the given event to every file in every loaded simulation.
 * @param eventName The name of the event to shout.
 * @param arg The argument to shout. This gets passed as the `that` variable to the other scripts.
 */
function superShout(eventName: string, arg?: any) {
    actions.push(calcSuperShout(eventName, arg));
}

/**
 * Sends the given event to the given file.
 * @param file The file to send the event to.
 * @param eventName The name of the event to send.
 * @param arg The argument to pass.
 */
function whisper(
    file: (File | string)[] | File | string,
    eventName: string,
    arg?: any
) {
    if (Array.isArray(file)) {
        event(eventName, file, arg);
    } else {
        event(eventName, [file], arg);
    }
}

/**
 * Redirects the user to the given context.
 * @param context The context to go to.
 */
function goToContext(context: string) {
    actions.push(calcGoToContext(context));
}

function showInputForTag(
    file: FileProxy | string,
    tag: string,
    options?: Partial<ShowInputOptions>
) {
    const id = typeof file === 'string' ? file : file.id;
    actions.push(calcShowInputForTag(id, tag, options));
}

/**
 * Determines whether the current player is allowed to load AUX Builder.
 */
function isBuilder(): boolean {
    const globals = getGlobals();
    const user = getUser();
    if (globals && user) {
        const list = getFileUsernameList(calc, globals, 'aux.designers');
        if (list) {
            return isInUsernameList(
                calc,
                globals,
                'aux.designers',
                getTag(user, 'aux._user')
            );
        }
    }
    return true;
}

/**
 * Derermines whether the player is in the given context.
 * @param context The context.
 */
function isInContext(givenContext: string) {
    return currentContext() === givenContext;
}

/**
 * Gets the context that the player is currently in.
 */
function currentContext(): string {
    const user = getUser();
    if (user) {
        const context = getTag(user, 'aux._userContext');
        return context || undefined;
    }
    return undefined;
}

/**
 * Determines whether the player has the given file in their inventory.
 * @param files The file or files to check.
 */
function hasFileInInventory(files: FileProxy | FileProxy[]): boolean {
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
function getUser(): File {
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
 * Gets the current globals file.
 */
function getGlobals(): File {
    const globals = calc.sandbox.interface.listObjectsWithTag(
        'id',
        GLOBALS_FILE_ID
    );
    if (Array.isArray(globals)) {
        if (globals.length === 1) {
            return globals[0];
        } else {
            return null;
        }
    }
    return globals || null;
}

/**
 * Gets the name of the context that is used for the current user's menu.
 */
function getUserMenuContext(): string {
    const user = getUser();
    if (user) {
        return getTag(user, 'aux._userMenuContext');
    } else {
        return null;
    }
}

/**
 * Gets the name of the context that is used for the current user's inventory.
 */
function getUserInventoryContext(): string {
    const user = getUser();
    if (user) {
        return getTag(user, 'aux._userInventoryContext');
    } else {
        return null;
    }
}

/**
 * Gets the first bot that has the given tag which matches the given filter value.
 * @param tag The tag.
 * @param filter The optional filter.
 */
function getBot(tag: string, filter?: any | Function): FileProxy {
    return calc.sandbox.interface
        .listObjectsWithTag(trimTag(tag), filter)
        .first();
}

/**
 * Gets the list of bots that have the given tag matching the given filter value.
 * @param tag The tag.
 * @param filter The optional filter.
 */
function getBots(tag: string, filter?: any | Function): FileProxy[] {
    return calc.sandbox.interface.listObjectsWithTag(trimTag(tag), filter);
}

/**
 * Gets the list of tag values from bots that have the given tag.
 * @param tag The tag.
 * @param filter THe optional filter to use for the values.
 */
function getBotTagValues(tag: string, filter?: any | Function): any[] {
    return calc.sandbox.interface.listTagValues(trimTag(tag), filter);
}

/**
 * Gets the value of the given tag stored in the given file.
 * @param file The file.
 * @param tag The tag.
 */
function getTag(file: File, ...tags: string[]): any {
    let current: any = file;
    for (let i = 0; i < tags.length; i++) {
        if (isFile(current)) {
            const tag = trimTag(tags[i]);
            if (calc) {
                current = calc.sandbox.interface.getTag(current, tag);
            } else {
                current = file.tags[tag];
            }
        } else {
            return current;
        }
    }

    return current;
}

/**
 * Sets the value of the given tag stored in the given file.
 * @param file The file.
 * @param tag The tag to set.
 * @param value The value to set.
 */
function setTag(file: File | FileTags, tag: string, value: any): any {
    tag = trimTag(tag);
    if (isFile(file)) {
        return calc.sandbox.interface.setTag(file, tag, value);
    } else {
        (<FileTags>file)[tag] = value;
        return value;
    }
}

function trimTag(tag: string): string {
    if (tag.indexOf('#') === 0) {
        return tag.substring(1);
    }
    return tag;
}

/**
 * Gets the list of files that are in the given context.
 * @param context The context.
 */
function getBotsInContext(context: string): File[] {
    const result = calc.sandbox.interface.listObjectsWithTag(context, true);
    if (Array.isArray(result)) {
        return result;
    } else {
        return [result];
    }
}

/**
 * Gets the list of files that are at the same position in the given context as the given file.
 * @param file A file in the stack of files.
 * @param context The context that the stack of files exists in.
 */
function getBotsInStack(file: File, context: string): File[] {
    return getFilesAtPosition(
        context,
        getTag(file, `${context}.x`),
        getTag(file, `${context}.y`)
    );
}

/**
 * Gets the stack of files in the given context at the given position.
 * @param context The context that the files are in.
 * @param x The X position of the stack.
 * @param y The Y position of the stack.
 */
function getFilesAtPosition(context: string, x: number, y: number) {
    const result = getBotsInContext(context);
    const filtered = result.filter(f => {
        return (
            getTag(f, `${context}.x`) === x && getTag(f, `${context}.y`) === y
        );
    });
    return <File[]>sortBy(filtered, f => getTag(f, `${context}.index`) || 0);
}

/**
 * Gets the list of files that are in a stack next to the given file in the given context.
 * @param file The file.
 * @param context The context that the stack of files exists in.
 * @param position The position next to the given file to search for the stack.
 */
function getNeighboringBots(
    file: File,
    context: string
): {
    front: File[];
    back: File[];
    left: File[];
    right: File[];
};
function getNeighboringBots(
    file: File,
    context: string,
    position: 'left' | 'right' | 'front' | 'back'
): File[];
function getNeighboringBots(
    file: File,
    context: string,
    position?: 'left' | 'right' | 'front' | 'back'
):
    | File[]
    | {
          front: File[];
          back: File[];
          left: File[];
          right: File[];
      } {
    if (!position) {
        return {
            front: getNeighboringBots(file, context, 'front'),
            back: getNeighboringBots(file, context, 'back'),
            left: getNeighboringBots(file, context, 'left'),
            right: getNeighboringBots(file, context, 'right'),
        };
    }

    const offsetX = position === 'left' ? 1 : position === 'right' ? -1 : 0;
    const offsetY = position === 'back' ? 1 : position === 'front' ? -1 : 0;

    const x = getTag(file, `${context}.x`);
    const y = getTag(file, `${context}.y`);

    return getFilesAtPosition(context, x + offsetX, y + offsetY);
}

function loadDiff(file: any, ...tags: (string | RegExp)[]): FileDiff {
    if (typeof file === 'string') {
        file = JSON.parse(file);
    }

    let diff: FileTags = {};

    let tagsObj = isFile(file) ? file.tags : file;
    let fileTags = isFile(file) ? tagsOnFile(file) : Object.keys(file);
    for (let fileTag of fileTags) {
        let add = false;
        if (tags.length > 0) {
            for (let tag of tags) {
                if (tag instanceof RegExp) {
                    if (tag.test(fileTag)) {
                        add = true;
                        break;
                    }
                } else {
                    if (tag === fileTag) {
                        add = true;
                        break;
                    }
                }
            }
        } else {
            add = true;
        }

        if (add) {
            diff[fileTag] = tagsObj[fileTag];
        }
    }

    return diff;
}

/**
 * Saves the given diff to a string of JSON.
 * @param file The diff to save.
 */
function saveDiff(file: any): string {
    if (isFile(file)) {
        return JSON.stringify(file.tags);
    } else {
        return JSON.stringify(file);
    }
}

/**
 * Applies the given diff to the given file.
 * @param file The file.
 * @param diff The diff to apply.
 */
function applyDiff(file: any, ...diffs: FileDiff[]) {
    let appliedDiffs: FileTags[] = [];
    diffs.forEach(diff => {
        if (!diff) {
            return;
        }
        let tags: FileTags;
        if (isFile(diff)) {
            tags = diff.tags;
        } else {
            tags = diff;
        }
        appliedDiffs.push(tags);
        for (let key in tags) {
            setTag(file, key, tags[key]);
        }
    });

    if (isFile(file)) {
        event(DIFF_ACTION_NAME, [file], {
            diffs: appliedDiffs,
        });
    }
}

/**
 * Gets a diff that adds a file to the given context.
 * @param context The context.
 * @param x The X position that the file should be added at.
 * @param y The Y position that the file should be added at.
 * @param index The index that the file should be added at.
 */
function addToContextDiff(
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
function removeFromContextDiff(context: string) {
    return calcRemoveFromContextDiff(calc, context);
}

/**
 * Gets a diff that sets the position of a file in the given context when applied.
 * @param context The context.
 * @param x The X position.
 * @param y The Y position.
 * @param index The index.
 */
function setPositionDiff(
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
function addToMenuDiff(): FileTags {
    const context = getUserMenuContext();
    return {
        ...addToContextDiff(context),
        [`${context}.id`]: uuid(),
    };
}

/**
 * Gets a diff that removes a file from the current user's menu.
 */
function removeFromMenuDiff(): FileTags {
    const context = getUserMenuContext();
    return {
        ...removeFromContextDiff(context),
        [`${context}.id`]: null,
    };
}

/**
 * Shows a toast message to the user.
 * @param message The message to show.
 */
function toast(message: string) {
    actions.push(toastMessage(message));
}

/**
 * Tweens the user's camera to view the given file.
 * @param file The file to view.
 * @param zoomValue The zoom value to use.
 */
function tweenTo(file: File | string, zoomValue?: number) {
    actions.push(calcTweenTo(getFileId(file), zoomValue));
}

/**
 * Opens the QR Code Scanner.
 */
function openQRCodeScanner() {
    actions.push(calcOpenQRCodeScanner(true));
}

/**
 * Closes the QR Code Scanner.
 */
function closeQRCodeScanner() {
    actions.push(calcOpenQRCodeScanner(false));
}

/**
 * Shows the given QR Code.
 * @param code The code to show.
 */
function showQRCode(code: string) {
    actions.push(calcShowQRCode(true, code));
}

/**
 * Hides the QR Code.
 */
function hideQRCode() {
    actions.push(calcShowQRCode(false));
}

/**
 * Loads the channel with the given ID.
 * @param id The ID of the channel to load.
 */
function loadChannel(id: string) {
    actions.push(calcLoadSimulation(id));
}

/**
 * Unloads the channel with the given ID.
 * @param id The ID of the channel to unload.
 */
function unloadChannel(id: string) {
    actions.push(calcUnloadSimulation(id));
}

/**
 * Imports the AUX at the given URL.
 * @param url The URL to load.
 */
function importAUX(url: string) {
    actions.push(calcImportAUX(url));
}

/**
 * Determines if the user is currently connected to the server.
 */
function isConnected(): boolean {
    const user = getUser();
    if (user) {
        const val = getTag(user, 'aux.connected');
        if (val) {
            return val.valueOf() || false;
        }
    }
    return false;
}

/**
 * Defines a set of functions that are able to make File Diffs.
 */
export const tags = {
    addToContext: addToContextDiff,
    removeFromContext: removeFromContextDiff,
    addToMenu: addToMenuDiff,
    removeFromMenu: removeFromMenuDiff,
    setPosition: setPositionDiff,
    import: loadDiff,
    export: saveDiff,
    remove: removeTags,
    apply: applyDiff,
};

/**
 * Defines a set of functions that relate to common player operations.
 */
export const player = {
    isInContext,
    goToContext,
    getBot: getUser,
    getMenuContext: getUserMenuContext,
    getInventoryContext: getUserInventoryContext,
    toast,
    tweenTo,
    openQRCodeScanner,
    closeQRCodeScanner,
    loadChannel,
    unloadChannel,
    importAUX,
    hasFileInInventory,
    showQRCode,
    hideQRCode,
    isConnected,
    currentContext,
    isDesigner: isBuilder,
    showInputForTag,
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
    tags,
    math,
    player,

    // Global functions
    combine,
    create: createFrom,
    destroy,
    event,
    getBotsInContext,
    getBotsInStack,
    getNeighboringBots,
    shout,
    superShout,
    whisper,

    getBot,
    getBots,
    getBotTagValues,
    getTag,
    setTag,
};
