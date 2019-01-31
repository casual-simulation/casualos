<!-- App.vue -->
<template>
  <div ref="container" class="game-container">
      <div class="game-canvas" ref="gameView"></div>
      <slot></slot>
      <div class="ui-container">
        <md-speed-dial class="toolbar">
          <md-speed-dial-target>
            <md-icon>add</md-icon>
          </md-speed-dial-target>
          <md-speed-dial-content>
            <md-button class="md-icon-button" @click="addNewFile">
              <cube-icon class="toolbar-button-icon" />
              <span class="sr-only">New File</span>
              <md-tooltip md-direction="right">New File</md-tooltip>
            </md-button>
            <md-button class="md-icon-button" @click="addNewWorkspace()">
              <hex-icon class="toolbar-button-icon" />
              <span class="sr-only">New Worksurface</span>
              <md-tooltip md-direction="right">New Worksurface</md-tooltip>
            </md-button>
            <md-button class="md-icon-button" @click="toggleDebug()" v-if="dev">
              <md-icon>bug_report</md-icon>
              <span class="sr-only">Debug</span>
              <md-tooltip md-direction="right">Debug</md-tooltip>
            </md-button>
          </md-speed-dial-content>
        </md-speed-dial>

        <!-- <div class="toolbar">
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
            <div class="divider" v-if="dev"></div>
            
          </div>
        </div> -->
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