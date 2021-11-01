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
    DEFAULT_MINI_PORTAL_RESIZABLE,
    DEFAULT_MINI_PORTAL_HEIGHT,
    Bot,
    MINI_PORTAL,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import {
    BrowserSimulation,
    userBotChanged,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import { tap, filter } from 'rxjs/operators';
import { MiniPortalContextGroup3D } from './MiniPortalContextGroup3D';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { BotDimensionEvent } from '@casual-simulation/aux-vm';
import { Color, Texture } from '@casual-simulation/three';
import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import { PlayerSimulation3D } from './PlayerSimulation3D';
import { MiniPortalConfig } from './MiniPortalConfig';

export class MiniSimulation3D extends PlayerSimulation3D {
    /**
     * The miniGridPortal dimension that this simulation is for.
     */
    miniDimension: string;

    getDefaultGridScale(): number {
        return this.miniConfig.gridScale;
    }

    get miniConfig() {
        return <MiniPortalConfig>this.getPortalConfig(MINI_PORTAL);
    }

    get cameraControlsMode() {
        return this.miniConfig.cameraControlsMode ?? super.cameraControlsMode;
    }

    /**
     * Gets the background color that the simulation defines.
     */
    get backgroundColor() {
        return this.miniConfig.backgroundColor || super.backgroundColor;
    }

    get backgroundAddress() {
        return this.miniConfig.backgroundAddress || super.backgroundAddress;
    }

    /**
     * Gets the pannability of the mini camera that the simulation defines.
     */
    get pannable() {
        return this.miniConfig.pannable;
    }

    /**
     * Gets the minimum value the pan can be set to on the x axis
     */
    get panMinX() {
        return this.miniConfig.panMinX;
    }

    /**
     * Gets the maximum value the pan can be set to on the x axis
     */
    get panMaxX() {
        return this.miniConfig.panMaxX;
    }

    /**
     * Gets the minimum value the pan can be set to on the y axis
     */
    get panMinY() {
        return this.miniConfig.panMinY;
    }

    /**
     * Gets the maximum value the pan can be set to on the y axis
     */
    get panMaxY() {
        return this.miniConfig.panMaxY;
    }

    /**
     * Gets if rotation is allowed in the miniGridPortal that the simulation defines.
     */
    get rotatable() {
        return this.miniConfig.rotatable;
    }

    /**
     * Gets if zooming is allowed in the miniGridPortal that the simulation defines.
     */
    get zoomable() {
        return this.miniConfig.zoomable;
    }

    /**
     * Gets the minimum value the zoom can be set to
     */
    get zoomMin() {
        return this.miniConfig.zoomMin;
    }

    /**
     * Gets the maximum value the zoom can be set to
     */
    get zoomMax() {
        return this.miniConfig.zoomMax;
    }

    /**
     * Gets the zoom level of the player that the simulation defines.
     */
    get playerZoom() {
        return this.miniConfig.playerZoom;
    }

    /**
     * Gets the x-axis rotation of the player that the simulation defines.
     */
    get playerRotationX() {
        return this.miniConfig.playerRotationX;
    }

    /**
     * Gets the x-axis rotation of the player that the simulation defines.
     */
    get playerRotationY() {
        return this.miniConfig.playerRotationY;
    }

    /**
     * Gets whether the portal is resizable.
     */
    get resizable() {
        return this.miniConfig.resizable;
    }

    /**
     * Gets the height of the portal.
     */
    get height() {
        return this.miniConfig.height;
    }

    /**
     * Gets the width of the portal.
     */
    get width() {
        return this.miniConfig.width;
    }

    /**
     * Gets whether to show the camera focus point.
     */
    get showFocusPoint() {
        return this.miniConfig.showFocusPoint;
    }

    /**
     * Gets the style the cursor should have for this portal.
     */
    get cursor() {
        return this.miniConfig.cursor;
    }

    constructor(game: Game, simulation: BrowserSimulation) {
        super(MINI_PORTAL, game, simulation);
    }

    getMainCameraRig(): CameraRig {
        return this._game.getMiniPortalCameraRig();
    }

    init() {
        this._subs.push(
            userBotChanged(this.simulation)
                .pipe(
                    filter((bot) => !!bot),
                    tap((bot) => {
                        const userMiniDimensionValue = bot.values[MINI_PORTAL];
                        const previousDimension = this.miniDimension;
                        this.miniDimension = userMiniDimensionValue;
                        if (previousDimension !== userMiniDimensionValue) {
                            console.log(
                                '[MiniSimulation3D] User changed miniGridPortal dimension to: ',
                                userMiniDimensionValue
                            );
                        }
                    })
                )
                .subscribe()
        );
        super.init();
    }

    protected _constructDimensionGroup(
        portalTag: string,
        bot: Bot
    ): DimensionGroup3D {
        return new MiniPortalContextGroup3D(
            this,
            bot,
            'player',
            this.decoratorFactory,
            portalTag
        );
    }

    protected _createPortalConfig(portalTag: string) {
        if (portalTag === MINI_PORTAL) {
            return new MiniPortalConfig(portalTag, this.simulation);
        } else {
            return super._createPortalConfig(portalTag);
        }
    }
}
