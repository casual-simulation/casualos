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

        <div v-if="isLoadingInfo">
            <div>
                <md-progress-spinner
                    md-mode="indeterminate"
                    :md-diameter="20"
                    :md-stroke="2"
                ></md-progress-spinner>
            </div>
            <p class="sr-only">Info Loading...</p>
        </div>
        <div v-else class="settings-container">
            <h2>Studio Configuration</h2>
            <md-table class="comId-configuration-table">
                <md-table-row>
                    <md-table-head>Feature</md-table-head>
                    <md-table-head>Value</md-table-head>
                </md-table-row>

                <md-table-row @click="updateStudioInfo()">
                    <md-tooltip>The name of the studio. Click to change.</md-tooltip>
                    <md-table-cell>studio.name</md-table-cell>
                    <md-table-cell>{{ originalDisplayName || '(null)' }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowComId" @click="startRequestComId()">
                    <md-tooltip>The comID for this studio. Click to request new comID.</md-tooltip>
                    <md-table-cell>comID</md-table-cell>
                    <md-table-cell>{{ comId || '(null)' }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowComId" @click="updateComIdConfig()">
                    <md-tooltip
                        >The URL of the logo that this studio uses. Click to change.</md-tooltip
                    >
                    <md-table-cell>comID.logoURL</md-table-cell>
                    <md-table-cell>{{ originalLogoUrl || '(null)' }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowComId">
                    <md-tooltip>The maximum number of studios allowed for this comID.</md-tooltip>
                    <md-table-cell>comID.maxStudios</md-table-cell>
                    <md-table-cell>{{ comIdFeatures.maxStudios || 'Unlimited' }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowComId" @click="updateComIdConfig()">
                    <md-tooltip
                        >Whether anyone can create a studio in this comID. Click to
                        change.</md-tooltip
                    >
                    <md-table-cell>comID.allowAnyoneToCreateStudios</md-table-cell>
                    <md-table-cell>{{ originalAllowAnyoneToCreateStudios }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowComId" @click="updatePlayerConfig()">
                    <md-tooltip
                        >The URL of the bootstrapper that should be used for insts that are created
                        with this comID. Click to change.</md-tooltip
                    >
                    <md-table-cell>comID.ab1BootstrapURL</md-table-cell>
                    <md-table-cell>{{ originalAb1BootstrapUrl || '(default)' }}</md-table-cell>
                </md-table-row>
            </md-table>
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

        <md-dialog :md-active.sync="showRequestComId">
            <md-dialog-title> Request comID </md-dialog-title>
            <md-dialog-content>
                <md-field :class="comIdFieldClass">
                    <label for="comId">comID</label>
                    <md-input id="comId" v-model="requestedComId" type="text"></md-input>
                    <field-errors field="comId" :errors="errors" />
                </md-field>
                <field-errors :field="null" :errors="errors" />
            </md-dialog-content>
            <md-dialog-actions>
                <md-button class="md-primary" @click="requestComId()">
                    <md-progress-spinner
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        v-if="isSavingStudio"
                    >
                    </md-progress-spinner>
                    <span v-else>Request</span>
                </md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-dialog :md-active.sync="showUpdatePlayerConfig" @md-closed="cancelUpdateStudio()">
            <md-dialog-title> Update Player Config </md-dialog-title>
            <md-dialog-content>
                <md-field :class="ab1BootstrapUrlFieldClass">
                    <label for="ab1BootstrapURL">comID.ab1BootstrapURL</label>
                    <md-input id="ab1BootstrapURL" v-model="ab1BootstrapUrl" type="text"></md-input>
                    <field-errors field="ab1BootstrapURL" :errors="errors" />
                </md-field>
                <field-errors :field="null" :errors="errors" />
            </md-dialog-content>

            <md-dialog-actions>
                <md-button class="md-primary" @click="saveStudio()">
                    <md-progress-spinner
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        v-if="isSavingStudio"
                    >
                    </md-progress-spinner>
                    <span v-else>Save</span>
                </md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-dialog :md-active.sync="showUpdateComIdConfig" @md-closed="cancelUpdateStudio()">
            <md-dialog-title> Update comID Config </md-dialog-title>
            <md-dialog-content>
                <md-field :class="logoUrlFieldClass">
                    <label for="logoUrl">Logo URL</label>
                    <md-input id="logoUrl" v-model="logoUrl" type="text"></md-input>
                    <field-errors field="logoUrl" :errors="errors" />
                </md-field>
                <md-field :class="allowAnyoneToCreateStudiosFieldClass">
                    <label for="logoUrl">Who can create studios?</label>
                    <md-select v-model="allowAnyoneToCreateStudios">
                        <md-option :value="true">Anyone</md-option>
                        <md-option :value="false">Only Members</md-option>
                    </md-select>
                    <field-errors field="allowAnyoneToCreateStudios" :errors="errors" />
                </md-field>
                <field-errors :field="null" :errors="errors" />
            </md-dialog-content>
            <md-dialog-actions>
                <md-button class="md-primary" @click="saveStudio()">
                    <md-progress-spinner
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        v-if="isSavingStudio"
                    >
                    </md-progress-spinner>
                    <span v-else>Save</span>
                </md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-dialog :md-active.sync="showUpdateStudioInfo" @md-closed="cancelUpdateStudio()">
            <md-dialog-title> Update Studio Info </md-dialog-title>
            <md-dialog-content>
                <md-field :class="displayNameFieldClass">
                    <label for="displayName">Studio Name</label>
                    <md-input id="displayName" v-model="displayName" type="text"></md-input>
                    <field-errors field="displayName" :errors="errors" />
                </md-field>
                <field-errors :field="null" :errors="errors" />
            </md-dialog-content>
            <md-dialog-actions>
                <md-button class="md-primary" @click="saveStudio()">
                    <md-progress-spinner
                        md-mode="indeterminate"
                        :md-diameter="20"
                        :md-stroke="2"
                        v-if="isSavingStudio"
                    >
                    </md-progress-spinner>
                    <span v-else>Save</span>
                </md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./AuthStudio.ts"></script>
<style src="./AuthStudio.css" scoped></style>
