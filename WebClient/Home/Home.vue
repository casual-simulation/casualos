<!-- App.vue -->
<template>
  <div>
      <game-view class="game-view">
        <div class="ui-container">
          <md-card class="info-card" v-if="isOpen">
            <md-card-content>
              <div v-if="!isLoading">
                <h4 class="files-header">Files</h4>
                <table v-if="hasFiles" class="file-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>ID</th>

                      <th v-for="(tag, index) in tags" :key="index">
                        #{{tag}}
                        <!-- Show X button for tags that don't have values -->

                        <md-button class="remove-tag md-icon-button md-dense" v-if="!tagHasValue(tag)" @click="removeTag(tag)">
                          <md-icon>close</md-icon>
                          <md-tooltip md-delay="1000" md-direction="top">Remove #{{tag}}</md-tooltip>
                        </md-button>
                      </th>

                      <th v-if="isMakingNewTag">
                        #<input v-model="newTag">
                      </th>

                      <th>
                        <md-button class="new-tag-button" @click="addTag()">
                          {{isMakingNewTag ? "Done": "+ New Tag"}}
                        </md-button>
                        <md-button class="new-tag-button" @click="cancelNewTag()" v-if="isMakingNewTag">
                          Cancel
                        </md-button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <file-row v-for="(file, index) in files" :key="file.id" :file="file" :tags="tags" @tagChanged="onTagChanged"></file-row>
                  </tbody>
                </table>

                <p v-if="!hasFiles">
                  Select a file
                </p>
              </div>
            </md-card-content>
            <md-card-actions>
              <md-button v-if="hasFiles" @click="clearSelection()">Clear Selection</md-button>
              <md-button @click="close()">Close</md-button>
            </md-card-actions>
          </md-card>

          <div class="toolbar">
            <div class="toolbar-layout">
              <strong class="toolbar-label">Tools</strong>
              <div class="divider"></div>
              <md-button class="toolbar-button" @click="addNewFile()">
                <cube-icon class="toolbar-button-icon" />
                <span>New File</span>
              </md-button>
              <div class="divider"></div>
              <md-button class="toolbar-button" @click="addNewWorkspace()">
                <span>New Workspace</span>
              </md-button>
            </div>
          </div>
        </div>
      </game-view>
  </div>
  
</template>
<script src="./Home.ts"></script>
<style src="./Home.css"></style>