import { 
    Object, 
    File, 
    Workspace, 
    DEFAULT_WORKSPACE_SCALE, 
    DEFAULT_WORKSPACE_HEIGHT, 
    DEFAULT_WORKSPACE_GRID_SCALE, 
    DEFAULT_USER_MODE, 
    UserMode,
    SelectionMode,
    DEFAULT_SELECTION_MODE,
    FileShape,
    DEFAULT_FILE_SHAPE,
    FileTags,
    DEFAULT_WORKSPACE_SIZE,
    FileLabelAnchor,
    DEFAULT_LABEL_ANCHOR
} from './File';

import uuid from 'uuid/v4';
import {
    flatMap,
    union,
    keys,
    intersection,
    some,
    assign,
    find,
    values,
    isEqual,
    sortBy,
    cloneDeep
} from 'lodash';
import { Sandbox, SandboxLibrary, SandboxResult } from '../Formulas/Sandbox';
import { isProxy, createFileProxy, proxyObject, SetValueHandler, FileProxy } from './FileProxy';

/// <reference path="../typings/global.d.ts" />
import formulaLib from '../Formulas/formula-lib';
import SandboxInterface, { FilterFunction } from '../Formulas/SandboxInterface';
import { PartialFile } from '../Files';
import { FilesState, cleanFile, hasValue } from './FilesChannel';
import { merge, shortUuid } from '../utils';
import { AuxFile, AuxObject, AuxOp } from '../aux-format';
import { Atom } from '../causal-trees';

export var ShortId_Length: number = 5;

/**
 * The name of the event that represents two files getting combined.
 */
export const COMBINE_ACTION_NAME: string = 'onCombine';

/**
 * The name of the event that represents a file being created.
 */
export const CREATE_ACTION_NAME: string = 'onCreate';

/**
 * The name of the event that represents a file being destroyed.
 */
export const DESTROY_ACTION_NAME: string = 'onDestroy';

/**
 * The name of the event that represents a file being dragged into a context.
 */
export const DROP_IN_CONTEXT_ACTION_NAME: string = 'onDropInContext';

/**
 * The name of the event that represents any file being dragged into a context.
 */
export const DROP_ANY_IN_CONTEXT_ACTION_NAME: string = 'onDropAnyInContext';

/**
 * The name of the event that represents a file being dragged out of a context.
 */
export const DRAG_OUT_OF_CONTEXT_ACTION_NAME: string = 'onDragOutOfContext';

/**
 * The name of the event that represents any file being dragged out of a context.
 */
export const DRAG_ANY_OUT_OF_CONTEXT_ACTION_NAME: string = 'onDragAnyOutOfContext';

/**
 * The name of the event that represents a file being dragged out of the user's inventory.
 */
export const DRAG_OUT_OF_INVENTORY_ACTION_NAME: string = 'onDragOutOfInventory';

/**
 * The name of the event that represents any file being dragged out of the user's inventory.
 */
export const DRAG_ANY_OUT_OF_INVENTORY_ACTION_NAME: string = 'onDragAnyOutOfInventory';

/**
 * The name of the event that represents a file being dropped into the user's inventory.
 */
export const DROP_IN_INVENTORY_ACTION_NAME: string = 'onDropInInventory';

/**
 * The name of the event that represents any file being dropped into the user's inventory.
 */
export const DROP_ANY_IN_INVENTORY_ACTION_NAME: string = 'onDropAnyInInventory';

/**
 * Defines an interface for objects that represent assignment formula expressions.
 * Assignment formula expressions are formulas that are only evaluated once.
 * Internally we store them as objects in the tag and display the calculated result.
 * This way, we can preserve the formula value if needed.
 */
export interface Assignment {
    _assignment: boolean;
    editing: boolean;
    formula: string;
    value?: any;
}

/**
 * Defines an interface for objects that are able to provide the necessary information required to calculate
 * formula values and actions.
 */
export interface FileCalculationContext {

    /**
     * The objects in the context.
     */
    objects: Object[];

    /**
     * The sandbox that should be used to run JS.
     */
    sandbox: Sandbox;
}

export type FilterParseResult = FilterParseSuccess | FilterParseFailure;

export interface FilterParseSuccess {
    success: true;
    eventName: string;
    tag: string;
    filter: {
        tag: string,
        value: any
    };
}

export interface FilterParseFailure {
    success: false;
    partialSuccess: boolean;
    tag: string;
    eventName: string;
}

/**
 * Defines an interface that represents the difference between
 * to FilesState objects.
 */
export interface FilesStateDiff {
    addedFiles: File[];
    removedFiles: string[];
    updatedFiles: File[];
}

/**
 * Determines if the given workspace is currently minimized.
 * @param workspace The workspace.
 */
export function isMinimized(calc: FileCalculationContext, workspace: Workspace) {
    return getContextMinimized(calc, workspace);
}

/**
 * Determines if the given file contains data for a context.
 */
export function isContext(calc: FileCalculationContext, contextFile: File): boolean {
    return getFileConfigContexts(calc, contextFile).length > 0;
}

/**
 * Filters the given list of files by whether they belong to the given selection.
 * @param files The files to filter.
 * @param selectionId The selection to check.
 */
export function filterFilesBySelection(files: Object[], selectionId: string) {
    return files.filter(
        f => {
            if (f.id === selectionId) {
                return true;
            }
            for(let prop in f.tags) {
                const val = f.tags[prop];
                if (prop === selectionId && val) {
                    return true;
                }
            }
            return false;
        });
}

/**
   * Gets a list of tags that the given files contain.
   *
   * @param files The array of files that the list of tags should be retrieved
   * for.
   * @param currentTags The current array of tags that is being displayed.
   *                    The new list will try to preserve the order of the tags
   * in this list.
   * @param extraTags The list of tags that should not be removed from the
   * output list.
   * @param includeHidden Whether the hidden tags should be included in the output.
   */
export function fileTags(files: File[], currentTags: string[], extraTags: string[], includeHidden: boolean = false) {
    const fileTags = flatMap(files, f => keys(f.tags));
    // Only keep tags that don't start with an underscore (_)
    const nonHiddenTags = fileTags.filter(t => includeHidden || !isHiddenTag(t));
    const tagsToKeep = union(nonHiddenTags, extraTags);
    const allTags = union(currentTags, tagsToKeep);

    const onlyTagsToKeep = intersection(allTags, tagsToKeep);

    return onlyTagsToKeep;
}

