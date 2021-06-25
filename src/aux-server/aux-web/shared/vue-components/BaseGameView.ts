import Vue from 'vue';
import { IGameView } from './IGameView';
import { BotRenderer } from '../scene/BotRenderer';
import { Provide, Component, Prop } from 'vue-property-decorator';
import { default as CameraTypeVue } from '../../shared/vue-components/CameraType/CameraType';
import CameraHome from '../../shared/vue-components/CameraHome/CameraHome';
import { Game } from '../scene/Game';
import { SubscriptionLike } from 'rxjs';
import { EventBus } from '../EventBus';
import { debounce } from 'lodash';
import { BotCursorType, getCursorCSS } from '@casual-simulation/aux-common';

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
    private _resizeObserver: import('@juggle/resize-observer').ResizeObserver;
    protected _subscriptions: SubscriptionLike[] = [];

    cursor: string = null;

    _game: Game = null;

    @Prop({})
    containerId: string;

    get gameView(): HTMLElement {
        return <HTMLElement>this.$refs.gameView;
    }

    get container(): HTMLElement {
        return <HTMLElement>this.$refs.container;
    }

    get dev(): boolean {
        return !PRODUCTION;
    }

    async created() {
        this._subscriptions = [];
        const resize = this.resize.bind(this);
        this.resize = debounce(resize, 100);

        EventBus.$on('resize', () => this.resize());
        // window.addEventListener('resize', this.resize);
        window.addEventListener('vrdisplaypresentchange', () => this.resize());

        this._game = this.createGame();

        if (this.containerId) {
            const el = document.getElementById(this.containerId);
            if (el) {
                const ResizeObserver =
                    window.ResizeObserver ||
                    (await import('@juggle/resize-observer')).ResizeObserver;
                this._resizeObserver = new ResizeObserver(() => this.resize());
                this._resizeObserver.observe(el);
            }
        }
    }

    mounted() {
        this._game.setup();
        this.resize();

        this.setupCore();
    }

    protected setupCore() {}

    protected createGame(): Game {
        throw new Error('GameView has not implemented createGame.');
    }

    protected rebuildGame() {
        console.log('[BaseGameView] Rebuilding Game.');
        if (this._game) {
            this._game.dispose();
        }
        this._game = this.createGame();
        this._game.setup();
        this.resize();
    }

    setCursor(cursor: BotCursorType): void {
        this.cursor = getCursorCSS(cursor);
    }

    beforeDestroy() {
        // window.removeEventListener('resize', this.resize);
        window.removeEventListener('', this.resize);

        if (this._game) {
            this._game.dispose();
        }

        for (let sub of this._subscriptions) {
            sub.unsubscribe();
        }
        this._subscriptions = [];
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
        }
    }

    calculateContainerSize() {
        const width = window.innerWidth;
        const height =
            window.innerHeight - this.container.getBoundingClientRect().top;

        return { width, height };
    }

    /**
     * Resizes the game view.
     * This is automatically triggered when the EventBus emits a "resize" event or when the vrdisplaypresentchange event is emitted.
     *
     * Resizing works by calculating the size that the viewport should be and setting the container and game (and therefore renderer) to be that size.
     * The size calculation algorithm looks like this:
     * - Check if the containerId property has been set.
     * - If it has, then use the size of the DOM element that matches that property.
     * - If it has not, then assume that the game view container should be fullscreen minus any elements that are placed above it.
     */
    resize() {
        if (this.containerId) {
            const el = document.getElementById(this.containerId);
            if (el) {
                const { width, height } = el.getBoundingClientRect();
                if (width <= 0 || height <= 0) {
                    setTimeout(() => this.resize());
                } else {
                    this._setWidthAndHeight(width, height);
                }
                return;
            }
        }

        const { width, height } = this.calculateContainerSize();
        this._setWidthAndHeight(width, height);
    }

    protected setWidthAndHeightCore(width: number, height: number) {}

    private _setWidthAndHeight(width: number, height: number) {
        this._game.onWindowResize(width, height);

        this.container.style.height = this.gameView.style.height = this._game.getRenderer().domElement.style.height;
        this.container.style.width = this.gameView.style.width = this._game.getRenderer().domElement.style.width;
        this.setWidthAndHeightCore(width, height);
    }
}
