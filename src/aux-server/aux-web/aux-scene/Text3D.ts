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
    Euler,
    Sphere,
    Matrix4,
    Quaternion,
    Box3Helper,
    AxesHelper,
    LineBasicMaterial,
    Layers} from "three";

import createBMFont, { TextGeometry, TextGeometryOptions } from "three-bmfont-text";
import GameView from "../aux-projector/GameView/GameView";
import { setLayer } from "./utils";

var sdfShader = require('three-bmfont-text/shaders/sdf');

export class Text3D {

    public static Debug_BoundingBox: boolean = false;

    // Map of loaded font textures.
    public static FontTextures: {
        [texturePath: string]: Texture
    } = {};

    public static readonly defaultWidth: number = 200;
    public static readonly extraSpacing: number = .12;
    public static readonly defaultScale: number = 0.004;

    /**
     * The distance that should be used when the text sizing mode === 'auto'.
     */
    public static readonly virtualDistance: number = 3;

    // The text geometry created with 'three-bmfont-text'
    // To change text, run textGeometry.update and include the proper options.
    private _geometry: TextGeometry;

    // The text mesh that is holding onto the text geometry that gets rendered by three.
    private _mesh: Mesh;

    // The 3d scene object that is the parent/anchor of the textMesh.
    private _anchor: Object3D;

    // the text that was last set on this text3d.
    private _unprocessedText: string;

    // The bounding box for the text 3d.
    private _boundingBox: Box3;

    private _gameView: GameView;
    private _bboxHelper: Box3Helper;

    /**
     * the text that was last set on this text3d.
     */
    get unprocessedText(): string { return this._unprocessedText; }

    /**
     * The bounding box of this text 3d. This bounding box is in world space.
     */
    get boundingBox(): Box3 { return (this._boundingBox && this._anchor.visible) ? this._boundingBox.clone() : new Box3(); }

    /**
     * The Three JS Layers object for this Text 3D.
     */
    get layers(): Layers { return this._anchor.layers; }

    /**
     * Create text 3d.
     * @param parent the object3d the text will be parented to. This can be the scene or another object3d.
     * @param fontData  the bmfont data in json format
     * @param fontTexturePath the path to the texture atlas for the font.
     */
    constructor(gameView: GameView, parent: Object3D, fontData: string, fontTexturePath: string) {

        this._gameView = gameView;

        if (!Text3D.FontTextures[fontTexturePath]) {
            // Load font texture and store it for other 3d texts to use.
            Text3D.FontTextures[fontTexturePath] = new TextureLoader().load(fontTexturePath);
        }

        var texture = Text3D.FontTextures[fontTexturePath];
        
        // Modify filtering of texture for optimal SDF rendering.
        // This effectively disables the use of any mip maps, allowing the SDF shader to continue
        // to draw the text when view from a long distance. Otherwise, the SDF shader tends to 'fizzle' 
        // out when the text is viewed from long distances.
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;

        this._geometry = createBMFont({ font: fontData, text: "", flipY: true, align: "center", width: Text3D.defaultWidth });
        
        var material = new RawShaderMaterial(sdfShader({
            map: texture,
            side: DoubleSide,
            transparent: true,
            // depthTest: false,
            // depthWrite: false,
            color: new Color(0, 0, 0)
        }));

        this._mesh = new Mesh(this._geometry, material);
        this._anchor = new Object3D();
        this._anchor.add(this._mesh);
        this.setScale(Text3D.defaultScale);

        // Rotate the text mesh so that it is upright when rendered.
        this._mesh.rotateX(ThreeMath.degToRad(180));

        // Add the label anchor as aa child of the file mesh.
        parent.add(this._anchor);
        // this._gameView.scene.add(this._anchor);
        this.updateBoundingBox();
    }

    /**
     * Sets the position of the text based on the size of the given object's bounding box.
     */
    public setPositionForObject(obj: Object3D) {

        let objBounds = new Box3().setFromObject(obj);
        if (objBounds.isEmpty())
            return;

        this._mesh.position.set(0, 0, 0);

        let myMinLocal = this._mesh.worldToLocal(this._boundingBox.min.clone());
        let myMaxLocal = this._mesh.worldToLocal(this._boundingBox.max.clone());

        let myBottomCenterLocal = new Vector3(
            ((myMaxLocal.x - myMinLocal.x) / 2) + myMinLocal.x,
            myMinLocal.y,
            ((myMaxLocal.z - myMinLocal.z) / 2) + myMinLocal.z
        );

        // let posOffset = this._mesh.position.clone().sub(myBottomCenterLocal);
        let posOffset = this._mesh.position.clone().sub(myBottomCenterLocal);
        // Invert the y offset, we are rotated 180 degrees around the x-axis which makes the y upside down.
        posOffset.y = -posOffset.y; 

        // Position the mesh some distance above the given object's bounding box.
        let objSize = new Vector3();
        objBounds.getSize(objSize);

        let paddingScalar = this._anchor.scale.x / Text3D.defaultScale;
        
        objSize.add(new Vector3(0, Text3D.extraSpacing * paddingScalar, 0));
        objSize.divide(this._anchor.scale);
        this._mesh.position.set(0, objSize.y, 0);
        this._mesh.position.add(posOffset);

        this.updateBoundingBox();
    }

