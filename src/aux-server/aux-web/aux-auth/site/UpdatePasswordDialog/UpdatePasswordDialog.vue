<template>
    <div>
        <md-card>
            <md-card-header>Account Created</md-card-header>
            <md-card-content class="input-dialog-content">
                <div class="md-layout md-gutter">
                    <div class="md-layout-item">
                        <p>
                            Your account has been created. Do you want to set your account password?
                        </p>
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
<script src="./UpdatePasswordDialog.ts"></script>
<style src="./UpdatePasswordDialog.css" scoped></style>
