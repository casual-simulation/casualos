import { Object, File, Workspace, DEFAULT_WORKSPACE_SCALE, DEFAULT_WORKSPACE_HEIGHT, DEFAULT_WORKSPACE_GRID_SCALE, DEFAULT_USER_MODE, DEFAULT_WORKSPACE_COLOR, UserMode } from './File';
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
    sumBy,
    difference
} from 'lodash';
import { Sandbox, SandboxLibrary } from '../Formulas/Sandbox';

/// <reference path="../typings/global.d.ts" />
import formulaLib from '../Formulas/formula-lib';
import { FilterFunction, SandboxInterface } from '../Formulas/SandboxInterface';
import { PartialFile } from '../Files';
import { FilesState, cleanFile, FileEvent } from './FilesChannel';
import { merge } from '../utils';
import { WeaveReference, AtomOp } from '../causal-trees';
import { AuxOp, AuxOpType } from '../aux-format';

export var ShortId_Length: number = 5;

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
export function isMinimized(workspace: Workspace) {
    return !!workspace.tags.minimized;
}

/**
 * Filters the given list of files by whether they belong to the given selection.
 * @param files The files to filter.
 * @param selectionId The selection to check.
 */
export function filterFilesBySelection(files: Object[], selectionId: string) {
    return files.filter(
        f => {
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
   */
export function fileTags(files: File[], currentTags: string[], extraTags: string[]) {
    const fileTags = flatMap(files, f => keys(f.tags));
    // Only keep tags that don't start with an underscore (_)
    const nonHiddenTags = fileTags.filter(t => !isHiddenTag(t));
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
    return (/^_/.test(tag));
}

export function calculateFileValue(context: FileCalculationContext, object: Object, tag: string) {
    if (tag === 'id') {
        return object.id;
    } else if (isFormulaObject(object)) {
        const o: any = object;
        return _calculateValue(context, object, tag, o[tag]);
    } else {
        return _calculateValue(context, object, tag, object.tags[tag]);
    }
}

export function calculateFormattedFileValue(context: FileCalculationContext, file: Object, tag: string): string {
    const value = calculateFileValue(context, file, tag);
    return _formatValue(value);
}

/**
 * Determines if the given value represents a formula.
 */
export function isFormula(value: string): boolean {
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
export function isArray(value: string): boolean {
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

export function isFormulaObject(object: any) {
    return !!object._converted;
}

/**
 * Determines if the given object has been destroyed.
 * @param object Whether the object is destroyed.
 */
export function isDestroyed(object: Object) {
    return !!object.tags._destroyed;
}

/**
 * Gets the array of objects in the given state that are currently active.
 * @param state The state to get the active objects of.
 */
export function getActiveObjects(state: FilesState) {
    return <Object[]>values(state).filter(f => !isDestroyed(f));
}

/**
 * Determines if the given tag matches the filter syntax.
 */
export function isFilterTag(tag: string) {
    const parsed = parseFilterTag(tag);
    return parsed.success;
}

export const WELL_KNOWN_TAGS = [
    '_position',
    '_hidden',
    '_destroyed',
    '_index',
    '_workspace',
    '_lastEditedBy',
    '_lastActiveTime'
];

/**
 * Determines if the given tag is "well known".
 * @param tag The tag.
 * @param includeSelectionTags Whether to include selection tags.
 */
export function isTagWellKnown(tag: string, includeSelectionTags: boolean = true): boolean {
    if (WELL_KNOWN_TAGS.indexOf(tag) >= 0) {
        return true;
    }

    if (includeSelectionTags && tag.indexOf('_selection_') === 0) {
        return true;
    }

    return false;
}

/**
 * Determines if the files are equal disregarding well-known hidden tags
 * and their IDs. File "appearance equality" means instead of asking "are these files exactly the same?"
 * we ask "are these files functionally the same?". In this respect we care about things like color, label, etc.
 * We also care about things like _movable but not _position, _index _selection, etc.
 * 
 * Well-known hidden tags include:
 * - _position
 * - _hidden
 * - _destroyed
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
        if(!(filter.partialSuccess || filter.success) && tag.indexOf('#') >= 0) {
            errors.valid = false;
            errors['tag.invalidChar'] = { char: '#' };
        }
    }

    return errors;
}

/**
 * Gets the ID of the selection that the user is using.
 * If the user doesn't have a selection, returns null.
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
    return `_selection_${uuid()}`;
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
 * Creates a file with a new ID and the given tags.
 * @param id 
 * @param tags 
 */
export function createFile(id = uuid(), tags: Object['tags'] = {
    _position: { x: 0, y: 0, z: 0},
    _workspace: <string>null
}) {
    const file: Object = {id: id, tags: tags};

    return file;
}

/**
 * Creates a new Workspace with default values.
 */
export function createWorkspace(id = uuid()): Workspace {
    const builderContextId = uuid();
    return {
        id: id,
        tags: {
            _workspace: builderContextId,
            _isWorkspace: true,
            position: {x: 0, y: 0, z: 0},
            size: 1,
            grid: {},
            scale: DEFAULT_WORKSPACE_SCALE,
            defaultHeight: DEFAULT_WORKSPACE_HEIGHT,
            gridScale: DEFAULT_WORKSPACE_GRID_SCALE,
            color: DEFAULT_WORKSPACE_COLOR
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
 * Calculates the difference between the two given states.
 * In particular, it calculates which operations need to be performed on prev in order to get current.
 * The returned object contains the files that were added, removed, and/or updated between the two states.
 * This operation runs in O(n) time where n is the number of files.
 * @param prev The previous state.
 * @param current The current state.
 * @param events If provided, this event will be used to help short-circut the diff calculation to be O(1) whenever the event is a 'file_added', 'file_removed', or 'file_updated' event.
 */
export function calculateStateDiff(prev: FilesState, current: FilesState, events?: WeaveReference<AuxOp>[]): FilesStateDiff {

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
export function convertToFormulaObject(context: FileCalculationContext, object: any) {
    if (isFormulaObject(object)) {
        return object;
    }
    let converted: {
        [tag: string]: any
    } = {
        _converted: true,
        _original: object,
        id: object.id
    };
    for(let key in object.tags) {
        if (typeof converted[key] === 'undefined') {
            const val = object.tags[key];
            if(containsFormula(val)) {
                Object.defineProperty(converted, key, {
                    get: () => _calculateValue(context, object, key, val)
                });
            } else {
                converted[key] = _calculateValue(context, object, key, val);
            }
        }
    }
    return converted;
}

/**
 * Creates a new file calculation context.
 * @param objects The objects that should be included in the context.
 * @param lib The library JavaScript that should be used.
 */
export function createCalculationContext(objects: Object[], lib: SandboxLibrary = formulaLib): FileCalculationContext {
    const context = {
        sandbox: new Sandbox(lib),
        objects: objects
    };
    context.sandbox.interface = new SandboxInterfaceImpl(context);
    return context;
}

/**
 * Gets a list of tags for the given object that match the given event name.
 * @param file The file to test.
 * @param other The other file to test against.
 * @param eventName The event name to test.
 */
export function tagsMatchingFilter(file: Object, other: Object, eventName: string, context: FileCalculationContext): string[] {
    const tags = keys(other.tags);
    return tags.filter(t => tagMatchesFilter(t, file, eventName, context));
}

/**
 * Determines if the given tag matches the given object and event.
 * @param tag The tag.
 * @param file The file to test.
 * @param eventName The event to test for.
 */
export function tagMatchesFilter(tag: string, file: Object, eventName: string, context: FileCalculationContext): boolean {
    const parsed = parseFilterTag(tag);
    if(parsed.success && parsed.eventName === eventName) {
        const calculatedValue = calculateFileValue(context, file, parsed.filter.tag);
        return calculatedValue === parsed.filter.value ||
            (Array.isArray(parsed.filter.value) && isEqual(file.tags[parsed.filter.tag], parsed.filter.value))
    }
    return false;
}

/**
 * Filters the given list of objects to those matching the given workspace ID and grid position.
 * The returned list is in the order of their indexes.
 * @param objects The objects to filter.
 * @param workspaceId The ID of the workspace that the objects need to be on.
 * @param position The position that the objects need to be at.
 */
export function objectsAtWorkspaceGridPosition(objects: Object[], workspaceId: string, position: Object['tags']['_position']) {
    return sortBy(objects.filter(o => {
        return o.tags._workspace === workspaceId &&
            o.tags._position &&
            o.tags._position.x === position.x &&
            o.tags._position.y === position.y
    }), o => o.tags._index || 0);
}

/**
 * Filters the given list of objects to those matching the given grid position.
 * The returned list is in the order of their indexes.
 * @param objects The objects to filter.
 * @param workspaceId The ID of the workspace that the objects need to be on.
 * @param position The position that the objects need to be at.
 */
// export function objectsAtContextGridPosition(objects: Object[], contextId: string, position: Object['tags']['_position']) {
//     return sortBy(objects.filter(o => {
//         return o.type === 'object' && 
//             o.tags[contextId] === workspaceId &&
//             o.tags._position &&
//             o.tags._position.x === position.x &&
//             o.tags._position.y === position.y
//     }), o => o.tags._index || 0);
// }

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
 * The file will be exactly the same as the previous except for 2 things.
 * First, it will have a different ID.
 * Second, it will never be marked as destroyed.
 * @param file The file to duplicate.
 * @param data The optional data that should override the existing file data.
 */
export function duplicateFile(file: Object, data?: PartialFile): Object {
    let newFile = merge(file, data || {}, {
        tags: {
            _destroyed: null
        }
    });
    newFile.id = uuid();
    return <Object>cleanFile(newFile);
}

/**
 * Parses the given tag filter into its components.
 * @param tag 
 */
export function parseFilterTag(tag: string) {
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
                        filter: {
                            tag: tagName,
                            value: finalValue
                        }
                    };
                }
            }
                
            return {
                success: false,
                partialSuccess: true,
                eventName: eventName,
            };
        }
    }
    return {
        success: false
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
 * Returns wether or not the given file resides in the given context id.
 * @param context The file calculation context to run formulas with.
 * @param file The file.
 * @param contextId The id of the context that we are asking if the file is in.
 */
export function isFileInContext(context: FileCalculationContext, file: Object, contextId: string): boolean {
    if (!contextId) return false;

    if (file.tags._user) {
        const result = calculateFileValue(context, file, '_userContext');
        return result == contextId;
    } else {
        const result = calculateFileValue(context, file, contextId);

        if (typeof result === 'string') {
            return result === 'true';
        } else {
            return result === true;
        }
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

function _calculateValue(context: FileCalculationContext, object: any, tag: string, formula: string): any {
    if (isFormula(formula)) {
        const result = _calculateFormulaValue(context, object, tag, formula);
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
        return split.map(s => _calculateValue(context, object, tag, s.trim()));
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

function _calculateFormulaValue(context: FileCalculationContext, object: any, tag: string, formula: string) {
    return context.sandbox.run(formula, {
        formula,
        tag,
        context
    }, convertToFormulaObject(context, object));
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

    constructor(context: FileCalculationContext) {
      this.objects = context.objects;
      this.context = context;
    }
  
    listTagValues(tag: string, filter?: FilterFunction, extras?: any) {
      const tags = flatMap(this.objects.map(o => this._calculateValue(o, tag)).filter(t => t));
      const filtered = this._filterValues(tags, filter);
      return _singleOrArray(filtered);
    }
  
    listObjectsWithTag(tag: string, filter?: FilterFunction, extras?: any) {
      const objs = this.objects.filter(o => this._calculateValue(o, tag))
        .map(o => convertToFormulaObject(this.context, o));
      const filtered = this._filterObjects(objs, filter, tag);
      return _singleOrArray(filtered);
    }

    list(obj: any) {
        const position = obj._position;
        const workspace = obj._workspace;
        const objs = objectsAtWorkspaceGridPosition(this.objects, workspace, position);
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
          return objs.filter(o => this._calculateValue(o, tag) === filter);
        }
      } else {
        return objs;
      }
    }
  
    private _calculateValue(object: any, tag: string) {
      return calculateFileValue(this.context, object, tag);
    }
  }