import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import {Provide} from 'vue-property-decorator';
import { appManager, User } from '../AppManager';
import { EventBus } from '../EventBus/EventBus';
import ConfirmDialogOptions from './DialogOptions/ConfirmDialogOptions';
import { FileManager } from '../FileManager';
import { SocketManager } from '../SocketManager';
import AlertDialogOptions from './DialogOptions/AlertDialogOptions';

@Component({
    components: {
        'app': App,
    }
})

export default class App extends Vue {
    private _socketManager: SocketManager;
    
    @Provide('fileManager') private _fileManager: FileManager = new FileManager(appManager, this._socketManager);

    showNavigation:boolean = false;
    showConfirmDialog: boolean = false;
    showAlertDialog: boolean = false;
    confirmDialogOptions: ConfirmDialogOptions = new ConfirmDialogOptions();
    alertDialogOptions: AlertDialogOptions = new AlertDialogOptions();

    beforeCreate() {
        this._socketManager = new SocketManager();
        this._fileManager = new FileManager(appManager, this._socketManager);
    }

    created() {
        EventBus.$on('showNavigation', this.onShowNavigation);
        EventBus.$on('showConfirmDialog', this.onShowConfirmDialog);
        EventBus.$on('showAlertDialog', this.onShowAlertDialog);
    }

    provide() {
        return {
            fileManager: this._fileManager
        };
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