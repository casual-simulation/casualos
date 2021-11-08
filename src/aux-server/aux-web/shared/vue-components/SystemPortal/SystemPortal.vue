<template>
    <div v-if="hasPortal" class="system-portal" v-on:keydown.stop v-on:keyup.stop>
        <!-- <hotkey :keys="['ctrl', 'shift', 'f']" @triggered="showSearch()" /> -->
        <md-card ref="card" class="info-card maximized">
            <md-card-content>
                <div class="panes">
                    <div class="areas">
                        <div class="search">
                            <md-field>
                                <label>Search Bots</label>
                                <md-input
                                    @input="changeSearchValue"
                                    :value="searchValue"
                                    @focus="onFocusSearch"
                                    @blur="onUnfocusSearch"
                                ></md-input>
                            </md-field>
                        </div>
                        <div class="areas-list">
                            <div v-for="item of items" :key="item.area" class="area">
                                <div class="area-title">
                                    <md-icon>folder</md-icon>
                                    {{ item.area }}
                                </div>
                                <div class="area-bots">
                                    <div
                                        v-for="bot of item.bots"
                                        :key="bot.bot.id"
                                        class="area-bot"
                                        :class="{ selected: bot.bot.id === selectedBotId }"
                                        @click="selectBot(bot)"
                                    >
                                        <mini-bot :bot="bot.bot"></mini-bot>
                                        <span>{{ bot.title }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="tags" v-if="hasSelection">
                        <div class="tags-list">
                            <div
                                v-for="tag of tags"
                                :key="tag.name"
                                class="tags-list-tag"
                                :class="{
                                    selected:
                                        selectedTag === tag.name && selectedTagSpace === tag.space,
                                }"
                                @click="selectTag(tag)"
                            >
                                <div class="tags-list-tag-header">
                                    <bot-tag
                                        :tag="tag.name"
                                        :isScript="tag.isScript"
                                        :allowCloning="false"
                                    ></bot-tag>
                                    <span v-show="!!tag.space" class="tag-space">{{
                                        tag.space
                                    }}</span>
                                </div>
                                <div class="tags-list-tag-value">
                                    <bot-value
                                        :bot="selectedBot"
                                        :tag="tag.name"
                                        :space="tag.space"
                                        :alwaysShowRealValue="true"
                                        :showSpace="false"
                                        @focusChanged="onTagFocusChanged(tag, $event)"
                                    ></bot-value>
                                </div>
                            </div>
                        </div>
                        <div class="tags-sort-options">
                            <md-button
                                :class="{ 'md-primary': sortMode === 'scripts-first' }"
                                class="sort-option-button md-dense md-raised"
                                @click="setSortMode('scripts-first')"
                            >
                                <md-tooltip>Sort script tags first</md-tooltip>
                                @
                            </md-button>
                            <md-button
                                :class="{ 'md-primary': sortMode === 'alphabetical' }"
                                class="sort-option-button md-dense md-raised"
                                @click="setSortMode('alphabetical')"
                            >
                                <md-tooltip>Sort tags Alphabetically</md-tooltip>
                                A-Z
                            </md-button>
                        </div>
                    </div>
                    <div class="editor">
                        <div class="editor-recents">
                            <div
                                class="editor-recents-item"
                                v-for="recent of recents"
                                :key="`${recent.botId}.${recent.tag}.${recent.space}`"
                            >
                                {{ recent.name }}
                            </div>
                        </div>
                        <div class="editor-code">
                            <tag-value-editor
                                v-if="selectedBot && selectedTag"
                                ref="multilineEditor"
                                :bot="selectedBot"
                                :tag="selectedTag"
                                :space="selectedTagSpace"
                                :showDesktopEditor="true"
                                :showResize="false"
                            >
                            </tag-value-editor>
                        </div>
                    </div>
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
