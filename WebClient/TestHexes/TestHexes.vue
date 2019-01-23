<!-- App.vue -->
<template>
  <div ref="container" class="game-container">
    <div v-for="img in images" :key="img">
      <img :src="img">
    </div>
    <md-button @click="test()">Test</md-button>
    <input v-model="tileRatio" />
    <div class="game-canvas" ref="gameView"></div>
  </div>
</template>
<script src="./TestHexes.ts"></script>
<style src="./TestHexes.css"></style>