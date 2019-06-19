import { Input } from '../../../shared/scene/Input';
import { Ray } from 'three';
import { appManager } from '../../../shared/AppManager';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { Physics } from '../../../shared/scene/Physics';
import { PlayerGame } from '../../scene/PlayerGame';
import { VRController3D, Pose } from '../../../shared/scene/vr/VRController3D';
import { BaseEmptyClickOperation } from '../../../shared/interaction/ClickOperation/BaseEmptyClickOperation';
import { FileCalculationContext } from '@casual-simulation/aux-common';

/**
 * Empty Click Operation handles clicking of empty space for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class PlayerEmptyClickOperation extends BaseEmptyClickOperation {
    protected _game: PlayerGame;
    protected _interaction: PlayerInteractionManager;

    get simulation() {
        return appManager.simulationManager.primary;
    }

    constructor(
        game: PlayerGame,
        interaction: PlayerInteractionManager,
        vrController: VRController3D | null
    ) {
        super(game, interaction, vrController);
        this._game = game;
        this._interaction = interaction;
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {}

    protected _performClick(calc: FileCalculationContext): void {
        this._sendOnGridClickEvent();
    }

    private _sendOnGridClickEvent() {
        const pagePos = this._game.getInput().getMousePagePos();
        const inventoryViewport = this._game.getInventoryViewport();

        const isInventory = Input.pagePositionOnViewport(
            pagePos,
            inventoryViewport
        );
        const simulations = this._game.getSimulations();

        for (const sim of simulations) {
            if (sim instanceof PlayerSimulation3D) {
                const inventory = this._game.findInventorySimulation3D(
                    sim.simulation
                );
                let mouseDir: Ray;
                if (isInventory) {
                    mouseDir = Physics.screenPosToRay(
                        Input.screenPositionForViewport(
                            pagePos,
                            inventoryViewport
                        ),
                        inventory.getMainCameraRig().mainCamera
                    );
                } else {
                    mouseDir = Physics.screenPosToRay(
                        this._game.getInput().getMouseScreenPos(),
                        sim.getMainCameraRig().mainCamera
                    );
                }

                this._sendOnGridClickEventToSimulations(
                    sim,
                    inventory,
                    isInventory,
                    mouseDir
                );
            }
        }
    }

    private _sendOnGridClickEventToSimulations(
        sim: PlayerSimulation3D,
        inventory: InventorySimulation3D,
        isInventory: boolean,
        mouseDir: Ray
    ) {
        const calc = sim.simulation.helper.createContext();
        const { good, gridTile } = this._interaction.pointOnGrid(
            calc,
            mouseDir
        );

        if (good) {
            const context = isInventory
                ? inventory.inventoryContext
                : sim.context;
            sim.simulation.helper.action('onGridClick', null, {
                context: context,
                position: {
                    x: gridTile.tileCoordinate.x,
                    y: gridTile.tileCoordinate.y,
                },
            });
        }
    }
}
