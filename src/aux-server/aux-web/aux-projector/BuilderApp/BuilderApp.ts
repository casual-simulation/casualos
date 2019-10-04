import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { appManager } from '../../shared/AppManager';
import { EventBus } from '../../shared/EventBus';
import ConfirmDialogOptions from '../../shared/ConfirmDialogOptions';
import AlertDialogOptions from '../../shared/AlertDialogOptions';
import { LoadingProgress } from '@casual-simulation/aux-common/LoadingProgress';
import { SubscriptionLike, Subscription } from 'rxjs';
import {
    UserMode,
    Object,
    getUserMode,
    getBotsStateFromStoredTree,
    ShowInputForTagAction,
    ShowInputOptions,
    BotCalculationContext,
    calculateFormattedBotValue,
    ShowInputType,
    ShowInputSubtype,
    grantRole,
    BarcodeFormat,
    ON_CHANNEL_STREAM_LOST_ACTION_NAME,
    ON_CHANNEL_SUBSCRIBED_ACTION_NAME,
    ON_CHANNEL_STREAMING_ACTION_NAME,
} from '@casual-simulation/aux-common';
import SnackbarOptions from '../../shared/SnackbarOptions';
import { copyToClipboard, navigateToUrl } from '../../shared/SharedUtils';
import { tap, mergeMap, filter, switchMap, first } from 'rxjs/operators';
import { findIndex } from 'lodash';
import QRCode from '@chenfengyuan/vue-qrcode';
import QRAuxBuilder from '../public/icons/qr-aux-builder.svg';
import Loading from '../../shared/vue-components/Loading/Loading';
import ForkIcon from '../public/icons/repo-forked.svg';
import BotTableToggle from '../BotTableToggle/BotTableToggle';
import BotSearch from '../BotSearch/BotSearch';

import vueBotPond from 'vue-filepond';
import 'filepond/dist/filepond.min.css';
import { Simulation, AuxUser, LoginState } from '@casual-simulation/aux-vm';
import { SidebarItem } from '../../shared/vue-components/BaseGameView';
import LoadApp from '../../shared/vue-components/LoadApp/LoadApp';
import { Swatches, Chrome, Compact } from 'vue-color';
import {
    USERNAME_CLAIM,
    USER_ROLE,
    ADMIN_ROLE,
    DeviceInfo,
    ProgressMessage,
    remote,
} from '@casual-simulation/causal-trees';
import { userBotChanged } from '@casual-simulation/aux-vm-browser';
import { QrcodeStream } from 'vue-qrcode-reader';
import Console from '../../shared/vue-components/Console/Console';
import Hotkey from '../../shared/vue-components/Hotkey/Hotkey';
import { recordMessage } from '../../shared/Console';
import Tagline from '../../shared/vue-components/Tagline/Tagline';
import download from 'downloadjs';
import VueBarcode from '../../shared/public/VueBarcode';
import LoginPopup from '../../shared/vue-components/LoginPopup/LoginPopup';
import AuthorizePopup from '../../shared/vue-components/AuthorizeAccountPopup/AuthorizeAccountPopup';
import { sendWebhook } from '../../../shared/WebhookUtils';

const BotPond = vueBotPond();

@Component({
    components: {
        'load-app': LoadApp,
        loading: Loading,
        'qr-code': QRCode,
        barcode: VueBarcode,
        'qrcode-stream': QrcodeStream,
        'bot-pond': BotPond,
        'fork-icon': ForkIcon,
        'qr-icon': QRAuxBuilder,
        'bot-search': BotSearch,
        'bot-table-toggle': BotTableToggle,
        'color-picker-swatches': Swatches,
        'color-picker-advanced': Chrome,
        'color-picker-basic': Compact,
        console: Console,
        hotkey: Hotkey,
        tagline: Tagline,
        login: LoginPopup,
        authorize: AuthorizePopup,
    },
})
export default class BuilderApp extends Vue {
    @Provide() buildApp = this;

    loadingProgress: LoadingProgress = null;
    showNavigation: boolean = false;
    showConfirmDialog: boolean = false;
    showAlertDialog: boolean = false;
    updateAvailable: boolean = false;
    snackbar: SnackbarOptions = {
        visible: false,
        message: '',
    };

