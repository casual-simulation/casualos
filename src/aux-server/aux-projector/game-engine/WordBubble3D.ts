import { 
    Math as ThreeMath,
    Mesh, 
    Object3D, 
    DoubleSide,
    Color,
    TextureLoader,
    Texture,
    SceneUtils,
    Vector3,
    Box3,
    RawShaderMaterial,
    LinearFilter,
    ArrowHelper,
    Sphere,
    Ray,
    Vector2,
    Box2,
    Shape,
    MeshBasicMaterial,
    ShapeBufferGeometry,
    Box3Helper} from "three";

import { Object, Workspace } from 'aux-common/Files';
import GameView from "../GameView/GameView";
import { File3D } from "./File3D";
import { FileMesh } from "./FileMesh";
import { WorkspaceMesh } from "./WorkspaceMesh";
import { Box2Helper } from "./Box2Helper";

export class WordBubble3D extends Object3D {

    private _shapeGeometry: ShapeBufferGeometry;
    private _shapeMeshMaterial: MeshBasicMaterial;
    private _shapeMesh: Mesh;

    constructor() {
        super();
    }

    /**
     * Update the world bubble so that it encapsulates the provided Box2.
     * @param box The box to encapsulate inside the word bubble.
     */
    public encapsulate(box: Box2): void {

        // Create word bubble shape to make mesh out of.
        let shape = new Shape();

        // shape.moveTo(this.position.x, this.position.y);
        // shape.lin
        
        
        if (!this._shapeMesh) {
            // Create new mesh.
            this._shapeMeshMaterial = new MeshBasicMaterial({
                color: new Color(80, 80, 80)
            });

            this._shapeGeometry = new ShapeBufferGeometry(shape, 12);
            this._shapeMesh = new Mesh(this._shapeGeometry, this._shapeMeshMaterial);
            this.add(this._shapeMesh);
        } else {
            // Update existing mesh.
        }
    }

    private _createBoxHelper(box: Box2) {
        
    }
}