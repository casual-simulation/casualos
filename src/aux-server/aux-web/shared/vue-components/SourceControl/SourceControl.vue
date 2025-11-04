<template>
    <default-panel
        v-if="currentPanel === 'default-panel'"
        @init-repo="initRepo"
        @clone-repo="cloneRepo"
        @load-repo="loadRepo"
        @select-bot="selectBot"
        :botId="botId"
        :botSystem="botSystem"
    ></default-panel>
</template>
<script src="./SourceControl.ts"></script>
<style src="./SourceControl.css"></style>
