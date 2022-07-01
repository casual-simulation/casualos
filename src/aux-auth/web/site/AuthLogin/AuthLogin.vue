<template>
    <div class="login-container">
        <form @submit.prevent="login">
            <md-card>
                <md-card-header>
                    <div class="md-title">Login</div>
                </md-card-header>
                <md-card-content>
                    <div class="md-layout md-gutter">
                        <div class="md-layout-item">
                            <md-field :class="addressFieldClass">
                                <label for="address">{{ addressFieldHint }}</label>
                                <md-input
                                    name="address"
                                    id="address"
                                    autocomplete="email"
                                    v-model="address"
                                    :disabled="processing"
                                />
                                <span v-show="showEmailError" class="md-error"
                                    >This email is not allowed</span
                                >
                                <span v-show="showSmsError" class="md-error"
                                    >This phone number is not allowed</span
                                >
                                <span v-if="showInvalidAddressError" class="md-error"
                                    >This value is not recognized as a phone number or email
                                    address</span
                                >
                                <span v-if="showEnterAddressError" class="md-error">{{
                                    enterAddressErrorMessage
                                }}</span>
                            </md-field>
                        </div>
                    </div>
                    <div class="terms-of-service-container">
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
                </md-card-content>

                <md-card-actions>
                    <md-button type="submit" class="md-primary" :disabled="processing"
                        >Login</md-button
                    >
                </md-card-actions>
            </md-card>
        </form>
    </div>
</template>
<script src="./AuthLogin.ts"></script>
<style src="./AuthLogin.css" scoped></style>
