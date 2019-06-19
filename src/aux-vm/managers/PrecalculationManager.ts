import { DependencyManager, FileDependentInfo } from './DependencyManager';
import {
    PrecalculatedFilesState,
    PrecalculatedTags,
    AuxObject,
    UpdatedFile,
    calculateFormulaValue,
    calculateValue,
    FileTags,
    FileCalculationContext,
} from '@casual-simulation/aux-common';
import { StateUpdatedEvent } from './StateUpdatedEvent';
import { FileHelper } from './FileHelper';
import { mapValues } from 'lodash';

/**
 * Defines a class that manages precalculating file state.
 */
export class PrecalculationManager {
    private _dependencies: DependencyManager;
    private _helper: FileHelper;
    private _currentState: PrecalculatedFilesState;

    constructor(helper: FileHelper) {
        this._helper = helper;
        this._dependencies = new DependencyManager();
        this._currentState = {};
    }

    filesAdded(files: AuxObject[]): StateUpdatedEvent {
        const updated = this._dependencies.addFiles(files);
        const context = this._helper.createContext();

        for (let file of files) {
            this._currentState[file.id] = {
                id: file.id,
                precalculated: true,
                tags: file.tags,
                values: mapValues(file.tags, (value, tag) =>
                    calculateValue(context, file, tag, value)
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
        const context = this._helper.createContext();

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
        const context = this._helper.createContext();
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
        context: FileCalculationContext
    ) {
        // TODO: Make this use immutable objects
        for (let fileId in updated) {
            let file = this._currentState[fileId];
            file.tags = this._helper.filesState[fileId].tags;
            let update: PrecalculatedTags = {};
            const tags = updated[fileId];
            for (let tag of tags) {
                update[tag] = calculateValue(
                    context,
                    file,
                    tag,
                    file.tags[tag]
                );
            }
            file.values = Object.assign({}, file.values, update);
        }
    }
}
