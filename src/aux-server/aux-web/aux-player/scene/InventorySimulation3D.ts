import {
    Object,
    BotCalculationContext,
    PrecalculatedBot,
    calculateGridScale,
    calculateBotValue,
    hasValue,
    calculateBooleanTagValue,
    calculateNumericalTagValue,
    isDimensionLocked,
    toast,
    DEFAULT_PORTAL_ZOOMABLE,
    DEFAULT_PORTAL_ROTATABLE,
    DEFAULT_PORTAL_PANNABLE,
    DEFAULT_INVENTORY_PORTAL_RESIZABLE,
    DEFAULT_INVENTORY_PORTAL_HEIGHT,
    Bot,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import {
    BrowserSimulation,
    userBotChanged,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import { tap, filter } from 'rxjs/operators';
import {
    InventoryContextGroup3D as InventoryDimensionGroup3D,
    InventoryContextGroup3D,
} from './InventoryContextGroup3D';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { PlayerGame } from './PlayerGame';
import { PlayerGrid3D } from '../PlayerGrid3D';
import { BotDimensionEvent } from '@casual-simulation/aux-vm';
import { Color, Texture } from 'three';
import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import { PlayerSimulation3D } from './PlayerSimulation3D';

export class InventorySimulation3D extends PlayerSimulation3D {
    /**
     * The inventory dimension that this simulation is for.
     */
    inventoryDimension: string;

    private _resizable: boolean;
    private _height: number;

    /**
     * Gets whether the portal is resizable.
     */
    get resizable() {
        if (this._resizable != null) {
            return this._resizable;
        } else {
            return DEFAULT_INVENTORY_PORTAL_RESIZABLE;
        }
    }

    /**
     * Gets the height of the portal.
     */
    get height() {
        if (this._height != null) {
            return this._height;
        } else {
            return DEFAULT_INVENTORY_PORTAL_HEIGHT;
        }
    }

    constructor(game: Game, simulation: BrowserSimulation) {
        super('auxInventoryPortal', game, simulation);

        const calc = this.simulation.helper.createContext();
        let gridScale = calculateGridScale(calc, null);
        this.gridScale = gridScale;
    }

    getMainCameraRig(): CameraRig {
        return this._game.getInventoryCameraRig();
    }

    init() {
        this._subs.push(
            userBotChanged(this.simulation)
                .pipe(
                    filter(bot => !!bot),
                    tap(bot => {
                        const userInventoryDimensionValue =
                            bot.values['auxInventoryPortal'];
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

    protected _constructDimensionGroup() {
        return new InventoryContextGroup3D(
            this,
            this.simulation.helper.userBot,
            'player',
            this.decoratorFactory
        );
    }

    protected _clearPortalValues() {
        this._resizable = null;
        this._height = null;
    }

    protected _updatePortalValues(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ) {
        super._updatePortalValues(calc, bot);
        this._resizable = calculateBooleanTagValue(
            calc,
            bot,
            `auxInventoryPortalResizable`,
            DEFAULT_INVENTORY_PORTAL_RESIZABLE
        );
        this._height = calculateNumericalTagValue(
            calc,
            bot,
            `auxInventoryPortalHeight`,
            DEFAULT_INVENTORY_PORTAL_HEIGHT
        );
    }
}
