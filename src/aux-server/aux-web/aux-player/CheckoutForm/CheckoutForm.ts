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
    StartCheckoutAction,
    checkoutSubmitted,
    ON_CHECKOUT_ACTION_NAME,
    PaymentRequestOptions,
} from '@casual-simulation/aux-common';
import { Prop, Watch } from 'vue-property-decorator';
import { loadStripe } from '../../shared/checkout/utils';
import { remote } from '@casual-simulation/causal-trees';

@Component({})
export default class CheckoutForm extends Vue {
    @Prop({ required: true }) channelId: string;
    @Prop({ required: true }) productId: string;
    @Prop({ required: true }) title: string;
    @Prop({ required: true }) description: string;
    @Prop({ required: true }) requestBillingAddress: boolean;
    @Prop() paymentRequest: PaymentRequestOptions;
    @Prop({ required: true }) processingUniverse: string;
    @Prop({ required: true }) publishableKey: string;

    billingName: string = '';
    billingEmail: string = '';
    billingAddress: string = '';
    billingCity: string = '';
    billingState: string = '';
    billingZip: string = '';
    billingCountry: string = 'US';

    billingNameError: string = null;
    billingEmailError: string = null;
    billingAddressError: string = null;
    billingCityError: string = null;
    billingStateError: string = null;
    billingZipError: string = null;
    billingCountryError: string = null;

    checkingOut: boolean = false;
    showCheckoutDialog: boolean = false;
    cardError: string = '';
    genericError: string = '';

    valid: boolean = false;
    submitted: boolean = false;
    hasPaymentRequestButton: boolean = false;

    private _stripe: stripe.Stripe;
    private _paymentRequest: stripe.paymentRequest.StripePaymentRequest;
    private _paymentRequestButton: stripe.elements.Element;
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

    cancelCheckout() {
        this.$emit('paymentCanceled');
    }

    async submitCheckout() {
        this.submitted = true;
        this._validateForm();
        if (!this.valid) {
            return;
        }

        this.checkingOut = true;
        const productId = this.productId;
        const processingUniverse = this.processingUniverse;
        const result = await this._stripe.createToken(
            this._card,
            this.requestBillingAddress
                ? {
                      name: this.billingName,
                      address_line1: this.billingAddress,
                      address_city: this.billingCity,
                      address_state: this.billingState,
                      address_country: this.billingCountry,
                      address_zip: this.billingZip,
                  }
                : undefined
        );

        if (result.error) {
            this.cardError = result.error.message;
            this.checkingOut = false;
        } else {
            this.cardError = null;

            try {
                await this._sendTokenToServer(
                    result,
                    productId,
                    processingUniverse
                );
            } catch (err) {
                this.checkingOut = false;
                console.error(err);
                this.genericError = 'An error occurred while checking out.';
            }
        }
    }

    private _validateForm() {
        if (this.requestBillingAddress) {
            let valid = true;
            valid = this.validateName(valid);
            valid = this.validateEmail(valid);
            valid = this.validateAddress(valid);
            valid = this.validateCity(valid);
            valid = this.validateState(valid);
            valid = this.validateZip(valid);
            valid = this.validateCountry(valid);

            this.valid = valid;
        } else {
            this.valid = true;
        }
    }

    validateCountry(valid: boolean = true) {
        if (!this.billingCountry) {
            this.billingCountryError = 'Please provide your country.';
            valid = false;
        } else {
            this.billingCountryError = null;
        }
        return valid;
    }

    validateZip(valid: boolean = true) {
        if (!this.billingZip) {
            this.billingZipError = 'Please provide your zip code.';
            valid = false;
        } else {
            this.billingZipError = null;
        }
        return valid;
    }

    validateState(valid: boolean = true) {
        if (!this.billingState) {
            this.billingStateError = 'Please provide your state.';
            valid = false;
        } else {
            this.billingStateError = null;
        }
        return valid;
    }

    validateCity(valid: boolean = true) {
        if (!this.billingCity) {
            this.billingCityError = 'Please provide your city.';
            valid = false;
        } else {
            this.billingCityError = null;
        }
        return valid;
    }

    validateAddress(valid: boolean = true) {
        if (!this.billingAddress) {
            this.billingAddressError = 'Please provide your address.';
            valid = false;
        } else {
            this.billingAddressError = null;
        }
        return valid;
    }

    validateEmail(valid: boolean = true) {
        if (!this.billingEmail) {
            this.billingEmailError = 'Please provide your email.';
            valid = false;
        } else {
            const indexOfAt = this.billingEmail.indexOf('@');
            if (indexOfAt < 0 || indexOfAt >= this.billingEmail.length) {
                this.billingEmailError = 'Please provide a valid email.';
                valid = false;
            } else {
                this.billingEmailError = null;
            }
        }
        return valid;
    }

    @Watch('billingName')
    nameChanged() {
        this.validateName();
    }

    @Watch('billingEmail')
    emailChanged() {
        this.validateEmail();
    }

    @Watch('billingZip')
    zipChanged() {
        this.validateZip();
    }

    @Watch('billingState')
    stateChanged() {
        this.validateState();
    }

    @Watch('billingAddress')
    addressChanged() {
        this.validateAddress();
    }

    @Watch('billingCity')
    cityChanged() {
        this.validateCity();
    }

    @Watch('billingCountry')
    countryChanged() {
        this.validateCountry();
    }

    validateName(valid: boolean = true) {
        if (!this.billingName) {
            this.billingNameError = 'Please provide your name.';
            valid = false;
        } else {
            this.billingNameError = null;
        }
        return valid;
    }

    private async _initForm() {
        const key = this.publishableKey;
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

            this._card = elements.create('card', {
                classes: {
                    base: 'card-element',
                },
            });

            this._card.on('change', e => {
                if (e.error) {
                    this.cardError = e.error.message;
                } else {
                    this.cardError = null;
                }
            });

            this._card.mount(this.$refs.paymentCard);

            if (this.paymentRequest) {
                const request = this.requestBillingAddress;
                this._paymentRequest = this._stripe.paymentRequest({
                    ...this.paymentRequest,
                    requestPayerEmail: request,
                    requestPayerName: request,
                    requestPayerPhone: request,
                });

                this._paymentRequestButton = elements.create(
                    'paymentRequestButton',
                    {
                        paymentRequest: this._paymentRequest,
                    }
                );

                const canMakePayment = await this._paymentRequest.canMakePayment();
                this.hasPaymentRequestButton = !!canMakePayment;
                if (canMakePayment) {
                    this._paymentRequestButton.mount(
                        this.$refs.paymentRequestButton
                    );
                }

                this._paymentRequest.on('token', async token => {
                    this.checkingOut = true;
                    try {
                        await this._sendTokenToServer(
                            token,
                            this.productId,
                            this.processingUniverse
                        );
                        token.complete('success');
                    } catch (err) {
                        this.checkingOut = false;
                        console.error(err);
                        this.genericError =
                            'An error occurred while checking out.';
                        token.complete('fail');
                    }
                });
            }
        }
    }

    private async _sendTokenToServer(
        result: stripe.TokenResponse,
        productId: string,
        processingUniverse: string
    ) {
        const token = result.token.id;
        await this._checkoutSim.helper.action(ON_CHECKOUT_ACTION_NAME, null, {
            productId: productId,
            token: token,
        });
        await this._checkoutSim.helper.transaction(
            remote(checkoutSubmitted(productId, token, processingUniverse))
        );
        this.$emit('paymentSuccess');
    }
}
