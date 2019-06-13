<template>
    <div ref="container" class="game-container">
        <div class="game-canvas" ref="gameView"></div>
        <slot></slot>
        <div class="ui-container">
            <div class="toolbar">
                <div>
                    <md-card v-if="game.vrDisplay && menu.length > 0" class="menu-layout md-dense">
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
                    v-show="game.vrDisplay"
                    id="vr-button-container"
                    class="vr-button-container"
                ></span>
            </div>

            <div class="slider-visible"></div>

            <div
                class="slider-hidden"
                @mousedown="game.mouseDownSlider()"
                @mouseup="game.mouseUpSlider()"
                @mousemove="game.mouseMoveSlider($event)"
                @touchstart="game.mouseDownSlider()"
                @touchend="game.mouseUpSlider()"
                @touchmove="game.touchMoveSlider($event)"
            ></div>

            <!-- Inventory viewport -->
            <div
                v-if="game.inventoryViewport"
                class="viewport"
                :style="{
                    bottom: game.inventoryViewport.y + 'px',
                    left: game.inventoryViewport.x + 'px',
                    width: game.inventoryViewport.width + 'px',
                    height: game.inventoryViewport.height + 'px',
                }"
            >
                <div class="toolbar right">
                    <camera-home
                        :showDistance="5"
                        :cameraRig="game.inventoryCameraRig"
                    ></camera-home>
                </div>
            </div>

            <!-- Main viewport -->
            <div
                v-if="game.mainViewport"
                class="viewport"
                :style="{
                    bottom: game.inventoryViewport.height + 'px',
                    left: game.mainViewport.x + 'px',
                    width: game.mainViewport.width + 'px',
                    height: game.mainViewport.height - game.inventoryViewport.height + 'px',
                }"
            ></div>
        </div>
    </div>
</template>
<script src="./PlayerGameView.ts"></script>
<style src="./PlayerGameView.css"></style>
