<!-- App.vue -->
<template>
    <div id="app">

            <md-toolbar>
                <div class="md-toolbar-section-start">
                    <md-button class="md-icon-button" @click="menuClicked()">
                        <md-icon>menu</md-icon>
                    </md-button>
                    <a class="md-title clickable" @click="showQRCode = true">
                        {{session || "AUX Builder"}}
                    </a>
                </div>
                <div class="md-toolbar-section-end">
                    <div v-if="loggedIn">
                        <md-button class="md-icon-button user-mode-toggle" @click="toggleUserMode()">
                            <md-icon v-if="userMode">settings</md-icon>
                            <md-icon v-else>close</md-icon>
                        </md-button>
                    </div>
                </div>
            </md-toolbar>

             <md-drawer :md-active.sync="showNavigation">
                <div class="menu-header">
                    <span class="md-title">AUX Builder</span><br>
                    <span class="md-body-1" v-if="getUser() != null">Logged In: {{getUser().name}}</span>
                </div>
                <md-list>
                    <router-link v-if="getUser() != null" tag="md-list-item" :to="{ name: 'home', params: { id: session } }">
                        <md-icon>home</md-icon>
                        <span class="md-list-item-text">Home</span>
                    </router-link>
                    <md-list-item @click="upload" v-if="getUser() != null">
                        <md-icon>cloud_upload</md-icon>
                        <span class="md-list-item-text">Upload AUX</span>
                    </md-list-item>
                    <md-list-item @click="download" v-if="getUser() != null">
                        <md-icon>cloud_download</md-icon>
                        <span class="md-list-item-text">Download AUX</span>
                    </md-list-item>
                    <md-list-item @click="fork" v-if="getUser() != null">
                        <fork-icon class="md-icon md-icon-font md-theme-default"></fork-icon>
                        <span class="md-list-item-text">Fork AUX</span>
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
                    <md-list-item v-if="updateAvailable" @click="refreshPage()">
                        <md-icon>update</md-icon>
                        <span class="md-list-item-text">An new version is available!</span>
                    </md-list-item>
                    <router-link v-if="dev && getUser() != null" tag="md-list-item" :to="{ name: 'aux-debug', params: { id: session } }">
                        <md-icon>bug_report</md-icon>
                        <span class="md-list-item-text">Debug</span>
                    </router-link>
                    <md-list-item v-for="item in extraItems" :key="item.id" @click="item.click()">
                        <md-icon v-if="item.icon">{{item.icon}}</md-icon>
                        <span class="md-list-item-text">{{item.text}}</span>
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
                    <qr-code :value="url()"  :options="{ width: 310 }"/>
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
                    <md-button @click="cancelFileUpload">Close</md-button>
                    <md-button class="md-primary" @click="uploadFiles" :disabled="uploadedFiles.length <= 0">Upload</md-button>
                </md-dialog-actions>
            </md-dialog>

            <md-dialog :md-active.sync="showFork" class="fork-dialog">
                <md-dialog-title>Fork AUX</md-dialog-title>
                <md-dialog-content>
                    <div class="fork-container">
                        <md-field>
                            <label for="fork-name">Fork Name</label>
                            <md-input name="fork-name" id="fork-name" v-model="forkName"/>
                        </md-field>
                    </div>
                </md-dialog-content>
                <md-dialog-actions>
                    <md-button @click="cancelFork">Cancel</md-button>
                    <md-button class="md-primary" @click="finishFork" :disabled="!forkName || forkName.length === 0">Fork</md-button>
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