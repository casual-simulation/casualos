import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide} from 'vue-property-decorator';
import { appManager, User } from '../AppManager';
import { EventBus } from '../EventBus/EventBus';
import ConfirmDialogOptions from './DialogOptions/ConfirmDialogOptions';
import AlertDialogOptions from './DialogOptions/AlertDialogOptions';
import { SubscriptionLike } from 'rxjs';
import { resolveConflicts, first } from 'common/Files';

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
    showUpdateAvailable: boolean = false;
    showConnectionLost: boolean = false;
    showConnectionRegained: boolean = false;
    showSynced: boolean = false;

    /**
     * Whether the user is online and able to connect to the server.
     */
    online: boolean = true;

    /**
     * Whether the user is currently synced with the server.
     */
    synced: boolean = true;

    confirmDialogOptions: ConfirmDialogOptions = new ConfirmDialogOptions();
    alertDialogOptions: AlertDialogOptions = new AlertDialogOptions();

    private _subs: SubscriptionLike[] = [];

    get version() {
        return GIT_HASH.slice(0, 7);
    }

    created() {
        this._subs = [];
        this._subs.push(appManager.updateAvailableObservable.subscribe(updateAvailable => {
            if (updateAvailable) {
                this.updateAvailable = true;
                this.showUpdateAvailable = true;
            }
        }));

        this._subs.push(appManager.whileLoggedIn((user, fileManager) => {
            let subs: SubscriptionLike[] = [];

            subs.push(fileManager.disconnected.subscribe(_ => {
                this.showConnectionLost = true;
                this.showConnectionRegained = false;
                this.showSynced = false;
                this.online = false;
                this.synced = false;
            }));

            subs.push(fileManager.reconnected.subscribe(async merge => {
                this.online = true;
                this.showConnectionRegained = true;

                if (merge.success) {
                    console.log('[App] Merge success!');
                    if (merge.final) {
                        fileManager.publishMergeResults(merge);
                    }
                } else {
                    console.error('[App] Merge Failed! Conflicts:', merge.conflicts);
                    const fixed = await resolveConflicts(merge, details => {
                        return details.conflict[first];
                    });

                    fileManager.publishMergeResults(fixed);
                    console.log('Fixed by overwriting the other changes!');
                }
            }));

            subs.push(fileManager.resynced.subscribe(_ => {
                this.showConnectionRegained = false;
                this.showSynced = true;
                this.synced = true;
            }));

            return subs;
        }));

        EventBus.$on('showNavigation', this.onShowNavigation);
        EventBus.$on('showConfirmDialog', this.onShowConfirmDialog);
        EventBus.$on('showAlertDialog', this.onShowAlertDialog);
    }

    beforeDestroy() {
        this._subs.forEach(s => s.unsubscribe());
    }
    
    logout() {
        appManager.logout();
        this.showNavigation = false;
        this.$router.push('/');
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

    refreshPage() {
        window.location.reload();
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