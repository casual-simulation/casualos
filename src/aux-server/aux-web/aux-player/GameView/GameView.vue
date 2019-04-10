<!-- App.vue -->
<template>
  <div ref="container" class="game-container">
    <div class="game-canvas" ref="gameView"></div>
    <slot></slot>
    <div class="ui-container">
        <div class="toolbar">
            <div ref="inventory">
                <div v-if="!vrDisplay && inventoryContext" class="inventory-layout">
                    <inventory-file v-for="(file, index) in inventoryContext.slots" :key="index" 
                        :file="file"
                        :slotIndex="index"
                        :context="inventoryContext.context"
                        :selected="file && inventoryContext.selectedFile === file"
                        @click="inventoryContext.selectFile(file)"></inventory-file>
                </div>
            </div>
            <div ref="menu">
                <div v-if="!vrDisplay && menuContext" class="menu-layout">
                    <menu-file v-for="(file, index) in menuContext.items" :key="file.id"
                        :file="file"
                        :index="index"
                        :context="menuContext.context"
                        @click="clickMenuItem(file)">
                    </menu-file>
                    <!-- <inventory-file v-for="(file, index) in menuContext.slots" :key="index" 
                        :file="file"
                        :slotIndex="index"
                        :context="menuContext.context"
                        :selected="file && menuContext.selectedFile === file"
                        @click="menuContext.selectFile(file)"></inventory-file> -->
                </div>
            </div>
            <span v-show="vrDisplay" id="vr-button-container" class="vr-button-container"></span>
        </div>
    </div>
  </div>
</template>
<script src="./GameView.ts"></script>
<style src="./GameView.css"></style>