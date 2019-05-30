<template>
    <div ref="container" class="game-container">
        <div class="game-canvas" ref="gameView"></div>
        <slot></slot>
        <div class="ui-container">
            <div class="toolbar">
                <div>
                    <md-card v-if="!vrDisplay && menu.length > 0" class="menu-layout md-dense">
                        <md-list class="md-dense">
                            <md-list-item md-expand :md-expanded.sync="menuExpanded">
                                <md-icon>menu</md-icon>
                                <span class="md-list-item-text">Menu</span>
                                <md-badge class="md-primary" :md-content="menu.length" />
                                <md-content slot="md-expand" class="menu-items md-scrollbar">
                                    <md-list class="md-dense">
                                        <menu-file
                                            v-for="(item, index) in menu"
                                            :key="item.file.id"
                                            :item="item"
                                            :index="index"
                                        >
                                        </menu-file>
                                    </md-list>
                                </md-content>
                            </md-list-item>
                        </md-list>
                    </md-card>
                </div>
                <span
                    v-show="vrDisplay"
                    id="vr-button-container"
                    class="vr-button-container"
                ></span>
            </div>

            <!-- Inventory viewport -->
            <div
                v-if="inventoryViewport"
                class="viewport"
                :style="{
                    bottom: inventoryViewport.y + 'px',
                    left: inventoryViewport.x + 'px',
                    width: inventoryViewport.width + 'px',
                    height: inventoryViewport.height + 'px',
                }"
            >
                <div class="toolbar right">
                    <camera-home :showDistance="5" :cameraRig="inventoryCameraRig"></camera-home>
                </div>
            </div>

            <!-- Main viewport -->
            <div
                v-if="mainViewport"
                class="viewport"
                :style="{
                    bottom: inventoryViewport.height + 'px',
                    left: mainViewport.x + 'px',
                    width: mainViewport.width + 'px',
                    height: mainViewport.height - inventoryViewport.height + 'px',
                }"
            ></div>
        </div>
    </div>
</template>
<script src="./PlayerGameView.ts"></script>
<style src="./PlayerGameView.css"></style>
