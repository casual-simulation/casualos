<!-- App.vue -->
<template>
  <div>
      <game-view class="game-view" @onContextMenu="handleContextMenu" :debug="debug">
        <div class="ui-container">
          <md-card class="info-card" v-if="isOpen && filesMode">
            <md-card-content>
              <div>
                <file-table ref="table" 
                  class="files-table" 
                  @closeWindow="toggleOpen()"
                  :files="files" 
                  :updateTime="updateTime"
                  :showAddTagButton="false"></file-table>

                <p class="no-files-message" v-if="!hasFiles">
                  Select a file
                </p>
              </div>
            </md-card-content>
          </md-card>
          <div  v-else-if="filesMode" class="outside-toggle">
            <file-table-toggle :files="files" @click="toggleOpen()"></file-table-toggle>
          </div>
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