import { MAP_PORTAL } from '@casual-simulation/aux-common';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { MapSimulation3D } from './MapSimulation3D';

export class PlayerMapSimulation3D extends MapSimulation3D {
    constructor(game: Game, simulation: BrowserSimulation) {
        super(MAP_PORTAL, game, simulation);
    }

    getMainCameraRig(): CameraRig {
        return this._game.getMapPortalCameraRig();
    }
}
