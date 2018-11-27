import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { appManager } from '../AppManager';

@Component({
    components: {
        'app': App
    }
})

export default class App extends Vue {
    showNavigation: boolean = false;

    logout() {
        appManager.logout();
    }

    get user() {
        return appManager.user;
    }

    menuClicked() {
        this.showNavigation = !this.showNavigation;
        console.log("[App] Menu Clicked showNavigation === " + this.showNavigation);
    }
}