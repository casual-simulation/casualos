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
                    <md-table-head v-if="isAdmin">Options</md-table-head>
                </md-table-row>

                <md-table-row v-for="member of members" :key="member.userId">
                    <md-table-cell>{{ member.user.name || member.user.email }}</md-table-cell>
                    <md-table-cell>{{
                        member.user.email || member.user.phoneNumber
                    }}</md-table-cell>
                    <md-table-cell>{{ member.role }}</md-table-cell>
                    <md-table-cell>{{ member.isPrimaryContact }}</md-table-cell>
                    <md-table-cell v-if="isAdmin">
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

            <md-button v-if="isAdmin" class="md-raised md-primary" @click="openAddMember()"
                >Add Member</md-button
            >
        </div>

        <md-dialog :md-active.sync="showAddMember">
            <md-dialog-content v-if="addingMember">
                <div>
                    <md-progress-spinner
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                    ></md-progress-spinner>
                </div>
                <p class="sr-only">Adding Member...</p>
            </md-dialog-content>
            <md-dialog-content v-else>
                <md-field :class="addressFieldClass">
                    <label>Email</label>
                    <md-input v-model="addMemberEmail" />
                    <span v-if="addMemberErrorCode === 'user_not_found'" class="md-error"
                        >No user with this email was found.</span
                    >
                    <span v-else-if="addMemberErrorCode" class="md-error">An error occurred.</span>
                </md-field>
                <md-field>
                    <label>Role</label>
                    <md-select v-model="addMemberRole">
                        <md-option value="admin">Admin</md-option>
                        <md-option value="member">Member</md-option>
                    </md-select>
                </md-field>
            </md-dialog-content>

            <md-dialog-actions>
                <md-button @click="closeAddMember()">Cancel</md-button>
                <md-button class="md-primary" @click="addMember()">Add Member</md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./AuthStudio.ts"></script>
<style src="./AuthStudio.css" scoped></style>
