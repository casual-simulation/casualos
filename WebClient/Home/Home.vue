<!-- App.vue -->
<template>
  <div>
      <game-view class="game-view">
        <div class="ui-container">
          <md-card class="info-card" v-if="isOpen">
            <md-card-content>
              <div v-if="!isLoading">
                Welcome Home {{user.name}}!

                <h4>Files</h4>

                <table v-if="hasFiles" class="file-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>ID</th>

                      <th v-for="(tag, index) in tags" :key="index">
                        #{{tag}}
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

                    <tr v-for="(file, index) in files" :key="file.id" class="file-row">
                      <td class="file-close">
                        <md-button class="md-icon-button md-dense" @click="toggleFile(file)">
                          <md-icon>close</md-icon>
                        </md-button>
                      </td>
                      <td class="file-id">{{file.id.substring(0, 5)}}</td>
                      <td v-if="file.type === 'object'" v-for="tag in tags" :key="tag">
                        <input @input="valueChanged(file, tag, $event.target.value)" :value="file.tags[tag]">
                      </td>
                    </tr>
                  </tbody>
                </table>

                <p v-if="!hasFiles">
                  Select a file
                </p>
              </div>
              <div class="status-container">
                <md-progress-spinner v-if="isLoading" :md-mode="progressMode" :md-value="progress"></md-progress-spinner>
                <p>
                  {{status}}
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