import { DependencyManager, FileDependentInfo } from './DependencyManager';
import {
    FilesState,
    PrecalculatedFilesState,
    PrecalculatedBot,
    AuxObject,
    UpdatedFile,
    calculateCopiableValue,
    calculateValue,
    BotSandboxContext,
    hasValue,
    merge,
    convertToCopiableValue,
} from '@casual-simulation/aux-common';
import { StateUpdatedEvent } from './StateUpdatedEvent';

import { mapValues, omitBy } from 'lodash';

/**
 * Defines a class that manages precalculating file state.
 */
export class PrecalculationManager {
    private _dependencies: DependencyManager;
    private _currentState: PrecalculatedFilesState;
    private _stateGetter: () => FilesState;
    private _contextFactory: () => BotSandboxContext;

    /**
     * Whether errors from formulas should be logged.
     */
    logFormulaErrors: boolean = false;

    constructor(
        stateGetter: () => FilesState,
        contextFactory: () => BotSandboxContext
    ) {
        this._stateGetter = stateGetter;
        this._contextFactory = contextFactory;
        this._currentState = {};
        this._dependencies = new DependencyManager();
    }

    get dependencies(): DependencyManager {
        return this._dependencies;
    }

    get filesState() {
        return this._currentState;
    }

    filesAdded(files: AuxObject[]): StateUpdatedEvent {
        const updated = this._dependencies.addFiles(files);
        const context = this._contextFactory();

        let nextState: Partial<PrecalculatedFilesState> = {};

        for (let file of files) {
            nextState[file.id] = {
                id: file.id,
                precalculated: true,
                tags: file.tags,
                values: mapValues(file.tags, (value, tag) =>
                    calculateCopiableValue(context, file, tag, value)
                ),
            };
        }

        this._updateFiles(updated, context, nextState);

        this._currentState = omitBy(
            merge(this._currentState, nextState),
            val => val === null
        );

        return {
            state: nextState,
            addedFiles: files.map(f => f.id),
            removedFiles: [],
            updatedFiles: Object.keys(updated),
        };
    }

    filesRemoved(fileIds: string[]): StateUpdatedEvent {
        const updated = this._dependencies.removeFiles(fileIds);
        const context = this._contextFactory();

        let nextState: Partial<PrecalculatedFilesState> = {};
        for (let fileId of fileIds) {
            nextState[fileId] = null;
        }

        this._updateFiles(updated, context, nextState);

        this._currentState = omitBy(
            merge(this._currentState, nextState),
            val => val === null
        );

        return {
            state: nextState,
            addedFiles: [],
            removedFiles: fileIds,
            updatedFiles: Object.keys(updated),
        };
    }

    filesUpdated(updates: UpdatedFile[]): StateUpdatedEvent {
        const updated = this._dependencies.updateFiles(updates);
        const context = this._contextFactory();

        let nextState: Partial<PrecalculatedFilesState> = {};

        for (let update of updates) {
            let nextUpdate = (nextState[update.file.id] = <PrecalculatedBot>{
                tags: {},
                values: {},
            });
            for (let tag of update.tags) {
                nextUpdate.tags[tag] = update.file.tags[tag];
            }
        }

        this._updateFiles(updated, context, nextState);

        this._currentState = omitBy(
            merge(this._currentState, nextState),
            val => val === null
        );

        return {
            state: nextState,
            addedFiles: [],
            removedFiles: [],
            updatedFiles: Object.keys(updated),
        };
    }

    private _updateFiles(
        updated: FileDependentInfo,
        context: BotSandboxContext,
        nextState: Partial<PrecalculatedFilesState>
    ) {
        const originalState = this._stateGetter();
        for (let fileId in updated) {
            const originalFile = originalState[fileId];
            if (!originalFile) {
                continue;
            }
            let update: Partial<PrecalculatedBot> = nextState[fileId];
            if (!update) {
                update = {
                    values: {},
                };
            }
            const tags = updated[fileId];
            for (let tag of tags) {
                const originalTag = originalFile.tags[tag];
                if (hasValue(originalTag)) {
                    try {
                        const value = calculateValue(
                            context,
                            originalFile,
                            tag,
                            originalTag
                        );
                        if (this.logFormulaErrors && value instanceof Error) {
                            console.error('[PrecalculationManager]', value);
                        }
                        update.values[tag] = convertToCopiableValue(value);
                    } catch (value) {
                        if (this.logFormulaErrors && value instanceof Error) {
                            console.error('[PrecalculationManager]', value);
                        }
                        update.values[tag] = convertToCopiableValue(value);
                    }
                } else {
                    update.tags[tag] = null;
                    update.values[tag] = null;
                }
            }
            nextState[fileId] = <PrecalculatedBot>update;
        }
    }
}
