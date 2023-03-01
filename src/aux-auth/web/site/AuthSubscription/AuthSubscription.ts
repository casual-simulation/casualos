import { AppMetadata, UserMetadata } from '../../../shared/AuthMetadata';
import Vue from 'vue';
import Component from 'vue-class-component';
import { Provide, Watch } from 'vue-property-decorator';
import { authManager } from '../../shared/index';
import { Subscription } from 'rxjs';
import { debounce, sortBy } from 'lodash';
import { tap } from 'rxjs/operators';
import type { ListedSession } from '@casual-simulation/aux-records/AuthController';
import type { SubscriptionStatus } from '@casual-simulation/aux-records/SubscriptionController';
import { DateTime } from 'luxon';
import SessionLocation from '../SessionLocation/SessionLocation';
import RelativeTime from '../RelativeTime/RelativeTime';
import { DateTime } from 'luxon';

declare const ASSUME_SUBSCRIPTIONS_SUPPORTED: boolean;

@Component({
    components: {
        'session-location': SessionLocation,
        'relative-time': RelativeTime,
    },
})
export default class AuthSecurity extends Vue {
    private _sub: Subscription;

    subscriptions: SubscriptionStatus[] = [];
    loading: boolean = false;

    maybeSupported: boolean = false;

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
        await authManager.manageSubscriptions();
    }

    getSubscriptionPrice(sub: SubscriptionStatus): string {
        const priceFormat = new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: sub.currency,
        });

        const cost = priceFormat.format(sub.intervalCost / 100);

        return `${cost} / ${sub.renewalInterval}`;
    }

    /**
     * Gets the human readable version of a date that is formatted in Unix time (in seconds).
     */
    getDate(date: number) {
        const dt = DateTime.fromSeconds(date);

        return `${dt.toLocaleString(DateTime.DATE_SHORT)}`;
    }

    private async _loadSubscriptions() {
        this.loading = true;
        try {
            const result = await authManager.listSubscriptions();
            if (!result) {
                this.maybeSupported = false;
                this.subscriptions = [];
            } else {
                this.subscriptions = result;
            }
        } catch (err) {
            console.error(
                '[AuthSubscription] Unable to load subscriptions:',
                err
            );
            this.subscriptions = [];
        } finally {
            this.loading = false;
        }
    }
}
