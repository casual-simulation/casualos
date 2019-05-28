import { Vector2, Vector3, Group } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { WorkspaceMesh } from '../../../shared/scene/WorkspaceMesh';
import {
    File,
    FileEvent,
    FileCalculationContext,
    fileRemoved,
    calculateDestroyFileEvents,
    removeFromContextDiff,
    fileUpdated,
    action,
    calculateActionEvents,
    DESTROY_ACTION_NAME,
    getFileDragMode,
    toast,
    getShortId,
} from '@casual-simulation/aux-common';

import { setParent } from '../../../shared/scene/SceneUtils';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { BuilderGroup3D } from '../../../shared/scene/BuilderGroup3D';
import { AuxFile3DDecoratorFactory } from '../../../shared/scene/decorators/AuxFile3DDecoratorFactory';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { Input } from '../../../shared/scene/Input';
import GameView from '../../GameView/GameView';
import TrashCan from '../../TrashCan/TrashCan';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { BuilderSimulation3D } from '../../scene/BuilderSimulation3D';

/**
 * Shared class for both BuilderFileDragOperation and BuilderNewFileDragOperation.
 */
export abstract class BaseBuilderFileDragOperation extends BaseFileDragOperation {
    // Override base class IGameView
    // protected _gameView: GameView;
    // Override base class BaseInteractionManager
    protected _interaction: BuilderInteractionManager;

    protected _gridWorkspace: WorkspaceMesh;

    private _freeDragGroup: Group;
    private _freeDragMeshes: AuxFile3D[];
    private _freeDragDistance: number;

    /**
     * Gets whether the files are currently being placed on a workspace.
     */
    protected _isOnWorkspace(): boolean {
        return !this._freeDragGroup;
    }

    protected get gameView(): GameView {
        return <GameView>super.gameView;
    }

    /**
     * Create a new drag rules.
     */
    constructor(
        simulation3D: Simulation3D,
        interaction: BuilderInteractionManager,
        files: File[],
        context: string
    ) {
        super(simulation3D, interaction, files, context);

        this.gameView.showTrashCan = true;
    }

    protected _onDrag(calc: FileCalculationContext) {
        const mousePagePos = this.gameView.getInput().getMousePagePos();
        const {
            good,
            gridPosition,
            workspace,
        } = this._interaction.pointOnWorkspaceGrid(
            calc,
            mousePagePos,
            this.gameView.getMainCameraRig().mainCamera
        );

        if (this._files.length > 0) {
            if (good) {
                this._dragFilesOnWorkspace(calc, workspace, gridPosition);
            } else {
                this._dragFilesFree(calc);
            }
        }
    }

    protected _onDragReleased(calc: FileCalculationContext): void {
        super._onDragReleased(calc);

        // Button has been released.
        if (this._freeDragGroup) {
            this._releaseFreeDragGroup(this._freeDragGroup);
            this._freeDragGroup = null;

            // Destroy files if free dragging them (trash can)!
            this._destroyOrRemoveFiles(calc, this._files);
        }
        this.gameView.showTrashCan = false;
    }

    protected _dragFilesOnWorkspace(
        calc: FileCalculationContext,
        workspace: BuilderGroup3D,
        gridPosition: Vector2
    ): void {
        if (this._freeDragGroup) {
            this._releaseFreeDragGroup(this._freeDragGroup);
            this._freeDragGroup = null;
        }

        this._showGrid(workspace);

        this._previousContext = null;
        if (!workspace.contexts.get(this._context)) {
            const next = this._interaction.firstContextInWorkspace(workspace);
            this._previousContext = this._context;
            this._context = next;
        }

        // calculate index for file
        const result = this._calcWorkspaceDragPosition(calc, gridPosition);

        this._combine = result.combine;
        this._merge = result.merge;
        this._other = result.other;

        if (result.stackable || result.index === 0) {
            this._updateFilesPositions(this._files, gridPosition, result.index);
        }
    }

