import { MINI_MAP_PORTAL, Bot } from '@casual-simulation/aux-common';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { MapSimulation3D } from './MapSimulation3D';
import { MiniMapPortalDimensionGroup3D } from './MiniMapPortalDimensionGroup3D';
import { MiniMapPortalConfig } from './MiniMapPortalConfig';
import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';

export class MiniMapSimulation3D extends MapSimulation3D {
    get miniConfig() {
        return <MiniMapPortalConfig>this.getPortalConfig(this._portalTag);
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

    constructor(game: Game, simulation: BrowserSimulation) {
        super(MINI_MAP_PORTAL, game, simulation);
    }

    getMainCameraRig(): CameraRig {
        return this._game.getMiniMapPortalCameraRig();
    }

    protected _createPortalConfig(portalTag: string) {
        if (portalTag === this._portalTag) {
            return new MiniMapPortalConfig(
                portalTag,
                this.simulation,
                this.grid3D
            );
        } else {
            return super._createPortalConfig(portalTag);
        }
    }

    protected _constructDimensionGroup(
        portalTag: string,
        bot: Bot
    ): DimensionGroup3D {
        return new MiniMapPortalDimensionGroup3D(
            this,
            bot,
            'player',
            this.decoratorFactory,
            portalTag
        );
    }
}
