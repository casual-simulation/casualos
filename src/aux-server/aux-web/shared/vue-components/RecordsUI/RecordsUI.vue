<template>
    <div>
        <md-dialog
            :md-active.sync="showRequestPublicRecord"
            :md-fullscreen="false"
            @md-closed="cancelCreateRecordKey()"
            class="input-dialog"
        >
            <md-dialog-content class="input-dialog-content">
                <p>
                    Do you want to create a {{ requestRecordPolicy }} record key for "{{
                        requestRecordName
                    }}"?
                </p>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button class="md-primary" @click="createRecordKey(requestRecordName)"
                    >Create Record Key</md-button
                >
                <md-button
                    @click="
                        showRequestPublicRecord = false;
                        requestRecordName = '';
                    "
                    >Cancel</md-button
                >
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showAllowRecordData"
            :md-fullscreen="false"
            @md-closed="cancelAllowRecordData()"
            class="input-dialog"
        >
            <md-dialog-content class="allow-record-data-dialog-content">
                <p v-if="recordDataEvent && recordDataEvent.type === 'record_data'">
                    Do you want to write the following data to "{{ allowAddress }}" in "{{
                        allowRecordName
                    }}"?
                    <code>
                        <pre>{{
                            typeof recordDataEvent.data === 'string'
                                ? recordDataEvent.data
                                : JSON.stringify(recordDataEvent.data)
                        }}</pre>
                    </code>
                </p>
                <p v-else-if="recordDataEvent && recordDataEvent.type === 'get_record_data'">
                    Do you want to get the data from "{{ allowAddress }}" in "{{
                        allowRecordName
                    }}"?
                </p>
                <p v-else-if="recordDataEvent && recordDataEvent.type === 'erase_record_data'">
                    Do you want to delete the data stored in "{{ allowAddress }}" in "{{
                        allowRecordName
                    }}"?
                </p>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button class="md-primary" @click="allowRecordData()">{{
                    !recordDataEvent
                        ? ''
                        : recordDataEvent.type === 'record_data'
                        ? 'Record Data'
                        : recordDataEvent.type === 'get_record_data'
                        ? 'Get Data'
                        : 'Erase Data'
                }}</md-button>
                <md-button
                    @click="
                        showAllowRecordData = false;
                        allowRecordName = '';
                    "
                    >Cancel</md-button
                >
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showEnterEmail"
            @md-closed="cancelLogin(true)"
            :md-close-on-esc="true"
            :md-click-outside-to-close="true"
            :md-fullscreen="true"
            class="input-dialog"
        >
            <md-dialog-title>Login with {{ loginSiteName }}</md-dialog-title>
            <md-dialog-content class="input-dialog-content">
                <div class="md-layout md-gutter">
                    <div class="md-layout-item">
                        <md-field :class="emailFieldClass">
                            <label for="email">{{ emailFieldHint }}</label>
                            <md-input
                                name="email"
                                id="email"
                                autocomplete="email"
                                v-model="email"
                                :disabled="processing"
                            />
                            <span v-if="showEmailError" class="md-error"
                                >This email is not allowed</span
                            >
                            <span v-if="showSmsError" class="md-error"
                                >This phone number is not allowed</span
                            >
                        </md-field>
                    </div>
                </div>
                <div class="terms-of-service-container">
                    <div v-show="showTermsOfServiceError" class="terms-of-service-error">
                        Please accept the terms of service.
                    </div>
                    <div class="terms-of-service-wrapper">
                        <md-checkbox v-model="acceptedTerms" id="terms-of-service"> </md-checkbox>
                        <label for="terms-of-service">
                            I accept the
                            <a target="_blank" :href="termsOfServiceUrl">Terms of Service</a>
                        </label>
                    </div>
                </div>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button type="button" class="md-primary" @click="login()" :disabled="processing"
                    >Login</md-button
                >
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showCheckEmail"
            :md-close-on-esc="false"
            :md-click-outside-to-close="true"
            :md-fullscreen="true"
            @md-closed="hideCheckEmail()"
            class="input-dialog"
        >
            <md-dialog-title>Check your email</md-dialog-title>
            <md-dialog-content>
                <p>
                    We emailed a login code to <strong>{{ email }}</strong
                    >.
                </p>
                <md-field>
                    <label>Code</label>
                    <md-input v-model="loginCode"></md-input>
                </md-field>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button @click="hideCheckEmail()">Close</md-button>
                <md-button @click="sendCode()">Send</md-button>
            </md-dialog-actions>
        </md-dialog>

        <div v-show="showIframe" class="md-overlay md-fixed md-dialog-overlay"></div>
    </div>
</template>
<script src="./RecordsUI.ts"></script>
<style src="./RecordsUI.css" scoped></style>
<style src="./RecordsUIGlobal.css"></style>
