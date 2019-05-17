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
import { InventoryContextFlat } from '../InventoryContextFlat';

export class InventorySimulation3D extends Simulation3D {
    /**
     * The inventory context that this simulation renders.
     * NOTE: This is kept around as legacy functionality.
     */
    inventoryContextFlat: InventoryContextFlat;

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
                            !this.inventoryContextFlat ||
                            this.inventoryContextFlat.context !==
                                userInventoryContextValue
                        ) {
                            this.inventoryContext = userInventoryContextValue;
                            this.inventoryContextFlat = new InventoryContextFlat(
                                this.simulation,
                                userInventoryContextValue
                            );

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

    protected _frameUpdateCore(calc: FileCalculationContext) {
        super._frameUpdateCore(calc);
        this.inventoryContextFlat.frameUpdate(calc);
    }

    protected async _fileAddedCore(
        calc: FileCalculationContext,
        file: AuxObject
    ): Promise<void> {
        await super._fileAddedCore(calc, file);
        await this.inventoryContextFlat.fileAdded(file, calc);
    }

    protected async _fileUpdatedCore(
        calc: FileCalculationContext,
        file: AuxObject
    ) {
        await super._fileUpdatedCore(calc, file);
        await this.inventoryContextFlat.fileUpdated(file, [], calc);
    }

    protected _fileRemovedCore(calc: FileCalculationContext, file: string) {
        super._fileRemovedCore(calc, file);
        this.inventoryContextFlat.fileRemoved(file, calc);
    }

    protected _createContext(calc: FileCalculationContext, file: AuxObject) {
        if (this._contextLoaded) {
            return null;
        }

        this._contextLoaded = true;
        return this._contextGroup;
    }
}
