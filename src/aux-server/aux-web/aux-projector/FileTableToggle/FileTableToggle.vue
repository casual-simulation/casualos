<template>
    <md-badge
        v-if="showNumFiles"
        class="bot-table-toggle"
        :md-content="numFilesSelected"
        md-position="bottom"
    >
        <md-button class="md-icon-button" :class="{ 'md-raised': raised }" @click="click()">
            <md-icon>edit</md-icon>
            <span class="sr-only">Open Bot Editor</span>
        </md-button>
    </md-badge>
    <md-button v-else class="md-icon-button" :class="{ 'md-raised': raised }" @click="click()">
        <md-icon>edit</md-icon>
        <span class="sr-only">Open Bot Editor</span>
    </md-button>
</template>
<script src="./FileTableToggle.ts"></script>
<style src="./FileTableToggle.css"></style>
