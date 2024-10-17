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
                    <!-- <md-list-item>
                        <md-icon>info</md-icon>
                        <span class="md-list-item-text"
                            >Target Record Name: {{ webhook.targetRecordName }}</span
                        >
                    </md-list-item>
                    <md-list-item>
                        <md-icon>info</md-icon>
                        <span class="md-list-item-text"
                            >Target Address: {{ webhook.targetAddress }}</span
                        >
                    </md-list-item>
                    <md-list-item>
                        <md-icon>info</md-icon>
                        <span class="md-list-item-text"
                            >User ID: {{ webhook.userId || '(null)' }}</span
                        >
                    </md-list-item> -->
                    <!-- <md-list-item>
                        <md-icon>info</md-icon>
                        <span class="md-list-item-text">URL: {{ getWebhookUrl(webhook) }}</span>
                    </md-list-item> -->
                </md-list>
            </md-card-content>
        </md-card>

        <!-- <md-table
            class="webhook-runs-table"
            v-model="items.mdData"
            md-card
            md-fixed-header
            @md-selected="onSelectItem"
        >
            <md-table-toolbar>
                <h1 class="md-title">{{ webhook.address }} Runs</h1>
            </md-table-toolbar>

            <md-table-empty-state
                md-label="No runs found"
                :md-description="`No runs found for this webhook.`"
            >
            </md-table-empty-state>

            <md-table-row slot="md-table-row" slot-scope="{ item }" md-selectable="single">
                <md-table-cell md-label="ID" md-sort-by="runId">{{
                    item.runId.substring(0, 8)
                }}</md-table-cell>
                <md-table-cell md-label="Request Time" md-sort-by="requestTimeMs">
                    <relative-time :millis="item.requestTimeMs"></relative-time>
                </md-table-cell>
                <md-table-cell md-label="Response Time" md-sort-by="responseTimeMs">
                    <relative-time :millis="item.responseTimeMs"></relative-time>
                </md-table-cell>
                <md-table-cell md-label="Status Code" md-sort-by="statusCode">{{
                    item.statusCode
                }}</md-table-cell>
            </md-table-row>

            <template v-slot:md-table-pagination v-if="items.mdData.length > 0">
                <div class="md-table-pagination">
                    <span>{{ items.startIndex }}-{{ items.endIndex }} of {{ items.mdCount }}</span>

                    <md-button
                        class="md-icon-button md-table-pagination-previous"
                        @click="changePage(-1)"
                        :disabled="items.mdPage === 1"
                    >
                        <md-icon>keyboard_arrow_left</md-icon>
                    </md-button>

                    <md-button
                        class="md-icon-button md-table-pagination-next"
                        @click="changePage(+1)"
                        :disabled="items.endIndex + 1 >= items.mdCount"
                    >
                        <md-icon>keyboard_arrow_right</md-icon>
                    </md-button>
                </div>
            </template>
        </md-table> -->

        <!-- <webhook-run v-if="selectedItem" :run="selectedItem" /> -->
    </div>
</template>
<script src="./AuthNotification.ts"></script>
<style src="./AuthNotification.css" scoped></style>
