<template>
    <simple-editor v-if="!showDesktopEditor" :file="file" :tag="tag"></simple-editor>
    <monaco-editor v-else :file="file" :tag="tag"></monaco-editor>
</template>
<script src="./TagValueEditor.ts"></script>
<style src="./TagValueEditor.css" scoped></style>