    /**
     * Gets the position of the text in world space.
     */
    public getWorldPosition(): Vector3 {
        let pos = new Vector3();
        this._anchor.getWorldPosition(pos);
        return pos;
    }

    /**
     * Update the bounding box for this text 3d.
     * This is normally run automatically after updating attributes of the text 3d.
     */
    public updateBoundingBox(): void {
        this._anchor.updateMatrixWorld(true);
        this._geometry.computeBoundingBox();
        let box = this._geometry.boundingBox.clone();
        box.min.z = -1;
        box.max.z = 1;

        let anchorWorldScale = new Vector3();
        this._anchor.getWorldScale(anchorWorldScale);

        let position = new Vector3();
        this._mesh.getWorldPosition(position);

        // Apply the matrix to the bounding box.
        let matrix = new Matrix4();
        matrix.compose(position, this._mesh.quaternion.clone(), anchorWorldScale);
        box.applyMatrix4(matrix);

        this._boundingBox = box;
        this._updateDebugBoundingBox();
    }

    /**
     * Set the text to display with this 3d text.
     * @param text the text to display.
     */
    public setText(text: string) {
        // Ignore if the text is already set to provided value.
        if (this._unprocessedText === text) return;

        this._unprocessedText = text;

        if (text) {

            // Text has value, enable the mesh and update the geometry.
            this._anchor.visible = true;
            this._geometry.update(text);
            this.updateBoundingBox();

        } else {

            // Disable the text's rendering.
            this._anchor.visible = false;

        }
    }

    /**
     * Set the text's color.
     * @param color The color value either in string or THREE.Color.
     */
    public setColor(color: Color) {
        var material = <RawShaderMaterial>this._mesh.material;
        material.uniforms.color.value = color;
    }

    /**
     * Set the options for the text geometry used by this text 3d.
     * @param opt The options to set on the text geometry.
     */
    public setOptions(opt: TextGeometryOptions) {

        this._geometry.update(opt);
        this._unprocessedText = opt.text;

        if (opt.text) {

            // Text has value, enable the mesh.
            this._anchor.visible = true;
            this.updateBoundingBox();

        } else {

            // Disable the text's rendering.
            this._anchor.visible = false;

        }
    }

    /**
     * Set the scale of the text.
     * @param scale The scale of the text mesh. (default is 0.004)
     */
    public setScale(scale: number) {
        this._anchor.scale.setScalar(scale);
        this.updateBoundingBox();
    }

    /**
     * Set the parent of this text 3d.
     * @param parent The object 3d to attach this text 3d under.
     */
    public setParent(parent: Object3D) {
        SceneUtils.detach(this._anchor, this._anchor.parent, this._gameView.scene);
        SceneUtils.attach(this._anchor, this._gameView.scene, parent);
    }

    public setRotation(x?: number, y?: number, z?: number) {
        let nextRotation = new Euler().copy(this._anchor.rotation);
        if (!(x === null || typeof x === 'undefined')) {
            nextRotation.x = x * (Math.PI / 180);
        }
        if (!(y === null || typeof y === 'undefined')) {
            nextRotation.y = y * (Math.PI / 180);
        }
        if (!(z === null || typeof z === 'undefined')) {
            nextRotation.z = z * (Math.PI / 180);
        }

        this._anchor.rotation.copy(nextRotation);
        this.updateBoundingBox();
    }

    public setLayer(layer: number) {
        setLayer(this._anchor, layer, true);
    }

    private _updateDebugBoundingBox() {
        if (!Text3D.Debug_BoundingBox) return;

        if (!this._bboxHelper) {
            this._bboxHelper = new Box3Helper(this._boundingBox, new Color(0, 1, 0));
            this._gameView.scene.add(this._bboxHelper);
        }

        (<any>this._bboxHelper).box = this._boundingBox;
        this._bboxHelper.updateMatrixWorld(true);
    }
}