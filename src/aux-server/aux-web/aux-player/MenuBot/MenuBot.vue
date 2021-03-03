<template>
    <md-list-item v-if="form === 'input'" class="menu-bot input-form" :style="style">
        <div
            class="menu-bot-content"
            :style="{ 'text-align': labelAlign, color: labelColor, fill: labelColor }"
        >
            <div class="menu-bot-input" :style="inputStyleVariables">
                <span class="menu-bot-icon" v-if="hasIcon">
                    <img v-if="iconIsURL" :src="icon" />
                    <cube-icon v-else-if="icon === 'cube'"></cube-icon>
                    <egg-icon v-else-if="icon === 'egg'"></egg-icon>
                    <helix-icon v-else-if="icon === 'helix'"></helix-icon>
                    <md-icon v-else>{{ icon }}</md-icon>
                </span>
                <md-field class="menu-input" md-inline>
                    <label v-show="label">{{ label }}</label>
                    <md-input
                        class="text-input"
                        ref="textInput"
                        v-model="text"
                        @input="onTextUpdated()"
                        v-on:keyup.enter="submitInput(false)"
                    ></md-input>
                </md-field>
                <md-button v-show="text" class="md-icon-button" @click="submitInput(true)">
                    <md-icon>send</md-icon>
                    <md-tooltip md-direction="bottom">Submit Input</md-tooltip>
                </md-button>
            </div>
        </div>
    </md-list-item>
    <md-list-item
        v-else
        class="menu-bot"
        :class="{ active: selected, 'no-hover': hoverStyle === 'none' }"
        :style="style"
        :md-ripple="hoverStyle !== 'none'"
        @click="click()"
        @mousedown="mouseDown()"
        @mouseenter="mouseEnter()"
        @mouseleave="mouseLeave()"
    >
        <div
            class="menu-bot-content"
            :style="{
                'text-align': labelAlign,
                color: labelColor,
                fill: labelColor,
                whiteSpace: whiteSpace,
            }"
        >
            <div class="menu-bot-text" v-show="label">
                <span class="menu-bot-icon" v-if="hasIcon">
                    <img v-if="iconIsURL" :src="icon" />
                    <cube-icon v-else-if="icon === 'cube'"></cube-icon>
                    <egg-icon v-else-if="icon === 'egg'"></egg-icon>
                    <helix-icon v-else-if="icon === 'helix'"></helix-icon>
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
        </div>
    </md-list-item>
</template>
<script src="./MenuBot.ts"></script>
<style src="./MenuBot.css"></style>
