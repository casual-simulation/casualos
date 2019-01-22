import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import Axios from 'axios';
import {appManager} from '../AppManager';

@Component
export default class Welcome extends Vue {
    email: string = '';
    channelId: string = '';

    async createUser() {
        console.log('[Welcome] Email submitted: ' + this.email);

        if(await appManager.loginOrCreateUser(this.email, this.channelId)) {
            this.$router.push({ name: 'home', params: { id: this.channelId } });
        } else {
            // TODO: Show an error message
        }
    }
};