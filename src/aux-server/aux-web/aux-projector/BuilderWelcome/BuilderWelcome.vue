<template>
    <div>
        <form novalidate class="md-layout login-form" @submit.prevent="createUser">
            <md-card>
                <md-card-header>
                    <div class="md-title">
                        {{ shouldCreateAccount ? 'Create Account' : 'Sign in' }}
                    </div>
                </md-card-header>

                <md-card-content>
                    <div v-if="!showProgress">
                        <md-list>
                            <md-list-item
                                v-for="user in users"
                                :key="user.username"
                                @click="signIn(user)"
                            >
                                <span class="md-list-item-text">{{ user.username }}</span>
                            </md-list-item>
                        </md-list>

                        <!-- <div v-if="shouldCreateAccount">
                            <md-field>
                                <label for="name">Name</label>
                                <md-input
                                    name="name"
                                    id="name"
                                    autocomplete="name"
                                    v-model="email"
                                />
                            </md-field>

                            <div v-if="needsGrant">
                                This username is already in use.
                            </div>
                        </div>
                        <div v-else>
                            <div class="qr-scanner-container">
                                <h3>Scan your account QR Code</h3>
                                <qrcode-stream @decode="onQRCodeScanned"></qrcode-stream>
                            </div>

                            <md-field>
                                <label for="token">Or enter the token manually</label>
                                <md-input
                                    name="token"
                                    id="token"
                                    v-model="grant"
                                />
                            </md-field>
                        </div>
                        <div v-if="!shouldCreateAccount" class="create-account-section">
                            <span>Don't have an account?</span>
                            <a class="md-primary guest-button" @click="createAccount"
                                >Create account</a
                            >
                        </div>
                        <div v-else class="">
                            <span>Have an account?</span>
                            <a class="md-primary guest-button" @click="signIn"
                                >Sign in</a
                            >
                        </div>
                        <div class="continue-as-guest-section">
                            <span>Don't want an account?</span>
                            <a class="md-primary guest-button" @click="continueAsGuest"
                                >Continue as a Guest</a
                            >
                        </div> -->
                    </div>
                    <div v-else class="progress-section">
                        <p>Logging in...</p>
                        <md-progress-spinner md-mode="indeterminate"></md-progress-spinner>
                    </div>
                </md-card-content>

                <md-card-actions>
                    <md-button
                        v-if="!showProgress && shouldCreateAccount"
                        type="submit"
                        class="md-primary md-raised"
                        >Next</md-button
                    >
                </md-card-actions>
            </md-card>
        </form>
    </div>
</template>
<script src="./BuilderWelcome.ts"></script>
<style src="./BuilderWelcome.css" scoped></style>
