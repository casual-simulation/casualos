<template>
    <div>
        <h2 class="md-title">Sessions</h2>
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
                                <span class="sr-only">Options</span>
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
    </div>
</template>
<script src="./AuthSecurity.ts"></script>
<style src="./AuthSecurity.css" scoped></style>
