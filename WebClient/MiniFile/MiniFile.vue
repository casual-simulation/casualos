<!-- App.vue -->
<template>
  <div class="mini-file" :class="{ 'active': selected }" @click="click()">
      <div class="mini-file-cube" :style="{ 'background-color': file.tags.color }" :class="{ 'large': large }">

      </div>
  </div>
  
</template>
<script src="./MiniFile.ts"></script>
<style src="./MiniFile.css"></style>