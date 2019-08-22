import {
    Object,
    File,
    Workspace,
    DEFAULT_WORKSPACE_SCALE,
    DEFAULT_WORKSPACE_HEIGHT,
    DEFAULT_WORKSPACE_GRID_SCALE,
    DEFAULT_USER_MODE,
    DEFAULT_BUILDER_USER_COLOR,
    DEFAULT_PLAYER_USER_COLOR,
    AuxDomain,
    UserMode,
    SelectionMode,
    DEFAULT_SELECTION_MODE,
    FileShape,
    DEFAULT_FILE_SHAPE,
    FileTags,
    DEFAULT_WORKSPACE_SIZE,
    FileLabelAnchor,
    DEFAULT_LABEL_ANCHOR,
    FileDragMode,
    ContextVisualizeMode,
    PrecalculatedFile,
    PrecalculatedTags,
    FilesState,
    DEFAULT_USER_INACTIVE_TIME,
    DEFAULT_USER_DELETION_TIME,
} from './File';

import {
    FileCalculationContext,
    FileSandboxContext,
    cacheFunction,
} from './FileCalculationContext';

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
    cloneDeep,
    sortedIndexBy,
    difference,
    transform,
    mapValues,
} from 'lodash';

/// <reference path="../typings/global.d.ts" />
import {
    setCalculationContext,
    getCalculationContext,
    getActions,
    getEnergy,
    setEnergy,
} from '../Formulas/formula-lib-globals';
import { PartialFile } from '../Files';
import { merge, shortUuid } from '../utils';
import { AuxFile, AuxObject, AuxOp, AuxState } from '../aux-format';
import { Atom } from '@casual-simulation/causal-trees';

export var isFormulaObjectSymbol: symbol = Symbol('isFormulaObject');

export var ShortId_Length: number = 5;

/**
 * The name of the event that represents two files getting combined.
 */
export const COMBINE_ACTION_NAME: string = 'onCombine';

/**
 * The name of the event that represents a file being diffed into another file.
 */
export const DIFF_ACTION_NAME: string = 'onMod';

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
export const DROP_ANY_IN_CONTEXT_ACTION_NAME: string = 'onAnyDropInContext';

/**
 * The name of the event that represents a file being dragged out of a context.
 */
export const DRAG_OUT_OF_CONTEXT_ACTION_NAME: string = 'onDragOutOfContext';

/**
 * The name of the event that represents any file being dragged out of a context.
 */
export const DRAG_ANY_OUT_OF_CONTEXT_ACTION_NAME: string =
    'onAnyDragOutOfContext';

/**
 * The name of the event that represents a file being dragged out of the user's inventory.
 */
export const DRAG_OUT_OF_INVENTORY_ACTION_NAME: string = 'onDragOutOfInventory';

/**
 * The name of the event that represents any file being dragged out of the user's inventory.
 */
export const DRAG_ANY_OUT_OF_INVENTORY_ACTION_NAME: string =
    'onAnyDragOutOfInventory';

/**
 * The name of the event that represents a file being dropped into the user's inventory.
 */
export const DROP_IN_INVENTORY_ACTION_NAME: string = 'onDropInInventory';

/**
 * The name of the event that represents any file being dropped into the user's inventory.
 */
export const DROP_ANY_IN_INVENTORY_ACTION_NAME: string = 'onAnyDropInInventory';

/**
 * The name of the event that is triggered when a QR Code is scanned.
 */
export const ON_QR_CODE_SCANNED_ACTION_NAME: string = 'onQRCodeScanned';

/**
 * The name of the event that is triggered when the QR Code scanner is closed.
 */
export const ON_QR_CODE_SCANNER_CLOSED_ACTION_NAME: string =
    'onQRCodeScannerClosed';

/**
 * The name of the event that is triggered when the QR Code scanner is opened.
 */
export const ON_QR_CODE_SCANNER_OPENED_ACTION_NAME: string =
    'onQRCodeScannerOpened';

/**
 * The default energy for actions.
 */
export const DEFAULT_ENERGY: number = 100_000;

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

export type FilterParseResult = FilterParseSuccess | FilterParseFailure;

export interface FilterParseSuccess {
    success: true;
    eventName: string;
    tag: string;
    filter: {
        tag: string;
        value: any;
    };
}

export interface FilterParseFailure {
    success: false;
    partialSuccess: boolean;
    tag: string;
    eventName: string;
}

export type SimulationIdParseResult =
    | SimulationIdParseFailure
    | SimulationIdParseSuccess;

export interface SimulationIdParseFailure {
    success: false;
}