/**
 * Find files that match the short ids.
 * @param files The files to search through.
 * @param shortIds The short ids to search for.
 * @returns file array or null if no matches found.
 */
export function filesFromShortIds(files: File[] | Object[], shortIds: string[]): File[] {
    var matches: File[] = [];
    shortIds.forEach((shortId) => {
        var file = this.fileFromShortId(files, shortId);
        if (file) matches.push(file);
    });

    if (matches.length > 0) return matches;
    else return null;
}

/**
 * Find file that matches the short id.
 * @param files The files to search through.
 * @param shortId The short id to search for.
 * @returns file or undefined if no match found.
 */
export function fileFromShortId(files: File[] | Object[], shortId: string): File {
    return find(files, (f: File | Object) => { return getShortId(f) === shortId; });
}

/**
 * Return the short id for the file.
 * @param file The file to get short id for.
 */
export function getShortId(file: File | Object): string {
    return file.id.substr(0, ShortId_Length);
}

/**
 * Determines if the given tag is a hidden tag.
 * @param tag The tag to test.
 */
export function isHiddenTag(tag: string): boolean {
    return (/^_/.test(tag) || /(\w+)\._/.test(tag));
}

export function calculateFileValue(context: FileCalculationContext, object: Object, tag: keyof FileTags, unwrapProxy?: boolean) {
    if (tag === 'id') {
        return object.id;
    } else if (isFormulaObject(object)) {
        const o: any = object;
        return o[tag];
    } else {
        return calculateValue(context, object, tag, object.tags[tag], unwrapProxy);
    }
}

export function calculateFormattedFileValue(context: FileCalculationContext, file: Object, tag: string): string {
    const value = calculateFileValue(context, file, tag);
    return _formatValue(value);
}

/**
 * Determines if the given value represents a formula.
 */
export function isFormula(value: unknown): boolean {
    return typeof value === 'string' && value.indexOf('=') === 0;
}

/**
 * Determines if the given value represents an assignment.
 */
export function isAssignment(object: any): any {
    return typeof object === 'object' && object && !!object._assignment;
}

/**
 * Determines if the given value contains a formula.
 * This is different from isFormula() because it checks arrays for containing formulas in their elements.
 * @param value The value to check.
 */
export function containsFormula(value: string): boolean {
    return isFormula(value) || (isArray(value) && some(parseArray(value), v => isFormula(v)));
}

/**
 * Determines if the given string value represents an array.
 */
export function isArray(value: unknown): boolean {
    return typeof value === 'string' && value.indexOf('[') === 0 && value.lastIndexOf(']') === value.length - 1;
}

/**
 * Parses the given string value that represents an array into an actual array.
 * @see isArray
 */
export function parseArray(value: string): string[] {
    var array: string[] = value.slice(1, value.length - 1).split(',');
    if (array && array.length > 0 && array[0].length > 0) { 
        // trim all entries.
        return array.map((s) => { return s.trim(); });
    } else {
        return [];
    }
}

/**
 * Determines if the given value represents a number.
 */
export function isNumber(value: string): boolean {
    return (/^-?\d+\.?\d*$/).test(value) || (typeof value === 'string' && 'infinity' === value.toLowerCase());
}

/**
 * Determines whether the given object is a proxy object.
 * @param object The object.
 */
export function isFormulaObject(object: any): object is FileProxy {
    return object[isProxy];
}

/**
 * Unwraps the given object if it is in a proxy.
 * @param object The object to unwrap.
 */
export function unwrapProxy(object: any): any {
    if (typeof object === 'undefined' || object === null) {
        return object;
    }
    if (isFormulaObject(object)) {
        return object[proxyObject];
    } else {
        return object;
    }
}

/**
 * Determines if the given object is a file.
 * @param object The object to check.
 */
export function isFile(object: any): object is AuxObject {
    return !!object && !!object.id && !!object.tags;
}

/**
 * Gets the array of objects in the given state that are currently active.
 * @param state The state to get the active objects of.
 */
export function getActiveObjects(state: FilesState) {
    return <Object[]>values(state);
}

/**
 * Determines if the given tag matches the filter syntax.
 */
export function isFilterTag(tag: string) {
    const parsed = parseFilterTag(tag);
    return parsed.success;
}

export const WELL_KNOWN_TAGS = [
    /_hidden$/,
    /\.index$/,
    /_lastEditedBy/,
    /\._lastActiveTime/,
    /^aux\._context_/,
    /^context_/,
];

/**
 * Determines if the given tag is "well known".
 * @param tag The tag.
 * @param includeSelectionTags Whether to include selection tags.
 */
export function isTagWellKnown(tag: string, includeSelectionTags: boolean = true): boolean {
    for (let i = 0; i < WELL_KNOWN_TAGS.length; i++) {
        if (WELL_KNOWN_TAGS[i].test(tag)) {
            return true;
        }
    }

    if (includeSelectionTags && tag.indexOf('aux._selection_') === 0) {
        return true;
    }

    return false;
}

/**
 * Determines if the files are equal disregarding well-known hidden tags
 * and their IDs. File "appearance equality" means instead of asking "are these files exactly the same?"
 * we ask "are these files functionally the same?". In this respect we care about things like color, label, etc.
 * We also care about things like aux.movable but not _position, _index _selection, etc.
 * 
 * Well-known hidden tags include:
 * - _position
 * - _hidden
 * - _selection
 * - _index
 * 
 * You can determine if a tag is "well-known" by using isWellKnownTag().
 * @param first The first file.
 * @param second The second file.
 */
export function doFilesAppearEqual(first: Object, second: Object, options: FileAppearanceEqualityOptions = {}): boolean {
    if (first === second) {
        return true;
    } else if(!first || !second) {
        return false;
    }

    options = merge({
        ignoreSelectionTags: true,
        ignoreId: false
    }, options);

    if (!options.ignoreId && first.id === second.id) {
        return true;
    }

    const tags = union(keys(first.tags), keys(second.tags));
    const usableTags = tags.filter(t => !isTagWellKnown(t, options.ignoreSelectionTags));

    let allEqual = true;
    for (let t of usableTags) {
        if(!isEqual(first.tags[t], second.tags[t])) {
            allEqual = false;
            break;
        }
    }

    return allEqual;
}

