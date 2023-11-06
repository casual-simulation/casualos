<template>
    <div>
        <md-dialog
            :md-active.sync="showNotAuthorized"
            class="not-authorized-dialog"
            :md-close-on-esc="false"
            :md-click-outside-to-close="false"
            @md-closed="closeNotAuthorized()"
        >
            <md-dialog-title>Not Authorized</md-dialog-title>
            <md-dialog-content>
                <p>You are not authorized to view this inst.</p>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button @click="changeLogin()">Change Login</md-button>
                <md-button @click="newInst()">New Inst</md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showAccountInfo"
            class="account-info-dialog"
            @md-closed="closeAccountInfo()"
        >
            <md-dialog-title>Account Info</md-dialog-title>
            <md-dialog-content v-if="loginStatus && loginStatus.authData">
                <div>
                    <div class="avatar">
                        <div class="avatar-padding">
                            <img
                                v-if="loginStatus.authData.avatarUrl"
                                :src="loginStatus.authData.avatarUrl"
                            />
                            <md-icon class="md-size-2x" v-else>perm_identity</md-icon>
                        </div>
                    </div>
                    <h3 class="text-center">{{ loginStatus.authData.name }}</h3>
                </div>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button class="md-primary" @click="openAccountDashboard()"
                    >Open Account Dashboard</md-button
                >
                <md-button @click="logout()">Logout</md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./AuthUI.ts"></script>
<style src="./AuthUI.css"></style>
