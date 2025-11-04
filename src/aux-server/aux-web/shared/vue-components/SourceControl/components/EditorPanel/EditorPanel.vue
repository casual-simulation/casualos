<template>
    <div class="source-control-editor-panel">
        <div class="sc-container">
            <h2>Source Control Editor Panel</h2>
            <div class="sc-content" v-if="!selectedBot">
                <!-- <search-bot-library
                    :searchBotsBySystemOrId="searchBotsBySystemOrId"
                ></search-bot-library> -->
            </div>
        </div>
        <div class="sc-container-output">
            <h3>Output Section</h3>
        </div>
    </div>
</template>

<style>
.source-control-editor-panel {
    padding: 0 5px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    height: 100%;
    width: 100%;
}

.sc-container {
    flex-grow: 5;
    padding: 16px;
    box-sizing: border-box;
    border-bottom: 1px solid #ccc;
    display: flex;
    flex-direction: column;
}

.sc-content {
    height: 100%;
}

.sc-container-output {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    padding: 16px;
    box-sizing: border-box;
    overflow: hidden;
}
</style>

<script src="./EditorPanel.ts"></script>
