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
            :md-active.sync="showEnterAddress"
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
                            <span v-if="showInvalidAddressError" class="md-error"
                                >This value is not recognized as a phone number or email
                                address</span
                            >
                            <span v-if="showEnterAddressError" class="md-error">{{
                                enterAddressErrorMessage
                            }}</span>
                            <span v-if="showBannedUserError" class="md-error"
                                >This user has been banned.</span
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
                <p>
                    <a target="_blank" :href="privacyPolicyUrl">Privacy Policy</a>
                </p>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button type="button" class="md-primary" @click="login()" :disabled="processing">
                    <md-progress-spinner
                        v-if="processing"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    >
                    <span v-else>Login</span>
                </md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showCheckAddress"
            :md-close-on-esc="false"
            :md-click-outside-to-close="true"
            :md-fullscreen="true"
            @md-closed="hideCheckAddress(true)"
            class="input-dialog"
        >
            <md-dialog-title>{{ checkAddressTitle }}</md-dialog-title>
            <md-dialog-content>
                <p>
                    We sent a login code to <strong>{{ addressToCheck }}</strong
                    >. <span v-if="showCode">Enter it below to complete login.</span
                    ><span v-else>Click the included link to complete login.</span>
                </p>
                <md-field v-if="showCode" :class="codeFieldClass">
                    <label>Code</label>
                    <md-input v-model="loginCode" @keydown.enter.native="sendCode()"></md-input>
                    <span v-if="showInvalidCodeError" class="md-error"
                        >The code does not match</span
                    >
                </md-field>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button @click="hideCheckAddress()">Cancel</md-button>
                <md-button
                    v-if="showCode"
                    class="md-primary"
                    @click="sendCode()"
                    :disabled="processing"
                >
                    <md-progress-spinner
                        v-if="processing"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    >
                    <span v-else>Send</span>
                </md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showGrantInstAdminPermission"
            :md-fullscreen="false"
            @md-closed="cancelGrantInstPermission()"
            class="input-dialog"
        >
            <md-dialog-title>Grant inst Admin?</md-dialog-title>
            <md-dialog-content class="allow-record-data-dialog-content">
                <p>
                    Do you want to grant this inst (<strong>{{ grantInstId }}</strong
                    >) admin permission to {{ allowRecordName }}?
                </p>
                <p>
                    This will allow the inst to perform the following actions when you are logged
                    in:
                </p>
                <ul>
                    <li>Create, read, update, or delete any data in the record.</li>
                    <li>Create, read, update, or delete any files in the record.</li>
                    <li>Increment, read, or update any events in the record.</li>
                    <li>Mark or unmark any resources in the record with any resource markers.</li>
                    <li>List all the resource markers in the record.</li>
                    <li>List all the role assignments in the record.</li>
                    <li>Grant or revoke any permissions to any resource markers.</li>
                    <li>Grant or revoke any roles to any users.</li>
                </ul>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button class="md-primary" @click="grantInstPermission()">Grant Admin</md-button>
                <md-button
                    @click="
                        showGrantInstAdminPermission = false;
                        allowRecordName = '';
                    "
                    >Cancel</md-button
                >
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showEnterAccountInfo"
            @md-closed="cancelRegistration()"
            :md-close-on-esc="true"
            :md-click-outside-to-close="true"
            :md-fullscreen="true"
            class="input-dialog"
        >
            <md-dialog-title>Register with {{ loginSiteName }}</md-dialog-title>
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
                            <span v-else-if="showInvalidAddressError" class="md-error"
                                >This value is not recognized as an email address</span
                            >
                            <span v-else-if="showEnterAddressError" class="md-error"
                                >Please enter an email address</span
                            >
                            <span v-else-if="showBannedUserError" class="md-error"
                                >This user has been banned</span
                            >
                        </md-field>

                        <md-field :class="displayNameFieldClass">
                            <label for="name">Display Name</label>
                            <md-input
                                name="displayName"
                                id="displayName"
                                v-model="displayName"
                                :disabled="processing"
                            />
                            <span v-if="showDisplayNameError" class="md-error"
                                >This display name is not allowed</span
                            >
                        </md-field>

                        <md-field :class="nameFieldClass">
                            <label for="name">Name</label>
                            <md-input
                                name="name"
                                id="name"
                                autocomplete="given-name"
                                v-model="name"
                                :disabled="processing"
                            />
                            <span v-if="showNameError" class="md-error"
                                >This name is not allowed</span
                            >
                        </md-field>

                        <md-datepicker
                            v-model="dateOfBirth"
                            :class="dateOfBirthFieldClass"
                            :md-model-type="Date"
                            :md-disabled-dates="disabledDates"
                        >
                            <label>Date of Birth</label>

                            <span v-if="showDateOfBirthError" class="md-error">
                                This Date of Birth is not allowed
                            </span>
                        </md-datepicker>

                        <md-field v-if="requireParentEmail" :class="parentEmailFieldClass">
                            <label for="parentEmail">Enter Parent Email</label>
                            <md-input
                                name="parentEmail"
                                id="parentEmail"
                                autocomplete="email"
                                v-model="parentEmail"
                                :disabled="processing"
                            />
                            <span v-if="showParentEmailError" class="md-error"
                                >This email is not allowed</span
                            >
                            <span v-else-if="showEnterParentEmailError" class="md-error">
                                Please enter an email address
                            </span>
                            <span v-else-if="showInvalidParentEmailError" class="md-error"
                                >This value is not recognized as an email address</span
                            >
                        </md-field>
                    </div>
                </div>
                <div class="terms-of-service-container" v-if="requireTermsOfService">
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
                <p>
                    <a target="_blank" :href="privacyPolicyUrl">Privacy Policy</a>
                </p>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button
                    type="button"
                    class="md-primary"
                    @click="register()"
                    :disabled="processing"
                >
                    <md-progress-spinner
                        v-if="processing"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    >
                    <span v-else>Register</span>
                </md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showHasAccount"
            @md-closed="cancelRegistration()"
            :md-close-on-esc="true"
            :md-click-outside-to-close="true"
            :md-fullscreen="true"
            class="input-dialog"
        >
            <md-dialog-title>Sign in or Register</md-dialog-title>
            <md-dialog-content class="input-dialog-content">
                <div class="md-layout md-gutter">
                    <div class="md-layout-item">
                        <p>You are not logged in. What do you want to do?</p>
                    </div>
                </div>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button type="button" @click="hasAccount(true)" :disabled="processing">
                    <md-progress-spinner
                        v-if="processing && hasAccountValue === true"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    >
                    <span v-else>Sign In</span>
                </md-button>
                <md-button type="button" @click="hasAccount(false)" :disabled="processing">
                    <md-progress-spinner
                        v-if="processing && hasAccountValue === false"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    >
                    <span v-else>Create Account</span>
                </md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showUpdatePassword"
            :md-close-on-esc="true"
            :md-click-outside-to-close="true"
            :md-fullscreen="true"
            class="input-dialog"
        >
            <md-dialog-title>Account Created</md-dialog-title>
            <md-dialog-content class="input-dialog-content">
                <div class="md-layout md-gutter">
                    <div class="md-layout-item">
                        <p>
                            Your account has been created. Do you want to set your account password?
                        </p>
                    </div>
                </div>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button
                    :href="updatePasswordUrl"
                    target="_blank"
                    class="md-primary"
                    @click="showUpdatePassword = false"
                >
                    Set Password
                </md-button>
                <md-button type="button" @click="showUpdatePassword = false">Close</md-button>
            </md-dialog-actions>
        </md-dialog>

        <div v-show="showIframe" class="md-overlay md-fixed md-dialog-overlay"></div>
    </div>
</template>
<script src="./RecordsUI.ts"></script>
<style src="./RecordsUI.css" scoped></style>
<style src="./RecordsUIGlobal.css"></style>
