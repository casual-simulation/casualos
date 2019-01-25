<!-- App.vue -->
<template>
  <div ref="container" class="test game-container">
    <div v-for="img in images" :key="img">
      <img :src="img">
    </div>
    <md-button @click="test()">Test</md-button>
    <md-button @click="toggleDots()">Toggle Dots</md-button>
    <input v-model="tileRatio" />
    <input v-model="size" />
    <div class="test game-canvas" ref="gameView"></div>
  </div>
</template>
<script src="./TestHexes.ts"></script>
<style src="./TestHexes.css"></style>