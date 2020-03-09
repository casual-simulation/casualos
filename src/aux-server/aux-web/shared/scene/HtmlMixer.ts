import {
    WebGLRenderer,
    Scene,
    Camera,
    Object3D,
    PerspectiveCamera,
    OrthographicCamera,
    Color,
    NoBlending,
    DoubleSide,
    MeshBasicMaterial,
    PlaneGeometry,
    Mesh,
    Vector3,
    Quaternion,
    Vector2,
} from 'three';
import {
    CSS3DRenderer,
    CSS3DObject,
} from 'three/examples/jsm/renderers/CSS3DRenderer';

/**
 * This is a port of the THREEx HtmlMixer (https://github.com/jeromeetienne/threex.htmlmixer) to a module friendly Typescript bot along with
 * some other modifications and additional features.
 */

export namespace HtmlMixer {
    /**
     * define a context for HtmlMixer
     *
     * @param  {THREE.WebGLRenderer|THREE.CanvasRenderer} rendererWebgl the renderer in front
     * @param  {THREE.Camera} camera the camera used for the last view
     */
    export class Context {
        rendererCss: any; // CSS3DRenderer
        rendererWebgl: WebGLRenderer;
        cssScene: Scene;

        private mainCamera: PerspectiveCamera | OrthographicCamera;
        private cssCamera: PerspectiveCamera | OrthographicCamera;

        constructor(
            rendererWebgl: WebGLRenderer,
            camera: PerspectiveCamera | OrthographicCamera
        ) {
            this.setupCssCamera(camera);

            this.rendererCss = new CSS3DRenderer();
            this.rendererWebgl = rendererWebgl;

            this.cssScene = new Scene();
        }

        update(): void {
            this.mainCamera.updateMatrixWorld(false);

            // Update css camera to match this current main camera transform and projection.
            let position = new Vector3();
            let scale = new Vector3();
            let quaternion = new Quaternion();
            this.mainCamera.matrixWorld.decompose(position, quaternion, scale);

            this.cssCamera.quaternion.copy(quaternion);
            this.cssCamera.position.copy(position);
            this.cssCamera.scale.copy(scale);

            // Copy some properties from main camera that are specifc to camera type.
            if (
                this.cssCamera instanceof PerspectiveCamera &&
                this.mainCamera instanceof PerspectiveCamera
            ) {
                this.cssCamera.fov = this.mainCamera.fov;
                this.cssCamera.aspect = this.mainCamera.aspect;
            } else if (
                this.cssCamera instanceof OrthographicCamera &&
                this.mainCamera instanceof OrthographicCamera
            ) {
                this.cssCamera.left = this.mainCamera.left;
                this.cssCamera.right = this.mainCamera.right;
                this.cssCamera.top = this.mainCamera.top;
                this.cssCamera.bottom = this.mainCamera.bottom;
                this.cssCamera.zoom = this.mainCamera.zoom;
            }

            let projection = this.mainCamera.projectionMatrix.clone();
            this.cssCamera.projectionMatrix = projection;

            this.cssCamera.updateProjectionMatrix();
            this.cssCamera.updateMatrixWorld(true);

            // Update mixer planes.
            this.cssScene.traverse(object3d => {
                let mixerPlane = object3d.userData.mixerPlane as Plane;
                if (!mixerPlane) return;
                mixerPlane.update();
            });

            // Render css scene.
            this.rendererCss.render(this.cssScene, this.cssCamera);
        }

        /**
         * Setup the css camera to mimic the provided main camera so that the css rendering lines up with the normal webgl rendering.
         * @param mainCamera The main camera being used to render the normal 3d scene.
         */
        setupCssCamera(mainCamera: PerspectiveCamera | OrthographicCamera) {
            this.mainCamera = mainCamera;

            if (this.mainCamera instanceof PerspectiveCamera) {
                this.cssCamera = new PerspectiveCamera(
                    this.mainCamera.fov,
                    this.mainCamera.aspect,
                    this.mainCamera.near,
                    this.mainCamera.far
                );
            } else {
                this.cssCamera = new OrthographicCamera(
                    this.mainCamera.left,
                    this.mainCamera.right,
                    this.mainCamera.top,
                    this.mainCamera.bottom,
                    this.mainCamera.near,
                    this.mainCamera.far
                );

                if (this.rendererCss) {
                    // FIX: Remove the auto-generated perspective css attribute from the context dom element.
                    // This will allow the orthographic camera to render the css scene correctly (without perspective correction).
                    this.rendererCss.domElement.style.perspective = 'unset';
                    this.rendererCss.domElement.style.WebkitPerspective =
                        'unset';
                }
            }
        }

        isOverAnyIFrameElement(clientPos: Vector2) {
            let children = this.cssScene.children;

            for (let i = 0; i < children.length; i++) {
                let mixerPlane = children[i].userData.mixerPlane as Plane;
                if (!mixerPlane) return;

                if (mixerPlane.domElement instanceof HTMLIFrameElement) {
                    if (mixerPlane.isOverDomElement(clientPos)) {
                        return true;
                    }
                }
            }
            return false;
        }
    }

    export class Plane {
        mixerContext: Context;
        domElement: HTMLElement;
        object3d: Object3D;
        cssObject: any; // CSS3DObject

        private elementW: number;
        private planeW: number;
        private planeH: number;

