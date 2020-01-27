import { Simulation3D } from '../../shared/scene/Simulation3D';
import { BuilderGroup3D } from '../../shared/scene/BuilderGroup3D';
import {
    AuxObject,
    getBotConfigDimensions,
    BotCalculationContext,
    Object,
    isDimension,
    PrecalculatedBot,
} from '@casual-simulation/aux-common';
import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import { PerspectiveCamera, OrthographicCamera, Object3D, Plane } from 'three';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';

export class BuilderSimulation3D extends Simulation3D {
    /**
     * Creates a new BuilderSimulation3D object that can be used to render the given simulation.
     * @param game The game view.
     * @param simulation The simulation to render.
     */
    constructor(game: Game, simulation: BrowserSimulation) {
        super(game, simulation);
    }

    init() {
        super.init();
    }

    getMainCameraRig(): CameraRig {
        return this.game.getMainCameraRig();
    }

    protected _createDimensionGroup(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): DimensionGroup3D {
        const dimension = new BuilderGroup3D(this, bot, this.decoratorFactory);
        dimension.setGridChecker(this._game.getGridChecker());
        return dimension;
    }

    protected _onBotAdded(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): void {
        super._onBotAdded(calc, bot);

        if (bot != this.simulation.helper.userBot) {
            return;
        }

        this.simulation.helper.updateBot(this.simulation.helper.userBot, {
            tags: { auxUniverse: this.simulation.id },
        });
    }
}
