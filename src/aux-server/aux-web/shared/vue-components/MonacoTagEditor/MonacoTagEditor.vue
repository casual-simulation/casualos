<template>
    <div class="editor-wrapper">
        <div class="editor-breadcrumbs">
            <file-tag :tag="tag"></file-tag>
        </div>
        <div class="code-editor-wrapper">
            <monaco-editor ref="editor" @focus="editorFocused" @blur="editorBlured"></monaco-editor>
        </div>
    </div>
</template>
<script src="./MonacoTagEditor.ts"></script>
<style src="./MonacoTagEditor.css" scoped></style>
