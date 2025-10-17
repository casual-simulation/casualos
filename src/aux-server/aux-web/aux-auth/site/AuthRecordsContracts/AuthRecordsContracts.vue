<template>
    <div>
        <md-table v-model="items.mdData" md-card md-fixed-header @md-selected="onItemClick">
            <md-table-toolbar>
                <h1 class="md-title">Contracts</h1>
            </md-table-toolbar>

            <md-table-empty-state
                md-label="No contracts found"
                :md-description="`No contracts found for this query.`"
            >
            </md-table-empty-state>

            <template v-slot:md-table-row="{ item }">
                <md-table-row md-selectable="single">
                    <md-table-cell md-label="ID" md-sort-by="id">{{ item.id }}</md-table-cell>
                    <md-table-cell md-label="Status" md-sort-by="status">{{
                        item.status
                    }}</md-table-cell>
                    <md-table-cell md-label="Issuer" md-sort-by="issuingUserId">{{
                        item.issuingUserId
                    }}</md-table-cell>
                    <md-table-cell md-label="Holder" md-sort-by="holdingUserId">{{
                        item.holdingUserId
                    }}</md-table-cell>
                    <md-table-cell md-label="Rate" md-sort-by="rate">{{ item.rate }}</md-table-cell>
                    <!-- <md-table-cell md-label="Balance" md-sort-by="initialValue">{{
                        item.
                    }}</md-table-cell> -->
                    <md-table-cell md-label="Markers" md-sort-by="markers">
                        <auth-marker
                            v-for="marker in item.markers"
                            :key="marker"
                            :marker="marker"
                            @click="onMarkerClick(marker)"
                        ></auth-marker>
                    </md-table-cell>
                    <md-table-cell md-label="Options">
                        <md-menu md-align-trigger>
                            <md-button md-menu-trigger class="md-icon-button">
                                <md-icon>more_vert</md-icon>
                                <span class="sr-only">Item Options</span>
                                <md-tooltip>Item Options</md-tooltip>
                            </md-button>
                            <md-menu-content>
                                <md-menu-item @click="deleteItem(item)"
                                    >Delete Contract</md-menu-item
                                >
                            </md-menu-content>
                        </md-menu>
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

        <auth-balances v-if="selectedItem" :contractId="selectedItem.id"></auth-balances>

        <auth-permissions
            :recordName="recordName"
            :marker="permissionsMarker"
            :resourceKind="permissionsResourceKind"
            :resourceId="permissionsResourceId"
        >
        </auth-permissions>
    </div>
</template>
<script src="./AuthRecordsContracts.ts"></script>
<style src="./AuthRecordsContracts.css" scoped></style>
