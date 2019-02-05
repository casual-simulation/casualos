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
    LinearFilter} from "three";

import createBMFont, { TextGeometry, TextGeometryOptions } from "three-bmfont-text";
import GameView from "../GameView/GameView";

var sdfShader = require('three-bmfont-text/shaders/sdf');

export class Text3D {

    // Map of loaded font textures.
    public static FontTextures: {
        [texturePath: string]: Texture
    } = {};

    public static readonly defaultWidth: number = 200;
    public static readonly extraSpacing: number = 0.1;
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

    /**
     * Whether the text should appear the same size no matter how far away the camera is.
     */
    private _constantSize: boolean;

    private _gameView: GameView;

    /**
     * the text that was last set on this text3d.
     */
    get unprocessedText(): string { return this._unprocessedText; }

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
            depthTest: false,
            depthWrite: false,
            color: new Color(0, 0, 0)
        }));

        this._mesh = new Mesh(this._geometry, material);
        this._anchor = new Object3D();
        this._anchor.add(this._mesh);
        this.setScale(Text3D.defaultScale);

        // Rotate the text mesh so that it is upright when rendered.
        this._mesh.rotateX(ThreeMath.degToRad(180)); 

        // Move label so that its bottom edge is centered on the anchor.
        // this._mesh.translateX(this._geometry.layout.width / 2);
        // this._mesh.position.set(-width / 2, 50, 0);

        // Add the label anchor as aa child of the file mesh.
        parent.add(this._anchor);
    }

    /**
     * Sets the position of the text based on the size of the given bounding box.
     * @param box The bounding box.
     */
    public setPositionForObject(obj: Object3D) {
        let bounds = new Box3().setFromObject(obj);
        let size = new Vector3();
        bounds.getSize(size);

        size.add(new Vector3(0, Text3D.extraSpacing, 0));
        size.divide(this._anchor.scale);
        this._mesh.position.set(-Text3D.defaultWidth / 2, size.y, 0);
    }

    /**
     * Gets the position of the text in world space.
     */
    public getWorldPosition() {
        let pos = new Vector3();
        this._anchor.getWorldPosition(pos);
        return pos;
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
    }

    /**
     * Set the parent of this text 3d.
     * @param parent The object 3d to attach this text 3d under.
     */
    public setParent(parent: Object3D) {
        SceneUtils.detach(this._anchor, this._anchor.parent, this._gameView.scene);
        SceneUtils.attach(this._anchor, this._gameView.scene, parent);
    }
}