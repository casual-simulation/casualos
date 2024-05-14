
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared';

@Component({
    components: {},
})
export default class AuthStoreFulfillment extends Vue {
    @Prop({ type: String, required: true })
    sessionId: string;

    async activatePurchase(activation: 'now' | 'later') {
        const result = await authManager.client.fulfillCheckoutSession({
            sessionId: this.sessionId,
            activation,
        });

        console.log('RESULT:', result);
    }

}
