<!-- App.vue -->
<template>
    <div id="app">

            <md-toolbar class="md-primary">
                <md-button class="md-icon-button" @click="menuClicked()">
                    <md-icon>menu</md-icon>
                </md-button>
                <router-link to="/" class="md-title">Process for Teams</router-link>
            </md-toolbar>

             <md-drawer :md-active.sync="showNavigation">
                <div class="menu-header">
                    <span class="md-title">Process for Teams</span><br>
                    <span class="md-body-1" v-if="getUser() != null">Logged In: {{getUser().name}}</span>
                </div>s
                <md-list>
                    <md-list-item @click="testConfirmDialog">
                        <span class="md-list-item-text">Test Confirm Dialog</span>
                    </md-list-item>
                    <md-list-item @click="openInfoCard" v-if="getUser() != null">
                        <md-icon>info</md-icon>
                        <span class="md-list-item-text">Info Card</span>
                    </md-list-item>
                    <md-list-item @click="logout" v-if="getUser() != null">
                        <md-icon>exit_to_app</md-icon>
                        <span class="md-list-item-text">Logout</span>
                    </md-list-item>
                </md-list>
            </md-drawer>

            <confirm-dialog
            v-bind:active="showConfirmDialog" 
            v-bind:app="this"
            v-bind:title="confirmDialogOptions.title"
            v-bind:body="confirmDialogOptions.body"
            v-bind:okEvent="confirmDialogOptions.okEvent"
            v-bind:cancelEvent="confirmDialogOptions.cancelEvent" />

            <!-- <md-content>
                <router-view></router-view>
            </md-content> -->
    </div>
</template>
<script src="./App.ts"></script>
<style src="./App.css"></style>