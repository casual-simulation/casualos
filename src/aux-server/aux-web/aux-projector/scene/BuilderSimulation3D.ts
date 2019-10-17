import { Simulation3D } from '../../shared/scene/Simulation3D';
import { BuilderGroup3D } from '../../shared/scene/BuilderGroup3D';
import {
    AuxObject,
    getBotConfigContexts,
    BotCalculationContext,
    Object,
    isContext,
    PrecalculatedBot,
} from '@casual-simulation/aux-common';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import { PerspectiveCamera, OrthographicCamera, Object3D, Plane } from 'three';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';

export class BuilderSimulation3D extends Simulation3D {
    recentBots: Object[] = [];
    selectedRecentBot: Object = null;

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

        this.recentBots = this.simulation.recent.bots;

        this._subs.push(
            this.simulation.recent.onUpdated.subscribe(() => {
                this.recentBots = this.simulation.recent.bots;
                this.selectedRecentBot = this.simulation.recent.selectedRecentBot;
            })
        );
    }

    getMainCameraRig(): CameraRig {
        return this.game.getMainCameraRig();
    }

    clearRecentBots() {
        this.simulation.recent.clear();
    }

    selectRecentBot(bot: PrecalculatedBot) {
        if (
            !this.simulation.recent.selectedRecentBot ||
            this.simulation.recent.selectedRecentBot.id !== bot.id
        ) {
            this.simulation.recent.selectedRecentBot = bot;
            this.simulation.selection.clearSelection();
        } else {
            this.simulation.recent.selectedRecentBot = null;
        }
    }

    protected _createContextGroups(
        calc: BotCalculationContext,
        bot: PrecalculatedBot
    ): ContextGroup3D[] {
        const context = new BuilderGroup3D(this, bot, this.decoratorFactory);
        context.setGridChecker(this._game.getGridChecker());
        return [context];
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
            tags: { 'aux._userChannel': this.simulation.id },
        });
    }
}
