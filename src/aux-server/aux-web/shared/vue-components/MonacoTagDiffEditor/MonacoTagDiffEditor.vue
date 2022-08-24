<template>
    <div class="editor-wrapper">
        <div class="editor-breadcrumbs" :class="{ 'show-resize': showResize }">
            <div class="editor-tag">
                <bot-tag
                    :tag="originalTag"
                    :prefix="originalTagPrefix"
                    :allowCloning="false"
                ></bot-tag>
                <div v-if="!!originalTagSpace" class="bot-space">
                    {{ originalTagSpace }}
                </div>
                <div v-if="originalTag !== modifiedTag">
                    ->
                    <bot-tag
                        :tag="modifiedTag"
                        :prefix="modifiedTagPrefix"
                        :allowCloning="false"
                    ></bot-tag>
                    <div v-if="!!modifiedTagSpace" class="bot-space">
                        {{ modifiedTagSpace }}
                    </div>
                </div>
            </div>
            <div class="editor-spacing"></div>
        </div>
        <div class="code-editor-wrapper">
            <monaco-diff-editor
                ref="editor"
                @focusOriginal="originalEditorFocused"
                @blurOriginal="originalEditorBlured"
                @focusModified="modifiedEditorFocused"
                @blurModified="modifiedEditorBlured"
                @editorMounted="onEditorMounted"
                @modelChanged="onModelChanged"
            ></monaco-diff-editor>
        </div>
        <div class="editor-info">
            <span class="value-indicator">Original</span>
            <div class="spacing"></div>
            <span class="value-indicator">Modified</span>
        </div>
    </div>
</template>
<script src="./MonacoTagDiffEditor.ts"></script>
<style src="./MonacoTagDiffEditor.css" scoped></style>
<style src="../MonacoTagEditor/MonacoTagEditorUnscoped.css"></style>
