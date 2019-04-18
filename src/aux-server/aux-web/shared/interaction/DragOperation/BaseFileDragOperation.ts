import { IOperation } from '../IOperation';
import { BaseInteractionManager } from '../BaseInteractionManager';
import { Vector2} from 'three';
import { 
    File,
    fileUpdated, 
    PartialFile, 
    FileEvent,
    updateFile,
    FileCalculationContext,
    objectsAtContextGridPosition,
    isFileStackable,
    getFileIndex,
    isDiff,
    getDiffUpdate,
    fileRemoved,
    COMBINE_ACTION_NAME,
    isMergeable,
    DRAG_OUT_OF_CONTEXT_ACTION_NAME,
    DROP_IN_CONTEXT_ACTION_NAME,
    action,
    calculateActionEvents
} from '@casual-simulation/aux-common';

import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { IGameView } from '../../../shared/IGameView';
import { appManager } from '../../../shared/AppManager';
import { differenceBy, maxBy } from 'lodash';

/**
 * Shared class for both FileDragOperation and NewFileDragOperation.
 */
export abstract class BaseFileDragOperation implements IOperation {

    protected _gameView: IGameView;
    protected _interaction: BaseInteractionManager;
    protected _files: File[];
    protected _file: File;
    protected _finished: boolean;
    protected _lastScreenPos: Vector2;
    protected _combine: boolean;
    protected _merge: boolean;
    protected _other: File;
    protected _context: string;
    protected _previousContext: string;
    protected _originalContext: string;

    private _inContext: boolean;

    /**
     * Create a new drag rules.
     * @param gameView The game view.
     * @param interaction The interaction manager.
     * @param files The files to drag.
     * @param context The context that the files are currently in.
     */
    constructor(gameView: IGameView, interaction: BaseInteractionManager, files: File[], context: string) {
        this._gameView = gameView;
        this._interaction = interaction;
        this._setFiles(files);
        this._lastScreenPos = this._gameView.getInput().getMouseScreenPos();
        this._originalContext = this._context = context;
        this._previousContext = null;
        this._inContext = true;
    }

    update(calc: FileCalculationContext): void {
        if (this._finished) return;

        if (this._gameView.getInput().getMouseButtonHeld(0)) {
            const curScreenPos = this._gameView.getInput().getMouseScreenPos();

            if (!curScreenPos.equals(this._lastScreenPos)) {

                this._onDrag(calc);

                this._lastScreenPos = curScreenPos;
            }

        } else {

            this._onDragReleased(calc);

            // This drag operation is finished.
            this._finished = true;

        }
    }

    isFinished(): boolean {
        return this._finished;
    }

    dispose(): void {
        this._disposeCore();
        this._gameView.setGridsVisible(false);
        this._files = null;
        this._file = null;
    }

    protected _disposeCore() {
        // Combine files.
        if (this._merge && this._other) {
            const update = getDiffUpdate(this._file);
            appManager.fileManager.transaction(
                fileUpdated(this._other.id, update),
                fileRemoved(this._file.id)
            );
        } else if (this._combine && this._other) {
            appManager.fileManager.action(COMBINE_ACTION_NAME, [this._file, this._other]);
        } else if (isDiff(this._file)) {
            appManager.fileManager.transaction(
                fileUpdated(this._file.id, {
                    tags: {
                        'aux._diff': null,
                        'aux._diffTags': null
                    }
                })
            );
        }
    }

    protected _setFiles(files: File[]) {
        this._files = files;
        if (this._files.length == 1) {
            this._file = this._files[0];
        }
    }

    protected _updateFilesPositions(files: File[], gridPosition: Vector2, index: number) {

        this._inContext = true;
        let events: FileEvent[] = [];
        for (let i = 0; i < files.length; i++) {
            let tags = {
                tags: {
                    [this._context]: true,
                    [`${this._context}.x`]: gridPosition.x,
                    [`${this._context}.y`]: gridPosition.y,
                    [`${this._context}.index`]: index + i
                }
            };
            if (this._previousContext) {
                tags.tags[this._previousContext] = null;
            }
             events.push(this._updateFile(files[i], tags));
        }

        appManager.fileManager.transaction(...events);
    }

