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
import { LODFrustum } from 'geo-three';
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
 * LOD control with manual keyboard input for testing.
 * Key 'A' subdivides the current node
 * Key 'B' simplifies the current node's parent
 * Key 'N' cycles to the next sibling node
 * Key 'P' navigates to a parent node
 * Key 'C' navigates to the first child node
 */
export class LODFrustumOrthographic implements LODControl {
    // The currently selected node
    private selectedNode: MapPlaneNode | null = null;
    // Store a reference to the view
    private view: MapView | null = null;
    
    constructor() {
        // Add event listeners for keyboard input
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
    }
    
    /**
     * Handle keyup events for manual LOD control.
     */
    private handleKeyUp(event: KeyboardEvent): void {
        if (!this.view) {
            console.log('View not initialized');
            return;
        }
        
        if (!this.selectedNode && this.view.children[0]) {
            // Select the root node if no node is selected
            this.selectNode(this.view.children[0] as unknown as MapPlaneNode);
        }
        
        if (!this.selectedNode) {
            console.log('No node selected');
            return;
        }
        
        const currentNode = this.selectedNode;
        
        switch (event.key) {
            case 'a':
            case 'A':
                console.log('BEFORE - Selected node:', 
                    'level:', currentNode.level, 
                    'x:', currentNode.x, 
                    'y:', currentNode.y, 
                    'hasChildren:', currentNode.children.length > 0,
                    'node:', currentNode);
                
                try {
                    currentNode.subdivide();
                    console.log('Subdivision called');
                    
                    // Check if subdivision worked
                    console.log('AFTER - Selected node:', 
                        'level:', currentNode.level, 
                        'x:', currentNode.x, 
                        'y:', currentNode.y, 
                        'hasChildren:', currentNode.children.length > 0,
                        'children:', currentNode.children);
                    
                    // If we have children now, select the first child
                    if (currentNode.children.length > 0) {
                        this.selectNode(currentNode.children[0] as unknown as MapPlaneNode);
                    }
                } catch (error) {
                    console.error('Error during subdivision:', error);
                }
                break;
                
            case 'b':
            case 'B':
                if (currentNode.parentNode) {
                    console.log('BEFORE - Parent node:', 
                        'level:', currentNode.parentNode.level, 
                        'x:', currentNode.parentNode.x, 
                        'y:', currentNode.parentNode.y, 
                        'hasChildren:', currentNode.parentNode.children.length > 0);
                    
                    try {
                        currentNode.parentNode.simplify();
                        console.log('Simplification called');
                        
                        // Check if simplification worked and select the parent
                        this.selectNode(currentNode.parentNode);
                        
                        console.log('AFTER - Current node:', 
                            'level:', this.selectedNode.level, 
                            'x:', this.selectedNode.x, 
                            'y:', this.selectedNode.y, 
                            'hasChildren:', this.selectedNode.children.length > 0);
                    } catch (error) {
                        console.error('Error during simplification:', error);
                    }
                } else {
                    console.log('Selected node has no parent');
                }
                break;
                
            case 'n':
            case 'N':
                // Cycle to next sibling
                if (currentNode.parentNode && currentNode.parentNode.children.length > 1) {
                    const siblings = currentNode.parentNode.children;
                    const currentIndex = siblings.indexOf(currentNode as unknown as Object3D);
                    const nextIndex = (currentIndex + 1) % siblings.length;
                    this.selectNode(siblings[nextIndex] as unknown as MapPlaneNode);
                    console.log('Selected next sibling node');
                } else {
                    console.log('No siblings available');
                }
                break;
                
            case 'p':
            case 'P':
                // Navigate to parent
                if (currentNode.parentNode) {
                    this.selectNode(currentNode.parentNode);
                    console.log('Selected parent node');
                } else {
                    console.log('No parent available');
                }
                break;
                
            case 'c':
            case 'C':
                // Navigate to first child
                if (currentNode.children.length > 0) {
                    this.selectNode(currentNode.children[0] as unknown as MapPlaneNode);
                    console.log('Selected first child node');
                } else {
                    console.log('No children available');
                }
                break;
        }
    }
    
    /**
     * Select a node
     */
    private selectNode(node: MapPlaneNode): void {
        // Set new selection
        this.selectedNode = node;
        
        console.log('Selected node:', 
            'level:', node.level, 
            'x:', node.x, 
            'y:', node.y, 
            'hasChildren:', node.children.length > 0);
    }
    
    public updateLOD(view: MapView, camera: Camera, renderer: WebGLRenderer, scene: Object3D): void {
        // Store a reference to the view
        this.view = view;
        
        // Select the root node if no node is selected
        if (!this.selectedNode && view.children[0]) {
            this.selectNode(view.children[0] as unknown as MapPlaneNode);
        }
        
        // Debug information for the current frame
        if (this.selectedNode) {
            // Only log occasionally to avoid console spam
            if (Math.random() < 0.01) {
                console.log('Current state:', 
                    'level:', this.selectedNode.level, 
                    'x:', this.selectedNode.x, 
                    'y:', this.selectedNode.y, 
                    'hasChildren:', this.selectedNode.children.length > 0);
            }
        }
    }
}


/**
 * LOD control based on the orthographic camera frustum.
 * 
 * This control is only applied to orthographic cameras.
 */
