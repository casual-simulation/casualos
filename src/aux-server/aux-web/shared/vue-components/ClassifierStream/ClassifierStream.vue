<template>
    <div>
        <classifier-loader v-if="loading"></classifier-loader>
        <video ref="video"></video>
    </div>
</template>
<script src="./ClassifierStream.ts"></script>
<style src="./ClassifierStream.css" scoped></style>
