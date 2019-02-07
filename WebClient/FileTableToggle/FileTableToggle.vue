<template>
  <md-badge class="file-table-toggle" :md-content="numFilesSelected" md-position="bottom">
    <md-button class="md-icon-button" @click="click()">
      <md-icon>edit</md-icon>
      <span class="sr-only">Open File Editor</span>
    </md-button>
  </md-badge>
</template>
<script src="./FileTableToggle.ts"></script>
<style src="./FileTableToggle.css"></style>