// export class LODFrustumOrthographic extends LODFrustum
// {
//     private readonly subdivideThreshold = 0.05;
//     private readonly simplifyThreshold = 0.005;
//     private readonly useZoomLevelStrategy = true;
//     private readonly useViewportCoverageStrategy = true;

// 	public updateLOD(view: MapView, camera: Camera, renderer: WebGLRenderer, scene: Object3D): void 
// 	{
// 		const isOrthographic = (camera as OrthographicCamera).isOrthographicCamera;
// 		if (!isOrthographic) 
// 		{
// 			super.updateLOD(view, camera, renderer, scene);
// 			return;
// 		}
// 		// get frustom from camera
//         projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
//         frustum.setFromProjectionMatrix(projection);
//         camera.getWorldPosition(pov);

//         const metresPerPixel = 1 / (camera as OrthographicCamera).zoom;
//         let closestZoomLevel = 0;
//         let minDiff = Infinity;

//         if (this.useZoomLevelStrategy){
//             for (let i = 0; i < zoomLevelPixelRatios.length; i++){
//                 const diff = Math.abs(zoomLevelPixelRatios[i] - metresPerPixel);
//                 if(diff < minDiff){
//                     minDiff = diff;
//                     closestZoomLevel = i;
//                 }
//             }
//         }
        
// 		view.children[0].traverse((obj) => 
// 		{
//             const node = obj as MapPlaneNode&Object3D;
//             node.getWorldPosition(position);
//             const nodeBox = new Box3().setFromObject(node);
//             // position.project(camera);
//             // const inFrustum = position.x > -1 && position.x < 1 && position.y > -1 && position.y < 1;
//             // check if nodeBox is in the camera frustum
//             // const inFrustum = frustum.intersectsBox(nodeBox);
//             // if (inFrustum) {
//                 // console.log('in frustum', node.level, node.x, node.y);
//             if(!frustum.intersectsBox(nodeBox)){
//                 return;
//             }

//             let shouldSubdivide = false;
//             let shouldSimplify = false;

//             if(this.useZoomLevelStrategy){
//                 if(node.level < closestZoomLevel){
//                     shouldSubdivide = true;
//                 } else if (node.level > closestZoomLevel){
//                     shouldSimplify = true;
//                 }
//             }

//             if (this.useViewportCoverageStrategy){
//                 const upperLeft = new Vector3(nodeBox.min.x, nodeBox.max.y, 0);
//                 const upperRight = new Vector3(nodeBox.max.x, nodeBox.max.y, 0);
//                 const lowerLeft = new Vector3(nodeBox.min.x, nodeBox.min.y, 0);
//                 const lowerRight = new Vector3(nodeBox.max.x, nodeBox.min.y, 0);

//                 // project each corner of the bounding box to screen space
//                 upperLeft.project(camera);
//                 upperRight.project(camera);
//                 lowerLeft.project(camera);
//                 lowerRight.project(camera);

//                 // calculate the area of the projected bounding box
//                 const width = upperRight.distanceTo(upperLeft);
//                 const height = upperRight.distanceTo(lowerRight);
//                 const area = width * height;

//                 const viewportWidth = 2;
//                 const viewportHeight = 2;

//                 const viewportArea = viewportWidth * viewportHeight;                
//                 const percentageCovered = area / viewportArea;

//                 console.log(`Percentage of viewport covered: ${percentageCovered} ${node.level}`);
//                 console.log(`Area of projected bounding box: ${area}`);
//                 console.log(`Viewport area: ${viewportArea}`);

//                 if (percentageCovered > this.subdivideThreshold) {
//                     shouldSubdivide = true;
//                 } else if (percentageCovered < this.simplifyThreshold) {
//                     shouldSimplify = true;
//                     console.log('simplifying node:', node.level, node.x, node.y, node.parentNode.level);
//                     // If the node is not large enough, we can simplify it
//                     // node.parentNode?.simplify();
//                 }

//             }

//             if (shouldSubdivide && node.children.length === 0){
//                 node.subdivide();
//             } else if (shouldSimplify && node.parentNode){
//                 node.parentNode.simplify();
//             }
//                 // const metresPerPixel = 1 / (camera as OrthographicCamera).zoom;
//                 // let closestZoomLevel = 0;
//                 // let minDifference = Number.POSITIVE_INFINITY;
//                 // for (let i = 0; i < zoomLevelPixelRatios.length; i++) 
//                 // {
//                 // 	const difference = Math.abs(zoomLevelPixelRatios[i] - metresPerPixel);
//                 // 	if (difference < minDifference) 
//                 // 	{
//                 // 		minDifference = difference;
//                 // 		closestZoomLevel = i;
//                 // 	}
//                 // }
//                 // if (node.level < closestZoomLevel) 
//                 // {
//                 // 	if (!(node.children.length > 0)) 
//                 // 	{
//                 // 		node.subdivide();
//                 // 	}
//                 // }
//                 // else if (node.level > closestZoomLevel) 
//                 // {
//                 // 	node.parentNode?.simplify();
//                 // }
//             // } else {
//             //     // console.log('not in frustum', node.level, node.x, node.y);
//             // }
// 		});
// 	}
// }