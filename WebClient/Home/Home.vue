<!-- App.vue -->
<template>
  <div>
      <game-view class="game-view">
        <div class="ui-container">
          <md-card class="info-card" v-if="isOpen">
            <md-card-content>
              Welcome Home {{user.name}}!

              <div v-if="!isLoading">
                <h4>Files</h4>
                <ul>
                  <li v-for="file in files" :key="file">
                    {{file}}
                  </li>
                </ul>

                <h4>Commits</h4>
                <ul>
                  <li v-for="commit in commits" :key="commit.oid">
                    {{commit.message}}
                  </li>
                </ul>

                <h4>Status</h4>
                <ul>
                  <li v-for="file in index" :key="file"> 
                    {{file}}
                  </li>
                </ul>
              </div>
              <div class="status-container">
                <md-progress-spinner v-if="isLoading" :md-mode="progressMode" :md-value="progress"></md-progress-spinner>
                <p>
                  {{status}}
                </p>
              </div>
            </md-card-content>
            <md-card-actions>
              <md-button @click="checkStatus()">Check Status</md-button>
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