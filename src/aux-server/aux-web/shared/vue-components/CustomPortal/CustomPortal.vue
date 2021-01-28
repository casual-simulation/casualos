<template>
    <div class="custom-portal-wrapper" :style="iframeStyle">
        <iframe
            ref="iframe"
            class="custom-portal"
            :src="iframeUrl"
            :title="portalId"
            @load="onLoad()"
        ></iframe>
    </div>
</template>
<script lang="ts" src="./CustomPortal.ts"></script>
<style src="./CustomPortal.css" scoped></style>