export interface FileAppearanceEqualityOptions {
    ignoreSelectionTags?: boolean;
    ignoreId?: boolean;
}

/**
 * Defines an interface that represents the result of validating a tag.
 */
export interface TagValidation {
    valid: boolean;
    'tag.required'?: TagRequired;
    'tag.invalidChar'?: TagInvalidChar;
}

export interface TagRequired {

}

export interface TagInvalidChar {
    char: string;
}

/**
 * Validates the given tag and returns any errors for it.
 * @param tag The tag.
 */
export function validateTag(tag: string) {
    let errors: TagValidation = {
        valid: true
    };
    if (!tag || !tag.trim()) {
        errors.valid = false;
        errors['tag.required'] = {};
    } else {
        const filter = parseFilterTag(tag);
        if(!(filter.success || (filter.success === false && filter.partialSuccess)) && tag.indexOf('#') >= 0) {
            errors.valid = false;
            errors['tag.invalidChar'] = { char: '#' };
        }
    }

    return errors;
}

/**
 * Gets the ID of the selection that the user is using.
 * If the user doesn't have a selection, returns a new selection ID.
 * @param user The user's file.
 */
export function selectionIdForUser(user: Object) {
    if (user && user.tags._selection) {
        return { id: user.tags._selection || null, newId: <string>null };
    } else {
        const id = newSelectionId();
        return { id: id, newId: id };
    }
}

/**
 * Gets a partial file that updates a user's file to reference the given selection.
 * @param selectionId The ID of the selection.
 * @param fileId The ID of the file that is being selected.
 */
export function updateUserSelection(selectionId: string, fileId: string) {
    return {
        tags: {
            _selection: selectionId,
            _editingFile: fileId
        }
    };
}

/**
 * Gets a partial file that toggles whether the given file is apart of the given selection.
 * @param file The file.
 * @param selectionId The ID of the selection.
 * @param userId The User that is adding the file to the selection.
 */
export function toggleFileSelection(file: Object, selectionId: string, userId: string) {
    return {
        tags: {
            [selectionId]: !(file.tags[selectionId]),
        }
    };
}

/**
 * Creates a new selection id.
 */
export function newSelectionId() {
    return `aux._selection_${shortUuid()}`;
}

/**
 * Gets the menu ID that is used for the given user.
 * @param userFile The file for the user.
 */
export function getUserMenuId(calc: FileCalculationContext, userFile: File) {
    return calculateFileValue(calc, userFile, '_userMenuContext');
}

/**
 * Gets the list of files that are in the user's menu.
 * @param calc The file calculation context.
 * @param userFile The user file to use.
 */
export function getFilesInMenu(calc: FileCalculationContext, userFile: File): File[] {
    const context = getUserMenuId(calc, userFile);
    return filesInContext(calc, context);
}

/**
 * Gets the list of files that are in the given context.
 * @param calc The file calculation context.
 * @param context The context to search for files in.
 */
export function filesInContext(calc: FileCalculationContext, context: string): File[] {
    const files = calc.objects.filter(f => isFileInContext(calc, f, context));
    return sortBy(files, f => fileContextSortOrder(calc, f, context));
}

/**
 * Gets a diff that adds a file to the given context.
 * If the file is already in the context, then nothing happens.
 * If other files are already at the given position, then the file will be placed at the topmost index.
 * @param calc The file calculation context.
 * @param context The context that the file should be added to.
 * @param x The x position that the file should be placed at.
 * @param y The x position in the context that the file should be placed at.
 * @param index The index that the file should be placed at.
 */
export function addToContextDiff(calc: FileCalculationContext, context: string, x: number = 0, y: number = 0, index?: number): FileTags {
    const files = objectsAtContextGridPosition(calc, context, { x, y });
    return {
        [context]: true,
        ...setPositionDiff(calc, context, x, y, typeof index === 'undefined' ? files.length : index)
    };
}

/**
 * Gets a diff that removes a file from the given context.
 * @param calc The file calculation context.
 * @param context The context that the file should be removed from.
 */
export function removeFromContextDiff(calc: FileCalculationContext, context: string): FileTags {
    return {
        [context]: null,
        [`${context}.x`]: null,
        [`${context}.y`]: null,
        [`${context}.index`]: null
    };
}

/**
 * Gets a diff that sets a file's position in the given context.
 * @param calc The file calculation context.
 * @param context The context.
 * @param x The X position.
 * @param y The Y position.
 * @param index The index.
 */
export function setPositionDiff(calc: FileCalculationContext, context: string, x?: number, y?: number, index?: number): FileTags {
    let tags: FileTags = {};
    if (typeof x === 'number') {
        tags[`${context}.x`] = x;
    }
    if (typeof y === 'number') {
        tags[`${context}.y`] = y;
    }
    if (typeof index === 'number') {
        tags[`${context}.index`] = index;
    }
    return tags;
}

/**
 * Gets the file update needed to add the given file to the given user's menu.
 * @param calc The calculation context.
 * @param userFile The file of the user.
 * @param id The ID that should be used for the menu item. This is separate from file ID.
 * @param index The index that the file should be added to. Positive infinity means add at the end. 0 means add at the beginning.
 */
export function addFileToMenu(calc: FileCalculationContext, userFile: File, id: string, index: number = Infinity): PartialFile {
    const context = getUserMenuId(calc, userFile);
    const files = getFilesInMenu(calc, userFile);
    const idx = isFinite(index) ? index : files.length;
    return {
        tags: {
            [`${context}.id`]: id,
            [`${context}.index`]: idx,
            [context]: true
        }
    };
}

/**
 * Gets the file update needed to remove a file from the given user's menu.
 * @param calc The file calculation context.
 * @param userFile The file of the user.
 */
export function removeFileFromMenu(calc: FileCalculationContext, userFile: File): PartialFile {
    const context = getUserMenuId(calc, userFile);
    return {
        tags: {
            [context]: null,
            [`${context}.id`]: null,
            [`${context}.index`]: null
        }
    };
}


/**
 * Gets the list of tags that are on the given file.
 * @param file 
 */
export function tagsOnFile(file: PartialFile): string[] {
    let tags = keys(file.tags);
    return tags;
}

