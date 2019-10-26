<template>
    <simple-editor v-if="!showDesktopEditor" :bot="bot" :tag="tag"></simple-editor>
    <monaco-editor v-else :bot="bot" :tag="tag"></monaco-editor>
</template>
<script src="./TagValueEditor.ts"></script>
<style src="./TagValueEditor.css" scoped></style>
