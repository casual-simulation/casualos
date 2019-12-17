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
    merge,
} from '@casual-simulation/aux-common';

import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import differenceBy from 'lodash/differenceBy';
import maxBy from 'lodash/maxBy';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { VRController3D, Pose } from '../../../shared/scene/vr/VRController3D';
import { AuxBot3DDecoratorFactory } from '../../scene/decorators/AuxBot3DDecoratorFactory';
import { setParent } from '../../scene/SceneUtils';
import { ContextGroup3D } from '../../../shared/scene/ContextGroup3D';

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
    protected _merge: boolean;
    protected _other: Bot;
    protected _bot: Bot;
    protected _context: string;
    protected _previousContext: string;
    protected _vrController: VRController3D;

    /**
     * The bot that the onModDropEnter event was sent to.
     */
    protected _dropBot: Bot;

    private _modMesh: AuxBot3D;

    protected _toCoord: Vector2;
    protected _fromCoord: Vector2;

    protected get game() {
        return this._simulation3D.game;
    }

    protected get bot() {
        return this._bot;
    }

    protected get contextGroup() {
        return this._modMesh.contextGroup;
    }

    protected set contextGroup(group: ContextGroup3D) {
        const prev = this.contextGroup;
        if (prev) {
            prev.display.remove(this._modMesh);
        }
        this._modMesh.contextGroup = group;
        if (group) {
            group.display.add(this._modMesh);
        }
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
            this._bot = createBot(undefined, this._mod);
            this._modMesh = this._createDragMesh(calc, this._bot);

            if (this.contextGroup) {
                this.contextGroup.display.add(this._modMesh);
            }
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

            let actions = [
                {
                    eventName: DIFF_ACTION_NAME,
                    bots: [this._other],
                    arg: {
                        diffs: this._mod,
                    },
                },
            ] as { eventName: string; bots: Bot[]; arg?: any }[];

            if (this._dropBot) {
                actions.unshift({
                    eventName: 'onModDropExit',
                    bots: [this._dropBot],
                    arg: {
                        mod: this._mod,
                        context: this._context,
                    },
                });
            }

            const result = this.simulation.helper.actions(actions);

            this.simulation.helper.transaction(
                botUpdated(this._other.id, update),
                ...result
            );
        } else if (this.contextGroup) {
            this.simulation.helper.transaction(botAdded(this._bot));
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
            [`${this._context}X`]: gridPosition.x,
            [`${this._context}Y`]: gridPosition.y,
            [`${this._context}SortOrder`]: index,
        };

        if (this._previousContext) {
            tags[this._previousContext] = null;
        }

        this._updateBot(calc, tags);
    }

    protected _updateModContexts(
        calc: BotCalculationContext,
        inContext: boolean
    ) {
        if (!this._context) {
            return;
        }
        let tags = {
            [this._context]: inContext,
        };

        this._updateBot(calc, tags);
    }

    protected _updateBot(calc: BotCalculationContext, tags: BotTags) {
        this._mod = merge(this._mod, tags);
        this._bot = {
            id: this._bot.id,
            tags: this._mod,
        };
        this._modMesh.context = this._context;

        const modBot = merge(this._bot, {
            tags: {
                auxShape: 'sphere',
            },
        });

        this._modMesh.botUpdated(modBot, new Set([]), calc);
    }

    /**
     * Put the the bots pack in the workspace and remove the group.
     */
    private _releaseMeshes(): void {
        if (this.contextGroup) {
            // Remove the mesh from the group.
            this.contextGroup.display.remove(this._modMesh);
        }
        this._modMesh.dispose();
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

        return mesh;
    }

    protected _sendDropEnterExitEvents(other: Bot) {
        const sim = this._simulation3D.simulation;
        const otherId = other ? other.id : null;
        const dropBotId = this._dropBot ? this._dropBot.id : null;
        const changed = otherId !== dropBotId;
        if (this._dropBot && changed) {
            const otherBot = this._dropBot;
            this._dropBot = null;
            sim.helper.action('onModDropExit', [otherBot], {
                mod: this._mod,
                context: this._context,
            });
        }
        if (other && changed) {
            this._dropBot = other;
            sim.helper.action('onModDropEnter', [this._dropBot], {
                mod: this._mod,
                context: this._context,
            });
        }
    }

    protected _onDragReleased(calc: BotCalculationContext): void {}

    //
    // Abstractions
    //

    protected abstract _onDrag(calc: BotCalculationContext): void;
}
