import {
    WebGLRenderer,
    OrthographicCamera,
    Scene,
    Box3,
    Vector3,
    Math as ThreeMath,
    Color,
    Object3D,
    AmbientLight,
    DirectionalLight,
} from 'three';
import {
    merge,
    BotCalculationContext,
    Bot,
} from '@casual-simulation/aux-common';
import { AuxBot3D } from './AuxBot3D';
import { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';
import { baseAuxAmbientLight, baseAuxDirectionalLight } from './SceneUtils';

/**
 * Defines a class that can render a bot to a transparent canvas.
 */
export class BotRenderer {
    tileRatio = 0.2;
    private _resolution = 128;
    private _renderer: WebGLRenderer;
    private _camera: OrthographicCamera;

    private _directional: DirectionalLight;
    private _ambient: AmbientLight;

    private _scene: Scene;
    private _bounds: Box3;
    private _center: Vector3 = new Vector3();
    private _size: Vector3 = new Vector3();
    private _worldPosition: Vector3;
    private _group: Object3D;
    private _bot: AuxBot3D;
    private _xImbalance: number;
    private _yImbalance: number;

    constructor() {
        this._scene = new Scene();
        this._camera = new OrthographicCamera(-1, 1, 1, -1, 1, 1);
        this._renderer = new WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true,
            antialias: false,
        });
        this._renderer.setClearColor(new Color(), 0);
        // this._renderer.setPixelRatio(window.devicePixelRatio || 1);

        this._scene.add(this._camera);

        // Ambient light.
        this._ambient = baseAuxAmbientLight();
        this._scene.add(this._ambient);

        // Directional light.
        this._directional = baseAuxDirectionalLight();
        this._scene.add(this._directional);

        this._group = new Object3D();
        this._bot = new AuxBot3D(
            null,
            null,
            null,
            [],
            new AuxBot3DDecoratorFactory(null)
        );

        this._group.add(this._bot);
        this._scene.add(this._group);
    }

    async render(
        bot: Bot,
        calc: BotCalculationContext,
        diffball: boolean = false
    ): Promise<string> {
        bot = merge(
            bot,
            diffball
                ? {
                      tags: {
                          ['auxForm']: 'sphere',
                      },
                      values: {
                          ['auxForm']: 'sphere',
                      },
                  }
                : {}
        );

        this._bot.bot = bot;
        this._bot.botUpdated(bot, new Set(), calc);

        this._updateBounds();
        this._updateCamera();
        this._updateRenderer();
        return this._renderBot();
    }

    private _renderBot() {
        this._updateScene();

        this._render();

        const gl = this._renderer.context;
        const size = {
            width: gl.drawingBufferWidth,
            height: gl.drawingBufferHeight,
        };
        const data = new Uint8Array(size.width * size.height * 4);
        gl.readPixels(
            0,
            0,
            size.width,
            size.height,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            data
        );

        const image = this._renderer.domElement.toDataURL();

        this._teardownScene();

        return image;
    }

    private _teardownScene() {}

    private _updateScene() {
        this._group.position.copy(this._worldPosition);

        this._camera.position.set(
            this._worldPosition.x + 1,
            this._worldPosition.y + 1,
            this._worldPosition.z + 1
        );
        this._camera.updateMatrixWorld(true);
    }

    private _updateBounds() {
        this._worldPosition = new Vector3();
        this._bounds = new Box3().setFromObject(this._bot);
        this._bot.getWorldPosition(this._worldPosition);
    }

    private _updateCamera() {
        this._center = new Vector3();
        this._size = new Vector3();
        this._bounds.getCenter(this._center);
        this._bounds.getSize(this._size);

        const minX = this._bounds.min.x;
        const maxX = this._bounds.max.x;
        const minZ = this._bounds.min.z;
        const maxZ = this._bounds.max.z;

        const left = minX - this._worldPosition.x;
        const right = maxX - this._worldPosition.x;
        const top = maxZ - this._worldPosition.z;
        const bottom = minZ - this._worldPosition.z;
        this._xImbalance = Math.abs(Math.abs(left) - Math.abs(right));
        this._yImbalance = Math.abs(Math.abs(bottom) - Math.abs(top));

        const max = Math.max(this._size.x, this._size.z, this._size.y) * 2;

        this._size.add(new Vector3(this._xImbalance, 0, this._yImbalance));
        this._size.multiplyScalar(2);

        this._camera.rotation.set(
            ThreeMath.degToRad(-28),
            ThreeMath.degToRad(45),
            0,
            'YXZ'
        );

        this._camera.left = -(max / 2);
        this._camera.right = max / 2;
        this._camera.top = max / 2;
        this._camera.bottom = -(max / 2);

        this._camera.near = -100;
        this._camera.far = 1000;

        this._camera.updateMatrixWorld(false);
        this._camera.updateProjectionMatrix();
    }

    private _updateRenderer() {
        this._renderer.setSize(this._resolution, this._resolution);
    }

    private _render() {
        this._renderer.render(this._scene, this._camera);
    }
}

let renderer: BotRenderer = null;

/**
 * Gets the singleton instance of the bot renderer.
 */
export function getRenderer(): BotRenderer {
    if (!renderer) {
        renderer = new BotRenderer();
    }
    return renderer;
}
