<template>
    <md-dialog
        :md-active.sync="showImageClassifier"
        class="image-classifier-dialog"
        @md-closed="onImageClassifierClosed()"
    >
        <div class="image-classifier-container">
            <div v-if="showImageClassifier">
                <!-- <h3>Scan a Barcode</h3> -->
                <classifier-stream
                    @modelLoaded="onModelLoaded"
                    @modelLoadError="onModelLoadError"
                    @classified="onImageClassified"
                    :modelJson="modelJsonUrl"
                    :modelMetadata="modelMetadataUrl"
                    :camera="cameraType"
                ></classifier-stream>
            </div>
        </div>
        <md-dialog-actions>
            <md-button class="md-primary" @click="hideImageClassifier()">Close</md-button>
        </md-dialog-actions>
    </md-dialog>
</template>
<script src="./ImageClassifier.ts"></script>
<style src="./ImageClassifier.css" scoped></style>
