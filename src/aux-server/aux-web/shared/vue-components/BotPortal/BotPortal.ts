import Vue from 'vue';
import Component from 'vue-class-component';
import {
    hasValue,
    PrecalculatedBot,
    calculateStringTagValue,
    calculateMeetPortalAnchorPointOffset,
    BOT_PORTAL
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { BotPortalConfig } from './BotPortalConfig';
import { EventBus } from '@casual-simulation/aux-components';
import stableStringify from '@casual-simulation/fast-json-stable-stringify';

@Component({
    components: {},
})
export default class MeetPortal extends Vue {
    private _sub: Subscription;
    private _simulations: Map<BrowserSimulation, Subscription> = new Map();
    private _portals: Map<BrowserSimulation, string> = new Map();
    private _currentConfig: BotPortalConfig;
    private _currentSim: BrowserSimulation;

    currentBot: string = null;
    extraStyle: Object = {};

    get hasPortal(): boolean {
        return hasValue(this.currentBot);
    }

    /**
     * The HTML element that contains the meet iframe.
     */
    get portalElement(): HTMLElement {
        return <HTMLElement>this.$refs.portalContainer;
    }

    /**
     * The HTML element that contains the other elements that should be repositioned when
     * the meet portal is open.
     */
    get othersElement(): HTMLElement {
        return <HTMLElement>this.$refs.otherContainer;
    }

    constructor() {
        super();
    }

    created() {
        this._sub = new Subscription();
        this._simulations = new Map();
        this._portals = new Map();
        this.extraStyle = calculateMeetPortalAnchorPointOffset('fullscreen');

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap((sim) => this._onSimulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap((sim) => this._onSimulationRemoved(sim)))
                .subscribe()
        );
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    private _onSimulationAdded(sim: BrowserSimulation) {
        let sub = new Subscription();
        this._simulations.set(sim, sub);

        sub.add(
            userBotChanged(sim)
                .pipe(tap((user) => this._onUserBotUpdated(sim, user)))
                .subscribe()
        );
    }

    private _onSimulationRemoved(sim: BrowserSimulation) {
        const sub = this._simulations.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulations.delete(sim);
        this._portals.delete(sim);
        this._updateCurrentPortal();
    }

    private _onUserBotUpdated(sim: BrowserSimulation, user: PrecalculatedBot) {
        const bot = calculateStringTagValue(null, user, BOT_PORTAL, null);
        if (hasValue(bot)) {
            this._portals.set(sim, bot);
        } else {
            this._portals.delete(sim);
        }
        this._updateCurrentPortal();
    }

    /**
     * Updates the current simulation and portal.
     */
    private _updateCurrentPortal() {
        // If the current sim still exists, then keep it.
        if (this._currentSim && this._portals.has(this._currentSim)) {
            const meet = this._portals.get(this._currentSim);
            this._setCurrentSim(this._currentSim, meet);
            return;
        }

        // Use the first meet
        this._setCurrentSim(null, null);
        for (let [sim, meet] of this._portals) {
            this._setCurrentSim(sim, meet);
            break;
        }
    }

    private _setCurrentSim(sim: BrowserSimulation, botId: string) {
        if (this._currentSim !== sim) {
            if (this._currentConfig) {
                this._currentConfig.unsubscribe();
                this._currentConfig = null;
            }

            if (sim) {
                this._currentConfig = new BotPortalConfig(BOT_PORTAL, sim);
                this._currentConfig.onUpdated
                    .pipe(
                        tap(() => {
                            this._updateConfig();
                        })
                    )
                    .subscribe();
            }
        }
        this._currentSim = sim;

        if (sim) {
            const bot = sim.helper.botsState[botId];
            if (bot) {
                const { id, tags, space } = bot;
                this.currentBot = stableStringify({ id, tags, space}, { space: 2 })
            } else {
                this.currentBot = null;
            }
        } else {
            this.currentBot = null;
        }
        this._updateConfig();
    }

    
    private _resize(): any {
        if (!this.portalElement || !this.othersElement) {
            return;
        }
        setTimeout(() => {
            const portalRect = this.portalElement.getBoundingClientRect();

            // Calculate whether to fill space not taken or whether to fill behind
            if (
                portalRect.top !== 0 &&
                portalRect.bottom !== window.innerHeight &&
                portalRect.left !== 0 &&
                portalRect.right !== window.innerWidth
            ) {
                // If the portal is not attached to a side of the screen then fill behind
                this.othersElement.style.height = null;
                this.othersElement.style.width = null;
                this.othersElement.style.top = null;
                this.othersElement.style.bottom = null;
                this.othersElement.style.left = null;
                this.othersElement.style.right = null;
                return;
            }

            const portalSize = this._calculateSize(this.portalElement);
            const heightRatio = portalSize.height / window.innerHeight;
            const widthRatio = portalSize.width / window.innerWidth;

            // Calculate whether to fill the rest of the height or width
            if (widthRatio === 0 && heightRatio === 0) {
                this.othersElement.style.height = null;
                this.othersElement.style.width = null;
                this.othersElement.style.left = null;
                this.othersElement.style.right = null;
                this.othersElement.style.top = null;
                this.othersElement.style.bottom = null;
            } else if (widthRatio > heightRatio) {
                this.othersElement.style.height =
                    window.innerHeight - portalSize.height + 'px';
                this.othersElement.style.width = null;

                // Calculate whether to fill above or below
                if (portalRect.top < window.innerHeight - portalRect.bottom) {
                    // The meet portal is on the top so place the others on the bottom
                    this.othersElement.style.top = null;
                    this.othersElement.style.bottom = '0px';
                } else {
                    // the meet portal is on the bottom so place the others on the top
                    this.othersElement.style.top = '0px';
                    this.othersElement.style.bottom = null;
                }
            } else {
                this.othersElement.style.height = null;
                this.othersElement.style.width =
                    window.innerWidth - portalSize.width + 'px';

                // Calculate whether to fill left or right
                if (portalRect.left < window.innerWidth - portalRect.right) {
                    // The meet portal is on the left so place the others on the right
                    this.othersElement.style.left = null;
                    this.othersElement.style.right = '0px';
                } else {
                    // the meet portal is on the right so place the others on the left
                    this.othersElement.style.left = '0px';
                    this.othersElement.style.right = null;
                }
            }

            EventBus.$emit('resize');
        }, 100);
    }

    private _updateConfig() {
        if (!this.currentBot) {
            this.extraStyle = {};
            this._resize();
            return;
        }
        if (this._currentConfig) {
            this.extraStyle = this._currentConfig.style;
            this._resize();
        } else {;
            this.extraStyle =
                calculateMeetPortalAnchorPointOffset('fullscreen');
        }
    }

    private _calculateSize(element: HTMLElement) {
        const width = element.offsetWidth;
        const height = element.offsetHeight;

        return { width, height };
    }
}
