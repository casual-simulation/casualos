<template>
  <table v-if="hasFiles" class="file-table">
    <thead>
      <tr>
        <th></th>
        <th><file-tag tag="id"></file-tag></th>

        <th v-for="(tag, index) in tags" :key="index">

          <file-tag :tag="tag"></file-tag>

          <!-- Show X button for tags that don't have values -->
          <md-button
            class="remove-tag md-icon-button md-dense"
            v-if="!tagHasValue(tag)"
            @click="removeTag(tag)"
          >
            <md-icon>close</md-icon>
            <md-tooltip md-delay="1000" md-direction="top">Remove #{{tag}}</md-tooltip>
          </md-button>
        </th>

        <th v-if="isMakingNewTag">
          <tag-editor v-model="newTag" :tagExists="newTagExists" @valid="newTagValidityUpdated"></tag-editor>
        </th>

        <th v-show="!readOnly">
          <md-button
            class="new-tag-button"
            :disabled="isMakingNewTag && !newTagValid"
            @click="addTag()"
          >{{isMakingNewTag ? "Done": "+ New Tag"}}</md-button>
          <md-button 
            class="new-tag-button" 
            @click="cancelNewTag()" 
            v-if="isMakingNewTag">Cancel</md-button>
        </th>
      </tr>
    </thead>
    <tbody>
      <file-row
        v-for="(file, index) in files"
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