import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Prop, Inject, Watch } from 'vue-property-decorator';
import {
    Bot,
    hasValue,
    BotTags,
    MEET_PORTAL,
    PrecalculatedBot,
    calculateBotValue,
    calculateStringTagValue,
    calculateMeetPortalAnchorPointOffset,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { SubscriptionLike, Subscription, Observable } from 'rxjs';
import JitsiMeet from '../JitsiMeet/JitsiMeet';
import { Simulation } from '@casual-simulation/aux-vm';
import { tap } from 'rxjs/operators';
import {
    BotManager,
    watchPortalConfigBot,
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { MeetPortalConfig } from './MeetPortalConfig';

@Component({
    components: {
        'jitsi-meet': JitsiMeet,
    },
})
export default class MeetPortal extends Vue {
    private _sub: Subscription;
    private _simulations: Map<BrowserSimulation, Subscription> = new Map();
    private _portals: Map<BrowserSimulation, string> = new Map();
    private _currentConfig: MeetPortalConfig;
    private _currentSim: BrowserSimulation;

    currentMeet: string = null;
    extraStyle: Object = {};
    portalVisible: boolean = true;

    get hasPortal(): boolean {
        return hasValue(this.currentMeet);
    }

    // The override options for the config
    // that the Jitsi Iframe should use.
    // See https://github.com/jitsi/jitsi-meet/blob/master/config.js for options
    get config() {
        return {
            // Start with the video feed muted
            // Unlike startAudioOnly, this will let people unmute their
            // video feed to show it.
            startWithVideoMuted: true,
        };
    }

    // The override options for the interface config
    // that the Jitsi Iframe should use.
    // See https://github.com/jitsi/jitsi-meet/blob/master/interface_config.js for options
    // Note that not all options will work due to the settings whitelist (https://github.com/jitsi/jitsi-meet/blob/master/react/features/base/config/interfaceConfigWhitelist.js).
    // Also note that meet.jit.si uses a custom whitelist that prevents disabling the watermarks and branding.
    // The settings below are specified for the future if/when we get our own Jitsi deployment.
    get interfaceConfig() {
        return {
            // Disable the mobile app promo screen
            MOBILE_APP_PROMO: false,

            // Don't show the chrome extension promo
            SHOW_CHROME_EXTENSION_BANNER: false,

            // Don't show the watermark
            filStripOnly: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_POWERED_BY: false,
        };
    }

    constructor() {
        super();
    }

    created() {
        this._sub = new Subscription();
        this._simulations = new Map();
        this._portals = new Map();
        this.extraStyle = calculateMeetPortalAnchorPointOffset('fullscreen');
        this.portalVisible = true;

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
    }

    onClose() {
        if (this._currentSim) {
            this._currentSim.helper.updateBot(this._currentSim.helper.userBot, {
                tags: {
                    [MEET_PORTAL]: null,
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
        sub.add(
            watchPortalConfigBot(sim, MEET_PORTAL)
                .pipe(
                    tap(bot => {
                        // TODO: Update options
                    })
                )
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
        const portal = calculateStringTagValue(null, user, MEET_PORTAL, null);
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
            return;
        }

        // Use the first meet
        this._setCurrentSim(null, null);
        for (let [sim, meet] of this._portals) {
            this._setCurrentSim(sim, meet);
            break;
        }
    }

    private _setCurrentSim(sim: BrowserSimulation, meet: string) {
        if (this._currentConfig) {
            this._currentConfig.unsubscribe();
            this._currentConfig = null;
        }

        if (sim) {
            this._currentConfig = new MeetPortalConfig(MEET_PORTAL, sim);
            this._currentConfig.onUpdated
                .pipe(
                    tap(() => {
                        this._updateConfig();
                    })
                )
                .subscribe();
        }
        this._currentSim = sim;
        this.currentMeet = meet;
        this._updateConfig();
    }

    private _updateConfig() {
        if (this._currentConfig) {
            this.portalVisible = this._currentConfig.visible;
            this.extraStyle = this._currentConfig.style;
        } else {
            this.portalVisible = true;
            this.extraStyle = calculateMeetPortalAnchorPointOffset(
                'fullscreen'
            );
        }
    }
}
