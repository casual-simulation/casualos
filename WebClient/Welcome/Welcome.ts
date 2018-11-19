import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import Axios from 'axios';

@Component
export default class Welcome extends Vue {
    email: string = '';

    async createUser() {
        console.log('[Welcome] Email submitted: ' + this.email);

        // TODO: Create user and get their access token
        const result = await Axios.post('/api/users', {
            email: this.email
        });

        if (result.status === 200) {
            console.log('Success!', result);
        } else {
            console.error(result);
        }
    }
};