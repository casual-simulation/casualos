<template>
    <div>
        <md-dialog :md-active="show" @md-closed="close()">
            <div class="login-wrapper">
                <div v-if="!showProgress">
                    <p>Hi!</p>
                    <div v-if="showList">
                        <md-list>
                            <md-list-item
                                v-for="user in users"
                                :key="user.username"
                                @click="signIn(user)"
                            >
                                <span class="md-list-item-text">{{ user.username }}</span>
                            </md-list-item>
                            <md-list-item @click="addUser()">
                                <span class="md-list-item-text">
                                    <md-icon>add</md-icon>
                                </span>
                            </md-list-item>
                        </md-list>
                    </div>
                    <div v-else>
                        <md-field>
                            <label>Name</label>
                            <md-input name="name" v-model="username"></md-input>
                        </md-field>
                    </div>
                    <a class="md-primary guest-button" @click="continueAsGuest"
                        >Continue as a Guest</a
                    >
                </div>
                <div v-else class="progress-section">
                    <p>Logging in...</p>
                    <md-progress-spinner md-mode="indeterminate"></md-progress-spinner>
                </div>
            </div>

            <md-dialog-actions>
                <md-button @click="close()">Close</md-button>
                <md-button
                    v-if="!showList"
                    class="md-primary md-raised"
                    @click="continueAsUsername()"
                    >Next</md-button
                >
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./LoginPopup.ts"></script>
<style src="./LoginPopup.css" scoped></style>
