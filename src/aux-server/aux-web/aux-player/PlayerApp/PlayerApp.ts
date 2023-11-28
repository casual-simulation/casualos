import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide } from 'vue-property-decorator';
import { Tagline, EventBus } from '@casual-simulation/aux-components';
import { appManager } from '../../shared/AppManager';
import ConfirmDialogOptions from '../../shared/ConfirmDialogOptions';
import AlertDialogOptions from '../../shared/AlertDialogOptions';
import { SubscriptionLike, Subscription } from 'rxjs';
import {
    ON_QR_CODE_SCANNER_CLOSED_ACTION_NAME,
    ON_QR_CODE_SCANNED_ACTION_NAME,
    ON_QR_CODE_SCANNER_OPENED_ACTION_NAME,
    calculateBotValue,
    BarcodeFormat,
    ON_BARCODE_SCANNER_OPENED_ACTION_NAME,
    ON_BARCODE_SCANNER_CLOSED_ACTION_NAME,
    ON_BARCODE_SCANNED_ACTION_NAME,
    ON_SERVER_SUBSCRIBED_ACTION_NAME,
    ON_SERVER_STREAMING_ACTION_NAME,
    ON_SERVER_STREAM_LOST_ACTION_NAME,
    ON_SERVER_UNSUBSCRIBED_ACTION_NAME,
    CameraType,
    onServerStreamingArg,
    onServerStreamLostArg,
    onServerSubscribedArg,
    onServerUnsubscribedArg,
    calculateStringListTagValue,
    asyncError,
    asyncResult,
    ON_SERVER_JOINED_ACTION_NAME,
    ON_SERVER_LEAVE_ACTION_NAME,
    SyntheticVoice,
    hasValue,
    Geolocation,
    ON_INST_JOINED_ACTION_NAME,
    ON_INST_LEAVE_ACTION_NAME,
    ON_INST_STREAMING_ACTION_NAME,
    ON_INST_STREAM_LOST_ACTION_NAME,
    ON_AUDIO_SAMPLE,
    ON_BEGIN_AUDIO_RECORDING,
    ON_END_AUDIO_RECORDING,
    action,
} from '@casual-simulation/aux-common';
import SnackbarOptions from '../../shared/SnackbarOptions';
import { copyToClipboard, navigateToUrl } from '../../shared/SharedUtils';
import LoadApp from '../../shared/vue-components/LoadApp/LoadApp';
import { tap } from 'rxjs/operators';
import { findIndex, merge } from 'lodash';
import QRCode from '@chenfengyuan/vue-qrcode';
import QrcodeStream from 'vue-qrcode-reader/src/components/QrcodeStream';
import { Simulation, LoginState } from '@casual-simulation/aux-vm';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { SidebarItem } from '../../shared/vue-components/BaseGameView';
import { ConnectionInfo } from '@casual-simulation/aux-common';
import Console from '../../shared/vue-components/Console/Console';
import { recordMessage } from '../../shared/Console';
import VueBarcode from '../../shared/public/VueBarcode';
import BarcodeScanner from '../../shared/vue-components/BarcodeScanner/BarcodeScanner';
import { sendWebhook } from '../../../shared/WebhookUtils';
import HtmlModal from '../../shared/vue-components/HtmlModal/HtmlModal';
import ClipboardModal from '../../shared/vue-components/ClipboardModal/ClipboardModal';
import UploadServerModal from '../../shared/vue-components/UploadServerModal/UploadServerModal';
import download from 'downloadjs';
import BotChat from '../../shared/vue-components/BotChat/BotChat';
import { SimulationInfo, createSimulationInfo } from '../../shared/RouterUtils';
import BotSheet from '../../shared/vue-components/BotSheet/BotSheet';
import { BotRenderer, getRenderer } from '../../shared/scene/BotRenderer';
import UploadFiles from '../../shared/vue-components/UploadFiles/UploadFiles';
import ShowInputModal from '../../shared/vue-components/ShowInputModal/ShowInputModal';
import ShowConfirmModal from '../../shared/vue-components/ShowConfirmModal/ShowConfirmModal';
import MeetPortal from '../../shared/vue-components/MeetPortal/MeetPortal';
import TagPortal from '../../shared/vue-components/TagPortal/TagPortal';
import CustomPortals from '../../shared/vue-components/CustomPortals/CustomPortals';
import IdePortal from '../../shared/vue-components/IdePortal/IdePortal';
import {
    AudioRecorder,
    AudioRecording,
    createDefaultAudioRecorder,
} from '../../shared/AudioRecorder';
import { MediaRecording, Recorder } from '../../shared/Recorder';
import ImuPortal from '../../shared/vue-components/ImuPortal/ImuPortal';
import HtmlAppContainer from '../../shared/vue-components/HtmlAppContainer/HtmlAppContainer';
import SystemPortal from '../../shared/vue-components/SystemPortal/SystemPortal';
import { loadScript } from '../../shared/SharedUtils';
import RecordsUI from '../../shared/vue-components/RecordsUI/RecordsUI';
import ImageClassifier from '../../shared/vue-components/ImageClassifier/ImageClassifier';
import PhotoCamera from '../../shared/vue-components/PhotoCamera/PhotoCamera';
import BotPortal from '../../shared/vue-components/BotPortal/BotPortal';
import Tooltips from '../../shared/vue-components/Tooltips/Tooltips';
import WakeLock from '../../shared/vue-components/WakeLock/WakeLock';
import AuthUI from '../../shared/vue-components/AuthUI/AuthUI';
import LoginUI from '../../shared/vue-components/LoginUI/LoginUI';

let syntheticVoices = [] as SyntheticVoice[];

