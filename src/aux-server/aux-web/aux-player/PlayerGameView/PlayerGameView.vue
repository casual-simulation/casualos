<template>
    <div ref="container" class="game-container">
        <div class="game-canvas" :style="{ cursor: cursor }" ref="gameView"></div>
        <slot></slot>
        <div class="ui-container">
            <div ref="menuElement" class="toolbar menu" :style="finalMenuStyle">
                <div>
                    <md-list class="md-dense">
                        <menu-bot
                            v-for="(item, index) in menu"
                            :key="item.bot.id"
                            :item="item"
                            :index="index"
                        >
                        </menu-bot>
                    </md-list>
                </div>
            </div>

            <div class="slider-hiddenLeft" @touchmove="moveTouch($event)"></div>

            <div class="slider-hiddenRight" @touchmove="moveTouch($event)"></div>

            <!-- Mini viewport -->
            <div v-if="hasMiniViewport" class="viewport" :style="miniViewportStyle">
                <div class="toolbar right">
                    <camera-home
                        @onCenterCamera="centerMiniCamera"
                        :isVisible="showMiniPortalCameraHome"
                    ></camera-home>
                </div>
            </div>

            <!-- Main viewport -->
            <div v-if="hasMainViewport" class="viewport" :style="mainViewportStyle"></div>

            <circle-wipe></circle-wipe>
        </div>
    </div>
</template>
<script src="./PlayerGameView.ts"></script>
<style src="./PlayerGameView.css"></style>
