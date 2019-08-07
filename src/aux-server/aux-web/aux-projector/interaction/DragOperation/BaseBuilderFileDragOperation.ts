import { Vector2, Vector3, Group, Ray } from 'three';
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
    toast,
    getShortId,
    FileRemovedEvent,
} from '@casual-simulation/aux-common';

import { setParent } from '../../../shared/scene/SceneUtils';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { BuilderGroup3D } from '../../../shared/scene/BuilderGroup3D';
import { AuxFile3DDecoratorFactory } from '../../../shared/scene/decorators/AuxFile3DDecoratorFactory';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { Input } from '../../../shared/scene/Input';
import BuilderGameView from '../../BuilderGameView/BuilderGameView';
import TrashCan from '../../TrashCan/TrashCan';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { BuilderSimulation3D } from '../../scene/BuilderSimulation3D';
import { BuilderGame } from '../../scene/BuilderGame';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';

/**
 * Shared class for both BuilderFileDragOperation and BuilderNewFileDragOperation.
 */
export abstract class BaseBuilderFileDragOperation extends BaseFileDragOperation {
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

    protected get game(): BuilderGame {
        return <BuilderGame>super.game;
    }

    /**
     * Create a new drag rules.
     */
    constructor(
        simulation3D: Simulation3D,
        interaction: BuilderInteractionManager,
        files: File[],
        context: string,
        vrController: VRController3D | null
    ) {
        super(simulation3D, interaction, files, context, vrController);

        this.game.gameView.showTrashCan = true;
    }

    protected _onDrag(calc: FileCalculationContext) {
        let input: Vector2 | Ray;

        if (this._vrController) {
            input = this._vrController.pointerRay;
        } else {
            input = this.game.getInput().getMousePagePos();
        }

        const {
            good,
            gridPosition,
            workspace,
        } = this._interaction.pointOnWorkspaceGrid(calc, input);

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

        this._simulation3D.simulation.filePanel.hideOnDrag(false);

        const trashcan = this._isOverTrashCan();

        // Button has been released.
        if (this._freeDragGroup) {
            this._releaseFreeDragGroup(this._freeDragGroup);
            this._freeDragGroup = null;

            if (!trashcan) {
                // Just remove from the context if free dragging and not over the trashcan.
                this._removeFromContext(calc, this._files);
            }
        }

        if (trashcan) {
            this._destroyFiles(calc, this._files);
        }

        this.game.gameView.showTrashCan = false;
    }

    protected _updateFile(file: File, data: Partial<File>) {
        this.simulation.recent.addFileDiff(file);
        return super._updateFile(file, data);
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
        let inputRay: Ray;
        if (this._vrController) {
            inputRay = this._vrController.pointerRay;
        } else {
            inputRay = Physics.screenPosToRay(
                this.game.getInput().getMouseScreenPos(),
                this.game.getMainCameraRig().mainCamera
            );
        }

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
            const cameraWorldPos = this.game
                .getMainCameraRig()
                .mainCamera.getWorldPosition(new Vector3());
            this._freeDragDistance = cameraWorldPos.distanceTo(fileWorldPos);
        }

        this._freeDragMeshes.forEach(m => {
            m.fileUpdated(m.file, [], calc);
            // m.frameUpdate(calc);
        });

        let worldPos = Physics.pointOnRay(inputRay, this._freeDragDistance);
        this._freeDragGroup.position.copy(worldPos);
        this._freeDragGroup.updateMatrixWorld(true);
    }

    /**
     * Determines whether the mouse is currently over the trash can.
     */
    protected _isOverTrashCan(): boolean {
        const input = this.game.getInput();
        if (input.isMouseFocusingOnAnyElements(this.game.getUIHtmlElements())) {
            const element = input.getTargetData().inputOver;
            const vueElement = Input.getVueParent(element, TrashCan);
            return !!vueElement;
        }
        return false;
    }

    private _destroyFiles(calc: FileCalculationContext, files: File[]) {
        let events: FileEvent[] = [];
        let destroyedFiles: string[] = [];

        // Remove the files from the context
        for (let i = 0; i < files.length; i++) {
            console.log(
                '[BaseBuilderFileDragOperation] Destroy file:',
                files[i].id
            );
            const file = files[i];

            const actionData = action(
                DESTROY_ACTION_NAME,
                [file.id],
                this.simulation.helper.userFile.id
            );

            events.push(actionData);

            const destroyEvents = calculateDestroyFileEvents(calc, files[i]);
            events.push(...destroyEvents);
            destroyedFiles.push(
                ...destroyEvents
                    .filter(e => e.type === 'file_removed')
                    .map((e: FileRemovedEvent) => e.id)
            );
        }
        if (destroyedFiles.length > 0) {
            events.push(
                toast(
                    `Destroyed ${destroyedFiles
                        .map(id => getShortId(id))
                        .join(', ')}`
                )
            );
        }
        this.simulation.helper.transaction(...events);
    }

    private _removeFromContext(calc: FileCalculationContext, files: File[]) {
        let events: FileEvent[] = [];
        // Remove the files from the context
        for (let i = 0; i < files.length; i++) {
            console.log(
                '[BaseBuilderFileDragOperation] Remove file from context:',
                files[i].id
            );
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
            setParent(fileMeshes[i], group, this.game.getScene());
        }

        // Add the group the scene.
        this.game.getScene().add(group);

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
        this.game.getScene().remove(group);
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
            new AuxFile3DDecoratorFactory(this.game)
        );

        mesh.fileUpdated(file, [], calc);

        if (!mesh.parent) {
            this.game.getScene().add(mesh);
        } else {
            // KLUDGE: FileMesh will reparent the object to a workspace if the the file has a workspace assigned.
            // Setting the parent here will force the FileMesh to be in world space again.
            setParent(mesh, this.game.getScene(), this.game.getScene());
        }

        return mesh;
    }

    protected _allowCombine(): boolean {
        return false;
    }
}
