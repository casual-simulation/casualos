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
} from '@casual-simulation/aux-common';
import SnackbarOptions from '../../shared/SnackbarOptions';
import { copyToClipboard, navigateToUrl } from '../../shared/SharedUtils';
import LoadApp from '../../shared/vue-components/LoadApp/LoadApp';
import { tap } from 'rxjs/operators';
import { findIndex, merge } from 'lodash';
import QRCode from '@chenfengyuan/vue-qrcode';
import QrcodeStream from 'vue-qrcode-reader/src/components/QrcodeStream';
import { Simulation, AuxUser, LoginState } from '@casual-simulation/aux-vm';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { SidebarItem } from '../../shared/vue-components/BaseGameView';
import { DeviceInfo, ADMIN_ROLE } from '@casual-simulation/causal-trees';
import Console from '../../shared/vue-components/Console/Console';
import { recordMessage } from '../../shared/Console';
import VueBarcode from '../../shared/public/VueBarcode';
import BarcodeScanner from '../../shared/vue-components/BarcodeScanner/BarcodeScanner';
import Checkout from '../Checkout/Checkout';
import LoginPopup from '../../shared/vue-components/LoginPopup/LoginPopup';
import AuthorizePopup from '../../shared/vue-components/AuthorizeAccountPopup/AuthorizeAccountPopup';
import { sendWebhook } from '../../../shared/WebhookUtils';
import HtmlModal from '../../shared/vue-components/HtmlModal/HtmlModal';
import ClipboardModal from '../../shared/vue-components/ClipboardModal/ClipboardModal';
import UploadServerModal from '../../shared/vue-components/UploadServerModal/UploadServerModal';
import { loginToSim, generateGuestId } from '../../shared/LoginUtils';
import download from 'downloadjs';
import BotChat from '../../shared/vue-components/BotChat/BotChat';
import { SimulationInfo, createSimulationInfo } from '../../shared/RouterUtils';
import BotSheet from '../../shared/vue-components/BotSheet/BotSheet';
import { BotRenderer, getRenderer } from '../../shared/scene/BotRenderer';
import UploadFiles from '../../shared/vue-components/UploadFiles/UploadFiles';
import ShowInputModal from '../../shared/vue-components/ShowInputModal/ShowInputModal';
import MeetPortal from '../../shared/vue-components/MeetPortal/MeetPortal';
import TagPortal from '../../shared/vue-components/TagPortal/TagPortal';
import CustomPortals from '../../shared/vue-components/CustomPortals/CustomPortals';
import IdePortal from '../../shared/vue-components/IdePortal/IdePortal';
import { AudioRecorder, AudioRecording } from '../../shared/AudioRecorder';
import { MediaRecording, Recorder } from '../../shared/Recorder';
import ImuPortal from '../../shared/vue-components/ImuPortal/ImuPortal';
import HtmlAppContainer from '../../shared/vue-components/HtmlAppContainer/HtmlAppContainer';
import SystemPortal from '../../shared/vue-components/SystemPortal/SystemPortal';

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

@Component({
    components: {
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
        'meet-portal': MeetPortal,
        'tag-portal': TagPortal,
        'custom-portals': CustomPortals,
        'ide-portal': IdePortal,
        console: Console,
        tagline: Tagline,
        checkout: Checkout,
        login: LoginPopup,
        authorize: AuthorizePopup,
        'imu-portal': ImuPortal,
        'html-portals': HtmlAppContainer,
        'system-portal': SystemPortal,
    },
})
export default class PlayerApp extends Vue {
    showNavigation: boolean = false;
    showConfirmDialog: boolean = false;
    showAlertDialog: boolean = false;
    updateAvailable: boolean = false;
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
    loginInfo: DeviceInfo = null;
    loginState: LoginState = null;

    streamImu: boolean = false;

    confirmDialogOptions: ConfirmDialogOptions = new ConfirmDialogOptions();
    alertDialogOptions: AlertDialogOptions = new AlertDialogOptions();

    @Provide() botRenderer: BotRenderer = getRenderer();

    private _subs: SubscriptionLike[] = [];
    private _simulationSubs: Map<Simulation, SubscriptionLike[]> = new Map();
    private _audioRecorder: AudioRecorder;
    private _recorder: Recorder;
    private _currentAudioRecording: AudioRecording;
    private _currentRecording: MediaRecording;

    get version() {
        return appManager.version.latestTaggedVersion;
    }

    get versionTooltip() {
        return appManager.version.gitCommit;
    }

