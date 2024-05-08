<template>
    <div class="terms-container policy-container">
        <md-card>
            <md-card-header>
                <h1 class="md-title">{{ hostname }} Terms of Service</h1>
            </md-card-header>
            <md-card-content>
                <p>
                    You can find a plain-text version of these terms
                    <a href="/terms-of-service.txt">here</a>.
                </p>
                <p>
                    By using Our products or services, You agree to these Terms of Service as well
                    as Our
                    <router-link to="/code-of-conduct">Code of Conduct</router-link>,
                    <router-link to="/acceptable-use-policy">Acceptable Use Policy</router-link>
                    and
                    <router-link to="/privacy-policy">Privacy Policy</router-link>.
                </p>

                <div v-html="termsHtml"></div>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./AuthTerms.ts"></script>
<style src="./AuthTerms.css" scoped></style>
