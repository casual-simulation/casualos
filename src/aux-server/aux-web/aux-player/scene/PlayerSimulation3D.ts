import {
    File,
    FileCalculationContext,
    hasValue,
    DEFAULT_SCENE_BACKGROUND_COLOR,
    isContextLocked,
    calculateGridScale,
    PrecalculatedFile,
    toast,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import {
    BrowserSimulation,
    userFileChanged,
} from '@casual-simulation/aux-vm-browser';
import { tap } from 'rxjs/operators';
import { MenuContext } from '../MenuContext';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import { doesFileDefinePlayerContext } from '../PlayerUtils';
import { SimulationContext } from '../SimulationContext';
import {
    Color,
    Texture,
    OrthographicCamera,
    PerspectiveCamera,
    Math as ThreeMath,
} from 'three';
import PlayerGameView from '../PlayerGameView/PlayerGameView';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { PlayerGame } from './PlayerGame';
import { PlayerGrid3D } from '../PlayerGrid3D';
import { Input } from '../../shared/scene/Input';

export class PlayerSimulation3D extends Simulation3D {
    /**
     * Keep files in a back buffer so that we can add files to contexts when they come in.
     * We should not guarantee that contexts will come first so we must have some lazy file adding.
     */
    private _fileBackBuffer: Map<string, File>;

    /**
     * The current context group 3d that the AUX Player is rendering.
     */
    private _contextGroup: ContextGroup3D;

    private _contextBackground: Color | Texture = null;

    protected _game: PlayerGame; // Override base class game so that its cast to the Aux Player Game.

    context: string;
    menuContext: MenuContext = null;
    simulationContext: SimulationContext = null;
    grid3D: PlayerGrid3D;

    /**
     * Gets the background color that the simulation defines.
     */
    get backgroundColor() {
        if (this._contextBackground) {
            return this._contextBackground;
        } else {
            return super.backgroundColor;
        }
    }

    constructor(context: string, game: Game, simulation: BrowserSimulation) {
        super(game, simulation);

        this.context = context;
        this._fileBackBuffer = new Map();

        const calc = this.simulation.helper.createContext();
        let gridScale = calculateGridScale(calc, null);
        this.grid3D = new PlayerGrid3D(gridScale).showGrid(false);
        this.grid3D.useAuxCoordinates = true;
        this.add(this.grid3D);
    }

    getMainCameraRig(): CameraRig {
        return this._game.getMainCameraRig();
    }

    init() {
        super.init();

        this._subs.push(
            userFileChanged(this.simulation)
                .pipe(
                    tap(file => {
                        const userMenuContextValue =
                            file.values['aux._userMenuContext'];
                        if (
                            !this.menuContext ||
                            this.menuContext.context !== userMenuContextValue
                        ) {
                            this.menuContext = new MenuContext(
                                this,
                                userMenuContextValue
                            );
                            console.log(
                                '[PlayerSimulation3D] User changed menu context to: ',
                                userMenuContextValue
                            );
                        }

                        const userSimulationContextValue =
                            file.values['aux._userSimulationsContext'];
                        if (
                            !this.simulationContext ||
                            this.simulationContext.context !==
                                userSimulationContextValue
                        ) {
                            this.simulationContext = new SimulationContext(
                                this,
                                userSimulationContextValue
                            );
                            console.log(
                                '[PlayerSimulation3D] User changed simulation context to: ',
                                userSimulationContextValue
                            );
                        }
                    })
                )
                .subscribe()
        );

        // Send an event to all files indicating that the given context was loaded.
        this.simulation.helper.action('onPlayerContextEnter', null, {
            context: this.context,
        });
    }

    setContext(context: string) {
        if (this.context === context) {
            return;
        }
        this.context = context;
        this.unsubscribe();
        this.closed = false;
        this.init();
    }

    protected _frameUpdateCore(calc: FileCalculationContext) {
        super._frameUpdateCore(calc);
        this.menuContext.frameUpdate(calc);
        this.simulationContext.frameUpdate(calc);
        this.grid3D.update();
    }

    protected _createContext(
        calc: FileCalculationContext,
        file: PrecalculatedFile
    ) {
        if (this._contextGroup) {
            return null;
        }
        // We dont have a context group yet. We are in search of a file that defines a player context that matches the user's current context.
        const result = doesFileDefinePlayerContext(file, this.context, calc);
        const contextLocked = isContextLocked(calc, file);
        if (result.matchFound && !contextLocked) {
            // Create ContextGroup3D for this file that we will use to render all files in the context.
            this._contextGroup = new ContextGroup3D(
                this,
                file,
                'player',
                this.decoratorFactory
            );

            // Subscribe to file change updates for this context file so that we can do things like change the background color to match the context color, etc.
            this._subs.push(
                this.simulation.watcher
                    .fileChanged(file.id)
                    .pipe(
                        tap(update => {
                            const file = update;
                            // Update the context background color.
                            let contextBackgroundColor =
                                file.tags['aux.context.color'];
                            this._contextBackground = hasValue(
                                contextBackgroundColor
                            )
                                ? new Color(contextBackgroundColor)
                                : undefined;
                        })
                    )
                    .subscribe()
            );

            return this._contextGroup;
        } else if (result.matchFound && contextLocked) {
            let message: string = 'The ' + file.id + ' context is locked.';

            this.simulation.helper.transaction(toast(message));

            this._fileBackBuffer.set(file.id, file);
        } else {
            this._fileBackBuffer.set(file.id, file);
        }
    }

    protected _removeContext(context: ContextGroup3D, removedIndex: number) {
        super._removeContext(context, removedIndex);

        if (context === this._contextGroup) {
            this._contextGroup = null;
        }
    }

    protected async _fileAddedCore(
        calc: FileCalculationContext,
        file: PrecalculatedFile
    ): Promise<void> {
        await Promise.all(
            this.contexts.map(async c => {
                await c.fileAdded(file, calc);

                if (c === this._contextGroup) {
                    // Apply back buffer of files to the newly created context group.
                    for (let entry of this._fileBackBuffer) {
                        if (entry[0] !== file.id) {
                            await this._contextGroup.fileAdded(entry[1], calc);
                        }
                    }

                    this._fileBackBuffer.clear();
                }
            })
        );

        await this.menuContext.fileAdded(file, calc);
        await this.simulationContext.fileAdded(file, calc);

        // Change the user's context after first adding and updating it
        // because the callback for file_updated was happening before we
        // could call fileUpdated from fileAdded.
        if (file.id === this.simulation.helper.userFile.id) {
            const userFile = this.simulation.helper.userFile;
            console.log(
                "[PlayerSimulation3D] Setting user's context to: " +
                    this.context
            );
            this.simulation.helper.updateFile(userFile, {
                tags: { 'aux._userContext': this.context },
            });
        }
    }

    protected async _fileUpdatedCore(
        calc: FileCalculationContext,
        file: PrecalculatedFile
    ) {
        await super._fileUpdatedCore(calc, file);
        await this.menuContext.fileUpdated(file, [], calc);
        await this.simulationContext.fileUpdated(file, [], calc);
    }

    protected _fileRemovedCore(calc: FileCalculationContext, file: string) {
        super._fileRemovedCore(calc, file);
        this.menuContext.fileRemoved(file, calc);
        this.simulationContext.fileRemoved(file, calc);
    }

    unsubscribe() {
        this._contextGroup = null;
        super.unsubscribe();
    }
}
