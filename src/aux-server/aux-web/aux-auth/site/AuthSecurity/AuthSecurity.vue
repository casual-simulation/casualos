<template>
    <div>
        <div class="passkeys-title">
            <h2 class="md-title">Passkeys</h2>
            <md-menu md-align-trigger>
                <md-button md-menu-trigger class="md-icon-button">
                    <md-icon>more_vert</md-icon>
                    <span class="sr-only">Passkey Options</span>
                    <md-tooltip>Passkey Options</md-tooltip>
                </md-button>
                <md-menu-content>
                    <md-menu-item @click="addPasskey()">Create Passkey</md-menu-item>
                </md-menu-content>
            </md-menu>
        </div>
        <div>
            <md-table v-if="passkeys.length > 0">
                <md-table-row>
                    <md-table-head>ID</md-table-head>
                    <md-table-head>Name</md-table-head>
                    <md-table-head>Description</md-table-head>
                    <md-table-head>Created</md-table-head>
                    <md-table-head>Granted</md-table-head>
                </md-table-row>

                <md-table-row v-for="passkey of passkeys" :key="passkey.id">
                    <md-table-cell>{{ passkey.id.substring(0, 8) }}</md-table-cell>
                    <md-table-cell>
                        <span>{{ passkey.name }}</span>
                        <md-tooltip
                            >Used {{ passkey.counter }}
                            {{ passkey.counter === 1 ? 'time' : 'times' }}</md-tooltip
                        >
                    </md-table-cell>
                    <md-table-cell>
                        <span>{{ passkey.creationDescription }}</span>
                        <md-tooltip>{{ passkey.userAgentDescription }}</md-tooltip>
                    </md-table-cell>
                    <md-table-cell><relative-time :millis="passkey.createdAtMs" /></md-table-cell>
                    <md-table-cell>
                        <md-menu md-align-trigger>
                            <md-button md-menu-trigger class="md-icon-button">
                                <md-icon>more_vert</md-icon>
                                <span class="sr-only">Passkey Options</span>
                                <md-tooltip>Passkey Options</md-tooltip>
                            </md-button>
                            <md-menu-content>
                                <md-menu-item @click="deletePasskey(passkey)"
                                    >Delete Passkey</md-menu-item
                                >
                            </md-menu-content>
                        </md-menu>
                    </md-table-cell>
                </md-table-row>
            </md-table>
            <div v-else>
                <p>No passkeys found.</p>
                <md-button @click="addPasskey()">Create Passkey</md-button>
            </div>
        </div>
        <div class="sessions-title">
            <h2 class="md-title">Sessions</h2>
            <md-menu md-align-trigger>
                <md-button md-menu-trigger class="md-icon-button">
                    <md-icon>more_vert</md-icon>
                    <span class="sr-only">All Session Options</span>
                    <md-tooltip>All Session Options</md-tooltip>
                </md-button>
                <md-menu-content>
                    <md-menu-item @click="requestRevokeAllSessions()"
                        >Revoke All Sessions</md-menu-item
                    >
                </md-menu-content>
            </md-menu>
        </div>
        <div>
            <md-table>
                <md-table-row>
                    <md-table-head>ID</md-table-head>
                    <md-table-head>Location</md-table-head>
                    <md-table-head>Status</md-table-head>
                    <md-table-head>Granted</md-table-head>
                </md-table-row>

                <md-table-row v-for="session of sessions" :key="session.sessionId">
                    <md-table-cell>{{ session.sessionId.substring(0, 8) }}</md-table-cell>
                    <md-table-cell><session-location :session="session" /></md-table-cell>
                    <md-table-cell>
                        <span v-if="session.revokeTimeMs"
                            >Revoked <relative-time :millis="session.revokeTimeMs"
                        /></span>
                        <span v-else>Expires <relative-time :millis="session.expireTimeMs" /></span>
                    </md-table-cell>
                    <md-table-cell><relative-time :millis="session.grantedTimeMs" /></md-table-cell>
                    <md-table-cell>
                        <md-menu md-align-trigger>
                            <md-button
                                v-if="!session.revokeTimeMs"
                                md-menu-trigger
                                class="md-icon-button"
                            >
                                <md-icon>more_vert</md-icon>
                                <span class="sr-only">Session Options</span>
                                <md-tooltip>Session Options</md-tooltip>
                            </md-button>
                            <md-menu-content>
                                <md-menu-item @click="revokeSession(session)"
                                    >Revoke Session</md-menu-item
                                >
                            </md-menu-content>
                        </md-menu>
                    </md-table-cell>
                </md-table-row>
            </md-table>
        </div>

        <md-dialog-confirm
            :md-active.sync="showConfirmRevokeAllSessions"
            md-title="Revoke All Sessions?"
            md-content="Are you sure you want to revoke all of the active sessions? This will log you out everywhere."
            md-confirm-text="Revoke"
            md-cancel-text="Cancel"
            @md-cancel="cancelRevokeAllSessions"
            @md-confirm="revokeAllSessions"
        />
    </div>
</template>
<script src="./AuthSecurity.ts"></script>
<style src="./AuthSecurity.css" scoped></style>
