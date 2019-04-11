<!-- App.vue -->
<template>
  <div ref="container" class="game-container">
    <div class="game-canvas" ref="gameView"></div>
    <slot></slot>
    <div class="ui-container">
        <div class="toolbar">
            <div>
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
                <md-card v-if="!vrDisplay && menuContext && menuContext.items.length > 0" class="menu-layout md-dense">
                    <md-list class="md-dense">
                        <md-list-item md-expand :md-expanded.sync="menuExpanded">
                            <md-icon>menu</md-icon>
                            <span class="md-list-item-text">Menu</span>
                            <md-badge class="md-primary" :md-content="menuContext.items.length" />
                            <md-content slot="md-expand" class="menu-items md-scrollbar">
                                <md-list class="md-dense">
                                    <menu-file v-for="(file, index) in menuContext.items" :key="file.id"
                                        :file="file"
                                        :index="index"
                                        :context="menuContext.context"
                                        @click="clickMenuItem(file)">
                                    </menu-file>
                                </md-list>
                            </md-content>
                        </md-list-item>
                    </md-list>
                </md-card>
            </div>
            <span v-show="vrDisplay" id="vr-button-container" class="vr-button-container"></span>
        </div>
    </div>
  </div>
</template>
<script src="./GameView.ts"></script>
<style src="./GameView.css"></style>