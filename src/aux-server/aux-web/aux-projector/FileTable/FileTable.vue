<template>
    <div class="file-table" ref="wrapper">
        <div class="top-part">
            <div v-show="!isMakingNewTag && hasFiles" class="file-table-toggle-buttons">
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
                    class="md-icon-button create-file"
                    @click="createFile()"
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
                    v-if="selectionMode === 'single' && !diffSelected && files.length === 1"
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
            <div class="file-table-actions">
                <div v-if="isMakingNewTag">
                    <form class="file-table-form" @submit.prevent="addTag()">
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
                <div v-else-if="hasFiles">
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

                    <md-button class="md-icon-button" @click="downloadFiles()">
                        <md-icon>cloud_download</md-icon>
                        <md-tooltip>Download Selection/Search</md-tooltip>
                    </md-button>
                </div>
            </div>
        </div>
        <div>
            <p v-if="isSearch && searchResult === null" class="no-search-results-message">
                No bots found
            </p>
            <p v-else-if="!hasFiles" class="no-files-message">
                Select a bot or search
            </p>
            <div v-else-if="hasFiles" class="file-table-wrapper">
                <div
                    class="file-table-grid"
                    :class="[viewMode]"
                    ref="table"
                    :style="fileTableGridStyle"
                >
                    <!-- Remove all button -->
                    <div class="file-cell remove-item" v-if="!diffSelected">
                        <md-button v-if="isSearch" class="md-dense" @click="clearSearch()">
                            Clear Search
                        </md-button>
                        <div v-else-if="selectionMode === 'multi'">
                            <!-- keep place here so it shows up as empty-->
                        </div>
                    </div>
                    <div v-else class="file-cell header">
                        <!-- keep place here so it shows up as empty-->
                    </div>

                    <!-- ID tag -->
                    <div class="file-cell header">
                        <file-tag tag="id" :allowCloning="false"></file-tag>
                    </div>

                    <!-- Other tags -->
                    <div v-for="(tag, index) in tags" :key="index" class="file-cell header">
                        <file-tag
                            ref="tags"
                            :tag="tag"
                            :allowCloning="files.length === 1"
                        ></file-tag>

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
                    <div class="file-cell new-tag"></div>

                    <!-- Files -->
                    <template v-for="file in files">
                        <!-- deselect button -->
                        <div :key="`${file.id}-remove`" class="file-cell remove-item">
                            <mini-file :files="file" ref="tags" :allowCloning="true"> </mini-file>
                        </div>

                        <!-- File ID -->
                        <file-id
                            ref="tags"
                            :key="file.id"
                            :files="file"
                            :allowCloning="true"
                            :shortID="getShortId(file)"
                            class="file-cell header"
                        >
                        </file-id>

                        <!-- File Tags -->
                        <div
                            v-for="(tag, tagIndex) in tags"
                            :key="`${file.id}-${tagIndex}`"
                            class="file-cell"
                            :class="getTagCellClass(file, tag)"
                        >
                            <file-value
                                ref="tagValues"
                                :readOnly="readOnly || isFileReadOnly(file)"
                                :file="file"
                                :tag="tag"
                                :updateTime="updateTime"
                                @tagChanged="onTagChanged"
                                @focusChanged="onTagFocusChanged(file, tag, $event)"
                            ></file-value>
                        </div>

                        <!-- Empty tag at bottom -->
                        <div :key="`${file.id}-empty`" class="file-cell delete-item">
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
                                @click="deleteFile(file)"
                            >
                                <md-icon class="delete-file-icon">delete_forever</md-icon>
                                <md-tooltip md-delay="1000" md-direction="top"
                                    >Destroy Bot</md-tooltip
                                >
                            </md-button>
                        </div>
                    </template>
                </div>
                <div class="file-section-holder-outer" v-if="getTagBlacklist().length > 0">
                    <div class="file-section-holder-inner">
                        <div
                            v-for="(tagBlacklist, index) in getTagBlacklist()"
                            :key="index"
                            class="file-section"
                        >
                            <md-button
                                v-if="isBlacklistTagActive(index)"
                                class="file-section active"
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
                                class="file-section inactive"
                                @click="toggleBlacklistIndex(index)"
                            >
                                <span v-if="isAllTag(tagBlacklist)"> {{ tagBlacklist }}</span>
                                <span v-else-if="isSpecialTag(tagBlacklist)">
                                    {{ tagBlacklist }} [{{ getBlacklistCount(index) }}]</span
                                >
                                <span v-else
                                    >{{ getVisualTagBlacklist(index) }} [{{
                                        getBlacklistCount(index)
                                    }}]</span
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
                v-if="focusedFile && focusedTag && !isFileReadOnly(focusedFile)"
                class="multi-line-tag-value-wrapper"
            >
                <monaco-editor></monaco-editor>
                <!-- <md-field>
                    <label><file-tag :tag="focusedTag"></file-tag></label>
                    <md-textarea
                        ref="multiLineEditor"
                        v-model="multilineValue"
                        class="multi-line-tag-value-editor"
                        :class="[{ formula: isFocusedTagFormula }]"
                        v-bind:style="getLargeSheetStyle()"
                    >
                    </md-textarea>
                </md-field> -->
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

        <md-snackbar md-position="center" :md-duration="6000" :md-active.sync="showFileDestroyed">
            <span>Destroyed {{ deletedFileId }}</span>
            <md-button class="md-primary" @click="undoDelete()">Undo</md-button>
        </md-snackbar>
    </div>
</template>
<script src="./FileTable.ts"></script>
<style src="./FileTable.css"></style>
