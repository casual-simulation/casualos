<template>
    <div class="tag-portal-container">
        <div
            ref="portalContainer"
            :style="extraStyle"
            class="tag-portal"
            :class="{ invisible: !(currentBot && currentTag) }"
        >
            <div class="tag-portal-editor-wrapper" v-if="currentSimId && currentBot && currentTag">
                <tag-value-editor
                    ref="multilineEditor"
                    :simId="currentSimId"
                    :bot="currentBot"
                    :tag="currentTag"
                    :space="currentSpace"
                    :showDesktopEditor="true"
                    :showResize="false"
                    @modelChanged="onEditorModelChanged"
                ></tag-value-editor>
                <md-button v-if="showButton" class="md-fab custom-button" @click="buttonClick()">
                    <md-icon v-if="buttonIcon">{{ buttonIcon }}</md-icon>
                    <md-tooltip v-if="buttonHint">{{ buttonHint }}</md-tooltip>
                </md-button>
            </div>
        </div>
        <div ref="otherContainer" class="other-container">
            <slot></slot>
        </div>
    </div>
</template>
<script src="./TagPortal.ts"></script>
<style src="./TagPortal.css" scoped></style>
