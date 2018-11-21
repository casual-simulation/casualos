<!-- App.vue -->
<template>
    <div>
        <md-app>
            <md-app-toolbar class="md-primary">
                <router-link to="/" class="md-title">Process for Teams</router-link>
            </md-app-toolbar>
            <md-app-content>
                <router-view></router-view>
            </md-app-content>
        </md-app>
    </div>
</template>
<script src="./App.ts"></script>
<style src="./App.css"></style>