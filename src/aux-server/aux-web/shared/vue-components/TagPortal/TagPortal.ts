import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import {
    Bot,
    hasValue,
    BotTags,
    PrecalculatedBot,
    calculateBotValue,
    calculateStringTagValue,
    TAG_PORTAL,
    calculateMeetPortalAnchorPointOffset,
    DEFAULT_TAG_PORTAL_ANCHOR_POINT,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { SubscriptionLike, Subscription, Observable } from 'rxjs';
import { Simulation } from '@casual-simulation/aux-vm';
import { tap } from 'rxjs/operators';
import {
    BotManager,
    watchPortalConfigBot,
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { TagPortalConfig } from './TagPortalConfig';
import { EventBus } from '../../EventBus';
import TagValueEditor from '../TagValueEditor/TagValueEditor';
import TagValueEditorWrapper from '../TagValueEditorWrapper/TagValueEditorWrapper';

@Component({
    components: {
        'tag-value-editor-wrapper': TagValueEditorWrapper,
        'tag-value-editor': TagValueEditor,
    },
})
export default class TagPortal extends Vue {
    private _sub: Subscription;
    private _simulations: Map<BrowserSimulation, Subscription> = new Map();
    private _portals: Map<BrowserSimulation, string> = new Map();
    private _currentConfig: TagPortalConfig;
    private _currentSim: BrowserSimulation;
    private _currentSub: Subscription;
    private _currentPortal: string;

    showExitButton: boolean = false;
    currentBot: Bot = null;
    currentTag: string = null;
    extraStyle: Object = {};

    get hasPortal(): boolean {
        return hasValue(this.currentBot) && hasValue(this.currentTag);
    }

    /**
     * The HTML element that contains the meet iframe.
     */
    get portalElement(): HTMLElement {
        return <HTMLElement>this.$refs.portalContainer;
    }

    constructor() {
        super();
    }

    created() {
        this._sub = new Subscription();
        this._simulations = new Map();
        this._portals = new Map();
        this.extraStyle = calculateMeetPortalAnchorPointOffset(
            DEFAULT_TAG_PORTAL_ANCHOR_POINT
        );

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap(sim => this._onSimulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap(sim => this._onSimulationRemoved(sim)))
                .subscribe()
        );
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
        if (this._currentSub) {
            this._currentSub.unsubscribe();
            this._currentSub = null;
        }
    }

    exitSheet() {
        if (this._currentSim) {
            this._currentSim.helper.updateBot(this._currentSim.helper.userBot, {
                tags: {
                    [TAG_PORTAL]: null,
                },
            });
        }
    }

    private _onSimulationAdded(sim: BrowserSimulation) {
        let sub = new Subscription();
        this._simulations.set(sim, sub);

        sub.add(
            userBotChanged(sim)
                .pipe(tap(user => this._onUserBotUpdated(sim, user)))
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
        const portal = calculateStringTagValue(null, user, TAG_PORTAL, null);
        if (hasValue(portal)) {
            this._portals.set(sim, portal);
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
            const targetPortal = this._portals.get(this._currentSim);
            if (targetPortal === this._currentPortal) {
                return;
            }
        }

        // Use the first botAndTag
        this._setCurrentSim(null, null);
        for (let [sim, botAndTag] of this._portals) {
            if (this._setCurrentSim(sim, botAndTag)) {
                break;
            }
        }
    }

    private _setCurrentSim(sim: BrowserSimulation, botAndTag: string): boolean {
        if (this._currentConfig) {
            this._currentConfig.unsubscribe();
            this._currentConfig = null;
        }
        if (this._currentSub) {
            this._currentSub.unsubscribe();
            this._currentSub = null;
        }

        if (sim) {
            this._currentConfig = new TagPortalConfig(TAG_PORTAL, sim);
            this._currentConfig.onUpdated
                .pipe(
                    tap(() => {
                        this._updateConfig();
                    })
                )
                .subscribe();
        }
        this._currentSim = sim;
        this._currentPortal = botAndTag;
        if (sim) {
            if (!hasValue(botAndTag)) {
                return false;
            }
            const dotIndex = botAndTag.indexOf('.');
            if (dotIndex < 0) {
                return false;
            }
            const botId = botAndTag.slice(0, dotIndex);
            const tag = botAndTag.slice(dotIndex + 1);
            if (!hasValue(botId) || !hasValue(tag)) {
                return false;
            }
            this.currentBot = sim.helper.botsState[botId];
            this.currentTag = tag;
            this._currentSub = sim.watcher.botChanged(botId).subscribe(bot => {
                this.currentBot = bot;
            });
        } else {
            this.currentBot = null;
            this.currentTag = null;
        }
        this._updateConfig();
        return true;
    }

    private _updateConfig() {
        if (!this.currentBot || !this.currentTag) {
            this.extraStyle = calculateMeetPortalAnchorPointOffset(
                DEFAULT_TAG_PORTAL_ANCHOR_POINT
            );
            this.showExitButton = false;
            return;
        }
        if (this._currentConfig) {
            this.extraStyle = this._currentConfig.style;
            this.showExitButton = this._currentConfig.showExitButton;
        } else {
            this.extraStyle = calculateMeetPortalAnchorPointOffset(
                DEFAULT_TAG_PORTAL_ANCHOR_POINT
            );
            this.showExitButton = false;
        }
    }
}
