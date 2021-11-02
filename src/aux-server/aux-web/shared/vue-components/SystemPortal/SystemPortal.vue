<template>
    <div v-if="hasPortal" class="system-portal" v-on:keydown.stop v-on:keyup.stop>
        <!-- <hotkey :keys="['ctrl', 'shift', 'f']" @triggered="showSearch()" /> -->
        <md-card ref="card" class="info-card maximized">
            <md-card-content>
                <div class="panes">
                    <div class="areas">
                        <div v-for="item of items" :key="item.area" class="area">
                            <div class="area-title">
                                <md-icon>folder</md-icon>
                                {{ item.area }}
                            </div>
                            <div class="area-bots">
                                <div v-for="bot of item.bots" :key="bot.bot.id" class="area-bot">
                                    <mini-bot :bot="bot.bot"></mini-bot>
                                    <span>{{ bot.title }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tags">tags here</div>
                    <div class="editor">Editor here</div>
                </div>

                <!-- <div class="portal-content" v-if="currentBot && currentTag">
                    <tag-value-editor
                        ref="multilineEditor"
                        :bot="currentBot"
                        :tag="currentTag"
                        :space="currentSpace"
                        :showDesktopEditor="true"
                        :showResize="false"
                    ></tag-value-editor>
                </div> -->
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
<style src="./SystemPortalGlobals.css"></style>
