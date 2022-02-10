<template>
    <simple-editor v-if="!showDesktopEditor" :bot="bot" :tag="tag"></simple-editor>
    <monaco-editor
        v-else
        :bot="bot"
        :tag="tag"
        :space="space"
        :showResize="showResize"
        ref="monacoEditor"
        @onFocused="onFocused"
        @modelChanged="onModelChanged"
    ></monaco-editor>
</template>
<script src="./TagValueEditor.ts"></script>
<style src="./TagValueEditor.css" scoped></style>
