<template>
    <div class="bot-table" ref="wrapper">
        <div class="bot-table-container">
            <div class="bot-table-wrapper">
                <div
                    class="bot-table-grid"
                    :class="[viewMode]"
                    ref="table"
                    :style="botTableGridStyle"
                >
                    <!-- New Tag and New Bot buttons -->
                    <div class="bot-cell header">
                        <div v-show="!isMakingNewTag">
                            <!-- keep place here so it shows up as empty-->
                            <md-button
                                v-if="!isSearch && showNewBot"
                                class="md-icon-button create-bot"
                                @click="createBot()"
                            >
                                <svg-icon name="NewBot" width="640" height="640"></svg-icon>
                                <md-tooltip>Create Empty Bot</md-tooltip>
                            </md-button>
                            <md-button
                                v-show="hasBots"
                                class="md-icon-button"
                                @click="openNewTag()"
                            >
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
                    </div>

                    <!-- ID tag -->
                    <div v-if="showID" class="bot-cell header">
                        <bot-tag tag="id" :allowCloning="false"></bot-tag>
                    </div>

                    <!-- Read only tags -->
                    <div
                        v-for="(tag, tagIndex) in readOnlyTags"
                        :key="`read-only-${tagIndex}`"
                        class="bot-cell header"
                        @click="searchForTag(tag)"
                    >
                        <bot-tag :tag="tag" :allowCloning="true"></bot-tag>
                    </div>

                    <!-- Other tags -->
                    <div
                        v-for="({ tag, space }, index) in tags"
                        :key="index"
                        class="bot-cell header"
                        @click="searchForTag(tag)"
                    >
                        <bot-tag
                            ref="tags"
                            :tag="tag"
                            :prefix="getTagPrefix(tag, space)"
                            :allowCloning="true"
                        ></bot-tag>

                        <!-- Show X button for tags that don't have values or tags that are hidden -->
                        <md-button
                            class="remove-tag md-icon-button md-dense"
                            v-if="!tagHasValue(tag, space) || isHiddenTag(tag)"
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
                            <mini-bot
                                :bots="bot"
                                ref="tags"
                                :allowCloning="true"
                                :createMod="true"
                                @click="botClicked(bot)"
                            >
                            </mini-bot>
                        </div>

                        <!-- Bot ID -->
                        <bot-id
                            ref="tags"
                            v-if="showID"
                            :key="bot.id"
                            :bots="bot"
                            :allowCloning="true"
                            :shortID="getShortId(bot)"
                            class="bot-cell header"
                            @click="botIDClick"
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
                            v-for="({ tag, space }, tagIndex) in tags"
                            :key="`${bot.id}-${tagIndex}`"
                            class="bot-cell value"
                            :class="getTagCellClass(bot, tag)"
                        >
                            <bot-value
                                ref="tagValues"
                                :readOnly="readOnly || isBotReadOnly(bot)"
                                :bot="bot"
                                :tag="tag"
                                :space="space"
                                :alwaysShowRealValue="shouldShowRealValue(tag, space, tagIndex)"
                                @tagChanged="onTagChanged"
                                @focusChanged="onTagFocusChanged(bot, tag, space, $event)"
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
            </div>
            <div class="bot-table-middle">
                <md-button v-if="showExitSheet" class="md-fab exit-sheet" @click="exitSheet()">
                    <md-icon>{{ finalExitSheetIcon }}</md-icon>
                    <md-tooltip>{{ finalExitSheetHint }}</md-tooltip>
                </md-button>
            </div>
            <tag-value-editor-wrapper v-if="focusedBot && focusedTag && !isBotReadOnly(focusedBot)">
                <tag-value-editor
                    ref="multilineEditor"
                    :bot="focusedBot"
                    :tag="focusedTag"
                    :space="focusedSpace"
                    :showDesktopEditor="!isMobile()"
                ></tag-value-editor>
            </tag-value-editor-wrapper>
        </div>

        <md-snackbar md-position="center" :md-duration="6000" :md-active.sync="showBotDestroyed">
            <span>Destroyed {{ deletedBotId }}</span>
            <md-button class="md-primary" @click="undoDelete()">Undo</md-button>
        </md-snackbar>

        <md-dialog :md-active.sync="isMakingNewTag" class="new-tag-dialog">
            <md-dialog-title>Add New Tag</md-dialog-title>
            <md-dialog-content>
                <form class="bot-table-form" @submit.prevent="addTag()">
                    <tag-editor
                        ref="tagEditor"
                        :useMaterialInput="true"
                        v-model="newTag"
                        :tagExists="newTagExists"
                        :isAction="false"
                        @valid="newTagValidityUpdated"
                        @autoFill="finishAddTag"
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
    </div>
</template>
<script src="./BotTable.ts"></script>
<style src="./BotTable.css"></style>