/**
 * Gets the specified tag value from the specified file.
 * @param file The file that the tag should be retrieved from.
 * @param tag The tag to retrieve.
 */
export function getTag(file: PartialFile, tag: string) {
    return file.tags[tag];
}

/**
 * Gets the specified tag from the specified file.
 * @param file The file that the tag should be retrieved from.
 * @param tag The tag to retrieve.
 */
export function getFileTag(file: File, tag: string) {
    return getTag(file, tag);
}

/**
 * Creates a new context ID.
 */
export function createContextId() {
    return `context_${shortUuid()}`;
}

/**
 * Creates a file with a new ID and the given tags.
 * @param id 
 * @param tags 
 */
export function createFile(id = uuid(), tags: Object['tags'] = {}) {
    const file: File = {id: id, tags: tags};

    return file;
}

/**
 * Creates a new Workspace with default values.
 * @param id The ID of the new workspace.
 * @param builderContextId The tag that should be used for contexts stored on this workspace.
 */
export function createWorkspace(id = uuid(), builderContextId: string = createContextId(), contextType: unknown = '=isBuilder'): Workspace {
    
    // checks if given context string is empty or just whitespace
    if(builderContextId.length === 0 || /^\s*$/.test(builderContextId)){
        builderContextId = createContextId();
    }

    

    return {
        id: id,
        tags: {
            'aux.context.x': 0,
            'aux.context.y': 0,
            'aux.context.z': 0,
            [builderContextId]: true,
            [`${builderContextId}.config`]: contextType,
            [`${builderContextId}.x`]: 0,
            [`${builderContextId}.y`]: 0,
            [`${builderContextId}.z`]: 0,
            'aux.color': 'clear',
            'aux.stroke.color': '#777',
            'aux.movable': false,
            'aux.scale.z': 0.01
        }
    };
}

/**
 * Performs a pre-process step for updating the given file by nulling out falsy tags and also calculating assignments.
 * @param file The file to update.
 * @param userId The ID of the file whose user edited this file.
 * @param newData The new data to assign to the file.
 * @param createContext A function that, when called, returns a new FileCalculationContext that can be used to calculate formulas for assignment expressions.
 */
export function updateFile(file: File, userId: string, newData: PartialFile, createContext: () => FileCalculationContext) {
    if (newData.tags) {
        newData.tags._lastEditedBy = userId;
        // Cleanup/preprocessing
        for (let property in newData.tags) {
            let value = newData.tags[property];
            if (value) {
                if (_isAssignmentFormula(value)) {
                    const assignment = _convertToAssignment(value);
                    const result = _calculateFormulaValue(createContext(), file, property, assignment.formula);
                    newData.tags[property] = assign(assignment, { value: result.result });
                }
            }
        }
    }
}

/**
 * Calculates the grid scale for the given workspace.
 * @param workspace 
 */
export function calculateGridScale(calc: FileCalculationContext, workspace: AuxFile): number {
    if (workspace) {
        const scale = calculateNumericalTagValue(calc, workspace, `aux.context.scale`, DEFAULT_WORKSPACE_SCALE);
        const gridScale =  calculateNumericalTagValue(calc, workspace, `aux.context.grid.scale`, DEFAULT_WORKSPACE_GRID_SCALE);
        return scale * gridScale;
    } else {
        return DEFAULT_WORKSPACE_SCALE * DEFAULT_WORKSPACE_GRID_SCALE;
    }
}

/**
 * Calculates the difference between the two given states.
 * In particular, it calculates which operations need to be performed on prev in order to get current.
 * The returned object contains the files that were added, removed, and/or updated between the two states.
 * This operation runs in O(n) time where n is the number of files.
 * @param prev The previous state.
 * @param current The current state.
 * @param events If provided, this event will be used to help short-circut the diff calculation to be O(1) whenever the event is a 'file_added', 'file_removed', or 'file_updated' event.
 */
export function calculateStateDiff(prev: FilesState, current: FilesState, events?: Atom<AuxOp>[]): FilesStateDiff {

    prev = prev || {};
    current = current || {};

    // TODO:
    // if (events && events.length === 1) {
    //     const event = events[0];
    //     if (event.atom.value.type === AuxOpType.file) {
    //         return {
    //             prev: prev,
    //             current: current,
    //             addedFiles: [current[event.id]],
    //             removedFiles: [],
    //             updatedFiles: []
    //         };
    //     } else if(event.type === 'file_removed') {
    //         return {
    //             prev: prev,
    //             current: current,
    //             addedFiles: [],
    //             removedFiles: [prev[event.id]],
    //             updatedFiles: []
    //         };
    //     } else if(event.type === 'file_updated') {
    //         return {
    //             prev: prev,
    //             current: current,
    //             addedFiles: [],
    //             removedFiles: [],
    //             updatedFiles: [current[event.id]]
    //         };
    //     }
    // }

    let diff: FilesStateDiff = {
        addedFiles: [],
        removedFiles: [],
        updatedFiles: []
    };

    const ids = union(keys(prev), keys(current));

    ids.forEach(id => {
        const prevVal = prev[id];
        const currVal = current[id];
        
        if (prevVal && !currVal) {
            diff.removedFiles.push(prevVal.id);
        } else if(!prevVal && currVal) {
            diff.addedFiles.push(currVal);
        } else if(!isEqual(prevVal, currVal)) {
            diff.updatedFiles.push(currVal);
        }
    });

    return diff;
}

/**
 * Creates a new object that contains the tags that the given object has
 * and is usable in a formula.
 */
export function convertToFormulaObject(context: FileCalculationContext, object: File, setValue?: SetValueHandler) {
    if (isFormulaObject(object)) {
        return object;
    }
    return createFileProxy(context, object, setValue);
}

/**
 * Creates a new file calculation context from the given files state.
 * @param state The state to use.
 * @param includeDestroyed Whether to include destroyed files in the context.
 */
export function createCalculationContextFromState(state: FilesState, includeDestroyed: boolean = false) {
    const objects = includeDestroyed ? values(state) : getActiveObjects(state);
    return createCalculationContext(objects);
}

/**
 * Creates a new file calculation context.
 * @param objects The objects that should be included in the context.
 * @param lib The library JavaScript that should be used.
 */
