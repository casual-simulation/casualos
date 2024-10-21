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
