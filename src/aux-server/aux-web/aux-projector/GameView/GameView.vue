<!-- App.vue -->
<template>
    <div ref="container" class="game-container">
        <div class="game-canvas" ref="gameView"></div>
        <slot></slot>
        <div class="ui-container">
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
                            @click="simulation3D.selectRecentFile(file)"
                        ></mini-file>
                    </div>
                </div>
            </div>
            <div class="toolbar right">
                <trash-can v-if="showTrashCan" ref="trashCan"></trash-can>
            </div>
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
