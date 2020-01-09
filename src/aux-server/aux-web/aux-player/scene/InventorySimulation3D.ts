import {
    Object,
    BotCalculationContext,
    PrecalculatedBot,
    calculateGridScale,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import {
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import { InventoryContextGroup3D as InventoryDimensionGroup3D } from './InventoryContextGroup3D';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { PlayerGame } from './PlayerGame';
import { PlayerGrid3D } from '../PlayerGrid3D';
import { BotDimensionEvent } from '@casual-simulation/aux-vm';

export class InventorySimulation3D extends Simulation3D {
    /**
     * The inventory dimension that this simulation is for.
     */
    inventoryDimension: string;

    grid3D: PlayerGrid3D;

    protected _game: PlayerGame; // Override base class game so that its cast to the Aux Player Game.

    constructor(game: Game, simulation: BrowserSimulation) {
        super(game, simulation);

        const calc = this.simulation.helper.createContext();
        let gridScale = calculateGridScale(calc, null);
        this.grid3D = new PlayerGrid3D(gridScale).showGrid(false);
        this.grid3D.useAuxCoordinates = true;
        this.add(this.grid3D);
    }

    getMainCameraRig(): CameraRig {
        return this._game.getInventoryCameraRig();
    }

    init() {
        this._subs.push(
            userBotChanged(this.simulation)
                .pipe(
                    tap(bot => {
                        const userInventoryDimensionValue =
                            bot.values['_auxUserInventoryDimension'];
                        if (
                            !this.inventoryDimension ||
                            this.inventoryDimension !==
                                userInventoryDimensionValue
                        ) {
                            this.inventoryDimension = userInventoryDimensionValue;

                            console.log(
                                '[InventorySimulation3D] User changed inventory dimension to: ',
                                userInventoryDimensionValue
                            );
                        }
                    })
                )
                .subscribe()
        );

        super.init();
    }

    protected _getDimensionTags() {
        return ['_auxUserInventoryDimension'];
    }

    protected _filterDimensionEvent(
        calc: BotCalculationContext,
        event: BotDimensionEvent
    ): boolean {
        // Only allow dimensions defined on the user's bot
        if (
            event.type === 'dimension_added' ||
            event.type === 'dimension_removed'
        ) {
            return event.dimensionBot.id === this.simulation.helper.userId;
        }
        return super._filterDimensionEvent(calc, event);
    }

    protected _createDimensionGroup(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ) {
        if (bot.id === this.simulation.helper.userId) {
            return new InventoryDimensionGroup3D(
                this,
                this.simulation.helper.userBot,
                'player',
                this.decoratorFactory
            );
        }

        return null;
    }
}