export function createCalculationContext(objects: Object[], lib: SandboxLibrary = formulaLib, setValueHandlerFactory?: (file: File) => SetValueHandler): FileCalculationContext {
    const context = {
        sandbox: new Sandbox(lib),
        objects: objects
    };
    context.sandbox.interface = new SandboxInterfaceImpl(context, setValueHandlerFactory);
    return context;
}

/**
 * Gets a list of tags from the given object that match the given event name and arguments.
 * @param file The file to find the tags that match the arguments.
 * @param eventName The event name to test.
 * @param other The arguments to match against.
 */
export function filtersMatchingArguments(context: FileCalculationContext, file: Object, eventName: string, args: any[]): FilterParseResult[] {
    const tags = keys(file.tags);
    return tags.map(t => parseFilterTag(t))
        .filter(t => filterMatchesArguments(context, t, eventName, args));
}

/**
 * Determines if the given tag matches the given object and event.
 * @param tag The tag.
 * @param file The file to test.
 * @param eventName The event to test for.
 */
export function filterMatchesArguments(context: FileCalculationContext, filter: FilterParseResult, eventName: string, args: any[]): boolean {
    if(filter.success && filter.eventName === eventName) {
        if (!!filter.filter) {
            const arg = args.length > 0 ? args[0] : null;
            if (arg) {
                const calculatedValue = calculateFileValue(context, arg, filter.filter.tag);
                return calculatedValue === filter.filter.value ||
                    (Array.isArray(filter.filter.value) && isEqual(arg.tags[filter.filter.tag], filter.filter.value))
            } else {
                return false;
            }

        } else {
            return true;
        }
    }
    return false;
}

/**
 * Gets the index that the given file is at in the given context.
 * @param calc The calculation context to use.
 * @param file The file.
 * @param workspaceId The context.
 */
export function getFileIndex(calc: FileCalculationContext, file: File, context: string): number {
    return calculateNumericalTagValue(calc, file, `${context}.index`, 0);
}

/**
 * Gets the position that the given file is at in the given context.
 * @param calc The calculation context to use.
 * @param file The file.
 * @param context The context.
 */
export function getFilePosition(calc: FileCalculationContext, file: File, context: string): { x: number, y: number, z: number} {
    return {
        x: calculateNumericalTagValue(calc, file, `${context}.x`, 0),
        y: calculateNumericalTagValue(calc, file, `${context}.y`, 0),
        z: calculateNumericalTagValue(calc, file, `${context}.z`, 0)
    };
}


/**
 * Gets the rotation that the given file is at in the given context.
 * @param calc The calculation context to use.
 * @param file The file.
 * @param context The context.
 */
export function getFileRotation(calc: FileCalculationContext, file: File, context: string): { x: number, y: number, z: number} {
    return {
        x: calculateNumericalTagValue(calc, file, `${context}.rotation.x`, 0),
        y: calculateNumericalTagValue(calc, file, `${context}.rotation.y`, 0),
        z: calculateNumericalTagValue(calc, file, `${context}.rotation.z`, 0)
    };
}

/**
 * Gets the file that the given file is using as the input target.
 * @param calc The file calculation context.
 * @param file The file.
 */
export function getFileInputTarget(calc: FileCalculationContext, file: AuxFile): AuxFile {
    return calculateFileValueAsFile(calc, file, 'aux.input.target', file);
}

/**
 * Gets the placeholder to use for a file's input box.
 * @param calc The file calculation context.
 * @param file The file.
 */
export function getFileInputPlaceholder(calc: FileCalculationContext, file: AuxFile): string {
    return calculateFormattedFileValue(calc, file, 'aux.input.placeholder');
}

/**
 * Gets the shape of the file.
 * @param calc The calculation context to use.
 * @param file The file.
 */
export function getFileShape(calc: FileCalculationContext, file: File): FileShape {
    const shape: FileShape = calculateFileValue(calc, file, 'aux.shape');
    if (shape === 'cube' || shape === 'sphere' || shape === 'sprite') {
        return shape;
    }
    return DEFAULT_FILE_SHAPE;
}

/**
 * Gets the anchor position for the file's label.
 * @param calc The calculation context to use.
 * @param file The file.
 */
export function getFileLabelAnchor(calc: FileCalculationContext, file: File): FileLabelAnchor {
    const anchor: FileLabelAnchor = calculateFileValue(calc, file, 'aux.label.anchor');
    if (anchor === 'back' || anchor === 'floating' || anchor === 'front' || anchor === 'left' || anchor === 'right' || anchor === 'top') {
        return anchor;
    }
    return DEFAULT_LABEL_ANCHOR;
}

/**
 * Determines if the given tag represents a context config.
 * @param tag The tag to check.
 */
export function isConfigTag(tag: string): boolean {
    if (tag.length <= '.config'.length) {
        return false;
    }
    return /\.config$/g.test(tag);
}

/**
 * Gets the name of the context that this tag is the config for.
 * If the tag is not a config tag, then returns null.
 * @param tag The tag to check.
 */
export function getConfigTagContext(tag: string): string {
    if (isConfigTag(tag)) {
        return tag.substr(0, tag.length - '.config'.length);
    }
    return null;
}

/**
 * Gets the list of contexts that the given file is a config file for.
 * @param calc The calculation context.
 * @param file The file that represents the context.
 */
export function getFileConfigContexts(calc: FileCalculationContext, file: File): string[] {
    const tags = tagsOnFile(file);
    return tags.filter(t => {
        return isConfigTag(t) && calculateBooleanTagValue(calc, file, t, false);
    }).map(t => getConfigTagContext(t));
}

/**
 * Gets a value from the given context file.
 * @param calc The calculation context.
 * @param contextFile The file that represents the context.
 * @param name The name of the value to get.
 */
export function getContextValue(calc: FileCalculationContext, contextFile: File, name: string): any {
    return calculateFileValue(calc, contextFile, `aux.context.${name}`);
}

/**
 * Gets whether the given file is stackable.
 * @param calc The calculation context.
 * @param file The file to check.
 */
export function isFileStackable(calc: FileCalculationContext, file: File): boolean {
    return calculateBooleanTagValue(calc, file, 'aux.stackable', true);
}

/**
 * Gets whether the given file is movable.
 * @param calc The calculation context.
 * @param file The file to check.
 */
