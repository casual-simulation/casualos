<!-- App.vue -->
<template>
  <div class="mini-file" :class="{ 'active': selected }" @click="click()">
      <div class="mini-file-cube" :style="{ 'background-color': file.tags.color }">

      </div>
  </div>
  
</template>
<script src="./MiniFile.ts"></script>
<style src="./MiniFile.css"></style>