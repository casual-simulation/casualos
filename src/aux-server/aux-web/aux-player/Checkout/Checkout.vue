<template>
    <div>
        <md-dialog :md-active.sync="showCheckoutDialog" @md-closed="closeCheckoutDialog()">
            <checkout-form
                :channelId="simulationId"
                :productId="productId"
                :processingUniverse="processingUniverse"
                :title="title"
                :description="description"
                :requestBillingAddress="requestBillingAddress"
                :paymentRequest="paymentRequest"
                :publishableKey="publishableKey"
                @paymentSuccess="checkoutFinished"
                @paymentCanceled="checkoutCanceled"
            ></checkout-form>
        </md-dialog>
    </div>
</template>
<script src="./Checkout.ts"></script>
<style scoped src="./Checkout.css"></style>