    protected _dragFilesFree(calc: FileCalculationContext): void {
        const mouseDir = Physics.screenPosToRay(
            this.gameView.getInput().getMouseScreenPos(),
            this.gameView.getMainCameraRig().mainCamera
        );
        const firstFileExists = true;

        if (firstFileExists) {
            // Move the file freely in space at the distance the file is currently from the camera.
            if (!this._freeDragGroup) {
                this._freeDragMeshes = this._files.map(f =>
                    this._createDragMesh(calc, f)
                );
                this._freeDragGroup = this._createFreeDragGroup(
                    this._freeDragMeshes
                );

                this._updateFileContexts(this._files, false);

                // Calculate the distance to perform free drag at.
                const fileWorldPos = this._freeDragMeshes[0].getWorldPosition(
                    new Vector3()
                );
                const cameraWorldPos = this.gameView
                    .getMainCameraRig()
                    .mainCamera.getWorldPosition(new Vector3());
                this._freeDragDistance = cameraWorldPos.distanceTo(
                    fileWorldPos
                );
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

    protected _destroyOrRemoveFiles(
        calc: FileCalculationContext,
        files: File[]
    ) {
        if (this._isOverTrashCan()) {
            this._destroyFiles(calc, files);
            return;
        }

        this._removeFromContext(calc, files);
    }

    /**
     * Determines whether the mouse is currently over the trash can.
     */
    protected _isOverTrashCan(): boolean {
        const input = this.gameView.getInput();
        if (
            input.isMouseButtonDownOnAnyElements(
                this.gameView.getUIHtmlElements()
            )
        ) {
            const element = input.getTargetData().inputOver;
            const vueElement = Input.getVueParent(element, TrashCan);
            return !!vueElement;
        }
        return false;
    }

    private _destroyFiles(calc: FileCalculationContext, files: File[]) {
        let events: FileEvent[] = [];
        const state = this.simulation.helper.filesState;

        // Remove the files from the context
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const actionData = action(
                DESTROY_ACTION_NAME,
                [file.id],
                this.simulation.helper.userFile.id
            );
            const result = calculateActionEvents(state, actionData);

            events.push(...result.events);
            events.push(...calculateDestroyFileEvents(calc, files[i]));
        }
        this.simulation.helper.transaction(
            ...events,
            toast(`Destroyed ${files.map(f => getShortId(f)).join(', ')}`)
        );
    }

    private _removeFromContext(calc: FileCalculationContext, files: File[]) {
        let events: FileEvent[] = [];
        // Remove the files from the context
        for (let i = 0; i < files.length; i++) {
            events.push(
                fileUpdated(files[i].id, {
                    tags: removeFromContextDiff(calc, this._context),
                })
            );
        }
        this.simulation.helper.transaction(...events);
    }

    protected _calcWorkspaceDragPosition(
        calc: FileCalculationContext,
        gridPosition: Vector2
    ) {
        return this._calculateFileDragStackPosition(
            calc,
            this._context,
            gridPosition,
            ...this._files
        );
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
            setParent(fileMeshes[i], group, this.gameView.getScene());
        }

        // Add the group the scene.
        this.gameView.getScene().add(group);

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
        this.gameView.getScene().remove(group);
    }

    /**
     * Creates a mesh that visually represents the given file.
     * @param calc The file calculation context.
     * @param file The file.
     */
    protected _createDragMesh(
        calc: FileCalculationContext,
        file: File
    ): AuxFile3D {
        // Instance a file mesh to represent the file in its intial drag state before being added to the world.
        let mesh = new AuxFile3D(
            file,
            null,
            null,
            null,
            [],
            new AuxFile3DDecoratorFactory(this.gameView)
        );

        mesh.fileUpdated(file, [], calc);

        if (!mesh.parent) {
            this.gameView.getScene().add(mesh);
        } else {
            // KLUDGE: FileMesh will reparent the object to a workspace if the the file has a workspace assigned.
            // Setting the parent here will force the FileMesh to be in world space again.
            setParent(mesh, this.gameView.getScene(), this.gameView.getScene());
        }

        return mesh;
    }

    protected _allowCombine(): boolean {
        return false;
    }
}
