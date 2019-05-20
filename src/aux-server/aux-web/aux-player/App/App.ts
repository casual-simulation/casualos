import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { appManager, User } from '../../shared/AppManager';
import { EventBus } from '../../shared/EventBus';
import ConfirmDialogOptions from '../../shared/ConfirmDialogOptions';
import AlertDialogOptions from '../../shared/AlertDialogOptions';
import { SubscriptionLike, Subscription } from 'rxjs';
import {
    FilesState,
    UserMode,
    Object,
    getUserMode,
    ON_QR_CODE_SCANNER_CLOSED_ACTION_NAME,
    ON_QR_CODE_SCANNED_ACTION_NAME,
    ON_QR_CODE_SCANNER_OPENED_ACTION_NAME,
    filesInContext,
    isSimulation,
    getFileChannel,
    calculateDestroyFileEvents,
    merge,
    SimulationIdParseSuccess,
    simulationIdToString,
} from '@casual-simulation/aux-common';
import SnackbarOptions from '../../shared/SnackbarOptions';
import { copyToClipboard } from '../../shared/SharedUtils';
import { tap } from 'rxjs/operators';
import { findIndex, flatMap } from 'lodash';
import QRCode from '@chenfengyuan/vue-qrcode';
import CubeIcon from '../public/icons/Cube.svg';
import HexIcon from '../public/icons/Hexagon.svg';
import { QrcodeStream } from 'vue-qrcode-reader';
import { Simulation } from '../../shared/Simulation';

export interface SidebarItem {
    id: string;
    group: string;
    text: string;
    icon: string;
    click: () => void;
}

