<template>
    <div>
        <md-card>
            <md-card-header
                ><div class="md-title">
                    {{ credentialSetup ? 'Finish setting up your sign-in' : 'Account Created' }}
                </div></md-card-header
            >
            <md-card-content class="input-dialog-content">
                <div class="md-layout md-gutter">
                    <div class="md-layout-item">
                        <p>
                            {{
                                credentialSetup
                                    ? 'Your registration is saved, but sign-in setup is not finished.'
                                    : 'Your account has been created.'
                            }}
                        </p>
                        <p v-if="credentialSetup">
                            Consent approval and sign-in credentials are separate steps. You need
                            both to use your account. Keep this browser session open until you
                            finish.
                        </p>

                        <p v-if="requireParentEmail">
                            Ask your parent to check their email for a message from
                            <a
                                href="https://www.privo.com/parents#why-is-parent-permission-required"
                                target="_blank"
                                >PRIVO</a
                            >. If they don't see it, ask them to check the spam folder.
                        </p>
                        <p v-else>
                            Check your email for a message from
                            <a
                                href="https://www.privo.com/parents#why-is-parent-permission-required"
                                target="_blank"
                                >PRIVO</a
                            >. If you don't see it, check your spam folder.
                        </p>

                        <p>
                            {{
                                credentialSetup
                                    ? 'Create your sign-in credentials to finish setting up your account.'
                                    : 'Do you want to set your account password?'
                            }}
                        </p>
                    </div>
                </div>
            </md-card-content>
            <md-card-actions>
                <md-button
                    :href="updatePasswordUrl"
                    target="_blank"
                    class="md-raised md-primary"
                    @click="credentialSetup ? null : close()"
                >
                    {{ credentialSetup ? 'Create sign-in credentials' : 'Set Password' }}
                </md-button>
                <md-button v-if="!credentialSetup" type="button" @click="close()"
                    >Go Home</md-button
                >
                <md-button v-else type="button" @click="close()"
                    >Return to account — setup still required</md-button
                >
            </md-card-actions>
        </md-card>
    </div>
</template>
<script src="./UpdatePasswordCard.ts"></script>
<style src="./UpdatePasswordCard.css" scoped></style>