export interface SimulationIdParseSuccess {
    success: true;
    channel?: string;
    host?: string;
    context?: string;
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
 * Determines whether the given tag value is a valid value or if
 * it represents nothing.
 * @param value The value.
 */
export function hasValue(value: unknown) {
    return !(value === null || typeof value === 'undefined' || value === '');
}

/**
 * Cleans the file by removing any null or undefined properties.
 * @param file The file to clean.
 */
export function cleanFile(file: File): File {
    let cleaned = merge({}, file);
    // Make sure we're not modifying another file's tags
    let newTags = merge({}, cleaned.tags);
    cleaned.tags = newTags;
    for (let property in cleaned.tags) {
        let value = cleaned.tags[property];
        if (!hasValue(value)) {
            delete cleaned.tags[property];
        }
    }
    return cleaned;
}

/**
 * Determines if the given workspace is currently minimized.
 * @param workspace The workspace.
 */
export function isMinimized(
    calc: FileCalculationContext,
    workspace: Workspace
) {
    return getContextMinimized(calc, workspace);
}

/**
 * Determines if the given file contains data for a context.
 */
export function isContext(
    calc: FileCalculationContext,
    contextFile: File
): boolean {
    return getFileConfigContexts(calc, contextFile).length > 0;
}

/**
 * Determines if the given context file is being visualized in the viewport.
 */
export function isVisibleContext(
    calc: FileCalculationContext,
    contextFile: File
): boolean {
    const result = calculateFileValue(
        calc,
        contextFile,
        'aux.context.visualize'
    );

    if (typeof result === 'string' && hasValue(result)) {
        return true;
    } else if (Array.isArray(result)) {
        return true;
    }
    return false;
}

/**
 * Filters the given list of files by whether they belong to the given selection.
 * @param files The files to filter.
 * @param selectionId The selection to check.
 */
export function filterFilesBySelection<TFile extends File>(
    files: TFile[],
    selectionId: string
) {
    return files.filter(f => {
        if (f.id === selectionId) {
            return true;
        }
        for (let prop in f.tags) {
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
export function fileTags(
    files: File[],
    currentTags: string[],
    extraTags: string[],
    includeHidden: boolean = false,
    tagBlacklist: (string | boolean)[][] = []
) {
    const fileTags = flatMap(files, f => keys(f.tags));
    // Only keep tags that don't start with an underscore (_)
    const nonHiddenTags = fileTags.filter(
        t => includeHidden || !isHiddenTag(t)
    );
    const tagsToKeep = union(nonHiddenTags, extraTags);
    const allTags = union(currentTags, tagsToKeep);

    const onlyTagsToKeep = intersection(allTags, tagsToKeep);

    // if there is a blacklist index and the  first index [all] is not selected
    if (tagBlacklist != undefined && tagBlacklist.length > 0) {
        let filteredTags: string[] = [];

        for (let i = tagBlacklist.length - 1; i >= 0; i--) {
            if (!tagBlacklist[i][1]) {
                for (let j = 2; j < tagBlacklist[i].length; j++) {
                    for (let k = onlyTagsToKeep.length - 1; k >= 0; k--) {
                        if (onlyTagsToKeep[k] === <string>tagBlacklist[i][j]) {
                            onlyTagsToKeep.splice(k, 1);
                            break;
                        }
                    }
                }
            }
        }

        return onlyTagsToKeep;
    } else {
        return onlyTagsToKeep;
    }
}

export function getAllFileTags(files: File[], includeHidden: boolean) {
    const fileTags = flatMap(files, f => keys(f.tags));

    const nonHiddenTags = fileTags.filter(
        t => includeHidden || !isHiddenTag(t)
    );

    return nonHiddenTags;
}

/**
 * Find files that match the short ids.
 * @param files The files to search through.
 * @param shortIds The short ids to search for.
 * @returns file array or null if no matches found.
 */
export function filesFromShortIds(
    files: File[] | Object[],
    shortIds: string[]
): File[] {
    var matches: File[] = [];
    shortIds.forEach(shortId => {
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
export function fileFromShortId(
    files: File[] | Object[],
    shortId: string
): File {
    return find(files, (f: File | Object) => {
        return getShortId(f) === shortId;
    });
}

/**
 * Return the short id for the file.
 * @param file The file to get short id for.
 */
export function getShortId(file: File | Object | string): string {
    let id = typeof file === 'string' ? file : file.id;
    let str = id.substr(0, ShortId_Length);

    if (id.startsWith('mod-')) {
        str = 'mod';
    }

    if (id.startsWith('config')) {
        str = 'config';
    }

    return str;
}

/**
 * Determines if the given tag is a hidden tag.
 * @param tag The tag to test.
 */
export function isHiddenTag(tag: string): boolean {
    return /^_/.test(tag) || /(\w+)\._/.test(tag);
}

export function isPrecalculated(
    file: Object | PrecalculatedFile
): file is PrecalculatedFile {
    return file && (<PrecalculatedFile>file).precalculated === true;
}

export function isExistingFile(file: Object | PrecalculatedFile): file is File {
    return file && (<File>file).id != undefined;
}

export function calculateFileValue(
    context: FileCalculationContext,
    object: Object | PrecalculatedFile,
    tag: keyof FileTags,
    energy?: number
) {
    if (tag === 'id') {
        return object.id;
    } else if (isPrecalculated(object)) {
        return object.values[tag];
    } else {
        return calculateValue(
            <FileSandboxContext>context,
            object,
            tag,
            object.tags[tag],
            energy
        );
    }
}

export function calculateFormattedFileValue(
    context: FileCalculationContext,
    file: Object,
    tag: string
): string {
    const value = calculateFileValue(context, file, tag);
    return formatValue(value);
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
    return (
        isFormula(value) ||
        (isArray(value) && some(parseArray(value), v => isFormula(v)))
    );
}

/**
 * Determines if the given string value represents an array.
 */
export function isArray(value: unknown): boolean {
    return (
        typeof value === 'string' &&
        value.indexOf('[') === 0 &&
        value.lastIndexOf(']') === value.length - 1
    );
}

/**
 * Parses the given string value that represents an array into an actual array.
 * @see isArray
 */
export function parseArray(value: string): string[] {
    var array: string[] = value.slice(1, value.length - 1).split(',');
    if (array && array.length > 0 && array[0].length > 0) {
        // trim all entries.
        return array.map(s => {
            return s.trim();
        });
    } else {
        return [];
    }
}

/**
 * Determines if the given value represents a number.
 */
export function isNumber(value: string): boolean {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        (/^-?\d*(?:\.?\d+)?$/.test(value) ||
            (typeof value === 'string' && 'infinity' === value.toLowerCase()))
    );
}

/**
 * Determines if the given object is a file.
 * @param object The object to check.
 */
export function isFile(object: any): object is AuxObject {
    if (object) {
        return !!object.id && !!object.tags;
    }
    return false;
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

/**
 * Determines if the given tag is "well known".
 * @param tag The tag.
 */
export function isTagWellKnown(tag: string): boolean {
    return isHiddenTag(tag);
}

/**
 * Determines if the files are equal disregarding well-known hidden tags
 * and their IDs. File "appearance equality" means instead of asking "are these files exactly the same?"
 * we ask "are these files functionally the same?". In this respect we care about things like color, label, etc.
 * We also care about things like aux.movable but not _position, _index _selection, etc.
 *
 * Well-known hidden tags include:
 * - aux._selection
 * - context._index
 *
 * You can determine if a tag is "well-known" by using isWellKnownTag().
 * @param first The first file.
 * @param second The second file.
 */
export function doFilesAppearEqual(
    first: Object,
    second: Object,
    options: FileAppearanceEqualityOptions = {}
): boolean {
    if (first === second) {
        return true;
    } else if (!first || !second) {
        return false;
    }

    options = merge(
        {
            ignoreSelectionTags: true,
            ignoreId: false,
        },
        options
    );

    if (!options.ignoreId && first.id === second.id) {
        return true;
    }

    const tags = union(keys(first.tags), keys(second.tags));
    const usableTags = tags.filter(t => !isTagWellKnown(t));

    let allEqual = true;
    for (let t of usableTags) {
        if (!isEqual(first.tags[t], second.tags[t])) {
            allEqual = false;
            break;
        }
    }

    return allEqual;
}

export interface FileAppearanceEqualityOptions {
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

export interface TagRequired {}

export interface TagInvalidChar {
    char: string;
}

/**
 * Validates the given tag and returns any errors for it.
 * @param tag The tag.
 */
export function validateTag(tag: string) {
    let errors: TagValidation = {
        valid: true,
    };
    if (!tag || !tag.trim()) {
        errors.valid = false;
        errors['tag.required'] = {};
    } else {
        const filter = parseFilterTag(tag);
        if (
            !(
                filter.success ||
                (filter.success === false && filter.partialSuccess)
            ) &&
            tag.indexOf('#') >= 0
        ) {
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
    if (user && user.tags['aux._selection']) {
        return { id: user.tags['aux._selection'] || null, newId: <string>null };
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
            ['aux._selection']: selectionId,
            ['aux._editingBot']: fileId,
        },
    };
}

/**
 * Gets a partial file that toggles whether the given file is apart of the given selection.
 * @param file The file.
 * @param selectionId The ID of the selection.
 * @param userId The User that is adding the file to the selection.
 */
export function toggleFileSelection(
    file: Object,
    selectionId: string,
    userId: string
) {
    return {
        tags: {
            [selectionId]: !file.tags[selectionId],
        },
    };
}

/**
 * Creates a new selection id.
 */
export function newSelectionId() {
    return `aux._selection_${shortUuid()}`;
}

/**
 * Gets the color that the given user file should appear as.
 * @param calc The file calculation context.
 * @param userFile The user file.
 * @param globalsFile The globals file.
 * @param domain The domain.
 */
export function getUserFileColor(
    calc: FileCalculationContext,
    userFile: File,
    globalsFile: File,
    domain: AuxDomain
): string {
    if (userFile.tags['aux.color']) {
        return calculateFileValue(calc, userFile, 'aux.color');
    }

    if (domain === 'builder') {
        return (
            calculateFileValue(
                calc,
                globalsFile,
                'aux.scene.user.builder.color'
            ) || DEFAULT_BUILDER_USER_COLOR
        );
    } else {
        return (
            calculateFileValue(
                calc,
                globalsFile,
                'aux.scene.user.player.color'
            ) || DEFAULT_PLAYER_USER_COLOR
        );
    }
}

/**
 * Gets the menu ID that is used for the given user.
 * @param userFile The file for the user.
 */
export function getUserMenuId(calc: FileCalculationContext, userFile: File) {
    return calculateFileValue(calc, userFile, 'aux._userMenuContext');
}

/**
 * Gets the list of files that are in the user's menu.
 * @param calc The file calculation context.
 * @param userFile The user file to use.
 */
export function getFilesInMenu(
    calc: FileCalculationContext,
    userFile: File
): File[] {
    const context = getUserMenuId(calc, userFile);
    return filesInContext(calc, context);
}

/**
 * Gets the user account file for the given user.
 * @param calc The file calculation context.
 * @param username The username.
 */
export function getUserAccountFile(
    calc: FileCalculationContext,
    username: string
): File {
    const userFiles = calc.objects.filter(
        o => calculateFileValue(calc, o, 'aux.account.username') === username
    );

    if (userFiles.length > 0) {
        return userFiles[0];
    }
    return null;
}

/**
 * Gets the list of token files that match the given username.
 */
export function getTokensForUserAccount(
    calc: FileCalculationContext,
    username: string
): File[] {
    return calc.objects.filter(
        o => calculateFileValue(calc, o, 'aux.token.username') === username
    );
}

/**
 * Finds the first file in the given list of files that matches the token.
 * @param calc The file calculation context.
 * @param files The files to filter.
 * @param token The token to search for.
 */
export function findMatchingToken(
    calc: FileCalculationContext,
    files: File[],
    token: string
): File {
    const tokens = files.filter(
        o => calculateFileValue(calc, o, 'aux.token') === token
    );

    if (tokens.length > 0) {
        return tokens[0];
    } else {
        return null;
    }
}

/**
 * Gets the list of roles stored in the aux.account.roles tag.
 * @param calc The file calculation context.
 * @param file The file.
 */
export function getFileRoles(
    calc: FileCalculationContext,
    file: File
): Set<string> {
    const list = getFileStringList(calc, file, 'aux.account.roles');
    return new Set(list);
}

/**
 * Gets the list of files that are in the given context.
 * @param calc The file calculation context.
 * @param context The context to search for files in.
 */
export function filesInContext(
    calc: FileCalculationContext,
    context: string
): File[] {
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
export function addToContextDiff(
    calc: FileCalculationContext,
    context: string,
    x: number = 0,
    y: number = 0,
    index?: number
): FileTags {
    const files = objectsAtContextGridPosition(calc, context, { x, y });
    return {
        [context]: true,
        ...setPositionDiff(
            calc,
            context,
            x,
            y,
            typeof index === 'undefined' ? files.length : index
        ),
    };
}

/**
 * Gets a diff that removes a file from the given context.
 * @param calc The file calculation context.
 * @param context The context that the file should be removed from.
 */
export function removeFromContextDiff(
    calc: FileCalculationContext,
    context: string
): FileTags {
    return {
        [context]: null,
        [`${context}.x`]: null,
        [`${context}.y`]: null,
        [`${context}.sortOrder`]: null,
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
export function setPositionDiff(
    calc: FileCalculationContext,
    context: string,
    x?: number,
    y?: number,
    index?: number
): FileTags {
    let tags: FileTags = {};
    if (typeof x === 'number') {
        tags[`${context}.x`] = x;
    }
    if (typeof y === 'number') {
        tags[`${context}.y`] = y;
    }
    if (typeof index === 'number') {
        tags[`${context}.sortOrder`] = index;
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
export function addFileToMenu(
    calc: FileCalculationContext,
    userFile: File,
    id: string,
    index: number = Infinity
): PartialFile {
    const context = getUserMenuId(calc, userFile);
    const files = getFilesInMenu(calc, userFile);
    const idx = isFinite(index) ? index : files.length;
    return {
        tags: {
            [`${context}.id`]: id,
            [`${context}.sortOrder`]: idx,
            [context]: true,
        },
    };
}

/**
 * Gets the file update needed to remove a file from the given user's menu.
 * @param calc The file calculation context.
 * @param userFile The file of the user.
 */
export function removeFileFromMenu(
    calc: FileCalculationContext,
    userFile: File
): PartialFile {
    const context = getUserMenuId(calc, userFile);
    return {
        tags: {
            [context]: null,
            [`${context}.id`]: null,
            [`${context}.sortOrder`]: null,
        },
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
    return `${shortUuid()}`;
}

/**
 * Creates a file with a new ID and the given tags.
 * @param id
 * @param tags
 */
export function createFile(id = uuid(), tags: Object['tags'] = {}) {
    const file: File = { id: id, tags: tags };

    return file;
}

export function createPrecalculatedFile(
    id = uuid(),
    values: PrecalculatedTags = {},
    tags?: Object['tags']
): PrecalculatedFile {
    return {
        id: id,
        precalculated: true,
        tags: tags || values,
        values: values,
    };
}

/**
 * Creates a new Workspace with default values.
 * @param id The ID of the new workspace.
 * @param builderContextId The tag that should be used for contexts stored on this workspace.
 * @param locked Whether the context is allowed to be accessed via AUX Player.
 */
export function createWorkspace(
    id = uuid(),
    builderContextId: string = createContextId(),
    locked: boolean = false
): Workspace {
    // checks if given context string is empty or just whitespace
    if (builderContextId.length === 0 || /^\s*$/.test(builderContextId)) {
        builderContextId = createContextId();
    }

    if (locked) {
        return {
            id: id,
            tags: {
                'aux.context.x': 0,
                'aux.context.y': 0,
                'aux.context.z': 0,
                'aux.context.visualize': 'surface',
                'aux.context.locked': true,
                'aux.context': builderContextId,
            },
        };
    } else {
        return {
            id: id,
            tags: {
                'aux.context.x': 0,
                'aux.context.y': 0,
                'aux.context.z': 0,
                'aux.context.visualize': 'surface',
                'aux.context': builderContextId,
            },
        };
    }
}

/**
 * Performs a pre-process step for updating the given file by nulling out falsy tags and also calculating assignments.
 * @param file The file to update.
 * @param userId The ID of the file whose user edited this file.
 * @param newData The new data to assign to the file.
 * @param createContext A function that, when called, returns a new FileCalculationContext that can be used to calculate formulas for assignment expressions.
 */
export function updateFile(
    file: File,
    userId: string,
    newData: PartialFile,
    createContext: () => FileSandboxContext
) {
    if (newData.tags) {
        if (userId) {
            newData.tags['aux._lastEditedBy'] = userId;
        }
        // Cleanup/preprocessing
        for (let property in newData.tags) {
            let value = newData.tags[property];
            if (value) {
                if (_isAssignmentFormula(value)) {
                    const assignment = _convertToAssignment(value);
                    const result = _calculateFormulaValue(
                        createContext(),
                        file,
                        property,
                        assignment.formula
                    );
                    newData.tags[property] = assign(assignment, {
                        value: result.result,
                    });
                }
            }
        }
    }
}

/**
 * Calculates the grid scale for the given workspace.
 * @param workspace
 */
export function calculateGridScale(
    calc: FileCalculationContext,
    workspace: File
): number {
    if (workspace) {
        const scale = calculateNumericalTagValue(
            calc,
            workspace,
            `aux.context.surface.scale`,
            DEFAULT_WORKSPACE_SCALE
        );
        const gridScale = calculateNumericalTagValue(
            calc,
            workspace,
            `aux.context.grid.scale`,
            DEFAULT_WORKSPACE_GRID_SCALE
        );
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
export function calculateStateDiff(
    prev: FilesState,
    current: FilesState,
    events?: Atom<AuxOp>[]
): FilesStateDiff {
    prev = prev || {};
    current = current || {};

    let diff: FilesStateDiff = {
        addedFiles: [],
        removedFiles: [],
        updatedFiles: [],
    };

    const ids = union(keys(prev), keys(current));

    ids.forEach(id => {
        const prevVal = prev[id];
        const currVal = current[id];

        if (prevVal && !currVal) {
            diff.removedFiles.push(prevVal.id);
        } else if (!prevVal && currVal) {
            diff.addedFiles.push(currVal);
        } else if (!isEqual(prevVal, currVal)) {
            diff.updatedFiles.push(currVal);
        }
    });

    return diff;
}

/**
 * Trims the leading # symbol off the given tag.
 */
export function trimTag(tag: string): string {
    if (tag.indexOf('#') === 0) {
        return tag.substring(1);
    }
    return tag;
}

/**
 * Gets a list of tags from the given object that match the given event name and arguments.
 * @param file The file to find the tags that match the arguments.
 * @param eventName The event name to test.
 * @param other The arguments to match against.
 */
export function filtersMatchingArguments(
    context: FileCalculationContext,
    file: Object,
    eventName: string,
    args: any[]
): FilterParseResult[] {
    if (file === undefined) {
        return;
    }

    const tags = keys(file.tags);
    return tags
        .map(t => parseFilterTag(t))
        .filter(t => filterMatchesArguments(context, t, eventName, args));
}

/**
 * Determines if the given tag matches the given object and event.
 * @param tag The tag.
 * @param file The file to test.
 * @param eventName The event to test for.
 */
export function filterMatchesArguments(
    context: FileCalculationContext,
    filter: FilterParseResult,
    eventName: string,
    args: any[]
): boolean {
    if (filter.success && filter.eventName === eventName) {
        if (!!filter.filter) {
            const arg = args.length > 0 ? args[0] : null;
            if (arg) {
                const calculatedValue = calculateFileValue(
                    context,
                    arg,
                    filter.filter.tag
                );
                return (
                    calculatedValue === filter.filter.value ||
                    (Array.isArray(filter.filter.value) &&
                        isEqual(
                            arg.tags[filter.filter.tag],
                            filter.filter.value
                        ))
                );
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
 * Determines if the given username is in the username list in the given file and tag.
 * @param calc The file calculation context.
 * @param file The file.
 * @param tag The tag.
 * @param username The username to check.
 */
export function isInUsernameList(
    calc: FileCalculationContext,
    file: File,
    tag: string,
    username: string
): boolean {
    const list = getFileUsernameList(calc, file, tag);
    return list.indexOf(username) >= 0;
}

/**
 * Gets a list of usernames from the given file and tag.
 * @param calc The file calculation context.
 * @param file The file.
 * @param tag The tag.
 */
export function getFileUsernameList(
    calc: FileCalculationContext,
    file: File,
    tag: string
): string[] {
    let value = calculateFileValue(calc, file, tag);

    if (value && !Array.isArray(value)) {
        value = [value];
    }

    if (value) {
        for (let i = 0; i < value.length; i++) {
            let v = value[i];
            if (isFile(v)) {
                value[i] = v.tags['aux._user'] || v.id;
            }
        }
    }

    return value;
}

/**
 * Gets a list of strings from the given file and tag.
 * @param calc The file calculation context.
 * @param file The file.
 * @param tag The tag.
 */
export function getFileStringList(
    calc: FileCalculationContext,
    file: File,
    tag: string
): string[] {
    let value = calculateFileValue(calc, file, tag);

    if (value && !Array.isArray(value)) {
        value = [value];
    }

    return value;
}

/**
 * Determines if the whitelist and blacklist on the given file allows the given username.
 * If the username exists in both, then the whitelist wins.
 */
export function whitelistOrBlacklistAllowsAccess(
    calc: FileCalculationContext,
    file: File,
    username: string
): boolean {
    const whitelist = getFileWhitelist(calc, file);

    if (whitelist) {
        return isInUsernameList(calc, file, 'aux.whitelist', username);
    } else {
        const blacklist = getFileBlacklist(calc, file);
        if (blacklist) {
            return !isInUsernameList(calc, file, 'aux.blacklist', username);
        }
    }

    return true;
}

/**
 * Determines if the whitelist on the given file allows the given username.
 * Whitelists work by allowing only the usernames that are explicitly listed.
 * If the whitelist is empty, then everything is allowed.
 * @param calc The file calculation context.
 * @param file The file.
 * @param username The username to check.
 */
export function whitelistAllowsAccess(
    calc: FileCalculationContext,
    file: File,
    username: string
): boolean {
    const list = getFileWhitelist(calc, file);
    if (list) {
        return isInUsernameList(calc, file, 'aux.whitelist', username);
    }
    return true;
}

/**
 * Determines if the whitelist on the given file allows the given username.
 * Blacklists work by denying only the usernames that are explicitly listed.
 * If the blacklist is empty, then everything is allowed.
 * @param calc The file calculation context.
 * @param file The file.
 * @param username The username to check.
 */
export function blacklistAllowsAccess(
    calc: FileCalculationContext,
    file: File,
    username: string
): boolean {
    const list = getFileBlacklist(calc, file);
    if (list) {
        return !isInUsernameList(calc, file, 'aux.blacklist', username);
    }
    return true;
}

/**
 * Gets the aux.whitelist tag from the given file.
 * Always returns an array of strings.
 * If any files returned by the formula, then the aux._user tag will be used from the file.
 * @param calc The file calculation context.
 * @param file The file.
 */
export function getFileWhitelist(
    calc: FileCalculationContext,
    file: File
): string[] {
    return getFileUsernameList(calc, file, 'aux.whitelist');
}

/**
 * Gets the aux.blacklist tag from the given file.
 * Always returns an array of strings.
 * If any files returned by the formula, then the aux._user tag will be used from the file.
 * @param calc The file calculation context.
 * @param file The file.
 */
export function getFileBlacklist(
    calc: FileCalculationContext,
    file: File
): string[] {
    return getFileUsernameList(calc, file, 'aux.blacklist');
}

/**
 * Gets the aux.designers tag from the given file.
 * Always returns an array of strings.
 * If any files returned by the formula, then the aux._user tag will be used from the file.
 * @param calc The file calculation context.
 * @param file The file.
 */
export function getFileDesignerList(
    calc: FileCalculationContext,
    file: File
): string[] {
    return getFileUsernameList(calc, file, 'aux.designers');
}

/**
 * Gets the AUX_FILE_VERSION number that the given file was created with.
 * If not specified, then undefined is returned.
 * @param calc The file calculation context.
 * @param file THe file.
 */
export function getFileVersion(calc: FileCalculationContext, file: File) {
    return calculateNumericalTagValue(calc, file, 'aux.version', undefined);
}

/**
 * Gets the index that the given file is at in the given context.
 * @param calc The calculation context to use.
 * @param file The file.
 * @param workspaceId The context.
 */
export function getFileIndex(
    calc: FileCalculationContext,
    file: File,
    context: string
): number {
    return calculateNumericalTagValue(calc, file, `${context}.sortOrder`, 0);
}

/**
 * Gets the position that the given file is at in the given context.
 * @param calc The calculation context to use.
 * @param file The file.
 * @param context The context.
 */
export function getFilePosition(
    calc: FileCalculationContext,
    file: File,
    context: string
): { x: number; y: number; z: number } {
    return {
        x: calculateNumericalTagValue(calc, file, `${context}.x`, 0),
        y: calculateNumericalTagValue(calc, file, `${context}.y`, 0),
        z: calculateNumericalTagValue(calc, file, `${context}.z`, 0),
    };
}

/**
 * Gets the rotation that the given file is at in the given context.
 * @param calc The calculation context to use.
 * @param file The file.
 * @param context The context.
 */
export function getFileRotation(
    calc: FileCalculationContext,
    file: File,
    context: string
): { x: number; y: number; z: number } {
    return {
        x: calculateNumericalTagValue(calc, file, `${context}.rotation.x`, 0),
        y: calculateNumericalTagValue(calc, file, `${context}.rotation.y`, 0),
        z: calculateNumericalTagValue(calc, file, `${context}.rotation.z`, 0),
    };
}

/**
 * Calculates the scale.x, scale.y, and scale.z values from the given object.
 * @param context The calculation context.
 * @param obj The object.
 * @param multiplier The value that scale values should be multiplied by.
 * @param defaultScale The default value.
 * @param prefix The optional prefix for the tags. Defaults to `aux.`
 */
export function getFileScale(
    context: FileCalculationContext,
    obj: File,
    defaultScale: number = 1,
    prefix: string = 'aux.'
) {
    return cacheFunction(
        context,
        'getFileScale',
        () => {
            const scaleX = calculateNumericalTagValue(
                context,
                obj,
                `${prefix}scale.x`,
                defaultScale
            );
            const scaleY = calculateNumericalTagValue(
                context,
                obj,
                `${prefix}scale.y`,
                defaultScale
            );
            const scaleZ = calculateNumericalTagValue(
                context,
                obj,
                `${prefix}scale.z`,
                defaultScale
            );
            const uniformScale = calculateNumericalTagValue(
                context,
                obj,
                `${prefix}scale`,
                1
            );

            if (isDiff(context, obj)) {
                const scale = 1 * uniformScale;
                return {
                    x: scale,
                    y: scale,
                    z: scale,
                };
            } else {
                return {
                    x: scaleX * uniformScale,
                    z: scaleZ * uniformScale,
                    y: scaleY * uniformScale,
                };
            }
        },
        obj.id,
        defaultScale,
        prefix
    );
}

/**
 * Gets the shape of the file.
 * @param calc The calculation context to use.
 * @param file The file.
 */
export function getFileShape(
    calc: FileCalculationContext,
    file: File
): FileShape {
    if (isDiff(calc, file)) {
        return 'sphere';
    }
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
export function getFileLabelAnchor(
    calc: FileCalculationContext,
    file: File
): FileLabelAnchor {
    const anchor: FileLabelAnchor = calculateFileValue(
        calc,
        file,
        'aux.label.anchor'
    );
    if (
        anchor === 'back' ||
        anchor === 'floating' ||
        anchor === 'front' ||
        anchor === 'left' ||
        anchor === 'right' ||
        anchor === 'top'
    ) {
        return anchor;
    }
    return DEFAULT_LABEL_ANCHOR;
}

/**
 * Determines if the given file is a config file for the given context.
 * @param calc The calculation context.
 * @param file The file to check.
 * @param context The context to check if the file is the config of.
 */
export function isConfigForContext(
    calc: FileCalculationContext,
    file: File,
    context: string
) {
    const contexts = getFileConfigContexts(calc, file);
    return contexts.indexOf(context) >= 0;
}

/**
 * Gets whether the context(s) that the given file represents are locked.
 * Uses at the aux.context.locked tag to determine whether it is locked.
 * Defaults to false if the file is a context. Otherwise it defaults to true.
 * @param calc The calculation context.
 * @param file The file.
 */
export function isContextLocked(
    calc: FileCalculationContext,
    file: File
): boolean {
    if (isContext(calc, file)) {
        return calculateBooleanTagValue(
            calc,
            file,
            'aux.context.locked',
            false
        );
    }
    return true;
}

/**
 * Gets the list of contexts that the given file is a config file for.
 * @param calc The calculation context.
 * @param file The file that represents the context.
 */
export function getFileConfigContexts(
    calc: FileCalculationContext,
    file: File
): string[] {
    const result = calculateFileValue(calc, file, 'aux.context');
    if (typeof result === 'string' && hasValue(result)) {
        return [result];
    } else if (typeof result === 'number' && hasValue(result)) {
        return [result.toString()];
    } else if (typeof result === 'boolean' && hasValue(result)) {
        return [result.toString()];
    } else if (Array.isArray(result)) {
        return result;
    }
    return [];
}

/**
 * Gets a value from the given context file.
 * @param calc The calculation context.
 * @param contextFile The file that represents the context.
 * @param name The name of the value to get.
 */
export function getContextValue(
    calc: FileCalculationContext,
    contextFile: File,
    name: string
): any {
    return calculateFileValue(calc, contextFile, `aux.context.${name}`);
}

/**
 * Gets the drag mode for the file.
 * @param calc The file calculation context.
 * @param file The file to check.
 */
export function getFileDragMode(
    calc: FileCalculationContext,
    file: File
): FileDragMode {
    const val = calculateFileValue(calc, file, 'aux.movable');
    if (typeof val === 'boolean') {
        return val ? 'all' : 'none';
    }
    if (
        val === 'clone' ||
        val === 'pickup' ||
        val === 'drag' ||
        val === 'cloneMod'
    ) {
        return val;
    } else {
        return 'all';
    }
}

/**
 * Gets whether the given file is stackable.
 * @param calc The calculation context.
 * @param file The file to check.
 */
export function isFileStackable(
    calc: FileCalculationContext,
    file: File
): boolean {
    return calculateBooleanTagValue(calc, file, 'aux.stackable', true);
}

/**
 * Gets whether the given file is movable.
 * @param calc The calculation context.
 * @param file The file to check.
 */
export function isFileMovable(
    calc: FileCalculationContext,
    file: File
): boolean {
    // checks if file is movable, but we should also allow it if it is pickupable so we can drag it into inventory if movable is false
    return calculateBooleanTagValue(calc, file, 'aux.movable', true);
}

/**
 * Gets whether the given file is listening for shouts or whispers.
 * @param calc The calculation context.
 * @param file The file to check.
 */
export function isFileListening(
    calc: FileCalculationContext,
    file: File
): boolean {
    // checks if file is movable, but we should also allow it if it is pickupable so we can drag it into inventory if movable is false
    return calculateBooleanTagValue(calc, file, 'aux.listening', true);
}

/**
 * Gets whether the given file's context is movable.
 * @param calc The calculation context.
 * @param file The file to check.
 */
export function isContextMovable(
    calc: FileCalculationContext,
    file: File
): boolean {
    return calculateBooleanTagValue(
        calc,
        file,
        'aux.context.surface.movable',
        true
    );
}

/**
 * Gets the position that the context should be at using the given file.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextPosition(
    calc: FileCalculationContext,
    contextFile: File
): { x: number; y: number; z: number } {
    return {
        x: calculateNumericalTagValue(calc, contextFile, `aux.context.x`, 0),
        y: calculateNumericalTagValue(calc, contextFile, `aux.context.y`, 0),
        z: calculateNumericalTagValue(calc, contextFile, `aux.context.z`, 0),
    };
}

/**
 * Gets the rotation that the context should be at using the given file.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextRotation(
    calc: FileCalculationContext,
    contextFile: File
): { x: number; y: number; z: number } {
    return {
        x: calculateNumericalTagValue(
            calc,
            contextFile,
            `aux.context.rotation.x`,
            0
        ),
        y: calculateNumericalTagValue(
            calc,
            contextFile,
            `aux.context.rotation.y`,
            0
        ),
        z: calculateNumericalTagValue(
            calc,
            contextFile,
            `aux.context.rotation.z`,
            0
        ),
    };
}

/**
 * Gets whether the context is minimized.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextMinimized(
    calc: FileCalculationContext,
    contextFile: File
): boolean {
    return getContextValue(calc, contextFile, 'surface.minimized');
}

/**
 * Gets the color of the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextColor(
    calc: FileCalculationContext,
    contextFile: File
): string {
    return getContextValue(calc, contextFile, 'color');
}

/**
 * Gets the size of the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextSize(
    calc: FileCalculationContext,
    contextFile: File
): number {
    if (getContextVisualizeMode(calc, contextFile) === 'surface') {
        return calculateNumericalTagValue(
            calc,
            contextFile,
            `aux.context.surface.size`,
            DEFAULT_WORKSPACE_SIZE
        );
    }
    return 0;
}

/**
 * Gets the aux.context.visualize mode from the given file.
 * @param calc The calculation context.
 * @param file The file.
 */
export function getContextVisualizeMode(
    calc: FileCalculationContext,
    file: File
): ContextVisualizeMode {
    const val = calculateFileValue(calc, file, 'aux.context.visualize');
    if (typeof val === 'boolean') {
        return val;
    }
    if (val === 'surface') {
        return val;
    } else {
        return false;
    }
}

/**
 * Gets the grid of the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getBuilderContextGrid(
    calc: FileCalculationContext,
    contextFile: File
): { [key: string]: number } {
    const tags = tagsOnFile(contextFile);
    const gridTags = tags.filter(
        t => t.indexOf('aux.context.surface.grid.') === 0 && t.indexOf(':') > 0
    );

    let val: { [key: string]: number } = {};
    for (let tag of gridTags) {
        val[
            tag.substr('aux.context.surface.grid.'.length)
        ] = calculateNumericalTagValue(calc, contextFile, tag, undefined);
    }

    return val;
}

/**
 * Gets the height of the specified grid on the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 * @param key The key for the grid position to lookup in the context grid.
 */
export function getContextGridHeight(
    calc: FileCalculationContext,
    contextFile: File,
    key: string
): number {
    let contextGrid = getBuilderContextGrid(calc, contextFile);
    if (contextGrid && contextGrid[key]) {
        if (contextGrid[key]) {
            return contextGrid[key];
        }
    }

    return DEFAULT_WORKSPACE_HEIGHT;
}

/**
 * Gets the grid scale of the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextGridScale(
    calc: FileCalculationContext,
    contextFile: File
): number {
    return getContextValue(calc, contextFile, 'grid.scale');
}

/**
 * Gets the scale of the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextScale(
    calc: FileCalculationContext,
    contextFile: File
): number {
    return (
        getContextValue(calc, contextFile, 'surface.scale') ||
        DEFAULT_WORKSPACE_SCALE
    );
}

/**
 * Gets the default height of the context.
 * @param calc The calculation context to use.
 * @param contextFile The file that represents the context.
 */
export function getContextDefaultHeight(
    calc: FileCalculationContext,
    contextFile: File
): number {
    return getContextValue(calc, contextFile, 'defaultHeight');
}

/**
 * Filters the given list of objects to those matching the given workspace ID and grid position.
 * The returned list is in the order of their indexes.
 * @param calc The file calculation context to use.
 * @param context The ID of the context that the objects need to be on.
 * @param position The position that the objects need to be at.
 */
export function objectsAtContextGridPosition(
    calc: FileCalculationContext,
    context: string,
    position: { x: number; y: number }
): File[] {
    return cacheFunction(
        calc,
        'objectsAtContextGridPosition',
        () => {
            const objects = calc.objects;
            return <File[]>sortBy(
                objects.filter(o => {
                    if (!isUserFile(o) && isFileInContext(calc, o, context)) {
                        const pos = getFilePosition(calc, o, context);
                        return (
                            pos && position.x === pos.x && position.y === pos.y
                        );
                    }
                    return false;
                }),
                o => getFileIndex(calc, o, context),
                o => o.id
            );
        },
        context,
        position.x,
        position.y
    );
}

/**
 * Determines if the given file is for a user.
 */
export function isUserFile(file: File): boolean {
    return !!file.tags['aux._user'];
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
 * @param calc The file calculation context.
 * @param file The file to duplicate.
 * @param data The optional data that should override the existing file data.
 */
export function duplicateFile(
    calc: FileCalculationContext,
    file: Object,
    data?: PartialFile
): Object {
    let copy = cloneDeep(file);
    const tags = tagsOnFile(copy);
    const tagsToKeep = getDiffTags(calc, file);
    const tagsToRemove = difference(
        filterWellKnownAndContextTags(calc, tags),
        tagsToKeep
    );
    tagsToRemove.forEach(t => {
        delete copy.tags[t];
    });

    let newFile = merge(copy, data || {});
    newFile.id = uuid();

    return <Object>cleanFile(newFile);
}

/**
 * Filters the given list of tags by whether they are well known or used in a context.
 * @param calc The file calculation context.
 * @param tags The list of tags to filter.
 */
export function filterWellKnownAndContextTags(
    calc: FileCalculationContext,
    tags: string[]
) {
    const contextsToRemove = getContexts(calc);
    const tagsToRemove = tags.filter(t =>
        isWellKnownOrContext(t, contextsToRemove)
    );
    return tagsToRemove;
}

/**
 * Gets the list of contexts that the given calculation context contains.
 * @param calc The file calculation context.
 */
export function getContexts(calc: FileCalculationContext) {
    return union(...calc.objects.map(o => getFileConfigContexts(calc, o)));
}

/**
 * Determines if the given tag is well known or in one of the given contexts.
 * @param tag The tag to check.
 * @param contexts The contexts to check the tag against.
 */
export function isWellKnownOrContext(tag: string, contexts: string[]): any {
    return isTagWellKnown(tag) || contexts.some(c => tag.indexOf(c) === 0);
}

/**
 * Determines if the given file represents a diff.
 * @param file The file to check.
 */
export function isDiff(calc: FileCalculationContext, file: File): boolean {
    if (calc) {
        return !!file && calculateBooleanTagValue(calc, file, 'aux.mod', false);
    } else {
        return !!file && !!file.tags['aux.mod'];
    }
}

/**
 * Determines if the given file allows for merging.
 * @param file The file to check.
 */
export function isMergeable(calc: FileCalculationContext, file: File): boolean {
    return (
        !!file && calculateBooleanTagValue(calc, file, 'aux.mergeable', true)
    );
}

/**
 * Determines if the given file allows for the file to be place in inventory.
 * @param file The file to check.
 */
export function isPickupable(
    calc: FileCalculationContext,
    file: File
): boolean {
    if (!!file && isFileMovable(calc, file)) {
        const mode = getFileDragMode(calc, file);
        return mode === 'pickup' || mode === 'all';
    }
    return false;
}

/**
 * Gets a partial file that can be used to apply the diff that the given file represents.
 * A diff file is any file that has `aux.mod` set to `true` and `aux.mod.mergeTags` set to a list of tag names.
 * @param calc The file calculation context.
 * @param file The file that represents the diff.
 */
export function getDiffUpdate(
    calc: FileCalculationContext,
    file: File
): PartialFile {
    if (isDiff(calc, file)) {
        let update: PartialFile = {
            tags: {},
        };

        let tags = tagsOnFile(file);
        let diffTags = getDiffTags(calc, file);

        for (let i = 0; i < tags.length; i++) {
            let tag = tags[i];
            if (
                tag === 'aux.mod' ||
                tag === 'aux.mod.mergeTags' ||
                tag === 'aux.movable.mod.tags' ||
                diffTags.indexOf(tag) < 0
            ) {
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

export function getDiffTags(
    calc: FileCalculationContext,
    file: File
): string[] {
    let diffTags =
        calculateFileValue(calc, file, 'aux.movable.mod.tags') ||
        calculateFileValue(calc, file, 'aux.mod.mergeTags');

    if (!diffTags) {
        return [];
    }

    if (!Array.isArray(diffTags)) {
        diffTags = [diffTags];
    }

    return diffTags
        .filter((a: any) => a !== null && typeof a !== 'undefined')
        .map((a: any) => {
            if (typeof a !== 'string') {
                return a.toString();
            } else {
                return a;
            }
        });
}

export function simulationIdToString(id: SimulationIdParseSuccess): string {
    let str = '';
    if (id.host) {
        str += `${id.host}/*/`;
    }
    if (id.channel) {
        str += `${id.channel}`;
    }
    return str;
}

export function parseSimulationId(id: string): SimulationIdParseSuccess {
    try {
        let uri = new URL(id);
        const split = uri.pathname.slice(1).split('/');
        if (split.length === 1) {
            if (split[0]) {
                return {
                    success: true,
                    host: uri.host,
                    context: split[0],
                };
            } else {
                return {
                    success: true,
                    host: uri.host,
                };
            }
        } else {
            return {
                success: true,
                host: uri.host,
                context: split[0],
                channel: split.slice(1).join('/'),
            };
        }
    } catch (ex) {
        const split = id.split('/');
        if (split.length === 1) {
            return {
                success: true,
                channel: id,
            };
        } else {
            const firstSlashIndex = id.indexOf('/');
            const firstDotIndex = id.indexOf('.');

            if (firstDotIndex >= 0 && firstDotIndex < firstSlashIndex) {
                return {
                    success: true,
                    host: split[0],
                    context: split[1],
                    channel: split.slice(2).join('/'),
                };
            } else {
                return {
                    success: true,
                    context: split[0],
                    channel: split.slice(1).join('/'),
                };
            }
        }
    }
}

/**
 * Normalizes the given URL so that it will load the AUX file instead of the web application.
 * @param url The URL.
 */
export function normalizeAUXFileURL(url: string): string {
    const parsed = new URL(url);

    if (
        parsed.pathname.indexOf('.aux') !==
        parsed.pathname.length - '.aux'.length
    ) {
        parsed.pathname = `${parsed.pathname}.aux`;
        return parsed.href;
    }

    return url;
}

/**
 * Parses the given tag filter into its components.
 * @param tag
 */
export function parseFilterTag(tag: string): FilterParseResult {
    let originalTag = tag;
    tag = tag.replace(/[“”‘’]/g, '"');
    const firstParenIndex = tag.indexOf('(');
    const tagIndex = tag.indexOf('#');
    if (firstParenIndex > 0 && (tagIndex > firstParenIndex || tagIndex < 0)) {
        const eventName = tag.slice(0, firstParenIndex).trim();

        if (eventName) {
            const colonIndex = tag.indexOf(':');
            if (colonIndex > tagIndex) {
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
                    } else if (lastQuote === firstQuote) {
                        lastQuote = tag.length;
                    }
                    const value = tag.slice(firstQuote + 1, lastQuote);
                    const finalValue = _parseFilterValue(value);
                    return {
                        success: true,
                        eventName: eventName,
                        tag: originalTag,
                        filter: {
                            tag: tagName,
                            value: finalValue,
                        },
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
                        tag: originalTag,
                        filter: null,
                    };
                }
            }

            return {
                success: false,
                partialSuccess: true,
                tag: originalTag,
                eventName: eventName,
            };
        }
    }
    return {
        success: false,
        partialSuccess: false,
        tag: originalTag,
        eventName: null,
    };
}

/**
 * Gets the user mode value from the given file.
 * @param object The file.
 */
export function getUserMode(object: Object): UserMode {
    return object.tags['aux._mode'] || DEFAULT_USER_MODE;
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
export function calculateFileValueAsFile(
    context: FileCalculationContext,
    file: File,
    tag: string,
    defaultValue: File
): File {
    if (file.tags[tag]) {
        const result = calculateFileValue(context, file, tag);
        if (isFile(result)) {
            return result;
        }
    }
    return defaultValue;
}

/**
 * Calculates the value of the given tag on the given file as a list of strings.
 * @param context The calculation context.
 * @param file The file.
 * @param tag The tag.
 * @param defaultValue The default value.
 */
export function calculateStringListTagValue(
    context: FileCalculationContext,
    file: File,
    tag: string,
    defaultValue: string[]
): string[] {
    let value: any = calculateFileValue(context, file, tag);

    if (typeof value === 'undefined' || value === null || value === '') {
        return defaultValue;
    } else if (!Array.isArray(value)) {
        value = [value];
    }

    if (value) {
        for (let i = 0; i < value.length; i++) {
            let v = value[i];
            if (typeof v !== 'undefined' && v !== null) {
                value[i] = v.toString();
            }
        }
    }

    return value;
}

/**
 * Calculates the value of the given tag on the given file. If the result is not a number, then the given default value
 * is returned.
 * @param fileManager The file manager.
 * @param file The file.
 * @param tag The tag.
 * @param defaultValue The default value to use if the tag doesn't exist or the result is not a number.
 */
export function calculateNumericalTagValue(
    context: FileCalculationContext,
    file: Object,
    tag: string,
    defaultValue: number
): number {
    if (typeof file.tags[tag] !== 'undefined') {
        const result = calculateFileValue(context, file, tag);
        if (typeof result === 'number' && result !== null) {
            return result;
        }
    }
    return defaultValue;
}

/**
 * Calculates the value of the given tag on the given file. If the result is not a boolean, then the given default value is returned.
 * @param context The context.
 * @param file The file.
 * @param tag The tag.
 * @param defaultValue The default value to use.
 */
export function calculateBooleanTagValue(
    context: FileCalculationContext,
    file: Object,
    tag: string,
    defaultValue: boolean
): boolean {
    if (typeof file.tags[tag] !== 'undefined') {
        const result = calculateFileValue(context, file, tag);
        if (typeof result === 'boolean' && result !== null) {
            return result;
        }
    }
    return defaultValue;
}

/**
 * Determines if the given file is able to be destroyed.
 * Defaults to true.
 * @param calc The file calculation context.
 * @param file The file to check.
 */
export function isDestroyable(calc: FileCalculationContext, file: Object) {
    return calculateBooleanTagValue(calc, file, 'aux.destroyable', true);
}

/**
 * Determines if the given file is able to be edited by the file sheet.
 * Defaults to true.
 * @param calc The file calculation context.
 * @param file The file to check.
 */
export function isEditable(calc: FileCalculationContext, file: Object) {
    return calculateBooleanTagValue(calc, file, 'aux.editable', true);
}

/**
 * Determines if the given file is trying to load a simulation.
 * @param calc The calculation context.
 * @param file The file to check.
 */
export function isSimulation(
    calc: FileCalculationContext,
    file: Object
): boolean {
    return !!getFileChannel(calc, file);
}

/**
 * Gets the aux.channel tag from the given file.
 * @param calc The file calculation context to use.
 * @param file The file.
 */
export function getFileChannel(
    calc: FileCalculationContext,
    file: Object
): string {
    return calculateFileValue(calc, file, 'aux.channel');
}

/**
 * Gets the first file which is in the aux.channels context that has the aux.channel tag set to the given ID.
 * @param calc The file calculation context.
 * @param id The ID to search for.
 */
export function getChannelFileById(calc: FileCalculationContext, id: string) {
    const files = calc.objects.filter(o => {
        return (
            isFileInContext(calc, o, 'aux.channels') &&
            calculateFileValue(calc, o, 'aux.channel') === id
        );
    });

    if (files.length > 0) {
        return files[0];
    } else {
        return null;
    }
}

/**
 * Gets the number of connected devices that are connected to the channel that
 * the given file is for.
 * @param calc The file calculation context.
 * @param file The file.
 */
export function getChannelConnectedDevices(
    calc: FileCalculationContext,
    file: File
): number {
    return calculateNumericalTagValue(
        calc,
        file,
        'aux.channel.connectedSessions',
        0
    );
}

/**
 * Gets the maximum number of devices that are allowed to connect to the channel simultaniously.
 * @param calc The file calculation context.
 * @param file The channel file.
 */
export function getChannelMaxDevicesAllowed(
    calc: FileCalculationContext,
    file: File
): number {
    return calculateNumericalTagValue(
        calc,
        file,
        'aux.channel.maxSessionsAllowed',
        null
    );
}

/**
 * Gets the maximum number of devices that are allowed to connect to the channel simultaniously.
 * @param calc The file calculation context.
 * @param file The channel file.
 */
export function getMaxDevicesAllowed(
    calc: FileCalculationContext,
    file: File
): number {
    return calculateNumericalTagValue(
        calc,
        file,
        'aux.maxSessionsAllowed',
        null
    );
}

/**
 * Gets the number of connected devices that are connected from the given globals file.
 * @param calc The file calculation context.
 * @param file The globals file.
 */
export function getConnectedDevices(
    calc: FileCalculationContext,
    file: File
): number {
    return calculateNumericalTagValue(calc, file, 'aux.connectedSessions', 0);
}

/**
 * Returns wether or not the given file resides in the given context id.
 * @param context The file calculation context to run formulas with.
 * @param file The file.
 * @param contextId The id of the context that we are asking if the file is in.
 */
export function isFileInContext(
    context: FileCalculationContext,
    file: Object,
    contextId: string
): boolean {
    if (!contextId) return false;

    let result: boolean;

    let contextValue = calculateFileValue(context, file, contextId.valueOf());

    if (
        typeof contextValue === 'object' &&
        typeof contextValue.valueOf === 'function'
    ) {
        contextValue = contextValue.valueOf();
    }

    if (typeof contextValue === 'string') {
        result = contextValue === 'true';
    } else if (typeof contextValue === 'number') {
        result = true;
    } else {
        result = contextValue === true;
    }

    if (!result && hasValue(file.tags['aux._user'])) {
        const userContextValue = calculateFileValue(
            context,
            file,
            'aux._userContext'
        );
        result = userContextValue == contextId;
    }

    return result;
}

/**
 * Gets the sort order that the given file should appear in the given context.
 * @param context The file calculation context.
 * @param file The file.
 * @param contextId The ID of the context that we're getting the sort order for.
 */
export function fileContextSortOrder(
    context: FileCalculationContext,
    file: File,
    contextId: string
): number | string {
    if (!contextId) return NaN;

    const contextValue = calculateFileValue(
        context,
        file,
        `${contextId}.sortOrder`
    );
    if (typeof contextValue === 'string') {
        return contextValue;
    } else if (typeof contextValue === 'number') {
        return contextValue;
    } else {
        return 0;
    }
}

/**
 * Calculates the given formula and returns the result.
 * @param context The file calculation context to run formulas with.
 * @param formula The formula to use.
 * @param extras The extra data to include in callbacks to the interface implementation.
 * @param thisObj The object that should be used for the this keyword in the formula.
 */
export function calculateFormulaValue(
    context: FileSandboxContext,
    formula: string,
    extras: any = {},
    thisObj: any = null
) {
    const prevCalc = getCalculationContext();
    const prevEnergy = getEnergy();
    setCalculationContext(context);

    // TODO: Allow configuring energy per formula
    setEnergy(DEFAULT_ENERGY);

    const result = context.sandbox.run(formula, extras, context);

    setCalculationContext(prevCalc);
    setEnergy(prevEnergy);
    return result;
}

export function isUserActive(calc: FileCalculationContext, file: File) {
    const active = calculateBooleanTagValue(
        calc,
        file,
        `aux.user.active`,
        false
    );
    if (!active) {
        return false;
    }
    const lastActiveTime = calculateNumericalTagValue(
        calc,
        file,
        `aux._lastActiveTime`,
        0
    );
    if (lastActiveTime) {
        const milisecondsFromNow = Date.now() - lastActiveTime;
        return milisecondsFromNow < DEFAULT_USER_INACTIVE_TIME;
    } else {
        return false;
    }
}

export function shouldDeleteUser(file: File) {
    const lastActiveTime = file.tags[`aux._lastActiveTime`];
    if (lastActiveTime) {
        const milisecondsFromNow = Date.now() - lastActiveTime;
        return milisecondsFromNow > DEFAULT_USER_DELETION_TIME;
    } else {
        return false;
    }
}

function _parseFilterValue(value: string): any {
    if (isArray(value)) {
        const split = parseArray(value);
        return split.map(v => _parseFilterValue(v));
    } else if (isNumber(value)) {
        return parseFloat(value);
    } else if (value === 'true') {
        return true;
    } else if (value === 'false') {
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
    if (typeof value === 'string') {
        return value.indexOf(':') === 0 && value.indexOf('=') === 1;
    } else {
        return isAssignment(value);
    }
}

/**
 * Formats the given value and returns a string representing it.
 * @param value The value to format.
 */
export function formatValue(value: any): string {
    if (typeof value === 'object') {
        if (!value) {
            return null;
        } else if (Array.isArray(value)) {
            return `[${value.map(v => formatValue(v)).join(',')}]`;
        } else if (value instanceof Error) {
            return value.toString();
        } else {
            if (value.id) {
                return getShortId(value);
            } else {
                return JSON.stringify(value);
            }
        }
    } else if (typeof value !== 'undefined' && value !== null) {
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
 * @param energy (Optional) The amount of energy that the calculation has left. If not specified then there will be no energy limit and stack overflow errors will occur.
 */
export function calculateValue(
    context: FileSandboxContext,
    object: any,
    tag: keyof FileTags,
    formula: string,
    energy?: number
): any {
    if (isFormula(formula)) {
        const result = _calculateFormulaValue(
            context,
            object,
            tag,
            formula,
            energy
        );
        if (result.success) {
            return result.result;
        } else {
            throw result.error;
        }
    } else if (isAssignment(formula)) {
        const obj: Assignment = <any>formula;
        return obj.value;
    } else if (isArray(formula)) {
        const split = parseArray(formula);
        return split.map(s =>
            calculateValue(context, object, tag, s.trim(), energy)
        );
    } else if (isNumber(formula)) {
        return parseFloat(formula);
    } else if (formula === 'true') {
        return true;
    } else if (formula === 'false') {
        return false;
    } else {
        return formula;
    }
}

/**
 * Calculates the value of the given formula and ensures that the result is a transferrable value.
 * @param context The file calculation context to use.
 * @param object The object that the formula was from.
 * @param tag The tag that the formula was from.
 * @param formula The formula to calculate the value of.
 */
export function calculateCopiableValue(
    context: FileSandboxContext,
    object: any,
    tag: keyof FileTags,
    formula: string
): any {
    try {
        const value = calculateValue(context, object, tag, formula);
        return convertToCopiableValue(value);
    } catch (err) {
        return convertToCopiableValue(err);
    }
}

/**
 * Converts the given value to a copiable value.
 * Copiable values are strings, numbers, booleans, arrays, and objects made of any of those types.
 * Non-copiable values are functions and errors.
 * @param value
 */
export function convertToCopiableValue(value: any): any {
    if (typeof value === 'function') {
        return `[Function ${value.name}]`;
    } else if (value instanceof Error) {
        return `${value.name}: ${value.message}`;
    } else if (typeof value === 'object') {
        if (isFile(value)) {
            return {
                id: value.id,
                tags: value.tags,
            };
        } else if (Array.isArray(value)) {
            return value.map(val => convertToCopiableValue(val));
        } else {
            return mapValues(value, val => convertToCopiableValue(val));
        }
    }
    return value;
}

function _calculateFormulaValue(
    context: FileSandboxContext,
    object: any,
    tag: keyof FileTags,
    formula: string,
    energy?: number
) {
    const prevCalc = getCalculationContext();
    setCalculationContext(context);

    // NOTE: The energy should not get reset
    // here because then infinite formula loops would be possible.
    const result = context.sandbox.run(
        formula,
        {
            formula,
            tag,
            context,
        },
        object
    );

    setCalculationContext(prevCalc);
    return result;
}
