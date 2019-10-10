# three-buffer-vertex-data

[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

[(demo)](http://jam3.github.io/three-buffer-vertex-data/) - [(source)](./demo/index.js)

Convenience functions for sending vertex data to an attribtue of a [THREE.BufferGeometry](http://threejs.org/docs/#Reference/Core/BufferGeometry).

This will flatten vertex data if necessary, attempt to re-use arrays where possible to minimize GC, and handle some compatibility issues across different versions of ThreeJS. It can handle dynamically growing and shrinking buffers.

The input is expected in simple arrays, and can be one of:

- a nested array like `[ [ x, y ], [ x, y ] ]`
- a flat array like `[ x, y, z, x, y, z ]`
- a typed array like `new Float32Array([ x, y ])`

This is particularly useful in new versions of ThreeJS, where BufferGeometry is required for custom shader attributes.

## Install

```sh
npm install three-buffer-vertex-data --save
```

## Example

A simple example using [snowden](https://github.com/stackgl/snowden).

```js
var buffer = require('three-buffer-vertex-data')

// grab a simplicial complex
var snowden = require('snowden')

// set up our geometry
var geometry = new THREE.BufferGeometry()
buffer.index(geometry, snowden.cells)
buffer.attr(geometry, 'position', snowden.positions)

// add to scene
var material = new THREE.MeshBasicMaterial()
var mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)
```

The `'position'`, `'uv'` and `'normal'` attributes are built-in to ThreeJS and will work with common materials. Result:

<img src="http://i.imgur.com/LdHk4xB.png" width="50%" />

See [demo](./demo/index.js) for a more complex example, which cycles various [mesh primitives](https://github.com/glo-js/mesh-primitives) into the same vertex buffers.

## Usage

[![NPM](https://nodei.co/npm/three-buffer-vertex-data.png)](https://www.npmjs.com/package/three-buffer-vertex-data)

The `data` passed is sent through [flatten-vertex-data](https://github.com/glo-js/flatten-vertex-data), and can be in the form of:

- a nested array like `[ [ x, y ], [ x, y ] ]`
- a flat array like `[ x, y, z, x, y, z ]`
- a typed array like `new Float32Array([ x, y ])`

If the attribute exists, its underlying `array` will try to be re-used. Otherwise, a new typed array will be created from the optional [dtype](https://www.npmjs.com/package/dtype).

#### `buffer.index(geometry, data, [itemSize], [dtype])`

Sets the `index` attribute for the given buffer `geometry`, with your list of indices in `data`. The `itemSize` defaults to 1, and `dtype` string defaults to `'uint16'`

#### `buffer.attr(geometry, key, data, [itemSize], [dtype])`

Sets a generic attribute on the given buffer `geometry` by the given `key` and vertex `data`. The `itemSize` defaults to 3, and `dtype` string defaults to `'float32'`.

## Gotchas

In r73, ThreeJS breaks when using `wireframe` and attempting to dynamically grow/shrink and add/remove attributes.

Also, ThreeJS typically expects indices and `positions` to exist. Things may break without these attributes set. 

You will need THREE r82 or newer if you wish to dynamically grow and shrink vertex buffers.

## License

MIT, see [LICENSE.md](http://github.com/Jam3/three-buffer-vertex-data/blob/master/LICENSE.md) for details.
