<template>
    <div>
        <md-table v-model="items.mdData" md-card md-fixed-header @md-selected="onItemClick">
            <md-table-toolbar>
                <h1 class="md-title">Insts</h1>
            </md-table-toolbar>

            <md-table-empty-state
                md-label="No insts found"
                :md-description="`No insts found for this query.`"
            >
            </md-table-empty-state>

            <template v-slot:md-table-row="{ item }">
                <md-table-row md-selectable="single">
                    <md-table-cell md-label="Name" md-sort-by="inst"
                        ><a target="_blank" :href="getInstUrl(item)">{{
                            item.inst
                        }}</a></md-table-cell
                    >
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
                                <span class="sr-only">Inst Options</span>
                                <md-tooltip>Inst Options</md-tooltip>
                            </md-button>
                            <md-menu-content>
                                <md-menu-item @click="deleteInst(item)">Delete Inst</md-menu-item>
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

        <auth-permissions
            :recordName="recordName"
            :marker="permissionsMarker"
            :resourceKind="permissionsResourceKind"
            :resourceId="permissionsResourceId"
        >
        </auth-permissions>
    </div>
</template>
<script src="./AuthRecordsInsts.ts"></script>
<style src="./AuthRecordsInsts.css" scoped></style>
