import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide} from 'vue-property-decorator';
import { appManager, User } from '../AppManager';
import { EventBus } from '../EventBus/EventBus';
import ConfirmDialogOptions from './DialogOptions/ConfirmDialogOptions';
import AlertDialogOptions from './DialogOptions/AlertDialogOptions';
import { SubscriptionLike } from 'rxjs';
import { FilesState, ConflictDetails } from 'common/Files';
import { MergeStatus } from 'WebClient/FileManager';
import SnackbarOptions from './Snackbar/SnackbarOptions';
import { copyToClipboard } from '../utils';

@Component({
    components: {
        'app': App,
    }
})

export default class App extends Vue {
    showNavigation:boolean = false;
    showConfirmDialog: boolean = false;
    showAlertDialog: boolean = false;
    updateAvailable: boolean = false;
    snackbar: SnackbarOptions = {
        visible: false,
        message: ''
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

    confirmDialogOptions: ConfirmDialogOptions = new ConfirmDialogOptions();
    alertDialogOptions: AlertDialogOptions = new AlertDialogOptions();

    remainingConflicts: ConflictDetails[] = [];
    currentMergeState: MergeStatus<FilesState> = null;

    private _subs: SubscriptionLike[] = [];

    get version() {
        return appManager.version.latestTaggedVersion;
    }

    get versionTooltip() {
        return appManager.version.gitCommit;
    }

    forcedOffline() {
        return appManager.socketManager.forcedOffline;
    }

    created() {
        this._subs = [];
        this._subs.push(appManager.updateAvailableObservable.subscribe(updateAvailable => {
            if (updateAvailable) {
                this.updateAvailable = true;
                this._showUpdateAvailable();
            }
        }));

        this._subs.push(appManager.whileLoggedIn((user, fileManager) => {
            let subs: SubscriptionLike[] = [];

            this.online = fileManager.isOnline;
            this.synced = fileManager.isSynced;

            setTimeout(() => {
                if (!this.online && !this.lostConnection) {
                    this.startedOffline = true;
                    this._showOffline();
                }
            }, 1000);

            subs.push(fileManager.disconnected.subscribe(_ => {
                this._showConnectionLost();
                this.online = false;
                this.synced = false;
                this.lostConnection = true;
            }));

            subs.push(fileManager.reconnected.subscribe(async state => {
                this.online = true;
                if (this.lostConnection) {
                    this._showConnectionRegained();
                }
                appManager.checkForUpdates();
            }));

            subs.push(fileManager.syncFailed.subscribe(state => {
                this._showSyncFailed();
                this.remainingConflicts = state.remainingConflicts;
                this.currentMergeState = state;
            }));

            subs.push(fileManager.resynced.subscribe(resynced => {
                console.log('[App] Resynced!');
                this.remainingConflicts = [];
                if (this.lostConnection || this.startedOffline || resynced) {
                    this._showSynced();
                }
                this.lostConnection = false;
                this.startedOffline = false;
                this.synced = true;
            }));

            return subs;
        }));

        EventBus.$on('showNavigation', this.onShowNavigation);
        EventBus.$on('showConfirmDialog', this.onShowConfirmDialog);
        EventBus.$on('showAlertDialog', this.onShowAlertDialog);
    }

    copy(text: string) {
        copyToClipboard(text);
        this.snackbar = {
            visible: true,
            message: `Copied '${text}' to the clipboard!`
        };
    }

    beforeDestroy() {
        this._subs.forEach(s => s.unsubscribe());
    }
    
    logout() {
        appManager.logout();
        this.showNavigation = false;
        this.$router.push('/');
    }

    snackbarClick(action: SnackbarOptions['action']) {
        if (action) {
            switch(action.type) {
                case 'refresh':
                    this.refreshPage();
                    break;
                case 'fix-conflicts':
                    this.fixConflicts();
                    break;
            }
        }
    }

    openInfoCard() {
        EventBus.$emit('openInfoCard');
        this.showNavigation = false;
    }

    getUser(): User {
        return appManager.user;
    }

    menuClicked() {
        this.showNavigation = !this.showNavigation;
    }

    testConfirmDialog() {
        var options = new ConfirmDialogOptions();
        options.title = 'Title goes here';
        options.body = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
        options.okText = 'Yay';
        options.cancelText = 'Nah';

        // Hook up event listeners
        var handleOk = () => {
            console.log('Test dialog ok clicked.');
        };
        var handleCancel = () => {
            console.log('Test dialog cancel clicked.');
        };
        EventBus.$once(options.okEvent, handleOk);
        EventBus.$once(options.cancelEvent, handleCancel);

        // Emit dialog event.
        EventBus.$emit('showConfirmDialog', options);
    }

    testAlertDialog() {
        var options = new AlertDialogOptions();
        options.title = 'Title goes here';
        options.body = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
        options.confirmText = 'Alrighty';

        // Emit dialog event.
        EventBus.$emit('showAlertDialog', options);
    }

    nukeSite() {
        let options = new ConfirmDialogOptions();
        options.title = 'Delete Everything?';
        options.body = 'Are you sure you want to delete everything? This is permanent and cannot be undone.';
        options.okText = 'Delete';
        options.cancelText = 'Keep';
        
        EventBus.$once(options.okEvent, () => {
            appManager.fileManager.deleteEverything();
            EventBus.$off(options.cancelEvent);
        });
        EventBus.$once(options.cancelEvent, () => {
            EventBus.$off(options.okEvent);
        });
        EventBus.$emit('showConfirmDialog', options);
    }

    refreshPage() {
        window.location.reload();
    }
    
    fixConflicts() {
        this.$router.push('/merge-conflicts');
    }

    toggleOnlineOffline() {
        let options = new ConfirmDialogOptions();
        if (appManager.socketManager.forcedOffline) {
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
            appManager.socketManager.toggleForceOffline();
            EventBus.$off(options.cancelEvent);
        });
        EventBus.$once(options.cancelEvent, () => {
            EventBus.$off(options.okEvent);
        });
        EventBus.$emit('showConfirmDialog', options);
    }

