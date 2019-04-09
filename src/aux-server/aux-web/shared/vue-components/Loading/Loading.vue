<!-- App.vue -->
<template>
    <div>
        <md-dialog v-if="loadingProgress"
                :md-fullscreen="false"
                :md-click-outside-to-close="false"
                :md-close-on-esc="false"
                :md-backdrop="true"
                :md-active.sync="loadingProgress.show">
            <div class="loading-dialog">
                <div class="loading-text-content">
                    <div class="loading-title">
                        <h1>Loading...</h1>
                        <md-progress-spinner md-mode="indeterminate" :md-diameter="20" :md-stroke="2"></md-progress-spinner>
                    </div>
                    <p>{{loadingProgress.status}}</p>
                </div>
                <md-progress-bar md-mode="determinate" :md-value="loadingProgress.progress" ></md-progress-bar>
            </div>
        </md-dialog>
    </div>
</template>
<script src="./Loading.ts"></script>
<style src="./Loading.css"></style>