<template>
    <div class="loading-wrapper">
        <h1>Loading...</h1>
        <md-progress-spinner
            md-mode="indeterminate"
            :md-diameter="20"
            :md-stroke="2"
        ></md-progress-spinner>
    </div>
</template>
<script src="./LoadingWidget.ts"></script>
<style src="./LoadingWidget.css" scoped></style>
