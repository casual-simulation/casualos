import { IOperation } from '../IOperation';
import { BaseInteractionManager } from '../BaseInteractionManager';
import { Vector2 } from 'three';
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
    isMergeable,
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
    calculateActionEventsUsingContext,
    DROP_EXIT_ACTION_NAME,
    DROP_ENTER_ACTION_NAME,
    BotDropDestination,
    onDropArg,
    onDropExitArg,
    onDropEnterArg,
} from '@casual-simulation/aux-common';

import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import differenceBy from 'lodash/differenceBy';
import maxBy from 'lodash/maxBy';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { VRController3D, Pose } from '../../../shared/scene/vr/VRController3D';

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
    protected _lastIndex: number;
    protected _lastVRControllerPose: Pose;
    protected _merge: boolean;
    protected _other: Bot;
    protected _context: string;
    protected _previousContext: string;
    protected _originalContext: string;
    protected _vrController: VRController3D;
    protected _childOperation: IOperation;

    /**
     * The bot that the onDropEnter event was sent to.
     */
    protected _dropBot: Bot;

    private _inContext: boolean;
    private _onDragPromise: Promise<void>;

    protected _toCoord: Vector2;
    protected _fromCoord: Vector2;

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
     * @param context The context that the bots are currently in.
     */
    constructor(
        simulation3D: Simulation3D,
        interaction: BaseInteractionManager,
        bots: Bot[],
        context: string,
        vrController: VRController3D | null,
        fromCoord?: Vector2,
        skipOnDragEvents?: boolean
    ) {
        this._simulation3D = simulation3D;
        this._interaction = interaction;
        this._setBots(bots);
        this._originalContext = this._context = context;
        this._previousContext = null;
        this._lastGridPos = null;
        this._lastIndex = null;
        this._inContext = true;
        this._vrController = vrController;
        this._fromCoord = fromCoord;

        if (this._vrController) {
            this._lastVRControllerPose = this._vrController.worldPose.clone();
        } else {
            this._lastScreenPos = this._simulation3D.game
                .getInput()
                .getMouseScreenPos();
        }

        if (!skipOnDragEvents) {
            const sub = this._simulation3D.simulation.localEvents.subscribe(
                action => {
                    if (action.type === 'replace_drag_bot') {
                        this._replaceDragBot(action.bot);
                    }
                }
            );
            this._onDragPromise = this._sendOnDragEvents(fromCoord, bots);
            this._onDragPromise.then(() => {
                sub.unsubscribe();
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
        // Trigger drag into context
        let result = this.simulation.helper.actions([
            {
                eventName: DRAG_ACTION_NAME,
                bots: this._bots,
                arg: {
                    from: {
                        x: fromX,
                        y: fromY,
                        context: this._originalContext,
                    },
                },
            },
            {
                eventName: DRAG_ANY_ACTION_NAME,
                bots: null,
                arg: {
                    bot: bots[0],
                    from: {
                        x: fromX,
                        y: fromY,
                        context: this._originalContext,
                    },
                },
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
        if (this._childOperation) {
            this._childOperation.dispose();
        }
        this._disposeCore();
        this.game.setGridsVisible(false);
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
        gridPosition: Vector2,
        index: number,
        calc: BotCalculationContext
    ) {
        if (!this._context) {
            return;
        }
        this._inContext = true;

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

        let events: BotAction[] = [];
        for (let i = 0; i < bots.length; i++) {
            let tags;

            if (!isBotStackable(calc, bots[i])) {
                tags = {
                    tags: {
                        [this._context]: true,
                        [`${this._context}X`]: gridPosition.x,
                        [`${this._context}Y`]: gridPosition.y,
                        [`${this._context}SortOrder`]: 0,
                    },
                };
            } else {
                tags = {
                    tags: {
                        [this._context]: true,
                        [`${this._context}X`]: gridPosition.x,
                        [`${this._context}Y`]: gridPosition.y,
                        [`${this._context}SortOrder`]: index + i,
                    },
                };
            }
            if (this._previousContext) {
                tags.tags[this._previousContext] = null;
            }
            events.push(this._updateBot(bots[i], tags));
        }

        this.simulation.recent.clear();
        await this.simulation.helper.transaction(...events);
    }

    protected _updateBotContexts(bots: Bot[], inContext: boolean) {
        this._inContext = inContext;
        if (!this._context) {
            return;
        }
        let events: BotAction[] = [];
        for (let i = 0; i < bots.length; i++) {
            let tags = {
                tags: {
                    [this._context]: inContext,
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
        let toX;
        let toY;
        if (!this._toCoord) {
            toX = null;
            toY = null;
        } else {
            toX = this._toCoord.x;
            toY = this._toCoord.y;
        }

        const botTemp = createBot(this._bots[0].id, {
            ...this._bots[0].tags,
            [`${this._context}X`]: toX,
            [`${this._context}Y`]: toY,
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

        let events: BotAction[] = [];
        const to: BotDropDestination = {
            x: toX,
            y: toY,
            context: this._context,
        };
        const from: BotDropDestination = {
            x: fromX,
            y: fromY,
            context: this._originalContext,
        };

        if (this._dropBot) {
            events.push(
                ...this.simulation.helper.actions([
                    {
                        eventName: DROP_EXIT_ACTION_NAME,
                        bots: [this._dropBot],
                        arg: onDropExitArg(
                            botTemp,
                            this._dropBot,
                            this._context
                        ),
                    },
                    {
                        eventName: DROP_EXIT_ACTION_NAME,
                        bots: this._bots,
                        arg: onDropExitArg(
                            botTemp,
                            this._dropBot,
                            this._context
                        ),
                    },
                ])
            );
        }

        // Trigger drag into context
        events.push(
            ...this.simulation.helper.actions([
                {
                    eventName: DROP_ACTION_NAME,
                    bots: this._bots,
                    arg: onDropArg(botTemp, to, from),
                },
            ])
        );

        if (this._dropBot) {
            events.push(
                ...this.simulation.helper.actions([
                    {
                        eventName: DROP_ACTION_NAME,
                        bots: [this._dropBot],
                        arg: onDropArg(botTemp, to, from),
                    },
                ])
            );
        }

        events.push(
            ...this.simulation.helper.actions([
                {
                    eventName: DROP_ANY_ACTION_NAME,
                    bots: null,
                    arg: onDropArg(botTemp, to, from),
                },
            ])
        );

        this.simulation.helper.transaction(...events);
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
            events.push(
                ...sim.helper.actions([
                    {
                        eventName: DROP_EXIT_ACTION_NAME,
                        bots: [otherBot],
                        arg: onDropExitArg(this._bot, otherBot, this._context),
                    },
                    {
                        eventName: DROP_EXIT_ACTION_NAME,
                        bots: this._bots,
                        arg: onDropExitArg(this._bot, otherBot, this._context),
                    },
                ])
            );
        }
        if (other && changed) {
            this._dropBot = other;
            events.push(
                ...sim.helper.actions([
                    {
                        eventName: DROP_ENTER_ACTION_NAME,
                        bots: [this._dropBot],
                        arg: onDropEnterArg(
                            this._bot,
                            this._dropBot,
                            this._context
                        ),
                    },
                    {
                        eventName: DROP_ENTER_ACTION_NAME,
                        bots: this._bots,
                        arg: onDropEnterArg(
                            this._bot,
                            this._dropBot,
                            this._context
                        ),
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
