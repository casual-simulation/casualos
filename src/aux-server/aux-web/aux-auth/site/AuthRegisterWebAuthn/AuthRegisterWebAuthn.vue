<template>
    <div class="login-container">
        <form @submit.prevent="addPasskey">
            <md-card>
                <md-card-header>
                    <div class="md-title">Add Passkey?</div>
                </md-card-header>
                <md-card-content>
                    <div class="md-layout md-gutter">
                        <div class="md-layout-item">
                            <p>Do you want to add a passkey to your account for this device?</p>
                            <p>
                                Passkeys are quick and secure way to login without using a password.
                            </p>
                            <p>
                                Learn more
                                <a
                                    href="https://blog.google/technology/safety-security/the-beginning-of-the-end-of-the-password/"
                                    target="_blank"
                                    referrerpolicy="no-referrer"
                                    >here.</a
                                >
                            </p>
                            <field-errors :errors="errors" :field="null" />
                        </div>
                    </div>
                </md-card-content>

                <md-card-actions>
                    <md-button @click="cancel()" :disabled="processing">Cancel</md-button>
                    <md-button type="submit" class="md-primary" :disabled="processing">
                        <md-progress-spinner
                            v-if="processing"
                            md-mode="indeterminate"
                            :md-diameter="20"
                            :md-stroke="2"
                            >Processing</md-progress-spinner
                        >
                        <span v-else>Add Passkey</span>
                    </md-button>
                </md-card-actions>
            </md-card>
        </form>
    </div>
</template>
<script src="./AuthRegisterWebAuthn.ts"></script>
<style src="./AuthRegisterWebAuthn.css" scoped></style>
