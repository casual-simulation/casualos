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
                <md-button @click="changeLogin()">{{
                    isLoggedIn ? 'Change Login' : 'Sign In'
                }}</md-button>
                <md-button @click="newInst()">New Inst</md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-dialog
            :md-active.sync="showAccountInfo"
            class="account-info-dialog"
            @md-closed="closeAccountInfo()"
        >
            <md-dialog-title class="show-account-info-title">
                <span>Account Info</span>
                <span class="spacer"></span>
                <a v-if="supportUrl" target="_blank" :href="supportUrl">
                    <md-icon>help</md-icon>
                    <md-tooltip md-direction="bottom">Support</md-tooltip>
                </a>
            </md-dialog-title>
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
                <md-button v-if="reportInstVisible" @click="showReportInst()"
                    >Report Inst</md-button
                >
                <md-button @click="openAccountDashboard()">Manage Account</md-button>
                <md-button @click="logout()">Sign Out</md-button>
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
                    Do you want to grant access to {{ requestingUserName
                    }}<span
                        v-if="
                            requestingUserDisplayName &&
                            requestingUserDisplayName !== requestingUserName
                        "
                    >
                        ({{ requestingUserDisplayName || requestingUserId }})</span
                    >?
                </p>
                <md-field>
                    <label for="grantPermissionLevel">Access Level</label>
                    <md-select
                        v-model="grantPermissionLevel"
                        name="grantPermissionLevel"
                        id="grantPermissionLevel"
                    >
                        <md-option value="full-access">Full Access</md-option>
                        <md-option value="read-only">Read Only</md-option>
                    </md-select>
                </md-field>

                <md-field>
                    <label for="expireTimeMs">Expires</label>
                    <md-select v-model="expireTimeMs" name="expireTimeMs" id="expireTimeMs">
                        <md-option :value="1 * 60 * 60 * 1000">1 Hour</md-option>
                        <md-option :value="6 * 60 * 60 * 1000">6 Hours</md-option>
                        <md-option :value="24 * 60 * 60 * 1000">1 Day</md-option>
                        <md-option :value="7 * 24 * 60 * 60 * 1000">1 Week</md-option>
                        <md-option :value="0">Never</md-option>
                    </md-select>
                </md-field>
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

        <md-dialog
            :md-active.sync="showGrantEntitlements"
            class="grant-entitlements-dialog"
            :md-close-on-esc="true"
            :md-click-outside-to-close="true"
            @md-closed="closeGrantEntitlements()"
        >
            <md-dialog-title>Grant Entitlements?</md-dialog-title>
            <md-dialog-content v-if="entitlementGrantEvent">
                <p>
                    Do you want to grant
                    <strong>{{ entitlementGrantEvent.action.request.packageId }}</strong> the
                    following features?
                </p>
                <div>
                    <p>
                        <strong>Package ID:</strong>
                        <span>{{ entitlementGrantEvent.action.request.packageId }}</span>
                    </p>
                    <p>
                        <strong>Record Name:</strong>
                        <span>{{ entitlementGrantEvent.action.request.recordName }}</span>
                    </p>
                    <p>
                        <strong>Duration:</strong>
                        <span>{{ entitlementGrantEvent.action.request.expireTimeMs }}</span>
                    </p>
                    <div>
                        <strong>Features:</strong>
                        <ul>
                            <li
                                v-for="feature in entitlementGrantEvent.action.request.features"
                                :key="feature"
                            >
                                {{ feature }}
                            </li>
                        </ul>
                    </div>
                </div>
            </md-dialog-content>
            <md-dialog-actions>
                <md-button @click="grantEntitlements()" :disabled="processing">
                    <md-progress-spinner
                        v-if="processing"
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        >Processing</md-progress-spinner
                    >
                    <span v-else>Grant</span>
                </md-button>
                <md-button class="md-primary" @click="closeGrantEntitlements()">Deny</md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./AuthUI.ts"></script>
<style src="./AuthUI.css" scoped></style>
