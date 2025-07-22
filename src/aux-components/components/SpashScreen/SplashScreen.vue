<template>
    <div class="splash-screen" :style="{ 'background-color': backgroundColor }">
        <img v-if="logoUrl" :src="logoUrl" class="logo" :alt="logoTitle" :title="logoTitle" />
        <h2 v-else-if="title">{{ title }}</h2>
        <md-progress-spinner
            md-mode="indeterminate"
            class="splash-screen-spinner"
            :md-diameter="40"
            :md-stroke="3"
        ></md-progress-spinner>

        <div class="version">{{ version }}</div>
    </div>
</template>
<script src="./SplashScreen.ts"></script>
<style src="./SplashScreen.css" scoped></style>
<style src="./SplashScreenGlobals.css"></style>
