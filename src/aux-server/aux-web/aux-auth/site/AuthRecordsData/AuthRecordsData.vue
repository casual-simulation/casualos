<template>
    <div>
        <md-table v-model="items.mdData" md-card md-fixed-header>
            <md-table-toolbar>
                <h1 class="md-title">Data</h1>
            </md-table-toolbar>

            <md-table-empty-state
                md-label="No data found"
                :md-description="`No data found for this query.`"
            >
            </md-table-empty-state>

            <md-table-row slot="md-table-row" slot-scope="{ item }">
                <md-table-cell md-label="Address" md-sort-by="address">{{
                    item.address
                }}</md-table-cell>
                <md-table-cell md-label="Data" md-sort-by="data">{{ item.data }}</md-table-cell>
                <md-table-cell md-label="Markers" md-sort-by="markers">
                    <auth-marker
                        v-for="marker in item.markers"
                        :key="marker"
                        :marker="marker"
                    ></auth-marker>
                </md-table-cell>
            </md-table-row>

            <template v-slot:md-table-pagination>
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
<script src="./AuthRecordsData.ts"></script>
<style src="./AuthRecordsData.css" scoped></style>
