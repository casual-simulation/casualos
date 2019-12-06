<template>
    <div ref="container" class="game-container">
        <div class="game-canvas" ref="gameView"></div>
        <slot></slot>
        <div class="ui-container">
            <div v-if="showUploadFiles" class="upload-bots">
                <div class="upload-bots-content">
                    <md-icon class="icon-white md-size-4x">cloud_upload</md-icon>
                    <p class="upload-bots-text">Drop to upload</p>
                </div>
            </div>

            <div></div>

            <div class="toolbar"></div>
            <div class="toolbar right">
                <camera-home
                    @onCenterCamera="centerCamera"
                    :isVisible="showCameraHome"
                ></camera-home>
            </div>
            <div v-shortkey.once="['ctrl', 'c']" @shortkey="copySelectionNormal"></div>

            <!-- BUG: -->
            <!-- The Meta key (Command key) only works for onkeydown events. -->
            <!-- Vue-shortkey normally only sends events on keyup, but this is a way -->
            <!-- to trick it. -->
            <div v-shortkey.push="['meta', 'c']" @shortkey="copySelectionMac"></div>
            <div v-shortkey.once="['ctrl', 'v']" @shortkey="pasteClipboardNormal"></div>
            <div v-shortkey.push="['meta', 'v']" @shortkey="pasteClipboardMac"></div>
        </div>
    </div>
</template>
<script src="./BuilderGameView.ts"></script>
<style src="./BuilderGameView.css"></style>
