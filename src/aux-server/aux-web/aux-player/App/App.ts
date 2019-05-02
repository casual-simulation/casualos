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
} from '@casual-simulation/aux-common';
import SnackbarOptions from '../../shared/SnackbarOptions';
import { copyToClipboard } from '../../shared/SharedUtils';
import { tap } from 'rxjs/operators';
import { findIndex } from 'lodash';
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

    forcedOffline() {
        // return appManager.socketManager.forcedOffline;
        return false;
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
                this.online = fileManager.isOnline;
                this.synced = fileManager.isSynced;

                setTimeout(() => {
                    if (!this.online && !this.lostConnection) {
                        this.startedOffline = true;
                        this._showOffline();
                    }
                }, 1000);

                subs.push(
                    fileManager.aux.channel.connectionStateChanged.subscribe(
                        connected => {
                            if (!connected) {
                                this._showConnectionLost();
                                this.online = false;
                                this.synced = false;
                                this.lostConnection = true;
                            } else {
                                this.online = true;
                                if (this.lostConnection) {
                                    this._showConnectionRegained();
                                }
                                this.lostConnection = false;
                                this.startedOffline = false;
                                this.synced = true;
                                appManager.checkForUpdates();
                            }
                        }
                    )
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

    toggleOnlineOffline() {
        // TODO: Fix
        // let options = new ConfirmDialogOptions();
        // if (appManager.socketManager.forcedOffline) {
        //     options.title = 'Enable online?';
        //     options.body = 'Allow the app to reconnect to the server?';
        //     options.okText = 'Go Online';
        //     options.cancelText = 'Stay Offline';
        // } else {
        //     options.title = 'Force offline mode?';
        //     options.body = 'Prevent the app from connecting to the server?';
        //     options.okText = 'Go Offline';
        //     options.cancelText = 'Stay Online';
        // }
        // EventBus.$once(options.okEvent, () => {
        //     appManager.socketManager.toggleForceOffline();
        //     EventBus.$off(options.cancelEvent);
        // });
        // EventBus.$once(options.cancelEvent, () => {
        //     EventBus.$off(options.okEvent);
        // });
        // EventBus.$emit('showConfirmDialog', options);
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

    private _simulationAdded(simulation: Simulation) {
        let subs: SubscriptionLike[] = [];

        subs.push(
            simulation.helper.localEvents.subscribe(e => {
                if (e.name === 'show_toast') {
                    this.snackbar = {
                        message: e.message,
                        visible: true,
                    };
                } else if (e.name === 'show_qr_code') {
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
                }
            })
        );

        this._simulationSubs.set(simulation, subs);
    }

    private _simulationRemoved(simulation: Simulation) {
        const subs = this._simulationSubs.get(simulation);

        if (subs) {
            subs.forEach(s => {
                s.unsubscribe();
            });
        }

        this._simulationSubs.delete(simulation);
    }

    /**
     * Sends the given event and argument to every loaded simulation.
     * @param eventName The event to send.
     * @param arg The argument to send.
     */
    private _superAction(eventName: string, arg?: any) {
        appManager.simulationManager.simulations.forEach(sim => {
            sim.helper.action(ON_QR_CODE_SCANNER_OPENED_ACTION_NAME, null, arg);
        });
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
            message: 'Connection regained. You are back online.',
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
