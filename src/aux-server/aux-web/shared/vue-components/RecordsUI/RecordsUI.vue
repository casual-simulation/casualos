<template>
    <div>
        <md-dialog
            :md-active.sync="showRequestPublicRecord"
            :md-fullscreen="false"
            @md-closed="cancelCreateRecordKey()"
            class="input-dialog"
        >
            <md-dialog-content class="input-dialog-content">
                <p>Do you want to create a record key for "{{ requestRecordName }}"?</p>
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
            :md-active.sync="showEnterEmail"
            @md-closed="cancelLogin(true)"
            :md-close-on-esc="true"
            :md-click-outside-to-close="true"
            :md-fullscreen="true"
            class="input-dialog"
        >
            <md-dialog-title> Login to {{ loginSiteName }} </md-dialog-title>
            <md-dialog-content class="input-dialog-content">
                <div class="md-layout md-gutter">
                    <div class="md-layout-item">
                        <md-field :class="emailFieldClass">
                            <label for="email">Email</label>
                            <md-input
                                name="email"
                                id="email"
                                autocomplete="email"
                                v-model="email"
                                :disabled="processing"
                            />
                            <span v-show="showEmailError" class="md-error"
                                >This email is not allowed</span
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
            <md-dialog-title> Check your email </md-dialog-title>
            <md-dialog-content>
                <p>
                    We emailed a login link to <strong>{{ email }}</strong
                    >.
                </p>
                <p>Click the link to login or sign up.</p>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button @click="hideCheckEmail()">Close</md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./RecordsUI.ts"></script>
<style src="./RecordsUI.css" scoped></style>
