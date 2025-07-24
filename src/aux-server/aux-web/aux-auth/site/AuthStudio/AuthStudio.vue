<template>
    <div class="studio-container">
        <h2>
            <img v-if="logoUrl" :src="logoUrl" class="logo" :alt="studioName" />
            <span v-else>{{ studioName }}</span>
        </h2>

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
                        member.user.email || member.user.phoneNumber || member.user.displayName
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
                <md-table-row v-if="allowComId" @click="updateComIdConfig()">
                    <md-tooltip
                        >The background color that should be used when displaying the logo. Click to
                        change.</md-tooltip
                    >
                    <md-table-cell>comID.logoBackgroundColor</md-table-cell>
                    <md-table-cell>{{ originalLogoBackgroundColor || '(null)' }}</md-table-cell>
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
                    <md-table-cell>comID.allowedStudioCreators</md-table-cell>
                    <md-table-cell>{{ originalAllowedStudioCreators }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowComId" @click="updatePlayerConfig()">
                    <md-tooltip
                        >The URL of the bootstrapper that should be used for insts that are created
                        with this comID. Click to change.</md-tooltip
                    >
                    <md-table-cell>comID.ab1BootstrapURL</md-table-cell>
                    <md-table-cell>{{ originalAb1BootstrapUrl || '(default)' }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowComId" @click="updatePlayerConfig()">
                    <md-tooltip>The list of options that can be selected from the BIOS.</md-tooltip>
                    <md-table-cell>comID.allowedBiosOptions</md-table-cell>
                    <md-table-cell>{{ originalAllowedBiosOptions || '(default)' }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowComId" @click="updatePlayerConfig()">
                    <md-tooltip>The option that is selected in the BIOS by default.</md-tooltip>
                    <md-table-cell>comID.defaultBiosOption</md-table-cell>
                    <md-table-cell>{{ originalDefaultBiosOption || '(default)' }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowComId" @click="updatePlayerConfig()">
                    <md-tooltip
                        >The option that is automatically executed when no BIOS option is specified
                        in the URL.</md-tooltip
                    >
                    <md-table-cell>comID.automaticBiosOption</md-table-cell>
                    <md-table-cell>{{ originalAutomaticBiosOption || '(default)' }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowComId" @click="updatePlayerConfig()">
                    <md-tooltip
                        >The name of the Jitsi App that should be used for the
                        meetPortal.</md-tooltip
                    >
                    <md-table-cell>comID.jitsiAppName</md-table-cell>
                    <md-table-cell>{{ originalJitsiAppName || '(default)' }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowComId" @click="updatePlayerConfig()">
                    <md-tooltip
                        >The API Key that should be used for what3words integration.</md-tooltip
                    >
                    <md-table-cell>comID.what3WordsApiKey</md-table-cell>
                    <md-table-cell>{{ originalWhat3WordsApiKey || '(default)' }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowLoom" @click="updateLoomConfig()">
                    <md-tooltip
                        >The public App ID of the Loom app that should be used for the
                        studio.</md-tooltip
                    >
                    <md-table-cell>loom.publicAppId</md-table-cell>
                    <md-table-cell>{{ originalLoomPublicAppId || '(not set)' }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowLoom" @click="updateLoomConfig()">
                    <md-tooltip>The private key that Loom generated for the app.</md-tooltip>
                    <md-table-cell>loom.privateKey</md-table-cell>
                    <md-table-cell>{{ '(secret)' }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowHume" @click="updateHumeConfig()">
                    <md-tooltip>The API key that used to access Hume.</md-tooltip>
                    <md-table-cell>hume.apiKey</md-table-cell>
                    <md-table-cell>{{ originalHumeApiKey || '(not set)' }}</md-table-cell>
                </md-table-row>
                <md-table-row v-if="allowHume" @click="updateHumeConfig()">
                    <md-tooltip>The Secret API key that used to access Hume.</md-tooltip>
                    <md-table-cell>hume.secretKey</md-table-cell>
                    <md-table-cell>{{ '(secret)' }}</md-table-cell>
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
                    <label>Email <span v-if="usePrivoLogin">or Display Name</span></label>
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
            <md-dialog-content class="player-config-dialog">
                <md-field :class="ab1BootstrapUrlFieldClass">
                    <label for="ab1BootstrapURL">comID.ab1BootstrapURL</label>
                    <md-input id="ab1BootstrapURL" v-model="ab1BootstrapUrl" type="text"></md-input>
                    <span class="md-helper-text">The URL of the bootstrapper.</span>
                    <field-errors field="playerConfig.ab1BootstrapUrl" :errors="errors" />
                </md-field>
                <md-field :class="allowedBiosOptionsFieldClass">
                    <label for="allowedBiosOptions">comID.allowedBiosOptions</label>
                    <md-select
                        name="allowedBiosOptions"
                        id="allowedBiosOptions"
                        v-model="allowedBiosOptions"
                        multiple
                    >
                        <md-option value="join inst">join inst</md-option>
                        <md-option value="local inst">local inst</md-option>
                        <md-option value="free inst">free inst</md-option>
                        <md-option value="studio inst">studio inst</md-option>
                        <md-option value="sign in">sign in</md-option>
                        <md-option value="sign up">sign up</md-option>
                        <md-option value="sign out">sign out</md-option>
                    </md-select>
                    <span class="md-helper-text">The allowed BIOS options.</span>
                    <field-errors field="playerConfig.allowedBiosOptions" :errors="errors" />
                </md-field>
                <md-field :class="defaultBiosOptionFieldClass">
                    <label for="defaultBiosOption">comID.defaultBiosOption</label>
                    <md-select
                        name="defaultBiosOption"
                        id="defaultBiosOption"
                        v-model="defaultBiosOption"
                    >
                        <md-option :value="0">(default)</md-option>
                        <md-option value="join inst">join inst</md-option>
                        <md-option value="local inst">local inst</md-option>
                        <md-option value="free inst">free inst</md-option>
                        <md-option value="studio inst">studio inst</md-option>
                        <md-option value="sign in">sign in</md-option>
                        <md-option value="sign up">sign up</md-option>
                        <md-option value="sign out">sign out</md-option>
                    </md-select>
                    <span class="md-helper-text">The default BIOS option.</span>
                    <field-errors field="playerConfig.defaultBiosOption" :errors="errors" />
                </md-field>
                <md-field :class="automaticBiosOptionFieldClass">
                    <label for="automaticBiosOption">comID.automaticBiosOption</label>
                    <md-select
                        name="automaticBiosOption"
                        id="automaticBiosOption"
                        v-model="automaticBiosOption"
                    >
                        <md-option :value="0">(default)</md-option>
                        <md-option value="join inst">join inst</md-option>
                        <md-option value="local inst">local inst</md-option>
                        <md-option value="free inst">free inst</md-option>
                        <md-option value="studio inst">studio inst</md-option>
                        <md-option value="sign in">sign in</md-option>
                        <md-option value="sign up">sign up</md-option>
                        <md-option value="sign out">sign out</md-option>
                    </md-select>
                    <span class="md-helper-text">The automatic BIOS option.</span>
                    <field-errors field="playerConfig.automaticBiosOption" :errors="errors" />
                </md-field>
                <md-field :class="jitsiAppNameFieldClass">
                    <label for="jistiAppName">comID.jistiAppName</label>
                    <md-input id="jistiAppName" v-model="jitsiAppName" type="text"></md-input>
                    <span class="md-helper-text"
                        >The name of the
                        <a href="https://jaas.8x8.vc/#/" target="_blank">Jitsi App</a> that the
                        meetPortal uses.</span
                    >
                    <field-errors field="playerConfig.jistiAppName" :errors="errors" />
                </md-field>
                <md-field :class="what3WordsApiKeyFieldClass">
                    <label for="what3WordsApiKey">comID.what3WordsApiKey</label>
                    <md-input
                        id="what3WordsApiKey"
                        v-model="what3WordsApiKey"
                        type="text"
                    ></md-input>
                    <span class="md-helper-text"
                        >The <a href="https://what3words.com/">what3words</a> API Key.</span
                    >
                    <field-errors field="playerConfig.what3WordsApiKey" :errors="errors" />
                </md-field>
                <md-field :class="arcGisApiKeyFieldClass">
                    <label for="arcGisApiKey">comID.ArcGISApiKey</label>
                    <md-input id="arcGisApiKey" v-model="arcGisApiKey" type="text"></md-input>
                    <span class="md-helper-text"
                        >The <a href="https://www.arcgis.com/index.html">ArcGIS</a> API Key that the
                        mapPortal uses.</span
                    >
                    <field-errors field="playerConfig.arcGisApiKey" :errors="errors" />
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
                <md-field :class="logoBackgroundColorFieldClass">
                    <label for="logoBackgroundColor">Logo Background Color</label>
                    <md-input
                        id="logoBackgroundColor"
                        v-model="logoBackgroundColor"
                        type="text"
                    ></md-input>
                    <!-- <md-input id="logoBackgroundColor" v-model="logoBackgroundColor" type="text"></md-input> -->
                    <field-errors field="logoBackgroundColor" :errors="errors" />
                </md-field>
                <!-- TODO: Support uploading logos -->
                <!-- <file-pond :allow-multiple="false" @addFile="onLogoFileAdded" @removeFile="onLogoFileRemoved" accepted-file-types="image/jpeg, image/png, image/gif, image/webp"/> -->
                <md-field :class="allowedStudioCreatorsFieldClass">
                    <label for="logoUrl">Who can create studios?</label>
                    <md-select v-model="allowedStudioCreators">
                        <md-option value="anyone">Anyone</md-option>
                        <md-option value="only-members">Only Members</md-option>
                    </md-select>
                    <field-errors field="comIdConfig.allowedStudioCreators" :errors="errors" />
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

        <md-dialog :md-active.sync="showUpdateLoomConfig" @md-closed="cancelUpdateStudio()">
            <md-dialog-title> Update Loom Config</md-dialog-title>
            <md-dialog-content>
                <md-field :class="loomPublicAppIdFieldClass">
                    <label for="loomPublicAppId">Loom Public App ID</label>
                    <md-input id="loomPublicAppId" v-model="loomPublicAppId" type="text"></md-input>
                    <field-errors field="loomPublicAppId" :errors="errors" />
                </md-field>
                <md-field :class="loomPrivateKeyFieldClass">
                    <label for="loomPrivateKey">Loom Private Key</label>
                    <md-textarea id="loomPrivateKey" v-model="loomPrivateKey"></md-textarea>
                    <field-errors field="loomPrivateKey" :errors="errors" />
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

        <md-dialog :md-active.sync="showUpdateHumeConfig" @md-closed="cancelUpdateStudio()">
            <md-dialog-title> Update Hume Config</md-dialog-title>
            <md-dialog-content>
                <md-field :class="humeApiKeyFieldClass">
                    <label for="humeApiKey">Loom Public App ID</label>
                    <md-input id="humeApiKey" v-model="humeApiKey" type="text"></md-input>
                    <field-errors field="humeConfig.apiKey" :errors="errors" />
                </md-field>
                <md-field :class="humeSecretKeyFieldClass">
                    <label for="humeSecretKey">Hume Secret Key</label>
                    <md-input id="humeSecretKey" v-model="humeSecretKey" type="text"></md-input>
                    <field-errors field="humeConfig.secretKey" :errors="errors" />
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
