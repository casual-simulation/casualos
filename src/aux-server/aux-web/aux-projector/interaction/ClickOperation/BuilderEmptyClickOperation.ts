import { BotCalculationContext } from '@casual-simulation/aux-common';
import { appManager } from '../../../shared/AppManager';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { BuilderGame } from '../../scene/BuilderGame';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import { BaseEmptyClickOperation } from '../../../shared/interaction/ClickOperation/BaseEmptyClickOperation';

/**
 * Empty Click Operation handles clicking of empty space for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class BuilderEmptyClickOperation extends BaseEmptyClickOperation {
    protected _game: BuilderGame;
    protected _interaction: BuilderInteractionManager;

    constructor(
        game: BuilderGame,
        interaction: BuilderInteractionManager,
        vrController: VRController3D | null
    ) {
        super(game, interaction, vrController);
    }

    protected _performClick(calc: BotCalculationContext): void {
        appManager.simulationManager.primary.botPanel.isOpen = false;
        appManager.simulationManager.primary.botPanel.restrictVisible(false);

        this.removeSelected();
    }

    async removeSelected() {
        appManager.simulationManager.primary.recent.clear();

        appManager.simulationManager.primary.botPanel.search = '';

        await appManager.simulationManager.primary.selection.clearSelection();
        await appManager.simulationManager.primary.recent.clear();

        appManager.simulationManager.primary.botPanel.restrictVisible(true);
    }
}
