<!-- App.vue -->
<template>
  <div>
      <game-view class="game-view" @onContextMenu="handleContextMenu">
        <div class="ui-container">
          <md-card class="info-card" v-if="isOpen">
            <md-card-content>
              <div v-if="!isLoading">
                <h4 class="files-header">Files</h4>
                <file-table></file-table>

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

      <div class="context-menu" :style="{ left: contextMenuPosX, top: contextMenuPosY }">
        <md-menu v-if="context" :md-active.sync="contextMenuVisible">
          <md-menu-content>
            <md-menu-item v-for="item of context.actions" v-bind:key="item.label" @click="item.onClick">
              {{item.label}}
            </md-menu-item>
          </md-menu-content>
        </md-menu>
      </div>
  </div>
  
</template>
<script src="./Home.ts"></script>
<style src="./Home.css"></style>