    private _showConnectionLost() {
        this.snackbar = {
            visible: true,
            message: 'Connection lost. You are now working offline.'
        };
    }

    private _showOffline() {
        this.snackbar = {
            visible: true,
            message: 'You are offline. Changes will be synced to the server upon reconnection.'
        };
    }

    private _showUpdateAvailable() {
        this.snackbar = {
            visible: true,
            message: 'A new version is available!',
            action: {
                type: 'refresh',
                label: 'Refresh'
            }
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
            message: 'Synced!'
        };
    }

    private _showSyncFailed() {
        this.snackbar = {
            visible:  true,
            message: 'Conflicts occurred while syncing.',
            action: {
                label: 'Fix now',
                type: 'fix-conflicts'
            }
        };
    }
    
    private onShowNavigation(show: boolean) {
        if (show == undefined) {
            console.error('[App] Missing expected boolean argument for showNavigation event.');
            return;
        }

        console.log('[App] handleShowNavigation: ' + show);
        this.showNavigation = show
    }

    private onShowConfirmDialog(options: ConfirmDialogOptions) {
        if (options == undefined) {
            console.error('[App] Missing expected ConfirmDialogOptions argument for showConfirmDialog event.');
            return;
        }

        this.confirmDialogOptions = options;
        this.showConfirmDialog = true;
        console.log('[App] handleShowConfirmDialog ' + this.showConfirmDialog + ' ' + JSON.stringify(this.confirmDialogOptions));
    }

    private onShowAlertDialog(options: AlertDialogOptions) {
        if (options == undefined) {
            console.error('[App] Missing expected AlertDialogOptions argument for showAlertDialog event.');
            return;
        }

        this.alertDialogOptions = options;
        this.showAlertDialog = true;
        console.log('[App] handleShowAlertDialog ' + this.showAlertDialog + ' ' + JSON.stringify(this.alertDialogOptions));
    }

    private onConfirmDialogOk ()
    {
        if (this.confirmDialogOptions.okEvent != null)
            EventBus.$emit(this.confirmDialogOptions.okEvent);
    }

    private onConfirmDialogCancel ()
    {
        if (this.confirmDialogOptions.cancelEvent != null)
            EventBus.$emit(this.confirmDialogOptions.cancelEvent);
    }
}