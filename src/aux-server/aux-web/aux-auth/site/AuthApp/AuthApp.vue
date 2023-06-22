<template>
    <div id="app">
        <md-toolbar>
            <a class="title-link md-title" href="/" style="flex: 1">
                <svg-icon name="PersonPinCircle" class="title-img"></svg-icon>
                <strong>{{ title }}</strong>
            </a>
            <md-button v-if="showLogout" @click="logout">Logout</md-button>
        </md-toolbar>
        <router-view></router-view>
    </div>
</template>
<script src="./AuthApp.ts"></script>
<style src="./AuthApp.css"></style>
