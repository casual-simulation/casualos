<template>
    <div>
        <md-table
            v-if="resourceKind && resourceId"
            v-model="resourceItems.mdData"
            class="permissions-table"
            md-card
            md-fixed-header
        >
            <md-table-toolbar>
                <h2 class="md-title">{{ resourceKind + '.' + resourceId }} Permissions</h2>
            </md-table-toolbar>

            <md-table-empty-state
                md-label="No permissions found"
                :md-description="`No permissions found for this query.`"
            >
            </md-table-empty-state>

            <md-table-row slot="md-table-row" slot-scope="{ item }">
                <md-table-cell md-label="ID" md-sort-by="id">{{ item.id }}</md-table-cell>
                <md-table-cell md-label="Resource Kind" md-sort-by="resourceKind">{{
                    item.resourceKind || '(any resource kind)'
                }}</md-table-cell>
                <md-table-cell md-label="Action" md-sort-by="action">{{
                    item.action || '(any action)'
                }}</md-table-cell>
                <md-table-cell md-label="Subject Type" md-sort-by="subjectType">{{
                    item.subjectType
                }}</md-table-cell>
                <md-table-cell md-label="Subject ID" md-sort-by="subjectId">{{
                    item.subjectId
                }}</md-table-cell>
                <!-- <md-table-cell md-label="Options">
                    <md-menu md-align-trigger>
                        <md-button md-menu-trigger class="md-icon-button">
                            <md-icon>more_vert</md-icon>
                            <span class="sr-only">Item Options</span>
                            <md-tooltip>Item Options</md-tooltip>
                        </md-button>
                        <md-menu-content>
                            <md-menu-item @click="deleteItem(item)">Delete Item</md-menu-item>
                        </md-menu-content>
                    </md-menu>
                </md-table-cell> -->
            </md-table-row>
        </md-table>

        <md-table
            v-if="marker"
            v-model="markerItems.mdData"
            class="permissions-table"
            md-card
            md-fixed-header
        >
            <md-table-toolbar>
                <h2 class="md-title">{{ marker }} Permissions</h2>
            </md-table-toolbar>

            <md-table-empty-state
                md-label="No permissions found"
                :md-description="`No permissions found for this query.`"
            >
            </md-table-empty-state>

            <md-table-row slot="md-table-row" slot-scope="{ item }">
                <md-table-cell md-label="ID" md-sort-by="id">{{ item.id }}</md-table-cell>
                <md-table-cell md-label="Resource Kind" md-sort-by="resourceKind">{{
                    item.resourceKind || '(any resource kind)'
                }}</md-table-cell>
                <md-table-cell md-label="Action" md-sort-by="action">{{
                    item.action || '(any action)'
                }}</md-table-cell>
                <md-table-cell md-label="Subject Type" md-sort-by="subjectType">{{
                    item.subjectType
                }}</md-table-cell>
                <md-table-cell md-label="Subject ID" md-sort-by="subjectId">{{
                    item.subjectId
                }}</md-table-cell>
                <!-- <md-table-cell md-label="Options">
                    <md-menu md-align-trigger>
                        <md-button md-menu-trigger class="md-icon-button">
                            <md-icon>more_vert</md-icon>
                            <span class="sr-only">Item Options</span>
                            <md-tooltip>Item Options</md-tooltip>
                        </md-button>
                        <md-menu-content>
                            <md-menu-item @click="deleteItem(item)">Delete Item</md-menu-item>
                        </md-menu-content>
                    </md-menu>
                </md-table-cell> -->
            </md-table-row>
        </md-table>
    </div>
</template>
<script src="./AuthPermissions.ts"></script>
<style src="./AuthPermissions.css" scoped></style>
