<template>
    <div class="editor-wrapper">
        <div class="editor-breadcrumbs">
            <bot-tag
                :tag="tag"
                :isScript="isScript"
                :isFormula="isFormula"
                :allowCloning="false"
            ></bot-tag>
            <md-button
                v-show="isScript"
                class="editor-play-button md-icon-button md-dense"
                @click="runScript()"
            >
                <md-icon class="editor-play-button-icon">play_arrow</md-icon>
                <md-tooltip md-direction="top">Run Script</md-tooltip>
            </md-button>
        </div>
        <div class="code-editor-wrapper">
            <monaco-editor ref="editor" @focus="editorFocused" @blur="editorBlured"></monaco-editor>
        </div>
    </div>
</template>
<script src="./MonacoTagEditor.ts"></script>
<style src="./MonacoTagEditor.css" scoped></style>
