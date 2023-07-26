<template>
    <md-table v-model="items.mdData" md-card md-fixed-header>
        <md-table-toolbar>
            <h1 class="md-title">Role Assignments</h1>
        </md-table-toolbar>

        <md-table-empty-state
            md-label="No role assignments found"
            :md-description="`No role assignments found for this query.`"
        >
        </md-table-empty-state>

        <md-table-row slot="md-table-row" slot-scope="{ item }">
            <md-table-cell md-label="Role Name">{{ item.role.role }}</md-table-cell>
            <md-table-cell md-label="Kind">{{ item.type }}</md-table-cell>
            <md-table-cell md-label="Subject">{{ item.userId || item.inst }}</md-table-cell>
            <md-table-cell md-label="Expire Time">
                <span v-if="item.role.expireTimeMs === null">Never</span>
                <span v-else>Expires <relative-time :millis="item.role.expireTimeMs" /></span>
            </md-table-cell>
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
    </md-table>
</template>
<script src="./AuthRecordsRoles.ts"></script>
<style src="./AuthRecordsRoles.css" scoped></style>