if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = (e) => {
        syntheticVoices = window.speechSynthesis.getVoices().map(
            (v) =>
                ({
                    default: v.default,
                    language: v.lang,
                    name: v.name,
                } as SyntheticVoice)
        );
    };
}

declare function sa_event(
    name: string,
    metadata: any,
    callback: Function
): void;
declare function sa_event(name: string, callback: Function): void;

@Component({
    components: {
        'auth-ui': AuthUI,
        'login-ui': LoginUI,
        'load-app': LoadApp,
        'qr-code': QRCode,
        'qrcode-stream': QrcodeStream,
        barcode: VueBarcode,
        'barcode-stream': BarcodeScanner,
        'html-modal': HtmlModal,
        'upload-server-modal': UploadServerModal,
        'clipboard-modal': ClipboardModal,
        'bot-chat': BotChat,
        'bot-sheet': BotSheet,
        'upload-files': UploadFiles,
        'show-input': ShowInputModal,
        'show-confirm': ShowConfirmModal,
        'meet-portal': MeetPortal,
        'tag-portal': TagPortal,
        'custom-portals': CustomPortals,
        'ide-portal': IdePortal,
        console: Console,
        tagline: Tagline,
        'imu-portal': ImuPortal,
        'html-portals': HtmlAppContainer,
        'system-portal': SystemPortal,
        'records-ui': RecordsUI,
        'image-classifier': ImageClassifier,
        'bot-portal': BotPortal,
        'bot-tooltips': Tooltips,
        'wake-lock': WakeLock,
        'photo-camera': PhotoCamera,
    },
})
export default class PlayerApp extends Vue {
    showNavigation: boolean = false;
    showConfirmDialog: boolean = false;
    showAlertDialog: boolean = false;
    updateAvailable: boolean = false;
    showNotAuthorized: boolean = false;
    snackbar: SnackbarOptions = {
        visible: false,
        message: '',
        duration: 2000,
    };

    /**
     * Whether we had previously lost our connection to the server.
     */
    lostConnection: boolean = false;

    /**
     * Whether the user is logged in.
     */
    loggedIn: boolean = false;

    /**
     * Whether to show the QR Code.
     */
    showQRCode: boolean = false;

    /**
     * Whether to show the QR Code Scanner.
     */
    showQRScanner: boolean = false;

    /**
     * Whether to allow switching the camera type.
     */
    allowSwitchingCameraType: boolean = true;

    /**
     * The camera device ID that was selected.
     */
    selectedCameraId: string = null;

    /**
     * The list of supported cameras.
     */
    supportedCameras: { deviceId: string; label: string }[] = [];

    /**
     * The extra sidebar items shown in the app.
     */
    extraItems: SidebarItem[] = [];

    /**
     * The list of simulations that are in the app.
     */
    simulations: SimulationInfo[] = [];

    /**
     * Whether to show the confirm remove simulation dialog.
     */
    showRemoveSimulation: boolean = false;

    /**
     * The simulation to remove.
     */
    simulationToRemove: SimulationInfo = null;

    /**
     * The QR Code to show.
     */
    qrCode: string = '';

    /**
     * The barcode to display.
     */
    barcode: string = '';

    /**
     * The barcode format to use.
     */
    barcodeFormat: BarcodeFormat = 'code128';

    /**
     * Whether to show the barcode.
     */
    showBarcode: boolean = false;

    /**
     * Whether to show the barcode scanner.
     */
    showBarcodeScanner: boolean = false;

    /**
     * The camera type that should be used for the scanner.
     */
    camera: CameraType;

    /**
     * Whether to show the authorize account popup.
     */
    showAuthorize: boolean = false;

    /**
     * Whether to show the "Upload file" indicator when a file is being dropped into the application.
     */
    showUploadIndicator: boolean = false;

    authorized: boolean = false;

    showChatBar: boolean = false;
    chatBarPrefill: string = null;
    chatBarForegroundColor: string = null;
    chatBarBackgroundStyle: any = null;
    chatBarPlaceholder: string = null;
    chatBarPlaceholderColor: string = null;

    showConsole: boolean = false;
    loginInfo: ConnectionInfo = null;
    loginState: LoginState = null;

    streamImu: boolean = false;

    loginUIVisible: boolean = false;
    recordsUIVisible: boolean = false;

    get showCustomApps(): boolean {
        return !this.loginUIVisible && !this.recordsUIVisible;
    }

    confirmDialogOptions: ConfirmDialogOptions = new ConfirmDialogOptions();
    alertDialogOptions: AlertDialogOptions = new AlertDialogOptions();

    @Provide() botRenderer: BotRenderer = getRenderer();

    private _subs: SubscriptionLike[] = [];
    private _simulationSubs: Map<Simulation, SubscriptionLike[]> = new Map();
    private _audioRecorder: AudioRecorder;
    private _recorder: Recorder;
    private _currentAudioRecording: AudioRecording;
    private _recordingSub: Subscription;
    private _currentRecording: MediaRecording;
    private _currentQRMediaStream: MediaStream;
    private _notAuthorizedSimulationId: string;
    showChangeLogin: boolean = false;
    private _isLoggingIn: boolean = false;

    get version() {
        return appManager.version.latestTaggedVersion;
    }

    get versionTooltip() {
        return appManager.version.gitCommit;
    }

    get canSwitchCameras() {
        return (
            this.allowSwitchingCameraType && this.supportedCameras.length > 1
        );
    }

    vmOrigin() {
        return appManager.config?.vmOrigin;
    }

