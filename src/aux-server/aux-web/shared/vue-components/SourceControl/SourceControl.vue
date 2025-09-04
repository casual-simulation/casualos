<template>
    <default-panel
        v-if="currentPanel === 'default-panel'"
        @init-repo="initRepo"
        @clone-repo="cloneRepo"
    ></default-panel>
</template>
<script src="./SourceControl.ts"></script>
<style src="./SourceControl.css"></style>
