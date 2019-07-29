<template>
    <div ref="container" class="game-container">
        <div class="game-canvas" ref="gameView"></div>
        <slot></slot>
        <div class="ui-container">
            <div class="toolbar">
                <div>
                    <md-card v-if="menu.length > 0" class="menu-layout md-dense">
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
            </div>

            <div class="slider-visible" @touchmove="moveTouch($event)"></div>
            <div class="side-visible"></div>
            <div class="sideRight-visible"></div>

            <div
                class="slider-hidden"
                @mousedown="mouseDownSlider()"
                @mouseup="mouseUpSlider()"
                @touchstart="mouseDownSlider()"
                @touchend="mouseUpSlider()"
                @touchmove="moveTouch($event)"
            ></div>

            <!-- Inventory viewport -->
            <div v-if="hasInventoryViewport" class="viewport" :style="inventoryViewportStyle">
                <div class="toolbar right">
                    <camera-home
                        @onCenterCamera="centerInventoryCamera"
                        :isVisible="showInventoryCameraHome"
                    ></camera-home>
                </div>
            </div>

            <!-- Main viewport -->
            <div v-if="hasMainViewport" class="viewport" :style="mainViewportStyle"></div>
        </div>
    </div>
</template>
<script src="./PlayerGameView.ts"></script>
<style src="./PlayerGameView.css"></style>
