import Vue from 'vue';
import Component from 'vue-class-component';
import {
    hasValue,
    MEET_PORTAL,
    PrecalculatedBot,
    calculateStringTagValue,
    calculateMeetPortalAnchorPointOffset,
    ON_MEET_LEAVE,
    ON_MEET_LOADED,
    asyncError,
    MeetFunctionAction,
    asyncResult,
    action,
    ON_MEET_ENTERED,
    ON_MEET_EXITED,
    MeetCommandAction,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import JitsiMeet from '../JitsiMeet/JitsiMeet';
import { tap } from 'rxjs/operators';
import {
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { MeetPortalConfig } from './MeetPortalConfig';
import { EventBus } from '@casual-simulation/aux-components';
import { JitsiVideoConferenceJoinedEvent, JitsiVideoConferenceLeftEvent } from '../JitsiMeet/JitsiTypes';

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
    meetJwt: string = null;

    get hasPortal(): boolean {
        return hasValue(this.currentMeet);
    }

    get jitsiOptions() {
        return {
            roomName:
                this.currentMeet.indexOf('/') >= 0
                    ? this.currentMeet
                    : `${appManager.config.jitsiAppName}/${this.currentMeet}`,
            interfaceConfigOverwrite: this.interfaceConfig,
            configOverwrite: this.config,
            jwt: this.meetJwt,
            onload: () => {
                if (this._currentSim) {
                    this._currentSim.helper.action(ON_MEET_LOADED, null, {
                        roomName: this.currentMeet,
                    });
                }
            },
        };
    }

    // The override options for the config
    // that the Jitsi Iframe should use.
    // See https://github.com/jitsi/jitsi-meet/blob/master/config.js for options
    get config() {
        return {
            // Start with the video feed muted
            // Unlike startAudioOnly, this will let people unmute their
            // video feed to show it.
            startWithVideoMuted: this._currentConfig.startWithVideoMuted,
            startWithAudioMuted: this._currentConfig.startWithAudioMuted,
            requireDisplayName: this._currentConfig.requireDisplayName,
            prejoinConfig: {
                enabled: this._currentConfig.prejoinEnabled,
            },
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

            // Disable some settings sections
            SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile'],
            TOOLBAR_BUTTONS: [
                'microphone',
                'camera',
                'hangup',
                'closedcaptions',
                'desktop',
                'chat',
                'recording',
                'livestreaming',
                'sharedvideo',
                'settings',
                'filmstrip',
                'feedback',
                'tileview',
                'videobackgroundblur',
                'download',
                'help',
                'mute-everyone',
                'security',
                'participants-pane'
            ],

            // Hide the "invite more people" header since we want them to share the CausalOS link.
            HIDE_INVITE_MORE_HEADER: true,
        };
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
        this.portalVisible = true;

        window.addEventListener('resize', (e) => this._resize());

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

    onClose() {
        if (this._currentSim) {
            this._currentSim.helper.updateBot(this._currentSim.helper.userBot, {
                tags: {
                    [MEET_PORTAL]: null,
                },
            });
        }
    }

    onMeetJoined(e: JitsiVideoConferenceJoinedEvent) {
        if (this._currentSim) {
            this._currentSim.helper.action(ON_MEET_ENTERED, null, {
                roomName: e.roomName,
                participantId: e.id,
                isBreakoutRoom: e.breakoutRoom,
            });
        }
    }

    onMeetLeft(e: JitsiVideoConferenceLeftEvent) {
        if (this._currentSim) {
            this._currentSim.helper.action(ON_MEET_EXITED, null, {
                roomName: e.roomName,
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
                .pipe(tap((user) => this._onUserBotUpdated(sim, user)))
                .subscribe()
        );

        sub.add(
            sim.localEvents.subscribe((e) => {
                if (e.type === 'meet_command') {
                    this._executeCommand(sim, e);
                } else if(e.type === 'meet_function') {
                    this._executeFunction(sim, e);
                }
            })
        );
    }

    private async _executeCommand(sim: BrowserSimulation, event: MeetCommandAction) {
        const jitsi = this._jitsiMeet()?.api();
        if (jitsi) {
            try {
                jitsi.executeCommand(event.command, ...event.args);
                if (hasValue(event.taskId)) {
                    sim.helper.transaction(asyncResult(event.taskId, null));
                }
            } catch(e) {
                if (hasValue(event.taskId)) {
                    sim.helper.transaction(asyncError(event.taskId, e.toString()));
                } else {
                    console.error(e);
                }
            }
        }
    }

    private async _executeFunction(sim: BrowserSimulation, event: MeetFunctionAction) {
        const jitsi = this._jitsiMeet()?.api();
        if (jitsi) {
            const jitsiPrototype = Object.getPrototypeOf(jitsi);
            const prop = (jitsi as any)[event.functionName];
            if (jitsiPrototype.hasOwnProperty(event.functionName) && typeof prop === 'function') {
                try {
                    const result = await prop.call(jitsi, ...event.args);
                    if (hasValue(event.taskId)) {
                        sim.helper.transaction(asyncResult(event.taskId, result, false));
                    }
                } catch (err) {
                    if (hasValue(event.taskId)) {
                        sim.helper.transaction(asyncError(event.taskId, err.toString()));
                    }
                }
            } else if (hasValue(event.taskId)) {
                sim.helper.transaction(asyncError(event.taskId, 'The given function name does not reference a Jitsi function.'));
            }
        } else if (hasValue(event.taskId)) {
            sim.helper.transaction(asyncError(event.taskId, 'The meet portal is not open.'));
        }
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
        const meet = calculateStringTagValue(null, user, MEET_PORTAL, null);
        const lastMeet = this.currentMeet;
        if (hasValue(meet)) {
            this._portals.set(sim, meet);
        } else {
            this._portals.delete(sim);
        }
        this._updateCurrentPortal();

        if (hasValue(lastMeet) && lastMeet !== this.currentMeet) {
            sim.helper.action(ON_MEET_LEAVE, null, {
                roomName: lastMeet,
            });
        }
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

    private _setCurrentSim(sim: BrowserSimulation, meet: string) {
        if (this._currentSim !== sim) {
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
        }
        this._currentSim = sim;
        this.currentMeet = meet;
        this._updateConfig();
    }

    private _updateConfig() {
        if (!this.currentMeet) {
            this.extraStyle = {};
            this.portalVisible = true;
            this._resize();
            return;
        }
        if (this._currentConfig) {
            this.portalVisible = this._currentConfig.visible;
            this.extraStyle = this._currentConfig.style;
            this.meetJwt = this._currentConfig.meetJwt;
            this._resize();
        } else {
            this.portalVisible = true;
            this.extraStyle =
                calculateMeetPortalAnchorPointOffset('fullscreen');
            this.meetJwt = null;
        }
    }

    private _jitsiMeet(): JitsiMeet {
        return this.$refs.jitsiMeet as JitsiMeet;
    }
}
