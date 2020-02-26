import { BaseBotClickOperation } from '../../../shared/interaction/ClickOperation/BaseBotClickOperation';
import PlayerGameView from '../../PlayerGameView/PlayerGameView';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { Intersection, Vector2 } from 'three';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import {
    BotCalculationContext,
    getBotPosition,
    objectsAtDimensionGridPosition,
    getBotIndex,
    duplicateBot,
    Bot,
    getBotDragMode,
    tagsOnBot,
    CLICK_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import { PlayerBotDragOperation } from '../DragOperation/PlayerBotDragOperation';
import dropWhile from 'lodash/dropWhile';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { PlayerNewBotDragOperation } from '../DragOperation/PlayerNewBotDragOperation';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { PlayerGame } from '../../scene/PlayerGame';
import { ControllerData, InputMethod } from '../../../shared/scene/Input';

export class PlayerBotClickOperation extends BaseBotClickOperation {
    // This overrides the base class.
    protected _interaction: PlayerInteractionManager;

    protected _argument: { face: string; dimension: string };

    constructor(
        simulation3D: Simulation3D,
        interaction: PlayerInteractionManager,
        bot: AuxBot3D,
        faceValue: string,
        inputMethod: InputMethod
    ) {
        super(simulation3D, interaction, bot.bot, bot, inputMethod);

        this._argument = { face: faceValue, dimension: null };
    }

    protected _performClick(calc: BotCalculationContext): void {
        const bot3D: AuxBot3D = <AuxBot3D>this._bot3D;

        this._argument.dimension = bot3D.dimension;

        this.simulation.helper.action(
            CLICK_ACTION_NAME,
            [this._bot],
            this._argument
        );

        this.simulation.helper.action('onAnyBotClicked', null, {
            ...this._argument,
            bot: this._bot,
        });
    }

    protected _createDragOperation(
        calc: BotCalculationContext,
        fromCoord?: Vector2
    ): BaseBotDragOperation {
        const bot3D: AuxBot3D = <AuxBot3D>this._bot3D;
        const dimension = bot3D.dimension;
        const position = getBotPosition(calc, bot3D.bot, dimension);
        if (position) {
            const objects = objectsAtDimensionGridPosition(
                calc,
                dimension,
                position
            );
            if (objects.length === 0) {
                console.log('Found no objects at', position);
                console.log(bot3D.bot);
                console.log(dimension);
            }
            const bot = this._bot;
            const draggedObjects = dropWhile(objects, o => o.id !== bot.id);
            const {
                playerSimulation3D,
                inventorySimulation3D,
            } = this._getSimulationsForDragOp();

            return new PlayerBotDragOperation(
                playerSimulation3D,
                inventorySimulation3D,
                this._interaction,
                draggedObjects,
                bot3D.dimension,
                this._inputMethod,
                fromCoord,
                undefined,
                this._argument.face
            );
        }

        return null;
    }

    private _getSimulationsForDragOp() {
        let playerSimulation3D: PlayerSimulation3D;
        let inventorySimulation3D: InventorySimulation3D;

        if (this._simulation3D instanceof PlayerSimulation3D) {
            playerSimulation3D = this._simulation3D;
            inventorySimulation3D = (<PlayerGame>(
                this.game
            )).findInventorySimulation3D(this._simulation3D.simulation);
        } else if (this._simulation3D instanceof InventorySimulation3D) {
            playerSimulation3D = (<PlayerGame>this.game).findPlayerSimulation3D(
                this._simulation3D.simulation
            );
            inventorySimulation3D = this._simulation3D;
        } else {
            console.error(
                '[PlayerBotClickOperation] Unsupported Simulation3D type for drag operation.'
            );
        }

        return { playerSimulation3D, inventorySimulation3D };
    }
}
