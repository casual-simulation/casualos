import {
    Object3D,
    Mesh, 
    BoxBufferGeometry,
    MeshStandardMaterial,
    Color,
    Vector3,
    Box3,
    Sphere,
    BufferGeometry,
    BufferAttribute,
    LineBasicMaterial,
    LineSegments
} from "three";
import { 
    Object,
    File,
    DEFAULT_WORKSPACE_SCALE,
    DEFAULT_WORKSPACE_GRID_SCALE,
    isArray,
    parseArray,
    isFormula,
    fileFromShortId,
    objectsAtWorkspaceGridPosition,
    FileCalculationContext,
    calculateFileValue,
    calculateNumericalTagValue
} from '@yeti-cgi/aux-common/Files';
import { ArgEvent } from '@yeti-cgi/aux-common/Events';
import { GameObject } from "./GameObject";
import { IGameView } from '../IGameView';
import { calculateGridTileLocalCenter } from "./grid/Grid";
import { Text3D } from "./Text3D";
import { Arrow3D } from "./Arrow3D";
import { find, flatMap, sumBy, sortBy } from "lodash";
import { appManager } from '../AppManager';
import { createLabel, convertToBox2, setLayer } from "./SceneUtils";
import { WorkspaceMesh } from "./WorkspaceMesh";
import { WordBubble3D } from "./WordBubble3D";
import { LayersHelper } from "./LayersHelper";
import { AppType } from "../AppManager";
import { createCube } from './SceneUtils';
import GameView from "../../aux-player/GameView/GameView";

/**
 * Defines a class that represents a mesh for an "object" file.
 */
export class FileMesh extends GameObject {

    private _gameView: IGameView | null;

    /**
     * The data for the mesh.
     */
    file: Object;

    constructor(gameView?: IGameView) {
        super();
        this._gameView = gameView;
    }
}

