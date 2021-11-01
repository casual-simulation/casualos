import { Input, InputMethod } from '../../../shared/scene/Input';
import { Ray } from '@casual-simulation/three';
import { appManager } from '../../../shared/AppManager';
import { PlayerInteractionManager } from '../PlayerInteractionManager';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { PlayerPageSimulation3D } from '../../scene/PlayerPageSimulation3D';
import { Physics } from '../../../shared/scene/Physics';
import { PlayerGame } from '../../scene/PlayerGame';
import { BaseEmptyClickOperation } from '../../../shared/interaction/ClickOperation/BaseEmptyClickOperation';
import {
    BotCalculationContext,
    ON_GRID_CLICK_ACTION_NAME,
    ON_GRID_DOWN_ACTION_NAME,
    ON_GRID_UP_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { objectForwardRay } from '../../../shared/scene/SceneUtils';
import { Simulation } from '@casual-simulation/aux-vm';
import { Grid3D } from '../../../shared/scene/Grid3D';

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
        inputMethod: InputMethod
    ) {
        super(game, interaction, inputMethod);
        this._game = game;
        this._interaction = interaction;
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {}

    protected _performClick(calc: BotCalculationContext): void {
        this._sendOnGridClickEvent(calc);
    }

    protected _performUp(calc: BotCalculationContext): void {
        this._sendGridEvent(calc, (simulation, arg) => {
            simulation.helper.action(ON_GRID_UP_ACTION_NAME, null, arg);
        });
    }

    protected _performDown(calc: BotCalculationContext): void {
        this._sendGridEvent(calc, (simulation, arg) => {
            simulation.helper.action(ON_GRID_DOWN_ACTION_NAME, null, arg);
        });
    }

    private _sendOnGridClickEvent(calc: BotCalculationContext) {
        this._sendGridEvent(calc, (simulation, arg) => {
            simulation.helper.action(ON_GRID_CLICK_ACTION_NAME, null, arg);
        });
    }

    private _sendGridEvent(
        calc: BotCalculationContext,
        sendAction: (simulation: Simulation, arg: any) => void
    ) {
        const simulation3Ds = this._game.getSimulations();
        let inputDimension: string;
        let inputRay: Ray;
        let grid: Grid3D;
        let sim: Simulation3D;

        // If we're in VR, then send the empty click to the PlayerPageSimulation
        if (this._controller) {
            const sim3D = simulation3Ds.find(
                (sim) => sim instanceof PlayerPageSimulation3D
            ) as PlayerPageSimulation3D;
            if (sim3D) {
                inputDimension = sim3D.dimension;
                inputRay = objectForwardRay(this._controller.ray);
                grid = sim3D.grid3D;
                sim = sim3D;
            }
        } else {
            // Otherwise, calculate the simulation based on the viewport the mouse is over
            const pagePos = this._game.getInput().getMousePagePos();
            const viewports = this._game.getViewports();

            for (let sim3D of simulation3Ds) {
                const rig = sim3D.getMainCameraRig();

                if (
                    Input.pagePositionOnViewport(
                        pagePos,
                        rig.viewport,
                        viewports
                    )
                ) {
                    if (sim3D instanceof PlayerSimulation3D) {
                        inputRay = Physics.screenPosToRay(
                            Input.screenPositionForViewport(
                                pagePos,
                                rig.viewport
                            ),
                            rig.mainCamera
                        );

                        inputDimension = sim3D.dimension;
                        grid = sim3D.grid3D;
                        sim = sim3D;
                    } else {
                        console.warn(
                            '[PlayerEmptyClickOperation] Unable to find grid for simulation',
                            sim
                        );
                    }

                    break;
                }
            }

            // const miniViewport = this._game.getMiniPortalViewport();
            // const mapViewport = this._game.getMapPortalViewport();
            // const isMiniPortal = Input.pagePositionOnViewport(
            //     pagePos,
            //     miniViewport,
            //     viewports
            // );
            // const isMapPortal = Input.pagePositionOnViewport(
            //     pagePos,
            //     mapViewport,
            //     viewports
            // );

            // if (isMiniPortal) {
            //     const mini = this._game.findMiniSimulation3D(
            //         sim3D.simulation
            //     );
            //     inputRay = Physics.screenPosToRay(
            //         Input.screenPositionForViewport(
            //             pagePos,
            //             miniViewport
            //         ),
            //         mini.getMainCameraRig().mainCamera
            //     );
            //     inputDimension = mini.miniDimension;
            //     grid = mini.grid3D;
            // } else if (isMapPortal) {
            //     const map = this._game.findMapSimulation3D(
            //         sim3D.simulation
            //     );
            //     inputRay = Physics.screenPosToRay(
            //         Input.screenPositionForViewport(
            //             pagePos,
            //             mapViewport
            //         ),
            //         map.getMainCameraRig().mainCamera
            //     );
            //     inputDimension = map.mapDimension;
            //     grid = map.grid3D;
            // } else {
            //     inputRay = Physics.screenPosToRay(
            //         this._game.getInput().getMouseScreenPos(),
            //         sim3D.getMainCameraRig().mainCamera
            //     );
            //     inputDimension = sim3D.dimension;
            //     grid = sim3D.grid3D;
            // }
        }

        if (!inputRay || !grid || !inputDimension || !sim) {
            return;
        }

        // Get grid tile that intersects with input ray.
        const gridTile = grid.getTileFromRay(inputRay, true);

        let position: any = {
            x: Infinity,
            Y: Infinity,
        };
        if (gridTile) {
            position = {
                x: gridTile.tileCoordinate.x,
                y: gridTile.tileCoordinate.y,
            };
        }
        sendAction(sim.simulation, {
            dimension: inputDimension,
            position: position,
        });
    }
}
