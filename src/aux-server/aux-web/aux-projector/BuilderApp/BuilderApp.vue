<template>
    <div id="app">
        <load-app>
            <md-dialog :md-active.sync="showQRCode" class="qr-code-dialog">
                <div class="qr-code-container">
                    <span class="qr-code-label">{{ getQRCode() }}</span>
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

            <md-dialog :md-active.sync="showFork" class="fork-dialog">
                <md-dialog-title>Fork Channel</md-dialog-title>
                <md-dialog-content>
                    <div class="fork-container">
                        <md-field>
                            <label for="fork-name">Fork Name</label>
                            <md-input name="fork-name" id="fork-name" v-model="forkName" />
                        </md-field>
                    </div>
                </md-dialog-content>
                <md-dialog-actions>
                    <md-button @click="cancelFork">Cancel</md-button>
                    <md-button
                        class="md-primary"
                        @click="finishFork"
                        :disabled="!forkName || forkName.length === 0"
                        >Fork</md-button
                    >
                </md-dialog-actions>
            </md-dialog>

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
                :md-duration="2000"
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
<script src="./BuilderApp.ts"></script>
<style src="./BuilderApp.css"></style>
