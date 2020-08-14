<template>
    <div class="tag-portal-container">
        <div ref="portalContainer" class="tag-portal" v-if="currentBot && currentTag">
            <tag-value-editor-wrapper>
                <tag-value-editor
                    ref="multilineEditor"
                    :bot="currentBot"
                    :tag="currentTag"
                    :showDesktopEditor="true"
                ></tag-value-editor>
            </tag-value-editor-wrapper>
            <md-button class="md-fab exit-sheet" @click="exitSheet()">
                <md-icon>web_asset</md-icon>
                <md-tooltip>Page Portal</md-tooltip>
            </md-button>
        </div>
    </div>
</template>
<script src="./TagPortal.ts"></script>
<style src="./TagPortal.css" scoped></style>
