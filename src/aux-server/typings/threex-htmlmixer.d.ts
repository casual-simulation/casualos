declare module 'threex-htmlmixer' {
    import {
        WebGLRenderer,
        Scene,
        Camera,
        Object3D,
        PerspectiveCamera,
        Mesh,
    } from 'three';

    namespace HtmlMixer {
        class Context {
            cssFactor: number;
            rendererCss: any; // CSS3DRenderer
            rendererWebgl: WebGLRenderer;
            cssScene: Scene;
            autoUpdateObjects: boolean;

            constructor(
                rendererWebgl: WebGLRenderer,
                scene: Scene,
                camera: Camera
            );
            update(): void;
        }

        class Plane {
            domElement: HTMLElement;
            object3d: Object3D;
            cssObject: any; // CSS3DObject

            constructor(
                mixerContext: Context,
                domElement: HTMLElement,
                opts?: PlaneOptions
            );
            update(): void;
            setDomElement(newDomElement: HTMLElement): void;
        }

        interface PlaneOptions {
            elementW?: number;
            planeW?: number;
            planeH?: number;
            object3d?: Object3D;
        }
    }
}
