import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide, Watch} from 'vue-property-decorator';
import { appManager, User } from '../AppManager';
import { EventBus } from '../EventBus/EventBus';
import ConfirmDialogOptions from './DialogOptions/ConfirmDialogOptions';
import AlertDialogOptions from './DialogOptions/AlertDialogOptions';
import { SubscriptionLike, Subscription } from 'rxjs';
import { FilesState, ConflictDetails, UserMode, Object } from 'common/Files';
import { MergeStatus } from 'WebClient/FileManager';
import SnackbarOptions from './Snackbar/SnackbarOptions';
import { copyToClipboard } from '../utils';
import { getUserMode } from 'common/Files/FileCalculations';
import { tap } from 'rxjs/operators';
import QRCode from '@chenfengyuan/vue-qrcode';

import vueFilePond from 'vue-filepond';
import 'filepond/dist/filepond.min.css';
// import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type';

const FilePond = vueFilePond();

@Component({
    components: {
        'app': App,
        'qr-code': QRCode,
        'file-pond': FilePond
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
     * Whether to show the file upload dialog.
     */
    showFileUpload: boolean = false;

    /**
     * The files that have been uploaded by the user.
     */
    uploadedFiles: File[] = [];

    onUserModeChanged() {
        const mode: UserMode = this.userMode ? 'files' : 'worksurfaces';
        appManager.fileManager.updateFile(appManager.fileManager.userFile, {
            tags: {
                _mode: mode
            }
        });
    }

    private _calculateUserMode(file: Object): boolean {
        return getUserMode(file) === 'files'
    }

    confirmDialogOptions: ConfirmDialogOptions = new ConfirmDialogOptions();
    alertDialogOptions: AlertDialogOptions = new AlertDialogOptions();

    remainingConflicts: ConflictDetails[] = [];
    currentMergeState: MergeStatus<FilesState> = null;

    private _subs: SubscriptionLike[] = [];

    get session() {
        if (appManager.user) {
            return appManager.user.channelId;
        } else {
            return '';
        }
    }

    get version() {
        return appManager.version.latestTaggedVersion;
    }

    get versionTooltip() {
        return appManager.version.gitCommit;
    }

    url() {
        return location.href;
    }

    currentUserMode() {
        return this.userMode ? 'Files' : 'Worksurfaces';
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

            this.loggedIn = true;
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

            subs.push(fileManager.fileChanged(fileManager.userFile).pipe(
                tap(file => {
                    this.userMode = this._calculateUserMode(<Object>file);
                })
            ).subscribe());

            subs.push(new Subscription(() => {
                this.loggedIn = false;
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

    download() {
        appManager.downloadState();
    }

    upload() {
        this.showFileUpload = true;
    }

    cancelFileUpload() {
        this.showFileUpload = false;
        this.uploadedFiles = [];
    }

    async uploadFiles() {
        await Promise.all(this.uploadedFiles.map(f => appManager.uploadState(f)));
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
        if (this.online && this.synced) {
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
    }

    refreshPage() {
        window.location.reload();
    }
    
    fixConflicts() {
        this.$router.push({ name: 'merge-conflicts', params: { id: this.session }});
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