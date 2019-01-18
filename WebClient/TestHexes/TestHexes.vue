<!-- App.vue -->
<template>
  <div ref="container" class="game-container">
      <img v-if="imageURL" :src="imageURL">
      <md-button @click="test()">Test</md-button>
      <div class="game-canvas" ref="gameView"></div>
  </div>
</template>
<script src="./TestHexes.ts"></script>
<style src="./TestHexes.css"></style>