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
import type { Bot } from '@casual-simulation/aux-common';
import { MINI_PORTAL } from '@casual-simulation/aux-common';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { userBotChanged } from '@casual-simulation/aux-vm-browser';
import { tap, filter } from 'rxjs/operators';
import { MiniPortalContextGroup3D } from './MiniPortalContextGroup3D';
import type { CameraRig } from '../../shared/scene/CameraRigFactory';
import type { Game } from '../../shared/scene/Game';
import type { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
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

    get portalHDRAddress() {
        return this.miniConfig.portalHDRAddress;
    }

    /**
     * Gets the default lighting that the simulation defines.
     */
    get defaultLighting() {
        return this.miniConfig.defaultLighting;
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
