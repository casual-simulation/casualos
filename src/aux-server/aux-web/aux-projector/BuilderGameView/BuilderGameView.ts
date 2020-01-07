import { Plane, Vector3 } from 'three';

import Component from 'vue-class-component';
import { Inject, Provide, Prop, Watch } from 'vue-property-decorator';

import {
    getBotConfigDimensions,
    createDimensionId,
    AuxCausalTree,
    AuxOp,
    createWorkspace,
    BotsState,
    duplicateBot,
    toast,
    cleanBot,
    pasteState,
    PasteStateOptions,
} from '@casual-simulation/aux-common';

import { appManager } from '../../shared/AppManager';
import BuilderApp from '../BuilderApp/BuilderApp';
import MiniBot from '../MiniBot/MiniBot';
import { IGameView } from '../../shared/vue-components/IGameView';
import BuilderHome from '../BuilderHome/BuilderHome';
import { isMac, copyBotsFromSimulation } from '../../shared/SharedUtils';
import BaseGameView from '../../shared/vue-components/BaseGameView';
import { BuilderGame } from '../scene/BuilderGame';
import { Game } from '../../shared/scene/Game';
import { SubscriptionLike, Subscription } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Physics } from '../../shared/scene/Physics';
import { BuilderInteractionManager } from '../interaction/BuilderInteractionManager';
import { Input } from '../../shared/scene/Input';
import { BotRenderer, getRenderer } from '../../shared/scene/BotRenderer';
import {
    StoredAux,
    getBotsStateFromStoredAux,
} from '@casual-simulation/aux-vm';

@Component({
    components: {
        'mini-bot': MiniBot,
    },
})
export default class BuilderGameView extends BaseGameView implements IGameView {
    _game: BuilderGame = null;

    showUploadFiles: boolean = false;
    showCameraHome: boolean = false;

    private _counter: number = 0;

    @Inject() addSidebarItem: BuilderApp['addSidebarItem'];
    @Inject() removeSidebarItem: BuilderApp['removeSidebarItem'];
    @Inject() removeSidebarGroup: BuilderApp['removeSidebarGroup'];

    @Inject() home: BuilderHome;
    @Inject() buildApp: BuilderApp;

    @Provide() botRenderer: BotRenderer = getRenderer();

    @Prop() channelId: string;

    @Watch('channelId')
    onChannelIdChanged() {
        this.rebuildGame();
    }

    constructor() {
        super();
    }

    protected createGame(): Game {
        return new BuilderGame(appManager.simulationManager.primary, this);
    }

    protected setupCore() {
        this._subscriptions.push(
            this._game
                .watchCameraRigDistanceSquared(this._game.mainCameraRig)
                .pipe(
                    map(distSqr => distSqr >= 75),
                    tap(visible => (this.showCameraHome = visible))
                )
                .subscribe()
        );

        this._counter = 0;
        const dragEnterListener = (event: DragEvent) => this.onDragEnter(event);
        const dragLeaveListener = (event: DragEvent) => this.onDragLeave(event);
        const dragOverListener = (event: DragEvent) => this.onDragOver(event);
        const dropListener = (event: DragEvent) => this.onDrop(event);

        document.addEventListener('dragenter', dragEnterListener, false);
        document.addEventListener('dragleave', dragLeaveListener, false);
        document.addEventListener('dragover', dragOverListener, false);
        document.addEventListener('drop', dropListener, false);

        this._subscriptions.push(
            new Subscription(() => {
                document.removeEventListener('dragenter', dragEnterListener);
                document.removeEventListener('dragleave', dragLeaveListener);
                document.removeEventListener('dragover', dragOverListener);
                document.removeEventListener('drop', dropListener);
            })
        );
    }

    onDragEnter(event: DragEvent) {
        if (this._counter < 0) {
            this._counter = 0;
        }
        if (
            Input.isElementContainedByOrEqual(<Element>event.target, this.$el)
        ) {
            if (event.dataTransfer.types.indexOf('Files') >= 0) {
                this.showUploadFiles = true;
                event.dataTransfer.dropEffect = 'copy';
                event.preventDefault();
                this._counter += 1;
            }
        }
    }

    onDragOver(event: DragEvent) {
        if (
            Input.isElementContainedByOrEqual(<Element>event.target, this.$el)
        ) {
            if (event.dataTransfer.types.indexOf('Files') >= 0) {
                this.showUploadFiles = true;
                event.dataTransfer.dropEffect = 'copy';
                event.preventDefault();
                event.stopPropagation();
            }
        }
    }

