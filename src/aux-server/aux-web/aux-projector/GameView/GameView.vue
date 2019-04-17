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

          <div ref="fileQueue">
            <div v-if="!vrDisplay && filesMode" class="toolbar-layout">
              <mini-file v-for="(file, index) in recentFiles" :key="index" 
                :file="file" 
                :selected="selectedRecentFile === file" 
                :large="index === 0"
                @click="selectRecentFile(file)"></mini-file>
            </div>
          </div>
        </div>
        <div class="toolbar right">
            <trash-can v-if="showTrashCan" ref="trashCan"></trash-can>
        </div>
      </div>

    <md-dialog-prompt
            :md-active.sync="showDialog"
            v-model="contextDialog"
            md-title="Set Workspace Context"
            md-confirm-text="Save"
            md-cancel-text="Cancel"
            @md-cancel="onConfirmDialogCancel"
            @md-confirm="onConfirmDialogOk" />
            />


  </div>
</template>
<script src="./GameView.ts"></script>
<style src="./GameView.css"></style>