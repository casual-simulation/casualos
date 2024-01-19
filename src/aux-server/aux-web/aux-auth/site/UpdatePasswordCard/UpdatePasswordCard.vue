<template>
    <div>
        <md-card>
            <md-card-header><div class="md-title">Account Created</div></md-card-header>
            <md-card-content class="input-dialog-content">
                <div class="md-layout md-gutter">
                    <div class="md-layout-item">
                        <p>Your account has been created.</p>

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

                        <p>Do you want to set your account password?</p>
                    </div>
                </div>
            </md-card-content>
            <md-card-actions>
                <md-button
                    :href="updatePasswordUrl"
                    target="_blank"
                    class="md-primary"
                    @click="close()"
                >
                    Set Password
                </md-button>
                <md-button type="button" @click="close()">Go Home</md-button>
            </md-card-actions>
        </md-card>
    </div>
</template>
<script src="./UpdatePasswordCard.ts"></script>
<style src="./UpdatePasswordCard.css" scoped></style>
