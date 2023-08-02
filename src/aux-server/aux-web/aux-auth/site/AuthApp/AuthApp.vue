<template>
    <div id="app">
        <md-app>
            <md-app-toolbar>
                <a class="title-link md-title" href="/" style="flex: 1">
                    <svg-icon name="PersonPinCircle" class="title-img"></svg-icon>
                    <strong>{{ title }}</strong>
                </a>
                <md-button v-if="showLogout" @click="logout">Logout</md-button>
            </md-app-toolbar>
            <md-app-drawer v-if="showLogout" md-permanent="clipped">
                <md-list>
                    <md-list-item :to="{ name: 'home' }">
                        <md-icon>person</md-icon>
                        <span class="md-list-item-text">Account</span>
                    </md-list-item>
                    <md-list-item
                        md-expand
                        :md-expanded.sync="showRecords"
                        @click="onExpandRecords"
                    >
                        <md-icon>description</md-icon>
                        <span class="md-list-item-text">My Studio</span>

                        <md-list slot="md-expand">
                            <md-list-item
                                v-for="record in records"
                                :key="record.name"
                                class="md-inset"
                                :to="{ name: 'records-data', params: { recordName: record.name } }"
                            >
                                <md-icon>description</md-icon>
                                <span class="md-list-item-text">{{ record.label }}</span>
                            </md-list-item>
                            <md-list-item v-if="loadingRecords" class="md-inset">
                                <md-progress-spinner
                                    md-mode="indeterminate"
                                    :md-diameter="20"
                                    :md-stroke="2"
                                    >Loading...</md-progress-spinner
                                >
                            </md-list-item>
                            <md-list-item
                                v-else-if="!records || records.length === 0"
                                class="md-inset"
                            >
                                <strong class="md-list-item-text">No Records</strong>
                            </md-list-item>
                        </md-list>
                    </md-list-item>
                    <md-list-item
                        v-for="studio of studios"
                        :key="studio.studioId"
                        @click="onExpandStudio(studio)"
                        md-expand
                        :md-expanded.sync="studio.open"
                    >
                        <md-icon>description</md-icon>
                        <span class="md-list-item-text">{{ studio.displayName }}</span>

                        <md-list slot="md-expand">
                            <md-list-item
                                v-for="record in studio.records"
                                :key="record.name"
                                class="md-inset"
                                :to="{ name: 'records-data', params: { recordName: record.name } }"
                            >
                                <md-icon>description</md-icon>
                                <span class="md-list-item-text">{{ record.label }}</span>
                            </md-list-item>
                            <md-list-item v-if="studio.loading" class="md-inset">
                                <md-progress-spinner
                                    md-mode="indeterminate"
                                    :md-diameter="20"
                                    :md-stroke="2"
                                    >Loading...</md-progress-spinner
                                >
                            </md-list-item>
                            <md-list-item
                                v-else-if="!studio.records || studio.records.length === 0"
                                class="md-inset"
                            >
                                <strong class="md-list-item-text">No Records</strong>
                            </md-list-item>
                        </md-list>
                    </md-list-item>
                    <md-list-item>
                        <md-button class="md-raised md-primary" @click="startCreateStudio()"
                            >Create Studio</md-button
                        >
                    </md-list-item>
                </md-list>
            </md-app-drawer>
            <md-app-content>
                <router-view></router-view>
            </md-app-content>
        </md-app>

        <md-dialog :md-active.sync="showCreateStudio">
            <md-dialog-title>Create Studio</md-dialog-title>

            <md-dialog-content>
                <md-field>
                    <label>Studio Name</label>
                    <md-input v-model="studioName"></md-input>
                </md-field>
            </md-dialog-content>

            <md-dialog-actions>
                <md-button @click="createStudio()">Create</md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./AuthApp.ts"></script>
<style src="./AuthApp.css"></style>
