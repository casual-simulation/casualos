![](https://cdn-images-1.medium.com/max/1600/1*u5EN9YE4S2R7QbJ-rHOZpg.gif)

# vue-quaggajs

[quaggajs](https://serratus.github.io/quaggaJS/) 's wrapper for Vue.js

# Installtion

## npm

``` bash
npm i vue-quaggajs
```

# Basic Example

```
<template>
  <div>
    <v-quagga :onDetected="logIt" :readerSize="readerSize" :readerTypes="['ean_reader']"></v-quagga>
  </div>
</template>

<script>
import Vue from 'vue'
import VueQuagga from 'vue-quaggajs';

// register component 'v-quagga'
Vue.use(VueQuagga);

export default {
  name: 'VueBarcodeTest',
  data () {
    return {
      readerSize: {
        width: 640,
        height: 480
      },
      detecteds: []
    }
  },
  methods: {
    logIt (data) {
      console.log('detected', data)
    }

  }
}
</script>
```


# Usage

### `onDetected` : function(result)

Reference: [Quagga.onDetected(callback)](https://github.com/serratus/quaggaJS#quaggaondetectedcallback)

default function:

```js
function (result) {
  console.log('detected: ', result);
}
```

### `onProcessed` : function(result)

Reference: [Quagga.onProcessed(callback)](https://github.com/serratus/quaggaJS#quaggaonprocessedcallback)

default function:

```js
function (result) {
  let drawingCtx = Quagga.canvas.ctx.overlay,
    drawingCanvas = Quagga.canvas.dom.overlay;

  if (result) {
    if (result.boxes) {
      drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
      result.boxes.filter(function (box) {
        return box !== result.box;
      }).forEach(function (box) {
        Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});
      });
    }
    if (result.box) {
      Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "#00F", lineWidth: 2});
    }

    if (result.codeResult && result.codeResult.code) {
      Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, {color: 'red', lineWidth: 3});
    }
  }
},
```

### readerTypes: String[]

Set reading barcode type.

Reference: [https://github.com/serratus/quaggaJS#decoder](https://github.com/serratus/quaggaJS#decoder)

default: `['code_128_reader']`

### readerSize: Object {width: Number, height: Number}

Set reader size. it affects <video> size.

default:

```js
{
  width: 640,
  height: 480,
}
```

### aspectRatio: Object {min: Number, max: Number}

Set aspect ratio. it affects <video> aspect ratio.

default:

```js
{
  min: 1,
  max: 2,
}
```