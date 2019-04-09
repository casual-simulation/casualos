<template>
  <div class="file-table">
    <div class="top-part md-layout">
      <div class="md-layout-item md-size-20">
        <file-table-toggle 
            :files="files"
            :showNumFiles="selectionMode !== 'single'"
            @click="closeWindow()">
        </file-table-toggle>
        <!-- <md-button @click="flipTable()">Flip</md-button> -->
      </div>
      <div class="md-layout-item md-size-80 file-table-actions">
        <div v-if="!isMakingNewTag && !isSearching">
          <md-button
            class="new-tag-button"
            @click="addTag()">+tag</md-button>
          <md-button 
            class="search-button md-icon-button"
            @click="startSearch()"
            v-shortkey.once="['ctrl', 'f']"
            @shortkey="startSearch()">
            <md-icon>search</md-icon>
          </md-button>
        </div>
        <div v-else-if="isMakingNewTag">
            <form class="file-table-form" @submit.prevent="addTag()">
                <div class="finish-tag-button-wrapper">
                    <md-button
                        class="md-icon-button finish-tag-button"
                        type="submit">
                        <md-icon class="done">check</md-icon>
                    </md-button>
                    <md-button
                        class="md-icon-button finish-tag-button"
                        @click="cancelNewTag()">
                        <md-icon class="cancel">cancel</md-icon>
                    </md-button>
                </div>
                <tag-editor 
                    ref="tagEditor"
                    :useMaterialInput="true"
                    v-model="newTag"
                    :tagExists="newTagExists"
                    :isAction="isMakingNewAction"
                    @valid="newTagValidityUpdated"></tag-editor>
            </form>
        </div>
        <div v-else-if="isSearching">
            <form class="file-table-form" @submit.prevent="addSearch()">
                <div class="finish-tag-button-wrapper">
                    <md-button
                        class="md-icon-button finish-tag-button"
                        type="submit">
                        <md-icon class="done">check</md-icon>
                    </md-button>
                    <md-button
                        class="md-icon-button finish-tag-button"
                        @click="cancelSearch()">
                        <md-icon class="cancel">cancel</md-icon>
                    </md-button>
                </div>
                <md-field class="search-field">
                    <md-icon>search</md-icon>
                    <label>Search...</label>
                    <md-input 
                        ref="searchField"
                        v-model="search" 
                        @keyup.esc="cancelSearch()"></md-input>
                </md-field>
            </form>
        </div>
      </div>
    </div>
    <div>
        <p v-if="isSearching && !search" class="no-search-results-message">
            Enter a search
        </p>
        <p v-else-if="isSearching && !hasSearchResults()" class="no-search-results-message">
            No files found
        </p>
        <div v-else-if="hasFiles" class="file-table-wrapper">
            <!--   -->
            <div class="file-table-grid" :class="[viewMode]" ref="table" :style="fileTableGridStyle">

                <!-- Remove all button -->
                <div class="file-cell remove-item">
                    <md-button v-if="selectionMode === 'multi'" class="md-dense" @click="clearSelection()">
                        Unselect All
                    </md-button>
                    <md-button v-else-if="diffSelected" class="md-dense" @click="clearDiff()">
                        Clear Diff
                    </md-button>
                    <md-button v-else class="md-dense" @click="multiSelect()">
                        Select Multiple
                    </md-button>
                </div>

                <!-- ID tag -->
                <div class="file-cell header">
                    <file-tag tag="id"></file-tag>
                </div>

                <!-- Other tags -->
                <div v-for="(tag, index) in tags" :key="index" class="file-cell header">
                    <file-tag :tag="tag"></file-tag>

                    <!-- Show X button for tags that don't have values or tags that are hidden -->
                    <md-button
                        class="remove-tag md-icon-button md-dense"
                        v-if="!tagHasValue(tag) || isHiddenTag(tag)"
                        @click="removeTag(tag)">
                        <md-icon>close</md-icon>
                        <md-tooltip md-delay="1000" md-direction="top">Remove #{{tag}}</md-tooltip>
                    </md-button>

                </div>

                <!-- Files -->
                <template v-for="(file) in displayedFiles">

                <!-- deselect button -->
                    <div :key="`${file.id}-remove`" class="file-cell remove-item">
                        <md-button class="md-icon-button md-dense" @click="toggleFile(file)">
                            <md-icon>remove</md-icon>
                            <md-tooltip md-delay="1000" md-direction="top">Unselect Item</md-tooltip>
                        </md-button>
                    </div>

                    <!-- File ID -->
                    <div :key="file.id" class="file-cell id header">{{getShortId(file)}}</div>

                    <!-- File Tags -->
                    <div v-for="(tag, tagIndex) in tags" :key="`${file.id}-${tagIndex}`" class="file-cell" :class="getTagCellClass(file, tag)">
                        <file-value 
                            :readOnly="readOnly"
                            :file="file" 
                            :tag="tag" 
                            :updateTime="updateTime"
                            :showFormulaWhenFocused="false"
                            @tagChanged="onTagChanged"
                            @focusChanged="onTagFocusChanged(file, tag, $event)"></file-value>
                    </div>
                </template>
            </div>
        </div>
        <div v-else-if="hasSearchResults()" class="search-results-wrapper">
            <tree-view :data="getSearchResultData()" :options="{ limitRenderDepth: true, maxDepth: 1 }"></tree-view>
        </div>
        <div v-if="focusedTag && !isSearching" class="multi-line-tag-value-wrapper">
            <md-field>
                <label><file-tag :tag="focusedTag"></file-tag></label>
                <md-textarea ref="multiLineEditor" v-model="multilineValue"
                    md-autogrow
                    class="multi-line-tag-value-editor"
                    :class="[{ formula: isFocusedTagFormula }]">
                </md-textarea>
            </md-field>
        </div>
    </div>
  </div>
</template>
<script src="./FileTable.ts"></script>
<style src="./FileTable.css"></style>