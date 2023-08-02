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
                            <md-list-item v-if="!records || records.length === 0" class="md-inset">
                                <strong class="md-list-item-text">No Records</strong>
                            </md-list-item>
                            <md-list-item v-if="loadingRecords" class="md-inset">
                                <md-progress-spinner
                                    md-mode="indeterminate"
                                    :md-diameter="20"
                                    :md-stroke="2"
                                    >Loading...</md-progress-spinner
                                >
                            </md-list-item>
                        </md-list>
                    </md-list-item>
                </md-list>
            </md-app-drawer>
            <md-app-content>
                <router-view></router-view>
            </md-app-content>
        </md-app>
    </div>
</template>
<script src="./AuthApp.ts"></script>
<style src="./AuthApp.css"></style>
