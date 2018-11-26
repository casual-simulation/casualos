<!-- App.vue -->
<template>
    <div>
        <md-app>

            <md-app-toolbar class="md-primary">
                <md-button class="md-icon-button" @click="menuClicked()">
                    <md-icon>menu</md-icon>
                </md-button>
                <router-link to="/" class="md-title">Process for Teams</router-link>
            </md-app-toolbar>
            
            <md-app-drawer :md-active.sync="showNavigation">
                <md-toolbar class="md-transparent" md-elevation="0">
                    <span class="md-title">Process for Teams</span>
                </md-toolbar>

                <md-list>
                    <md-list-item>
                        <md-icon>move_to_inbox</md-icon>
                        <span class="md-list-item-text">Inbox</span>
                    </md-list-item>

                    <md-list-item>
                        <md-icon>send</md-icon>
                        <span class="md-list-item-text">Sent Mail</span>
                    </md-list-item>

                    <md-list-item>
                        <md-icon>delete</md-icon>
                        <span class="md-list-item-text">Trash</span>
                    </md-list-item>

                    <md-list-item>
                        <md-icon>error</md-icon>
                        <span class="md-list-item-text">Spam</span>
                    </md-list-item>
                </md-list>
            </md-app-drawer>

            <md-app-content>
                <router-view></router-view>
            </md-app-content>

        </md-app>
    </div>
</template>
<script src="./App.ts"></script>
<style src="./App.css"></style>