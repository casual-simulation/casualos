import Component from 'vue-class-component';
import { Inject, Prop } from 'vue-property-decorator';

import PlayerApp from '../PlayerApp/PlayerApp';
import { IGameView } from '../../shared/vue-components/IGameView';
import MenuFile from '../MenuFile/MenuFile';
import { MenuItem } from '../MenuContext';
import BaseGameView from '../../shared/vue-components/BaseGameView';
import { PlayerGame } from '../scene/PlayerGame';
import { Game } from '../../shared/scene/Game';
import { map, tap, combineLatest } from 'rxjs/operators';

@Component({
    components: {
        'menu-file': MenuFile,
    },
})
export default class PlayerGameView extends BaseGameView implements IGameView {
    _game: PlayerGame = null;
    menuExpanded: boolean = true;
    showInventoryCameraHome: boolean = false;
    inventoryViewportStyle: any = {};
    mainViewportStyle: any = {};

    hasMainViewport: boolean = false;
    hasInventoryViewport: boolean = false;

    @Inject() addSidebarItem: PlayerApp['addSidebarItem'];
    @Inject() removeSidebarItem: PlayerApp['removeSidebarItem'];
    @Inject() removeSidebarGroup: PlayerApp['removeSidebarGroup'];
    @Prop() context: string;

    // TODO: Ensure this still works
    get menu() {
        let items: MenuItem[] = [];
        this._game.playerSimulations.forEach(sim => {
            if (sim.menuContext) {
                items.push(...sim.menuContext.items);
            }
        });
        return items;
    }

    constructor() {
        super();
    }

    protected createGame(): Game {
        return new PlayerGame(this);
    }

    mouseDownSlider() {
        this._game.mouseDownSlider();
    }

    mouseUpSlider() {
        this._game.mouseUpSlider();
    }

    setupCore() {
        this._subscriptions.push(
            this._game
                .watchCameraRigDistanceSquared(this._game.inventoryCameraRig)
                .pipe(
                    map(distSqr => distSqr >= 75),
                    tap(visible => (this.showInventoryCameraHome = visible))
                )
                .subscribe()
        );

        if (this._game.inventoryViewport) {
            this.hasInventoryViewport = true;
            this._subscriptions.push(
                this._game.inventoryViewport.onUpdated
                    .pipe(
                        map(viewport => ({
                            bottom: viewport.y + 'px',
                            left: viewport.x + 'px',
                            width: viewport.width + 'px',
                            height: viewport.height + 'px',
                        })),
                        tap(style => {
                            this.inventoryViewportStyle = style;
                        })
                    )
                    .subscribe()
            );
        }

        if (this._game.mainViewport && this._game.inventoryViewport) {
            this.hasMainViewport = true;
            this._subscriptions.push(
                this._game.mainViewport.onUpdated
                    .pipe(
                        combineLatest(
                            this._game.inventoryViewport.onUpdated,
                            (first, second) => ({
                                main: first,
                                inventory: second,
                            })
                        ),
                        map(({ main, inventory }) => ({
                            bottom: inventory.height + 'px',
                            left: main.x + 'px',
                            width: main.width + 'px',
                            height: main.height - inventory.height + 'px',
                        })),
                        tap(style => {
                            this.mainViewportStyle = style;
                        })
                    )
                    .subscribe()
            );
        }
    }

    centerInventoryCamera() {
        this._game.onCenterCamera(this._game.inventoryCameraRig);
    }
}
