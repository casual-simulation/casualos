<template>
    <div class="custom-portal-wrapper" :style="iframeStyle">
        <iframe
            allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads"
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