export function isFileMovable(calc: FileCalculationContext, file: File): boolean {
    return calculateBooleanTagValue(calc, file, 'aux.movable', true);
}

/**
 * Gets the position that the context should be at using the given file.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextPosition(calc: FileCalculationContext, contextFile: File): { x: number, y: number, z: number } {
    return {
        x: calculateNumericalTagValue(calc, contextFile, `aux.context.x`, 0),
        y: calculateNumericalTagValue(calc, contextFile, `aux.context.y`, 0),
        z: calculateNumericalTagValue(calc, contextFile, `aux.context.z`, 0)
    };
}

/**
 * Gets whether the context is minimized.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextMinimized(calc: FileCalculationContext, contextFile: File): boolean {
    return getContextValue(calc, contextFile, 'minimized');
}

/**
 * Gets the color of the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextColor(calc: FileCalculationContext, contextFile: File): string {
    return getContextValue(calc, contextFile, 'color');
}

/**
 * Gets the size of the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextSize(calc: FileCalculationContext, contextFile: File): number {
    return calculateNumericalTagValue(calc, contextFile, `aux.context.size`, isUserFile(contextFile) ? 0 : DEFAULT_WORKSPACE_SIZE);
}

/**
 * Gets the grid of the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getBuilderContextGrid(calc: FileCalculationContext, contextFile: File): File['tags']['aux.builder.context.grid'] {
    return getContextValue(calc, contextFile, 'grid');
}

/**
 * Gets the height of the specified grid on the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 * @param key The key for the grid position to lookup in the context grid.
 */
export function getContextGridHeight(calc: FileCalculationContext, contextFile: File, key: string): number {
    let contextGrid = getContextValue(calc, contextFile, 'grid');
    if (contextGrid && contextGrid[key]) {
        if (contextGrid[key].height) {
            return contextGrid[key].height;
        }
    }

    return DEFAULT_WORKSPACE_HEIGHT;
}


/**
 * Gets the grid scale of the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextGridScale(calc: FileCalculationContext, contextFile: File): number {
    return getContextValue(calc, contextFile, 'grid.scale');
}

/**
 * Gets the scale of the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextScale(calc: FileCalculationContext, contextFile: File): number {
    return getContextValue(calc, contextFile, 'scale') || DEFAULT_WORKSPACE_SCALE;
}

/**
 * Gets the default height of the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextDefaultHeight(calc: FileCalculationContext, contextFile: File): number {
    return getContextValue(calc, contextFile, 'defaultHeight');
}

/**
 * Filters the given list of objects to those matching the given workspace ID and grid position.
 * The returned list is in the order of their indexes.
 * @param calc The file calculation context to use.
 * @param context The ID of the context that the objects need to be on.
 * @param position The position that the objects need to be at.
 */
export function objectsAtContextGridPosition(calc: FileCalculationContext, context: string, position: { x: number, y: number }): File[] {
    const objects = calc.objects;
    return <File[]>sortBy(objects.filter(o => {
        if (!isUserFile(o) && isFileInContext(calc, o, context)) {
            const pos = getFilePosition(calc, o, context);
            return pos && 
                position.x === pos.x &&
                position.y === pos.y;
        }
        return false;
    }), o => getFileIndex(calc, o, context));
}

/**
 * Determines if the given file is for a user.
 */
export function isUserFile(file: File): boolean {
    return !!file.tags._user;
}

/**
 * Filters the given list of objects to those that are assigned to the given workspace ID.
 * @param objects The objects to filter.
 * @param workspaceId The ID of the workspace that the objects need to be on,
 */
export function objectsAtWorkspace(objects: Object[], workspaceId: string) {
    return objects.filter(o => {
        return o.tags._workspace === workspaceId;
    });
}

/**
 * Duplicates the given file and returns a new file with a new ID but the same tags.
 * The file will be exactly the same as the previous except for 3 things.
 * First, it will have a different ID.
 * Second, it will never be marked as destroyed.
 * Third, it will not have any well known tags. (see isTagWellKnown())
 * @param file The file to duplicate.
 * @param data The optional data that should override the existing file data.
 */
export function duplicateFile(file: Object, data?: PartialFile): Object {
    let copy = cloneDeep(file);
    const tags = tagsOnFile(copy);
    const tagsToRemove = tags.filter(t => isTagWellKnown(t));
    tagsToRemove.forEach(t => {
        delete copy.tags[t];
    });

    let newFile = merge(copy, data || {});
    newFile.id = uuid();

    return <Object>cleanFile(newFile);
}

/**
 * Determines if the given file represents a diff.
 * @param file The file to check.
 */
export function isDiff(file: File): boolean {
    return !!file && !!file.tags['aux._diff'] && !!file.tags['aux._diffTags'];
}

/**
 * Determines if the given file allows for merging.
 * @param file The file to check.
 */
export function isMergeable(calc: FileCalculationContext, file: File): boolean {
    return !!file && calculateBooleanTagValue(calc, file, 'aux.mergeable', true);
}

/**
 * Gets a partial file that can be used to apply the diff that the given file represents.
 * A diff file is any file that has `aux._diff` set to `true` and `aux._diffTags` set to a list of tag names.
 * @param file The file that represents the diff.
 */
export function getDiffUpdate(file: File): PartialFile {
    if (isDiff(file)) {
        let update: PartialFile = {
            tags: {}
        };

        let tags = tagsOnFile(file);
        let diffTags = file.tags['aux._diffTags'];
        for (let i = 0; i < tags.length; i++) {
            let tag = tags[i];
            if (tag === 'aux._diff' || tag === 'aux._diffTags' || diffTags.indexOf(tag) < 0) {
                continue;
            }

            let val = file.tags[tag];
            if (hasValue(val)) {
                update.tags[tag] = val;
            }
        }

        return update;
    }
    return null;
}

/**
 * Parses the given tag filter into its components.
 * @param tag 
 */
