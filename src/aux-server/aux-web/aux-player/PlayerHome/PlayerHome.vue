<template>
    <div>
        <game-view
            v-if="!isLoading"
            class="game-view"
            :debug="debug"
            containerId="app-game-container"
        >
            <div class="ui-container"></div>
        </game-view>
        <md-dialog
            :md-active.sync="showBios"
            :md-close-on-esc="false"
            :md-click-outside-to-close="false"
        >
            <md-dialog-title>BIOS</md-dialog-title>
            <md-dialog-content>
                <md-field class="bios-selection-field">
                    <label for="biosOption">bios=</label>
                    <md-select v-model="biosSelection" name="biosOption" id="biosOption">
                        <bios-option
                            v-for="option in biosOptions"
                            :key="option"
                            ref="biosOptions"
                            :value="option"
                            :class="{ 'double-line': hasOptionDescription(option) }"
                        >
                            <span>{{ option }}</span>
                            <span v-if="hasOptionDescription(option)">{{
                                getOptionDescription(option)
                            }}</span>
                        </bios-option>
                    </md-select>
                </md-field>
                <span
                    class="selection-bios-description"
                    v-if="hasOptionDescription(biosSelection)"
                    >{{ getOptionDescription(biosSelection) }}</span
                >

                <md-field v-if="biosSelection === 'enter join code'" :class="joinCodeClass">
                    <label for="joinCode">joinCode=</label>
                    <md-input name="joinCode" id="joinCode" v-model="joinCode" />
                    <field-errors field="joinCode" :errors="errors" />
                </md-field>
                <!-- <md-field v-if="recordsOptions.length > 0">
                    <label for="recordOption">Record</label>
                    <md-select v-model="recordSelection" name="recordOption" id="recordOption">
                        <md-option value="null">My Studio</md-option>
                        <md-option v-for="option in recordsOptions" :key="option" :value="option">{{
                            option
                        }}</md-option>
                    </md-select>
                </md-field> -->
                <md-field v-if="instOptions.length > 0">
                    <label for="instOption">staticInst=</label>
                    <md-select v-model="instSelection" name="instOption" id="instOption">
                        <md-option value="new-inst">(new inst)</md-option>
                        <md-option v-for="option in instOptions" :key="option" :value="option">{{
                            option
                        }}</md-option>
                    </md-select>
                </md-field>

                <p v-if="privacyPolicyUrl">
                    <a target="_blank" :href="privacyPolicyUrl">Privacy Policy</a>
                </p>
                <p v-if="termsOfServiceUrl">
                    <a target="_blank" :href="termsOfServiceUrl">Terms of Service</a>
                </p>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button
                    @click="
                        executeBiosOption(biosSelection, recordSelection, instSelection, joinCode)
                    "
                    >{{ startButtonLabel }}</md-button
                >
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showLoggingIn"
            :md-close-on-esc="false"
            :md-click-outside-to-close="false"
        >
            <md-dialog-title>Logging In</md-dialog-title>
            <md-dialog-content>
                <div class="loading-dialog">
                    <div class="loading-text-content">
                        <div class="loading-progress">
                            <md-progress-spinner
                                md-mode="indeterminate"
                                :md-diameter="20"
                                :md-stroke="2"
                            ></md-progress-spinner>
                        </div>
                    </div>
                    <p>Logging in...</p>
                </div>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button @click="cancelLogin()">Cancel</md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./PlayerHome.ts"></script>
<style src="./PlayerHome.css"></style>
