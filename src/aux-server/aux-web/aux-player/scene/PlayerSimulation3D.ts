import {
    Object,
    AuxObject,
    FileCalculationContext,
    hasValue,
    DEFAULT_SCENE_BACKGROUND_COLOR,
    isContextLocked,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { IGameView } from '../../shared/IGameView';
import { Simulation } from '../../shared/Simulation';
import { tap } from 'rxjs/operators';
import { MenuContext } from '../MenuContext';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import { doesFileDefinePlayerContext } from '../PlayerUtils';
import { SimulationContext } from '../SimulationContext';
import { Color, Texture, OrthographicCamera, PerspectiveCamera } from 'three';
import GameView from '../GameView/GameView';
import { CameraRig } from '../../shared/scene/CameraRigFactory';

export class PlayerSimulation3D extends Simulation3D {
    /**
     * Keep files in a back buffer so that we can add files to contexts when they come in.
     * We should not guarantee that contexts will come first so we must have some lazy file adding.
     */
    private _fileBackBuffer: Map<string, AuxObject>;

    /**
     * The current context group 3d that the AUX Player is rendering.
     */
    private _contextGroup: ContextGroup3D;

    private _contextBackground: Color | Texture = null;
    private _sceneBackground: Color | Texture = null;

    protected _gameView: GameView; // Override base class gameView so that its cast to the Aux Player GameView.

    context: string;
    menuContext: MenuContext = null;
    simulationContext: SimulationContext = null;

    /**
     * Gets the background color that the simulation defines.
     */
    get backgroundColor() {
        return this._contextBackground || this._sceneBackground;
    }

    constructor(context: string, gameView: IGameView, simulation: Simulation) {
        super(gameView, simulation);

        this.context = context;
        this._fileBackBuffer = new Map();
    }

    getMainCameraRig(): CameraRig {
        return this._gameView.getMainCameraRig();
    }

    init() {
        super.init();

        this._subs.push(
            this.simulation.watcher
                .fileChanged(this.simulation.helper.userFile)
                .pipe(
                    tap(file => {
                        const userMenuContextValue =
                            file.tags['aux._userMenuContext'];
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
                            file.tags['aux._userSimulationsContext'];
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

        this._subs.push(
            this.simulation.watcher
                .fileChanged(this.simulation.helper.globalsFile)
                .pipe(
                    tap(file => {
                        // Scene background color.
                        let sceneBackgroundColor = file.tags['aux.scene.color'];
                        this._sceneBackground = hasValue(sceneBackgroundColor)
                            ? new Color(sceneBackgroundColor)
                            : null;
                    })
                )
                .subscribe()
        );

        this._subs.push(
            this.simulation.helper.localEvents
                .pipe(
                    tap(e => {
                        if (e.name === 'tween_to') {
                            this._gameView.tweenCameraToFile(
                                this.getMainCameraRig(),
                                e.fileId,
                                e.zoomValue
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
    }

    protected _createContext(calc: FileCalculationContext, file: AuxObject) {
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
                this._gameView.getDecoratorFactory()
            );

            // Subscribe to file change updates for this context file so that we can do things like change the background color to match the context color, etc.
            this._subs.push(
                this.simulation.watcher
                    .fileChanged(file)
                    .pipe(
                        tap(file => {
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

    // protected _fileRemovedCore(calc: FileCalculationContext, id: string) {
    //     super._fileRemovedCore(calc, id);

    //     if (this._contextGroup) {
    //         if (this._contextGroup.file.id === id) {
    //             // File that defined player context has been removed.
    //             // Dispose of the context group.
    //             this._contextGroup.dispose();
    //             this.remove(this._contextGroup);
    //             this._contextGroup = null;
    //         }
    //     }
    // }

    protected async _fileAddedCore(
        calc: FileCalculationContext,
        file: AuxObject
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
        file: AuxObject
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
