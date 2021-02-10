import {
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
import { BotDimensionEvent } from '@casual-simulation/aux-vm';
import { Color, Texture } from 'three';
import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import { PlayerSimulation3D } from './PlayerSimulation3D';
import { InventoryPortalConfig } from './InventoryPortalConfig';

export class InventorySimulation3D extends PlayerSimulation3D {
    /**
     * The inventory dimension that this simulation is for.
     */
    inventoryDimension: string;

    get inventoryConfig() {
        return <InventoryPortalConfig>this.getPortalConfig('inventoryPortal');
    }

    /**
     * Gets the background color that the simulation defines.
     */
    get backgroundColor() {
        return this.inventoryConfig.backgroundColor || super.backgroundColor;
    }

    get backgroundAddress() {
        return (
            this.inventoryConfig.backgroundAddress || super.backgroundAddress
        );
    }

    /**
     * Gets the pannability of the inventory camera that the simulation defines.
     */
    get pannable() {
        return this.inventoryConfig.pannable;
    }

    /**
     * Gets the minimum value the pan can be set to on the x axis
     */
    get panMinX() {
        return this.inventoryConfig.panMinX;
    }

    /**
     * Gets the maximum value the pan can be set to on the x axis
     */
    get panMaxX() {
        return this.inventoryConfig.panMaxX;
    }

    /**
     * Gets the minimum value the pan can be set to on the y axis
     */
    get panMinY() {
        return this.inventoryConfig.panMinY;
    }

    /**
     * Gets the maximum value the pan can be set to on the y axis
     */
    get panMaxY() {
        return this.inventoryConfig.panMaxY;
    }

    /**
     * Gets if rotation is allowed in the inventory that the simulation defines.
     */
    get rotatable() {
        return this.inventoryConfig.rotatable;
    }

    /**
     * Gets if zooming is allowed in the inventory that the simulation defines.
     */
    get zoomable() {
        return this.inventoryConfig.zoomable;
    }

    /**
     * Gets the minimum value the zoom can be set to
     */
    get zoomMin() {
        return this.inventoryConfig.zoomMin;
    }

    /**
     * Gets the maximum value the zoom can be set to
     */
    get zoomMax() {
        return this.inventoryConfig.zoomMax;
    }

    /**
     * Gets the zoom level of the player that the simulation defines.
     */
    get playerZoom() {
        return this.inventoryConfig.playerZoom;
    }

    /**
     * Gets the x-axis rotation of the player that the simulation defines.
     */
    get playerRotationX() {
        return this.inventoryConfig.playerRotationX;
    }

    /**
     * Gets the x-axis rotation of the player that the simulation defines.
     */
    get playerRotationY() {
        return this.inventoryConfig.playerRotationY;
    }

    /**
     * Gets whether the portal is resizable.
     */
    get resizable() {
        return this.inventoryConfig.resizable;
    }

    /**
     * Gets the height of the portal.
     */
    get height() {
        return this.inventoryConfig.height;
    }

    /**
     * Gets whether to show the camera focus point.
     */
    get showFocusPoint() {
        return this.inventoryConfig.showFocusPoint;
    }

    constructor(game: Game, simulation: BrowserSimulation) {
        super('inventoryPortal', game, simulation);
    }

    getMainCameraRig(): CameraRig {
        return this._game.getInventoryCameraRig();
    }

    init() {
        this._subs.push(
            userBotChanged(this.simulation)
                .pipe(
                    filter((bot) => !!bot),
                    tap((bot) => {
                        const userInventoryDimensionValue =
                            bot.values['inventoryPortal'];
                        const previousDimension = this.inventoryDimension;
                        this.inventoryDimension = userInventoryDimensionValue;
                        if (previousDimension !== userInventoryDimensionValue) {
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

    protected _constructDimensionGroup(portalTag: string, bot: Bot) {
        return new InventoryContextGroup3D(
            this,
            bot,
            'player',
            this.decoratorFactory,
            portalTag
        );
    }

    protected _createPortalConfig(portalTag: string) {
        if (portalTag === 'inventoryPortal') {
            return new InventoryPortalConfig(portalTag, this.simulation);
        } else {
            return super._createPortalConfig(portalTag);
        }
    }
}
