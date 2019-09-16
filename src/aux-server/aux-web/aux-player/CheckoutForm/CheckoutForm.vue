<template>
    <div class="checkout-form">
        <div v-show="!checkingOut" class="payment-area">
            <h3 class="checkout-form-title">{{ title }}</h3>
            <p class="checkout-form-description">{{ description }}</p>

            <div id="payment-request-button"></div>
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
