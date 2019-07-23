<template>
    <div>
        <form novalidate class="md-layout login-form" @submit.prevent="createUser">
            <md-card>
                <md-card-header>
                    <div class="md-title">Sign in</div>
                </md-card-header>

                <md-card-content>
                    <div v-if="!showProgress">
                        <div v-if="loginReason">
                            <div v-if="loginReason === 'wrong_token'">
                                The token doesn't match the one on file.
                            </div>
                            <div v-if="loginReason === 'wrong_grant'">
                                The grant doesn't match the one on file.
                            </div>
                            <div v-if="loginReason === 'invalid_username'">
                                Your username is invalid.
                            </div>
                            <div v-if="loginReason === 'invalid_token'">
                                Your auto-generated token is invalid.
                            </div>
                        </div>
                        <div v-if="showList">
                            <md-list>
                                <md-list-item
                                    v-for="user in users"
                                    :key="user.username"
                                    @click="signIn(user)"
                                >
                                    <span class="md-list-item-text">{{ user.username }}</span>
                                </md-list-item>
                            </md-list>
                        </div>

                        <div v-else-if="showCreateAccount">
                            <md-field>
                                <label for="name">Name</label>
                                <md-input
                                    name="name"
                                    id="name"
                                    autocomplete="name"
                                    v-model="email"
                                />
                            </md-field>
                        </div>
                        <div v-else>
                            <div v-if="showQRCode">
                                <div class="qr-scanner-container">
                                    <h3>Scan your account QR Code</h3>
                                    <qrcode-stream @decode="onQRCodeScanned"></qrcode-stream>
                                </div>
                            </div>
                            <div class="create-account-section">
                                <span>Don't see your account?</span>
                                <a class="md-primary guest-button" @click="createAccount()"
                                    >Add or create account</a
                                >
                            </div>
                        </div>

                        <div class="continue-as-guest-section">
                            <span>Don't want an account?</span>
                            <a class="md-primary guest-button" @click="continueAsGuest"
                                >Continue as a Guest</a
                            >
                        </div>
                    </div>
                    <div v-else class="progress-section">
                        <p>Logging in...</p>
                        <md-progress-spinner md-mode="indeterminate"></md-progress-spinner>
                    </div>
                </md-card-content>

                <md-card-actions>
                    <md-button
                        v-if="!showProgress && showCreateAccount"
                        type="submit"
                        class="md-primary md-raised"
                        >Next</md-button
                    >
                </md-card-actions>
            </md-card>
        </form>
    </div>
</template>
<script src="./PlayerWelcome.ts"></script>
<style src="./PlayerWelcome.css" scoped></style>
