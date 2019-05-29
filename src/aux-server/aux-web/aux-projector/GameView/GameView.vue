<!-- App.vue -->
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
                <span
                    v-show="vrDisplay"
                    id="vr-button-container"
                    class="vr-button-container"
                ></span>

                <div ref="fileQueue">
                    <div v-if="!vrDisplay && filesMode && simulation3D" class="toolbar-layout">
                        <mini-file
                            v-for="(file, index) in simulation3D.recentFiles"
                            :key="index"
                            :file="file"
                            :selected="simulation3D.selectedRecentFile === file"
                            :large="index === 0"
                        ></mini-file>
                    </div>
                </div>
            </div>
            <trash-can v-if="showTrashCan" ref="trashCan"></trash-can>
            <div class="toolbar right">
                <camera-home :cameraRig="mainCameraRig"></camera-home>
                <camera-type :cameraRig="mainCameraRig"></camera-type>
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

        <md-dialog :md-active.sync="showDialog">
            <md-dialog-title>Set Workspace Context</md-dialog-title>

            <md-dialog-content>
                <md-field>
                    <md-input
                        ref="input"
                        v-model="contextDialog"
                        maxlength="40"
                        @keydown.enter.native="onConfirm"
                    />
                </md-field>

                <!--md-checkbox v-model="builderCheck">Make Builder Context</md-checkbox-->
                <md-checkbox v-model="playerCheck">Make available in player</md-checkbox>
            </md-dialog-content>

            <md-dialog-actions>
                <md-button class="md-primary" @click="onConfirmDialogCancel">Cancel</md-button>
                <md-button class="md-primary" @click="onConfirmDialogOk">Save</md-button>
            </md-dialog-actions>
        </md-dialog>
    </div>
</template>
<script src="./GameView.ts"></script>
<style src="./GameView.css"></style>
