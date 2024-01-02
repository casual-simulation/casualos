import {
    AppMetadata,
    UserMetadata,
} from '../../../../aux-backend/shared/AuthMetadata';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Prop, Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { Subscription } from 'rxjs';
import { debounce, sortBy } from 'lodash';
import { tap } from 'rxjs/operators';
import type { ListedSession } from '@casual-simulation/aux-records/AuthController';
import type {
    PurchasableSubscription,
    SubscriptionStatus,
} from '@casual-simulation/aux-records/SubscriptionController';
import RelativeTime from '../RelativeTime/RelativeTime';
import { DateTime } from 'luxon';

declare const ASSUME_SUBSCRIPTIONS_SUPPORTED: boolean;

@Component({
    components: {
        'relative-time': RelativeTime,
    },
})
export default class AuthSubscription extends Vue {
    private _sub: Subscription;

    @Prop({ required: false })
    studioId: string;

    subscriptions: SubscriptionStatus[] = [];
    purchasableSubscriptions: PurchasableSubscription[] = [];
    loading: boolean = false;

    maybeSupported: boolean = false;

    @Watch('studioId')
    studioIdChanged() {
        this._loadSubscriptions();
    }

    created() {
        this.maybeSupported = ASSUME_SUBSCRIPTIONS_SUPPORTED;
        this.loading = false;
        this.subscriptions = [];
    }

    mounted() {
        if (this.maybeSupported) {
            this._sub = authManager.loginState
                .pipe(
                    tap((state) => {
                        if (state) {
                            this._loadSubscriptions();
                        }
                    })
                )
                .subscribe();
        }
    }

    beforeDestroy() {
        this._sub?.unsubscribe();
    }

    async manageSubscription() {
        if (this.studioId) {
            await authManager.manageSubscriptionsV2({
                studioId: this.studioId,
            });
        } else {
            await authManager.manageSubscriptions();
        }
    }

    async subscribe(
        subscriptionId: string,
        expectedPrice: PurchasableSubscription['prices'][0]
    ) {
        if (this.studioId) {
            await authManager.manageSubscriptionsV2({
                studioId: this.studioId,
                subscriptionId,
                expectedPrice,
            });
        } else {
            await authManager.manageSubscriptions({
                subscriptionId,
                expectedPrice,
            });
        }
    }

    getSubscriptionPrice(sub: SubscriptionStatus): string {
        const priceFormat = new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: sub.currency,
        });

        const cost = priceFormat.format(sub.intervalCost / 100);

        return cost; //`${cost} / ${sub.renewalInterval}`;
    }

    formatPrice(price: number, currency: string): string {
        const priceFormat = new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currency,
        });

        const cost = priceFormat.format(price / 100);

        return cost; //`${cost} / ${sub.renewalInterval}`;
    }

    private async _loadSubscriptions() {
        this.loading = true;
        try {
            const result = await (this.studioId
                ? authManager.listSubscriptionsV2({ studioId: this.studioId })
                : authManager.listSubscriptions());
            if (!result) {
                this.maybeSupported = false;
                this.subscriptions = [];
                this.purchasableSubscriptions = [];
            } else {
                this.subscriptions = result.subscriptions;
                this.purchasableSubscriptions = result.purchasableSubscriptions;
            }
        } catch (err) {
            console.error(
                '[AuthSubscription] Unable to load subscriptions:',
                err
            );
            this.subscriptions = [];
            this.purchasableSubscriptions = [];
        } finally {
            this.loading = false;
        }
    }
}
