<template>
    <div>
        <md-dialog :md-active.sync="showCheckoutDialog" @md-closed="closeCheckoutDialog()">
            <checkout-form
                :channelId="simulationId"
                :productId="productId"
                :title="title"
                :description="description"
            ></checkout-form>
        </md-dialog>
    </div>
</template>
<script src="./Checkout.ts"></script>
<style scoped src="./Checkout.css"></style>
