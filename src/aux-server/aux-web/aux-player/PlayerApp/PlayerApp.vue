<template>
    <div id="app">
        <load-app>
            <upload-files></upload-files>
            <md-toolbar v-if="showChatBar">
                <div class="md-toolbar-section-start">
                    <bot-chat
                        ref="chatBar"
                        :prefill="chatBarPrefill"
                        :placeholder="chatBarPlaceholder"
                    ></bot-chat>
                </div>
            </md-toolbar>
            <checkout></checkout>
            <bot-sheet></bot-sheet>

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
                md-title="Remove Channel"
                :md-content="`Remove ${simulationToRemove.displayName}?`"
                @md-confirm="finishRemoveSimulation()"
            />

            <md-dialog-confirm
                :md-active.sync="showConfirmDialog"
                v-bind:md-title="confirmDialogOptions.title"
                v-bind:md-content="confirmDialogOptions.body"
                v-bind:md-confirm-text="confirmDialogOptions.okText"
                v-bind:md-cancel-text="confirmDialogOptions.cancelText"
                @md-cancel="onConfirmDialogCancel"
                @md-confirm="onConfirmDialogOk"
            />

            <md-dialog-alert
                :md-active.sync="showAlertDialog"
                v-bind:md-content="alertDialogOptions.body"
                v-bind:md-confirm-text="alertDialogOptions.confirmText"
            />

            <md-dialog
                :md-active.sync="showInputDialog"
                @md-closed="closeInputDialog()"
                :style="{
                    'background-color': inputDialogBackgroundColor,
                    color: inputDialogLabelColor,
                }"
            >
                <md-dialog-title>{{ inputDialogLabel }}</md-dialog-title>
                <md-dialog-content>
                    <md-field>
                        <label :style="{ color: inputDialogLabelColor }">{{
                            inputDialogPlaceholder
                        }}</label>
                        <md-input
                            v-model="inputDialogInputValue"
                            @keyup.enter="saveInputDialog()"
                            style="-webkit-text-fill-color: inherit;"
                            :style="{ color: inputDialogLabelColor }"
                        ></md-input>
                    </md-field>
                    <div v-if="inputDialogType === 'color'">
                        <color-picker-swatches
                            v-if="inputDialogSubtype === 'swatch'"
                            :value="inputDialogInputValue"
                            @input="updateInputDialogColor"
                            :disableAlpha="true"
                        ></color-picker-swatches>
                        <color-picker-advanced
                            v-else-if="inputDialogSubtype === 'advanced'"
                            :value="inputDialogInputValue"
                            @input="updateInputDialogColor"
                            class="color-picker-advanced"
                            :disableAlpha="true"
                        ></color-picker-advanced>
                        <color-picker-basic
                            v-else
                            :value="inputDialogInputValue"
                            @input="updateInputDialogColor"
                            class="color-picker-basic"
                            :disableAlpha="true"
                        ></color-picker-basic>
                    </div>
                </md-dialog-content>
                <md-dialog-actions>
                    <md-button @click="closeInputDialog()" :style="{ color: inputDialogLabelColor }"
                        >Cancel</md-button
                    >
                    <md-button @click="saveInputDialog()" class="md-primary">Save</md-button>
                </md-dialog-actions>
            </md-dialog>

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
            <upload-universe-modal></upload-universe-modal>

            <md-content class="app-content">
                <router-view></router-view>
            </md-content>
        </load-app>
    </div>
</template>
<script src="./PlayerApp.ts"></script>
<style src="./PlayerApp.css"></style>
