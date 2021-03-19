import { IOperation } from '../IOperation';
import { BaseInteractionManager } from '../BaseInteractionManager';
import {
    Vector2,
    Object3D,
    Vector3,
    Euler,
    Intersection,
    AlwaysStencilFunc,
} from '@casual-simulation/three';
import {
    Bot,
    botUpdated,
    PartialBot,
    BotAction,
    BotCalculationContext,
    objectsAtDimensionGridPosition,
    getBotIndex,
    botRemoved,
    DROP_ACTION_NAME,
    DROP_ANY_ACTION_NAME,
    MOD_DROP_ACTION_NAME,
    toast,
    createBot,
    DRAG_ANY_ACTION_NAME,
    DRAG_ACTION_NAME,
    BotTags,
    isBot,
    calculateBooleanTagValue,
    ShoutAction,
    DROP_EXIT_ACTION_NAME,
    DROP_ENTER_ACTION_NAME,
    BotDropDestination,
    onDropArg,
    BotDropToDestination,
    onDragArg,
    ANY_DROP_ENTER_ACTION_NAME,
    ANY_DROP_EXIT_ACTION_NAME,
    SnapTarget,
    SnapPoint,
} from '@casual-simulation/aux-common';

import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { Subscription } from 'rxjs';
import { ControllerData, InputMethod } from '../../../shared/scene/Input';
import { posesEqual } from '../ClickOperation/ClickOperationUtils';
import { merge } from 'lodash';
import {
    SnapBotsHelper,
    SnapBotsInterface,
    SnapOptions,
} from './SnapInterface';

/**
 * Shared class for both BotDragOperation and NewBotDragOperation.
 */
export abstract class BaseBotDragOperation implements IOperation {
    protected _simulation3D: Simulation3D;
    protected _interaction: BaseInteractionManager;
    protected _bots: Bot[];
    protected _bot: Bot;
    protected _finished: boolean;
    protected _lastScreenPos: Vector2;
    protected _lastGridPos: Vector2;
    protected _lastVRControllerPose: Object3D;
    protected _other: Bot;
    protected _dimension: string;
    protected _previousDimension: string;
    protected _originalDimension: string;
    protected _controller: ControllerData;
    protected _inputMethod: InputMethod;
    protected _childOperation: IOperation;
    protected _clickedFace: string;
    protected _hit: Intersection;
    protected _dragStartFrame: number;
    protected _snapInterface: SnapBotsInterface;
    protected _createdSnapInterface: boolean;

    /**
     * The bot that the onDropEnter event was sent to.
     */
    protected _dropBot: Bot;

    private _inDimension: boolean;
    private _onDragPromise: Promise<void>;

    protected _toCoord: Vector2;
    protected _fromCoord: Vector2;
    protected _sub: Subscription;

    protected get game() {
        return this._simulation3D.game;
    }

    get simulation() {
        return this._simulation3D.simulation;
    }

    /**
     * Create a new drag rules.
     * @param simulation3D The simulation.
     * @param interaction The interaction manager.
     * @param bots The bots to drag.
     * @param dimension The dimension that the bots are currently in.
     */
    constructor(
        simulation3D: Simulation3D,
        interaction: BaseInteractionManager,
        bots: Bot[],
        dimension: string,
        inputMethod: InputMethod,
        fromCoord?: Vector2,
        skipOnDragEvents?: boolean,
        clickedFace?: string,
        hit?: Intersection,
        snapInterface?: SnapBotsInterface
    ) {
        this._simulation3D = simulation3D;
        this._interaction = interaction;
        this._setBots(bots);
        this._originalDimension = this._dimension = dimension;
        this._previousDimension = null;
        this._lastGridPos = null;
        this._inDimension = true;
        this._inputMethod = inputMethod;
        this._controller =
            inputMethod.type === 'controller' ? inputMethod.controller : null;
        this._fromCoord = fromCoord;
        this._clickedFace = clickedFace;
        this._hit = hit;
        this._dragStartFrame = this.game.getTime().frameCount;
        this._sub = new Subscription();
        this._snapInterface = snapInterface;
        if (!this._snapInterface) {
            this._createdSnapInterface = true;
            this._snapInterface = new SnapBotsHelper();

            if (!this._controller) {
                this._snapInterface.addSnapTargets(null, ['ground']);
            }

            const sub = this._simulation3D.simulation.localEvents.subscribe(
                (action) => {
                    if (action.type === 'add_drop_snap_targets') {
                        this._snapInterface.addSnapTargets(
                            action.botId,
                            action.targets
                        );
                    }
                }
            );
            this._sub.add(sub);
        }

        if (this._controller) {
            this._lastVRControllerPose = this._controller.ray.clone();
        } else {
            this._lastScreenPos = this._simulation3D.game
                .getInput()
                .getMouseScreenPos();
        }

        if (!skipOnDragEvents) {
            const sub = this._simulation3D.simulation.localEvents.subscribe(
                (action) => {
                    if (action.type === 'replace_drag_bot') {
                        if (sub) {
                            sub.unsubscribe();
                        }
                        this._replaceDragBot(action.bot);
                    }
                }
            );
            this._sub.add(sub);
            this._onDragPromise = this._sendOnDragEvents(fromCoord, bots);
            this._onDragPromise.then(() => {
                this._onDragPromise = null;
            });
        }
    }

