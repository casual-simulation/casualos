<template>
    <div>
        <md-button @click="call">Call</md-button>
        <md-button @click="answer">Answer</md-button>
        <md-button @click="hangup">Hangup</md-button>

        <div class="video-background">
            <video ref="localVideo" class="video-element"></video>
            <video ref="remoteVideo" class="video-element"></video>
        </div>
    </div>
</template>
<script src="./MatrixTest.ts"></script>
<style src="./MatrixTest.css" scoped></style>
