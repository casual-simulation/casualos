<template>
    <div class="splash-screen" :style="{ backgroundColor: backgroundColor }">
        <img v-if="logoUrl" :src="logoUrl" class="logo" :alt="logoTitle" :title="logoTitle" />
        <h2 v-else-if="title">{{ title }}</h2>

        <div class="version">{{ version }}</div>
    </div>
</template>
<script src="./SplashScreen.ts"></script>
<style src="./SplashScreen.css" scoped></style>