    /**
     * Adds a new sidebar item to the sidebar.
     * @param id
     * @param text
     * @param click
     */
    @Provide()
    addSidebarItem(
        id: string,
        text: string,
        click: () => void,
        icon: string = null,
        group: string = null
    ) {
        const index = findIndex(this.extraItems, (i) => i.id === id);
        if (index >= 0) {
            this.extraItems[index] = {
                id: id,
                group: group,
                text: text,
                icon: icon,
                click: click,
            };
        } else {
            this.extraItems.push({
                id: id,
                group: group,
                text: text,
                icon: icon,
                click: click,
            });
        }
    }

    /**
     * Removes the sidebar item with the given ID.
     * @param id
     */
    @Provide()
    removeSidebarItem(id: string) {
        const index = findIndex(this.extraItems, (i) => i.id === id);
        if (index >= 0) {
            this.extraItems.splice(index, 1);
        }
    }

    /**
     * Removes all the sidebar items with the given group.
     * @param id
     */
    @Provide()
    removeSidebarGroup(group: string) {
        for (let i = this.extraItems.length - 1; i >= 0; i--) {
            const item = this.extraItems[i];
            if (item.group === group) {
                this.extraItems.splice(i, 1);
            }
        }
    }

    url() {
        return location.href;
    }

    forcedOffline(info: SimulationInfo) {
        const simulation = appManager.simulationManager.simulations.get(
            info.id
        );
        return simulation.connection.forcedOffline;
    }

    closeConsole() {
        this.showConsole = false;
    }

    created() {
        this._subs = [];
        this._simulationSubs = new Map();
        this.camera = null;
        this.chatBarBackgroundStyle = null;
        this._audioRecorder = createDefaultAudioRecorder();
        this._recorder = new Recorder();
        this.supportedCameras = [];
        this.showNotAuthorized = false;
        this.showChangeLogin = false;
        this._subs.push(
            appManager.updateAvailableObservable.subscribe(
                (updateAvailable) => {
                    if (updateAvailable) {
                        this.updateAvailable = true;
                        this._showUpdateAvailable();
                    }
                }
            )
        );

        this._subs.push(
            appManager.simulationManager.simulationAdded
                .pipe(tap((sim) => this._simulationAdded(sim)))
                .subscribe(),
            appManager.simulationManager.simulationRemoved
                .pipe(tap((sim) => this._simulationRemoved(sim)))
                .subscribe()
        );

        this._subs.push(
            appManager.whileLoggedIn((sim) => {
                let subs: SubscriptionLike[] = [];

                this.loggedIn = true;

                subs.push(
                    new Subscription(() => {
                        this.loggedIn = false;
                    })
                );

                if (window.sa_pageview) window.sa_pageview(`/${sim.id}`);

                return subs;
            })
        );

        EventBus.$on('showNavigation', this.onShowNavigation);
        EventBus.$on('showConfirmDialog', this.onShowConfirmDialog);
        EventBus.$on('showAlertDialog', this.onShowAlertDialog);

        window.addEventListener('beforeunload', (e) => {
            if (this.simulations.some((sim) => sim.lostConnection)) {
                e.preventDefault();
                e.returnValue =
                    'Are you sure you want to exit? Some changes may be lost.';
            }
        });
    }

    onRecordsUIVisisble() {
        this.recordsUIVisible = false;
    }

    onRecordsUIHidden() {
        this.recordsUIVisible = false;
    }

    onLoginUIVisible() {
        this.loginUIVisible = true;
    }

    onLoginUIHidden() {
        this.loginUIVisible = false;
    }

    copy(text: string) {
        copyToClipboard(text);
        this.snackbar = {
            visible: true,
            message: `Copied '${text}' to the clipboard!`,
        };
    }

    beforeDestroy() {
        this._subs.forEach((s) => s.unsubscribe());
    }

    snackbarClick(action: SnackbarOptions['action']) {
        if (action) {
            switch (action.type) {
                case 'update-service-worker':
                    this._updateServiceWorker();
                    break;
            }
        }
    }

    menuClicked() {
        this.showNavigation = !this.showNavigation;
    }

    private _updateServiceWorker() {
        appManager.updateServiceWorker();
    }

    toggleOnlineOffline(info: SimulationInfo) {
        let options = new ConfirmDialogOptions();
        const simulation = appManager.simulationManager.simulations.get(
            info.id
        );
        if (simulation.connection.forcedOffline) {
            options.title = 'Enable online?';
            options.body = `Allow ${info.displayName} to reconnect to the server?`;
            options.okText = 'Go Online';
            options.cancelText = 'Stay Offline';
        } else {
            options.title = 'Force offline mode?';
            options.body = `Prevent ${info.displayName} from connecting to the server?`;
            options.okText = 'Go Offline';
            options.cancelText = 'Stay Online';
        }
        EventBus.$once(options.okEvent, () => {
            simulation.connection.toggleForceOffline();
            EventBus.$off(options.cancelEvent);
        });
        EventBus.$once(options.cancelEvent, () => {
            EventBus.$off(options.okEvent);
        });
        EventBus.$emit('showConfirmDialog', options);
    }

    async hideQRCodeScanner() {
        this.showQRScanner = false;
    }

    async onQrCodeScannerClosed() {
        this._superAction(ON_QR_CODE_SCANNER_CLOSED_ACTION_NAME);
    }

    async onQRCodeScanned(code: string) {
        this._superAction(ON_QR_CODE_SCANNED_ACTION_NAME, code);
    }

    hideBarcodeScanner() {
        this.showBarcodeScanner = false;
    }

    async onBarcodeScannerClosed() {
        this._superAction(ON_BARCODE_SCANNER_CLOSED_ACTION_NAME);
    }

    onBarcodeScanned(code: string) {
        this._superAction(ON_BARCODE_SCANNED_ACTION_NAME, code);
    }

    async finishAddSimulation(id: string) {
        console.log('[PlayerApp] Add simulation!');
        this._addServerToSimulation(appManager.simulationManager.primary, id);
    }

