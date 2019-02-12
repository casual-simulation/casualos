<!-- App.vue -->
<template>
  <div class="mini-file" :class="{ 'active': selected }" @click="click()">
      <div class="mini-file-cube" :class="{ 'large': large }">
        <div class="mini-file-text" v-show="label" :style="{ 'color': labelColor }">{{label}}</div>
        <img class="mini-file-img" :src="image" draggable="false" />
      </div>
  </div>
  
</template>
<script src="./MiniFile.ts"></script>
<style src="./MiniFile.css"></style>