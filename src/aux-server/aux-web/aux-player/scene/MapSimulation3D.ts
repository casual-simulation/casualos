/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { BotCalculationContext, Bot } from '@casual-simulation/aux-common';
import {
    calculateGridScale,
    DEFAULT_MAP_PORTAL_SCALE,
    DEFAULT_MAP_PORTAL_GRID_SCALE,
} from '@casual-simulation/aux-common';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { userBotChanged } from '@casual-simulation/aux-vm-browser';
import { tap, filter } from 'rxjs/operators';
import type { CameraRig } from '../../shared/scene/CameraRigFactory';
import type { Game } from '../../shared/scene/Game';
import type { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import { PlayerSimulation3D } from './PlayerSimulation3D';
import { MapPortalConfig } from './MapPortalConfig';
import { MapPortalDimensionGroup3D } from './MapPortalDimensionGroup3D';
import type EsriSceneView from 'esri/views/SceneView';
import { MapPortalGrid3D, EARTH_RADIUS } from './MapPortalGrid3D';

export abstract class MapSimulation3D extends PlayerSimulation3D {
    /**
     * The miniGridPortal dimension that this simulation is for.
     */
    mapDimension: string;

    /**
     * The map view that this simulation should use.
     */
    mapView: EsriSceneView;

    protected _portalTag: string;
    protected _mapGrid: MapPortalGrid3D;

    getDefaultGridScale(): number {
        return this.mapConfig.gridScale;
    }

    get mapConfig() {
        return <MapPortalConfig>this.getPortalConfig(this._portalTag);
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
     * Gets if rotation is allowed in the miniGridPortal that the simulation defines.
     */
    get rotatable() {
        return this.mapConfig.rotatable;
    }

    /**
     * Gets if zooming is allowed in the miniGridPortal that the simulation defines.
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

    get basemap() {
        return this.mapConfig.basemap;
    }

    constructor(portal: string, game: Game, simulation: BrowserSimulation) {
        super(portal, game, simulation);
        this._portalTag = portal;
        this._mapGrid = new MapPortalGrid3D(
            this,
            calculateGridScale(
                null,
                null,
                DEFAULT_MAP_PORTAL_SCALE,
                DEFAULT_MAP_PORTAL_GRID_SCALE
            )
        );
    }

    abstract getMainCameraRig(): CameraRig;

    init() {
        this._subs.push(
            userBotChanged(this.simulation)
                .pipe(
                    filter((bot) => !!bot),
                    tap((bot) => {
                        const userMiniDimensionValue =
                            bot.values[this._portalTag];
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

    protected _constructDimensionGroup(
        portalTag: string,
        bot: Bot
    ): DimensionGroup3D {
        return new MapPortalDimensionGroup3D(
            this,
            bot,
            'player',
            this.decoratorFactory,
            portalTag
        );
    }

    protected _createPortalConfig(portalTag: string) {
        if (portalTag === this._portalTag) {
            return new MapPortalConfig(portalTag, this.simulation, this.grid3D);
        } else {
            return super._createPortalConfig(portalTag);
        }
    }

    protected _frameUpdateCore(calc: BotCalculationContext) {
        super._frameUpdateCore(calc);
        if (this.mapView) {
            const newMax = this.zoomMax ?? EARTH_RADIUS * 4;
            if (this.mapView.constraints.altitude.max !== newMax) {
                this.mapView.constraints.altitude.max = newMax;
            }
            const newMin = this.zoomMin ?? -200000;
            if (this.mapView.constraints.altitude.min !== newMin) {
                this.mapView.constraints.altitude.min = newMin;
            }
        }
    }
}
