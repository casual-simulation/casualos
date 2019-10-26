<template>
    <div class="mini-bot" :class="{ active: selected }" @click="click()">
        <div v-if="!isSearch" class="mini-bot-cube" :class="{ large: large }">
            <div class="mini-bot-text" v-show="label" :style="{ color: labelColor }">
                {{ label }}
            </div>
            <img class="mini-bot-img" :src="image" draggable="false" />
            <div class="mini-bot-tags">
                <tag-color v-for="tag in tags" :key="tag" :tag="tag"></tag-color>
            </div>
        </div>
        <div v-else-if="isEmpty" class="mini-bot-search-empty">
            <img class="mini-bot-img" :src="image" draggable="false" />
        </div>
        <div v-else class="mini-bot-search">
            <img class="mini-bot-img" :src="image" draggable="false" />
        </div>
    </div>
</template>
<script src="./MiniBot.ts"></script>
<style src="./MiniBot.css"></style>
