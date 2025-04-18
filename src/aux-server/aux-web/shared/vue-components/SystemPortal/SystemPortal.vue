<template>
    <div
        v-if="hasPortal"
        class="system-portal"
        :class="[getActiveTheme()]"
        v-on:keydown.stop
        v-on:keyup.stop
    >
        <div v-shortkey="['ctrl-cmd', 'shift', 'f']" @shortkey.stop.prevent="showSearch()" />
        <div v-shortkey="['ctrl-cmd', 'b']" @shortkey.stop.prevent="selectRecentTag(recents[0])" />
        <!-- <hotkey :keys="['ctrl', 'shift', 'f']" @triggered="showSearch()" /> -->
        <div
            v-if="selectedPane !== 'sheet'"
            v-shortkey="['ctrl-cmd', 'p']"
            @shortkey.stop.prevent="showQuickAccess()"
        />
        <!-- <hotkey
            v-if="selectedPane !== 'sheet'"
            :keys="['ctrl', 'p']"
            @triggered="showQuickAccess()"
        /> -->

        <md-card ref="card" class="portal-card">
            <md-card-content>
                <div class="panes">
                    <div class="pane-options">
                        <div class="pane-selection" :class="{ selected: selectedPane === 'bots' }">
                            <md-button class="md-icon-button" @click="showBots()">
                                <md-tooltip md-direction="right">Bots</md-tooltip>
                                <svg-icon class="pane-icon" name="Cube"></svg-icon>
                            </md-button>
                        </div>
                        <div class="pane-selection" :class="{ selected: selectedPane === 'sheet' }">
                            <md-button class="md-icon-button" @click="showSheet()">
                                <md-tooltip md-direction="right">sheetPortal</md-tooltip>
                                <md-icon class="pane-icon">grid_3x3</md-icon>
                            </md-button>
                        </div>
                        <div
                            class="pane-selection"
                            :class="{ selected: selectedPane === 'search' }"
                        >
                            <md-button class="md-icon-button" @click="showSearch()">
                                <md-tooltip md-direction="right">Search</md-tooltip>
                                <md-icon class="pane-icon">search</md-icon>
                            </md-button>
                        </div>
                        <div class="pane-selection" :class="{ selected: selectedPane === 'diff' }">
                            <md-button class="md-icon-button" @click="showDiff()">
                                <md-tooltip md-direction="right">Diff</md-tooltip>
                                <md-icon class="pane-icon">history</md-icon>
                            </md-button>
                        </div>

                        <div class="pane-spacing"></div>

                        <div class="pane-selection">
                            <md-button
                                v-if="showButton"
                                class="md-icon-button"
                                @click="exitPortal()"
                            >
                                <md-icon>{{ finalButtonIcon }}</md-icon>
                                <md-tooltip>{{ finalButtonHint }}</md-tooltip>
                            </md-button>
                        </div>
                    </div>
                    <!-- <div class="search">

                    </div> -->
                    <div class="search" v-if="selectedPane === 'search'" ref="areas">
                        <div class="search-input-container">
                            <input
                                ref="searchTagsInput"
                                class="search-input"
                                placeholder="Search"
                                :value="searchTagsValue"
                                @input="updateSearch"
                                @focus="onFocusSearchTags"
                                @blur="onUnfocusSearchTags"
                            />
                            <div>
                                {{ numMatchesInSearchResults }} results in
                                {{ numBotsInSearchResults }} bots
                            </div>
                        </div>
                        <div class="search-list">
                            <div
                                v-for="item of searchResults"
                                :key="item.simulationId"
                                class="search-item"
                            >
                                <div
                                    v-for="area of item.areas"
                                    :key="area.area"
                                    class="search-area"
                                >
                                    <div class="search-area-title">
                                        <md-icon>folder</md-icon>
                                        {{ area.area }}
                                    </div>
                                    <div class="search-area-bots">
                                        <div
                                            v-for="bot of area.bots"
                                            :key="bot.bot.id"
                                            class="search-area-bot"
                                        >
                                            <mini-bot :bot="bot.bot"></mini-bot>
                                            <span class="search-area-bot-title">{{
                                                bot.title
                                            }}</span>
                                            <div
                                                v-for="tag of bot.tags"
                                                :key="`${bot.bot.id}-${tag.tag}-${tag.space}-${
                                                    tag.isTagName ? 'tagName' : ''
                                                }`"
                                                class="search-area-tag"
                                            >
                                                <div
                                                    class="search-area-tag-name"
                                                    @click="
                                                        selectSearchTag(item.simulationId, bot, tag)
                                                    "
                                                >
                                                    <bot-tag
                                                        :tag="tag.tag"
                                                        :space="tag.space"
                                                        :prefix="tag.prefix"
                                                        :allowCloning="false"
                                                        :highlight="getSearchTagHighlight(tag)"
                                                    ></bot-tag>
                                                </div>
                                                <div
                                                    v-for="match of getSearchTagMatches(tag)"
                                                    :key="match.index"
                                                    class="search-area-match"
                                                    @click="
                                                        selectSearchMatch(
                                                            item.simulationId,
                                                            bot,
                                                            tag,
                                                            match
                                                        )
                                                    "
                                                >
                                                    <highlighted-text
                                                        :text="match.text"
                                                        :startIndex="match.highlightStartIndex"
                                                        :endIndex="match.highlightEndIndex"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="search-extra"></div>
                    </div>
                    <div class="areas" v-else-if="selectedPane === 'diff'" ref="areas">
                        <div class="filter">
                            <md-field class="filter-field">
                                <label>System</label>
                                <md-input
                                    class="filter-bots-input"
                                    @input="changeBotFilterValue"
                                    :value="botFilterValue"
                                    @focus="onFocusBotFilter"
                                    @blur="onUnfocusBotFilter"
                                ></md-input>
                            </md-field>

                            <md-field class="filter-field">
                                <label>Diff Tag</label>
                                <md-input
                                    class="filter-bots-input"
                                    @input="changeDiffFilterValue"
                                    :value="diffFilterValue"
                                    @focus="onFocusDiffFilter"
                                    @blur="onUnfocusDiffFilter"
                                ></md-input>
                            </md-field>

                            <!-- <md-field class="filter-field">
                                <label>System 2</label>
                                <md-input
                                    class="filter-bots-input"
                                    @input="changeBotFilterValue"
                                    :value="botFilterValue"
                                    @focus="onFocusBotFilter"
                                    @blur="onUnfocusBotFilter"
                                ></md-input>
                            </md-field> -->
                        </div>
                        <div class="areas-list">
                            <div v-for="item of diffItems" :key="item.area" class="area">
                                <div class="area-title">
                                    <md-icon>folder</md-icon>
                                    {{ item.area }}
                                </div>
                                <div class="area-bots">
                                    <div
                                        v-for="bot of item.bots"
                                        :key="bot.key"
                                        class="area-bot diff-bot"
                                        :class="{ selected: isDiffBotSelected(bot) }"
                                        @click="selectDiff(bot)"
                                    >
                                        <mini-bot
                                            :bot="bot.addedBot || bot.removedBot || bot.newBot"
                                        ></mini-bot>
                                        <span>{{ bot.title }}</span>
                                        <diff-status
                                            :status="
                                                !!bot.addedBot
                                                    ? 'added'
                                                    : !!bot.removedBot
                                                    ? 'removed'
                                                    : !!bot.changedTags &&
                                                      bot.changedTags.length > 0
                                                    ? 'changed'
                                                    : 'none'
                                            "
                                        ></diff-status>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="areas" v-else ref="areas">
                        <div class="filter">
                            <md-field class="filter-field">
                                <label>Filter</label>
                                <md-input
                                    class="filter-bots-input"
                                    @input="changeBotFilterValue"
                                    :value="botFilterValue"
                                    @focus="onFocusBotFilter"
                                    @blur="onUnfocusBotFilter"
                                ></md-input>
                            </md-field>
                        </div>
                        <div class="areas-list">
                            <div v-for="item of items" :key="item.simulationId">
                                <div v-for="area of item.areas" :key="area.area" class="area">
                                    <div class="area-title">
                                        <md-icon>folder</md-icon>
                                        {{ area.area }}
                                    </div>
                                    <div class="area-bots">
                                        <div
                                            v-for="bot of area.bots"
                                            :key="bot.bot.id"
                                            class="area-bot"
                                            :class="{ selected: bot.bot.id === selectedBotId }"
                                            @click="selectBot(item.simulationId, bot)"
                                        >
                                            <mini-bot :bot="bot.bot"></mini-bot>
                                            <span>{{ bot.title }}</span>
                                        </div>
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
                    <div
                        class="slider"
                        id="slider"
                        @pointerdown="onSliderPointerDown"
                        @pointermove="onSliderPointerMove"
                        @pointerup="onSliderPointerUp"
                    ></div>
                    <div
                        class="tags"
                        v-if="selectedPane === 'bots' && hasSelection"
                        @keyup.enter="openNewTag"
                    >
                        <div class="tags-list">
                            <div v-if="pinnedTags && pinnedTags.length > 0">
                                <div @click="togglePinnedTags()" class="tags-toggle">
                                    <md-icon>{{
                                        pinnedTagsVisible ? 'expand_more' : 'chevron_right'
                                    }}</md-icon>
                                    Pinned Tags
                                </div>
                                <system-portal-tag
                                    v-show="pinnedTagsVisible"
                                    v-for="tag of pinnedTags"
                                    :key="`pin-${tag.name}.${tag.space}`"
                                    ref="pinnedTagEditors"
                                    :simId="selectedBotSimId"
                                    :bot="selectedBot"
                                    :tag="tag"
                                    :selected="isTagSelected(tag)"
                                    :showCloseButton="true"
                                    @click="selectTag(tag)"
                                    @pin="pinTag(tag)"
                                    @close="closeTag(tag)"
                                    @focusChanged="onTagFocusChanged(selectedBotSimId, tag, $event)"
                                >
                                </system-portal-tag>
                            </div>
                            <div @click="toggleTags()" class="tags-toggle">
                                <md-icon>{{
                                    tagsVisible ? 'expand_more' : 'chevron_right'
                                }}</md-icon>
                                Tags
                            </div>
                            <system-portal-tag
                                v-show="tagsVisible"
                                :simId="selectedBotSimId"
                                :bot="selectedBot"
                                :tag="{ name: 'id' }"
                                :isReadOnly="true"
                                :showPinButton="false"
                                @click="copyId()"
                            >
                            </system-portal-tag>
                            <system-portal-tag
                                v-show="tagsVisible"
                                :simId="selectedBotSimId"
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
                                :simId="selectedBotSimId"
                                :bot="selectedBot"
                                :tag="tag"
                                :selected="isTagSelected(tag)"
                                @click="selectTag(tag)"
                                @pin="pinTag(tag)"
                                @focusChanged="onTagFocusChanged(selectedBotSimId, tag, $event)"
                            >
                            </system-portal-tag>
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
                    <div class="tags" v-else-if="selectedPane === 'diff' && hasDiffSelection">
                        <div class="tags-list">
                            <div @click="toggleTags()" class="tags-toggle">
                                <md-icon>{{
                                    tagsVisible ? 'expand_more' : 'chevron_right'
                                }}</md-icon>
                                Tags
                            </div>

                            <system-portal-diff-tag
                                v-show="tagsVisible"
                                v-for="tag of diffTags"
                                :key="`tag-${tag.name}.${tag.space}`"
                                ref="tagEditors"
                                :originalBot="diffOriginalBot"
                                :modifiedBot="diffNewBot"
                                :tag="tag"
                                :selected="isDiffTagSelected(tag)"
                                @click="selectDiffTag(tag)"
                                @pin="pinTag(tag)"
                                @focusChanged="onDiffTagFocusChanged(tag, $event)"
                            >
                            </system-portal-diff-tag>
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
                                    :prefix="recent.prefix"
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
                            <tag-diff-editor
                                v-if="
                                    selectedPane === 'diff' &&
                                    diffOriginalBot &&
                                    diffNewBot &&
                                    diffSelectedTag
                                "
                                :originalBot="diffOriginalBot"
                                :originalTag="diffSelectedTag"
                                :originalTagSpace="diffSelectedTagSpace"
                                :modifiedBot="diffNewBot"
                                :modifiedTag="diffSelectedTag"
                                :modifiedTagSpace="diffSelectedTagSpace"
                                :showResize="false"
                                @onOriginalFocused="onOriginalEditorFocused($event)"
                                @onModifiedFocused="onModifiedEditorFocused($event)"
                            >
                            </tag-diff-editor>
                            <tag-value-editor
                                v-else-if="
                                    selectedPane === 'diff' &&
                                    (diffOriginalBot || diffNewBot) &&
                                    diffSelectedTag
                                "
                                ref="multilineEditor"
                                :simId="diffOriginalBotSimId || diffNewBotSimId"
                                :bot="diffOriginalBot || diffNewBot"
                                :tag="diffSelectedTag"
                                :space="diffSelectedTagSpace"
                                :showDesktopEditor="true"
                                :showResize="false"
                                @onFocused="onEditorFocused($event)"
                            >
                            </tag-value-editor>
                            <tag-value-editor
                                v-else-if="selectedBot && hasTag()"
                                ref="multilineEditor"
                                :simId="selectedBotSimId"
                                :bot="selectedBot"
                                :tag="selectedTag || getFirstTag()"
                                :space="selectedTagSpace"
                                :showDesktopEditor="true"
                                :showResize="false"
                                @onFocused="onEditorFocused($event)"
                                @modelChanged="onEditorModelChanged($event)"
                            >
                            </tag-value-editor>
                        </div>
                    </div>
                </div>
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
                        @autoFill="newTag = $event"
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

        <md-dialog :md-active.sync="isSettingSheetPortal" class="set-sheet-portal-dialog">
            <md-dialog-title>Enter sheetPortal dimension</md-dialog-title>
            <md-dialog-content>
                <form class="bot-table-form" @submit.prevent="setSheetPortal()">
                    <tag-editor
                        ref="tagEditor"
                        :useMaterialInput="true"
                        v-model="sheetPortalValue"
                    ></tag-editor>
                    <div class="finish-tag-button-wrapper">
                        <md-button class="md-icon-button md-dense finish-tag-button" type="submit">
                            <md-icon class="done">check</md-icon>
                        </md-button>
                        <md-button
                            class="md-icon-button md-dense finish-tag-button"
                            @click="cancelSetSheetPortal()"
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