    /**
     * Whether the user is online and able to connect to the server.
     */
    online: boolean = true;

    /**
     * Whether the user is currently synced with the server.
     */
    synced: boolean = true;

    /**
     * Whether we had previously lost our connection to the server.
     */
    lostConnection: boolean = false;

    /**
     * Whether the app started without a connection to the server.
     */
    startedOffline: boolean = false;

    /**
     * Whether the user is logged in.
     */
    loggedIn: boolean = false;

    /**
     * The current user mode.
     */
    userMode: boolean = true;

    /**
     * Whether to show the QR Code.
     */
    showQRCode: boolean = false;

    /**
     * Whether to show the bot upload dialog.
     */
    showFileUpload: boolean = false;

    /**
     * Whether to show the fork dialog.
     */
    showFork: boolean = false;

    /**
     * The session/
     */
    session: string = '';

    /**
     * The name of the fork to create.
     */
    forkName: string = '';

    /**
     * The bots that have been uploaded by the user.
     */
    uploadedFiles: File[] = [];

    /**
     * The extra sidebar items shown in the app.
     */
    extraItems: SidebarItem[] = [];

    /**
     * The QR Code to display.
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
     * Whether to show the "Create channel that doesn't exist"
     * option in the menu.
     */
    showCreateChannel: boolean = false;

    /**
     * Whether to show the login code.
     */
    showLoginCode: boolean = false;

    /**
     * Whether to show the login popup.
     */
    showLogin: boolean = false;

    /**
     * Whether to show the authorize account popup.
     */
    showAuthorize: boolean = false;

    /**
     * Whether we have been synced with the server.
     */
    subscribed: boolean = false;

    inputDialogLabel: string = '';
    inputDialogPlaceholder: string = '';
    inputDialogInput: string = '';
    inputDialogType: ShowInputType = 'text';
    inputDialogSubtype: ShowInputSubtype = 'basic';
    inputDialogInputValue: any = '';
    inputDialogLabelColor: string = '#000';
    inputDialogBackgroundColor: string = '#FFF';
    showInputDialog: boolean = false;
    showQRCodeScanner: boolean = false;
    showConsole: boolean = false;
    loginInfo: DeviceInfo = null;
    loginState: LoginState = null;
    authorized: boolean = false;

    private _inputDialogSimulation: Simulation = null;
    private _inputDialogTarget: Object = null;

    /**
     * Gets whether we're in developer mode.
     */
    get dev() {
        return !PRODUCTION;
    }

    get isAdmin() {
        return this.loginInfo && this.loginInfo.roles.indexOf(ADMIN_ROLE) >= 0;
    }

    get isAdminChannel() {
        return this.session === 'admin';
    }

    closeConsole() {
        this.showConsole = false;
    }

    async toggleUserMode() {
        this.userMode = !this.userMode;
        const mode: UserMode = this.userMode ? 'bots' : 'worksurfaces';
        await appManager.simulationManager.primary.setUserMode(mode);
    }

    private _calculateUserMode(bot: Object): boolean {
        return bot && getUserMode(bot) === 'bots';
    }

    confirmDialogOptions: ConfirmDialogOptions = new ConfirmDialogOptions();
    alertDialogOptions: AlertDialogOptions = new AlertDialogOptions();

    private _subs: SubscriptionLike[] = [];

    get version() {
        return appManager.version.latestTaggedVersion;
    }

