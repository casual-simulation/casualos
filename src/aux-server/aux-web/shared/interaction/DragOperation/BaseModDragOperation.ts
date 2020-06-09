import { IOperation } from '../IOperation';
import { BaseInteractionManager } from '../BaseInteractionManager';
import { Vector2, Group, Object3D } from 'three';
import {
    Bot,
    botUpdated,
    PartialBot,
    BotAction,
    BotCalculationContext,
    objectsAtDimensionGridPosition,
    isBotStackable,
    getBotIndex,
    botRemoved,
    isMergeable,
    DROP_ACTION_NAME,
    DROP_ANY_ACTION_NAME,
    MOD_DROP_ACTION_NAME,
    toast,
    createBot,
    BotTags,
    botAdded,
    merge,
    MOD_DROP_EXIT_ACTION_NAME,
    MOD_DROP_ENTER_ACTION_NAME,
    onModDropArg,
} from '@casual-simulation/aux-common';

import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import differenceBy from 'lodash/differenceBy';
import maxBy from 'lodash/maxBy';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { AuxBot3DDecoratorFactory } from '../../scene/decorators/AuxBot3DDecoratorFactory';
import { setParent } from '../../scene/SceneUtils';
import { DimensionGroup3D } from '../../../shared/scene/DimensionGroup3D';
import { ControllerData, InputMethod } from '../../../shared/scene/Input';
import { posesEqual } from '../ClickOperation/ClickOperationUtils';

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
    protected _lastVRControllerPose: Object3D;
    protected _merge: boolean;
    protected _other: Bot;
    protected _bot: Bot;
    protected _dimension: string;
    protected _previousDimension: string;
    protected _controller: ControllerData;

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

    protected get dimensionGroup() {
        return this._modMesh.dimensionGroup;
    }

    protected set dimensionGroup(group: DimensionGroup3D) {
        const prev = this.dimensionGroup;
        if (prev) {
            prev.display.remove(this._modMesh);
        }
        this._modMesh.dimensionGroup = group;
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
     */
    constructor(
        simulation3D: Simulation3D,
        interaction: BaseInteractionManager,
        mod: BotTags,
        inputMethod: InputMethod,
        fromCoord?: Vector2
    ) {
        this._simulation3D = simulation3D;
        this._interaction = interaction;
        this._mod = mod;
        this._previousDimension = null;
        this._lastGridPos = null;
        this._lastIndex = null;
        this._controller =
            inputMethod.type === 'controller' ? inputMethod.controller : null;
        this._fromCoord = fromCoord;

        if (this._controller) {
            this._lastVRControllerPose = this._controller.ray.clone();
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

            if (this.dimensionGroup) {
                this.dimensionGroup.display.add(this._modMesh);
            }
        }

        const input = this.game.getInput();
        const buttonHeld: boolean = this._controller
            ? input.getControllerPrimaryButtonHeld(this._controller)
            : input.getMouseButtonHeld(0);

        if (buttonHeld) {
            let shouldUpdateDrag: boolean;

            if (this._controller) {
                const curPose = this._controller.ray.clone();
                shouldUpdateDrag = !posesEqual(
                    curPose,
                    this._lastVRControllerPose
                );
                this._lastVRControllerPose = curPose;
            } else {
                const curScreenPos = input.getMouseScreenPos();
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
            let actions = [] as { eventName: string; bots: Bot[]; arg?: any }[];

            const arg = this._createModDropArg();
            if (this._dropBot) {
                actions.unshift({
                    eventName: MOD_DROP_EXIT_ACTION_NAME,
                    bots: [this._dropBot],
                    arg,
                });
            }

            let events = [] as BotAction[];
            if (MOD_DROP_ACTION_NAME in this._other.tags) {
                actions.unshift({
                    eventName: MOD_DROP_ACTION_NAME,
                    bots: [this._other],
                    arg,
                });
            } else {
                const update = {
                    tags: mod,
                };
                events.push(botUpdated(this._other.id, update));
            }

            const result = this.simulation.helper.actions(actions);

            this.simulation.helper.transaction(...events, ...result);
        }
    }

    protected async _updateModPosition(
        calc: BotCalculationContext,
        gridPosition: Vector2,
        index: number
    ) {
        if (!this._dimension) {
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
            [this._dimension]: true,
            [`${this._dimension}X`]: gridPosition.x,
            [`${this._dimension}Y`]: gridPosition.y,
            [`${this._dimension}SortOrder`]: index,
        };

        if (this._previousDimension) {
            tags[this._previousDimension] = null;
        }

        this._updateBot(calc, tags);
    }

    protected _updateModContexts(
        calc: BotCalculationContext,
        inDimension: boolean
    ) {
        if (!this._dimension) {
            return;
        }
        let tags = {
            [this._dimension]: inDimension,
        };

        this._updateBot(calc, tags);
    }

    protected _updateBot(calc: BotCalculationContext, tags: BotTags) {
        this._mod = merge(this._mod, tags);
        this._bot = {
            id: this._bot.id,
            tags: this._mod,
        };
        this._modMesh.dimension = this._dimension;

        const modBot = merge(this._bot, {
            tags: {
                form: 'sphere',
            },
        });

        this._modMesh.botUpdated(modBot, new Set([]), calc);
    }

    /**
     * Put the the bots pack in the workspace and remove the group.
     */
    private _releaseMeshes(): void {
        if (this.dimensionGroup) {
            // Remove the mesh from the group.
            this.dimensionGroup.display.remove(this._modMesh);
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
        const arg = this._createModDropArg();
        if (this._dropBot && changed) {
            const otherBot = this._dropBot;
            this._dropBot = null;
            sim.helper.action(MOD_DROP_EXIT_ACTION_NAME, [otherBot], arg);
        }
        if (other && changed) {
            this._dropBot = other;
            sim.helper.action(MOD_DROP_ENTER_ACTION_NAME, [this._dropBot], arg);
        }
    }

    protected _createModDropArg() {
        return onModDropArg(this._mod, this._dimension);
    }

    protected _onDragReleased(calc: BotCalculationContext): void {}

    //
    // Abstractions
    //

    protected abstract _onDrag(calc: BotCalculationContext): void;
}