    private _addServerToSimulation(sim: BrowserSimulation, id: string) {
        const calc = sim.helper.createContext();
        const list = calculateStringListTagValue(
            calc,
            sim.helper.userBot,
            'inst',
            []
        );
        if (list.indexOf(id) < 0) {
            list.push(id);
            sim.helper.updateBot(sim.helper.userBot, {
                tags: {
                    inst: list,
                },
            });
        }
    }

    private _removeServerFromSimulation(sim: BrowserSimulation, id: string) {
        const calc = sim.helper.createContext();
        const list = calculateStringListTagValue(
            calc,
            sim.helper.userBot,
            'inst',
            []
        );
        const index = list.indexOf(id);
        if (index >= 0) {
            list.splice(index, 1);
            sim.helper.updateBot(sim.helper.userBot, {
                tags: {
                    inst: list,
                },
            });
        }
    }

    removeSimulation(info: SimulationInfo) {
        if (appManager.simulationManager.primary.id === info.id) {
            this.snackbar = {
                message: `You cannot remove the primary inst.`,
                visible: true,
            };
        } else {
            this.showRemoveSimulation = true;
            this.simulationToRemove = info;
        }
    }

    finishRemoveSimulation() {
        this.removeSimulationById(this.simulationToRemove.id);
    }

    removeSimulationById(id: string) {
        this._removeServerFromSimulation(
            appManager.simulationManager.primary,
            id
        );
    }

    getQRCode(): string {
        return this.qrCode || this.url();
    }

    getBarcode() {
        return this.barcode || '';
    }

    getBarcodeFormat() {
        return this.barcodeFormat || '';
    }

    onQRStreamAquired(stream: MediaStream) {
        this._currentQRMediaStream = stream;
    }

    changeQRStream() {
        const currentDeviceId = this._currentQRMediaStream
            ? this._getDeviceIdForStream(this._currentQRMediaStream)
            : null;
        const indexOfCurrent = this.supportedCameras.findIndex(
            (c) => c.deviceId === currentDeviceId
        );
        let nextIndex = 0;
        if (indexOfCurrent >= 0) {
            if (indexOfCurrent + 1 >= this.supportedCameras.length) {
                nextIndex = 0;
            } else {
                nextIndex = indexOfCurrent + 1;
            }
        }

        const a = this.supportedCameras[nextIndex];
        this.selectedCameraId = a?.deviceId ?? null;
    }