    get versionTooltip() {
        return appManager.version.gitCommit;
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
        const index = findIndex(this.extraItems, i => i.id === id);
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
        const index = findIndex(this.extraItems, i => i.id === id);
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

    getQRCode() {
        return this.qrCode || this.url();
    }

    getLoginCode() {
        return appManager.user ? appManager.user.token : '';
    }

    getBarcode() {
        return this.barcode || '';
    }

    getBarcodeFormat() {
        return this.barcodeFormat || '';
    }

    currentUserMode() {
        return this.userMode ? 'Bots' : 'Worksurfaces';
    }

    forcedOffline() {
        return appManager.simulationManager.primary
            ? appManager.simulationManager.primary.connection.forcedOffline
            : false;
    }

    toggleOpen() {
        EventBus.$emit('toggleBotPanel');
    }

    addAdmin() {
        this.showQRCodeScanner = true;
    }

    async onQRCodeScanned(code: string) {
        this.showQRCodeScanner = false;
        await appManager.simulationManager.primary.helper.transaction(
            remote(grantRole(code, ADMIN_ROLE, appManager.user.token))
        );
    }

    closeQRCodeScanner() {
        this.showQRCodeScanner = false;
    }

    created() {
        // appManager.loadingProgress.onChanged.addListener(
        //     this.onLoadingProgressChanged
        // );

        this._subs = [];
        this._subs.push(
            appManager.updateAvailableObservable.subscribe(updateAvailable => {
                if (updateAvailable) {
                    this.updateAvailable = true;
                    this._showUpdateAvailable();
                }
            })
        );

        this._subs.push(
            appManager.whileLoggedIn((user, botManager) => {
                let subs: SubscriptionLike[] = [];

                this.loggedIn = true;
                this.session = botManager.id;
                this.online = botManager.isOnline;
                this.synced = botManager.isSynced;

                setTimeout(() => {
                    if (!this.online && !this.lostConnection) {
                        this.startedOffline = true;
                        this._showOffline();
                    }
                }, 1000);

                subs.push(
                    botManager.login.loginStateChanged
                        .pipe(
                            tap(state => {
                                this.loginState = state;
                                if (!state.authenticated) {
                                    console.log(
                                        '[BuilderApp] Not authenticated:',
                                        state.authenticationError
                                    );
                                    if (state.authenticationError) {
                                        console.log(
                                            '[BuilderApp] Redirecting to login to resolve error.'
                                        );
                                        this.showAuthorize = true;
                                    }
                                } else {
                                    this.showAuthorize = false;
                                    console.log(
                                        '[BuilderApp] Authenticated!',
                                        state.info
                                    );
                                }

                                this.showCreateChannel = false;
                                if (state.authorized) {
                                    this.authorized = true;
                                    console.log('[BuilderApp] Authorized!');
                                } else if (state.authorized === false) {
                                    console.log('[BuilderApp] Not authorized.');
                                    if (
                                        state.authorizationError ===
                                        'channel_doesnt_exist'
                                    ) {
                                        if (this.isAdmin) {
                                            this.showCreateChannel = true;
                                        }

                                        this.snackbar = {
                                            message:
                                                'This channel does not exist.',
                                            visible: true,
                                        };
                                    } else {
                                        this.snackbar = {
                                            message:
                                                'You are not authorized to view this channel.',
                                            visible: true,
                                        };
                                    }
                                }
                            })
                        )
                        .subscribe(),
                    botManager.connection.connectionStateChanged.subscribe(
                        connected => {
                            if (!connected) {
                                this.online = false;
                                this.synced = false;
                                if (this.subscribed) {
                                    this._showConnectionLost();
                                    this.lostConnection = true;
                                }
                            } else {
                                this.online = true;
                                if (this.lostConnection) {
                                    this._showConnectionRegained();
                                }
                                this.lostConnection = false;
                                this.startedOffline = false;
                                appManager.checkForUpdates();
                            }
                        }
                    ),

                    botManager.connection.syncStateChanged.subscribe(
                        async connected => {
                            if (!connected) {
                                this.synced = false;

                                if (this.subscribed) {
                                    this.lostConnection = true;
                                    await botManager.helper.action(
                                        ON_CHANNEL_STREAM_LOST_ACTION_NAME,
                                        null,
                                        {
                                            channel:
                                                botManager.parsedId.channel,
                                        }
                                    );
                                }
                            } else {
                                this.synced = true;

                                if (!this.subscribed) {
                                    this.subscribed = true;
                                    await botManager.helper.action(
                                        ON_CHANNEL_SUBSCRIBED_ACTION_NAME,
                                        null,
                                        {
                                            channel:
                                                botManager.parsedId.channel,
                                        }
                                    );
                                }

                                await botManager.helper.action(
                                    ON_CHANNEL_STREAMING_ACTION_NAME,
                                    null,
                                    {
                                        channel: botManager.parsedId.channel,
                                    }
                                );
                            }
                        }
                    ),
                    botManager.consoleMessages.subscribe(m => {
                        recordMessage(m);
                    })
                );

                subs.push(
                    userBotChanged(botManager)
                        .pipe(
                            tap(bot => {
                                this.userMode = this._calculateUserMode(bot);
                            })
                        )
                        .subscribe()
                );

                subs.push(
                    botManager.localEvents.subscribe(e => {
                        if (e.type === 'show_toast') {
                            this.snackbar = {
                                message: e.message,
                                visible: true,
                            };
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
                        } else if (e.type === 'import_aux') {
                            this._importAUX(botManager, e.url);
                        } else if (e.type === 'show_input_for_tag') {
                            setTimeout(() => {
                                this._showInputDialog(botManager, e);
                            });
                        } else if (e.type === 'go_to_url') {
                            navigateToUrl(e.url, null, 'noreferrer');
                        } else if (e.type === 'open_url') {
                            navigateToUrl(e.url, '_blank', 'noreferrer');
                        } else if (e.type === 'open_console') {
                            this.showConsole = e.open;
                        } else if (e.type === 'download') {
                            console.log(
                                `[BuilderApp] Downloading ${e.botname}...`
                            );
                            download(e.data, e.botname, e.mimeType);
                        } else if (e.type === 'send_webhook') {
                            sendWebhook(botManager, e);
                        }
                    }),
                    botManager.login.deviceChanged.subscribe(info => {
                        this.loginInfo = info || this.loginInfo;
                    })
                );

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

        let element = document.getElementById('app');
        document.addEventListener('keydown', this.checkForEscape);
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

    checkForEscape(event: KeyboardEvent) {
        if (event.key == 'Escape') {
            EventBus.$emit('closeNewTag');
        }
    }

    copy(text: string) {
        copyToClipboard(text);
        this.snackbar = {
            visible: true,
            message: `Copied '${text}' to the clipboard!`,
        };
    }

    beforeDestroy() {
        // appManager.loadingProgress.onChanged.removeListener(
        //     this.onLoadingProgressChanged
        // );
        this._subs.forEach(s => s.unsubscribe());
    }

    logout() {
        this.showNavigation = false;
        this.showLogin = true;
    }

    download() {
        appManager.downloadState();
    }

    upload() {
        this.showFileUpload = true;
    }

    fork() {
        this.showFork = true;
    }

    async finishFork() {
        await this._createChannel(this.forkName);
        await appManager.simulationManager.primary.forkAux(this.forkName);
        this.$router.push({ name: 'home', params: { id: this.forkName } });
        this.showFork = false;
        this.forkName = '';
    }

    cancelFork() {
        this.showFork = false;
        this.forkName = '';
    }

    cancelFileUpload() {
        this.showFileUpload = false;
        this.uploadedFiles = [];
    }

    async uploadFiles() {
        await Promise.all(
            this.uploadedFiles.map(f => appManager.uploadState(f))
        );
        this.showFileUpload = false;
    }

    fileAdded(err: any, data: FilePondFile) {
        this.uploadedFiles.push(data.file);
    }

    fileRemoved(data: FilePondFile) {
        const index = this.uploadedFiles.indexOf(data.file);
        if (index >= 0) {
            this.uploadedFiles.splice(index, 1);
        }
    }

    snackbarClick(action: SnackbarOptions['action']) {
        if (action) {
            switch (action.type) {
                case 'refresh':
                    this.refreshPage();
                    break;
                case 'fix-conflicts':
                    this.fixConflicts();
                    break;
                case 'create_channel':
                    this.createChannel();
                    setTimeout(() => {
                        this.refreshPage();
                    }, 3000);
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

    setTitleToID() {
        let id: string = '...';

        if (appManager.simulationManager.primary != null) {
            id = appManager.simulationManager.primary.id;
        }

        //document.title = "Channel Designer | " + id;
        document.title = id;
    }

    getUIHtmlElements(): HTMLElement[] {
        let queue = <BotSearch>this.$refs.searchBar;

        if (queue) {
            return queue.uiHtmlElements();
        }
        return [];
    }

    nukeSite() {
        if (this.online && this.synced) {
            let options = new ConfirmDialogOptions();
            options.title = 'Delete Everything?';
            options.body =
                'Are you sure you want to delete everything? This is permanent and cannot be undone.';
            options.okText = 'Delete';
            options.cancelText = 'Keep';

            EventBus.$once(options.okEvent, async () => {
                await appManager.simulationManager.primary.deleteEverything();
                EventBus.$off(options.cancelEvent);
            });
            EventBus.$once(options.cancelEvent, () => {
                EventBus.$off(options.okEvent);
            });
            EventBus.$emit('showConfirmDialog', options);
        }
    }

    async createChannel() {
        const channel = this.session;
        await this._createChannel(channel);
    }

    private async _createChannel(channel: string) {
        console.log('[BuilderApp] Create Channel:', channel);
        const admin = await appManager.simulationManager.addSimulation('admin');
        await admin.connection.syncStateChanged
            .pipe(first(connected => connected))
            .toPromise();

        await admin.helper.createBot(undefined, {
            'aux.channels': true,
            'aux.channel': channel,
        });

        await appManager.simulationManager.removeSimulation('admin');
    }

    refreshPage() {
        window.location.reload();
    }

    showLoginQRCode() {
        this.showLoginCode = true;
    }

    fixConflicts() {
        this.$router.push({
            name: 'merge-conflicts',
            params: { id: this.session },
        });
    }

    toggleOnlineOffline() {
        let options = new ConfirmDialogOptions();
        if (appManager.simulationManager.primary.connection.forcedOffline) {
            options.title = 'Enable online?';
            options.body = 'Allow the app to reconnect to the server?';
            options.okText = 'Go Online';
            options.cancelText = 'Stay Offline';
        } else {
            options.title = 'Force offline mode?';
            options.body = 'Prevent the app from connecting to the server?';
            options.okText = 'Go Offline';
            options.cancelText = 'Stay Online';
        }
        EventBus.$once(options.okEvent, () => {
            appManager.simulationManager.primary.connection.toggleForceOffline();
            EventBus.$off(options.cancelEvent);
        });
        EventBus.$once(options.cancelEvent, () => {
            EventBus.$off(options.okEvent);
        });
        EventBus.$emit('showConfirmDialog', options);
    }

    // TODO: Move to a shared class/component
    _showInputDialog(simulation: Simulation, event: ShowInputForTagAction) {
        const calc = simulation.helper.createContext();
        const bot = simulation.helper.botsState[event.botId];
        this._updateLabel(calc, bot, event.tag, event.options);
        this._updateColor(calc, bot, event.options);
        this._updateInput(calc, bot, event.tag, event.options);
        this._inputDialogSimulation = simulation;
        this.showInputDialog = true;
    }

    updateInputDialogColor(newColor: any) {
        if (typeof newColor === 'object') {
            this.inputDialogInputValue = newColor.hex;
        } else {
            this.inputDialogInputValue = newColor;
        }
    }

    async closeInputDialog() {
        if (this.showInputDialog) {
            await this._inputDialogSimulation.helper.action('onCloseInput', [
                this._inputDialogTarget,
            ]);
            this.showInputDialog = false;
        }
    }

    async saveInputDialog() {
        if (this.showInputDialog) {
            await this._inputDialogSimulation.helper.updateBot(
                this._inputDialogTarget,
                {
                    tags: {
                        [this.inputDialogInput]: this.inputDialogInputValue,
                    },
                }
            );
            await this._inputDialogSimulation.helper.action('onSaveInput', [
                this._inputDialogTarget,
            ]);
            await this.closeInputDialog();
        }
    }

    private _updateColor(
        calc: BotCalculationContext,
        bot: Object,
        options: Partial<ShowInputOptions>
    ) {
        if (typeof options.backgroundColor !== 'undefined') {
            this.inputDialogBackgroundColor = options.backgroundColor;
        } else {
            this.inputDialogBackgroundColor = '#FFF';
        }
    }

    private _updateLabel(
        calc: BotCalculationContext,
        bot: Object,
        tag: string,
        options: Partial<ShowInputOptions>
    ) {
        if (typeof options.title !== 'undefined') {
            this.inputDialogLabel = options.title;
        } else {
            this.inputDialogLabel = tag;
        }

        if (typeof options.foregroundColor !== 'undefined') {
            this.inputDialogLabelColor = options.foregroundColor;
        } else {
            this.inputDialogLabelColor = '#000';
        }
    }

    private _updateInput(
        calc: BotCalculationContext,
        bot: Object,
        tag: string,
        options: Partial<ShowInputOptions>
    ) {
        this.inputDialogInput = tag;
        this.inputDialogType = options.type || 'text';
        this.inputDialogSubtype = options.subtype || 'basic';
        this._inputDialogTarget = bot;
        this.inputDialogInputValue =
            calculateFormattedBotValue(
                calc,
                this._inputDialogTarget,
                this.inputDialogInput
            ) || '';

        if (typeof options.placeholder !== 'undefined') {
            this.inputDialogPlaceholder = options.placeholder;
        } else {
            this.inputDialogPlaceholder = this.inputDialogInput;
        }
    }

    private async _importAUX(sim: Simulation, url: string) {
        const stored = await appManager.loadAUX(url);
        const state = await getBotsStateFromStoredTree(stored);
        await sim.helper.addState(state);
    }

    private _showConnectionLost() {
        this.snackbar = {
            visible: true,
            message: 'Connection lost. You are now working offline.',
        };
    }

    private _showOffline() {
        this.snackbar = {
            visible: true,
            message:
                'You are offline. Changes will be synced to the server upon reconnection.',
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

    private _showConnectionRegained() {
        this.snackbar = {
            visible: true,
            message: 'Connection regained. You are connected to the channel.',
        };
    }

    private _showSynced() {
        this.snackbar = {
            visible: true,
            message: 'Synced!',
        };
    }

    private _showSyncFailed() {
        this.snackbar = {
            visible: true,
            message: 'Conflicts occurred while syncing.',
            action: {
                label: 'Fix now',
                type: 'fix-conflicts',
            },
        };
    }

    private onShowNavigation(show: boolean) {
        if (show == undefined) {
            console.error(
                '[BuilderApp] Missing expected boolean argument for showNavigation event.'
            );
            return;
        }

        console.log('[BuilderApp] handleShowNavigation: ' + show);
        this.showNavigation = show;
    }

    private onShowConfirmDialog(options: ConfirmDialogOptions) {
        if (options == undefined) {
            console.error(
                '[BuilderApp] Missing expected ConfirmDialogOptions argument for showConfirmDialog event.'
            );
            return;
        }

        this.confirmDialogOptions = options;
        this.showConfirmDialog = true;
        console.log(
            '[BuilderApp] handleShowConfirmDialog ' +
                this.showConfirmDialog +
                ' ' +
                JSON.stringify(this.confirmDialogOptions)
        );
    }

    private onShowAlertDialog(options: AlertDialogOptions) {
        if (options == undefined) {
            console.error(
                '[BuilderApp] Missing expected AlertDialogOptions argument for showAlertDialog event.'
            );
            return;
        }

        this.alertDialogOptions = options;
        this.showAlertDialog = true;
        console.log(
            '[BuilderApp] handleShowAlertDialog ' +
                this.showAlertDialog +
                ' ' +
                JSON.stringify(this.alertDialogOptions)
        );
    }

    private onLoadingProgressChanged(progress: LoadingProgress) {
        this.loadingProgress = progress.clone();
    }

    /**
     * Click event from App.vue
     */
    private onConfirmDialogOk() {
        if (this.confirmDialogOptions.okEvent != null)
            EventBus.$emit(this.confirmDialogOptions.okEvent);
    }

    /**
     * Click event from App.vue
     */
    private onConfirmDialogCancel() {
        if (this.confirmDialogOptions.cancelEvent != null)
            EventBus.$emit(this.confirmDialogOptions.cancelEvent);
    }
}
