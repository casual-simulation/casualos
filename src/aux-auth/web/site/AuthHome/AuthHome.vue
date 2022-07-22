<template>
    <div>
        <div class="home-container">
            <!-- <h1 class="md-title">You are logged in!</h1> -->

            <div v-if="metadata">
                <div>
                    <md-field>
                        <label for="name">Name</label>
                        <md-input v-model="metadata.name" type="text" placeholder="Name"></md-input>
                    </md-field>
                </div>
                <div class="button-field">
                    <md-field class="md-disabled">
                        <label for="email">Email</label>
                        <md-input
                            v-model="metadata.email"
                            type="text"
                            placeholder="Email"
                        ></md-input>
                    </md-field>
                    <md-button v-show="metadata.email !== originalEmail" @click="saveEmail()"
                        >Save Email</md-button
                    >
                </div>
                <div class="button-field">
                    <md-field class="md-disabled">
                        <label for="email">Phone</label>
                        <md-input
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

                <security />
            </div>
        </div>
    </div>
</template>
<script src="./AuthHome.ts"></script>
<style src="./AuthHome.css" scoped></style>
