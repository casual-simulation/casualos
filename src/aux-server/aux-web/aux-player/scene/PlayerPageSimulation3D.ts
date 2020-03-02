import {
    Bot,
    BotCalculationContext,
    hasValue,
    DEFAULT_SCENE_BACKGROUND_COLOR,
    isDimensionLocked,
    calculateGridScale,
    PrecalculatedBot,
    toast,
    calculateBotValue,
    calculateBooleanTagValue,
    calculateNumericalTagValue,
    BotIndexEvent,
    DEFAULT_INVENTORY_VISIBLE,
    getPortalConfigBotID,
    DEFAULT_PORTAL_ROTATABLE,
    DEFAULT_PORTAL_PANNABLE,
    DEFAULT_PORTAL_ZOOMABLE,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import {
    BrowserSimulation,
    userBotChanged,
    userBotTagsChanged,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import {
    tap,
    filter,
    map,
    distinctUntilChanged,
    switchMap,
} from 'rxjs/operators';
import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import { doesBotDefinePlayerDimension } from '../PlayerUtils';
import {
    Color,
    Texture,
    OrthographicCamera,
    PerspectiveCamera,
    MathUtils as ThreeMath,
} from 'three';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { PlayerGame } from './PlayerGame';
import { PlayerGrid3D } from '../PlayerGrid3D';
import { UpdatedBotInfo, BotDimensionEvent } from '@casual-simulation/aux-vm';
import { PlayerSimulation3D } from './PlayerSimulation3D';

export class PlayerPageSimulation3D extends PlayerSimulation3D {
    constructor(game: Game, simulation: BrowserSimulation) {
        super('auxPagePortal', game, simulation);
    }

    getMainCameraRig(): CameraRig {
        return this._game.getMainCameraRig();
    }

    get pageConfig() {
        return this.getPortalConfig('auxPagePortal');
    }

    /**
     * Gets the background color that the simulation defines.
     */
    get backgroundColor() {
        return this.pageConfig.backgroundColor || super.backgroundColor;
    }

    /**
     * Gets the pannability of the inventory camera that the simulation defines.
     */
    get pannable() {
        return this.pageConfig.pannable;
    }

    /**
     * Gets the minimum value the pan can be set to on the x axis
     */
    get panMinX() {
        return this.pageConfig.panMinX;
    }

    /**
     * Gets the maximum value the pan can be set to on the x axis
     */
    get panMaxX() {
        return this.pageConfig.panMaxX;
    }

    /**
     * Gets the minimum value the pan can be set to on the y axis
     */
    get panMinY() {
        return this.pageConfig.panMinY;
    }

    /**
     * Gets the maximum value the pan can be set to on the y axis
     */
    get panMaxY() {
        return this.pageConfig.panMaxY;
    }

    /**
     * Gets if rotation is allowed in the inventory that the simulation defines.
     */
    get rotatable() {
        return this.pageConfig.rotatable;
    }

    /**
     * Gets if zooming is allowed in the inventory that the simulation defines.
     */
    get zoomable() {
        return this.pageConfig.zoomable;
    }

    /**
     * Gets the minimum value the zoom can be set to
     */
    get zoomMin() {
        return this.pageConfig.zoomMin;
    }

    /**
     * Gets the maximum value the zoom can be set to
     */
    get zoomMax() {
        return this.pageConfig.zoomMax;
    }

    /**
     * Gets the zoom level of the player that the simulation defines.
     */
    get playerZoom() {
        return this.pageConfig.playerZoom;
    }

    /**
     * Gets the x-axis rotation of the player that the simulation defines.
     */
    get playerRotationX() {
        return this.pageConfig.playerRotationX;
    }

    /**
     * Gets the x-axis rotation of the player that the simulation defines.
     */
    get playerRotationY() {
        return this.pageConfig.playerRotationY;
    }
}
