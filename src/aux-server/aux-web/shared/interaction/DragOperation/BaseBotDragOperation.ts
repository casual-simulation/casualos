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
} from '@casual-simulation/aux-common';

import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { differenceBy, maxBy } from 'lodash';
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
    protected _combine: boolean;
    protected _merge: boolean;
    protected _other: Bot;
    protected _context: string;
    protected _previousContext: string;
    protected _originalContext: string;
    protected _vrController: VRController3D;

    private _inContext: boolean;

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
        fromCoord?: Vector2
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

        let fromX;
        let fromY;
        if (fromCoord === undefined) {
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

        this.simulation.helper.transaction(...events);
    }

    update(calc: BotCalculationContext): void {
        if (this._finished) return;

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
        this._bots = null;
        this._bot = null;
    }

    protected _disposeCore() {
        // Combine bots.
        if (this._merge && this._other) {
            const calc = this.simulation.helper.createContext();
            const update = getDiffUpdate(calc, this._bot);

            const result = this.simulation.helper.actions([
                {
                    eventName: DIFF_ACTION_NAME,
                    bots: [this._other],
                    arg: {
                        diffs: update.tags,
                    },
                },
            ]);
            const bot = this._bot;
            this.simulation.helper
                .transaction(
                    botUpdated(this._other.id, update),
                    botRemoved(this._bot.id),
                    ...result
                )
                .then(() => {
                    if (bot) {
                        this.simulation.recent.addBotDiff(bot, true);
                    }
                });
        } else if (this._combine && this._other) {
            const arg = { context: this._context };

            this.simulation.helper.action(
                COMBINE_ACTION_NAME,
                [this._bot, this._other],
                arg
            );

            this.simulation.helper.action(
                'onCombineExit',
                [this._bot],
                this._other
            );

            this.simulation.helper.action(
                'onCombineExit',
                [this._other],
                this._bot
            );
        } else if (isDiff(null, this._bot)) {
            const id = this._bot.id;
            this.simulation.helper
                .transaction(
                    botUpdated(this._bot.id, {
                        tags: {
                            'aux.mod': null,
                            'aux.mod.mergeTags': null,
                        },
                    })
                )
                .then(() => {
                    const bot = this.simulation.helper.botsState[id];
                    if (bot) {
                        this.simulation.recent.addBotDiff(bot, true);
                    }
                });
        } else if (
            this._other != null &&
            !this._combine &&
            this._other.tags['onCombine()'] != undefined &&
            this._bots.length > 1
        ) {
            this.simulation.helper.transaction(
                toast('Cannot combine more than one bot at a time.')
            );
        }
    }

    protected _setBots(bots: Bot[]) {
        this._bots = bots;
        if (this._bots.length == 1) {
            this._bot = this._bots[0];
        }
    }

    protected async _updateBotsPositions(
        bots: Bot[],
        gridPosition: Vector2,
        index: number
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
            let tags = {
                tags: {
                    [this._context]: true,
                    [`${this._context}.x`]: gridPosition.x,
                    [`${this._context}.y`]: gridPosition.y,
                    [`${this._context}.sortOrder`]: index + i,
                },
            };
            if (this._previousContext) {
                tags.tags[this._previousContext] = null;
            }
            events.push(this._updateBot(bots[i], tags));
        }

        this.simulation.recent.clear();
        this.simulation.recent.selectedRecentBot = null;
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

    /**
     * Calculates whether the given bot should be stacked onto another bot or if
     * it should be combined with another bot.
     * @param calc The bot calculation context.
     * @param context The context.
     * @param gridPosition The grid position that the bot is being dragged to.
     * @param bot The bot that is being dragged.
     */
    protected _calculateBotDragStackPosition(
        calc: BotCalculationContext,
        context: string,
        gridPosition: Vector2,
        ...bots: Bot[]
    ) {
        const objs = differenceBy(
            objectsAtContextGridPosition(calc, context, gridPosition),
            bots,
            f => f.id
        );

        const canMerge =
            objs.length >= 1 &&
            bots.length === 1 &&
            isDiff(calc, bots[0]) &&
            isMergeable(calc, bots[0]) &&
            isMergeable(calc, objs[0]);

        const canCombine =
            this._allowCombine() &&
            !canMerge &&
            objs.length === 1 &&
            bots.length === 1 &&
            this._interaction.canCombineBots(calc, bots[0], objs[0]);

        // Can stack if we're dragging more than one bot,
        // or (if the single bot we're dragging is stackable and
        // the stack we're dragging onto is stackable)
        let canStack =
            bots.length !== 1 ||
            (isBotStackable(calc, bots[0]) &&
                (objs.length === 0 || isBotStackable(calc, objs[0])));

        if (isDiff(calc, bots[0])) {
            canStack = true;
        }

        const index = this._nextAvailableObjectIndex(
            calc,
            context,
            gridPosition,
            bots,
            objs
        );

        return {
            combine: canCombine,
            merge: canMerge,
            stackable: canStack,
            other: objs[0], //canCombine ? objs[0] : canMerge ? objs[0] : null,
            index: index,
        };
    }

    /**
     * Calculates the next available index that an object can be placed at on the given workspace at the
     * given grid position.
     * @param context The context.
     * @param gridPosition The grid position that the next available index should be found for.
     * @param bots The bots that we're trying to find the next index for.
     * @param objs The objects at the same grid position.
     */
    protected _nextAvailableObjectIndex(
        calc: BotCalculationContext,
        context: string,
        gridPosition: Vector2,
        bots: Bot[],
        objs: Bot[]
    ): number {
        const except = differenceBy(objs, bots, f =>
            f instanceof AuxBot3D ? f.bot.id : f.id
        );

        const indexes = except.map(o => ({
            object: o,
            index: getBotIndex(calc, o, context),
        }));

        // TODO: Improve to handle other scenarios like:
        // - Reordering objects
        // - Filling in gaps that can be made by moving bots from the center of the list
        const maxIndex = maxBy(indexes, i => i.index);
        let nextIndex = 0;
        if (maxIndex) {
            nextIndex = maxIndex.index + 1;
        }

        return nextIndex;
    }

    protected _onDragReleased(calc: BotCalculationContext): void {
        let toX;
        let toY;
        if (this._toCoord === undefined) {
            toX = null;
            toY = null;
        } else {
            toX = this._toCoord.x;
            toY = this._toCoord.y;
        }

        const botTemp = createBot(this._bots[0].id, {
            ...this._bots[0].tags,
            [this._context + '.x']: toX,
            [this._context + '.y']: toY,
        });

        let fromX;
        let fromY;
        if (this._fromCoord === undefined) {
            fromX = null;
            fromY = null;
        } else {
            fromX = this._fromCoord.x;
            fromY = this._fromCoord.y;
        }

        let events: BotAction[] = [];

        // Trigger drag into context
        let result = this.simulation.helper.actions([
            {
                eventName: DROP_ACTION_NAME,
                bots: this._bots,
                arg: {
                    to: {
                        x: toX,
                        y: toY,
                        context: this._context,
                    },
                    from: {
                        x: fromX,
                        y: fromY,
                        context: this._originalContext,
                    },
                },
            },
            {
                eventName: DROP_ANY_ACTION_NAME,
                bots: null,
                arg: {
                    bot: botTemp,
                    to: {
                        x: toX,
                        y: toY,
                        context: this._context,
                    },
                    from: {
                        x: fromX,
                        y: fromY,
                        context: this._originalContext,
                    },
                },
            },
        ]);

        events.push(...result);

        this.simulation.helper.transaction(...events);
    }

    //
    // Abstractions
    //

    // A checked function to verify that the stacks can combine
    protected _allowCombine(): boolean {
        return true;
    }

    protected abstract _onDrag(calc: BotCalculationContext): void;
}
