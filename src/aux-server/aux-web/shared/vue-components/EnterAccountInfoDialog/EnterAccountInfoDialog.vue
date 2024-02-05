<template>
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
            <form v-if="enterDateOfBirth" @submit.prevent="provideDateOfBirth()">
                <div class="md-layout md-gutter">
                    <div class="md-layout-item">
                        <md-datepicker
                            v-model="dateOfBirth"
                            :class="dateOfBirthFieldClass"
                            :md-model-type="Date"
                            :md-disabled-dates="disabledDates"
                        >
                            <label>Date of Birth</label>

                            <field-errors field="dateOfBirth" :errors="errors" />
                        </md-datepicker>
                    </div>
                </div>
                <field-errors :field="null" :errors="errors" />
                <p>
                    <a target="_blank" :href="privacyPolicyUrl">Privacy Policy</a>
                </p>
            </form>
            <form v-else @submit.prevent="register()">
                <div class="md-layout md-gutter">
                    <div class="md-layout-item">
                        <md-field :class="displayNameFieldClass">
                            <label for="name">Display Name</label>
                            <md-input
                                name="displayName"
                                id="displayName"
                                v-model="displayName"
                                :disabled="processing"
                                @blur="checkDisplayName()"
                            />
                            <field-errors field="displayName" :errors="errors" />
                        </md-field>

                        <md-field :class="nameFieldClass">
                            <label for="firstName">First Name</label>
                            <md-input
                                name="firstName"
                                id="firstName"
                                autocomplete="given-name"
                                v-model="name"
                                :disabled="processing"
                                @blur="checkDisplayName()"
                            />
                            <field-errors field="name" :errors="errors" />
                        </md-field>

                        <md-field :class="dateOfBirthFieldClass">
                            <label for="dateOfBirth">Date of Birth</label>
                            <md-input
                                name="dateOfBirth"
                                id="dateOfBirth"
                                :value="dateOfBirthText"
                                disabled
                            />
                            <field-errors field="dateOfBirth" :errors="errors" />
                        </md-field>

                        <md-field v-if="showEmail" :class="emailFieldClass">
                            <label for="email">{{ registerEmailFieldHint }}</label>
                            <md-input
                                name="email"
                                id="email"
                                autocomplete="email"
                                v-model="email"
                                :disabled="processing"
                                @blur="checkEmail()"
                            />
                            <span v-if="!requireParentEmail" class="md-helper-text"
                                >We require a valid email to set up your account.</span
                            >
                            <field-errors field="email" :errors="errors" />
                        </md-field>

                        <md-field v-if="requireParentEmail" :class="parentEmailFieldClass">
                            <label for="parentEmail">Enter Parent Email</label>
                            <md-input
                                name="parentEmail"
                                id="parentEmail"
                                autocomplete="email"
                                v-model="parentEmail"
                                :disabled="processing"
                            />
                            <span class="md-helper-text"
                                >We require a valid parent email to set up your account.</span
                            >
                            <field-errors field="parentEmail" :errors="errors" />
                        </md-field>
                    </div>
                </div>
                <div class="terms-of-service-container" v-if="requireTermsOfService">
                    <field-errors field="termsOfService" :errors="errors" />
                    <div class="terms-of-service-wrapper">
                        <md-checkbox v-model="acceptedTerms" id="terms-of-service"> </md-checkbox>
                        <label for="terms-of-service">
                            I accept the
                            <a target="_blank" :href="termsOfServiceUrl">Terms of Service</a>
                        </label>
                    </div>
                </div>
                <field-errors :field="null" :errors="errors" />
                <p>
                    <a target="_blank" :href="privacyPolicyUrl">Privacy Policy</a>
                </p>
            </form>
        </md-dialog-content>
        <md-dialog-actions>
            <md-button
                v-if="enterDateOfBirth"
                type="button"
                @click="provideDateOfBirth()"
                :disabled="processing"
            >
                <md-progress-spinner
                    v-if="processing"
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                    >Processing</md-progress-spinner
                >
                <span v-else>Continue</span>
            </md-button>
            <md-button v-else type="button" @click="register()" :disabled="processing">
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
</template>
<script src="./EnterAccountInfoDialog.ts"></script>
<style src="./EnterAccountInfoDialog.css"></style>
