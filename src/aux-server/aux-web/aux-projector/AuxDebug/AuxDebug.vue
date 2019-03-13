<!-- App.vue -->
<template>
    <div class="aux-debug">
        <md-button @click="download">
            <md-icon>cloud_download</md-icon>
            <span>Download AUX</span>
        </md-button>
        <md-button @click="upload">
            <md-icon>cloud_upload</md-icon>
            <span>Upload AUX</span>
        </md-button>
        <div class="json-content">
            <tree-view :data="auxJson" :options="{ limitRenderDepth: true, maxDepth: 2 }"></tree-view>
        </div>
    </div>
</template>
<script src="./AuxDebug.ts"></script>
<style src="./AuxDebug.css"></style>