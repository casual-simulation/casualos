import * as THREE from 'three';
import {Camera, Clock} from 'three';
import Vue, {ComponentOptions} from 'vue';
import Component from 'vue-class-component';

import {appManager} from '../AppManager';

@Component
export default class GameView extends Vue {
  private _scene: THREE.Scene;
  private _camera: THREE.Camera;
  private _renderer: THREE.Renderer;
  private _clock: THREE.Clock;

  private _sun: THREE.Light;
  private _ambient: THREE.Light;

  private _cube: THREE.Mesh;

  private _frames: number;

  async mounted() {
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x00bfff);
    this._camera = new THREE.PerspectiveCamera(
        60, window.innerWidth / window.innerHeight, 0.1, 1000);

    this._renderer = new THREE.WebGLRenderer({});
    this._renderer.setSize(window.innerWidth, window.innerHeight);

    this._clock = new Clock();

    const gameView: Element = <Element>this.$refs.gameView;
    gameView.appendChild(this._renderer.domElement);

    this._setupScene();

    this._clock.start();
    this._frames = 0;
    this._renderGame();
  }

  private _setupScene() {
    this._ambient = new THREE.AmbientLight(0xffffff, 0.1);
    this._scene.add(this._ambient);

    this._sun = new THREE.DirectionalLight(0xffffff, 0.7);
    this._sun.position.set(1, 1, -0.2);
    this._sun.castShadow = true;
    this._scene.add(this._sun);

    var geometry = new THREE.BoxGeometry(1, 1, 1);
    var material = new THREE.MeshStandardMaterial(
        {color: 0x00ff00, metalness: 0, roughness: 0.6});
    this._cube = new THREE.Mesh(geometry, material);
    this._scene.add(this._cube);

    this._camera.position.z = 5;
  }

  private _renderGame() {
    this._frames += 1;
    requestAnimationFrame(() => this._renderGame());

    const deltaTime = this._clock.getDelta();

    this._updateGame(deltaTime);

    this._renderer.render(this._scene, this._camera);
  }

  private _updateGame(deltaTime: number) {
    this._animateCube(deltaTime);
  }

  private _animateCube(deltaTime: number) {
    this._cube.rotation.x += 1 * deltaTime;
    this._cube.rotation.y += 1 * deltaTime;
  }

  private _fps(): number {
    const seconds = this._clock.getElapsedTime();
    return this._frames / seconds;
  }
};