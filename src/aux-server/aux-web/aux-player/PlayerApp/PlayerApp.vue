<template>
    <div id="app">
        <load-app>
            <custom-portals :vmOrigin="vmOrigin()"></custom-portals>
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
                    <md-content id="app-game-container">
                        <router-view></router-view>
                    </md-content>
                </tag-portal>
            </meet-portal>

            <html-portals></html-portals>

            <upload-files></upload-files>
            <checkout></checkout>
            <show-input></show-input>

            <md-dialog :md-active.sync="showQRCode" class="qr-code-dialog">
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

            <md-dialog :md-active.sync="showBarcode" class="barcode-dialog">
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
                class="qr-scanner-dialog"
                @md-closed="onQrCodeScannerClosed()"
            >
                <div class="qr-scanner-container">
                    <h3>Scan a QR Code</h3>
                    <qrcode-stream @decode="onQRCodeScanned" :camera="camera"></qrcode-stream>
                </div>
                <md-dialog-actions>
                    <md-button class="md-primary" @click="hideQRCodeScanner()">Close</md-button>
                </md-dialog-actions>
            </md-dialog>

            <md-dialog
                :md-active.sync="showBarcodeScanner"
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

            <md-dialog-confirm
                v-if="simulationToRemove"
                :md-active.sync="showRemoveSimulation"
                md-title="Remove Server"
                :md-content="`Remove ${simulationToRemove.displayName}?`"
                @md-confirm="finishRemoveSimulation()"
            />

            <md-dialog-confirm
                :md-active.sync="showConfirmDialog"
                v-bind:md-title="confirmDialogOptions.title"
                v-bind:md-content="confirmDialogOptions.body"
                v-bind:md-confirm-text="confirmDialogOptions.okText"
                v-bind:md-cancel-text="confirmDialogOptions.cancelText"
            />

            <md-dialog-alert
                class="alert-dialog"
                :md-active.sync="showAlertDialog"
                v-bind:md-content="alertDialogOptions.body"
                v-bind:md-confirm-text="alertDialogOptions.confirmText"
            />

            <authorize :show="showAuthorize" @close="showAuthorize = false"></authorize>

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
        </load-app>
    </div>
</template>
<script src="./PlayerApp.ts"></script>
<style src="./PlayerApp.css"></style>
