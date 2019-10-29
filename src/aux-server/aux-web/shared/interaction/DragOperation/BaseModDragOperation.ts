import { IOperation } from '../IOperation';
import { BaseInteractionManager } from '../BaseInteractionManager';
import { Vector2, Group } from 'three';
import {
    Bot,
    botUpdated,
    PartialBot,
    BotAction,
    BotCalculationContext,
    objectsAtContextGridPosition,
    isBotStackable,
    getBotIndex,
    isDiff,
    getDiffUpdate,
    botRemoved,
    COMBINE_ACTION_NAME,
    isMergeable,
    DROP_ACTION_NAME,
    DROP_ANY_ACTION_NAME,
    DIFF_ACTION_NAME,
    toast,
    createBot,
    DRAG_ANY_ACTION_NAME,
    DRAG_ACTION_NAME,
    BotTags,
    botAdded,
} from '@casual-simulation/aux-common';

import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import differenceBy from 'lodash/differenceBy';
import maxBy from 'lodash/maxBy';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { VRController3D, Pose } from '../../../shared/scene/vr/VRController3D';
import { AuxBot3DDecoratorFactory } from '../../scene/decorators/AuxBot3DDecoratorFactory';
import { setParent } from '../../scene/SceneUtils';

/**
 * Class that provides base functionality for dragging mods.
 */
export abstract class BaseModDragOperation implements IOperation {
    protected _simulation3D: Simulation3D;
    protected _interaction: BaseInteractionManager;
    protected _mod: BotTags;
    protected _finished: boolean;
    protected _lastScreenPos: Vector2;
    protected _lastGridPos: Vector2;
    protected _lastIndex: number;
    protected _lastVRControllerPose: Pose;
    protected _combine: boolean;
    protected _merge: boolean;
    protected _other: Bot;
    protected _context: string;
    protected _previousContext: string;
    protected _vrController: VRController3D;

    private _modGroup: Group;
    private _modMesh: AuxBot3D;

    protected _toCoord: Vector2;
    protected _fromCoord: Vector2;

    protected get game() {
        return this._simulation3D.game;
    }

    protected get bot() {
        return this._modMesh.bot;
    }

    get simulation() {
        return this._simulation3D.simulation;
    }

    /**
     * Create a new drag rules.
     * @param simulation3D The simulation.
     * @param interaction The interaction manager.
     * @param mod The mod to drag.
     * @param context The context that the bots are currently in.
     */
    constructor(
        simulation3D: Simulation3D,
        interaction: BaseInteractionManager,
        mod: BotTags,
        vrController: VRController3D | null,
        fromCoord?: Vector2
    ) {
        this._simulation3D = simulation3D;
        this._interaction = interaction;
        this._mod = mod;
        this._previousContext = null;
        this._lastGridPos = null;
        this._lastIndex = null;
        this._vrController = vrController;
        this._fromCoord = fromCoord;

        if (this._vrController) {
            this._lastVRControllerPose = this._vrController.worldPose.clone();
        } else {
            this._lastScreenPos = this._simulation3D.game
                .getInput()
                .getMouseScreenPos();
        }
    }

    update(calc: BotCalculationContext): void {
        if (this._finished) return;

        if (!this._modMesh) {
            const bot = createBot('mod', this._mod);
            this._modGroup = this._createGroup();
            this._modMesh = this._createDragMesh(calc, bot);
        }

        const buttonHeld: boolean = this._vrController
            ? this._vrController.getPrimaryButtonHeld()
            : this.game.getInput().getMouseButtonHeld(0);

        if (buttonHeld) {
            let shouldUpdateDrag: boolean;

            if (this._vrController) {
                const curPose = this._vrController.worldPose.clone();
                shouldUpdateDrag = !curPose.equals(this._lastVRControllerPose);
                this._lastVRControllerPose = curPose;
            } else {
                const curScreenPos = this.game.getInput().getMouseScreenPos();
                shouldUpdateDrag = !curScreenPos.equals(this._lastScreenPos);
                this._lastScreenPos = curScreenPos;
            }

            if (shouldUpdateDrag) {
                this._onDrag(calc);
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
        this.game.setGridsVisible(false);
        this._releaseMeshes();
        this._mod = null;
    }

    protected _disposeCore() {
        const mod = this._mod;
        // Combine bots.
        if (this._merge && this._other) {
            const update = {
                tags: mod,
            };
            const result = this.simulation.helper.actions([
                {
                    eventName: DIFF_ACTION_NAME,
                    bots: [this._other],
                    arg: {
                        diffs: this._mod,
                    },
                },
            ]);

            this.simulation.helper.transaction(
                botUpdated(this._other.id, update),
                ...result
            );
        } else if (this._combine && this._other) {
            const arg = { context: this._context };

            this.simulation.helper.action(
                COMBINE_ACTION_NAME,
                [this._other],
                arg
            );

            this.simulation.helper.action('onCombineExit', [this._other], mod);
        } else {
            this.simulation.helper.transaction(
                botAdded(createBot(undefined, mod))
            );
        }
    }

    protected async _updateModPosition(
        calc: BotCalculationContext,
        gridPosition: Vector2,
        index: number
    ) {
        if (!this._context) {
            return;
        }

        if (
            this._lastGridPos &&
            this._lastGridPos.equals(gridPosition) &&
            this._lastIndex === index
        ) {
            return;
        }

        this._toCoord = gridPosition;
        this._lastGridPos = gridPosition.clone();
        this._lastIndex = index;

        let tags = {
            [this._context]: true,
            [`${this._context}.x`]: gridPosition.x,
            [`${this._context}.y`]: gridPosition.y,
            [`${this._context}.sortOrder`]: index,
        };

        if (this._previousContext) {
            tags[this._previousContext] = null;
        }

        this._mod = {
            ...this._mod,
            ...tags,
        };

        this._modMesh.botUpdated(this._modMesh.bot, new Set([]), calc);
    }

    protected _updateModContexts(inContext: boolean) {
        if (!this._context) {
            return;
        }
        let tags = {
            [this._context]: inContext,
        };

        this._mod = {
            ...this._mod,
            ...tags,
        };
    }

    /**
     * Create a Group (Three Object3D) that the bots can reside in during free dragging.
     * @param bots The bot to include in the group.
     */
    private _createGroup(): Group {
        // Set the group to the position of the first bot. Doing this allows us to more easily
        // inherit the height offsets of any other bots in the stack.
        let group = new Group();
        group.updateMatrixWorld(true);

        // Add the group the scene.
        this.game.getScene().add(group);

        return group;
    }

    /**
     * Put the the bots pack in the workspace and remove the group.
     */
    private _releaseMeshes(): void {
        this._modMesh.dispose();
        // Remove the group object from the scene.
        this.game.getScene().remove(this._modGroup);
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

        this._modGroup.add(mesh);

        return mesh;
    }

    protected _onDragReleased(calc: BotCalculationContext): void {}

    //
    // Abstractions
    //

    // A checked function to verify that the stacks can combine
    protected _allowCombine(): boolean {
        return true;
    }
    protected abstract _onDrag(calc: BotCalculationContext): void;
}
