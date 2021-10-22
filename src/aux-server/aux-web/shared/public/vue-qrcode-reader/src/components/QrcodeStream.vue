<template>
  <div class="wrapper">
    <!--
    Note that the order of DOM elements matters.
    It defines the stacking order.
    The first element is at the very bottom, the last element is on top.
    This eliminates the need for `z-index`.
    -->
    <video
      ref="video"
      v-show="shouldScan"
      class="camera"
      autoplay
      muted
      playsinline
    ></video>

    <canvas ref="pauseFrame" v-show="!shouldScan" class="pause-frame"></canvas>

    <canvas ref="trackingLayer" class="tracking-layer"></canvas>

    <div class="overlay">
      <slot></slot>
    </div>
  </div>
</template>

<script src="./QrcodeStream.ts"></script>

<style lang="css" scoped>
.wrapper {
  position: relative;
  z-index: 0;
  width: 100%;
  height: 100%;
}

.overlay, .tracking-layer {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
}

.camera, .pause-frame {
  display: block;
  object-fit: cover;
  width: 100%;
  height: 100%;
}
</style>
