<!-- App.vue -->
<template>
  <div>
    <div class="files-container">
      <h4>Files</h4>
      <file-table @tagFocusChanged="onTagFocusChanged($event)"></file-table>
    </div>
  </div>
</template>
<script src="./Editor.ts"></script>
<style src="./Editor.css"></style>