<template>
    <div>
        <md-card>
            <md-card-header>
                <h1 class="md-title">Thank you for your purchase</h1>
            </md-card-header>
            <md-card-content>
                <p>When do you want to activate your purchase?</p>
                <md-button @click="activatePurchase('now')">Now</md-button>
                <md-button @click="activatePurchase('later')">Later</md-button>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./AuthStoreFulfillment.ts"></script>
<style src="./AuthStoreFulfillment.css" scoped></style>
