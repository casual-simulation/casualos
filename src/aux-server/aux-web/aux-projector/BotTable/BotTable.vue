<template>
    <div class="bot-table" ref="wrapper">
        <div class="bot-table-container">
            <div class="top-part">
                <div v-show="!isMakingNewTag && hasBots" class="bot-table-toggle-buttons">
                    <md-button class="md-icon-button" @click="openNewTag()">
                        <picture>
                            <source srcset="../public/icons/tag-add.webp" type="image/webp" />
                            <source srcset="../public/icons/tag-add.png" type="image/png" />
                            <img alt="Add Tag" src="../public/icons/tag-add.png" />
                        </picture>
                        <md-tooltip>Add Tag</md-tooltip>
                    </md-button>
                    <md-button
                        v-if="!isSearch"
                        class="md-icon-button create-bot"
                        @click="createBot()"
                    >
                        <cube-icon></cube-icon>
                        <md-tooltip>Create Empty Bot</md-tooltip>
                    </md-button>
                    <md-button class="md-icon-button create-surface" @click="createSurface()">
                        <hex-icon></hex-icon>
                        <md-tooltip v-if="diffSelected">Create Context</md-tooltip>
                        <md-tooltip v-else>Create Context from Selection</md-tooltip>
                    </md-button>

                    <md-button
                        v-if="selectionMode === 'single' && !diffSelected && bots.length === 1"
                        class="md-icon-button create-surface"
                        @click="clearSelection()"
                    >
                        <picture>
                            <source srcset="../public/icons/make-merge.webp" type="image/webp" />
                            <source srcset="../public/icons/make-merge.png" type="image/png" />
                            <img alt="Make Merge" src="../public/icons/make-merge.png" />
                        </picture>
                        <md-tooltip>Create Mod From Selection</md-tooltip>
                    </md-button>
                </div>
                <div class="bot-table-actions">
                    <div v-if="isMakingNewTag">
                        <form class="bot-table-form" @submit.prevent="addTag()">
                            <tag-editor
                                ref="tagEditor"
                                :useMaterialInput="true"
                                v-model="newTag"
                                :tagExists="newTagExists"
                                :isAction="false"
                                @valid="newTagValidityUpdated"
                            ></tag-editor>
                            <div class="finish-tag-button-wrapper">
                                <md-button class="md-icon-button finish-tag-button" type="submit">
                                    <md-icon class="done">check</md-icon>
                                </md-button>
                                <md-button
                                    class="md-icon-button finish-tag-button"
                                    @click="cancelNewTag()"
                                >
                                    <md-icon class="cancel">cancel</md-icon>
                                </md-button>
                            </div>
                        </form>
                    </div>
                    <div v-else-if="hasBots">
                        <md-button
                            v-if="!isSearch && selectionMode != 'multi'"
                            class="md-icon-button create-surface"
                            @click="multiSelect()"
                        >
                            <multi-icon></multi-icon>
                            <md-tooltip>Multiselect Bots</md-tooltip>
                        </md-button>

                        <md-button
                            v-if="!isMobile()"
                            class="md-icon-button create-surface"
                            @click="toggleSheet()"
                        >
                            <resize-icon></resize-icon>
                            <md-tooltip>Toggle Size</md-tooltip>
                        </md-button>

                        <md-button class="md-icon-button" @click="downloadBots()">
                            <md-icon>cloud_download</md-icon>
                            <md-tooltip>Download Selection/Search</md-tooltip>
                        </md-button>
                    </div>
                </div>
            </div>
            <p v-if="isSearch && searchResult === null" class="no-search-results-message">
                No bots found
            </p>
            <p v-else-if="!hasBots" class="no-bots-message">
                Select a bot or search
            </p>
            <div v-else-if="hasBots" class="bot-table-wrapper">
                <div
                    class="bot-table-grid"
                    :class="[viewMode]"
                    ref="table"
                    :style="botTableGridStyle"
                >
                    <!-- Remove all button -->
                    <div class="bot-cell remove-item" v-if="!diffSelected">
                        <md-button v-if="isSearch" class="md-dense" @click="clearSearch()">
                            Clear Search
                        </md-button>
                        <div v-else-if="selectionMode === 'multi'">
                            <!-- keep place here so it shows up as empty-->
                        </div>
                    </div>
                    <div v-else class="bot-cell header">
                        <!-- keep place here so it shows up as empty-->
                    </div>

                    <!-- ID tag -->
                    <div class="bot-cell header" @click="searchForTag('id')">
                        <bot-tag tag="id" :allowCloning="false"></bot-tag>
                    </div>

                    <!-- Read only tags -->
                    <div
                        v-for="(tag, tagIndex) in readOnlyTags"
                        :key="`read-only-${tagIndex}`"
                        class="bot-cell header"
                        @click="searchForTag(tag)"
                    >
                        <bot-tag :tag="tag" :allowCloning="false"></bot-tag>
                    </div>

                    <!-- Other tags -->
                    <div
                        v-for="(tag, index) in tags"
                        :key="index"
                        class="bot-cell header"
                        @click="searchForTag(tag)"
                    >
                        <bot-tag
                            ref="tags"
                            :tag="tag"
                            :isScript="isTagOnlyScripts(tag)"
                            :isFormula="isTagOnlyFormulas(tag)"
                            :allowCloning="bots.length === 1"
                        ></bot-tag>

                        <!-- Show X button for tags that don't have values or tags that are hidden -->
                        <md-button
                            class="remove-tag md-icon-button md-dense"
                            v-if="!tagHasValue(tag) || isHiddenTag(tag)"
                            @click="removeTag(tag)"
                        >
                            <md-icon>close</md-icon>
                            <md-tooltip md-delay="1000" md-direction="top"
                                >Remove #{{ tag }}</md-tooltip
                            >
                        </md-button>
                    </div>

                    <!-- New Tag at bottom -->
                    <div class="bot-cell new-tag"></div>

                    <!-- Bots -->
                    <template v-for="bot in bots">
                        <!-- deselect button -->
                        <div :key="`${bot.id}-remove`" class="bot-cell remove-item">
                            <mini-bot :bots="bot" ref="tags" :allowCloning="true"> </mini-bot>
                        </div>

                        <!-- Bot ID -->
                        <bot-id
                            ref="tags"
                            :key="bot.id"
                            :bots="bot"
                            :allowCloning="true"
                            :shortID="getShortId(bot)"
                            class="bot-cell header"
                        >
                        </bot-id>

                        <!-- Read Only Tags -->
                        <span
                            v-for="(tag, tagIndex) in readOnlyTags"
                            :key="`${bot.id}-read-only-${tagIndex}`"
                            class="bot-cell header tag"
                        >
                            {{ getBotValue(bot, tag) }}
                        </span>

                        <!-- Bot Tags -->
                        <div
                            v-for="(tag, tagIndex) in tags"
                            :key="`${bot.id}-${tagIndex}`"
                            class="bot-cell"
                            :class="getTagCellClass(bot, tag)"
                        >
                            <bot-value
                                ref="tagValues"
                                :readOnly="readOnly || isBotReadOnly(bot)"
                                :bot="bot"
                                :tag="tag"
                                :updateTime="updateTime"
                                @tagChanged="onTagChanged"
                                @focusChanged="onTagFocusChanged(bot, tag, $event)"
                            ></bot-value>
                        </div>

                        <!-- Empty tag at bottom -->
                        <div :key="`${bot.id}-empty`" class="bot-cell delete-item">
                            <div v-if="isEmptyDiff()" class="md-dense"></div>
                            <md-button
                                v-else-if="diffSelected"
                                class="md-dense"
                                @click="clearDiff()"
                            >
                                Reset
                            </md-button>
                            <md-button
                                v-else
                                class="md-icon-button md-dense"
                                @click="deleteBot(bot)"
                            >
                                <md-icon class="delete-bot-icon">delete_forever</md-icon>
                                <md-tooltip md-delay="1000" md-direction="top"
                                    >Destroy Bot</md-tooltip
                                >
                            </md-button>
                        </div>
                    </template>
                </div>
                <div class="bot-section-holder-outer" v-if="getTagBlacklist().length > 0">
                    <div class="bot-section-holder-inner">
                        <div
                            v-for="(tagBlacklist, index) in getTagBlacklist()"
                            :key="index"
                            class="bot-section"
                        >
                            <md-button
                                v-if="isBlacklistTagActive(index)"
                                class="bot-section active"
                                @click="toggleBlacklistIndex(index)"
                            >
                                <span v-if="isAllTag(tagBlacklist)"> {{ tagBlacklist }}</span>
                                <span v-else-if="isSpecialTag(tagBlacklist)">
                                    {{ tagBlacklist }}</span
                                >
                                <span v-else>{{ getVisualTagBlacklist(index) }}</span>
                            </md-button>
                            <md-button
                                v-else
                                class="bot-section inactive"
                                @click="toggleBlacklistIndex(index)"
                            >
                                <span v-if="isAllTag(tagBlacklist)"> {{ tagBlacklist }}</span>
                                <span v-else-if="isSpecialTag(tagBlacklist)">
                                    {{ tagBlacklist }} {{ getBlacklistCount(index) }}</span
                                >
                                <span v-else
                                    >{{ getVisualTagBlacklist(index) }}
                                    {{ getBlacklistCount(index) }}</span
                                >
                            </md-button>
                        </div>
                    </div>
                </div>
            </div>
            <div v-else-if="searchResult !== null" class="search-results-wrapper">
                <tree-view
                    :data="searchResult"
                    :options="{ limitRenderDepth: true, maxDepth: 1 }"
                ></tree-view>
            </div>
            <div
                v-if="focusedBot && focusedTag && !isBotReadOnly(focusedBot)"
                class="tag-value-editor-wrapper"
            >
                <tag-value-editor
                    ref="multilineEditor"
                    :bot="focusedBot"
                    :tag="focusedTag"
                    :showDesktopEditor="!isMobile()"
                ></tag-value-editor>
            </div>
        </div>

        <md-dialog :md-active.sync="showCreateWorksurfaceDialog">
            <md-dialog-title v-if="diffSelected">Create Context</md-dialog-title>
            <md-dialog-title v-else>Create Context from Selection</md-dialog-title>

            <md-dialog-content>
                <md-field>
                    <label>Context</label>
                    <md-input
                        ref="input"
                        v-model="worksurfaceContext"
                        maxlength="40"
                        @keydown.enter.native="onConfirmCreateWorksurface"
                    />
                </md-field>

                <md-checkbox v-model="showSurface">Show Surface</md-checkbox>
                <md-checkbox v-model="worksurfaceAllowPlayer">Lock Context</md-checkbox>
            </md-dialog-content>

            <md-dialog-actions>
                <md-button class="md-primary" @click="onCancelCreateWorksurface">Cancel</md-button>
                <md-button class="md-primary" @click="onConfirmCreateWorksurface">Save</md-button>
            </md-dialog-actions>
        </md-dialog>

        <md-snackbar md-position="center" :md-duration="6000" :md-active.sync="showBotDestroyed">
            <span>Destroyed {{ deletedBotId }}</span>
            <md-button class="md-primary" @click="undoDelete()">Undo</md-button>
        </md-snackbar>
    </div>
</template>
<script src="./BotTable.ts"></script>
<style src="./BotTable.css"></style>
