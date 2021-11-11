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
                        <div class="areas-add-bot">
                            <md-button class="md-raised create-bot" @click="openNewBot">
                                <svg-icon name="NewBot" width="640" height="640"></svg-icon>
                                <md-tooltip>Create Empty Bot</md-tooltip>
                            </md-button>
                        </div>
                    </div>
                    <div class="tags" v-if="hasSelection">
                        <div class="tags-list">
                            <div @click="toggleTags()" class="tags-toggle">
                                <md-icon>{{ tagsVisible ? 'expand_less' : 'expand_more' }}</md-icon>
                                Tags
                            </div>
                            <system-portal-tag
                                v-show="tagsVisible"
                                :bot="selectedBot"
                                :tag="{ name: 'id' }"
                                :isReadOnly="true"
                                :showPinButton="false"
                                @click="copyId()"
                            >
                            </system-portal-tag>
                            <system-portal-tag
                                v-show="tagsVisible"
                                :bot="selectedBot"
                                :tag="{ name: 'space' }"
                                :showPinButton="false"
                                :isReadOnly="true"
                            >
                            </system-portal-tag>

                            <system-portal-tag
                                v-show="tagsVisible"
                                v-for="tag of tagsToShow"
                                :key="`tag-${tag.name}.${tag.space}`"
                                ref="tagEditors"
                                :bot="selectedBot"
                                :tag="tag"
                                :selected="isTagSelected(tag)"
                                @click="selectTag(tag)"
                                @pin="pinTag(tag)"
                                @focusChanged="onTagFocusChanged(tag, $event)"
                            >
                            </system-portal-tag>
                            <div v-if="pinnedTags && pinnedTags.length > 0">
                                <div @click="togglePinnedTags()" class="tags-toggle">
                                    <md-icon>{{
                                        pinnedTagsVisible ? 'expand_less' : 'expand_more'
                                    }}</md-icon>
                                    Pinned Tags
                                </div>
                                <system-portal-tag
                                    v-show="pinnedTagsVisible"
                                    v-for="tag of pinnedTags"
                                    :key="`pin-${tag.name}.${tag.space}`"
                                    ref="pinnedTagEditors"
                                    :bot="selectedBot"
                                    :tag="tag"
                                    :selected="isTagSelected(tag)"
                                    :showCloseButton="true"
                                    @click="selectTag(tag)"
                                    @pin="pinTag(tag)"
                                    @close="closeTag(tag)"
                                    @focusChanged="onTagFocusChanged(tag, $event)"
                                >
                                </system-portal-tag>
                            </div>
                        </div>
                        <div class="tags-add-tag">
                            <md-button class="md-raised pin-tag-button" @click="openNewTag">
                                <picture>
                                    <source
                                        srcset="../../public/icons/tag-add.webp"
                                        type="image/webp"
                                    />
                                    <source
                                        srcset="../../public/icons/tag-add.png"
                                        type="image/png"
                                    />
                                    <img alt="Add Tag" src="../../public/icons/tag-add.png" />
                                </picture>
                                <md-tooltip>Add Tag</md-tooltip>
                            </md-button>
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
                            <div class="tags-sort-spacer"></div>
                            <md-button
                                class="sort-option-button delete-bot-button md-raised md-dense"
                                @click="deleteSelectedBot()"
                            >
                                <md-icon class="delete-bot-icon">delete_forever</md-icon>
                                <md-tooltip md-delay="1000" md-direction="top"
                                    >Destroy Bot</md-tooltip
                                >
                            </md-button>
                        </div>
                    </div>
                    <div class="editor">
                        <div class="editor-recents">
                            <md-button
                                class="editor-recents-item md-raised md-dense"
                                :class="{
                                    selected: isTagSelected(recent),
                                }"
                                v-for="recent of recents"
                                :key="`${recent.botId}.${recent.tag}.${recent.space}`"
                                @click="selectRecentTag(recent)"
                            >
                                <bot-tag
                                    :tag="recent.tag"
                                    :isScript="recent.isScript"
                                    :allowCloning="false"
                                ></bot-tag>
                                <span v-show="!!recent.space" class="tag-space">{{
                                    recent.space
                                }}</span>
                                <span class="tag-owner">
                                    {{ recent.hint }}
                                </span>
                                <md-tooltip>
                                    {{ recent.system }}
                                </md-tooltip>
                            </md-button>
                        </div>
                        <div class="editor-code">
                            <tag-value-editor
                                v-if="selectedBot && hasTag()"
                                ref="multilineEditor"
                                :bot="selectedBot"
                                :tag="selectedTag || getFirstTag()"
                                :space="selectedTagSpace"
                                :showDesktopEditor="true"
                                :showResize="false"
                                @onFocused="onEditorFocused($event)"
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

        <md-dialog :md-active.sync="isMakingNewTag" class="new-tag-dialog">
            <md-dialog-title>Add New Tag</md-dialog-title>
            <md-dialog-content>
                <form class="bot-table-form" @submit.prevent="addTag()">
                    <tag-editor
                        ref="tagEditor"
                        :useMaterialInput="true"
                        v-model="newTag"
                        :isAction="false"
                    ></tag-editor>
                    <div class="finish-tag-button-wrapper">
                        <md-button class="md-icon-button md-dense finish-tag-button" type="submit">
                            <md-icon class="done">check</md-icon>
                        </md-button>
                        <md-button
                            class="md-icon-button md-dense finish-tag-button"
                            @click="cancelNewTag()"
                        >
                            <md-icon class="cancel">cancel</md-icon>
                        </md-button>
                    </div>
                </form>
            </md-dialog-content>
        </md-dialog>

        <md-dialog :md-active.sync="isMakingNewBot" class="new-bot-dialog">
            <md-dialog-title>Enter New Bot System</md-dialog-title>
            <md-dialog-content>
                <form class="bot-table-form" @submit.prevent="addBot()">
                    <tag-editor
                        ref="tagEditor"
                        :useMaterialInput="true"
                        v-model="newBotSystem"
                        :isAction="false"
                        placeholder="#system"
                        @autoFill="newBotSystem = $event"
                        :stopAutoCompleteKeyboardEvents="true"
                        :autoCompleteItems="getBotSystems()"
                    ></tag-editor>
                    <div class="finish-tag-button-wrapper">
                        <md-button class="md-icon-button md-dense finish-tag-button" type="submit">
                            <md-icon class="done">check</md-icon>
                        </md-button>
                        <md-button
                            class="md-icon-button md-dense finish-tag-button"
                            @click="cancelNewBot()"
                        >
                            <md-icon class="cancel">cancel</md-icon>
                        </md-button>
                    </div>
                </form>
            </md-dialog-content>
        </md-dialog>
    </div>
</template>
<script src="./SystemPortal.ts"></script>
<style src="./SystemPortal.css" scoped></style>
<style src="./SystemPortalGlobals.css"></style>
