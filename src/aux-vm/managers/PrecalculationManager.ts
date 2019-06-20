import { DependencyManager, FileDependentInfo } from './DependencyManager';
import {
    FilesState,
    PrecalculatedFilesState,
    PrecalculatedTags,
    AuxObject,
    UpdatedFile,
    calculateFormulaValue,
    calculateCopiableValue,
    calculateValue,
    FileTags,
    FileSandboxContext,
    AuxCausalTree,
} from '@casual-simulation/aux-common';
import { StateUpdatedEvent } from './StateUpdatedEvent';
import { mapValues } from 'lodash';

/**
 * Defines a class that manages precalculating file state.
 */
export class PrecalculationManager {
    private _dependencies: DependencyManager;
    private _currentState: PrecalculatedFilesState;
    private _stateGetter: () => FilesState;
    private _contextFactory: () => FileSandboxContext;

    constructor(
        stateGetter: () => FilesState,
        contextFactory: () => FileSandboxContext
    ) {
        this._stateGetter = stateGetter;
        this._contextFactory = contextFactory;
        this._dependencies = new DependencyManager();
        this._currentState = {};
    }

    filesAdded(files: AuxObject[]): StateUpdatedEvent {
        const updated = this._dependencies.addFiles(files);
        const context = this._contextFactory();

        for (let file of files) {
            this._currentState[file.id] = {
                id: file.id,
                precalculated: true,
                tags: file.tags,
                values: mapValues(file.tags, (value, tag) =>
                    calculateCopiableValue(context, file, tag, value)
                ),
            };
        }

        this._updateFiles(updated, context);

        return {
            state: this._currentState,
            addedFiles: files.map(f => f.id),
            removedFiles: [],
            updatedFiles: Object.keys(updated),
        };
    }

    filesRemoved(fileIds: string[]): StateUpdatedEvent {
        const updated = this._dependencies.removeFiles(fileIds);
        const context = this._contextFactory();

        for (let fileId of fileIds) {
            delete this._currentState[fileId];
        }

        this._updateFiles(updated, context);

        return {
            state: this._currentState,
            addedFiles: [],
            removedFiles: fileIds,
            updatedFiles: Object.keys(updated),
        };
    }

    filesUpdated(updates: UpdatedFile[]): StateUpdatedEvent {
        const updated = this._dependencies.updateFiles(updates);
        const context = this._contextFactory();
        this._updateFiles(updated, context);

        return {
            state: this._currentState,
            addedFiles: [],
            removedFiles: [],
            updatedFiles: Object.keys(updated),
        };
    }

    private _updateFiles(
        updated: FileDependentInfo,
        context: FileSandboxContext
    ) {
        const originalState = this._stateGetter();
        // TODO: Make this use immutable objects
        for (let fileId in updated) {
            let file = this._currentState[fileId];
            const originalFile = originalState[fileId];
            file.tags = originalFile.tags;
            let update: PrecalculatedTags = {};
            const tags = updated[fileId];
            for (let tag of tags) {
                update[tag] = calculateCopiableValue(
                    context,
                    originalFile,
                    tag,
                    originalFile.tags[tag]
                );
            }
            file.values = Object.assign({}, file.values, update);
        }
    }
}
