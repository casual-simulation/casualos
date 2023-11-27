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
            <form @submit.prevent="register()">
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
                            <label for="name">Name</label>
                            <md-input
                                name="name"
                                id="name"
                                autocomplete="given-name"
                                v-model="name"
                                :disabled="processing"
                                @blur="checkDisplayName()"
                            />
                            <field-errors field="name" :errors="errors" />
                        </md-field>

                        <md-datepicker
                            v-model="dateOfBirth"
                            :class="dateOfBirthFieldClass"
                            :md-model-type="Date"
                            :md-disabled-dates="disabledDates"
                        >
                            <label>Date of Birth</label>

                            <field-errors field="dateOfBirth" :errors="errors" />
                        </md-datepicker>

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
            <md-button type="button" class="md-primary" @click="register()" :disabled="processing">
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
