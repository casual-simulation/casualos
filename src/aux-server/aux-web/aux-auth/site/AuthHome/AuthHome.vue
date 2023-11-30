<template>
    <div>
        <div class="home-container">
            <!-- <h1 class="md-title">You are logged in!</h1> -->

            <div v-if="metadata">
                <h2 class="md-title">Profile</h2>
                <div>
                    <md-field>
                        <label for="name">Name</label>
                        <md-input
                            id="name"
                            v-model="metadata.name"
                            type="text"
                            placeholder="Name"
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
                <div>
                    <avatar
                        :avatarUrl="metadata.avatarUrl"
                        :render="metadata.avatarPortraitUrl"
                        @updateAvatar="updateAvatar"
                    ></avatar>
                </div>

                <p v-show="updating">Updating...</p>
                <p v-show="updated">Updated!</p>

                <div v-if="showPrivacyFeatures">
                    <h2 class="md-title">Privacy</h2>
                    <md-card class="privacy-card">
                        <md-card-header>
                            <h3 class="md-title">Features</h3>
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
            </div>
        </div>
    </div>
</template>
<script src="./AuthHome.ts"></script>
<style src="./AuthHome.css" scoped></style>
