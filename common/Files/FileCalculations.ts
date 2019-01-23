import { Object, File, Workspace } from './File';
import uuid from 'uuid/v4';
import {
    flatMap,
    union,
    keys,
    intersection,
    some,
    assign,
} from 'lodash';
import { Sandbox } from '../Formulas/Sandbox';
import formulaLib from 'formula-lib';
import { FilterFunction, SandboxInterface } from '../Formulas/SandboxInterface';
import { PartialFile } from 'common/Files';

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
     * The sandbox that should be used to run JS.
     */
    sandbox: Sandbox;
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
    const fileTags = flatMap(files, f => {
        if (f.type === 'object') {
            return keys(f.tags);
        }
        return [];
    });
    // Only keep tags that don't start with an underscore (_)
    const nonHiddenTags = fileTags.filter(t => !(/^_/.test(t)))
    const tagsToKeep = union(nonHiddenTags, extraTags);
    const allTags = union(currentTags, tagsToKeep);

    const onlyTagsToKeep = intersection(allTags, tagsToKeep);

    return onlyTagsToKeep;
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
    return isFormula(value) || (isArray(value) && some(_parseArray(value), v => isFormula(v)));
}

/**
 * Determines if the given string value represents an array.
 */
export function isArray(value: string): boolean {
    return typeof value === 'string' && value.indexOf('[') === 0 && value.lastIndexOf(']') === value.length - 1;
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
 * Determines if the given tag matches the filter syntax.
 */
export function isFilterTag(tag: string) {
    const parsed = parseFilterTag(tag);
    return parsed.success;
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
 */
export function updateUserSelection(selectionId: string) {
    return {
        tags: {
            _selection: selectionId
        }
    };
}

/**
 * Gets a partial file that toggles whether the given file is apart of the given selection.
 * @param file The file.
 * @param selectionId The ID of the selection.
 */
export function toggleFileSelection(file: Object, selectionId: string) {
    return {
        tags: {
            [selectionId]: !(file.tags[selectionId])
        }
    };
}

/**
 * Creates a new selection id.
 */
export function newSelectionId() {
    return `_selection_${uuid()}`;
}

export function createFile(id = uuid(), tags: Object['tags'] = {
    _position: { x: 0, y: 0, z: 0},
    _workspace: <string>null
}) {
    const file: Object = {id: id, type: 'object', tags: tags};

    return file;
}

/**
 * Creates a new Workspace with default values.
 */
export function createWorkspace(): Workspace {
    return {
        id: uuid(),
        type: 'workspace',
        position: {x: 0, y: 0, z: 0},
        size: 0,
        grid: {}
    };
}

/**
 * Performs a pre-process step for updating the given file by nulling out falsy tags and also calculating assignments.
 * @param file The file to update.
 * @param newData The new data to assign to the file.
 * @param createContext A function that, when called, returns a new FileCalculationContext that can be used to calculate formulas for assignment expressions.
 */
export function updateFile(file: File, newData: PartialFile, createContext: () => FileCalculationContext) {
    if (newData.tags) {
        // Cleanup/preprocessing
        for (let property in newData.tags) {
            let value = newData.tags[property];
            if (!value) {
                newData.tags[property] = null;
            } else {
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
export function createCalculationContext(objects: Object[], lib: string = formulaLib): FileCalculationContext {
    const context = {
        sandbox: new Sandbox(lib)
    };
    context.sandbox.interface = new SandboxInterfaceImpl(objects, context);
    return context;
}

/**
 * Gets a list of tags for the given object that match the given event name.
 * @param file The file to test.
 * @param other The other file to test against.
 * @param eventName The event name to test.
 */
export function tagsMatchingFilter(file: Object, other: Object, eventName: string): string[] {
    const tags = keys(other.tags);
    return tags.filter(t => tagMatchesFilter(t, file, eventName));
}

/**
 * Determines if the given tag matches the given object and event.
 * @param tag 
 * @param file 
 * @param eventName 
 */
export function tagMatchesFilter(tag: string, file: Object, eventName: string): boolean {
    const parsed = parseFilterTag(tag);
    return parsed.success && parsed.eventName === eventName && file.tags[parsed.filter.tag] === parsed.filter.value;
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
                    return {
                        success: true,
                        eventName: eventName,
                        filter: {
                            tag: tagName,
                            value: value
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
                return value.id.substr(0, 5);
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
    const isString = typeof formula === 'string';
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
        const split = _parseArray(formula);
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

function _parseArray(value: string): string[] {
    return value.slice(1, value.length - 1).split(',');
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

    constructor(objects: Object[], context: FileCalculationContext) {
      this.objects = objects;
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