        constructor(
            mixerContext: Context,
            domElement: HTMLElement,
            opts?: PlaneOptions
        ) {
            opts = opts || {};
            this.elementW = opts.elementW !== undefined ? opts.elementW : 768;
            this.planeW = opts.planeW !== undefined ? opts.planeW : 1;
            this.planeH = opts.planeH !== undefined ? opts.planeH : 3 / 4;
            this.object3d = opts.object3d !== undefined ? opts.object3d : null;
            this.domElement = domElement;
            this.mixerContext = mixerContext;

            if (!this.object3d) {
                let planeMaterial = new MeshBasicMaterial({
                    opacity: 0,
                    color: new Color('black'),
                    blending: NoBlending,
                    side: DoubleSide,
                });
                let geometry = new PlaneGeometry(this.planeW, this.planeH);
                this.object3d = new Mesh(geometry, planeMaterial);
            }

            this.updateDomElementSize();

            // Create a css3dobject to display element.
            this.cssObject = new CSS3DObject(this.domElement);
            this.cssObject.scale
                .set(1, 1, 1)
                .multiplyScalar(1.0 / (this.elementW / this.planeW));

            // Hook cssObject to mixerPlane.
            this.cssObject.userData.mixerPlane = this;

            // Hook event so cssObject is attached to cssScene when object3d is added/removed
            this.object3d.addEventListener('added', event => {
                mixerContext.cssScene.add(this.cssObject);
            });
            this.object3d.addEventListener('removed', event => {
                mixerContext.cssScene.remove(this.cssObject);
            });
        }

        update(): void {
            // get world position
            this.object3d.updateMatrixWorld();

            // get position/quaternion/scale of object3d
            let position = new Vector3();
            let scale = new Vector3();
            let quaternion = new Quaternion();
            this.object3d.matrixWorld.decompose(position, quaternion, scale);

            // handle quaternion
            this.cssObject.quaternion.copy(quaternion);

            // handle position
            this.cssObject.position.copy(position);

            // handle scale
            let scaleFactor =
                this.elementW /
                ((<any>this.object3d).geometry.parameters.width * scale.x);
            this.cssObject.scale.set(1, 1, 1).multiplyScalar(1.0 / scaleFactor);
        }

        setDomElement(newDomElement: HTMLElement): void {
            console.log(
                '[HtmlMixer.Plane] setDomElement: newDomElement',
                newDomElement
            );
            // remove the oldDomElement
            var oldDomElement = this.domElement;
            if (oldDomElement.parentNode) {
                oldDomElement.parentNode.removeChild(oldDomElement);
            }
            // update local variables
            this.domElement = newDomElement;
            // update cssObject
            this.cssObject.element = this.domElement;
            // reset the size of the domElement
            this.updateDomElementSize();
        }

        isOverDomElement(clientPos: Vector2): boolean {
            let elements = document.elementsFromPoint(clientPos.x, clientPos.y);
            return elements.some(element => element === this.domElement);
        }

        dispose(): void {
            // Remove css object from css scene.
            if (this.cssObject) {
                this.mixerContext.cssScene.remove(this.cssObject);
            }

            // Remove dom element.
            if (this.domElement) {
                if (this.domElement.parentNode) {
                    this.domElement.parentNode.removeChild(this.domElement);
                }
            }
        }

        private updateDomElementSize(): void {
            // width of iframe in pixels
            let aspectRatio = this.planeH / this.planeW;
            let elementH = this.elementW * aspectRatio;

            this.domElement.style.width = this.elementW + 'px';
            this.domElement.style.height = elementH + 'px';
        }
    }

    export interface PlaneOptions {
        elementW?: number;
        planeW?: number;
        planeH?: number;
        object3d?: Object3D;
    }
}

export namespace HtmlMixerHelpers {
    /**
     * create domElement for a iframe to insert in a HtmlMixed.Plane
     *
     * @param  {String} url  the url for the iframe
     */
    export function createIframeDomElement(
        url: string
    ): HTMLIFrameElement | HTMLDivElement {
        // create the iframe element
        let domElement = document.createElement('iframe');
        domElement.src = url;
        domElement.style.border = 'none';
        domElement.style.maxWidth = 'unset';

        // IOS workaround for iframe
        let onIos =
            navigator.platform.match(/iP(hone|od|ad)/) !== null ? true : false;
        if (onIos) {
            // - see the following post for explaination on this workaround
            // - http://dev.magnolia-cms.com/blog/2012/05/strategies-for-the-iframe-on-the-ipad-problem/
            domElement.style.width = '100%';
            domElement.style.height = '100%';
            let container = document.createElement('div');
            container.appendChild(domElement);
            container.style.overflow = 'scroll';
            (<any>container).style.webkitOverflowScrolling = 'touch';
            return container;
        }
        return domElement;
    }

    /**
     * set the iframe.src in a mixerPlane.
     * - Usefull as it handle IOS specificite
     */
    export function setIframeSrc(
        mixerPlane: HtmlMixer.Plane,
        url: string
    ): void {
        // get the domElement
        let domElement: any = mixerPlane.domElement;
        // handle IOS special case
        let onIos =
            navigator.platform.match(/iP(hone|od|ad)/) !== null ? true : false;
        if (onIos) {
            domElement = mixerPlane.domElement.firstChild;
        }

        // actually set the iframe.src
        domElement.src = url;
    }

    /**
     * create domElement for a image to insert in a THREEx.HtmlmixedPlane
     *
     * @param  {String} url  the url for the iframe
     */
    export function createImageDomElement(url: string): HTMLImageElement {
        let domElement = document.createElement('img');
        domElement.src = url;
        return domElement;
    }
}
