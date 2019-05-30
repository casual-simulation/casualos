import { Input } from '../../../shared/scene/Input';
import { Vector2, Vector3, Ray } from 'three';
import { IOperation } from '../../../shared/interaction/IOperation';
import { appManager } from '../../../shared/AppManager';
import { EventBus } from '../../../shared/EventBus';
import PlayerGameView from '../../PlayerGameView/PlayerGameView';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { InventorySimulation3D } from '../../scene/InventorySimulation3D';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { Physics } from '../../../shared/scene/Physics';

/**
 * Empty Click Operation handles clicking of empty space for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class PlayerEmptyClickOperation implements IOperation {
    public static readonly DragThreshold: number = 0.02;
    public static CanOpenColorPicker = true;

    protected _interaction: PlayerInteractionManager;

    private _gameView: PlayerGameView;
    private _finished: boolean;
    private _startScreenPos: Vector2;

    get simulation() {
        return appManager.simulationManager.primary;
    }

    constructor(
        gameView: PlayerGameView,
        interaction: PlayerInteractionManager
    ) {
        this._gameView = gameView;
        this._interaction = interaction;

        // Store the screen position of the input when the click occured.
        this._startScreenPos = this._gameView.getInput().getMouseScreenPos();
    }

    public update(): void {
        if (this._finished) return;

        if (!this._gameView.getInput().getMouseButtonHeld(0)) {
            const curScreenPos = this._gameView.getInput().getMouseScreenPos();
            const distance = curScreenPos.distanceTo(this._startScreenPos);

            if (distance < PlayerEmptyClickOperation.DragThreshold) {
                this._sendOnGridClickEvent();
            }

            // Button has been released. This click operation is finished.
            this._finished = true;
        }
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {}

    private _sendOnGridClickEvent() {
        const pagePos = this._gameView.getInput().getMousePagePos();
        const inventoryViewport = this._gameView.getInventoryViewport();

        const isInventory = Input.pagePositionOnViewport(
            pagePos,
            inventoryViewport
        );
        const simulations = this._gameView.getSimulations();

        for (let sim of simulations) {
            if (sim instanceof PlayerSimulation3D) {
                const inventory = this._gameView.findInventorySimulation3D(
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
                        this._gameView.getInput().getMouseScreenPos(),
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
