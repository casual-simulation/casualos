import { Vector2, Vector3, Group } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { WorkspaceMesh } from '../../../shared/scene/WorkspaceMesh';
import { 
    File,
    FileEvent,
    FileCalculationContext,
} from '@yeti-cgi/aux-common';

import { setParent } from '../../../shared/scene/SceneUtils';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { BuilderGroup3D } from '../../../shared/scene/BuilderGroup3D';
import { AuxFile3DDecoratorFactory } from '../../../shared/scene/decorators/AuxFile3DDecoratorFactory';
import { appManager } from '../../../shared/AppManager';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import GameView from '../../GameView/GameView';

/**
 * Shared class for both BuilderFileDragOperation and BuilderNewFileDragOperation.
 */
export abstract class BaseBuilderFileDragOperation extends BaseFileDragOperation {

    // Override base class IGameView
    protected _gameView: GameView;
    // Override base class BaseInteractionManager
    protected _interaction: BuilderInteractionManager;

    protected _gridWorkspace: WorkspaceMesh;

    private _freeDragGroup: Group;
    private _freeDragMeshes: AuxFile3D[];
    private _freeDragDistance: number;

    /**
     * Create a new drag rules.
     */
    constructor(gameView: GameView, interaction: BuilderInteractionManager, files: File[], context: string) {
        super(gameView, interaction, files, context);
    }

    protected _onDrag(calc: FileCalculationContext) {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.mainCamera);
        const { good, gridPosition, height, workspace } = this._interaction.pointOnWorkspaceGrid(calc, mouseDir);

        if (this._files.length > 0) {
            if (good) {
                this._dragFilesOnWorkspace(calc, workspace, gridPosition, height);
            } else {
                this._dragFilesFree(calc);
            }
        }
    }

    protected _onDragReleased(): void {
        // Button has been released.
        if (this._freeDragGroup) {
            this._releaseFreeDragGroup(this._freeDragGroup);
            this._freeDragGroup = null;
            
            // Destroy files if free dragging them (trash can)!
            this._destroyFiles(this._files);
        }
    }

    protected _dragFilesOnWorkspace(calc: FileCalculationContext, workspace: BuilderGroup3D, gridPosition: Vector2, height: number): void {
        if (this._freeDragGroup) {
            this._releaseFreeDragGroup(this._freeDragGroup);
            this._freeDragGroup = null;
        }

        this._showGrid(workspace);

        this._previousContext= null;
        if (!workspace.contexts.get(this._context)) {
            const next = this._interaction.firstContextInWorkspace(workspace);
            this._previousContext = this._context;
            this._context = next;
        }

        // calculate index for file
        const result = this._calcWorkspaceDragPosition(calc, gridPosition);

        this._combine = result.combine;
        this._other = result.other;

        if (result.stackable || result.index === 0) {
            this._updateFilesPositions(this._files, gridPosition, height, result.index);
        }
    }

    protected _dragFilesFree(calc: FileCalculationContext): void {
        const mouseDir = Physics.screenPosToRay(this._gameView.input.getMouseScreenPos(), this._gameView.mainCamera);
        const firstFileExists = true;
        
        if (firstFileExists) {
            // Move the file freely in space at the distance the file is currently from the camera.
            if (!this._freeDragGroup) {
                this._freeDragMeshes = this._files.map(f => this._createDragMesh(calc, f));
                this._freeDragGroup = this._createFreeDragGroup(this._freeDragMeshes);

                this._updateFileContexts(this._files, false);

                // Calculate the distance to perform free drag at.
                const fileWorldPos = this._freeDragMeshes[0].getWorldPosition(new Vector3());
                const cameraWorldPos = this._gameView.mainCamera.getWorldPosition(new Vector3());
                this._freeDragDistance = cameraWorldPos.distanceTo(fileWorldPos);
            }

            this._freeDragMeshes.forEach(m => {
                m.fileUpdated(m.file, [], calc);
                // m.frameUpdate(calc);
            });

            let worldPos = Physics.pointOnRay(mouseDir, this._freeDragDistance);
            this._freeDragGroup.position.copy(worldPos);
            this._freeDragGroup.updateMatrixWorld(true);
        }
    }

    protected _destroyFiles(files: File[]) {
        let events: FileEvent[] = [];
        // Mark the files as destroyed.
        for (let i = 0; i < files.length; i++) {
            events.push(this._updateFile(files[i], {
                tags: {
                    _destroyed: true
                }
            }));
        }

        appManager.fileManager.transaction(...events);
    }

    protected _calcWorkspaceDragPosition(calc: FileCalculationContext, gridPosition: Vector2) {
        return this._calculateFileDragPosition(calc, this._context, gridPosition, ...this._files);
    }

    protected _showGrid(workspace: BuilderGroup3D): void {
        if (this._gridWorkspace) {
            this._gridWorkspace.gridsVisible = false;
        }
        this._gridWorkspace = <WorkspaceMesh>workspace.surface;
        this._gridWorkspace.gridsVisible = true;
    }

    /**
     * Create a Group (Three Object3D) that the files can reside in during free dragging.
     * @param files The file to include in the group.
     */
    private _createFreeDragGroup(fileMeshes: AuxFile3D[]): Group {
        let firstFileMesh = fileMeshes[0];
        
        // Set the group to the position of the first file. Doing this allows us to more easily
        // inherit the height offsets of any other files in the stack.
        let group = new Group();
        group.position.copy(firstFileMesh.getWorldPosition(new Vector3()));
        group.updateMatrixWorld(true);

        // Parent all the files to the group.
        for (let i = 0; i < fileMeshes.length; i++) {
            setParent(fileMeshes[i], group, this._gameView.scene);
        }

        // Add the group the scene.
        this._gameView.scene.add(group);

        return group;
    }

    /**
     * Put the the files pack in the workspace and remove the group.
     */
    private _releaseFreeDragGroup(group: Group): void {
        this._freeDragMeshes.forEach(m => {
            m.dispose();
        });
        // Remove the group object from the scene.
        this._gameView.scene.remove(group);
    }

    /**
     * Creates a mesh that visually represents the given file.
     * @param calc The file calculation context.
     * @param file The file.
     */
    protected _createDragMesh(calc: FileCalculationContext, file: File): AuxFile3D {
        // Instance a file mesh to represent the file in its intial drag state before being added to the world.
        let mesh = new AuxFile3D(file, null, null, null, [], new AuxFile3DDecoratorFactory(this._gameView));
        
        mesh.fileUpdated(file, [], calc);

        if (!mesh.parent) {
            this._gameView.scene.add(mesh);
        } else {
            // KLUDGE: FileMesh will reparent the object to a workspace if the the file has a workspace assigned.
            // Setting the parent here will force the FileMesh to be in world space again.
            setParent(mesh, this._gameView.scene, this._gameView.scene);
        }

        return mesh;
    }
}
