<template>
    <md-dialog
        :md-active.sync="showPhotoCamera"
        md-theme="default"
        class="photo-camera-dialog"
        @md-closed="onPhotoCameraClosed()"
    >
        <div class="photo-camera-container" v-if="showPhotoCamera">
            <div v-show="hasPhoto">
                <img ref="preview" />
            </div>
            <div v-show="!hasPhoto">
                <camera-stream
                    ref="camera"
                    :cameraType="cameraType"
                    @streaming="onCameraStreamLoaded"
                    @streamingError="onCameraStreamError"
                    @stopped="onCameraStreamStopped"
                ></camera-stream>
            </div>
        </div>
        <div class="photo-controls-container">
            <div v-if="hasPhoto" class="has-photo-controls">
                <md-button class="md-icon-button md-primary" @click="clearPhoto()">
                    <md-icon>delete</md-icon>
                </md-button>
                <md-button class="md-icon-button md-primary save-button" @click="savePhoto()">
                    <md-icon class="md-size-2x">done</md-icon>
                </md-button>
            </div>
            <div v-else class="take-photo-controls">
                <md-button class="md-icon-button md-primary" @click="hidePhotoCamera()">
                    <md-icon>close</md-icon>
                </md-button>
                <md-button
                    v-if="!processing"
                    class="md-icon-button md-primary capture-button"
                    @click="takePhoto()"
                >
                    <md-icon class="md-size-2x">camera</md-icon>
                </md-button>
                <md-progress-spinner
                    v-else
                    class="processing-spinner"
                    md-mode="indeterminate"
                    :md-diameter="48"
                    :md-stroke="2"
                ></md-progress-spinner>
            </div>
        </div>
        <canvas ref="canvas"></canvas>
    </md-dialog>
</template>
<script src="./PhotoCamera.ts"></script>
<style src="./PhotoCamera.css" scoped></style>
<style src="./PhotoCameraGlobals.css"></style>
