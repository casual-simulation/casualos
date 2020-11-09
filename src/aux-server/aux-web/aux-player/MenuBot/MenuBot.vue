<template>
    <md-list-item
        class="menu-bot"
        :class="{ active: selected }"
        :style="style"
        @click="click()"
        @mousedown="mouseDown()"
        @mouseenter="mouseEnter()"
        @mouseleave="mouseLeave()"
    >
        <div
            class="menu-bot-text"
            v-show="label"
            :style="{ 'text-align': labelAlign, color: labelColor }"
        >
            <span class="menu-bot-icon" v-if="hasIcon">
                <img v-if="iconIsURL" :src="icon" />
                <md-icon v-else>{{ icon }}</md-icon>
            </span>
            <span>
                {{ label }}
            </span>
            <span class="menu-bot-progress" v-if="hasProgress">
                <pie-progress
                    :progress="progress"
                    :color="progressBarForeground"
                    :backgroundColor="progressBarBackground"
                ></pie-progress>
            </span>
        </div>
    </md-list-item>
</template>
<script src="./MenuBot.ts"></script>
<style src="./MenuBot.css"></style>
