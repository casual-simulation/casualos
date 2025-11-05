<template>
    <div id="app">
        <auth-ui></auth-ui>
        <login-ui @visible="onLoginUIVisible()" @hidden="onLoginUIHidden()"></login-ui>
        <load-app>
            <custom-portals :vmOrigin="vmOrigin()"></custom-portals>
            <bot-portal>
                <meet-portal>
                    <tag-portal>
                        <md-toolbar v-if="showChatBar" :style="chatBarBackgroundStyle">
                            <div class="md-toolbar-section-start">
                                <bot-chat
                                    ref="chatBar"
                                    :prefill="chatBarPrefill"
                                    :placeholder="chatBarPlaceholder"
                                    :placeholderColor="chatBarPlaceholderColor"
                                    :foregroundColor="chatBarForegroundColor"
                                ></bot-chat>
                            </div>
                        </md-toolbar>
                        <bot-sheet></bot-sheet>
                        <ide-portal></ide-portal>
                        <system-portal></system-portal>
                        <md-content class="main-content">
                            <div class="vm-iframe-container"></div>
                            <router-view></router-view>
                        </md-content>
                    </tag-portal>
                </meet-portal>
            </bot-portal>

            <html-portals v-show="showCustomApps"></html-portals>
            <records-ui @visible="onRecordsUIVisible()" @hidden="onRecordsUIHidden()"></records-ui>

            <upload-files></upload-files>
            <show-input></show-input>
            <show-confirm></show-confirm>
            <show-alert></show-alert>

            <md-dialog :md-active.sync="showQRCode" md-theme="default" class="qr-code-dialog">
                <div class="qr-code-container">
                    <span>{{ getQRCode() }}</span>
                    <qr-code :value="getQRCode()" :options="{ width: 310 }" />
                </div>
                <md-dialog-actions>
                    <md-button
                        class="md-primary"
                        @click="
                            showQRCode = false;
                            qrCode = null;
                        "
                        >Close</md-button
                    >
                </md-dialog-actions>
            </md-dialog>

            <md-dialog :md-active.sync="showBarcode" md-theme="default" class="barcode-dialog">
                <div class="barcode-container">
                    <barcode :value="getBarcode()" :format="getBarcodeFormat()" />
                </div>
                <md-dialog-actions>
                    <md-button
                        class="md-primary"
                        @click="
                            showBarcode = false;
                            barcode = null;
                        "
                        >Close</md-button
                    >
                </md-dialog-actions>
            </md-dialog>

            <md-dialog
                :md-active.sync="showQRScanner"
                md-theme="default"
                class="qr-scanner-dialog"
                @md-closed="onQrCodeScannerClosed()"
            >
                <div class="qr-scanner-container">
                    <h3>Scan a QR Code</h3>
                    <qrcode-stream
                        @decode="onQRCodeScanned"
                        :camera="camera"
                        :cameraId="selectedCameraId"
                        @streamAcquired="onQRStreamAcquired"
                    ></qrcode-stream>
                </div>
                <md-dialog-actions>
                    <md-button v-if="canSwitchCameras" @click="changeQRStream"
                        >Change Camera</md-button
                    >
                    <md-button class="md-primary" @click="hideQRCodeScanner()">Close</md-button>
                </md-dialog-actions>
            </md-dialog>

            <md-dialog
                :md-active.sync="showBarcodeScanner"
                md-theme="default"
                class="barcode-scanner-dialog"
                @md-closed="onBarcodeScannerClosed()"
            >
                <div class="barcode-scanner-container">
                    <h3>Scan a Barcode</h3>
                    <barcode-stream @decode="onBarcodeScanned" :camera="camera"></barcode-stream>
                </div>
                <md-dialog-actions>
                    <md-button class="md-primary" @click="hideBarcodeScanner()">Close</md-button>
                </md-dialog-actions>
            </md-dialog>

            <md-dialog
                :md-active.sync="showLoom"
                md-theme="default"
                class="loom-dialog"
                :md-fullscreen="false"
                @md-closed="onLoomClosed()"
            >
                <div class="loom-container" v-html="loomEmbedHtml"></div>
            </md-dialog>

            <md-dialog-confirm
                v-if="simulationToRemove"
                :md-active.sync="showRemoveSimulation"
                md-title="Remove Server"
                :md-content="`Remove ${simulationToRemove.displayName}?`"
                @md-confirm="finishRemoveSimulation()"
            />

            <md-dialog-confirm
                :md-active.sync="showConfirmDialog"
                class="confirm-dialog"
                v-bind:md-title="confirmDialogOptions.title"
                v-bind:md-content="confirmDialogOptions.body"
                v-bind:md-confirm-text="confirmDialogOptions.okText"
                v-bind:md-cancel-text="confirmDialogOptions.cancelText"
                @md-confirm="onDialogConfirm()"
                @md-cancel="onDialogCancel()"
            />

            <md-dialog-alert
                class="alert-dialog"
                :md-active.sync="showAlertDialog"
                v-bind:md-content="alertDialogOptions.body"
                v-bind:md-confirm-text="alertDialogOptions.confirmText"
            />

            <md-dialog-confirm
                :md-active.sync="showNotificationPermissionDialog"
                class="confirm-dialog"
                md-title="Allow notifications?"
                v-bind:md-content="showNotificationPermissionMessage"
                md-confirm-text="Allow"
                md-cancel-text="Reject"
                @md-confirm="onNotificationDialogConfirm()"
                @md-cancel="onNotificationDialogCancel()"
            />

            <!-- <md-dialog
                :md-active.sync="showNotAuthorized"
                class="not-authorized-dialog"
                @md-closed="onBarcodeScannerClosed()"
            >
                <md-dialog-title>Not Authorized</md-dialog-title>
                <md-dialog-content>
                    <p>You are not authorized to view this inst.</p>
                </md-dialog-content>
                <md-dialog-actions>
                    <md-button v-if="showChangeLogin" @click="logout()">Change Login</md-button>
                    <md-button v-else @click="login()">Login</md-button>
                    <md-button @click="newInst()">New Inst</md-button>
                </md-dialog-actions>
            </md-dialog> -->

            <md-snackbar
                md-position="center"
                :md-duration="snackbar.duration != undefined ? snackbar.duration : 2000"
                :md-active.sync="snackbar.visible"
            >
                <span>{{ snackbar.message }}</span>
                <md-button
                    v-if="snackbar.action"
                    class="md-primary"
                    @click="snackbarClick(snackbar.action)"
                    >{{ snackbar.action.label }}</md-button
                >
            </md-snackbar>

            <console
                v-if="showConsole"
                @close="closeConsole()"
                :autoSelectSources="['script']"
            ></console>

            <html-modal></html-modal>
            <clipboard-modal></clipboard-modal>
            <upload-server-modal></upload-server-modal>
            <imu-portal :streamImu="streamImu"></imu-portal>
            <image-classifier></image-classifier>
            <photo-camera></photo-camera>
            <bot-tooltips></bot-tooltips>
            <report-inst-dialog></report-inst-dialog>
            <wake-lock></wake-lock>
            <enable-xr-modal></enable-xr-modal>

            <div ref="livekitTracks" class="hidden-livekit-tracks"></div>
        </load-app>
    </div>
</template>
<script src="./PlayerApp.ts"></script>
<style src="./PlayerApp.css"></style>
