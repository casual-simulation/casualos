import {
	Box3,
	type Camera,
	Frustum,
	Matrix4,
	type Object3D,
	type OrthographicCamera,
	Vector3,
	type WebGLRenderer
} from 'three';
// import {} from './LODFrustum';
import type {MapView, MapPlaneNode, LODControl} from 'geo-three';
import { LODFrustum} from 'geo-three';
// import {} from '../nodes/MapPlaneNode';

const projection = new Matrix4();
const pov = new Vector3();
const frustum = new Frustum();
const position = new Vector3();
let simplified = false;

// https://docs.mapbox.com/help/glossary/zoom-level/#zoom-levels-and-geographical-distance
const zoomLevelPixelRatios = [
	78271.484, 39135.742, 19567.871, 9783.936, 4891.968, 2445.984, 1222.992,
	611.496, 305.748, 152.874, 76.437, 38.218, 19.109, 9.555, 4.777, 2.389, 1.194,
	0.597, 0.299, 0.149, 0.075, 0.037, 0.019
];

/**
 * LOD control based on the orthographic camera frustum.
 * 
 * This control is only applied to orthographic cameras.
 */
export class LODFrustumOrthographic implements LODControl
{
	public updateLOD(view: MapView, camera: Camera, renderer: WebGLRenderer, scene: Object3D): void 
	{
		const isOrthographic = (camera as OrthographicCamera).isOrthographicCamera;
		if (!isOrthographic) 
		{
			// super.updateLOD(view, camera, renderer, scene);
			return;
		}
		// get frustom from camera
        // projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        // frustum.setFromProjectionMatrix(projection);

        
		view.children[0].traverse((obj) => 
		{
            // if (simplified) {
            //     return;
            // }
            const node = obj as MapPlaneNode&Object3D;
            node.getWorldPosition(position);
            const nodeBox = new Box3().setFromObject(node);
            // position.project(camera);
            // const inFrustum = position.x > -1 && position.x < 1 && position.y > -1 && position.y < 1;
            // check if nodeBox is in the camera frustum
            // const inFrustum = frustum.intersectsBox(nodeBox);
            // if (inFrustum) {
                // console.log('in frustum', node.level, node.x, node.y);

                const upperLeft = new Vector3(nodeBox.min.x, nodeBox.max.y, 0);
                const upperRight = new Vector3(nodeBox.max.x, nodeBox.max.y, 0);
                const lowerLeft = new Vector3(nodeBox.min.x, nodeBox.min.y, 0);
                const lowerRight = new Vector3(nodeBox.max.x, nodeBox.min.y, 0);

                // project each corner of the bounding box to screen space
                upperLeft.project(camera);
                upperRight.project(camera);
                lowerLeft.project(camera);
                lowerRight.project(camera);

                // calculate the area of the projected bounding box
                const width = upperRight.distanceTo(upperLeft);
                const height = upperRight.distanceTo(lowerRight);
                const area = width * height;

                const viewportWidth = 2;
                const viewportHeight = 2;

                const viewportArea = viewportWidth * viewportHeight;
                
                const percentageCovered = area / viewportArea;

            

                // console.log(`Percentage of viewport covered: ${percentageCovered} ${node.level}`);
                // console.log(`Area of projected bounding box: ${area}`);
                // console.log(`Viewport area: ${viewportArea}`);

                if (percentageCovered > 0.05) {
                    node.subdivide();
                    // If the node is large enough in the viewport, we can consider it for LOD updates
                    // if (node.children.length <= 0) 
                    // {
                    //     // console.log('subdividing node:', node.level);
                    // }
                } else if (percentageCovered < 0.005) {
                    // simplified = true;
                    // console.log('simplifying node:', node.level, node.x, node.y, node.parentNode.level);
                    node.parentNode?.simplify();
                    // if (node.level > 0) {
                    // }
                    // console.log('simplifying node:', node.level);
                    // If the node is not large enough, we can simplify it
                    // node.parentNode?.simplify();
                }

                // const metresPerPixel = 1 / (camera as OrthographicCamera).zoom;
                // let closestZoomLevel = 0;
                // let minDifference = Number.POSITIVE_INFINITY;
                // for (let i = 0; i < zoomLevelPixelRatios.length; i++) 
                // {
                // 	const difference = Math.abs(zoomLevelPixelRatios[i] - metresPerPixel);
                // 	if (difference < minDifference) 
                // 	{
                // 		minDifference = difference;
                // 		closestZoomLevel = i;
                // 	}
                // }
                // if (node.level < closestZoomLevel) 
                // {
                // 	if (!(node.children.length > 0)) 
                // 	{
                // 		node.subdivide();
                // 	}
                // }
                // else if (node.level > closestZoomLevel) 
                // {
                // 	node.parentNode?.simplify();
                // }
            // } else {
            //     // console.log('not in frustum', node.level, node.x, node.y);
            // }
		});
	}
}