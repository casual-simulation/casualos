<template>
    <div id="app">
        <md-toolbar>
            <a class="title-link md-title" href="/" style="flex: 1">
                <img class="title-img" src="./casualos_me.png" />
                <span>CasualOS.me</span>
            </a>
            <md-button v-if="showLogout" @click="logout">Logout</md-button>
        </md-toolbar>
        <router-view></router-view>
    </div>
</template>
<script src="./AuthApp.ts"></script>
<style src="./AuthApp.css"></style>
