<!-- App.vue -->
<template>
    <div id="app">

            <md-toolbar class="md-primary">
                <md-button class="md-icon-button" @click="menuClicked()">
                    <md-icon>menu</md-icon>
                </md-button>
                <router-link to="/" class="md-title">File Simulator</router-link>
            </md-toolbar>

             <md-drawer :md-active.sync="showNavigation">
                <div class="menu-header">
                    <span class="md-title">File Simulator</span><br>
                    <span class="md-body-1" v-if="getUser() != null">Logged In: {{getUser().name}}</span>
                </div>
                <md-list>
                    <router-link tag="md-list-item" to="/Home">
                        Home
                    </router-link>
                    <router-link tag="md-list-item" to="/editor">
                        Editor
                    </router-link>
                    <md-list-item @click="testConfirmDialog">
                        <span class="md-list-item-text">Test Confirm Dialog</span>
                    </md-list-item>
                    <md-list-item @click="testAlertDialog">
                        <span class="md-list-item-text">Test Alert Dialog</span>
                    </md-list-item>
                    <md-list-item @click="openInfoCard" v-if="getUser() != null">
                        <md-icon>info</md-icon>
                        <span class="md-list-item-text">Info Card</span>
                    </md-list-item>
                    <md-list-item @click="logout" v-if="getUser() != null">
                        <md-icon>exit_to_app</md-icon>
                        <span class="md-list-item-text">Logout</span>
                    </md-list-item>
                    <md-list-item>
                        <span class="md-list-item-text">Version: {{version}}</span>
                    </md-list-item>
                    <md-list-item>
                        <md-icon class="synced-checkmark" v-if="synced">check</md-icon>
                        <md-icon class="not-synced-warning" v-else>warning</md-icon>
                        <span class="md-list-item-text" v-if="synced">
                            Synced
                            <span v-if="online">Online</span>
                            <span v-else>Offline</span>
                        </span>
                        <span class="md-list-item-text" v-else>
                            Not Synced
                            <span v-if="online">Online</span>
                            <span v-else>Offline</span>
                        </span>
                    </md-list-item>
                </md-list>
            </md-drawer>

            <md-dialog-confirm
            :md-active.sync="showConfirmDialog"
            v-bind:md-title="confirmDialogOptions.title"
            v-bind:md-content="confirmDialogOptions.body"
            v-bind:md-confirm-text="confirmDialogOptions.okText"
            v-bind:md-cancel-text="confirmDialogOptions.cancelText"
            @md-cancel="onConfirmDialogCancel"
            @md-confirm="onConfirmDialogOk" />

            <md-dialog-alert
            :md-active.sync="showAlertDialog"
            v-bind:md-content="alertDialogOptions.body"
            v-bind:md-confirm-text="alertDialogOptions.confirmText" />

            <md-snackbar md-position="center" :md-duration="10000" :md-active.sync="showUpdateAvailable">
                <span>A new version is available!</span>
                <md-button class="md-accent" @click="refreshPage()">Refresh</md-button>
            </md-snackbar>

            <md-snackbar md-position="center" :md-duration="5000" :md-active.sync="showConnectionLost">
                <span>Connection lost. You are now working offline.</span>
            </md-snackbar>

            <md-snackbar md-position="center" :md-duration="5000" :md-active.sync="showConnectionRegained">
                <span>Connection regained. Attempting to sync with the server...</span>
            </md-snackbar>

            <md-snackbar md-position="center" :md-duration="5000" :md-active.sync="showSynced">
                <span>Synced!</span>
            </md-snackbar>

            <md-content class="app-content">
                <router-view></router-view>
            </md-content>
    </div>
</template>
<script src="./App.ts"></script>
<style src="./App.css"></style>