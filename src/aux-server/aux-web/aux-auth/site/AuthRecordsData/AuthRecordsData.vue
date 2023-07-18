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
                <md-table-cell md-label="Markers" md-sort-by="markers">{{
                    item.markers
                }}</md-table-cell>
            </md-table-row>

            <md-table-pagination
                :md-page-size="1"
                :md-page-options="[1]"
                :md-update="updatePagination"
                :md-data.sync="items"
            />
        </md-table>
    </div>
</template>
<script src="./AuthRecordsData.ts"></script>
<style src="./AuthRecordsData.css" scoped></style>
