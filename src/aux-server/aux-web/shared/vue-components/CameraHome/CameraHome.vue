<template>
    <div v-show="isVisible" class="camera-home">
        <md-button class="md-icon-button md-raised" @click="onClick()">
            <md-icon>center_focus_strong</md-icon>
            <!-- <md-tooltip md-delay="300" md-direction="left">Center Camera</md-tooltip> -->
        </md-button>
    </div>
</template>
<script src="./CameraHome.ts"></script>
<style src="./CameraHome.css"></style>