    private _sendOnDragEvents(fromCoord: Vector2, bots: Bot[]) {
        let fromX;
        let fromY;
        if (!fromCoord) {
            fromX = null;
            fromY = null;
        } else {
            fromX = fromCoord.x;
            fromY = fromCoord.y;
        }
        let events: BotAction[] = [];
        // Trigger drag into dimension

        const arg = onDragArg(
            bots[0],
            {
                x: fromX,
                y: fromY,
                dimension: this._originalDimension,
            },
            this._clickedFace || null
        );
        let result = this.simulation.helper.actions([
            {
                eventName: DRAG_ACTION_NAME,
                bots: this._bots,
                arg: arg,
            },
            {
                eventName: DRAG_ANY_ACTION_NAME,
                bots: null,
                arg: arg,
            },
        ]);
        events.push(...result);
        return this.simulation.helper.transaction(...events);
    }

    private _replaceDragBot(bot: Bot | BotTags) {
        let operation: IOperation;
        if (isBot(bot)) {
            operation = this._createBotDragOperation(bot);
        } else {
            operation = this._createModDragOperation(bot);
        }

        this._childOperation = operation;
    }

    update(calc: BotCalculationContext): void {
        if (this._finished) return;

        if (this._onDragPromise) {
            return;
        }

        if (this._childOperation) {
            this._childOperation.update(calc);
            this._finished = this._childOperation.isFinished();
            return;
        }

        const input = this.game.getInput();
        let keepDragging = false;
        if (this._controller) {
            const startedAfterLastClick =
                this._dragStartFrame >
                this._controller.primaryInputState.getUpFrame();

            // Keep dragging if the button is held or if we started dragging after the last click finished.
            // This will make sure that we keep dragging even if the operation started when the button was not being held.
            keepDragging =
                startedAfterLastClick ||
                input.getControllerPrimaryButtonHeld(this._controller);
        } else {
            const state = input.getButtonInputState(0);
            const startedAfterLastClick =
                !state || this._dragStartFrame > state.getUpFrame();

            // Keep dragging if the button is held or if we started dragging after the last click finished.
            // This will make sure that we keep dragging even if the operation started when the button was not being held.
            keepDragging = startedAfterLastClick || input.getMouseButtonHeld(0);
        }

        if (keepDragging) {
            let shouldUpdateDrag: boolean;

            if (this._controller) {
                const curPose = this._controller.ray.clone();
                shouldUpdateDrag = !posesEqual(
                    curPose,
                    this._lastVRControllerPose
                );
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
        if (this._childOperation) {
            this._childOperation.dispose();
        }
        this._disposeCore();
        this.game.setGridsVisible(false);
        if (this._sub) {
            this._sub.unsubscribe();
        }
        this._bots = null;
        this._bot = null;
    }

    protected _disposeCore() {}

    protected _setBots(bots: Bot[]) {
        this._bots = bots;
        if (this._bots.length == 1) {
            this._bot = this._bots[0];
        }
    }

    protected async _updateBotsPositions(
        bots: Bot[],
        gridPosition: Vector2 | Vector3,
        rotation?: Euler
    ) {
        if (!this._dimension) {
            return;
        }
        this._inDimension = true;

        if (gridPosition instanceof Vector2) {
            await this._updateBotsGridPositions(bots, gridPosition);
        } else {
            await this._updateBotsAbsolutePositions(
                bots,
                gridPosition,
                rotation
            );
        }
    }

    private async _updateBotsAbsolutePositions(
        bots: Bot[],
        position: Vector3,
        rotation: Euler
    ) {
        this._lastGridPos = null;

        let events: BotAction[] = [];
        for (let i = 0; i < bots.length; i++) {
            let tags;
            tags = {
                tags: {
                    [this._dimension]: true,
                    [`${this._dimension}X`]: position.x,
                    [`${this._dimension}Y`]: position.y,
                    [`${this._dimension}Z`]: position.z,
                },
            };
            if (rotation) {
                merge(tags, {
                    tags: {
                        [`${this._dimension}RotationX`]: rotation.x,
                        [`${this._dimension}RotationY`]: rotation.y,
                        [`${this._dimension}RotationZ`]: rotation.z,
                    },
                });
            }
            if (this._previousDimension) {
                tags.tags[this._previousDimension] = null;
            }
            events.push(this._updateBot(bots[i], tags));
        }

        await this.simulation.helper.transaction(...events);
    }

    protected async _updateBotsGridPositions(
        bots: Bot[],
        gridPosition: Vector2
    ) {
        if (this._lastGridPos && this._lastGridPos.equals(gridPosition)) {
            return;
        }

        this._toCoord = gridPosition;
        this._lastGridPos = gridPosition.clone();

        let events: BotAction[] = [];
        for (let i = 0; i < bots.length; i++) {
            let tags;

            tags = {
                tags: {
                    [this._dimension]: true,
                    [`${this._dimension}X`]: gridPosition.x,
                    [`${this._dimension}Y`]: gridPosition.y,
                },
            };
            if (this._previousDimension) {
                tags.tags[this._previousDimension] = null;
            }
            events.push(this._updateBot(bots[i], tags));
        }

        await this.simulation.helper.transaction(...events);
    }

    protected _updateBotDimensions(bots: Bot[], inDimension: boolean) {
        this._inDimension = inDimension;
        if (!this._dimension) {
            return;
        }
        let events: BotAction[] = [];
        for (let i = 0; i < bots.length; i++) {
            let tags = {
                tags: {
                    [this._dimension]: inDimension,
                },
            };
            events.push(this._updateBot(bots[i], tags));
        }

        this.simulation.helper.transaction(...events);
    }

    protected _updateBot(bot: Bot, data: PartialBot): BotAction {
        return botUpdated(bot.id, data);
    }

    protected _onDragReleased(calc: BotCalculationContext): void {
        const arg = this._calculateDropArg(this._dropBot);

        const events = [] as BotAction[];
        if (this._dropBot) {
            events.push(
                ...this.simulation.helper.actions([
                    {
                        eventName: DROP_EXIT_ACTION_NAME,
                        bots: [this._dropBot],
                        arg,
                    },
                    {
                        eventName: DROP_EXIT_ACTION_NAME,
                        bots: this._bots,
                        arg,
                    },
                ])
            );
        }

        // Trigger drag into dimension
        events.push(
            ...this.simulation.helper.actions([
                {
                    eventName: DROP_ACTION_NAME,
                    bots: this._bots,
                    arg,
                },
            ])
        );

        if (this._dropBot) {
            events.push(
                ...this.simulation.helper.actions([
                    {
                        eventName: DROP_ACTION_NAME,
                        bots: [this._dropBot],
                        arg,
                    },
                ])
            );
        }

        events.push(
            ...this.simulation.helper.actions([
                {
                    eventName: DROP_ANY_ACTION_NAME,
                    bots: null,
                    arg,
                },
            ])
        );

        this.simulation.helper.transaction(...events);
    }

    private _calculateDropArg(toBot: Bot) {
        let toX;
        let toY;
        if (!this._toCoord) {
            toX = null;
            toY = null;
        } else {
            toX = this._toCoord.x;
            toY = this._toCoord.y;
        }
        const botTemp = createBot(this._bot.id, {
            ...this._bot.tags,
            [`${this._dimension}X`]: toX,
            [`${this._dimension}Y`]: toY,
        });
        let fromX;
        let fromY;
        if (!this._fromCoord) {
            fromX = null;
            fromY = null;
        } else {
            fromX = this._fromCoord.x;
            fromY = this._fromCoord.y;
        }
        const to: BotDropToDestination = {
            bot: toBot,
            x: toX,
            y: toY,
            dimension: this._dimension,
        };
        const from: BotDropDestination = {
            x: fromX,
            y: fromY,
            dimension: this._originalDimension,
        };
        const arg = onDropArg(botTemp, to, from);
        return arg;
    }

    protected _sendDropEnterExitEvents(other: Bot) {
        const sim = this._simulation3D.simulation;
        const otherId = other ? other.id : null;
        const dropBotId = this._dropBot ? this._dropBot.id : null;
        const changed = otherId !== dropBotId;
        let events = [] as ShoutAction[];
        if (this._dropBot && changed) {
            const otherBot = this._dropBot;
            this._dropBot = null;

            const arg = this._calculateDropArg(otherBot);
            events.push(
                ...sim.helper.actions([
                    {
                        eventName: DROP_EXIT_ACTION_NAME,
                        bots: [otherBot],
                        arg: arg,
                    },
                    {
                        eventName: DROP_EXIT_ACTION_NAME,
                        bots: this._bots,
                        arg: arg,
                    },
                    {
                        eventName: ANY_DROP_EXIT_ACTION_NAME,
                        bots: null,
                        arg: arg,
                    },
                ])
            );
        }
        if (other && changed) {
            this._dropBot = other;
            const arg = this._calculateDropArg(this._dropBot);
            events.push(
                ...sim.helper.actions([
                    {
                        eventName: DROP_ENTER_ACTION_NAME,
                        bots: [this._dropBot],
                        arg: arg,
                    },
                    {
                        eventName: DROP_ENTER_ACTION_NAME,
                        bots: this._bots,
                        arg: arg,
                    },
                    {
                        eventName: ANY_DROP_ENTER_ACTION_NAME,
                        bots: null,
                        arg: arg,
                    },
                ])
            );
        }

        if (events.length > 0) {
            sim.helper.transaction(...events);
        }
    }

    //
    // Abstractions
    //

    // A checked function to verify that the stacks can combine
    protected _allowCombine(): boolean {
        return true;
    }

    protected abstract _createBotDragOperation(mod: Bot): IOperation;
    protected abstract _createModDragOperation(bot: BotTags): IOperation;
    protected abstract _onDrag(calc: BotCalculationContext): void;
}
