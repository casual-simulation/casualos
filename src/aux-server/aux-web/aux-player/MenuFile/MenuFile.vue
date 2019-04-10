<!-- App.vue -->
<template>
  <div class="menu-file" :class="{ 'active': selected }" @click="click()">
      <div class="menu-file-text" v-show="label" :style="{ 'color': labelColor }">{{label}}</div>
  </div>
</template>
<script src="./MenuFile.ts"></script>
<style src="./MenuFile.css"></style>