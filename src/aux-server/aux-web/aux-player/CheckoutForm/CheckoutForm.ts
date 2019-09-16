import Vue from 'vue';
import Component from 'vue-class-component';
import { SubscriptionLike } from 'rxjs';
import { appManager } from '../../shared/AppManager';
import { tap, first } from 'rxjs/operators';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { Simulation } from '@casual-simulation/aux-vm';
import {
    calculateNumericalTagValue,
    calculateStringTagValue,
    hasValue,
    toast,
    StartCheckoutEvent,
    checkoutSubmitted,
    ON_CHECKOUT_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { Prop } from 'vue-property-decorator';
import { getStripeKey, loadStripe } from '../../shared/checkout/utils';
import { remote } from '@casual-simulation/causal-trees';

@Component({})
export default class CheckoutForm extends Vue {
    @Prop({ required: true }) channelId: string;
    @Prop({ required: true }) productId: string;
    @Prop({ required: true }) title: string;
    @Prop({ required: true }) description: string;
    @Prop({ required: true }) processingChannel: string;

    checkingOut: boolean = false;
    showCheckoutDialog: boolean = false;
    cardError: string = '';

    private _stripe: stripe.Stripe;
    private _card: stripe.elements.Element;
    private _checkoutSim: Simulation;

    created() {
        this._checkoutSim = appManager.simulationManager.simulations.get(
            this.channelId
        );
    }

    mounted() {
        this._initForm();
    }

    beforeDestroy() {
        if (this._card) {
            this._card.unmount();
        }
    }

    async submitCheckout() {
        this.checkingOut = true;
        const productId = this.productId;
        const processingChannel = this.processingChannel;
        const result = await this._stripe.createToken(this._card);

        if (result.error) {
            this.cardError = result.error.message;
            this.checkingOut = false;
        } else {
            this.cardError = null;

            const token = result.token.id;
            await this._checkoutSim.helper.action(
                ON_CHECKOUT_ACTION_NAME,
                null,
                {
                    productId: productId,
                    token: token,
                }
            );
            await this._checkoutSim.helper.transaction(
                remote(checkoutSubmitted(productId, token, processingChannel))
            );
            this.$emit('paymentSuccess');
        }
    }

    private async _initForm() {
        const key = getStripeKey(this._checkoutSim);
        const hasKey = hasValue(key);
        if (!hasKey) {
            this._checkoutSim.helper.transaction(
                toast(
                    'A stripe key must be provided before checkouts will work.'
                )
            );
        } else if (this.showCheckoutDialog) {
            this._checkoutSim.helper.transaction(
                toast('A checkout is already underway.')
            );
        } else {
            await loadStripe();

            this._stripe = Stripe(key);
            const elements = this._stripe.elements();

            this._card = elements.create('card', {});

            this._card.on('change', e => {
                if (e.error) {
                    this.cardError = e.error.message;
                } else {
                    this.cardError = null;
                }
            });

            this._card.mount(this.$refs.paymentCard);
        }
    }
}
