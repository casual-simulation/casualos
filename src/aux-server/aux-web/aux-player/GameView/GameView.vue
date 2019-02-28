<!-- App.vue -->
<template>
  <div ref="container" class="game-container">
    <div class="game-canvas" ref="gameView"></div>
    <slot></slot>
    <div class="ui-container">
      <span v-show="vrDisplay" id="vr-button-container" class="vr-button-container"></span>
    </div>
  </div>
</template>
<script src="./GameView.ts"></script>
<style src="./GameView.css"></style>