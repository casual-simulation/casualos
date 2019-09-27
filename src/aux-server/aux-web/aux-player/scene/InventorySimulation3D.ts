import {
    Object,
    BotCalculationContext,
    PrecalculatedBot,
    calculateGridScale,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import {
    BrowserSimulation,
    userFileChanged,
} from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import { InventoryContextGroup3D } from './InventoryContextGroup3D';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { PlayerGame } from './PlayerGame';
import { PlayerGrid3D } from '../PlayerGrid3D';

export class InventorySimulation3D extends Simulation3D {
    /**
     * The inventory context that this simulation is for.
     */
    inventoryContext: string;

    grid3D: PlayerGrid3D;

    /**
     * Short cut access to the context group that this simulation uses to render its inventory bots.
     */
    private _contextGroup: InventoryContextGroup3D;

    /**
     * Has the context group been loaded by this simulation yet?
     */
    private _contextLoaded: boolean;

    protected _game: PlayerGame; // Override base class game so that its cast to the Aux Player Game.

    constructor(game: Game, simulation: BrowserSimulation) {
        super(game, simulation);

        // Generate a context group that will render the user's inventory for this simulation.
        this._contextGroup = new InventoryContextGroup3D(
            this,
            this.simulation.helper.userFile,
            'player',
            this.decoratorFactory
        );

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
            userFileChanged(this.simulation)
                .pipe(
                    tap(bot => {
                        const userInventoryContextValue =
                            bot.values['aux._userInventoryContext'];
                        if (
                            !this.inventoryContext ||
                            this.inventoryContext !== userInventoryContextValue
                        ) {
                            this.inventoryContext = userInventoryContextValue;

                            console.log(
                                '[InventorySimulation3D] User changed inventory context to: ',
                                userInventoryContextValue
                            );
                        }
                    })
                )
                .subscribe()
        );

        super.init();
    }

    protected _frameUpdateCore(calc: BotCalculationContext) {
        super._frameUpdateCore(calc);
        this.grid3D.update();
    }

    protected _createContext(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ) {
        if (this._contextLoaded) {
            return null;
        }

        this._contextLoaded = true;
        return this._contextGroup;
    }
}
