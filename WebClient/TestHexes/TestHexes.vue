<!-- App.vue -->
<template>
  <div ref="container" class="game-container">
      <div class="game-canvas" ref="gameView"></div>
      <slot></slot>
  </div>
</template>
<script src="./TestHexes.ts"></script>
<style src="./TestHexes.css"></style>