@Component({
    components: {
        app: App,
        'qr-code': QRCode,
        'qrcode-stream': QrcodeStream,
    },
})
export default class App extends Vue {
    showNavigation: boolean = false;
    showConfirmDialog: boolean = false;
    showAlertDialog: boolean = false;
    updateAvailable: boolean = false;
    snackbar: SnackbarOptions = {
        visible: false,
        message: '',
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
     * The session/
     */
    session: string = '';

    /**
     * The extra sidebar items shown in the app.
     */
    extraItems: SidebarItem[] = [];

    /**
     * The list of simulations that are in the app.
     */
    simulations: SimulationInfo[] = [];

    /**
     * Whether to show the add simulation dialog.
     */
    showAddSimulation: boolean = false;

    /**
     * Whether to show the confirm remove simulation dialog.
     */
    showRemoveSimulation: boolean = false;

    /**
     * The simulation to remove.
     */
    simulationToRemove: string = '';

    /**
     * The ID of the simulation to add.
     */
    newSimulation: string = '';

    /**
     * The QR Code to show.
     */
    qrCode: string = '';

    confirmDialogOptions: ConfirmDialogOptions = new ConfirmDialogOptions();
    alertDialogOptions: AlertDialogOptions = new AlertDialogOptions();

    private _subs: SubscriptionLike[] = [];
    private _simulationSubs: Map<Simulation, SubscriptionLike[]> = new Map();

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

    forcedOffline(info: SimulationInfo) {
        return info.simulation.socketManager.forcedOffline;
    }

    created() {
        this._subs = [];
        this._simulationSubs = new Map();
        this._subs.push(
            appManager.updateAvailableObservable.subscribe(updateAvailable => {
                if (updateAvailable) {
                    this.updateAvailable = true;
                    this._showUpdateAvailable();
                }
            })
        );

        this._subs.push(
            appManager.simulationManager.simulationAdded
                .pipe(tap(sim => this._simulationAdded(sim)))
                .subscribe(),
            appManager.simulationManager.simulationRemoved
                .pipe(tap(sim => this._simulationRemoved(sim)))
                .subscribe()
        );

        this._subs.push(
            appManager.whileLoggedIn((user, fileManager) => {
                let subs: SubscriptionLike[] = [];

                this.loggedIn = true;
                this.session = user.channelId;
                // this.online = fileManager.isOnline;
                // this.synced = fileManager.isSynced;

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
    }

    copy(text: string) {
        copyToClipboard(text);
        this.snackbar = {
            visible: true,
            message: `Copied '${text}' to the clipboard!`,
        };
    }

    beforeDestroy() {
        this._subs.forEach(s => s.unsubscribe());
    }

    logout() {
        const context =
            appManager.simulationManager.primary.helper.userFile.tags[
                'aux._userContext'
            ];
        appManager.logout();
        this.showNavigation = false;
        this.$router.push({
            name: 'login',
            query: { id: this.session, context: context },
        });
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

    getUser(): User {
        return appManager.user;
    }

    menuClicked() {
        this.showNavigation = !this.showNavigation;
    }

    refreshPage() {
        window.location.reload();
    }

    fixConflicts() {
        this.$router.push({
            name: 'merge-conflicts',
            params: { id: this.session },
        });
    }

    toggleOnlineOffline(info: SimulationInfo) {
        let options = new ConfirmDialogOptions();
        if (info.simulation.socketManager.forcedOffline) {
            options.title = 'Enable online?';
            options.body = `Allow ${info.id} to reconnect to the server?`;
            options.okText = 'Go Online';
            options.cancelText = 'Stay Offline';
        } else {
            options.title = 'Force offline mode?';
            options.body = `Prevent ${info.id} from connecting to the server?`;
            options.okText = 'Go Offline';
            options.cancelText = 'Stay Online';
        }
        EventBus.$once(options.okEvent, () => {
            info.simulation.socketManager.toggleForceOffline();
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

    addSimulation() {
        this.newSimulation = '';
        this.showAddSimulation = true;
    }

    async finishAddSimulation(id: string) {
        console.log('[App] Add simulation!');
        await appManager.simulationManager.primary.helper.createSimulation(id);
    }

    removeSimulation(info: SimulationInfo) {
        if (appManager.simulationManager.primary.id === info.id) {
            this.snackbar = {
                message: `You cannot remove the primary simulation.`,
                visible: true,
            };
        } else {
            this.showRemoveSimulation = true;
            this.simulationToRemove = info.id;
        }
    }

    finishRemoveSimulation() {
        this.removeSimulationById(this.simulationToRemove);
    }

    removeSimulationById(id: string) {
        appManager.simulationManager.simulations.forEach(sim => {
            sim.helper.destroySimulations(id);
        });
    }

    getQRCode(): string {
        return this.qrCode || this.url();
    }

    private _simulationAdded(simulation: Simulation) {
        const index = this.simulations.findIndex(s => s.id === simulation.id);
        if (index >= 0) {
            return;
        }

        let subs: SubscriptionLike[] = [];

        let info: SimulationInfo = {
            id: simulation.id,
            online: false,
            synced: false,
            lostConnection: false,
            simulation: simulation,
        };

        subs.push(
            simulation.helper.localEvents.subscribe(e => {
                if (e.name === 'show_toast') {
                    this.snackbar = {
                        message: e.message,
                        visible: true,
                    };
                } else if (e.name === 'show_qr_code_scanner') {
                    if (this.showQRScanner !== e.open) {
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
                } else if (e.name === 'load_simulation') {
                    this.finishAddSimulation(e.id);
                } else if (e.name === 'unload_simulation') {
                    this.removeSimulationById(e.id);
                } else if (e.name === 'super_shout') {
                    this._superAction(e.eventName, e.argument);
                } else if (e.name === 'show_qr_code') {
                    if (e.open) {
                        this.qrCode = e.code;
                        this.showQRCode = true;
                    } else {
                        this.qrCode = null;
                        this.showQRCode = false;
                    }
                } else if (e.name === 'go_to_context') {
                    if (e.simulation) {
                        // Go to context and simulation
                        window.location.pathname = `${e.simulation}/${
                            e.context
                        }`;
                    } else {
                        simulation.parsedId = {
                            ...simulation.parsedId,
                            context: e.context,
                        };
                        this._updateQuery();
                    }
                }
            }),
            simulation.aux.channel.connectionStateChanged.subscribe(
                connected => {
                    if (!connected) {
                        this._showConnectionLost(info);
                        info.online = false;
                        info.synced = false;
                        info.lostConnection = true;
                        simulation.helper.action('onDisconnected', null);
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
                        simulation.helper.action('onConnected', null);
                    }
                }
            )
        );

        this._simulationSubs.set(simulation, subs);
        this.simulations.push(info);

        this._updateQuery();
    }

    private _simulationRemoved(simulation: Simulation) {
        const subs = this._simulationSubs.get(simulation);

        if (subs) {
            subs.forEach(s => {
                s.unsubscribe();
            });
        }

        this._simulationSubs.delete(simulation);

        const index = this.simulations.findIndex(s => s.id === simulation.id);
        if (index >= 0) {
            this.simulations.splice(index, 1);
        }

        this._updateQuery();
    }

    private _updateQuery() {
        if (!appManager.simulationManager.primary) {
            return;
        }

        const channel =
            appManager.simulationManager.primary.parsedId.channel ||
            this.$router.currentRoute.params.id;
        const context =
            appManager.simulationManager.primary.parsedId.context ||
            this.$router.currentRoute.params.context;
        if (channel && context) {
            this.$router.replace({
                name: 'home',
                params: {
                    id: channel,
                    context: context,
                },
                query: {
                    channels: this.simulations
                        .filter(
                            sim =>
                                sim.id !==
                                appManager.simulationManager.primary.id
                        )
                        .map(sim =>
                            simulationIdToString(sim.simulation.parsedId)
                        ),
                },
            });
        }
    }

    /**
     * Sends the given event and argument to every loaded simulation.
     * @param eventName The event to send.
     * @param arg The argument to send.
     */
    private _superAction(eventName: string, arg?: any) {
        appManager.simulationManager.simulations.forEach(sim => {
            sim.helper.action(eventName, null, arg);
        });
    }

    private _showConnectionLost(info: SimulationInfo) {
        this.snackbar = {
            visible: true,
            message: `Connection to ${
                info.id
            } lost. You are now working offline.`,
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

    private _showConnectionRegained(info: SimulationInfo) {
        this.snackbar = {
            visible: true,
            message: `Connection to ${info.id} regained. You are back online.`,
        };
    }

    private _showSynced() {
        this.snackbar = {
            visible: true,
            message: 'Synced!',
        };
    }

    private onShowNavigation(show: boolean) {
        if (show == undefined) {
            console.error(
                '[App] Missing expected boolean argument for showNavigation event.'
            );
            return;
        }

        console.log('[App] handleShowNavigation: ' + show);
        this.showNavigation = show;
    }

    private onShowConfirmDialog(options: ConfirmDialogOptions) {
        if (options == undefined) {
            console.error(
                '[App] Missing expected ConfirmDialogOptions argument for showConfirmDialog event.'
            );
            return;
        }

        this.confirmDialogOptions = options;
        this.showConfirmDialog = true;
        console.log(
            '[App] handleShowConfirmDialog ' +
                this.showConfirmDialog +
                ' ' +
                JSON.stringify(this.confirmDialogOptions)
        );
    }

    private onShowAlertDialog(options: AlertDialogOptions) {
        if (options == undefined) {
            console.error(
                '[App] Missing expected AlertDialogOptions argument for showAlertDialog event.'
            );
            return;
        }

        this.alertDialogOptions = options;
        this.showAlertDialog = true;
        console.log(
            '[App] handleShowAlertDialog ' +
                this.showAlertDialog +
                ' ' +
                JSON.stringify(this.alertDialogOptions)
        );
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

export interface SimulationInfo {
    id: string;
    online: boolean;
    synced: boolean;
    lostConnection: boolean;
    simulation: Simulation;
}
