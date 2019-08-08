<template>
    <div>
        <md-dialog
            :md-fullscreen="false"
            :md-click-outside-to-close="false"
            :md-close-on-esc="false"
            :md-backdrop="true"
            :md-active="show"
        >
            <div v-if="!hasError" class="loading-dialog">
                <div class="loading-text-content">
                    <div class="loading-title">
                        <h1>Loading...</h1>
                        <md-progress-spinner
                            md-mode="indeterminate"
                            :md-diameter="20"
                            :md-stroke="2"
                        ></md-progress-spinner>
                    </div>
                    <p>{{ status }}</p>
                </div>
                <md-progress-bar md-mode="determinate" :md-value="progress"></md-progress-bar>
                <tagline></tagline>
            </div>
            <div v-else class="loading-error">
                <div class="loading-text-content error-text-content">
                    <h1>An error has occured.</h1>
                    <p>{{ error }}</p>
                </div>
                <md-button @click="onErrorDismiss">Dismiss</md-button>
            </div>
        </md-dialog>
    </div>
</template>
<script src="./Loading.ts"></script>
<style src="./Loading.css" scoped></style>
