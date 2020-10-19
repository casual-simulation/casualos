<template>
    <md-list-item class="menu-bot" :class="{ active: selected }" :style="style" @click="click()">
        <div
            class="menu-bot-text"
            v-show="label"
            :style="{ color: labelColor, 'text-align': labelAlign }"
        >
            {{ label }}
        </div>
    </md-list-item>
</template>
<script src="./MenuBot.ts"></script>
<style src="./MenuBot.css"></style>
