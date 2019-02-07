<!-- App.vue -->
<template>
    <div id="app">

            <md-toolbar>
                <div class="md-toolbar-section-start">
                    <md-button class="md-icon-button" @click="menuClicked()">
                        <md-icon>menu</md-icon>
                    </md-button>
                    <a class="md-title clickable" @click="showQRCode = true">
                        {{session || "File Simulator"}}
                    </a>
                </div>
                <div class="md-toolbar-section-end">
                    <md-switch class="user-mode-toggle" v-if="loggedIn" v-model="userMode" @change="onUserModeChanged">
                        <cube-icon v-if="userMode" />
                        <hex-icon v-else />
                    </md-switch>
                </div>
            </md-toolbar>

             <md-drawer :md-active.sync="showNavigation">
                <div class="menu-header">
                    <span class="md-title">File Simulator</span><br>
                    <span class="md-body-1" v-if="getUser() != null">Logged In: {{getUser().name}}</span>
                </div>
                <md-list>
                    <router-link v-if="getUser() != null" tag="md-list-item" :to="{ name: 'home', params: { id: session } }">
                        <md-icon>home</md-icon>
                        <span class="md-list-item-text">Home</span>
                    </router-link>
                    <md-list-item @click="upload" v-if="getUser() != null">
                        <md-icon>cloud_upload</md-icon>
                        <span class="md-list-item-text">Upload</span>
                    </md-list-item>
                    <md-list-item @click="download" v-if="getUser() != null">
                        <md-icon>cloud_download</md-icon>
                        <span class="md-list-item-text">Download</span>
                    </md-list-item>
                    <md-list-item @click="logout" v-if="getUser() != null">
                        <md-icon>exit_to_app</md-icon>
                        <span class="md-list-item-text">Logout</span>
                    </md-list-item>
                    <md-list-item v-if="getUser() != null" class="nuke-site-item" @click="nukeSite()" :disabled="!(online && synced)">
                        <md-icon class="nuke-everything-icon">delete_forever</md-icon>
                        <span class="md-list-item-text">Clear Simulation</span>

                        <md-tooltip v-if="!(online && synced)">Must be online &amp; synced to clear the simulation.</md-tooltip>
                    </md-list-item>
                    <md-list-item @click.right="toggleOnlineOffline()">
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
                    </md-list-item>
                    <md-list-item :to="{ name: 'merge-conflicts', params: { id: session } }" v-if="remainingConflicts.length > 0">
                        <md-icon id="fix-merge-conflicts-icon">build</md-icon>
                        <span class="md-list-item-text">Fix Merge Conflicts</span>
                    </md-list-item>
                    <md-list-item v-if="updateAvailable" @click="refreshPage()">
                        <md-icon>update</md-icon>
                        <span class="md-list-item-text">An new version is available!</span>
                    </md-list-item>
                    <md-list-item>
                        <span class="md-list-item-text" @click.left="copy(version)" @click.right="copy(versionTooltip)">
                            Version: {{version}}
                            <md-tooltip md-direction="bottom">{{versionTooltip}}</md-tooltip>
                        </span>
                    </md-list-item>
                </md-list>
            </md-drawer>

            <md-dialog :md-active.sync="showQRCode" class="qr-code-dialog">
                <div class="qr-code-container">
                    <span>{{url()}}</span>
                    <qr-code :value="url()" />
                </div>
                <md-dialog-actions>
                    <md-button class="md-primary" @click="showQRCode = false">Close</md-button>
                </md-dialog-actions>
            </md-dialog>

            <md-dialog :md-active.sync="showFileUpload" class="file-upload-dialog">
                <md-dialog-title>Upload Files</md-dialog-title>
                <div class="file-upload-container">
                    <file-pond allow-multiple="false" @addfile="fileAdded" @removefile="fileRemoved"/>
                </div>
                <md-dialog-actions>
                    <md-button class="md-primary" @click="cancelFileUpload">Close</md-button>
                    <md-button class="md-primary" @click="uploadFiles" :disabled="uploadedFiles.length <= 0">Upload</md-button>
                </md-dialog-actions>
            </md-dialog>

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

            <md-snackbar md-position="center" :md-duration="6000" :md-active.sync="snackbar.visible">
                <span>{{snackbar.message}}</span>
                <md-button v-if="snackbar.action" class="md-primary" @click="snackbarClick(snackbar.action)">{{snackbar.action.label}}</md-button>
            </md-snackbar>

            <md-content class="app-content">
                <router-view></router-view>
            </md-content>
    </div>
</template>
<script src="./App.ts"></script>
<style src="./App.css"></style>