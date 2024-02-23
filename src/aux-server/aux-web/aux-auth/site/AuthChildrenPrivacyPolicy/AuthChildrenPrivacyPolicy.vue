<template>
    <div class="privacy-policy-container">
        <md-card>
            <md-card-header>
                <h1 class="md-title">Kid's Privacy Notice</h1>
            </md-card-header>
            <md-card-content>
                <p>
                    You can find a plain-text version of this notice
                    <a href="/children-privacy-policy.txt">here</a>.
                </p>

                <p>
                    Here are links to our full
                    <router-link to="/privacy-policy">Privacy Policy</router-link>,
                    <router-link to="/acceptable-use-policy">Acceptable Use Policy</router-link> and
                    <router-link to="/terms">Terms of Service</router-link>.
                </p>

                <div v-html="privacyPolicyHtml"></div>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./AuthChildrenPrivacyPolicy.ts"></script>
<style src="./AuthChildrenPrivacyPolicy.css" scoped></style>
