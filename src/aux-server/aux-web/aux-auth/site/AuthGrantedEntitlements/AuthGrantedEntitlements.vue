<template>
    <div class="package-container">
        <md-table
            class="package-versions-table"
            v-model="items.mdData"
            md-card
            md-fixed-header
            @md-selected="onSelectItem"
        >
            <md-table-toolbar>
                <h1 class="md-title">Granted Entitlements</h1>
            </md-table-toolbar>

            <md-table-empty-state
                md-label="No granted entitlements"
                :md-description="`You have not granted any entitlements yet.`"
            >
            </md-table-empty-state>

            <template v-slot:md-table-row="{ item }">
                <md-table-row md-selectable="single">
                    <md-table-cell md-label="ID" md-sort-by="id">
                        <span>{{ item.id.substring(0, 8) }}</span>
                        <md-tooltip md-direction="bottom">
                            {{ item.id }}
                        </md-tooltip>
                    </md-table-cell>
                    <md-table-cell md-label="Package ID" md-sort-by="packageId">
                        <span>{{ item.packageId.substring(0, 8) }}</span>
                        <md-tooltip md-direction="bottom">
                            {{ item.packageId }}
                        </md-tooltip>
                    </md-table-cell>
                    <md-table-cell md-label="Record Name" md-sort-by="recordName">
                        <span>{{ recordNameForGrant(item) }}</span>
                        <md-tooltip md-direction="bottom">
                            {{ item.recordName }}
                        </md-tooltip>
                    </md-table-cell>
                    <md-table-cell md-label="Feature" md-sort-by="feature">
                        <span>{{ item.feature }}</span>
                    </md-table-cell>
                    <md-table-cell md-label="Expires" md-sort-by="expireTimeMs">
                        <relative-time :millis="item.expireTimeMs"></relative-time>
                    </md-table-cell>
                    <md-table-cell md-label="Granted" md-sort-by="createdAtMs">
                        <relative-time :millis="item.createdAtMs"></relative-time>
                    </md-table-cell>
                </md-table-row>
            </template>

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
        </md-table>
    </div>
</template>
<script src="./AuthGrantedEntitlements.ts"></script>
<style src="./AuthGrantedEntitlements.css" scoped></style>
