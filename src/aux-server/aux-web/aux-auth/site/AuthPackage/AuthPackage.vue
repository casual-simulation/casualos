<template>
    <div class="package-container">
        <md-card>
            <md-card-header>
                <div class="md-title">{{ pkg.address }}</div>
            </md-card-header>

            <md-card-content>
                <md-list>
                    <md-list-item>
                        <md-icon>info</md-icon>
                        <span class="md-list-item-text"
                            >Target Resource Kind: {{ webhook.targetResourceKind }}</span
                        >
                    </md-list-item>
                    <md-list-item>
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
                    </md-list-item>
                    <md-list-item>
                        <md-icon>info</md-icon>
                        <span class="md-list-item-text">URL: {{ getWebhookUrl(webhook) }}</span>
                    </md-list-item>
                </md-list>
            </md-card-content>
        </md-card>

        <md-table
            class="package-versions-table"
            v-model="items.mdData"
            md-card
            md-fixed-header
            @md-selected="onSelectItem"
        >
            <md-table-toolbar>
                <h1 class="md-title">{{ webhook.address }} Versions</h1>
            </md-table-toolbar>

            <md-table-empty-state
                md-label="No versions found"
                :md-description="`No versions found for this package.`"
            >
            </md-table-empty-state>

            <template v-slot:md-table-row="{ item }">
                <md-table-row md-selectable="single">
                    <md-table-cell md-label="ID" md-sort-by="id">{{
                        item.id.substring(0, 8)
                    }}</md-table-cell>
                    <md-table-cell md-label="Key" md-sort-by="key">
                        <span>{{ formatKey(item.key) }}</span>
                    </md-table-cell>
                    <md-table-cell md-label="Size" md-sort-by="sizeInBytes">
                        <span>{{ item.sizeInBytes }}</span>
                    </md-table-cell>
                    <md-table-cell md-label="Created" md-sort-by="createdAtMs">
                        <relative-time :millis="item.createdAtMs"></relative-time>
                    </md-table-cell>
                    <md-table-cell md-label="SHA-256" md-sort-by="sha256">
                        <span>{{ item.sha256.substring(0, 8) }}</span>
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

        <package-version v-if="selectedItem" :version="selectedItem" />
    </div>
</template>
<script src="./AuthPackage.ts"></script>
<style src="./AuthPackage.css" scoped></style>
