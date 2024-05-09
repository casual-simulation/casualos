<template>
    <div class="acceptable-use-policy-container policy-container">
        <md-card>
            <md-card-header>
                <h1 class="md-title">Casual Simulation Web Services Acceptable Use Policy</h1>
            </md-card-header>
            <md-card-content>
                <p>
                    You can find a plain-text version of this acceptable use policy
                    <a href="/acceptable-use-policy.txt">here</a>.
                </p>
                <p>
                    By using our products or services, you agree to this Acceptable Use Policy as
                    well as our <router-link to="/code-of-conduct">Code of Conduct</router-link>,
                    <router-link to="/terms">Terms of Service</router-link> and
                    <router-link to="/privacy-policy">Privacy Policy</router-link>.
                </p>
                <div v-html="acceptableUsePolicyHtml"></div>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./AuthAcceptableUsePolicy.ts"></script>
<style src="./AuthAcceptableUsePolicy.css" scoped></style>