    get isAdmin() {
        return this.loginInfo && this.loginInfo.roles.indexOf(ADMIN_ROLE) >= 0;
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
        this._audioRecorder = new AudioRecorder();
        this._recorder = new Recorder();
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
            appManager.whileLoggedIn(() => {
                let subs: SubscriptionLike[] = [];

                this.loggedIn = true;

                subs.push(
                    new Subscription(() => {
                        this.loggedIn = false;
                    })
                );

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

    async logout() {
        await loginToSim(
            appManager.simulationManager.primary,
            generateGuestId()
        );
    }

    snackbarClick(action: SnackbarOptions['action']) {
        if (action) {
            switch (action.type) {
                case 'refresh':
                    this.refreshPage();
                    break;
            }
        }
    }

    getUser(): AuxUser {
        return appManager.user;
    }

    menuClicked() {
        this.showNavigation = !this.showNavigation;
    }

    refreshPage() {
        window.location.reload();
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

    getLoginCode(): string {
        return appManager.user ? appManager.user.token : '';
    }

    getBarcode() {
        return this.barcode || '';
    }

    getBarcodeFormat() {
        return this.barcodeFormat || '';
    }

    private _simulationAdded(simulation: BrowserSimulation) {
        const index = this.simulations.findIndex((s) => s.id === simulation.id);
        if (index >= 0) {
            return;
        }

        let subs: SubscriptionLike[] = [];
        let info: SimulationInfo = createSimulationInfo(simulation);

        subs.push(
            simulation.login.loginStateChanged.subscribe((state) => {
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
                    console.log('[PlayerApp] Not authorized.');
                    if (state.authorizationError === 'channel_doesnt_exist') {
                        this.snackbar = {
                            message: 'This inst does not exist.',
                            visible: true,
                        };
                    } else {
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
                    this.updateTitleContext(e.dimension);
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
                    this.chatBarBackgroundStyle = {
                        backgroundColor: e.backgroundColor || '#fff',
                    };
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
                                await this._audioRecorder.start();
                            simulation.helper.transaction(
                                asyncResult(e.taskId, null)
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
                            simulation.helper.transaction(
                                asyncResult(e.taskId, blob)
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
                        const id = await simulation.auth.authenticate();

                        simulation.helper.transaction(
                            asyncResult(e.taskId, id, false)
                        );
                    } catch (ex) {
                        simulation.helper.transaction(
                            asyncError(e.taskId, ex.toString())
                        );
                    }
                } else if (e.type === 'request_permanent_auth_token') {
                    try {
                        const data =
                            await simulation.auth.getPermanentAuthToken();

                        simulation.helper.transaction(
                            asyncResult(e.taskId, data, false)
                        );
                    } catch (ex) {
                        simulation.helper.transaction(
                            asyncError(e.taskId, ex.toString())
                        );
                    }
                } else if (e.type === 'enable_pov') {
                    this.streamImu = e.enabled && e.imu;
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
                                onServerStreamLostArg(simulation.id)
                            );
                            await this._superAction(
                                ON_SERVER_STREAM_LOST_ACTION_NAME,
                                onServerStreamLostArg(simulation.id)
                            );
                        }
                    } else {
                        info.synced = true;

                        if (!info.subscribed) {
                            info.subscribed = true;
                            await this._superAction(
                                ON_INST_JOINED_ACTION_NAME,
                                onServerSubscribedArg(simulation.id)
                            );
                            await this._superAction(
                                ON_SERVER_JOINED_ACTION_NAME,
                                onServerSubscribedArg(simulation.id)
                            );
                            await this._superAction(
                                ON_SERVER_SUBSCRIBED_ACTION_NAME,
                                onServerSubscribedArg(simulation.id)
                            );

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
                                    onServerSubscribedArg(info.id)
                                );
                                await simulation.helper.action(
                                    ON_SERVER_JOINED_ACTION_NAME,
                                    null,
                                    onServerSubscribedArg(info.id)
                                );
                                await simulation.helper.action(
                                    ON_SERVER_SUBSCRIBED_ACTION_NAME,
                                    null,
                                    onServerSubscribedArg(info.id)
                                );
                            }
                        }

                        await this._superAction(
                            ON_INST_STREAMING_ACTION_NAME,
                            onServerStreamingArg(simulation.id)
                        );
                        await this._superAction(
                            ON_SERVER_STREAMING_ACTION_NAME,
                            onServerStreamingArg(simulation.id)
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
            new Subscription(async () => {
                await this._superAction(
                    ON_INST_LEAVE_ACTION_NAME,
                    onServerUnsubscribedArg(simulation.id)
                );
                await this._superAction(
                    ON_SERVER_LEAVE_ACTION_NAME,
                    onServerUnsubscribedArg(simulation.id)
                );
                await this._superAction(
                    ON_SERVER_UNSUBSCRIBED_ACTION_NAME,
                    onServerUnsubscribedArg(simulation.id)
                );
            })
        );

        this._simulationSubs.set(simulation, subs);
        this.simulations.push(info);

        this.setTitleToID();
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

    updateTitleContext(newContext: string) {
        let id: string = '...';

        if (appManager.simulationManager.primary != null) {
            let temp = appManager.simulationManager.primary.id.split('/');
            id = '';
            for (let i = 1; i < temp.length; i++) {
                id += temp[i];
            }
            id = newContext + '/' + id;
        }

        appManager.simulationManager.primary.updateID(id);
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
            action: {
                type: 'refresh',
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
