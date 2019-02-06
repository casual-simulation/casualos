<template>
  <table v-if="hasFiles" class="file-table" :class="{ 'has-add-button': showAddTagButton }">
    <thead>
      <tr>
        <th class="file-close">
          <md-button class="md-icon-button md-dense" @click="clearSelection()">
            <md-icon>remove</md-icon>
            <md-tooltip md-delay="1000" md-direction="top">Unselect All</md-tooltip>
          </md-button>
        </th>
        <th><file-tag tag="id"></file-tag></th>

        <th v-for="(tag, index) in tags" :key="index">

          <file-tag :tag="tag"></file-tag>

          <!-- Show X button for tags that don't have values or tags that are hidden -->
          <md-button
            class="remove-tag md-icon-button md-dense"
            v-if="!tagHasValue(tag) || isHiddenTag(tag)"
            @click="removeTag(tag)"
          >
            <md-icon>close</md-icon>
            <md-tooltip md-delay="1000" md-direction="top">Remove #{{tag}}</md-tooltip>
          </md-button>
        </th>

        <th v-if="isMakingNewTag">
          <tag-editor 
            v-model="newTag" 
            :tagExists="newTagExists" 
            :isAction="isMakingNewAction"
            @valid="newTagValidityUpdated"></tag-editor>
        </th>

        <th class="add-button-cell" v-if="!readOnly && showAddTagButton">
          <md-button
            class="new-tag-button"
            :disabled="isMakingNewTag && !newTagValid"
            @click="addTag()"
          >{{isMakingNewTag ? "Done": "+tag"}}</md-button>
          <md-button 
            class="new-tag-button" 
            @click="cancelNewTag()" 
            v-if="isMakingNewTag">Cancel</md-button>
        </th>
      </tr>
    </thead>
    <tbody>
      <file-row
        v-for="file in files"
        :key="file.id"
        :file="file"
        :tags="tags"
        :readOnly="readOnly"
        :updateTime="updateTime"
        @tagChanged="onTagChanged"
        @tagFocusChanged="onTagFocusChanged"
      ></file-row>
    </tbody>
  </table>
</template>
<script src="./FileTable.ts"></script>
<style src="./FileTable.css"></style>