export function parseFilterTag(tag: string): FilterParseResult {
    const firstParenIndex = tag.indexOf('(');
    const tagIndex = tag.indexOf('#');
    if (firstParenIndex > 0 && (tagIndex > firstParenIndex || tagIndex < 0)) {
        const eventName = tag.slice(0, firstParenIndex).trim();
        
        if (eventName) {
            const colonIndex = tag.indexOf(':');
            if (colonIndex > tagIndex){
                const tagName = tag.slice(tagIndex + 1, colonIndex).trim();
                if (tagName && tagIndex > 0) {
                    let firstQuote = tag.indexOf('"');
                    if (firstQuote < 0) {
                        firstQuote = colonIndex;
                    }
                    let lastQuote = tag.lastIndexOf('"');
                    if (lastQuote < 0) {
                        lastQuote = tag.lastIndexOf(')');
                        if (lastQuote < 0) {
                            lastQuote = tag.length;
                        }
                    } else if(lastQuote === firstQuote) {
                        lastQuote = tag.length;
                    }
                    const value = tag.slice(firstQuote + 1, lastQuote);
                    const finalValue = _parseFilterValue(value);
                    return {
                        success: true,
                        eventName: eventName,
                        tag: tag,
                        filter: {
                            tag: tagName,
                            value: finalValue
                        }
                    };
                }
            }

            let lastParen = tag.lastIndexOf(')');
            if (lastParen > firstParenIndex) {
                let between = tag.slice(firstParenIndex + 1, lastParen);
                // Only whitespace is allowed
                if (/^\s*$/.test(between)) {
                    return {
                        success: true,
                        eventName: eventName,
                        tag: tag,
                        filter: null
                    };
                }
            }
                
            return {
                success: false,
                partialSuccess: true,
                tag: tag,
                eventName: eventName,
            };
        }
    }
    return {
        success: false,
        partialSuccess: false,
        tag: tag,
        eventName: null
    };
}

/**
 * Gets the user mode value from the given file.
 * @param object The file.
 */
export function getUserMode(object: Object): UserMode {
    return object.tags._mode || DEFAULT_USER_MODE;
}

/**
 * Gets the user selection mode value from the given file.
 * @param file The file.
 */
export function getSelectionMode(file: File): SelectionMode {
    return file.tags['aux._selectionMode'] || DEFAULT_SELECTION_MODE;
}

/**
 * Calculates the value of the given tag on the given file. If the result is not a file, then the given default value
 * is returned.
 * @param context The context.
 * @param file The file.
 * @param tag The tag.
 * @param defaultValue The default value to use if the tag doesn't exist or the result is not a file.
 */
export function calculateFileValueAsFile(context: FileCalculationContext, file: File, tag: string, defaultValue: AuxFile): AuxFile {
    if(file.tags[tag]) {
        const result = calculateFileValue(context, file, tag);
        if (isFile(result)) {
            return result;
        }
    }
    return defaultValue;
}

/**
 * Calculates the value of the given tag on the given file. If the result is not a number, then the given default value
 * is returned.
 * @param fileManager The file manager.
 * @param file The file.
 * @param tag The tag.
 * @param defaultValue The default value to use if the tag doesn't exist or the result is not a number.
 */
export function calculateNumericalTagValue(context: FileCalculationContext, file: Object, tag: string, defaultValue: number): number {
    if (file.tags[tag]) {
        const result = calculateFileValue(context, file, tag);
        if (typeof result === 'number' && result !== null) {
            return result;
        }
    }
    return defaultValue
}

/**
 * Calculates the value of the given tag on the given file. If the result is not a boolean, then the given default value is returned.
 * @param context The context.
 * @param file The file.
 * @param tag The tag.
 * @param defaultValue The default value to use.
 */
export function calculateBooleanTagValue(context: FileCalculationContext, file: Object, tag: string, defaultValue: boolean): boolean {
    if (typeof file.tags[tag] !== 'undefined') {
        const result = calculateFileValue(context, file, tag);
        if (typeof result === 'boolean' && result !== null) {
            return result;
        }
    }
    return defaultValue
}

/**
 * Returns wether or not the given file resides in the given context id.
 * @param context The file calculation context to run formulas with.
 * @param file The file.
 * @param contextId The id of the context that we are asking if the file is in.
 */
export function isFileInContext(context: FileCalculationContext, file: Object, contextId: string): boolean {
    if (!contextId) return false;

    let result: boolean;
    const contextValue = calculateFileValue(context, file, contextId);

    if (typeof contextValue === 'string') {
        result = (contextValue === 'true');
    } else if (typeof contextValue === 'number') {
        result = true;
    } else {
        result = (contextValue === true);
    }

    if (!result && hasValue(file.tags._user)) {
        const userContextValue = calculateFileValue(context, file, '_userContext');
        result = (userContextValue == contextId);
    }

    return result;
}

/**
 * Gets the sort order that the given file should appear in the given context.
 * @param context The file calculation context.
 * @param file The file.
 * @param contextId The ID of the context that we're getting the sort order for.
 */
export function fileContextSortOrder(context: FileCalculationContext, file: File, contextId: string): number | string {
    if (!contextId) return NaN;

    const contextValue = calculateFileValue(context, file, `${contextId}.index`);
    if (typeof contextValue === 'string') {
        return contextValue;
    } else if(typeof contextValue === 'number') {
        return contextValue;
    } else {
        return 0;
    }
}

/**
 * Executes the given formula on the given file state and returns the results.
 * @param formula The formula to run.
 * @param state The file state to use.
 * @param options The options.
 */
export function searchFileState(formula: string, state: FilesState, { includeDestroyed }: { includeDestroyed?: boolean } = {}) {
    includeDestroyed = includeDestroyed || false;
    const context = createCalculationContextFromState(state, includeDestroyed);
    const result = calculateFormulaValue(context, formula);
    return result;
}

/**
 * Calculates the given formula and returns the result.
 * @param context The file calculation context to run formulas with.
 * @param formula The formula to use.
 * @param extras The extra data to include in callbacks to the interface implementation.
 * @param thisObj The object that should be used for the this keyword in the formula.
 * @param unwrapProxy Whether the proxy objects should be unwrapped before being returned. (plumbing command, only use if you know what you're doing)
 */
export function calculateFormulaValue(context: FileCalculationContext, formula: string, extras: any = {}, thisObj: any = null, unwrapProxy: boolean = true) {
    const result = context.sandbox.run(formula, extras, context);

    if (unwrapProxy) {
        return _unwrapProxy(result);
    } else {
        return result;
    }
}

