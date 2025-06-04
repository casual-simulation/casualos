<template>
    <div id="app-game-container">
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
            <md-dialog-title class="bios-title" :class="{ 'logo-title': !!logoUrl }">
                <img
                    v-if="logoUrl"
                    :src="logoUrl"
                    class="logo"
                    :alt="logoTitle"
                    :title="logoTitle"
                />
                <span v-else>BIOS</span>
                <span class="spacer"></span>
                <md-button v-if="canSignOut()" class="md-icon-button" @click="showAccountInfo()">
                    <md-icon>perm_identity</md-icon>
                    <md-tooltip md-direction="bottom">Account Info</md-tooltip>
                </md-button>
            </md-dialog-title>
            <md-dialog-content>
                <md-field class="bios-selection-field">
                    <label for="biosOption">inst type</label>
                    <bios-select v-model="biosSelection" name="biosOption" id="biosOption">
                        <bios-option
                            v-for="option in biosSelectionOptions"
                            :key="option"
                            ref="biosOptions"
                            :value="option"
                            :class="{ 'double-line': hasOptionDescription(option) }"
                            ><span>{{ option }}</span
                            ><span v-if="hasOptionDescription(option)">{{
                                getOptionDescription(option)
                            }}</span></bios-option
                        >
                    </bios-select>
                </md-field>

                <md-field v-if="isJoinCode(biosSelection)" :class="joinCodeClass">
                    <label for="joinCode">join code</label>
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

                <md-field v-if="isStaticInst(biosSelection)">
                    <label for="instOption">inst</label>
                    <md-select v-model="instSelection" name="instOption" id="instOption">
                        <md-option value="new-inst">+new</md-option>
                        <md-option v-for="option in instOptions" :key="option" :value="option">{{
                            option
                        }}</md-option>
                    </md-select>
                </md-field>

                <md-field v-if="showInstNameInput">
                    <label for="instName">inst name</label>
                    <md-input
                        name="instName"
                        id="instName"
                        v-model="instName"
                        :placeholder="generatedName"
                    />
                    <field-errors field="instName" :errors="errors" />
                </md-field>

                <div class="policies-grid">
                    <div>
                        <p v-if="privacyPolicyUrl">
                            <a target="_blank" :href="privacyPolicyUrl">Privacy Policy</a>
                        </p>
                        <p v-if="codeOfConductUrl">
                            <a target="_blank" :href="codeOfConductUrl">Code of Conduct</a>
                        </p>
                        <p v-if="termsOfServiceUrl">
                            <a target="_blank" :href="termsOfServiceUrl">Terms of Service</a>
                        </p>
                        <p v-if="supportUrl">
                            <a target="_blank" :href="supportUrl">Support</a>
                        </p>
                    </div>
                    <div class="spacer"></div>
                    <div class="policy-cert" v-if="isPrivoCertified">
                        <a
                            style="display: inline-block; width: 70px; height: 70px"
                            target="_blank"
                            href="https://cert.privo.com/#/companies/casualsimulation"
                        >
                            <img
                                src="https://privohub.privo.com/files/images/PRIVO_Cert/KPAS_C2V_104_4_72.png"
                                alt="COPPA Safe Harbor Certification - Kids Privacy Assured by PRIVO"
                            />
                        </a>
                    </div>
                </div>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button v-if="canSignIn()" @click="signIn()">Sign In</md-button>
                <md-button v-if="canSignUp()" @click="signUp()">Sign Up</md-button>
                <md-button v-if="canSignOut()" @click="signOut()">Sign Out</md-button>
                <span class="spacer"></span>

                <md-button
                    v-if="
                        instSelection !== 'new-inst' &&
                        ['local inst', 'local', 'static inst'].includes(biosSelection)
                    "
                    @click="
                        executeBiosOption('delete inst', recordSelection, instSelection, joinCode)
                    "
                    >delete</md-button
                >

                <md-button
                    @click="
                        executeBiosOption(biosSelection, recordSelection, instSelection, joinCode)
                    "
                    :disabled="!canLoad"
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
