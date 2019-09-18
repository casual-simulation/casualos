<template>
    <div class="checkout-form">
        <div v-show="!checkingOut" class="payment-area">
            <h3 class="checkout-form-title">{{ title }}</h3>
            <p class="checkout-form-description">{{ description }}</p>

            <div id="payment-request-button"></div>

            <div v-if="requestBillingAddress">
                <md-field>
                    <label for="name">Name</label>
                    <md-input
                        name="name"
                        id="name"
                        autocomplete="given-name"
                        v-model="billingName"
                        required
                    />
                    <span v-if="billingNameError" class="md-helper-text">{{
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
                    <span v-if="billingEmailError" class="md-helper-text">{{
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
                    <span v-if="billingAddressError" class="md-helper-text">{{
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
                    <span v-if="billingCityError" class="md-helper-text">{{
                        billingCityError
                    }}</span>
                </md-field>
                <md-field>
                    <label for="state">State</label>
                    <md-input
                        name="state"
                        id="state"
                        autocomplete="state"
                        v-model="billingState"
                        required
                    />
                    <span v-if="billingStateError" class="md-helper-text">{{
                        billingStateError
                    }}</span>
                </md-field>
                <md-field>
                    <label for="zip">Zip</label>
                    <md-input
                        name="zip"
                        id="zip"
                        autocomplete="zip"
                        v-model="billingZip"
                        required
                    />
                    <span v-if="billingZipError" class="md-helper-text">{{ billingZipError }}</span>
                </md-field>
                <md-field>
                    <label for="country">Country</label>
                    <md-select name="country" id="country" v-model="billingCountry" required>
                        <md-option value="US">United States</md-option>
                    </md-select>
                    <span v-if="billingCountryError" class="md-helper-text">{{
                        billingCountryError
                    }}</span>
                </md-field>
            </div>

            <div ref="paymentCard"></div>

            <div class="card-error" v-show="cardError">
                <span>{{ cardError }}</span>
            </div>

            <md-button @click="submitCheckout()" class="submit-button md-primary">Submit</md-button>
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
