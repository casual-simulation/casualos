<template>
    <div class="editor-loading-wrapper">
        <h1>Loading code editor...</h1>
        <md-progress-spinner
            md-mode="indeterminate"
            :md-diameter="20"
            :md-stroke="2"
        ></md-progress-spinner>
    </div>
</template>
<script src="./MonacoLoader.ts"></script>
<style src="./MonacoLoader.css" scoped></style>
