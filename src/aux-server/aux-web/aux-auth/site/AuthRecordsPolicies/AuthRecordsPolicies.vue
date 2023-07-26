<template>
    <div>
        <md-table v-model="items.mdData" md-card md-fixed-header @md-selected="onSelect">
            <md-table-toolbar>
                <h1 class="md-title">Policies</h1>
            </md-table-toolbar>

            <md-table-empty-state
                md-label="No policies found"
                :md-description="`No policies found for this query.`"
            >
            </md-table-empty-state>

            <md-table-row slot="md-table-row" slot-scope="{ item }" md-selectable="single">
                <md-table-cell md-label="Policy Name" md-sort-by="marker">
                    {{ item.marker }}
                </md-table-cell>
                <!-- <md-table-cell md-label="URL" md-sort-by="url">{{ item.url }}</md-table-cell> -->
                <md-table-cell md-label="Markers" md-sort-by="markers">
                    <auth-marker
                        v-for="marker in item.markers"
                        :key="marker"
                        :marker="marker"
                    ></auth-marker>
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

        <div v-if="selectedItem">
            <md-table class="permissions-table" md-card>
                <md-table-toolbar>
                    <h2 class="md-title">{{ selectedItem.marker }} permissions</h2>
                </md-table-toolbar>

                <md-table-row>
                    <md-table-head>Type</md-table-head>
                    <md-table-head>Role</md-table-head>
                    <md-table-head>Scope</md-table-head>
                </md-table-row>

                <md-table-row
                    v-for="(permission, index) in selectedItem.document.permissions"
                    :key="index"
                >
                    <md-table-cell>{{ permission.type }}</md-table-cell>
                    <md-table-cell>{{ permission.role }}</md-table-cell>
                    <md-table-cell>
                        <permission-scope :permission="permission" />
                    </md-table-cell>
                    <!-- <md-table-cell></md-table-cell> -->
                </md-table-row>
            </md-table>
        </div>
    </div>
</template>
<script src="./AuthRecordsPolicies.ts"></script>
<style src="./AuthRecordsPolicies.css" scoped></style>
