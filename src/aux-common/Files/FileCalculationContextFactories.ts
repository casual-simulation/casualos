import { Bot, PrecalculatedBot, FileTags, FilesState } from './File';
import {
    BotCalculationContext,
    BotSandboxContext,
} from './FileCalculationContext';
import {
    calculateFileValue,
    getActiveObjects,
    hasValue,
    objectsAtContextGridPosition,
} from './FileCalculations';
import { fileUpdated, UpdateBotAction } from './FileEvents';
import { SandboxLibrary, Sandbox, SandboxFactory } from '../Formulas/Sandbox';
import { EvalSandbox } from '../Formulas/EvalSandbox';
import formulaLib from '../Formulas/formula-lib';
import {
    SandboxInterface,
    FilterFunction,
    FileFilterFunction,
} from '../Formulas/SandboxInterface';
import uuid from 'uuid/v4';
import { values, sortBy, sortedIndexBy } from 'lodash';
import { merge } from '../utils';

export interface FormulaLibraryOptions {
    config?: { isBuilder: boolean; isPlayer: boolean };
}

/**
 * Creates a new formula library.
 */
export function createFormulaLibrary(
    options?: FormulaLibraryOptions
): SandboxLibrary {
    const defaultOptions: FormulaLibraryOptions = {
        config: { isBuilder: false, isPlayer: false },
    };
    const finalOptions = merge(defaultOptions, options || {});

    return merge(formulaLib, {
        player: {
            inDesigner: () => finalOptions.config.isBuilder,
        },
    });
}

/**
 * Creates a new file calculation context.
 * @param objects The objects that should be included in the context.
 * @param lib The library JavaScript that should be used.
 */
export function createCalculationContext(
    objects: Bot[],
    userId: string = null,
    lib: SandboxLibrary = formulaLib,
    createSandbox: SandboxFactory = lib => new EvalSandbox(lib)
): BotSandboxContext {
    const context = {
        sandbox: createSandbox(lib),
        objects: objects,
        cache: new Map(),
    };
    context.sandbox.interface = new SandboxInterfaceImpl(context, userId);
    return context;
}

export function createPrecalculatedContext(
    objects: PrecalculatedBot[]
): BotCalculationContext {
    const context = {
        objects: objects,
        cache: new Map(),
    };
    return context;
}

/**
 * Creates a new file calculation context from the given files state.
 * @param state The state to use.
 * @param userId The User ID that should be used.
 * @param library The library that should be used.
 * @param createSandbox The sandbox factory that should be used.
 */
export function createCalculationContextFromState(
    state: FilesState,
    userId?: string,
    library?: SandboxLibrary,
    createSandbox?: SandboxFactory
) {
    const objects = getActiveObjects(state);
    return createCalculationContext(objects, userId, library, createSandbox);
}

class SandboxInterfaceImpl implements SandboxInterface {
    private _userId: string;
    objects: Bot[];
    context: BotCalculationContext;

    private _fileMap: Map<string, FileTags>;

    constructor(context: BotCalculationContext, userId: string) {
        this.objects = sortBy(context.objects, 'id');
        this.context = context;
        this._userId = userId;
        this._fileMap = new Map();
    }

    /**
     * Adds the given file to the calculation context and returns a proxy for it.
     * @param file The file to add.
     */
    addFile(file: Bot): Bot {
        const index = sortedIndexBy(this.objects, file, f => f.id);
        this.objects.splice(index, 0, file);
        return file;
    }

    /**
     * Removes the given file from the calculation context.
     * @param file The file to remove.
     */
    removeFile(id: string): void {
        const index = sortedIndexBy(this.objects, { id }, f => f.id);
        this.objects.splice(index, 1);
    }

    listTagValues(tag: string, filter?: FilterFunction, extras?: any) {
        const tags = this.objects
            .map(o => this._calculateValue(o, tag))
            .filter(t => hasValue(t));
        const filtered = this._filterValues(tags, filter);
        return filtered;
    }

    listObjectsWithTag(tag: string, filter?: FilterFunction, extras?: any) {
        const objs = this.objects.filter(o =>
            hasValue(this._calculateValue(o, tag))
        );
        const filtered = this._filterObjects(objs, filter, tag);
        return filtered;
    }

    listObjects(...filters: FileFilterFunction[]): Bot[] {
        const filtered = this.objects.filter(o => {
            return filters.every(f => f(o));
        });

        const sortFuncs = filters
            .filter(f => typeof f.sort === 'function')
            .map(f => f.sort);
        const sorted = <Bot[]>(
            (sortFuncs.length > 0 ? sortBy(filtered, ...sortFuncs) : filtered)
        );
        return sorted;
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

        const objs = objectsAtContextGridPosition(this.context, context, {
            x,
            y,
        });
        return objs;
    }

    uuid(): string {
        return uuid();
    }

    userId(): string {
        return this._userId;
    }

    getTag(file: Bot, tag: string): any {
        const tags = this._getFileTags(file.id);
        if (tags.hasOwnProperty(tag)) {
            return tags[tag];
        }
        return calculateFileValue(this.context, file, tag);
    }

    setTag(file: Bot, tag: string, value: any): any {
        const tags = this._getFileTags(file.id);
        tags[tag] = value;
        return value;
    }

    getFileUpdates(): UpdateBotAction[] {
        const files = [...this._fileMap.entries()];
        const updates = files
            .filter(f => {
                return Object.keys(f[1]).length > 0;
            })
            .map(f =>
                fileUpdated(f[0], {
                    tags: f[1],
                })
            );

        return sortBy(updates, u => u.id);
    }

    private _filterValues(values: any[], filter: FilterFunction) {
        if (filter) {
            if (typeof filter === 'function') {
                return values.filter(filter);
            } else {
                return values.filter(t => t === filter);
            }
        } else {
            return values;
        }
    }

    private _filterObjects(objs: Bot[], filter: FilterFunction, tag: string) {
        if (filter) {
            if (typeof filter === 'function') {
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

    private _getFileTags(id: string): FileTags {
        if (this._fileMap.has(id)) {
            return this._fileMap.get(id);
        }
        const tags = {};
        this._fileMap.set(id, tags);
        return tags;
    }
}
