<template>
    <div class="source-control-editor-panel" ref="container">
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
</style>

<script src="./EditorPanel.ts"></script>
