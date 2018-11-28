import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { appManager, User } from '../AppManager';
import { EventBus } from '../EventBus/EventBus';

@Component({
    components: {
        'app': App
    }
})

export default class App extends Vue {
    
    showNavigation:boolean = false;

    created() {
        EventBus.$on('showNavigation', this._handleShowNavigation);
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
    
    private _handleShowNavigation(show: boolean) {
        if (show == undefined) {
            console.error('[App] Missing expected boolean arguement for showNavigation event.');
            return;
        }

        console.log('[App] handleShowNavigation: ' + show);
        this.showNavigation = show
    }
}