import { 
  Scene,
  Camera, 
  Renderer, 
  Clock, 
  Mesh, 
  Light,
  Color,
  PerspectiveCamera,
  WebGLRenderer,
  AmbientLight,
  DirectionalLight,
  BoxGeometry,
  MeshStandardMaterial,
} from 'three';
import Vue, {ComponentOptions} from 'vue';
import Component from 'vue-class-component';

import {appManager} from '../AppManager';

@Component
export default class GameView extends Vue {
  private _scene: Scene;
  private _camera: Camera;
  private _renderer: Renderer;
  private _clock: Clock;

  private _sun: Light;
  private _ambient: Light;

  private _cube: Mesh;

  private _frames: number;

  async mounted() {
    this._scene = new Scene();
    this._scene.background = new Color(0x00bfff);
    this._camera = new PerspectiveCamera(
        60, window.innerWidth / window.innerHeight, 0.1, 1000);

    this._renderer = new WebGLRenderer({});
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
    this._ambient = new AmbientLight(0xffffff, 0.1);
    this._scene.add(this._ambient);

    this._sun = new DirectionalLight(0xffffff, 0.7);
    this._sun.position.set(1, 1, -0.2);
    this._sun.castShadow = true;
    this._scene.add(this._sun);

    var geometry = new BoxGeometry(1, 1, 1);
    var material = new MeshStandardMaterial(
        {color: 0x00ff00, metalness: 0, roughness: 0.6});
    this._cube = new Mesh(geometry, material);
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