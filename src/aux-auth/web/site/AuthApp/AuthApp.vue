<template>
    <div id="app">
        <md-app>
            <md-app-toolbar class="md-dense">
                <div class="md-toolbar-row">
                    <a class="title-link md-title" href="/">
                        <svg-icon name="PersonPinCircle" class="title-img"></svg-icon>
                        <strong>{{ title }}</strong>
                    </a>
                    <md-tabs class="" style="flex: 1" md-sync-route>
                        <md-tab id="tab-home" md-label="Home" to="/" exact></md-tab>
                        <md-tab id="tab-pages" md-label="Records" to="/records"></md-tab>
                        <!-- <md-tab id="tab-posts" md-label="Posts"></md-tab>
                        <md-tab id="tab-favorites" md-label="Favorites"></md-tab> -->
                    </md-tabs>
                    <md-button v-if="showLogout" @click="logout">Logout</md-button>
                </div>
                <!-- <div class="md-toolbar-row">
                </div> -->
            </md-app-toolbar>
            <md-app-content>
                <router-view></router-view>
            </md-app-content>
        </md-app>
        <!-- <md-toolbar>
            
        </md-toolbar>
        <router-view></router-view> -->
    </div>
</template>
<script src="./AuthApp.ts"></script>
<style src="./AuthApp.css"></style>
