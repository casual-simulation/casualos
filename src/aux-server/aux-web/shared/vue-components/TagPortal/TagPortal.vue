<template>
    <div class="tag-portal-container">
        <div
            ref="portalContainer"
            :style="extraStyle"
            class="tag-portal"
            v-if="currentBot && currentTag"
        >
            <tag-value-editor
                ref="multilineEditor"
                :bot="currentBot"
                :tag="currentTag"
                :showDesktopEditor="true"
                :showResize="false"
            ></tag-value-editor>
            <md-button v-if="showButton" class="md-fab custom-button" @click="buttonClick()">
                <md-icon v-if="buttonIcon">{{ buttonIcon }}</md-icon>
                <md-tooltip v-if="buttonHint">{{ buttonHint }}</md-tooltip>
            </md-button>
        </div>
    </div>
</template>
<script src="./TagPortal.ts"></script>
<style src="./TagPortal.css" scoped></style>