function _parseFilterValue(value: string): any {
    if (isArray(value)) {
        const split = parseArray(value);
        return split.map(v => _parseFilterValue(v));
    } else if(isNumber(value)) {
        return parseFloat(value);
    } else if(value === 'true') {
        return true;
    } else if(value === 'false') {
        return false;
    } else {
        return value;
    }
}

function _convertToAssignment(object: any): Assignment {
    if (isAssignment(object)) {
        return object;
    }

    return {
        _assignment: true,
        editing: true,
        formula: object,
    };
}

/**
 * Determines if the given value is an assignment expression or an assignment object.
 */
function _isAssignmentFormula(value: any): boolean {
    if(typeof value === 'string') {
        return value.indexOf(':') === 0 && value.indexOf('=') === 1;
    } else {
        return isAssignment(value);
    }
}

function _formatValue(value: any): string {
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            return `[${value.map(v => _formatValue(v)).join(',')}]`;
        } else {
            if (value.id) {
                return getShortId(value);
            } else {
                return JSON.stringify(value);
            }
        }
    } else if(typeof value !== 'undefined' && value !== null) {
        return value.toString();
    } else {
        return value;
    }
}

/**
 * Calculates the value of the given formula as if it was on the given file (object) and tag.
 * @param context The calculation context to use.
 * @param object The file that the formula was from.
 * @param tag The tag that the formula was from.
 * @param formula The formula.
 * @param unwrapProxy (Optional) Whether to unwrap proxies. Defaults to true.
 */
export function calculateValue(context: FileCalculationContext, object: any, tag: keyof FileTags, formula: string, unwrapProxy?: boolean): any {
    if (isFormula(formula)) {
        const result = _calculateFormulaValue(context, object, tag, formula, unwrapProxy);
        if (result.success) {
            return result.result;
        } else {
            return result.extras.formula;
        }
    } else if (isAssignment(formula)) {
        const obj: Assignment = <any>formula;
        return obj.value;
    } else if(isArray(formula)) {
        const split = parseArray(formula);
        return split.map(s => calculateValue(context, object, tag, s.trim(), unwrapProxy));
    } else if(isNumber(formula)) {
        return parseFloat(formula);
    } else if(formula === 'true') {
        return true;
    } else if(formula === 'false') {
        return false;
    } else {
        return formula;
    }
}

function _calculateFormulaValue(context: FileCalculationContext, object: any, tag: keyof FileTags, formula: string, unwrapProxy: boolean = true) {
    const result = context.sandbox.run(formula, {
        formula,
        tag,
        context
    }, convertToFormulaObject(context, object));

    if (unwrapProxy) {
        // Unwrap the proxy object
        return _unwrapProxy(result);
    } else {
        return result;
    }
}

function _unwrapProxy<T>(result: SandboxResult<T>): SandboxResult<T> {
    // Unwrap the proxy object
    if (result.success && result.result) {
        if (result.result[isProxy]) {
            return {
                ...result,
                result: result.result[proxyObject]
            };
        } else if (Array.isArray(result.result)) {
            return {
                ...result,
                result: result.result.map(v => {
                    if (v && v[isProxy]) {
                        return v[proxyObject];
                    } else {
                        return v
                    }
                })
            };
        }
    }

    return result;
}

function _singleOrArray<T>(values: T[]) {
    if(values.length === 1) {
        return values[0];
    } else {
        return values;
    }
}


class SandboxInterfaceImpl implements SandboxInterface {
  
    objects: Object[];
    context: FileCalculationContext;
    setValueHandlerFactory: (file: File) => SetValueHandler;
    proxies: Map<string, FileProxy>;

    constructor(context: FileCalculationContext, setValueHandlerFactory?: (file: File) => SetValueHandler) {
      this.objects = context.objects;
      this.context = context;
      this.proxies = new Map();
      this.setValueHandlerFactory = setValueHandlerFactory
    }

    /**
     * Adds the given file to the calculation context and returns a proxy for it.
     * @param file The file to add.
     */
    addFile(file: File): FileProxy {
        if (this.proxies.has(file.id)) {
            return this.proxies.get(file.id);
        } else {
            this.objects.push(file);
            return this._convertToFormulaObject(file);
        }
    }
  
    listTagValues(tag: string, filter?: FilterFunction, extras?: any) {
      const tags = flatMap(this.objects.map(o => this._calculateValue(o, tag)).filter(t => t));
      const filtered = this._filterValues(tags, filter);
      return _singleOrArray(filtered);
    }
  
    listObjectsWithTag(tag: string, filter?: FilterFunction, extras?: any) {
      const objs = this.objects.filter(o => this._calculateValue(o, tag))
        .map(o => this._convertToFormulaObject(o));
      const filtered = this._filterObjects(objs, filter, tag);
      return _singleOrArray(filtered);
    }

    list(obj: any, context: string) {
        if (!context) {
            return [];
        }
        const x: number = obj[`${context}.x`];
        const y: number = obj[`${context}.y`];

        if (typeof x !== 'number' || typeof y !== 'number') {
            return [];
        }

        const objs = objectsAtContextGridPosition(this.context, context, { x, y });
        return objs;
    }

    uuid(): string {
        return uuid();
    }
  
    private _filterValues(values: any[], filter: FilterFunction) {
      if (filter) {
        if(typeof filter === 'function') {
          return values.filter(filter);
        } else {
          return values.filter(t => t === filter);
        }
      } else {
        return values;
      }
    }
  
    private _filterObjects(objs: any[], filter: FilterFunction, tag: string) {
      if (filter) {
        if(typeof filter === 'function') {
          return objs.filter(o => filter(this._calculateValue(o, tag)));
        } else {
          return objs.filter(o => this._calculateValue(o, tag) == filter);
        }
      } else {
        return objs;
      }
    }
  
    private _calculateValue(object: any, tag: string) {
      return calculateFileValue(this.context, object, tag);
    }

    private _convertToFormulaObject(file: File) {
        let proxy = this.proxies.get(file.id);
        if (!proxy) {
            if (this.setValueHandlerFactory) {
                proxy = convertToFormulaObject(this.context, file, this.setValueHandlerFactory(file));
            } else {
                proxy = convertToFormulaObject(this.context, file);
            }
            this.proxies.set(file.id, proxy);
        }
        return proxy;
    }
  }