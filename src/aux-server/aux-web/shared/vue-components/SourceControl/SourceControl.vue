<template>
    <default-panel
        v-if="currentPanel === 'default-panel'"
        @create-repo="$emit('create-repo')"
        @open-repo="$emit('open-repo')"
    ></default-panel>
</template>
<script src="./SourceControl.ts"></script>
<style src="./SourceControl.css"></style>
