<template>
    <div class="privacy-policy-container policy-container">
        <md-card>
            <md-card-header>
                <h1 class="md-title">{{ hostname }} Privacy Policy</h1>
            </md-card-header>
            <md-card-content>
                <div v-html="privacyPolicyHtml"></div>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./AuthPrivacyPolicy.ts"></script>
<style src="./AuthPrivacyPolicy.css" scoped></style>
