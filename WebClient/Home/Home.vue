<!-- App.vue -->
<template>
  <div>
      <game-view class="game-view" @onContextMenu="handleContextMenu" :debug="debug">
        <div class="ui-container">
          <md-card class="info-card" v-if="isOpen && filesMode">
            <md-card-content>
              <div v-if="!isLoading">
                <h4 class="files-header">Selected Files</h4>
                <file-table class="files-table" :files="files" :updateTime="updateTime"></file-table>

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
          <md-badge v-else-if="filesMode" :md-content="numFilesSelected" md-position="bottom">
            <md-button class="md-icon-button" @click="open">
              <md-icon>edit</md-icon>
              <span class="sr-only">Open File Editor</span>
            </md-button>
          </md-badge>
        </div>
      </game-view>

      <div class="context-menu" :style="contextMenuStyle">
        <md-menu v-show="context" :md-active.sync="contextMenuVisible">
          <md-menu-content>
            <div v-if="context">
              <md-menu-item v-for="item of context.actions" v-bind:key="item.label" @click="item.onClick">
                {{item.label}}
              </md-menu-item>
            </div>
            <div v-else>
              <!-- render nothing you fools -->
            </div>
          </md-menu-content>
        </md-menu>
      </div>
  </div>
  
</template>
<script src="./Home.ts"></script>
<style src="./Home.css"></style>