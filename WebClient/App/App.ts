import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';

@Component({
    components: {
        'app': App
    }
})

export default class App extends Vue {
    showNavigation: boolean = false;
    message: string = 'Hello, App!';

    menuClicked() {
        this.showNavigation = !this.showNavigation;
        console.log("[App] Menu Clicked showNavigation === " + this.showNavigation);
    }
}