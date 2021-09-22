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
    PaymentRequestOptions,
} from '@casual-simulation/aux-common';
import CheckoutForm from '../CheckoutForm/CheckoutForm';
import { loadStripe } from '../../shared/checkout/utils';

@Component({
    components: {
        'checkout-form': CheckoutForm,
    },
})
export default class Checkout extends Vue {
    showCheckoutDialog: boolean = false;
    cardError: string = '';
    simulationId: string = null;
    productId: string = null;
    processingServer: string = null;
    title: string = '';
    description: string = '';
    requestBillingAddress: boolean = false;
    paymentRequest: PaymentRequestOptions = null;
    publishableKey: string = null;

    private _subs: SubscriptionLike[] = [];
    private _simulationSubs: Map<Simulation, SubscriptionLike[]>;

    created() {
        this._subs = [];
        this._simulationSubs = new Map();

        this._subs.push(
            appManager.simulationManager.simulationAdded
                .pipe(tap((sim) => this._simulationAdded(sim)))
                .subscribe(),
            appManager.simulationManager.simulationRemoved
                .pipe(tap((sim) => this._simulationRemoved(sim)))
                .subscribe()
        );
    }

    beforeDestroy() {
        for (let sub of this._subs) {
            sub.unsubscribe();
        }
    }

    checkoutFinished() {
        this.closeCheckoutDialog();
    }

    checkoutCanceled() {
        this.closeCheckoutDialog();
    }

    closeCheckoutDialog() {
        this.showCheckoutDialog = false;
    }

    private _simulationAdded(sim: BrowserSimulation): void {
        let subs: SubscriptionLike[] = [];

        subs.push(
            sim.localEvents.subscribe((e) => {
                if (e.type === 'start_checkout') {
                    this._startCheckout(sim, e);
                }
            })
        );
        this._simulationSubs.set(sim, subs);
    }

    private _simulationRemoved(sim: BrowserSimulation): void {
        const subs = this._simulationSubs.get(sim);
        if (subs) {
            subs.forEach((s) => {
                s.unsubscribe();
            });
        }
        this._simulationSubs.delete(sim);
    }

    private async _startCheckout(sim: Simulation, event: StartCheckoutAction) {
        loadStripe();

        this.showCheckoutDialog = true;
        this.simulationId = sim.id;
        this.description = event.description;
        this.title = event.title;
        this.requestBillingAddress = event.requestBillingAddress || false;
        this.productId = event.productId;
        this.processingServer = event.processingInst;
        this.paymentRequest = event.paymentRequest;
        this.publishableKey = event.publishableKey;
    }
}
