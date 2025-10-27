<template>
    <div>
        <div class="home-container">
            <!-- <h1 class="md-title">You are logged in!</h1> -->

            <div v-if="metadata">
                <h2 class="md-title">Profile</h2>
                <div>
                    <md-field>
                        <label for="firstName">First Name</label>
                        <md-input
                            id="firstName"
                            v-model="metadata.name"
                            type="text"
                            placeholder="First Name"
                        ></md-input>
                    </md-field>
                </div>
                <div class="button-field" v-if="metadata.email">
                    <md-field class="md-disabled">
                        <label for="email">Email</label>
                        <md-input
                            id="email"
                            v-model="metadata.email"
                            type="text"
                            placeholder="Email"
                            disabled
                        ></md-input>
                    </md-field>
                </div>
                <div class="button-field" v-if="metadata.phone">
                    <md-field class="md-disabled">
                        <label for="phone">Phone</label>
                        <md-input
                            id="phone"
                            v-model="metadata.phone"
                            type="text"
                            placeholder="Phone"
                            disabled
                        ></md-input>
                    </md-field>
                </div>

                <p v-show="updating">Updating...</p>
                <p v-show="updated">Updated!</p>

                <div v-if="showPrivacyFeatures">
                    <h2 class="md-title">Privacy</h2>
                    <md-card class="privacy-card">
                        <md-card-header class="privacy-card-title">
                            <span class="md-title">Features</span>
                            <span class="spacer"></span>
                            <md-button class="md-icon-button" @click="showPrivacyFeaturesOptions()">
                                <md-icon>settings</md-icon>
                                <md-tooltip md-direction="bottom">Settings</md-tooltip>
                            </md-button>
                        </md-card-header>
                        <md-card-content>
                            <ul class="privacy-list">
                                <privacy-item :value="privacyFeatures.publishData"
                                    >Build Private Eggs</privacy-item
                                >
                                <privacy-item :value="privacyFeatures.allowPublicData"
                                    >Publish Public Eggs</privacy-item
                                >
                                <privacy-item :value="privacyFeatures.allowPublicInsts"
                                    >Join & Collaborate</privacy-item
                                >
                                <privacy-item :value="privacyFeatures.allowAI"
                                    >Build AI Eggs</privacy-item
                                >
                            </ul>
                        </md-card-content>
                    </md-card>
                </div>

                <div v-if="showXpFeatures">
                    <h2 class="md-title">XP</h2>
                    <div v-if="!stripeAccountStatus">
                        <p>Your XP account is not setup.</p>
                    </div>
                    <div v-else-if="stripeAccountStatus === 'active'">
                        <div v-if="stripeRequirementsStatus === 'complete'">
                            <p>Your XP account is active.</p>
                        </div>
                        <div v-else>
                            <p>
                                Your XP account has been created, but we need some additional
                                information before it can be fully activated.
                            </p>
                        </div>
                    </div>
                    <div v-else-if="stripeAccountStatus === 'pending'">
                        <div v-if="stripeRequirementsStatus === 'complete'">
                            <p>Your XP account is awaiting approval.</p>
                        </div>
                        <div v-else>
                            <p>
                                Your XP account has been created, but we need some additional
                                information before it can be fully approved.
                            </p>
                        </div>
                    </div>
                    <div v-else-if="stripeAccountStatus === 'rejected'">
                        <p>Your XP account has been rejected.</p>
                    </div>
                    <div v-else-if="stripeAccountStatus === 'disabled'">
                        <p>Your XP account is disabled.</p>

                        <div v-if="stripeRequirementsStatus === 'complete'"></div>
                        <div v-else>
                            <p>
                                Your XP account has been created, but we need some additional
                                information before it can be fully activated.
                            </p>
                            <p>Click "Manage" below to provide the required information.</p>
                        </div>
                    </div>
                    <md-button class="md-primary" @click="manageXpAccount()">
                        <md-progress-spinner
                            md-mode="indeterminate"
                            :md-diameter="20"
                            :md-stroke="2"
                            v-if="isManagingStore"
                        >
                        </md-progress-spinner>
                        <span v-else-if="!stripeAccountStatus">Setup</span>
                        <span v-else>Dashboard</span>
                    </md-button>
                </div>

                <subscription />
                <security />

                <md-dialog :md-active.sync="showPrivacyFeaturesModal">
                    <md-dialog-title>Privacy Features Options</md-dialog-title>
                    <md-dialog-content>
                        <ul class="privacy-list">
                            <privacy-item :value="privacyFeatures.publishData"
                                >Build Private Eggs</privacy-item
                            >
                            <privacy-item :value="privacyFeatures.allowPublicData"
                                >Publish Public Eggs</privacy-item
                            >
                            <privacy-item :value="privacyFeatures.allowPublicInsts"
                                >Join & Collaborate</privacy-item
                            >
                            <privacy-item :value="privacyFeatures.allowAI"
                                >Build AI Eggs</privacy-item
                            >
                        </ul>

                        <div class="privacy-features-request-status">
                            <md-progress-spinner
                                v-if="processingPrivacyFeaturesRequest"
                                md-mode="indeterminate"
                                :md-diameter="20"
                                :md-stroke="2"
                            ></md-progress-spinner>
                            {{ requestPrivacyFeaturesMessage }}
                        </div>
                    </md-dialog-content>
                    <md-dialog-actions>
                        <md-button class="md-primary" @click="requestPrivacyFeatureChanges()"
                            >Request Changes</md-button
                        >
                    </md-dialog-actions>
                </md-dialog>
            </div>
        </div>
    </div>
</template>
<script src="./AuthHome.ts"></script>
<style src="./AuthHome.css" scoped></style>
