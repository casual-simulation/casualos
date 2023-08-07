<template>
    <div class="studio-container">
        <h2>{{ studioName }}</h2>
        <auth-subscription :studioId="studioId" />

        <h2>Members</h2>
        <div v-if="loadingMembers">
            <div>
                <md-progress-spinner
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                ></md-progress-spinner>
            </div>
            <p class="sr-only">Members Loading...</p>
        </div>
        <div v-else-if="members.length === 0">
            <p>No members</p>
        </div>
        <div v-else>
            <md-table>
                <md-table-row>
                    <md-table-head>Name</md-table-head>
                    <md-table-head>Address</md-table-head>
                    <md-table-head>Role</md-table-head>
                    <md-table-head>Is Primary Contact</md-table-head>
                    <md-table-head>Options</md-table-head>
                </md-table-row>

                <md-table-row v-for="member of members" :key="member.userId">
                    <md-table-cell>{{ member.user.name || member.user.email }}</md-table-cell>
                    <md-table-cell>{{
                        member.user.email || member.user.phoneNumber
                    }}</md-table-cell>
                    <md-table-cell>{{ member.role }}</md-table-cell>
                    <md-table-cell>{{ member.isPrimaryContact }}</md-table-cell>
                    <md-table-cell>
                        <md-menu md-align-trigger>
                            <md-button md-menu-trigger class="md-icon-button">
                                <md-icon>more_vert</md-icon>
                                <span class="sr-only">Member Options</span>
                                <md-tooltip>Member Options</md-tooltip>
                            </md-button>
                            <md-menu-content>
                                <md-menu-item @click="revokeMembership(member)"
                                    >Revoke Membership</md-menu-item
                                >
                            </md-menu-content>
                        </md-menu>
                    </md-table-cell>
                </md-table-row>
            </md-table>
        </div>
    </div>
</template>
<script src="./AuthStudio.ts"></script>
<style src="./AuthStudio.css" scoped></style>
