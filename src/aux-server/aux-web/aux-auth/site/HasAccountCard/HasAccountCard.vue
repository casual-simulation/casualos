<template>
    <div>
        <md-card>
            <md-card-header><div class="md-title">Sign in or Register</div></md-card-header>
            <md-card-content class="input-dialog-content">
                <div class="md-layout md-gutter">
                    <div class="md-layout-item">
                        <p>You are not logged in. What do you want to do?</p>
                    </div>
                </div>
                <p>
                    <router-link to="privacy-policy" target="_blank">Privacy Policy</router-link>
                </p>
            </md-card-content>
            <md-card-actions>
                <md-button
                    type="button"
                    class="md-primary"
                    @click="hasAccount(true)"
                    :disabled="processing"
                >
                    <md-progress-spinner
                        v-if="processing && hasAccountValue === true"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    >
                    <span v-else>Sign In</span>
                </md-button>
                <md-button
                    type="button"
                    class="md-primary"
                    @click="hasAccount(false)"
                    :disabled="processing"
                >
                    <md-progress-spinner
                        v-if="processing && hasAccountValue === false"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    >
                    <span v-else>Create Account</span>
                </md-button>
            </md-card-actions>
        </md-card>
    </div>
</template>
<script src="./HasAccountCard.ts"></script>
<style src="./HasAccountCard.css" scoped></style>
