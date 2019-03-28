<!-- App.vue -->
<template>
  <div ref="container" class="game-container">
    <div class="game-canvas" ref="gameView"></div>
    <slot></slot>
    <div class="ui-container">
        <div class="toolbar">
          <span v-show="vrDisplay" id="vr-button-container" class="vr-button-container"></span>

          <div ref="inventory">
            <div v-if="!vrDisplay && inventoryContext" class="toolbar-layout">
              <inventory-file v-for="(file, index) in inventoryContext.slots" :key="index" 
                :file="file"
                :slotIndex="index"
                :context="inventoryContext.context"
                :selected="file && inventoryContext.selectedFile === file"
                @click="inventoryContext.selectFile(file)"></inventory-file>
            </div>
          </div>
        </div>
    </div>
  </div>
</template>
<script src="./GameView.ts"></script>
<style src="./GameView.css"></style>