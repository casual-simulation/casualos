<template>
    <div v-if="maybeSupported">
        <div class="subscription-title">
            <h2 class="md-title">Subscriptions</h2>
        </div>

        <div v-if="loading" class="subscriptions-loading">
            <div>
                <md-progress-spinner
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                ></md-progress-spinner>
            </div>
            <p class="sr-only">Loading Subscriptions...</p>
        </div>
        <div v-else>
            <div v-if="subscriptions.length > 0" class="subscriptions-list">
                <md-table>
                    <md-table-row>
                        <md-table-head>Product</md-table-head>
                        <md-table-head>Cost</md-table-head>
                        <md-table-head>Status</md-table-head>
                    </md-table-row>

                    <md-table-row v-for="subscription of subscriptions" :key="subscription.id">
                        <md-table-cell>{{ subscription.productName }}</md-table-cell>
                        <md-table-cell>{{ getSubscriptionPrice(subscription) }}</md-table-cell>
                        <md-table-cell>
                            <span v-if="subscription.canceledDate">
                                Canceled <relative-time :seconds="subscription.canceledDate" />
                            </span>
                            <span v-else-if="subscription.cancelDate">
                                Cancels <relative-time :seconds="subscription.cancelDate" />
                            </span>
                            <span v-else-if="subscription.endedDate">
                                Ends <relative-time :seconds="subscription.endedDate" />
                            </span>
                            <span v-else-if="subscription.currentPeriodEnd">
                                Renews <relative-time :seconds="subscription.currentPeriodEnd" />
                            </span>
                            <!-- <span v-if="session.revokeTimeMs"
                                >Revoked <relative-time :millis="session.revokeTimeMs"
                            /></span>
                            <span v-else>Expires <relative-time :millis="session.expireTimeMs" /></span> -->
                        </md-table-cell>
                        <md-table-cell>
                            <md-button @click="manageSubscription">Manage</md-button>
                            <!-- <md-menu md-align-trigger>
                                <md-button
                                    md-menu-trigger
                                    class="md-icon-button"
                                >
                                    <md-icon>more_vert</md-icon>
                                    <span class="sr-only">Subscription Options</span>
                                    <md-tooltip>Subscription Options</md-tooltip>
                                </md-button>
                                <md-menu-content>
                                    <md-menu-item 
                                        >Manage Subscription</md-menu-item
                                    >
                                </md-menu-content>
                            </md-menu> -->
                        </md-table-cell>
                    </md-table-row>
                </md-table>
            </div>
            <div v-else class="add-subscription">
                <md-button @click="manageSubscription" class="md-flat md-primary"
                    >Add Subscription</md-button
                >
            </div>
        </div>

        <!-- <div>
            <md-table>
                <md-table-row>
                    <md-table-head>ID</md-table-head>
                    <md-table-head>Location</md-table-head>
                    <md-table-head>Status</md-table-head>
                    <md-table-head>Granted</md-table-head>
                </md-table-row>

                <md-table-row v-for="session of sessions" :key="session.sessionId">
                    <md-table-cell>{{ session.sessionId.substring(0, 8) }}</md-table-cell>
                    <md-table-cell><session-location :session="session" /></md-table-cell>
                    <md-table-cell>
                        <span v-if="session.revokeTimeMs"
                            >Revoked <relative-time :millis="session.revokeTimeMs"
                        /></span>
                        <span v-else>Expires <relative-time :millis="session.expireTimeMs" /></span>
                    </md-table-cell>
                    <md-table-cell><relative-time :millis="session.grantedTimeMs" /></md-table-cell>
                    <md-table-cell>
                        <md-menu md-align-trigger>
                            <md-button
                                v-if="!session.revokeTimeMs"
                                md-menu-trigger
                                class="md-icon-button"
                            >
                                <md-icon>more_vert</md-icon>
                                <span class="sr-only">Session Options</span>
                                <md-tooltip>Session Options</md-tooltip>
                            </md-button>
                            <md-menu-content>
                                <md-menu-item @click="revokeSession(session)"
                                    >Revoke Session</md-menu-item
                                >
                            </md-menu-content>
                        </md-menu>
                    </md-table-cell>
                </md-table-row>
            </md-table>
        </div> -->

        <!-- <md-dialog-confirm
            :md-active.sync="showConfirmRevokeAllSessions"
            md-title="Revoke All Sessions?"
            md-content="Are you sure you want to revoke all of the active sessions? This will log you out everywhere."
            md-confirm-text="Revoke"
            md-cancel-text="Cancel"
            @md-cancel="cancelRevokeAllSessions"
            @md-confirm="revokeAllSessions"
        /> -->
    </div>
</template>
<script src="./AuthSubscription.ts"></script>
<style src="./AuthSubscription.css" scoped></style>
