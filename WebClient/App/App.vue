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
                        <md-icon>home</md-icon>
                        <span class="md-list-item-text">Home</span>
                    </router-link>
                    <md-list-item @click="openInfoCard" v-if="getUser() != null">
                        <md-icon>info</md-icon>
                        <span class="md-list-item-text">Info Card</span>
                    </md-list-item>
                    <md-list-item @click="logout" v-if="getUser() != null">
                        <md-icon>exit_to_app</md-icon>
                        <span class="md-list-item-text">Logout</span>
                    </md-list-item>
                    <md-list-item class="nuke-site-item" @click="nukeSite()" v-if="online && synced">
                        <md-icon class="nuke-everything-icon">delete_forever</md-icon>
                        <span class="md-list-item-text">Nuke the Site</span>
                    </md-list-item>
                    <md-list-item @click="toggleOnlineOffline()">
                        <md-icon id="forced-offline-error" v-if="forcedOffline()">error</md-icon>
                        <md-icon id="synced-checkmark" v-else-if="synced">cloud_done</md-icon>
                        <md-icon id="not-synced-warning" v-else>cloud_off</md-icon>
                        <span class="md-list-item-text" v-if="forcedOffline()">
                            Forced Offline
                        </span>
                        <span class="md-list-item-text" v-else-if="synced">
                            Synced
                            <span v-if="online">Online</span>
                            <span v-else>Offline</span>
                        </span>
                        <span class="md-list-item-text" v-else>
                            Not Synced
                            <span v-if="online">Online</span>
                            <span v-else>Offline</span>
                        </span>
                        <md-button to="/merge-conflicts" class="md-list-action md-primary" v-if="remainingConflicts.length > 0">Fix Merge Conflicts</md-button>
                    </md-list-item>
                    <md-list-item v-if="updateAvailable" @click="refreshPage()">
                        <md-icon>update</md-icon>
                        <span class="md-list-item-text">An new version is available!</span>
                    </md-list-item>
                    <md-list-item>
                        <span class="md-list-item-text">Version: {{version}}</span>
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
                <md-button class="md-primary" @click="refreshPage()">Refresh</md-button>
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

            <md-snackbar md-position="center" :md-duration="5000" :md-active.sync="showMergeConflicts">
                <span>Conflicts occurred while syncing.</span>
                <md-button to="/merge-conflicts" class="md-primary">Fix now</md-button>
            </md-snackbar>

            <md-content class="app-content">
                <router-view></router-view>
            </md-content>
    </div>
</template>
<script src="./App.ts"></script>
<style src="./App.css"></style>