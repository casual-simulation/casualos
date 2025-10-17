<template>
    <div v-if="maybeSupported">
        <h2 class="md-title">Subscriptions</h2>
        <div v-if="loading" class="subscriptions-loading">
            <div>
                <md-progress-spinner
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                ></md-progress-spinner>
            </div>
            <p class="sr-only">Subscription Loading...</p>
        </div>
        <div v-else>
            <div v-if="subscriptions.length > 0" class="subscriptions-list">
                <md-card
                    v-for="subscription of subscriptions"
                    :key="subscription.id"
                    class="subscription-card"
                >
                    <md-card-header>
                        <h3 class="md-title">{{ subscription.productName }}</h3>
                    </md-card-header>

                    <md-card-content>
                        <div class="subscription-price">
                            <span class="price">{{ getSubscriptionPrice(subscription) }}</span>
                            <span class="period">per<br />{{ subscription.renewalInterval }}</span>
                        </div>
                        <div class="subscription-status">
                            <div
                                v-if="subscription.statusCode === 'canceled'"
                                class="status-indicator"
                            >
                                <div class="status canceled">Canceled</div>
                                <div class="time">
                                    <relative-time :seconds="subscription.canceledDate" />
                                </div>
                            </div>
                            <div
                                v-else-if="subscription.statusCode === 'incomplete'"
                                class="status-indicator"
                            >
                                <div class="status warn">Incomplete</div>
                                <div class="time">
                                    Your subscription was not able to be activated due to payment
                                    issues. Check your payment settings.
                                </div>
                            </div>
                            <div
                                v-else-if="subscription.statusCode === 'past_due'"
                                class="status-indicator"
                            >
                                <div class="status warn">Past Due</div>
                                <div class="time">
                                    Ends
                                    <relative-time
                                        :seconds="
                                            subscription.endedDate || subscription.currentPeriodEnd
                                        "
                                    />
                                </div>
                            </div>
                            <div
                                v-else-if="subscription.statusCode === 'active'"
                                class="status-indicator"
                            >
                                <div
                                    class="status"
                                    :class="{
                                        active: !subscription.canceledDate,
                                        warn: !!subscription.canceledDate,
                                    }"
                                >
                                    Active
                                </div>
                                <div class="time">
                                    <span v-if="subscription.canceledDate"> Ends </span>
                                    <span v-else> Renews </span>
                                    <relative-time :seconds="subscription.currentPeriodEnd" />
                                </div>
                            </div>
                            <div
                                v-else-if="subscription.statusCode === 'trialing'"
                                class="status-indicator"
                            >
                                <div
                                    class="status"
                                    :class="{
                                        active: !subscription.canceledDate,
                                        warn: !!subscription.canceledDate,
                                    }"
                                >
                                    Trial
                                </div>
                                <div class="time">
                                    <span v-if="subscription.canceledDate"> Ends </span>
                                    <span v-else> Subscription starts </span>
                                    <relative-time :seconds="subscription.currentPeriodEnd" />
                                </div>
                            </div>
                        </div>
                        <div
                            v-if="subscription.featureList && subscription.featureList.length > 0"
                            class="subscribe-features"
                        >
                            <div>This includes:</div>
                            <ul>
                                <li
                                    v-for="(feature, index) of subscription.featureList"
                                    :key="index"
                                >
                                    {{ feature }}
                                </li>
                            </ul>
                        </div>
                        <md-card-actions>
                            <md-button @click="manageSubscription" class="md-primary"
                                >Manage</md-button
                            >
                        </md-card-actions>
                    </md-card-content>
                </md-card>
            </div>
            <div v-else class="subscriptions-list">
                <div v-if="purchasableSubscriptions.length <= 0">
                    There are no purchasable subscriptions.
                </div>
                <md-card
                    v-for="subscription of purchasableSubscriptions"
                    :key="subscription.id"
                    class="subscription-card"
                >
                    <md-card-header>
                        <h3 class="md-title">{{ subscription.name }}</h3>
                    </md-card-header>

                    <md-card-content>
                        <div class="add-subscription">
                            <div class="subscription-hook">
                                {{ subscription.description }}
                            </div>
                            <div class="subscription-price" v-if="subscription.prices.length > 0">
                                <span class="price">{{
                                    formatPrice(
                                        subscription.prices[0].cost,
                                        subscription.prices[0].currency
                                    )
                                }}</span>
                                <span class="period"
                                    >per<br />{{ subscription.prices[0].interval }}</span
                                >
                            </div>
                            <div class="subscribe-features">
                                <div>This includes:</div>
                                <ul>
                                    <li
                                        v-for="(feature, index) of subscription.featureList"
                                        :key="index"
                                    >
                                        {{ feature }}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </md-card-content>

                    <md-card-actions>
                        <md-button
                            v-if="subscription.defaultSubscription"
                            class="md-primary"
                            disabled
                            >Active</md-button
                        >
                        <md-button
                            v-else-if="subscription.prices.length > 0"
                            @click="subscribe(subscription.id, subscription.prices[0])"
                            class="md-primary"
                            >Subscribe</md-button
                        >
                    </md-card-actions>
                </md-card>
            </div>

            <div v-if="accountBalances">
                <div v-if="accountBalances.usd">
                    <h3 class="md-subheading">USD Balance</h3>
                    <div class="account-balance">
                        {{ accountBalances.usd.credits - accountBalances.usd.debits }}
                    </div>
                </div>

                <div v-if="accountBalances.credits">
                    <h3 class="md-subheading">Credits Balance</h3>
                    <div class="account-balance">
                        {{ accountBalances.credits.credits - accountBalances.credits.debits }}
                    </div>
                </div>
            </div>

            <!-- <md-card v-else class="subscription-card">
                <md-card-header>
                    <h3 class="md-title">Beta Program</h3>
                </md-card-header>
                <md-card-content>
                    <div class="add-subscription">
                        <div class="subscription-hook">
                            Join the CasualOS Beta Program for early access to features and a
                            community of builders.
                        </div>
                        <div class="subscription-price">
                            <span class="price">$50</span>
                            <span class="period">per<br />month</span>
                        </div>
                        <div class="subscribe-button">
                            <md-button @click="manageSubscription" class="md-raised md-primary"
                                >Subscribe</md-button
                            >
                        </div>
                        <div class="subscribe-features">
                            <div>This includes:</div>
                            <ul>
                                <li>Access to casualos.com</li>
                                <li>Use GPT-3 to Build (OpenAI API key not included)</li>
                                <li>Unlimited ABs</li>
                            </ul>
                        </div>
                    </div>
                </md-card-content>
            </md-card> -->
        </div>
    </div>
</template>
<script src="./AuthSubscription.ts"></script>
<style src="./AuthSubscription.css" scoped></style>
