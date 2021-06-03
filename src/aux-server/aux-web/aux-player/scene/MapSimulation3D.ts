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
    MAP_PORTAL,
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
import { Color, Matrix4, Texture } from '@casual-simulation/three';
import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import { PlayerSimulation3D } from './PlayerSimulation3D';
import { MapPortalConfig } from './MapPortalConfig';
import { AuxBot3D } from '../../shared/scene/AuxBot3D';
import { MapPortalDimensionGroup3D } from './MapPortalDimensionGroup3D';
import type EsriSceneView from 'esri/views/SceneView';
import type EsriExternalRenderers from 'esri/views/3d/externalRenderers';
import type EsriSpatialReference from 'esri/geometry/SpatialReference';
import type EsriMap from 'esri/Map';
import { MapPortalGrid3D } from './MapPortalGrid3D';

export class MapSimulation3D extends PlayerSimulation3D {
    /**
     * The mini portal dimension that this simulation is for.
     */
    mapDimension: string;

    /**
     * The map view that this simulation should use.
     */
    mapView: EsriSceneView;

    private _mapGrid: MapPortalGrid3D;

    getDefaultGridScale(): number {
        return this.mapConfig.gridScale;
    }

    get mapConfig() {
        return <MapPortalConfig>this.getPortalConfig(MAP_PORTAL);
    }

    get cameraControlsMode() {
        return this.mapConfig.cameraControlsMode ?? super.cameraControlsMode;
    }

    /**
     * Gets the background color that the simulation defines.
     */
    get backgroundColor() {
        return this.mapConfig.backgroundColor || super.backgroundColor;
    }

    get backgroundAddress() {
        return this.mapConfig.backgroundAddress || super.backgroundAddress;
    }

    /**
     * Gets the pannability of the mini camera that the simulation defines.
     */
    get pannable() {
        return this.mapConfig.pannable;
    }

    /**
     * Gets the minimum value the pan can be set to on the x axis
     */
    get panMinX() {
        return this.mapConfig.panMinX;
    }

    /**
     * Gets the maximum value the pan can be set to on the x axis
     */
    get panMaxX() {
        return this.mapConfig.panMaxX;
    }

    /**
     * Gets the minimum value the pan can be set to on the y axis
     */
    get panMinY() {
        return this.mapConfig.panMinY;
    }

    /**
     * Gets the maximum value the pan can be set to on the y axis
     */
    get panMaxY() {
        return this.mapConfig.panMaxY;
    }

    /**
     * Gets if rotation is allowed in the mini portal that the simulation defines.
     */
    get rotatable() {
        return this.mapConfig.rotatable;
    }

    /**
     * Gets if zooming is allowed in the mini portal that the simulation defines.
     */
    get zoomable() {
        return this.mapConfig.zoomable;
    }

    /**
     * Gets the minimum value the zoom can be set to
     */
    get zoomMin() {
        return this.mapConfig.zoomMin;
    }

    /**
     * Gets the maximum value the zoom can be set to
     */
    get zoomMax() {
        return this.mapConfig.zoomMax;
    }

    /**
     * Gets the zoom level of the player that the simulation defines.
     */
    get playerZoom() {
        return this.mapConfig.playerZoom;
    }

    /**
     * Gets the x-axis rotation of the player that the simulation defines.
     */
    get playerRotationX() {
        return this.mapConfig.playerRotationX;
    }

    /**
     * Gets the x-axis rotation of the player that the simulation defines.
     */
    get playerRotationY() {
        return this.mapConfig.playerRotationY;
    }

    /**
     * Gets whether to show the camera focus point.
     */
    get showFocusPoint() {
        return this.mapConfig.showFocusPoint;
    }

    /**
     * Gets the style the cursor should have for this portal.
     */
    get cursor() {
        return this.mapConfig.cursor;
    }

    get grid3D() {
        return this._mapGrid;
    }

    constructor(game: Game, simulation: BrowserSimulation) {
        super(MAP_PORTAL, game, simulation);
        this._mapGrid = new MapPortalGrid3D(this);
    }

    getMainCameraRig(): CameraRig {
        return this._game.getMapPortalCameraRig();
    }

    init() {
        this._subs.push(
            userBotChanged(this.simulation)
                .pipe(
                    filter((bot) => !!bot),
                    tap((bot) => {
                        const userMiniDimensionValue = bot.values[MAP_PORTAL];
                        const previousDimension = this.mapDimension;
                        this.mapDimension = userMiniDimensionValue;
                        if (previousDimension !== userMiniDimensionValue) {
                            console.log(
                                '[MiniSimulation3D] User changed map portal dimension to: ',
                                userMiniDimensionValue
                            );
                        }
                    })
                )
                .subscribe()
        );
        super.init();
    }

    getGridScale(bot: AuxBot3D): number {
        return 1;
    }

    protected _constructDimensionGroup(portalTag: string, bot: Bot) {
        return new MapPortalDimensionGroup3D(
            this,
            bot,
            'player',
            this.decoratorFactory,
            portalTag
        );
    }

    protected _createPortalConfig(portalTag: string) {
        if (portalTag === MAP_PORTAL) {
            return new MapPortalConfig(portalTag, this.simulation, this.grid3D);
        } else {
            return super._createPortalConfig(portalTag);
        }
    }
}
