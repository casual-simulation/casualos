<template>
    <div class="notification-container">
        <md-card>
            <md-card-header>
                <div class="md-title">{{ notification.address }}</div>
            </md-card-header>

            <md-card-content>
                <md-list>
                    <md-list-item>
                        <md-icon>info</md-icon>
                        <span class="md-list-item-text"
                            >Description: {{ notification.description }}</span
                        >
                    </md-list-item>
                </md-list>
            </md-card-content>
        </md-card>

        <md-table
            class="notification-subscriptions-table"
            v-model="subscriptions.mdData"
            md-card
            md-fixed-header
            @md-selected="onSelectSubscription"
        >
            <md-table-toolbar>
                <h1 class="md-title">{{ notification.address }} Subscriptions</h1>
            </md-table-toolbar>

            <md-table-empty-state
                md-label="No subscriptions found"
                :md-description="`No subscriptions found for this notification.`"
            >
            </md-table-empty-state>

            <md-table-row slot="md-table-row" slot-scope="{ item }" md-selectable="single">
                <md-table-cell md-label="ID" md-sort-by="id">{{ item.id }}</md-table-cell>
                <md-table-cell md-label="User ID" md-sort-by="userId">{{
                    item.userId || '(null)'
                }}</md-table-cell>
                <md-table-cell md-label="Push Subscription ID" md-sort-by="pushSubscriptionId">{{
                    item.pushSubscriptionId || '(null)'
                }}</md-table-cell>
            </md-table-row>
        </md-table>
    </div>
</template>
<script src="./AuthNotification.ts"></script>
<style src="./AuthNotification.css" scoped></style>
