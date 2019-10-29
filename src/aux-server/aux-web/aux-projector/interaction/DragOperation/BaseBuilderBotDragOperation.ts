import { Vector2, Vector3, Group, Ray } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { WorkspaceMesh } from '../../../shared/scene/WorkspaceMesh';
import {
    Bot,
    BotAction,
    BotCalculationContext,
    botRemoved,
    calculateDestroyBotEvents,
    removeFromContextDiff,
    botUpdated,
    action,
    calculateActionEvents,
    DESTROY_ACTION_NAME,
    toast,
    getShortId,
    RemoveBotAction,
    calculateBotDragStackPosition,
} from '@casual-simulation/aux-common';

import { setParent } from '../../../shared/scene/SceneUtils';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { BuilderGroup3D } from '../../../shared/scene/BuilderGroup3D';
import { AuxBot3DDecoratorFactory } from '../../../shared/scene/decorators/AuxBot3DDecoratorFactory';
import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { Input } from '../../../shared/scene/Input';
import BuilderGameView from '../../BuilderGameView/BuilderGameView';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { BuilderSimulation3D } from '../../scene/BuilderSimulation3D';
import { BuilderGame } from '../../scene/BuilderGame';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';

/**
 * Shared class for both BuilderBotDragOperation and BuilderNewBotDragOperation.
 */
export abstract class BaseBuilderBotDragOperation extends BaseBotDragOperation {
    // Override base class BaseInteractionManager
    protected _interaction: BuilderInteractionManager;

    protected _gridWorkspace: WorkspaceMesh;

    private _freeDragGroup: Group;
    private _freeDragMeshes: AuxBot3D[];
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
        vrController: VRController3D | null,
        fromCoord: Vector2
    ) {
        super(
            simulation3D,
            interaction,
            bots,
            context,
            vrController,
            fromCoord
        );
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

        if (this._bots.length > 0) {
            if (good) {
                this._dragBotsOnWorkspace(calc, workspace, gridPosition);
            } else {
                this._dragBotsFree(calc);
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

    protected _updateBot(bot: Bot, data: Partial<Bot>) {
        this.simulation.recent.addBotDiff(bot);
        return super._updateBot(bot, data);
    }

    protected _dragBotsOnWorkspace(
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
        if (!workspace.contexts.has(this._context)) {
            const next = this._interaction.firstContextInWorkspace(workspace);
            this._previousContext = this._context;
            this._context = next;
        }

        // calculate index for bot
        const result = this._calcWorkspaceDragPosition(calc, gridPosition);

        this._combine = result.combine && this._allowCombine();
        this._merge = result.merge;
        this._other = result.other;

        if (result.stackable || result.index === 0) {
            this._updateBotsPositions(this._bots, gridPosition, result.index);
        }
    }

    protected _dragBotsFree(calc: BotCalculationContext): void {
        let inputRay: Ray;
        if (this._vrController) {
            inputRay = this._vrController.pointerRay;
        } else {
            inputRay = Physics.screenPosToRay(
                this.game.getInput().getMouseScreenPos(),
                this.game.getMainCameraRig().mainCamera
            );
        }

        // Move the bot freely in space at the distance the bot is currently from the camera.
        if (!this._freeDragGroup) {
            this._freeDragMeshes = this._bots.map(f =>
                this._createDragMesh(calc, f)
            );
            this._freeDragGroup = this._createFreeDragGroup(
                this._freeDragMeshes
            );

            this._updateBotContexts(this._bots, false);

            // Calculate the distance to perform free drag at.
            const botWorldPos = this._freeDragMeshes[0].getWorldPosition(
                new Vector3()
            );
            const cameraWorldPos = this.game
                .getMainCameraRig()
                .mainCamera.getWorldPosition(new Vector3());
            this._freeDragDistance = cameraWorldPos.distanceTo(botWorldPos);
        }

        this._freeDragMeshes.forEach(m => {
            m.botUpdated(m.bot, new Set(), calc);
            // m.frameUpdate(calc);
        });

        let worldPos = Physics.pointOnRay(inputRay, this._freeDragDistance);
        this._freeDragGroup.position.copy(worldPos);
        this._freeDragGroup.updateMatrixWorld(true);
    }

    private _destroyBots(calc: BotCalculationContext, bots: Bot[]) {
        let events: BotAction[] = [];
        let destroyedBots: string[] = [];

        // Remove the bots from the context
        for (let i = 0; i < bots.length; i++) {
            console.log(
                '[BaseBuilderBotDragOperation] Destroy bot:',
                bots[i].id
            );
            const bot = bots[i];

            const actionData = action(
                DESTROY_ACTION_NAME,
                [bot.id],
                this.simulation.helper.userBot.id
            );

            events.push(actionData);

            const destroyEvents = calculateDestroyBotEvents(calc, bots[i]);
            events.push(...destroyEvents);
            destroyedBots.push(
                ...destroyEvents
                    .filter(e => e.type === 'remove_bot')
                    .map((e: RemoveBotAction) => e.id)
            );

            this.simulation.botPanel.isOpen = false;
            this.simulation.recent.clear();
            this.simulation.recent.selectedRecentBot = null;
        }
        if (destroyedBots.length > 0) {
            events.push(
                toast(
                    `Destroyed ${destroyedBots
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
                '[BaseBuilderBotDragOperation] Remove bot from context:',
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
        return calculateBotDragStackPosition(
            calc,
            this._context,
            gridPosition,
            ...this._bots
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
     * @param bots The bot to include in the group.
     */
    private _createFreeDragGroup(botMeshes: AuxBot3D[]): Group {
        let firstBotMesh = botMeshes[0];

        // Set the group to the position of the first bot. Doing this allows us to more easily
        // inherit the height offsets of any other bots in the stack.
        let group = new Group();
        group.position.copy(firstBotMesh.getWorldPosition(new Vector3()));
        group.updateMatrixWorld(true);

        // Parent all the bots to the group.
        for (let i = 0; i < botMeshes.length; i++) {
            setParent(botMeshes[i], group, this.game.getScene());
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
     * Creates a mesh that visually represents the given bot.
     * @param calc The bot calculation context.
     * @param bot The bot.
     */
    protected _createDragMesh(calc: BotCalculationContext, bot: Bot): AuxBot3D {
        // Instance a bot mesh to represent the bot in its intial drag state before being added to the world.
        let mesh = new AuxBot3D(
            bot,
            null,
            null,
            [],
            new AuxBot3DDecoratorFactory(this.game)
        );

        mesh.botUpdated(bot, new Set(), calc);

        if (!mesh.parent) {
            this.game.getScene().add(mesh);
        } else {
            // KLUDGE: BotMesh will reparent the object to a workspace if the the bot has a workspace assigned.
            // Setting the parent here will force the BotMesh to be in world space again.
            setParent(mesh, this.game.getScene(), this.game.getScene());
        }

        return mesh;
    }

    protected _allowCombine(): boolean {
        return false;
    }
}
