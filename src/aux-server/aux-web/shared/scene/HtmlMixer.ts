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
} from 'three';
import * as THREE from 'three';

// Need this include so that the CSS3DRenderer.js gets loaded for its side effects (being included in the THREE namespace).
// CSS3DREnderer is required by the THREEx.HtmlMixer
require('three/examples/js/renderers/CSS3DRenderer');

//
// This is a port of the THREEx HtmlMixer (https://github.com/jeromeetienne/threex.htmlmixer) to a module friendly Typescript file.
//

export namespace HtmlMixer {
    /**
     * define a context for HtmlMixer
     *
     * @param  {THREE.WebGLRenderer|THREE.CanvasRenderer} rendererWebgl the renderer in front
     * @param  {THREE.Camera} camera the camera used for the last view
     */
    export class Context {
        cssFactor: number;
        rendererCss: any; // CSS3DRenderer
        rendererWebgl: WebGLRenderer;
        cssScene: Scene;

        private camera: Camera;
        private cssCamera: Camera;

        constructor(rendererWebgl: WebGLRenderer, camera: Camera) {
            this.camera = camera;

            // build cssFactor to workaround bug due to no display
            this.cssFactor = 1000;

            this.rendererCss = new (<any>THREE).CSS3DRenderer();
            this.rendererWebgl = rendererWebgl;

            if (camera instanceof PerspectiveCamera) {
                this.cssCamera = new PerspectiveCamera(
                    camera.fov,
                    camera.aspect,
                    camera.near * this.cssFactor,
                    camera.far * this.cssFactor
                );
            } else {
                this.cssCamera = new PerspectiveCamera(
                    60,
                    1.0,
                    this.cssFactor,
                    this.cssFactor
                );
            }

            this.cssScene = new Scene();
        }

        update(): void {
            this.cssCamera.quaternion.copy(this.camera.quaternion);

            this.cssCamera.position
                .copy(this.camera.position)
                .multiplyScalar(this.cssFactor);

            // Update mixer planes.
            this.cssScene.traverse(object3d => {
                let mixerPlane = object3d.userData.mixerPlane;
                if (!mixerPlane) return;
                mixerPlane.update();
            });

            // Render css scene.
            this.rendererCss.render(this.cssScene, this.cssCamera);
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
            opts = opts = {};
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

            this.setDomElementSize();

            // Create a css3dobject to display element.
            this.cssObject = new (<any>THREE).CSS3DObject(this.domElement);
            this.cssObject.scale
                .set(1, 1, 1)
                .multiplyScalar(
                    mixerContext.cssFactor / (this.elementW / this.planeW)
                );

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
            this.cssObject.position
                .copy(position)
                .multiplyScalar(this.mixerContext.cssFactor);

            // handle scale
            let scaleFactor =
                this.elementW /
                ((<any>this.object3d).geometry.parameters.width * scale.x);
            this.cssObject.scale
                .set(1, 1, 1)
                .multiplyScalar(this.mixerContext.cssFactor / scaleFactor);
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
            this.setDomElementSize();
        }

        private setDomElementSize(): void {
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
        // sanity check
        console.assert(mixerPlane instanceof HtmlMixer.Plane);
        // get the domElement
        let domElement: any = mixerPlane.domElement;
        // handle IOS special case
        let onIos =
            navigator.platform.match(/iP(hone|od|ad)/) !== null ? true : false;
        if (onIos) {
            domElement = mixerPlane.domElement.firstChild;
        }

        // sanity check
        console.assert(domElement instanceof HTMLIFrameElement);

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
