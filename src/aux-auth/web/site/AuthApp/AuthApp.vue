<template>
    <div id="app">
        <md-toolbar>
            <h3 class="md-title" style="flex: 1">CasualOS</h3>
            <md-button v-if="showLogout" @click="logout">Logout</md-button>
        </md-toolbar>
        <router-view></router-view>
    </div>
</template>
<script src="./AuthApp.ts"></script>
<style src="./AuthApp.css"></style>
