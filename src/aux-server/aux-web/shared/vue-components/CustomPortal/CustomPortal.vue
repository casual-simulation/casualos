<template>
    <iframe
        class="custom-portal"
        :src="iframeUrl"
        :title="portalId"
        @load="onLoad()"
        :style="extraStyle"
    ></iframe>
</template>
<script lang="ts" src="./CustomPortal.ts"></script>
<style src="./CustomPortal.css" scoped></style>