    private _getDeviceIdForStream(stream: MediaStream) {
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
            const track = videoTracks[0];
            const settings = track.getSettings();
            return settings.deviceId;
        }
        return null;
    }

    private async _updateSupportedCameras() {
        if (navigator && navigator.mediaDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices();
            let supportedCameras = [] as typeof this.supportedCameras;
            for (let device of devices) {
                if (device.kind === 'videoinput') {
                    supportedCameras.push({
                        deviceId: device.deviceId,
                        label: device.label,
                    });
                }
            }
            this.supportedCameras = supportedCameras;
        } else {
            this.supportedCameras = [];
        }
    }

    private _simulationAdded(simulation: BrowserSimulation) {
        const index = this.simulations.findIndex((s) => s.id === simulation.id);
        if (index >= 0) {
            return;
        }

        let subs: SubscriptionLike[] = [];
        let info: SimulationInfo = createSimulationInfo(simulation);

        subs.push(
            simulation.login.loginStateChanged.subscribe(async (state) => {
                this.loginState = state;
                if (!state.authenticated) {
                    console.log(
                        '[PlayerApp] Not authenticated:',
                        state.authenticationError
                    );
                    if (state.authenticationError) {
                        console.log(
                            '[PlayerApp] Redirecting to login to resolve error.'
                        );
                        this.showAuthorize = true;
                    }
                } else {
                    this.showAuthorize = false;
                    console.log('[PlayerApp] Authenticated!', state.info);
                }

                if (state.authorized) {
                    this.authorized = true;
                    console.log('[PlayerApp] Authorized!');
                } else if (state.authorized === false) {
                    console.log('[PlayerApp] Not authorized.', state.error);
                    if (!this._isLoggingIn) {
                        const authenticated =
                            await simulation.auth.primary.isAuthenticated();
                        this.showNotAuthorized = true;
                        this._notAuthorizedSimulationId = simulation.id;
                        this.showChangeLogin = authenticated;
                        this.snackbar = {
                            message:
                                'You are not authorized to view this inst.',
                            visible: true,
                        };
                    }
                }
            }),
            simulation.localEvents.subscribe(async (e) => {
                if (e.type === 'show_toast') {
                    this.snackbar = {
                        message: e.message,
                        visible: true,
                        duration: e.duration,
                    };
                } else if (e.type === 'show_qr_code_scanner') {
                    if (this.showQRScanner !== e.open) {
                        this.camera = e.cameraType;
                        this.showQRScanner = e.open;
                        this.selectedCameraId = null;
                        this.allowSwitchingCameraType =
                            !e.disallowSwitchingCameras;
                        this._currentQRMediaStream = null;
                        this._updateSupportedCameras();
                        if (e.open) {
                            this._superAction(
                                ON_QR_CODE_SCANNER_OPENED_ACTION_NAME
                            );
                        } else {
                            // Don't need to send an event for closing
                            // because onQrCodeScannerClosed() gets triggered
                            // automatically.
                        }
                    }
                } else if (e.type === 'show_barcode_scanner') {
                    if (this.showBarcodeScanner !== e.open) {
                        this.camera = e.cameraType;
                        this.showBarcodeScanner = e.open;
                        if (e.open) {
                            this._superAction(
                                ON_BARCODE_SCANNER_OPENED_ACTION_NAME
                            );
                        } else {
                            // Don't need to send an event for closing
                            // because onBarcodeScannerClosed() gets triggered
                            // automatically.
                        }
                    }
                } else if (e.type === 'load_server') {
                    this.finishAddSimulation(e.id);
                } else if (e.type === 'unload_server') {
                    this.removeSimulationById(e.id);
                } else if (e.type === 'super_shout') {
                    this._superAction(e.eventName, e.argument);
                } else if (e.type === 'show_qr_code') {
                    if (e.open) {
                        this._showQRCode(e.code);
                    } else {
                        this._hideQRCode();
                    }
                } else if (e.type === 'show_barcode') {
                    if (e.open) {
                        this._showBarcode(e.code, e.format);
                    } else {
                        this._hideBarcode();
                    }
                } else if (e.type === 'go_to_dimension') {
                    this.setTitleToID();
                } else if (e.type === 'go_to_url') {
                    navigateToUrl(e.url, null, 'noreferrer');
                } else if (e.type === 'open_url') {
                    navigateToUrl(e.url, '_blank', 'noreferrer');
                } else if (e.type === 'download') {
                    console.log(`[BuilderApp] Downloading ${e.filename}...`);
                    const data =
                        typeof e.data === 'string'
                            ? new Blob([e.data], { type: e.mimeType })
                            : e.data;
                    download(data, e.filename, e.mimeType);
                } else if (e.type === 'open_console') {
                    this.showConsole = e.open;
                } else if (e.type === 'send_webhook') {
                    sendWebhook(simulation, e);
                } else if (e.type === 'show_chat_bar') {
                    this.showChatBar = e.visible;
                    this.chatBarPrefill = e.prefill;
                    this.chatBarPlaceholder = e.placeholder;
                    this.chatBarPlaceholderColor = e.placeholderColor;
                    this.chatBarForegroundColor = e.foregroundColor;
                    this.chatBarBackgroundStyle = {};
                    if (hasValue(e.backgroundColor)) {
                        this.chatBarBackgroundStyle.backgroundColor =
                            e.backgroundColor;
                        if (!hasValue(e.foregroundColor)) {
                            this.chatBarForegroundColor = '#000';
                        }
                    } else if (hasValue(e.foregroundColor)) {
                        this.chatBarBackgroundStyle.backgroundColor = '#fff';
                    }
                    const chatBar = this.$refs.chatBar as BotChat;
                    if (chatBar) {
                        await chatBar.setPrefill(e.prefill);
                    }
                } else if (e.type === 'show_join_code') {
                    const player = simulation.helper.userBot;
                    const calc = simulation.helper.createContext();
                    const server =
                        e.inst || calculateBotValue(calc, player, 'inst');
                    const dimension =
                        e.dimension ||
                        calculateBotValue(calc, player, 'gridPortal');
                    const code = `${location.protocol}//${
                        location.host
                    }?inst=${encodeURIComponent(
                        server
                    )}&gridPortal=${encodeURIComponent(dimension)}`;
                    this._showQRCode(code);
                } else if (e.type === 'request_fullscreen_mode') {
                    if (
                        document.fullscreenElement ||
                        (<any>document).webkitFullscreenElement
                    ) {
                        return;
                    }
                    if (document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen();
                    } else if (
                        (<any>document.documentElement).webkitRequestFullscreen
                    ) {
                        (<any>(
                            document.documentElement
                        )).webkitRequestFullscreen();
                    }
                } else if (e.type === 'exit_fullscreen_mode') {
                    if (
                        !document.fullscreenElement &&
                        !(<any>document).webkitFullscreenElement
                    ) {
                        return;
                    }
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if ((<any>document).webkitExitFullscreen) {
                        (<any>document).webkitExitFullscreen();
                    }
                } else if (e.type === 'share') {
                    const anyNav = navigator as any;
                    if (anyNav.share) {
                        let shareOptions: any = {};
                        if (e.title) {
                            shareOptions.title = e.title;
                        }
                        if (e.url) {
                            shareOptions.url = e.url;
                        }
                        if (e.text) {
                            shareOptions.text = e.text;
                        }
                        if (anyNav.canShare(shareOptions)) {
                            anyNav
                                .share(shareOptions)
                                .then(() => {
                                    simulation.helper.transaction(
                                        asyncResult(e.taskId, null)
                                    );
                                })
                                .catch((error: Error) => {
                                    simulation.helper.transaction(
                                        asyncError(e.taskId, error.toString())
                                    );
                                });
                        } else {
                            simulation.helper.transaction(
                                asyncError(
                                    e.taskId,
                                    'The given share options were invalid.'
                                )
                            );
                        }
                    } else {
                        simulation.helper.transaction(
                            asyncError(
                                e.taskId,
                                "This device doesn't support sharing"
                            )
                        );
                    }
                } else if (e.type === 'begin_audio_recording') {
                    if (this._currentAudioRecording) {
                        simulation.helper.transaction(
                            asyncError(
                                e.taskId,
                                'A recording is already happening.'
                            )
                        );
                    } else {
                        try {
                            this._currentAudioRecording =
                                await this._audioRecorder.start({
                                    preferredMimeType: e.mimeType,
                                    stream: e.stream,
                                    compileFullAudioBuffer: !e.stream,
                                    sampleRate: e.sampleRate,
                                });

                            if (e.stream) {
                                this._recordingSub =
                                    this._currentAudioRecording.dataAvailable.subscribe(
                                        (data) => {
                                            simulation.helper.action(
                                                ON_AUDIO_SAMPLE,
                                                null,
                                                data
                                            );
                                        }
                                    );
                            }

                            simulation.helper.transaction(
                                asyncResult(e.taskId, null),
                                action(
                                    ON_BEGIN_AUDIO_RECORDING,
                                    null,
                                    simulation.helper.userId,
                                    null
                                )
                            );
                        } catch (err) {
                            simulation.helper.transaction(
                                asyncError(e.taskId, err.toString())
                            );
                        }
                    }
                } else if (e.type === 'end_audio_recording') {
                    if (!this._currentAudioRecording) {
                        simulation.helper.transaction(
                            asyncError(e.taskId, 'No recording was started.')
                        );
                    } else {
                        try {
                            const blob =
                                await this._currentAudioRecording.stop();
                            this._currentAudioRecording = null;
                            if (this._recordingSub) {
                                this._recordingSub.unsubscribe();
                                this._recordingSub = null;
                            }
                            simulation.helper.transaction(
                                asyncResult(e.taskId, blob),
                                action(
                                    ON_END_AUDIO_RECORDING,
                                    null,
                                    simulation.helper.userId,
                                    blob
                                )
                            );
                        } catch (err) {
                            simulation.helper.transaction(
                                asyncError(e.taskId, err.toString())
                            );
                        }
                    }
                } else if (e.type === 'begin_recording') {
                    if (this._currentRecording) {
                        simulation.helper.transaction(
                            asyncError(
                                e.taskId,
                                'A recording is already happening.'
                            )
                        );
                    } else {
                        try {
                            this._currentRecording = await this._recorder.start(
                                e
                            );
                            simulation.helper.transaction(
                                asyncResult(e.taskId, null)
                            );
                        } catch (err) {
                            simulation.helper.transaction(
                                asyncError(e.taskId, err.toString())
                            );
                        }
                    }
                } else if (e.type === 'end_recording') {
                    if (!this._currentRecording) {
                        simulation.helper.transaction(
                            asyncError(e.taskId, 'No recording was started.')
                        );
                    } else {
                        try {
                            const recording =
                                await this._currentRecording.stop();
                            this._currentRecording = null;
                            simulation.helper.transaction(
                                asyncResult(e.taskId, recording, false)
                            );
                        } catch (err) {
                            simulation.helper.transaction(
                                asyncError(e.taskId, err.toString())
                            );
                        }
                    }
                } else if (e.type === 'get_voices') {
                    try {
                        const voices =
                            syntheticVoices.length > 0
                                ? syntheticVoices
                                : window.speechSynthesis.getVoices().map(
                                      (v) =>
                                          ({
                                              default: v.default,
                                              language: v.lang,
                                              name: v.name,
                                          } as SyntheticVoice)
                                  );

                        simulation.helper.transaction(
                            asyncResult(e.taskId, voices, false)
                        );
                    } catch (ex) {
                        simulation.helper.transaction(
                            asyncError(e.taskId, ex.toString())
                        );
                    }
                } else if (e.type === 'speak_text') {
                    try {
                        const u = new SpeechSynthesisUtterance(e.text);

                        if (e.voice) {
                            const voice = window.speechSynthesis
                                .getVoices()
                                .find((v) => v.name === e.voice);

                            if (voice) {
                                u.voice = voice;
                            }
                        }

                        if (hasValue(e.rate)) {
                            u.rate = e.rate;
                        }

                        if (hasValue(e.pitch)) {
                            u.pitch = e.pitch;
                        }

                        u.onerror = (event) => {
                            simulation.helper.transaction(
                                asyncError(e.taskId, event.error)
                            );
                        };

                        u.onend = (event) => {
                            simulation.helper.transaction(
                                asyncResult(e.taskId, null)
                            );
                        };

                        window.speechSynthesis.speak(u);
                    } catch (ex) {
                        simulation.helper.transaction(
                            asyncError(e.taskId, ex.toString())
                        );
                    }
                } else if (e.type === 'get_geolocation') {
                    try {
                        const promise = new Promise<
                            GeolocationPosition | GeolocationPositionError
                        >((resolve, reject) => {
                            try {
                                navigator.geolocation.getCurrentPosition(
                                    (pos) => {
                                        resolve(pos);
                                    },
                                    (err) => {
                                        resolve(err);
                                    }
                                );
                            } catch (ex) {
                                reject(ex);
                            }
                        });

                        const result = await promise;

                        const value: Geolocation =
                            'code' in result
                                ? {
                                      success: false,
                                      errorCode:
                                          result.code ===
                                          GeolocationPositionError.PERMISSION_DENIED
                                              ? 'permission_denied'
                                              : result.code ===
                                                GeolocationPositionError.POSITION_UNAVAILABLE
                                              ? 'position_unavailable'
                                              : result.code ===
                                                GeolocationPositionError.TIMEOUT
                                              ? 'timeout'
                                              : 'unknown',
                                      errorMessage: result.message,
                                  }
                                : {
                                      success: true,
                                      timestamp: result.timestamp,
                                      heading: isNaN(result.coords.heading)
                                          ? null
                                          : result.coords.heading,
                                      speed: result.coords.speed,
                                      altitude: result.coords.altitude,
                                      altitudeAccuracy:
                                          result.coords.altitudeAccuracy,
                                      latitude: result.coords.latitude,
                                      longitude: result.coords.longitude,
                                      positionalAccuracy:
                                          result.coords.accuracy,
                                  };

                        simulation.helper.transaction(
                            asyncResult(e.taskId, value, false)
                        );
                    } catch (ex) {
                        simulation.helper.transaction(
                            asyncError(e.taskId, ex.toString())
                        );
                    }
                } else if (e.type === 'request_auth_data') {
                    try {
                        const id = e.requestInBackground
                            ? await simulation.auth.primary.authenticateInBackground()
                            : await simulation.auth.primary.authenticate();

                        simulation.helper.transaction(
                            asyncResult(e.taskId, id, false)
                        );
                    } catch (ex) {
                        simulation.helper.transaction(
                            asyncError(e.taskId, ex.toString())
                        );
                    }
                } else if (e.type === 'enable_pov') {
                    this.streamImu = e.enabled && e.imu;
                } else if (e.type === 'convert_geolocation_to_w3w') {
                    try {
                        if (hasValue(appManager.config.what3WordsApiKey)) {
                            await loadScript(
                                `https://assets.what3words.com/sdk/v3/what3words.js?key=${appManager.config.what3WordsApiKey}`
                            ).catch((err) => {
                                if (!err) {
                                    throw new Error(
                                        'Unable to load what3words API.'
                                    );
                                }
                                throw err;
                            });

                            const response = await what3words.api.convertTo3wa(
                                {
                                    lat: e.latitude,
                                    lng: e.longitude,
                                },
                                e.language ?? 'en'
                            );

                            if (hasValue(e.taskId)) {
                                simulation.helper.transaction(
                                    asyncResult(e.taskId, response.words)
                                );
                            }
                        } else {
                            throw new Error(
                                'what3words integration is not supported. No API Key configured.'
                            );
                        }
                    } catch (ex) {
                        if (hasValue(e.taskId)) {
                            simulation.helper.transaction(
                                asyncError(e.taskId, ex?.toString())
                            );
                        }
                    }
                } else if (e.type === 'analytics_record_event') {
                    try {
                        if (typeof sa_event === 'function') {
                            const callback = () => {
                                if (hasValue(e.taskId)) {
                                    simulation.helper.transaction(
                                        asyncResult(e.taskId, null)
                                    );
                                }
                            };
                            if (hasValue(e.metadata)) {
                                sa_event(e.name, e.metadata, callback);
                            } else {
                                sa_event(e.name, callback);
                            }
                        } else {
                            throw new Error(
                                'Analytics are not supported on this inst.'
                            );
                        }
                    } catch (ex) {
                        if (hasValue(e.taskId)) {
                            simulation.helper.transaction(
                                asyncError(e.taskId, ex?.toString())
                            );
                        }
                    }
                }
            }),
            simulation.connection.connectionStateChanged.subscribe(
                (connected) => {
                    if (!connected) {
                        info.online = false;
                        info.synced = false;
                        if (info.subscribed) {
                            this._showConnectionLost(info);
                            info.lostConnection = true;
                        }
                    } else {
                        info.online = true;
                        if (info.lostConnection) {
                            this._showConnectionRegained(info);
                        }
                        info.lostConnection = false;
                        info.synced = true;
                        if (
                            info.id == appManager.simulationManager.primary.id
                        ) {
                            appManager.checkForUpdates();
                        }
                    }
                }
            ),
            simulation.connection.syncStateChanged.subscribe(
                async (connected) => {
                    if (!connected) {
                        info.synced = false;
                        if (info.subscribed) {
                            info.lostConnection = true;
                            await this._superAction(
                                ON_INST_STREAM_LOST_ACTION_NAME,
                                onServerStreamLostArg(simulation.inst)
                            );
                            await this._superAction(
                                ON_SERVER_STREAM_LOST_ACTION_NAME,
                                onServerStreamLostArg(simulation.inst)
                            );
                        }
                    } else {
                        info.synced = true;

                        if (!info.subscribed) {
                            info.subscribed = true;
                            await this._superAction(
                                ON_INST_JOINED_ACTION_NAME,
                                onServerSubscribedArg(simulation.inst)
                            );
                            await this._superAction(
                                ON_SERVER_JOINED_ACTION_NAME,
                                onServerSubscribedArg(simulation.inst)
                            );
                            await this._superAction(
                                ON_SERVER_SUBSCRIBED_ACTION_NAME,
                                onServerSubscribedArg(simulation.inst)
                            );

                            // Send onInstJoined events for already loaded insts
                            for (let info of this.simulations) {
                                if (
                                    info.id === simulation.id ||
                                    !info.subscribed
                                ) {
                                    continue;
                                }
                                await simulation.helper.action(
                                    ON_INST_JOINED_ACTION_NAME,
                                    null,
                                    onServerSubscribedArg(info.inst)
                                );
                                await simulation.helper.action(
                                    ON_SERVER_JOINED_ACTION_NAME,
                                    null,
                                    onServerSubscribedArg(info.inst)
                                );
                                await simulation.helper.action(
                                    ON_SERVER_SUBSCRIBED_ACTION_NAME,
                                    null,
                                    onServerSubscribedArg(info.inst)
                                );
                            }

                            // console.log(
                            //     '[PlayerApp] Authenticating user in background...'
                            // );
                            // simulation.auth.primary
                            //     .authenticateInBackground()
                            //     .then((data) => {
                            //         if (data) {
                            //             console.log(
                            //                 '[PlayerApp] Authenticated user in background.'
                            //             );
                            //         } else {
                            //             console.log(
                            //                 '[PlayerApp] Failed to authenticate user in background.'
                            //             );
                            //         }
                            //     })
                            //     .catch((err) => {
                            //         console.error(err);
                            //     });
                        }

                        await this._superAction(
                            ON_INST_STREAMING_ACTION_NAME,
                            onServerStreamingArg(simulation.inst)
                        );
                        await this._superAction(
                            ON_SERVER_STREAMING_ACTION_NAME,
                            onServerStreamingArg(simulation.inst)
                        );
                    }
                }
            ),
            simulation.login.deviceChanged.subscribe((info) => {
                this.loginInfo = info || this.loginInfo;
            }),
            simulation.consoleMessages.subscribe((m) => {
                recordMessage(m);
            }),
            simulation.livekit.onTrackNeedsAttachment.subscribe((track) => {
                const element = track.attach();
                (this.$refs.livekitTracks as HTMLElement).appendChild(element);
            }),
            simulation.livekit.onTrackNeedsDetachment.subscribe((track) => {
                const elements = track.detach();
                for (let el of elements) {
                    el.remove();
                }
            }),
            new Subscription(async () => {
                await this._superAction(
                    ON_INST_LEAVE_ACTION_NAME,
                    onServerUnsubscribedArg(simulation.inst)
                );
                await this._superAction(
                    ON_SERVER_LEAVE_ACTION_NAME,
                    onServerUnsubscribedArg(simulation.inst)
                );
                await this._superAction(
                    ON_SERVER_UNSUBSCRIBED_ACTION_NAME,
                    onServerUnsubscribedArg(simulation.inst)
                );
            })
        );

        this._simulationSubs.set(simulation, subs);
        this.simulations.push(info);

        this.setTitleToID();
    }

    async logout() {
        if (this._notAuthorizedSimulationId) {
            const simulation = appManager.simulationManager.simulations.get(
                this._notAuthorizedSimulationId
            );

            if (simulation) {
                this.showNotAuthorized = false;
                await simulation.auth.primary.logout();
                const data = await simulation.auth.primary.authenticate();
                if (data) {
                    location.reload();
                }
            }
        }
    }

    async login() {
        if (this._notAuthorizedSimulationId) {
            const simulation = appManager.simulationManager.simulations.get(
                this._notAuthorizedSimulationId
            );
            if (simulation) {
                this._isLoggingIn = true;
                this.showNotAuthorized = false;
                const data = await simulation.auth.primary.authenticate();
                if (data) {
                    location.reload();
                }
                this._isLoggingIn = false;
            }
        }
    }

    async newInst() {
        location.href = location.origin;
    }

    private _showQRCode(code: string) {
        this.qrCode = code;
        this.showQRCode = true;
        this._hideBarcode();
    }

    private _hideQRCode() {
        this.qrCode = null;
        this.showQRCode = false;
    }

    private _showBarcode(code: string, format: BarcodeFormat) {
        this.barcode = code;
        this.barcodeFormat = format;
        this.showBarcode = true;
        this._hideQRCode();
    }

    private _hideBarcode() {
        this.barcode = null;
        this.showBarcode = false;
    }

    setTitleToID() {
        const id: string = appManager.simulationManager.primaryId || '...';
        document.title = id;
    }

    private _simulationRemoved(simulation: Simulation) {
        const subs = this._simulationSubs.get(simulation);

        if (subs) {
            subs.forEach((s) => {
                s.unsubscribe();
            });
        }

        this._simulationSubs.delete(simulation);

        const index = this.simulations.findIndex((s) => s.id === simulation.id);
        if (index >= 0) {
            this.simulations.splice(index, 1);
        }
    }

    /**
     * Sends the given event and argument to every loaded simulation.
     * @param eventName The event to send.
     * @param arg The argument to send.
     */
    private async _superAction(eventName: string, arg?: any) {
        for (let [, sim] of appManager.simulationManager.simulations) {
            await sim.helper.action(eventName, null, arg);
        }
    }

    private _showConnectionLost(info: SimulationInfo) {
        this.snackbar = {
            visible: true,
            message: `Connection to ${info.displayName} lost. You are now working offline.`,
        };
    }

    private _showUpdateAvailable() {
        this.snackbar = {
            visible: true,
            message: 'A new version is available!',
            duration: 10000,
            action: {
                type: 'update-service-worker',
                label: 'Refresh',
            },
        };
    }

    private _showConnectionRegained(info: SimulationInfo) {
        this.snackbar = {
            visible: true,
            message: `Connection to ${info.displayName} regained. You are connected to the inst.`,
        };
    }

    private onShowNavigation(show: boolean) {
        if (show == undefined) {
            console.error(
                '[PlayerApp] Missing expected boolean argument for showNavigation event.'
            );
            return;
        }

        console.log('[PlayerApp] handleShowNavigation: ' + show);
        this.showNavigation = show;
    }

    private onShowConfirmDialog(options: ConfirmDialogOptions) {
        if (options == undefined) {
            console.error(
                '[PlayerApp] Missing expected ConfirmDialogOptions argument for showConfirmDialog event.'
            );
            return;
        }

        this.confirmDialogOptions = options;
        this.showConfirmDialog = true;
        console.log(
            '[PlayerApp] handleShowConfirmDialog ' +
                this.showConfirmDialog +
                ' ' +
                JSON.stringify(this.confirmDialogOptions)
        );
    }

    onDialogConfirm() {
        if (this.confirmDialogOptions) {
            EventBus.$emit(this.confirmDialogOptions.okEvent);
        }
    }

    onDialogCancel() {
        if (this.confirmDialogOptions) {
            EventBus.$emit(this.confirmDialogOptions.cancelEvent);
        }
    }

    private onShowAlertDialog(options: AlertDialogOptions) {
        if (options == undefined) {
            console.error(
                '[PlayerApp] Missing expected AlertDialogOptions argument for showAlertDialog event.'
            );
            return;
        }

        this.alertDialogOptions = options;
        this.showAlertDialog = true;
        console.log(
            '[PlayerApp] handleShowAlertDialog ' +
                this.showAlertDialog +
                ' ' +
                JSON.stringify(this.alertDialogOptions)
        );
    }
}

if (typeof window !== 'undefined') {
    merge(window, {
        aux: {
            toggleOffline: () => {
                for (let [id, sim] of appManager.simulationManager
                    .simulations) {
                    sim.connection.toggleForceOffline();
                }
            },
        },
    });
}
