import {
    Object3D,
    PerspectiveCamera,
    OrthographicCamera,
} from '@casual-simulation/three';
import { Viewport } from '../scene/Viewport';

export interface DraggableGroup {
    /**
     * The objects that are draggable.
     */
    objects: Object3D[];

    /**
     * The camera to raycast through.
     */
    camera: PerspectiveCamera | OrthographicCamera;

    /**
     * The optional viewport to use to transform the input to.
     */
    viewport: Viewport;
}
