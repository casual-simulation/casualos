<template>
    <div class="login-container">
        <form @submit.prevent="sendCode">
            <md-card>
                <md-card-header>
                    <div class="md-title">{{ checkAddressTitle }}</div>
                </md-card-header>
                <md-card-content>
                    <div class="md-layout md-gutter">
                        <div class="md-layout-item">
                            <p>
                                We sent a login code to <strong>{{ address }}</strong
                                >. Enter it below to complete login.
                            </p>
                            <md-field :class="codeFieldClass">
                                <label for="code">Code</label>
                                <md-input
                                    name="code"
                                    id="code"
                                    v-model="code"
                                    :disabled="processing"
                                />
                                <span v-if="showCodeError" class="md-error"
                                    >Please enter the login code</span
                                >
                                <span v-if="showInvalidCodeError" class="md-error"
                                    >The provided code was invalid</span
                                >
                            </md-field>
                        </div>
                    </div>
                </md-card-content>

                <md-card-actions>
                    <md-button @click="cancelLogin()" :disabled="processing">Cancel</md-button>
                    <md-button type="submit" class="md-primary" :disabled="processing"
                        >Send</md-button
                    >
                </md-card-actions>
            </md-card>
        </form>
    </div>
</template>
<script src="./AuthEnterCode.ts"></script>
<style src="./AuthEnterCode.css" scoped></style>
