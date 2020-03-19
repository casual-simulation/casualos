<template>
    <div v-if="showUploadFiles" class="upload-files">
        <div class="upload-files-content">
            <md-icon class="icon-white md-size-4x">cloud_upload</md-icon>
            <p class="upload-files-text">Drop to upload</p>
        </div>
    </div>
</template>
<script src="./UploadFiles.ts"></script>
<style src="./UploadFiles.css" scoped></style>
