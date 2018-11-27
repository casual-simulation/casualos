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
                <div class="menu-header">
                    <span class="md-title">Process for Teams</span><br>
                </div>
                <md-list>
                    <md-list-item @click="logout">Logout</md-list-item>
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