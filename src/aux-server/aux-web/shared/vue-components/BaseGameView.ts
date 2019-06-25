import Vue from 'vue';
import { IGameView } from './IGameView';
import { DEFAULT_USER_MODE, UserMode } from '@casual-simulation/aux-common';
import { FileRenderer } from '../scene/FileRenderer';
import { Provide, Component } from 'vue-property-decorator';
import { default as CameraTypeVue } from '../../shared/vue-components/CameraType/CameraType';
import CameraHome from '../../shared/vue-components/CameraHome/CameraHome';
import { Game } from '../scene/Game';

export interface SidebarItem {
    id: string;
    group: string;
    text: string;
    icon: string;
    click: () => void;
}

@Component({
    components: {
        'camera-type': CameraTypeVue,
        'camera-home': CameraHome,
    },
})
export default class BaseGameView extends Vue implements IGameView {
    game: Game = null;
    mode: UserMode = DEFAULT_USER_MODE;

    @Provide() fileRenderer: FileRenderer = new FileRenderer();

    get gameView(): HTMLElement {
        return <HTMLElement>this.$refs.gameView;
    }

    get container(): HTMLElement {
        return <HTMLElement>this.$refs.container;
    }

    get dev(): boolean {
        return !PRODUCTION;
    }

    get filesMode() {
        return this.mode === 'files';
    }
    get workspacesMode() {
        return this.mode === 'worksurfaces';
    }

    created() {
        this.resize = this.resize.bind(this);
        window.addEventListener('resize', this.resize);
        window.addEventListener('vrdisplaypresentchange', this.resize);

        this.game = this.createGame();
    }

    mounted() {
        this.game.setup();
        this.resize();
    }

    protected createGame(): Game {
        throw new Error('GameView has not implemented createGame.');
    }

    protected rebuildGame() {
        console.log('[BaseGameView] Rebuilding Game.');
        if (this.game) {
            this.game.dispose();
        }
        this.game = this.createGame();
        this.game.setup();
        this.resize();
    }

    beforeDestroy() {
        window.removeEventListener('resize', this.resize);
        window.removeEventListener('vrdisplaypresentchange', this.resize);

        if (this.game) {
            this.game.dispose();
        }
    }

    calculateContainerSize() {
        const width = window.innerWidth;
        const height =
            window.innerHeight - this.container.getBoundingClientRect().top;

        return { width, height };
    }

    resize() {
        const { width, height } = this.calculateContainerSize();

        this.game.onWindowResize(width, height);

        this.container.style.height = this.gameView.style.height = this.game.getRenderer().domElement.style.height;
        this.container.style.width = this.gameView.style.width = this.game.getRenderer().domElement.style.width;
    }
}
