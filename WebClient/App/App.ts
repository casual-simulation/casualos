import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { appManager, User } from '../AppManager';
import { EventBus } from '../EventBus/EventBus';
import ConfirmDialog from '../ConfirmDialog/ConfirmDialog';
import ConfirmDialogOptions from '../ConfirmDialog/ConfirmDialogOptions';

@Component({
    components: {
        'app': App,
        'confirm-dialog': ConfirmDialog
    }
})

export default class App extends Vue {
    
    showNavigation:boolean = false;
    showConfirmDialog: boolean = false;
    confirmDialogOptions: ConfirmDialogOptions = null;

    created() {
        EventBus.$on('showNavigation', this._handleShowNavigation);
        EventBus.$on('showConfirmDialog', this._handleShowConfirmDialog);
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
        options.okCallback = () => { console.log('pressed ok on test confirm dialog'); };
        options.cancelCallback = () => { console.log('pressed cancel on test confirm dialog')};

        EventBus.$emit('showConfirmDialog', options);
    }
    
    private _handleShowNavigation(show: boolean) {
        if (show == undefined) {
            console.error('[App] Missing expected boolean argument for showNavigation event.');
            return;
        }

        console.log('[App] handleShowNavigation: ' + show);
        this.showNavigation = show
    }

    private _handleShowConfirmDialog(options: ConfirmDialogOptions) {
        if (options == undefined) {
            console.error('[App] Missing expected ConfirmDialogOptions argument for showConfirmDialog event.');
            return;
        }

        this.showConfirmDialog = true;
        console.log('[App] handleShowConfirmDialog ' + this.showConfirmDialog);
    }
}