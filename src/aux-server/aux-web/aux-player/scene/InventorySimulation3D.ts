import {
    Object,
    AuxObject,
    FileCalculationContext,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { IGameView } from '../../shared/IGameView';
import { Simulation } from '../../shared/Simulation';
import { tap } from 'rxjs/operators';
import { InventoryContextGroup3D } from './InventoryContextGroup3D';
import { PerspectiveCamera, OrthographicCamera, Plane } from 'three';
import GameView from '../GameView/GameView';

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

    protected _gameView: GameView; // Override base class gameView so that its cast to the Aux Player GameView.

    constructor(gameView: IGameView, simulation: Simulation) {
        super(gameView, simulation);

        // Generate a context group that will render the user's inventory for this simulation.
        this._contextGroup = new InventoryContextGroup3D(
            this,
            this.simulation.helper.userFile,
            'player',
            this._gameView.getDecoratorFactory()
        );
    }

    getMainCamera(): PerspectiveCamera | OrthographicCamera {
        return this._gameView.getInventoryCamera();
    }

    init() {
        this._subs.push(
            this.simulation.watcher
                .fileChanged(this.simulation.helper.userFile)
                .pipe(
                    tap(file => {
                        const userInventoryContextValue = (<Object>file).tags[
                            'aux._userInventoryContext'
                        ];
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

    protected _createContext(calc: FileCalculationContext, file: AuxObject) {
        if (this._contextLoaded) {
            return null;
        }

        this._contextLoaded = true;
        return this._contextGroup;
    }
}
