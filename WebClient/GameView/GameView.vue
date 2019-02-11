<!-- App.vue -->
<template>
  <div ref="container" class="game-container">
      <div class="game-canvas" ref="gameView"></div>
      <slot></slot>
      <div class="ui-container">
        <div class="toolbar">
          <md-button v-if="workspacesMode" class="md-fab add-button" @click="addNewWorkspace()">
            <md-icon>add</md-icon>
            <span class="sr-only">New Worksurface</span>
            <md-tooltip md-direction="bottom">New Worksurface</md-tooltip>
          </md-button>
          <span v-show="vrDisplay" id="vr-button-container" class="vr-button-container"></span>

          <div v-if="!vrDisplay && filesMode" class="toolbar-layout">
            <mini-file v-for="file in recentFiles" :key="file.id" :selected="selectedRecentFile === file" :file="file" @click="selectRecentFile(file)"></mini-file>
          </div>
        </div>

        <md-card class="debug-card" v-if="debug">
            <md-card-content>
              <h4>Debug Info</h4>
              <h6>Workspaces</h6>
              <md-list class="debug-card-list" v-if="debugInfo !== null">
                <md-list-item v-for="workspace in debugInfo.workspaces" :key="workspace.id">
                  <div class="md-list-item-text" v-if="workspace.gridChecker">
                    <span>{{workspace.id}}</span>
                    <img v-for="(grid,index) in workspace.gridChecker.levels" :key="index" :src="grid._image" />
                  </div>

                </md-list-item>
              </md-list>
            </md-card-content>
            <md-card-actions>
              <md-button @click="updateDebugInfo()">Refresh</md-button>
            </md-card-actions>
          </md-card>
      </div>
  </div>
</template>
<script src="./GameView.ts"></script>
<style src="./GameView.css"></style>