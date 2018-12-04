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
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Type</th>

                      <th v-for="(tag, index) in tags" :key="index">
                        #{{tag}}
                      </th>

                      <th v-if="isMakingNewTag">
                        #<input v-model="newTag">
                      </th>

                      <th>
                        <md-button @click="addTag()">
                          {{isMakingNewTag ? "Done": "+ New Tag"}}
                        </md-button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>

                    <tr v-for="file in files" :key="file.id">
                      <td>{{file.id}}</td>
                      <td>{{file.type}}</td>
                      <th v-if="file.type === 'object'" v-for="tag in tags" :key="tag">
                        <input @input="valueChanged(file, tag, $event.target.value)" :value="file.tags[tag]">
                      </th>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="status-container">
                <md-progress-spinner v-if="isLoading" :md-mode="progressMode" :md-value="progress"></md-progress-spinner>
                <p>
                  {{status}}
                </p>
              </div>
            </md-card-content>
            <md-card-actions>
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
              <div v-if="canSave()" class="divider"></div>
              <md-button v-if="canSave()" class="toolbar-button" @click="save()">
                <span>Save</span>
              </md-button>
            </div>
          </div>
        </div>
      </game-view>
  </div>
  
</template>
<script src="./Home.ts"></script>
<style src="./Home.css"></style>