<template>
    <div>
        <md-card class="fulfillment-card">
            <md-card-header>
                <h1 class="md-title">Thank you for your purchase!</h1>
            </md-card-header>
            <md-card-content>
                <div v-if="activated">
                    <p>Your purchase has been activated!</p>

                    <div v-if="activationKey">
                        Your activation key is:
                        <strong><code>{{ activationKey }}</code></strong>
                    </div>

                    <div v-if="activationUrl">
                        You can activate it by visiting this link:
                        <a :href="activationUrl" target="_blank">{{ activationUrl }}</a>
                    </div>
                </div>
                <div v-else-if="loggedIn">
                    <p>How do you want to use your purchase?</p>
                </div>
                <div v-else>
                    <md-progress-spinner
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        v-if="processing"
                    ></md-progress-spinner>
                    Activating...
                </div>
                <field-errors :field="null" :errors="errors" />
            </md-card-content>
            <md-card-actions>
                <md-button v-if="!activated && loggedIn" class="md-raised md-primary" @click="activatePurchase('now')">
                    <md-progress-spinner
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        v-if="processing"
                    >
                    </md-progress-spinner>
                    <span v-else>For myself</span>
                </md-button>
                <md-button v-if="!activated && loggedIn" class="md-raised" @click="activatePurchase('later')">
                    <md-progress-spinner
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        v-if="processing"
                    >
                    </md-progress-spinner>
                    <span v-else>For someone else</span>
                </md-button>
            </md-card-actions>
        </md-card>
    </div>
</template>
<script src="./AuthStoreFulfillment.ts"></script>
<style src="./AuthStoreFulfillment.css" scoped></style>
