import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import Axios from 'axios';
import {appManager} from '../AppManager';

@Component
export default class Welcome extends Vue {
    email: string = '';

    async createUser() {
        console.log('[Welcome] Email submitted: ' + this.email);

        if(await appManager.loginOrCreateUser(this.email)) {
            this.$router.push({ path: 'home' });
        } else {
            // TODO: Show an error message
        }
    }
};