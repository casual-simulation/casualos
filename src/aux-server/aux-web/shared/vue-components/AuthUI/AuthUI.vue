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
                <field-errors :field="null" :errors="requestAccessErrors" />
            </md-dialog-content>
            <md-dialog-actions>
                <md-button
                    v-if="allowRequestAccess"
                    @click="requestAccess()"
                    :disabled="requestingAccess"
                >
                    <md-progress-spinner
                        v-if="requestingAccess"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    >
                    <span v-else>Request Access</span>
                </md-button>
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
                    <h3 class="text-center">
                        {{ loginStatus.authData.name }}
                        <span v-show="loginStatus.authData.displayName"
                            >({{ loginStatus.authData.displayName }})</span
                        >
                    </h3>
                </div>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button @click="showReportInst()">Report Inst</md-button>
                <md-button class="md-primary" @click="openAccountDashboard()"
                    >Manage Account</md-button
                >
                <md-button @click="logout()">Logout</md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showGrantAccess"
            class="account-info-dialog"
            @md-closed="closeAccountInfo()"
        >
            <md-dialog-title>Grant Access?</md-dialog-title>
            <md-dialog-content>
                <p>
                    Do you want to grant access to {{ requestingUserName }}
                    <span v-if="requestingUserDisplayName"
                        >({{ requestingUserDisplayName || requestingUserId }})</span
                    >?
                </p>
                <field-errors :field="null" :errors="grantAccessErrors" />
            </md-dialog-content>
            <md-dialog-actions>
                <md-button @click="grantAccess()" :disabled="processing">
                    <md-progress-spinner
                        v-if="processing"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    >
                    <span v-else>Grant Access</span>
                </md-button>
                <md-button @click="denyAccess()">Deny Access</md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./AuthUI.ts"></script>
<style src="./AuthUI.css"></style>
