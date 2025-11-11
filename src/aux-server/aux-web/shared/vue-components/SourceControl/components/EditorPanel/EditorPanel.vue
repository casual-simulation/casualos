<template>
    <div class="source-control-editor-panel" ref="container">
        <div class="source-control-editor-nav">
            <slot v-if="!reactiveStore.editorPanel.isInitialized">
                <md-button
                    :class="{
                        'md-raised md-primary':
                            reactiveStore.editorPanel.currentPanel == SccEditorPanel.Initialize,
                    }"
                    @click="reactiveStore.editorPanel.currentPanel = SccEditorPanel.Initialize"
                    ><md-icon>start</md-icon><span>Setup</span></md-button
                >
            </slot>
            <slot v-else>
                <md-button
                    :class="{
                        'md-raised md-primary':
                            reactiveStore.editorPanel.currentPanel == SccEditorPanel.GitActions,
                    }"
                    @click="reactiveStore.editorPanel.currentPanel = SccEditorPanel.GitActions"
                    ><md-icon>construction</md-icon><span>Actions</span></md-button
                >
                <md-button
                    :class="{
                        'md-raised md-primary':
                            reactiveStore.editorPanel.currentPanel == SccEditorPanel.Remotes,
                    }"
                    @click="reactiveStore.editorPanel.currentPanel = SccEditorPanel.Remotes"
                    ><md-icon>router</md-icon><span>Remote</span></md-button
                >
                <md-button
                    :class="{
                        'md-raised md-primary':
                            reactiveStore.editorPanel.currentPanel == SccEditorPanel.Settings,
                    }"
                    @click="reactiveStore.editorPanel.currentPanel = SccEditorPanel.Settings"
                    ><md-icon>manage_accounts</md-icon><span>Settings</span></md-button
                >
            </slot>
        </div>
        <editor-action-section
            :scc="scc"
            class="sc-container"
            :style="{ flex: topFlex }"
        ></editor-action-section>
        <div @mousedown="onDown" @touchstart.prevent="onDown" class="drag-spacer"></div>
        <output-logs
            class="sc-container-output"
            :style="{ flex: bottomFlex }"
            :scc="scc"
        ></output-logs>
    </div>
</template>

<style>
.drag-spacer {
    height: 8px;
    width: 100%;
    border-bottom: 1px solid #ccc;
    border-top: 1px solid #cccccc7c;
    border-radius: 4px;
    cursor: row-resize;
}

.source-control-editor-panel {
    padding: 0 5px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    height: 100%;
    width: 100%;
}

.source-control-editor-nav {
    display: flex;
    gap: 8px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    align-items: center;
    text-align: center;
    justify-items: center;
}

.source-control-editor-nav .md-button {
    flex: 1 1 0;
    margin: 8px 0;
    box-sizing: border-box;
    background-color: rgb(227, 227, 227) !important;
    color: rgb(110, 110, 110) !important;
}

.source-control-editor-nav .md-button div.md-button-content {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
}

.source-control-editor-nav .md-button div.md-button-content i {
    color: inherit !important;
}

.source-control-editor-nav .md-button span {
    margin-left: 6px;
}

.sc-container {
    flex: 5 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 16px;
    box-sizing: border-box;
}

.sc-container-output {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 16px;
    box-sizing: border-box;
}

.sc-content {
    height: 100%;
}

@media (prefers-color-scheme: dark) {
    .drag-spacer {
        border-bottom: 1px solid #333;
        border-top: 1px solid #2c2c2c7c;
    }
}
</style>

<script src="./EditorPanel.ts"></script>
