<template>
    <div class="register-container">
        <update-password-dialog
            v-if="updatePasswordUrl"
            :updatePasswordUrl="updatePasswordUrl"
            @close="goHome()"
        ></update-password-dialog>
        <md-card v-else>
            <form @submit.prevent="register">
                <md-card-header><div class="md-title">Register</div></md-card-header>
                <md-card-content class="input-dialog-content">
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
                                    @blur="checkEmail()"
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
                                    @blur="checkDisplayName()"
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
                            <md-checkbox v-model="acceptedTerms" id="terms-of-service">
                            </md-checkbox>
                            <label for="terms-of-service">
                                I accept the
                                <a target="_blank" href="/terms">Terms of Service</a>
                            </label>
                        </div>
                    </div>
                    <p>
                        <a target="_blank" href="/privacy-policy">Privacy Policy</a>
                    </p>
                </md-card-content>
                <md-card-actions>
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
                </md-card-actions>
            </form>
        </md-card>
    </div>
</template>
<script src="./PrivoRegistrationCard.ts"></script>
<style src="./PrivoRegistrationCard.css" scoped></style>
