<template>
    <md-dialog :md-active.sync="isOpen" class="bot-upload-dialog">
        <md-dialog-title>Upload Files</md-dialog-title>
        <div class="bot-upload-container">
            <bot-pond allow-multiple="false" @addfile="fileAdded" @removefile="fileRemoved" />
        </div>
        <md-dialog-actions>
            <md-button @click="cancelFileUpload">Close</md-button>
            <md-button class="md-primary" @click="uploadFiles" :disabled="uploadedFiles.length <= 0"
                >Upload</md-button
            >
        </md-dialog-actions>
    </md-dialog>
</template>
<script src="./UploadStoryModal.ts"></script>
<style src="./UploadStoryModal.css" scoped></style>
