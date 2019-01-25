import { 
    Math as ThreeMath,
    Mesh, 
    Object3D, 
    Scene,
    DoubleSide,
    Color,
    MeshBasicMaterial,
    TextureLoader,
    Texture,
    SceneUtils,
    Vector3} from "three";

import createBMFont, { TextGeometry, TextGeometryOptions } from "three-bmfont-text";
import GameView from "WebClient/GameView/GameView";

export class Text3D {

    public static readonly defaultScale: number = 0.004;

    // The text geometry created with 'three-bmfont-text'
    // To change text, run textGeometry.update and include the proper options.
    private _geometry: TextGeometry;

    // The text mesh that is holding onto the text geometry that gets rendered by three.
    private _mesh: Mesh;

    // The 3d scene object that is the parent/anchor of the textMesh.
    private _anchor: Object3D;

    // the text that was last set on this text3d.
    private _unprocessedText: string;

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

        var texture = new TextureLoader().load(fontTexturePath);
        const width = 200;
        this._geometry = createBMFont({ font: fontData, text: "", flipY: true, align: "center", width: width });
        var material = new MeshBasicMaterial({
            map: texture,
            lights: false,
            side: DoubleSide,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            color: new Color(0, 0, 0),
        });

        this._mesh = new Mesh(this._geometry, material);
        this._anchor = new Object3D();
        this._anchor.add(this._mesh);
        this.setScale(Text3D.defaultScale);

        // Rotate the text mesh so that it is upright when rendered.
        this._mesh.rotateX(ThreeMath.degToRad(180)); 

        // Move label so that its bottom edge is centered on the anchor.
        // this._mesh.translateX(this._geometry.layout.width / 2);
        this._mesh.position.set(-width / 2, 50, 0);

        // Add the label anchor as aa child of the file mesh.
        parent.add(this._anchor);
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