<template>
    <div class="file-table" ref="wrapper">
        <div class="top-part">
            <div v-show="!isMakingNewTag && hasFiles" class="file-table-toggle-buttons">
                <md-button class="md-icon-button hidden-button" @click="toggleHidden()">
                    <md-icon v-if="showHidden">visibility</md-icon>
                    <md-icon v-else>visibility_off</md-icon>
                    <md-tooltip v-if="showHidden">Hide Hidden Tags</md-tooltip>
                    <md-tooltip v-else>Show Hidden Tags</md-tooltip>
                </md-button>
                <md-button class="md-icon-button" @click="addTag()">
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
                    <md-tooltip>Create Empty File</md-tooltip>
                </md-button>
                <md-button class="md-icon-button create-surface" @click="createSurface()">
                    <hex-icon></hex-icon>
                    <md-tooltip>Create Worksurface</md-tooltip>
                </md-button>
            </div>
            <div class="file-table-actions">
                <div v-if="isMakingNewTag">
                    <form class="file-table-form" @submit.prevent="addTag()">
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
                        <tag-editor
                            ref="tagEditor"
                            :useMaterialInput="true"
                            v-model="newTag"
                            :tagExists="newTagExists"
                            :isAction="false"
                            @valid="newTagValidityUpdated"
                        ></tag-editor>
                    </form>
                </div>
                <div v-else-if="hasFiles">
                    <md-button class="md-icon-button" @click="downloadFiles()">
                        <md-icon>cloud_download</md-icon>
                        <md-tooltip>Download Selection/Search</md-tooltip>
                    </md-button>
                </div>
            </div>
        </div>
        <div>
            <p v-if="isSearch && searchResult === null" class="no-search-results-message">
                No files found
            </p>
            <p v-else-if="!hasFiles" class="no-files-message">
                Select a file or search
            </p>
            <div v-else-if="hasFiles" class="file-table-wrapper">
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
                                <span v-else-if="isActionTag(tagBlacklist)">
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
                                <span v-else-if="isActionTag(tagBlacklist)">
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
                <div
                    class="file-table-grid"
                    :class="[viewMode]"
                    ref="table"
                    :style="fileTableGridStyle"
                >
                    <!-- Remove all button -->
                    <div class="file-cell remove-item">
                        <md-button v-if="isSearch" class="md-dense" @click="clearSearch()">
                            Clear Search
                        </md-button>
                        <md-button
                            v-else-if="selectionMode === 'multi'"
                            class="md-dense"
                            @click="clearSelection()"
                        >
                            Unselect All
                        </md-button>
                        <md-button v-else-if="diffSelected" class="md-dense" @click="clearDiff()">
                            Clear Diff
                        </md-button>
                        <md-button v-else class="md-dense" @click="multiSelect()">
                            Multi Select
                        </md-button>
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
                    <div class="file-cell new-tag">
                        <md-button class="md-dense" @click="addTag('bottom')">
                            <picture>
                                <source srcset="../public/icons/tag-add.webp" type="image/webp" />
                                <source srcset="../public/icons/tag-add.png" type="image/png" />
                                <img alt="Add Tag" src="../public/icons/tag-add.png" />
                            </picture>
                            Add Tag
                        </md-button>
                    </div>

                    <!-- Files -->
                    <template v-for="file in files">
                        <!-- deselect button -->
                        <div :key="`${file.id}-remove`" class="file-cell remove-item">
                            <md-button
                                v-if="!isSearch"
                                class="md-icon-button md-dense"
                                @click="toggleFile(file)"
                            >
                                <md-icon>remove</md-icon>
                                <md-tooltip md-delay="1000" md-direction="top"
                                    >Unselect Item</md-tooltip
                                >
                            </md-button>
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
                            <md-button class="md-dense" @click="deleteFile(file)">
                                Destroy File
                            </md-button>
                        </div>
                    </template>
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
                <md-field>
                    <label><file-tag :tag="focusedTag"></file-tag></label>
                    <md-textarea
                        ref="multiLineEditor"
                        v-model="multilineValue"
                        class="multi-line-tag-value-editor"
                        :class="[{ formula: isFocusedTagFormula }]"
                    >
                    </md-textarea>
                </md-field>
            </div>
        </div>

        <md-dialog :md-active.sync="showCreateWorksurfaceDialog">
            <md-dialog-title>Create Workspace</md-dialog-title>

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

                <md-checkbox v-model="worksurfaceAllowPlayer">Make available in player</md-checkbox>
            </md-dialog-content>

            <md-dialog-actions>
                <md-button class="md-primary" @click="onCancelCreateWorksurface">Cancel</md-button>
                <md-button class="md-primary" @click="onConfirmCreateWorksurface">Save</md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./FileTable.ts"></script>
<style src="./FileTable.css"></style>
