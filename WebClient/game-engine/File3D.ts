import { Mesh, Group, BoxBufferGeometry, MeshStandardMaterial, LineBasicMaterial } from "three";
import { File, Object, Workspace } from '../../common/Files'
import { vg } from "von-grid";

/**
 * Defines an object that groups Three.js related information
 * with the object/workspace data that they represent.
 */
export class File3D {

    /**
     * The file (workspace or object) that this object represents.
     */
    public file: File;

    /**
     * The 3D mesh that represents the file.
     */
    public mesh: Mesh | Group;

    /**
     * The optional surface used for workspaces.
     * Surfaces are simply the special decoration that a workspace displays so that 
     * objects appear to be placed on them. Their only use is for visuals.
     */
    public surface: vg.Board | null;

    /**
     * The grid that is used to position objects on top of workspaces.
     * Grids are only visible while the user is dragging an object.
     */
    public grid: vg.Board | null;

    constructor(file: File) {
        this.file = file;

        if (file.type === 'object') {

            this.mesh = this._createCube(0.2);
            this.surface = null;
            this.grid = null;

        } else {

            const surface = this._createWorkSurface(file);
            this.mesh = surface.board.group;
            this.grid = surface.sqrBoard;
            this.surface = surface.board;

        }

        this.mesh.name = `${file.type}_${file.id}`;
        
        if (this.grid) {
          this.grid.group.name = `grid_${file.type}_${file.id}`;
        }
    }


    private _createCube(size: number): Mesh {

        var geometry = new BoxBufferGeometry(size, size, size);
        var material = new MeshStandardMaterial({
            color: 0x00ff00,
            metalness: .1,
            roughness: 0.6
        });
        const cube = new Mesh(geometry, material);
        cube.castShadow = true;
        cube.receiveShadow = false;
        return cube;
    }

    private _createWorkSurface(data: Workspace) {
        const grid = new vg.HexGrid({
            cellSize: .3,
            cellHeight: 0.5
        });
        grid.generate({
            size: data.size || 0
        });

        const board = new vg.Board(grid);
        this.generateTilemap(board, data);

        const sqrGrid = new vg.SqrGrid({
            size: 14,
            cellSize: .12
        });

        const sqrBoard = new vg.Board(sqrGrid);
        const mat = new LineBasicMaterial({
            color: 0xFFFFFF,
            opacity: 1
        });
        
        sqrBoard.generateOverlay(18, mat);

        sqrBoard.group.position.x = data.position.x;
        sqrBoard.group.position.y = data.position.y;
        sqrBoard.group.position.z = data.position.z;

        return { board, sqrBoard };
    }

    public generateTilemap(board: vg.Board, data: Workspace) {
        board.generateTilemap({
            extrudeSettings: {
                bevelEnabled: true,
                steps: 1,
                bevelSize: 0.015,
                bevelThickness: 0.00
            },
            material: new MeshStandardMaterial({
                color: 0x999999,
                roughness: .7,
            })
        });

        board.group.children[0].children.forEach(c => {
            c.castShadow = true;
            c.receiveShadow = true;
        });

        board.group.position.x = data.position.x;
        board.group.position.y = data.position.y + 0.4;
        board.group.position.z = data.position.z;
    }
}