    onDragLeave(event: DragEvent) {
        if (
            Input.isElementContainedByOrEqual(<Element>event.target, this.$el)
        ) {
            this._counter -= 1;
        }

        if (this._counter <= 0) {
            this.showUploadFiles = false;
        }
    }

    centerCamera() {
        this._game.onCenterCamera(this._game.mainCameraRig);
    }

    async onDrop(event: DragEvent) {
        this.showUploadFiles = false;
        this._counter = 0;

        if (
            Input.isElementContainedByOrEqual(<Element>event.target, this.$el)
        ) {
            event.preventDefault();

            let auxFiles: File[] = [];
            if (event.dataTransfer.items) {
                for (let i = 0; i < event.dataTransfer.items.length; i++) {
                    const item = event.dataTransfer.items[i];
                    if (item.kind === 'file') {
                        const file = item.getAsFile();
                        if (file.name.endsWith('.aux')) {
                            auxFiles.push(file);
                        }
                    }
                }
            } else {
                for (let i = 0; i < event.dataTransfer.files.length; i++) {
                    const file = event.dataTransfer.files.item(i);
                    if (file.name.endsWith('.aux')) {
                        auxFiles.push(file);
                    }
                }
            }

            if (auxFiles.length > 0) {
                console.log(
                    `[BuilderGameView] Uploading ${auxFiles.length} ${
                        auxFiles.length === 1 ? 'file' : 'files'
                    }`
                );
                await Promise.all(
                    auxFiles.map(file => appManager.uploadState(file))
                );
            }
        }
    }

    copySelectionMac() {
        if (isMac()) {
            this._copySelection();
        }
    }

    copySelectionNormal() {
        if (!isMac()) {
            this._copySelection();
        }
    }

    pasteClipboardMac() {
        if (isMac()) {
            this._pasteClipboard();
        }
    }

    pasteClipboardNormal() {
        if (!isMac()) {
            this._pasteClipboard();
        }
    }

    private async _copySelection() {
        const sim = appManager.simulationManager.primary;
        const bots = sim.selection.getSelectedBotsForUser(sim.helper.userBot);
        if (bots.length === 0) {
            appManager.simulationManager.primary.helper.transaction(
                toast('Nothing selected to copy!')
            );
            return;
        }

        await copyBotsFromSimulation(sim, bots);

        appManager.simulationManager.primary.helper.transaction(
            toast('Selection Copied!')
        );
    }

    private async _pasteClipboard() {
        if (navigator.clipboard) {
            try {
                const calc = appManager.simulationManager.primary.helper.createContext();

                // TODO: Cleanup this function
                const json = await navigator.clipboard.readText();
                const stored: StoredAux = JSON.parse(json);
                const state = await getBotsStateFromStoredAux(stored);
                const botIds = Object.keys(state);

                const interaction = this._game.getInteraction() as BuilderInteractionManager;
                const mouseDir = Physics.screenPosToRay(
                    this._game.getInput().getMouseScreenPos(),
                    this._game.mainCameraRig.mainCamera
                );
                const point = Physics.pointOnPlane(
                    mouseDir,
                    new Plane(new Vector3(0, 1, 0))
                );
                let options: PasteStateOptions = {
                    x: point.x,
                    y: point.z,
                    z: point.y,
                };
                const {
                    good,
                    gridPosition,
                    workspace,
                } = interaction.pointOnWorkspaceGrid(
                    calc,
                    this._game.getInput().getMousePagePos()
                );
                if (good) {
                    options.dimension = interaction.firstDimensionInWorkspace(
                        workspace
                    );
                    options.x = gridPosition.x;
                    options.y = gridPosition.y;
                    options.z = 0;
                }

                appManager.simulationManager.primary.helper.transaction(
                    pasteState(state, options),
                    toast(
                        `${botIds.length} ${
                            botIds.length === 1 ? 'bot' : 'bots'
                        } pasted!`
                    )
                );
            } catch (ex) {
                console.error('[BuilderGameView] Paste failed', ex);
                appManager.simulationManager.primary.helper.transaction(
                    toast(
                        "Couldn't paste your clipboard. Have you copied a selection or worksurface?"
                    )
                );
            }
        } else {
            console.error(
                "[BuilderGameView] Browser doesn't support clipboard API!"
            );
            appManager.simulationManager.primary.helper.transaction(
                toast(
                    "Sorry, but your browser doesn't support pasting bots from a selection or worksurface."
                )
            );
        }
    }
}
