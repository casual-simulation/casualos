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
            <md-button class="md-fab exit-sheet" @click="exitSheet()">
                <md-icon>web_asset</md-icon>
                <md-tooltip>Page Portal</md-tooltip>
            </md-button>
        </div>
    </div>
</template>
<script src="./TagPortal.ts"></script>
<style src="./TagPortal.css" scoped></style>
