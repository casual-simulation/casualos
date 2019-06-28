<template>
    <div
        ref="container"
        class="game-container"
        @dragenter="onDragEnter"
        @dragleave="onDragLeave"
        @drop="onDrop"
        @dragover="onDragOver"
    >
        <div class="game-canvas" ref="gameView"></div>
        <slot></slot>
        <div class="ui-container">
            <div v-if="showUploadFiles" class="upload-files">
                <div class="upload-files-content">
                    <md-icon class="icon-white md-size-4x">cloud_upload</md-icon>
                    <p class="upload-files-text">Drop to upload</p>
                </div>
            </div>

            <div></div>

            <div class="toolbar">
                <!--md-button
                    v-if="workspacesMode"
                    class="md-fab add-button"
                    @click="addNewWorkspace()"
                >
                    <md-icon>add</md-icon>
                    <span class="sr-only">New Worksurface</span>
                    <md-tooltip md-direction="bottom">New Worksurface</md-tooltip>
                </md-button-->
            </div>
            <trash-can v-if="showTrashCan" ref="trashCan"></trash-can>
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
