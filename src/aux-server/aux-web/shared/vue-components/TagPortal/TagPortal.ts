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
    trimTag,
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

    showButton: boolean = false;
    buttonIcon: string = null;
    buttonHint: string = null;
    currentBot: Bot = null;
    currentTag: string = null;
    extraStyle: Object = {};

    get hasPortal(): boolean {
        return hasValue(this.currentBot) && hasValue(this.currentTag);
    }

    /**
     * The HTML element that contains the tag editor.
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
        this.extraStyle = calculateMeetPortalAnchorPointOffset(
            DEFAULT_TAG_PORTAL_ANCHOR_POINT
        );

        window.addEventListener('resize', e => this._resize());

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

    buttonClick() {
        if (this._currentConfig) {
            this._currentConfig.buttonClick();
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
            if (widthRatio > heightRatio) {
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

    private _calculateSize(element: HTMLElement) {
        const width = element.offsetWidth;
        const height = element.offsetHeight;

        return { width, height };
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

        if (this._currentSim === null && this._portals.size <= 0) {
            return;
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
            this.currentTag = trimTag(tag);
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
            this.showButton = false;
            this.buttonIcon = null;
            this.buttonHint = null;
            this._resize();
            return;
        }
        if (this._currentConfig) {
            this.extraStyle = this._currentConfig.style;
            this.showButton = this._currentConfig.showButton;
            this.buttonIcon = this._currentConfig.buttonIcon;
            this.buttonHint = this._currentConfig.buttonHint;
            this._resize();
        } else {
            this.extraStyle = calculateMeetPortalAnchorPointOffset(
                DEFAULT_TAG_PORTAL_ANCHOR_POINT
            );
            this.showButton = false;
            this.buttonIcon = null;
            this.buttonHint = null;
        }
    }
}
