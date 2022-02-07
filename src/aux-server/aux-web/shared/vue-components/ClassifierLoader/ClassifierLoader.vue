<template>
    <div class="classifier-loading-wrapper">
        <h1>Loading image classifier...</h1>
        <md-progress-spinner
            md-mode="indeterminate"
            :md-diameter="20"
            :md-stroke="2"
        ></md-progress-spinner>
    </div>
</template>
<script src="./ClassifierLoader.ts"></script>
<style src="./ClassifierLoader.css" scoped></style>
