import { Vector2, Vector3, Group, Ray } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { WorkspaceMesh } from '../../../shared/scene/WorkspaceMesh';
import {
    Bot,
    BotAction,
    BotCalculationContext,
    botRemoved,
    calculateDestroyFileEvents,
    removeFromContextDiff,
    botUpdated,
    action,
    calculateActionEvents,
    DESTROY_ACTION_NAME,
    toast,
    getShortId,
    RemoveBotAction,
} from '@casual-simulation/aux-common';

import { setParent } from '../../../shared/scene/SceneUtils';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { BuilderGroup3D } from '../../../shared/scene/BuilderGroup3D';
import { AuxFile3DDecoratorFactory } from '../../../shared/scene/decorators/AuxFile3DDecoratorFactory';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { Input } from '../../../shared/scene/Input';
import BuilderGameView from '../../BuilderGameView/BuilderGameView';
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
     * Gets whether the bots are currently being placed on a workspace.
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
        bots: Bot[],
        context: string,
        vrController: VRController3D | null
    ) {
        super(simulation3D, interaction, bots, context, vrController);
    }

    protected _onDrag(calc: BotCalculationContext) {
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

    protected _onDragReleased(calc: BotCalculationContext): void {
        super._onDragReleased(calc);

        this._simulation3D.simulation.botPanel.hideOnDrag(false);

        // Button has been released.
        if (this._freeDragGroup) {
            this._releaseFreeDragGroup(this._freeDragGroup);
            this._freeDragGroup = null;
        }
    }

    protected _updateFile(file: Bot, data: Partial<Bot>) {
        this.simulation.recent.addBotDiff(file);
        return super._updateFile(file, data);
    }

    protected _dragFilesOnWorkspace(
        calc: BotCalculationContext,
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

    protected _dragFilesFree(calc: BotCalculationContext): void {
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
            m.botUpdated(m.file, [], calc);
            // m.frameUpdate(calc);
        });

        let worldPos = Physics.pointOnRay(inputRay, this._freeDragDistance);
        this._freeDragGroup.position.copy(worldPos);
        this._freeDragGroup.updateMatrixWorld(true);
    }

    private _destroyFiles(calc: BotCalculationContext, bots: Bot[]) {
        let events: BotAction[] = [];
        let destroyedFiles: string[] = [];

        // Remove the bots from the context
        for (let i = 0; i < bots.length; i++) {
            console.log(
                '[BaseBuilderFileDragOperation] Destroy file:',
                bots[i].id
            );
            const file = bots[i];

            const actionData = action(
                DESTROY_ACTION_NAME,
                [file.id],
                this.simulation.helper.userFile.id
            );

            events.push(actionData);

            const destroyEvents = calculateDestroyFileEvents(calc, bots[i]);
            events.push(...destroyEvents);
            destroyedFiles.push(
                ...destroyEvents
                    .filter(e => e.type === 'remove_bot')
                    .map((e: RemoveBotAction) => e.id)
            );

            this.simulation.botPanel.isOpen = false;
            this.simulation.recent.clear();
            this.simulation.recent.selectedRecentBot = null;
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

    private _removeFromContext(calc: BotCalculationContext, bots: Bot[]) {
        let events: BotAction[] = [];
        // Remove the bots from the context
        for (let i = 0; i < bots.length; i++) {
            console.log(
                '[BaseBuilderFileDragOperation] Remove file from context:',
                bots[i].id
            );
            events.push(
                botUpdated(bots[i].id, {
                    tags: removeFromContextDiff(calc, this._context),
                })
            );
        }
        this.simulation.helper.transaction(...events);
    }

    protected _calcWorkspaceDragPosition(
        calc: BotCalculationContext,
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
     * Create a Group (Three Object3D) that the bots can reside in during free dragging.
     * @param bots The file to include in the group.
     */
    private _createFreeDragGroup(fileMeshes: AuxFile3D[]): Group {
        let firstFileMesh = fileMeshes[0];

        // Set the group to the position of the first file. Doing this allows us to more easily
        // inherit the height offsets of any other bots in the stack.
        let group = new Group();
        group.position.copy(firstFileMesh.getWorldPosition(new Vector3()));
        group.updateMatrixWorld(true);

        // Parent all the bots to the group.
        for (let i = 0; i < fileMeshes.length; i++) {
            setParent(fileMeshes[i], group, this.game.getScene());
        }

        // Add the group the scene.
        this.game.getScene().add(group);

        return group;
    }

    /**
     * Put the the bots pack in the workspace and remove the group.
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
        calc: BotCalculationContext,
        file: Bot
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

        mesh.botUpdated(file, [], calc);

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
