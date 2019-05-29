<template>
    <div class="camera-type">
        <md-button class="md-icon-button md-raised" @click="toggle()">
            <div v-if="isPerspective">
                <md-icon>videocam</md-icon>
                <md-tooltip md-delay="300" md-direction="left"
                    >Enable Perspective Camera</md-tooltip
                >
            </div>
            <div v-else>
                <md-icon>videocam_off</md-icon>
                <md-tooltip md-delay="300" md-direction="left"
                    >Disable Perspective Camera</md-tooltip
                >
            </div>
        </md-button>
    </div>
</template>
<script src="./CameraType.ts"></script>
<style src="./CameraType.css"></style>
