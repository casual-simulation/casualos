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
                <div v-if="!subscriptionsSupported || hasActiveSubscription">
                    <md-field>
                        <label for="openAiKey">OpenAI API Key</label>
                        <md-input
                            id="openAiKey"
                            v-model="metadata.openAiKey"
                            type="text"
                            placeholder="Enter your OpenAI API Key"
                        ></md-input>
                    </md-field>
                </div>

                <p v-show="updating">Updating...</p>
                <p v-show="updated">Updated!</p>

                <subscription />
                <security />
            </div>
        </div>
    </div>
</template>
<script src="./AuthHome.ts"></script>
<style src="./AuthHome.css" scoped></style>
