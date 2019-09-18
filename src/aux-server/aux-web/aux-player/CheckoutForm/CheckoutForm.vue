<template>
    <div class="checkout-form">
        <div v-show="!checkingOut" class="payment-area">
            <h2 class="checkout-form-title">{{ title }}</h2>
            <p class="checkout-form-description">{{ description }}</p>

            <div id="payment-request-button" ref="paymentRequestButton"></div>

            <div v-if="requestBillingAddress">
                <h4>Billing Information</h4>
                <md-field>
                    <label for="name">Name</label>
                    <md-input
                        name="name"
                        id="name"
                        autocomplete="given-name"
                        v-model="billingName"
                        required
                    />
                    <span v-if="submitted && billingNameError" class="md-helper-text error">{{
                        billingNameError
                    }}</span>
                </md-field>
                <md-field>
                    <label for="email">Email</label>
                    <md-input
                        name="email"
                        id="email"
                        autocomplete="email"
                        v-model="billingEmail"
                        required
                    />
                    <span v-if="submitted && billingEmailError" class="md-helper-text error">{{
                        billingEmailError
                    }}</span>
                </md-field>
                <md-field>
                    <label for="address">Address</label>
                    <md-input
                        name="address"
                        id="address"
                        autocomplete="address"
                        v-model="billingAddress"
                        required
                    />
                    <span v-if="submitted && billingAddressError" class="md-helper-text error">{{
                        billingAddressError
                    }}</span>
                </md-field>
                <md-field>
                    <label for="city">City</label>
                    <md-input
                        name="city"
                        id="city"
                        autocomplete="city"
                        v-model="billingCity"
                        required
                    />
                    <span v-if="submitted && billingCityError" class="md-helper-text error">{{
                        billingCityError
                    }}</span>
                </md-field>
                <div class="md-layout md-gutter">
                    <div class="md-layout-item">
                        <md-field>
                            <label for="state">State</label>
                            <md-input
                                name="state"
                                id="state"
                                autocomplete="state"
                                v-model="billingState"
                                required
                            />
                            <span
                                v-if="submitted && billingStateError"
                                class="md-helper-text error"
                                >{{ billingStateError }}</span
                            >
                        </md-field>
                    </div>
                    <div class="md-layout-item">
                        <md-field>
                            <label for="zip">Zip</label>
                            <md-input
                                name="zip"
                                id="zip"
                                autocomplete="zip"
                                v-model="billingZip"
                                required
                            />
                            <span
                                v-if="submitted && billingZipError"
                                class="md-helper-text error"
                                >{{ billingZipError }}</span
                            >
                        </md-field>
                    </div>
                </div>
                <md-field>
                    <label for="country">Country</label>
                    <md-select name="country" id="country" v-model="billingCountry" required>
                        <md-option value="US">United States</md-option>
                    </md-select>
                    <span v-if="submitted && billingCountryError" class="md-helper-text error">{{
                        billingCountryError
                    }}</span>
                </md-field>
            </div>

            <div class="card-container">
                <label class="card-label" for="payment-card">Card</label>
                <div id="payment-card" ref="paymentCard"></div>
                <div class="card error" v-show="cardError">
                    <span>{{ cardError }}</span>
                </div>
            </div>

            <p v-show="genericError" class="error">{{ genericError }}</p>

            <div class="checkout-buttons">
                <md-button @click="submitCheckout()" class="submit-button md-raised md-primary"
                    >Submit</md-button
                >
                <md-button @click="cancelCheckout()" class="cancel-button">Cancel</md-button>
            </div>
        </div>
        <div class="progress-area" v-show="checkingOut">
            <h3 class="progress-info">Submitting payment information...</h3>
            <div class="progress-spinner">
                <md-progress-spinner md-mode="indeterminate"></md-progress-spinner>
            </div>
        </div>
    </div>
</template>
<script src="./CheckoutForm.ts"></script>
<style scoped src="./CheckoutForm.css"></style>
<style src="./CheckoutFormGlobals.css"></style>
