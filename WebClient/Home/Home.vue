<!-- App.vue -->
<template>
  <div>
      <game-view class="game-view" @onContextMenu="handleContextMenu" :debug="debug">
        <div class="ui-container">
          <md-card class="info-card" v-if="isOpen && filesMode">
            <md-card-content>
              <div>
                <div class="top-part md-layout">
                  <div class="md-layout-item">
                    <md-badge :md-content="numFilesSelected" md-position="bottom">
                      <md-button class="md-icon-button" @click="toggleOpen">
                        <md-icon>edit</md-icon>
                        <span class="sr-only">Open File Editor</span>
                      </md-button>
                    </md-badge>
                  </div>
                  <div class="md-layout-item info-card-actions">
                    <md-button
                      class="new-tag-button"
                      v-if="!isMakingNewTag()"
                      @click="addTag()">+tag</md-button>
                    <md-button
                      class="md-icon-button new-tag-button"
                      v-if="isMakingNewTag()"
                      @click="addTag()">
                      <md-icon>check</md-icon>
                    </md-button>
                    <md-button
                      class="md-icon-button new-tag-button"
                      v-if="isMakingNewTag()"
                      @click="cancelTag()">
                      <md-icon>cancel</md-icon>
                    </md-button>
                  </div>
                </div>
                <file-table ref="table" 
                  class="files-table" 
                  :files="files" 
                  :updateTime="updateTime"
                  :showAddTagButton="false"></file-table>

                <p v-if="!hasFiles">
                  Select a file
                </p>
              </div>
            </md-card-content>
          </md-card>
          <md-badge v-else-if="filesMode" class="outside-toggle-button" :md-content="numFilesSelected" md-position="bottom">
            <md-button class="md-icon-button" @click="toggleOpen">
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