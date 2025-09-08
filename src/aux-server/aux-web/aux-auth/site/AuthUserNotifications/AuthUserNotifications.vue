<template>
    <div>
        <md-table
            v-model="subscriptions.mdData"
            md-card
            md-fixed-header
            @md-selected="onSelectSubscription"
        >
            <md-table-toolbar>
                <h1 class="md-title">My Notification Subscriptions</h1>
            </md-table-toolbar>

            <md-table-empty-state
                md-label="No notification subscriptions found"
                :md-description="`You have no active notification subscriptions.`"
            >
            </md-table-empty-state>

            <template v-slot:md-table-row="{ item }">
                <md-table-row md-selectable="single">
                    <md-table-cell md-label="Record" md-sort-by="recordName">{{
                        item.recordName
                    }}</md-table-cell>
                    <md-table-cell
                        md-label="Notification Address"
                        md-sort-by="notificationAddress"
                        >{{ item.notificationAddress }}</md-table-cell
                    >
                    <md-table-cell md-label="Actions">
                        <md-button class="md-raised md-accent" @click="unsubscribe(item)">
                            Unsubscribe
                        </md-button>
                    </md-table-cell>
                </md-table-row>
            </template>

            <template v-slot:md-table-pagination v-if="subscriptions.mdData.length > 0">
                <div class="md-table-pagination">
                    <span
                        >{{ subscriptions.startIndex }}-{{ subscriptions.endIndex }} of
                        {{ subscriptions.mdCount }}</span
                    >

                    <md-button
                        class="md-icon-button md-table-pagination-previous"
                        :disabled="subscriptions.mdPage <= 1"
                        @click="updatePagination(subscriptions.mdPage - 1, pageSize)"
                    >
                        <md-icon>keyboard_arrow_left</md-icon>
                    </md-button>

                    <md-button
                        class="md-icon-button md-table-pagination-next"
                        :disabled="subscriptions.endIndex >= subscriptions.mdCount"
                        @click="updatePagination(subscriptions.mdPage + 1, pageSize)"
                    >
                        <md-icon>keyboard_arrow_right</md-icon>
                    </md-button>
                </div>
            </template>
        </md-table>
    </div>
</template>

<script src="./AuthUserNotifications.ts"></script>
