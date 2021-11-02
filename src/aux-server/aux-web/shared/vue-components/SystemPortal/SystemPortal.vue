<template>
    <div v-if="hasPortal" class="system-portal" v-on:keydown.stop v-on:keyup.stop>
        <hotkey :keys="['ctrl', 'shift', 'f']" @triggered="showSearch()" />
        <md-card ref="card" class="info-card maximized">
            <md-card-content>
                <div class="portal-content" v-if="currentBot && currentTag">
                    <tag-value-editor
                        ref="multilineEditor"
                        :bot="currentBot"
                        :tag="currentTag"
                        :space="currentSpace"
                        :showDesktopEditor="true"
                        :showResize="false"
                    ></tag-value-editor>
                </div>
                <md-button v-if="showButton" class="md-fab exit-portal" @click="exitPortal()">
                    <md-icon>{{ finalButtonIcon }}</md-icon>
                    <md-tooltip>{{ finalButtonHint }}</md-tooltip>
                </md-button>
            </md-card-content>
        </md-card>
    </div>
</template>
<script src="./SystemPortal.ts"></script>
<style src="./SystemPortal.css" scoped></style>
