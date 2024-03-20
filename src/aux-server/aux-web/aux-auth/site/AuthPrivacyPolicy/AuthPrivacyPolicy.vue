<template>
    <div class="privacy-policy-container policy-container">
        <md-card>
            <md-card-header>
                <h1 class="md-title">{{ hostname }} Privacy Policy</h1>
            </md-card-header>
            <md-card-content>
                <!-- <p>
                    <strong
                        >If you are a kid and you want an explaination of how we use your data, you
                        can find it <a href="/children-privacy-policy">here</a>.</strong
                    >
                </p>

                <p>
                    You can find a plain-text version of this privacy policy
                    <a href="/privacy-policy.txt">here</a>.
                </p>

                <p>
                    By using our products or services, you agree to this Privacy Policy as well as
                    our
                    <router-link to="/acceptable-use-policy">Acceptable Use Policy</router-link> and
                    <router-link to="/terms">Terms of Service</router-link>.
                </p> -->

                <div v-html="privacyPolicyHtml"></div>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./AuthPrivacyPolicy.ts"></script>
<style src="./AuthPrivacyPolicy.css" scoped></style>