    protected _updateFileContexts(files: File[], inContext: boolean) {
        this._inContext = inContext;
        let events: FileEvent[] = [];
        for (let i = 0; i < files.length; i++) {
            let tags = {
                tags: {
                    [this._context]: inContext,
                }
            };
             events.push(this._updateFile(files[i], tags));
        }

        appManager.fileManager.transaction(...events);
    }

    protected _updateFile(file: File, data: PartialFile): FileEvent {
        appManager.fileManager.recent.addFileDiff(file);
        updateFile(file, appManager.fileManager.userFile.id, data, () => appManager.fileManager.createContext());
        return fileUpdated(file.id, data);
    }

    /**
     * Calculates whether the given file should be stacked onto another file or if
     * it should be combined with another file.
     * @param calc The file calculation context.
     * @param context The context.
     * @param gridPosition The grid position that the file is being dragged to.
     * @param file The file that is being dragged.
     */
    protected _calculateFileDragStackPosition(calc: FileCalculationContext, context: string, gridPosition: Vector2, ...files: File[]) {
        const objs = differenceBy(objectsAtContextGridPosition(calc, context, gridPosition), files, f => f.id);

        const canMerge = objs.length >= 1 &&
            files.length === 1 &&
            isDiff(files[0]) && 
            isMergeable(calc, files[0]) && 
            isMergeable(calc, objs[0]);

        const canCombine = !canMerge && 
            objs.length === 1 && 
            files.length === 1 &&
            this._interaction.canCombineFiles(calc, files[0], objs[0]);

        // Can stack if we're dragging more than one file,
        // or (if the single file we're dragging is stackable and 
        // the stack we're dragging onto is stackable)
        const canStack = files.length !== 1 || 
            (isFileStackable(calc, files[0]) &&
             (objs.length === 0 || isFileStackable(calc, objs[0])));

        const index = this._nextAvailableObjectIndex(calc, context, gridPosition, files, objs);

        return {
            combine: canCombine,
            merge: canMerge,
            stackable: canStack,
            other: canCombine ? objs[0] : 
                canMerge ? objs[0] :
                null,
            index: index
        };
    }

    /**
     * Calculates the next available index that an object can be placed at on the given workspace at the
     * given grid position.
     * @param context The context.
     * @param gridPosition The grid position that the next available index should be found for.
     * @param files The files that we're trying to find the next index for.
     * @param objs The objects at the same grid position.
     */
    protected _nextAvailableObjectIndex(calc: FileCalculationContext, context: string, gridPosition: Vector2, files: File[], objs: File[]): number {
        const except = differenceBy(objs, files, f => f instanceof AuxFile3D ? f.file.id : f.id);

        const indexes = except.map(o => ({
            object: o,
            // TODO: Replace with context index
            index: getFileIndex(calc, o, context)
        }));

        // TODO: Improve to handle other scenarios like:
        // - Reordering objects
        // - Filling in gaps that can be made by moving files from the center of the list
        const maxIndex = maxBy(indexes, i => i.index);
        let nextIndex = 0;
        if (maxIndex) {
            // if (some(files, f => f.id === maxIndex.object.id)) {
            //     nextIndex = maxIndex.index;
            // } else {
            //     nextIndex = maxIndex.index + 1;
            // }
            nextIndex = maxIndex.index + 1;
        }

        return nextIndex;
    }

    protected _onDragReleased(calc: FileCalculationContext): void {
        if (this._context !== this._originalContext) {

            let events: FileEvent[] = [];
            if (this._originalContext) {
                // trigger drag out of context
                const result = appManager.fileManager.helper.actionEvents(DRAG_OUT_OF_CONTEXT_ACTION_NAME, this._files, this._originalContext);
                events.push(...result.events);
            }

            if (this._inContext) {
                // Trigger drag into context
                const result = appManager.fileManager.helper.actionEvents(DROP_IN_CONTEXT_ACTION_NAME, this._files, this._context);
                events.push(...result.events);
            }
        }
    }

    //
    // Abstractions
    //

    protected abstract _onDrag(calc:FileCalculationContext): void;
}
