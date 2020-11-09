<template>
    <div class="mini-bot" :class="{ active: selected }" @click="click()">
        <div v-if="isEmpty" class="mini-bot-search-empty">
            <img class="mini-bot-img" :src="image" draggable="false" />
        </div>
        <div v-else class="mini-bot-search">
            <img class="mini-bot-img" :src="image" draggable="false" />
        </div>
    </div>
</template>
<script src="./MiniBot.ts"></script>
<style src="./MiniBot.css"></style>
