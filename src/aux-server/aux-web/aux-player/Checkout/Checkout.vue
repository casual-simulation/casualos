<template>
    <div>
        <md-dialog :md-active.sync="showCheckoutDialog" @md-closed="closeCheckoutDialog()">
            <checkout-form
                :channelId="simulationId"
                :productId="productId"
                :processingChannel="processingChannel"
                :title="title"
                :description="description"
                :requestBillingAddress="requestBillingAddress"
                @paymentSuccess="checkoutFinished"
            ></checkout-form>
        </md-dialog>
    </div>
</template>
<script src="./Checkout.ts"></script>
<style scoped src="./Checkout.css"></style>
