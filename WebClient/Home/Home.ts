import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { appManager } from '../AppManager';

@Component
export default class Home extends Vue {
    get appManager() {
        return appManager;
    }
    
    get user() {
        return appManager.user;
    }
};