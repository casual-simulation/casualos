<template>
    <md-list-item v-if="form === 'input'" class="menu-bot input-form" :style="style">
        <div
            class="menu-bot-content"
            :style="{ 'text-align': labelAlign, color: labelColor, fill: labelColor }"
        >
            <div class="menu-bot-input" :style="inputStyleVariables">
                <span class="menu-bot-icon" v-if="hasIcon">
                    <img v-if="iconIsURL" :src="icon" />
                    <svg-icon v-else-if="icon === 'cube'" name="Cube"></svg-icon>
                    <svg-icon v-else-if="icon === 'egg'" name="Egg"></svg-icon>
                    <svg-icon v-else-if="icon === 'helix'" name="Helix"></svg-icon>
                    <md-icon v-else>{{ icon }}</md-icon>
                </span>
                <md-field class="menu-input" md-inline md-theme="none">
                    <label v-show="label">{{ label }}</label>
                    <md-input
                        v-if="subType === 'password'"
                        :type="subType"
                        class="text-input"
                        :style="{ color: labelColor }"
                        ref="textInput"
                        v-model="text"
                        @input="onTextUpdated()"
                        v-on:keydown.enter="submitInput(false)"
                        v-on:keydown.stop="handleKeyDown"
                        v-on:keyup.stop="handleKeyUp"
                        md-autogrow
                    ></md-input>
                    <md-textarea
                        v-else
                        :type="subType"
                        class="text-input"
                        :style="{ color: labelColor }"
                        ref="textInput"
                        v-model="text"
                        @input="onTextUpdated()"
                        v-on:keydown.enter="handleInputEnter"
                        v-on:keydown.stop="handleKeyDown"
                        v-on:keyup.stop="handleKeyUp"
                        md-autogrow
                    ></md-textarea>
                </md-field>
                <md-button
                    v-show="text || alwaysShowSubmit"
                    class="md-icon-button"
                    @click="submitInput(true)"
                >
                    <md-icon :style="{ color: labelColor }" md-theme="none">send</md-icon>
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
        @click="click"
        @mousedown="mouseDown"
        @mouseenter="mouseEnter"
        @mouseleave="mouseLeave"
    >
        <div
            class="menu-bot-content"
            :style="{
                'text-align': labelAlign,
                color: labelColor,
                fill: labelColor,
                whiteSpace: whiteSpace,
                cursor: cursor,
            }"
        >
            <div class="menu-bot-text" v-show="label || hasIcon">
                <span class="menu-bot-icon" v-if="hasIcon">
                    <img v-if="iconIsURL" :src="icon" />
                    <svg-icon v-else-if="icon === 'cube'" name="Cube"></svg-icon>
                    <svg-icon v-else-if="icon === 'egg'" name="Egg"></svg-icon>
                    <svg-icon v-else-if="icon === 'helix'" name="Helix"></svg-icon>
                    <md-icon v-else>{{ icon }}</md-icon>
                </span>
                <span :style="labelStyle">{{ label }}</span>
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
