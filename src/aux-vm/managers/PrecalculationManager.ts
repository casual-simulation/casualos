import { DependencyManager, FileDependentInfo } from './DependencyManager';
import {
    FilesState,
    PrecalculatedFilesState,
    PrecalculatedTags,
    PrecalculatedFile,
    AuxObject,
    UpdatedFile,
    calculateFormulaValue,
    calculateCopiableValue,
    calculateValue,
    FileTags,
    FileSandboxContext,
    AuxCausalTree,
    hasValue,
} from '@casual-simulation/aux-common';
import { StateUpdatedEvent } from './StateUpdatedEvent';
import { updateExpression } from '@babel/types';

import { mapValues } from 'lodash';

/**
 * Defines a class that manages precalculating file state.
 */
export class PrecalculationManager {
    private _dependencies: DependencyManager;
    private _stateGetter: () => FilesState;
    private _contextFactory: () => FileSandboxContext;

    constructor(
        stateGetter: () => FilesState,
        contextFactory: () => FileSandboxContext
    ) {
        this._stateGetter = stateGetter;
        this._contextFactory = contextFactory;
        this._dependencies = new DependencyManager();
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
            let nextUpdate = (nextState[update.file.id] = <PrecalculatedFile>{
                tags: {},
                values: {},
            });
            for (let tag of update.tags) {
                nextUpdate.tags[tag] = update.file.tags[tag];
            }
        }

        this._updateFiles(updated, context, nextState);

        return {
            state: nextState,
            addedFiles: [],
            removedFiles: [],
            updatedFiles: Object.keys(updated),
        };
    }

    private _updateFiles(
        updated: FileDependentInfo,
        context: FileSandboxContext,
        nextState: Partial<PrecalculatedFilesState>
    ) {
        const originalState = this._stateGetter();
        for (let fileId in updated) {
            let update: Partial<PrecalculatedFile> = nextState[fileId];
            if (!update) {
                update = {
                    values: {},
                };
            }
            const originalFile = originalState[fileId];
            const tags = updated[fileId];
            for (let tag of tags) {
                const originalTag = originalFile.tags[tag];
                if (hasValue(originalTag)) {
                    update.values[tag] = calculateCopiableValue(
                        context,
                        originalFile,
                        tag,
                        originalTag
                    );
                } else {
                    update.tags[tag] = null;
                    update.values[tag] = null;
                }
            }
            nextState[fileId] = <PrecalculatedFile>update;
        }
    }
}
