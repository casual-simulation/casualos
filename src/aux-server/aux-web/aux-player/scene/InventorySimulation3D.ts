import {
    Object,
    FileCalculationContext,
    PrecalculatedFile,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { Simulation } from '@casual-simulation/aux-vm';
import { tap } from 'rxjs/operators';
import { InventoryContextGroup3D } from './InventoryContextGroup3D';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { PlayerGame } from './PlayerGame';

export class InventorySimulation3D extends Simulation3D {
    /**
     * The inventory context that this simulation is for.
     */
    inventoryContext: string;

    /**
     * Short cut access to the context group that this simulation uses to render its inventory files.
     */
    private _contextGroup: InventoryContextGroup3D;

    /**
     * Has the context group been loaded by this simulation yet?
     */
    private _contextLoaded: boolean;

    protected _game: PlayerGame; // Override base class game so that its cast to the Aux Player Game.

    constructor(game: Game, simulation: Simulation) {
        super(game, simulation);

        // Generate a context group that will render the user's inventory for this simulation.
        this._contextGroup = new InventoryContextGroup3D(
            this,
            this.simulation.helper.userFile,
            'player',
            this._game.getDecoratorFactory()
        );
    }

    getMainCameraRig(): CameraRig {
        return this._game.getInventoryCameraRig();
    }

    init() {
        this._subs.push(
            this.simulation.watcher
                .fileChanged(this.simulation.helper.userFile)
                .pipe(
                    tap(update => {
                        const file = update;
                        const userInventoryContextValue =
                            file.values['aux._userInventoryContext'];
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

    protected _createContext(
        calc: FileCalculationContext,
        file: PrecalculatedFile
    ) {
        if (this._contextLoaded) {
            return null;
        }

        this._contextLoaded = true;
        return this._contextGroup;
    }
}
