<template>
  <div class="file-table">
    <div class="top-part md-layout">
      <div class="md-layout-item md-size-20">
        <file-table-toggle :files="files" @click="closeWindow()"></file-table-toggle>
      </div>
      <div class="md-layout-item md-size-80 file-table-actions">
        <div v-if="!isMakingNewTag">
          <md-button
            class="new-tag-button"
            @click="addTag(true)">+action</md-button>
          <md-button
            class="new-tag-button"
            @click="addTag()">+tag</md-button>
        </div>
        <div v-else>
          <div class="finish-tag-button-wrapper">
            <md-button
              class="md-icon-button finish-tag-button"
              @click="addTag()">
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
        </div>
      </div>
    </div>
    <div v-if="hasFiles" class="file-table-wrapper">
      <table class="file-table" ref="table">
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
    </div>
  </div>
</template>
<script src="./FileTable.ts"></script>
<style src="./FileTable.css"></style>