import { Input } from '../../../shared/scene/Input';
import { IOperation } from '../IOperation';
import GameView from '../../GameView/GameView';
import { InteractionManager } from '../InteractionManager';
import { Ray, Intersection, Vector2, Vector3, Box3 } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { WorkspaceMesh } from '../../../shared/scene/WorkspaceMesh';
import { File, Workspace, Object, DEFAULT_WORKSPACE_SCALE, fileRemoved, fileUpdated, PartialFile, fileAdded, FileEvent } from '@yeti-cgi/aux-common/Files';
import { keys, minBy, flatMap } from 'lodash';
import { keyToPos, gridPosToRealPos, realPosToGridPos, Axial, gridDistance, posToKey } from '../../../shared/scene/hex';
import { createFile } from '@yeti-cgi/aux-common/Files/FileCalculations';
import { BaseFileDragOperation } from './BaseFileDragOperation';
import { appManager } from '../../../shared/AppManager';
import { merge } from '@yeti-cgi/aux-common/utils';
import { setParent } from '../../../shared/scene/SceneUtils';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { AuxFile } from '@yeti-cgi/aux-common';

/**
 * New File Drag Operation handles dragging of new files from the file queue.
 */
export class NewFileDragOperation extends BaseFileDragOperation {

    public static readonly FreeDragDistance: number = 6;

    private _fileAdded: boolean;
    private _initialDragMesh: AuxFile3D;

    /**
     * Create a new drag rules.
     * @param input the input module to interface with.
     * @param buttonId the button id of the input that this drag operation is being performed with. If desktop this is the mouse button
     */
    constructor(gameView: GameView, interaction: InteractionManager, duplicatedFile: File) {
        super(gameView, interaction, [duplicatedFile], null);
    }

    protected _updateFile(file: File, data: PartialFile): FileEvent {
        if (!this._fileAdded) {

            if (this._initialDragMesh) {
                this._releaseDragMesh(this._initialDragMesh);
                this._initialDragMesh = null;
            }

            // Add the duplicated file.
            this._file = merge(this._file, data || {});
            this._file = createFile(this._file.id, this._file.tags);
            this._files = [this._file];
            this._fileAdded = true;

            return fileAdded(this._file);
        } else {
            return super._updateFile(this._file, data);
        }
    }

    protected _onDragReleased(): void {
        if (this._initialDragMesh) {
            this._releaseDragMesh(this._initialDragMesh);
            this._initialDragMesh = null;
        }

        super._onDragReleased();
    }

    protected _dragFilesFree(): void {
        if (!this._fileAdded) {
            // New file has not been added yet, drag a dummy mesh to drag around until it gets added to a workspace.
            if (!this._initialDragMesh) {
                this._initialDragMesh = this._createDragMesh(this._file);
            }

            const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.mainCamera);
            let worldPos = Physics.pointOnRay(mouseDir, NewFileDragOperation.FreeDragDistance);
            this._initialDragMesh.position.copy(worldPos);
            this._initialDragMesh.updateMatrixWorld(true);
        } else {
            // New file has been added, just do the base file drag operation.
            super._dragFilesFree();
        }
    }

    protected _combineFiles(eventName: string) {
        if (this._fileAdded) {
            this._gameView.fileManager.action(this._file, this._other, eventName);
        }
    }

    private _createDragMesh(file: File): AuxFile3D {
        // Instance a file mesh to represent the file in its intial drag state before being added to the world.
        let mesh = new AuxFile3D(file, null, null, null, []);
        // mesh.allowNoWorkspace = true;
        
        // TODO: Fix
        // mesh.fileUpdated(file, []);

        if (!mesh.parent) {
            this._gameView.scene.add(mesh);
        } else {
            // KLUDGE: FileMesh will reparent the object to a workspace if the the file has a workspace assigned.
            // Setting the parent here will force the FileMesh to be in world space again.
            setParent(mesh, this._gameView.scene, this._gameView.scene);
        }


        return mesh;
    }

    private _releaseDragMesh(mesh: AuxFile3D): void {
        if (mesh) {
            mesh.dispose();
            this._gameView.scene.remove(mesh);
        }
    }
}