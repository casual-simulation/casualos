import Component from 'vue-class-component';
import { Inject, Prop } from 'vue-property-decorator';

import PlayerApp from '../PlayerApp/PlayerApp';
import { IGameView } from '../../shared/vue-components/IGameView';
import MenuFile from '../MenuFile/MenuFile';
import { MenuItem } from '../MenuContext';
import BaseGameView from '../../shared/vue-components/BaseGameView';
import { PlayerGame } from '../scene/PlayerGame';
import { Game } from '../../shared/scene/Game';

@Component({
    components: {
        'menu-file': MenuFile,
    },
})
export default class PlayerGameView extends BaseGameView implements IGameView {
    game: PlayerGame = null;
    menuExpanded: boolean = true;

    @Inject() addSidebarItem: PlayerApp['addSidebarItem'];
    @Inject() removeSidebarItem: PlayerApp['removeSidebarItem'];
    @Inject() removeSidebarGroup: PlayerApp['removeSidebarGroup'];
    @Prop() context: string;

    get menu() {
        let items: MenuItem[] = [];
        this.game.playerSimulations.forEach(sim => {
            if (sim.menuContext) {
                items.push(...sim.menuContext.items);
            }
        });
        return items;
    }

    protected createGame(): Game {
        return new PlayerGame(this);
    }
}
