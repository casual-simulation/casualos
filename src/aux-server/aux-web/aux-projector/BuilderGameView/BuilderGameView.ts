import { Plane, Vector3 } from 'three';

import Component from 'vue-class-component';
import { Inject, Provide, Prop, Watch } from 'vue-property-decorator';

import {
    getFileConfigContexts,
    createContextId,
    AuxCausalTree,
    AuxOp,
    createWorkspace,
    FilesState,
    duplicateFile,
    toast,
    cleanFile,
    pasteState,
    PasteStateOptions,
} from '@casual-simulation/aux-common';
import { StoredCausalTree } from '@casual-simulation/causal-trees';

import { appManager } from '../../shared/AppManager';
import { keys } from 'lodash';
import BuilderApp from '../BuilderApp/BuilderApp';
import MiniFile from '../MiniFile/MiniFile';
import { IGameView } from '../../shared/vue-components/IGameView';
import BuilderHome from '../BuilderHome/BuilderHome';
import { isMac, copyFilesFromSimulation } from '../../shared/SharedUtils';
import BaseGameView from '../../shared/vue-components/BaseGameView';
import { BuilderGame } from '../scene/BuilderGame';
import { Game } from '../../shared/scene/Game';
import { SubscriptionLike } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { Physics } from '../../shared/scene/Physics';
import { ContextGroup3D } from 'aux-web/shared/scene/ContextGroup3D';
import { BuilderInteractionManager } from '../interaction/BuilderInteractionManager';

@Component({
    components: {
        'mini-file': MiniFile,
    },
})
export default class BuilderGameView extends BaseGameView implements IGameView {
    _game: BuilderGame = null;

    showUploadFiles: boolean = false;
    showCameraHome: boolean = false;

    @Inject() addSidebarItem: BuilderApp['addSidebarItem'];
    @Inject() removeSidebarItem: BuilderApp['removeSidebarItem'];
    @Inject() removeSidebarGroup: BuilderApp['removeSidebarGroup'];

    @Inject() home: BuilderHome;
    @Inject() buildApp: BuilderApp;

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
    }

    onDragEnter(event: DragEvent) {
        if (event.dataTransfer.types.indexOf('Files') >= 0) {
            this.showUploadFiles = true;
            event.dataTransfer.dropEffect = 'copy';
            event.preventDefault();
        }
    }

    onDragOver(event: DragEvent) {
        if (event.dataTransfer.types.indexOf('Files') >= 0) {
            this.showUploadFiles = true;
            event.dataTransfer.dropEffect = 'copy';
            event.preventDefault();
        }
    }

    onDragLeave(event: DragEvent) {
        this.showUploadFiles = false;
    }

    centerCamera() {
        this._game.onCenterCamera(this._game.mainCameraRig);
    }

    async onDrop(event: DragEvent) {
        this.showUploadFiles = false;
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
        const files = sim.selection.getSelectedFilesForUser(
            sim.helper.userFile
        );
        if (files.length === 0) {
            appManager.simulationManager.primary.helper.transaction(
                toast('Nothing selected to copy!')
            );
            return;
        }

        await copyFilesFromSimulation(sim, files);

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
                const stored: StoredCausalTree<AuxOp> = JSON.parse(json);
                let tree = new AuxCausalTree(stored);
                await tree.import(stored);
                const fileIds = keys(tree.value);

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
                    options.context = interaction.firstContextInWorkspace(
                        workspace
                    );
                    options.x = gridPosition.x;
                    options.y = gridPosition.y;
                    options.z = 0;
                }

                appManager.simulationManager.primary.helper.transaction(
                    pasteState(tree.value, options),
                    toast(
                        `${fileIds.length} ${
                            fileIds.length === 1 ? 'file' : 'files'
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
                    "Sorry, but your browser doesn't support pasting files from a selection or worksurface."
                )
            );
        }
    }
}
