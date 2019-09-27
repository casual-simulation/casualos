import { Object3D, Color, Vector3, ArrowHelper, Sphere } from 'three';

import {
    Object,
    isMinimized,
    BotCalculationContext,
} from '@casual-simulation/aux-common';
import { AuxBot3D } from './AuxBot3D';
import { ContextGroup3D } from './ContextGroup3D';
import { BuilderGroup3D } from './BuilderGroup3D';
import { disposeMaterial } from './SceneUtils';

export class Arrow3D extends Object3D {
    public static DefaultColor: Color = new Color(1, 1, 1);
    public static DefaultHeadWidth = 0.15;
    public static DefaultHeadLength = 0.3;

    /**
     * Three JS helper that draws arrows.
     */
    private _arrowHelper: ArrowHelper;

    /**
     * The bot that this arrow is coming from.
     */
    private _sourceFile3d: AuxBot3D;

    /**
     * Determines weather to draw the arrow with an arrow tip or not
     */
    private _hasArrowTip: boolean;

    /**
     * The bot that this arrow is pointing towards.
     */
    private _targetFile3d: AuxBot3D;

    public get sourceFile3d() {
        return this._sourceFile3d;
    }
    public get targetFile3d() {
        return this._targetFile3d;
    }

    constructor(sourceFile3d: AuxBot3D, targetFile3d: AuxBot3D) {
        super();
        this._sourceFile3d = sourceFile3d;
        this._targetFile3d = targetFile3d;

        // Create the arrow mesh.
        this._arrowHelper = new ArrowHelper(
            new Vector3(0, 0, 0),
            new Vector3(0, 0, 0),
            0,
            Arrow3D.DefaultColor.getHex()
        );
        this.add(this._arrowHelper);
    }

    /**
     * Set the origin of the arrow.
     */
    public setOrigin(origin: Vector3, isWorldspace?: boolean) {
        if (isWorldspace) {
            this._arrowHelper.position.copy(this.worldToLocal(origin.clone()));
        } else {
            this._arrowHelper.position.copy(origin);
        }
    }

    public setColor(color?: Color) {
        if (!this._arrowHelper) return;

        if (color) {
            this._arrowHelper.setColor(color);
        } else {
            this._arrowHelper.setColor(Arrow3D.DefaultColor);
        }
    }

    public setTipState(hasTip: boolean) {
        this._hasArrowTip = hasTip;
    }

    public setLength(length: number) {
        if (!this._arrowHelper) return;

        let headLength = Arrow3D.DefaultHeadLength;
        let headWidth = Arrow3D.DefaultHeadWidth;

        if (length < headLength) {
            headLength = undefined;
            headWidth = undefined;
        }

        this._arrowHelper.setLength(length, headLength, headWidth);
    }

    public update(calc: BotCalculationContext) {
        if (!this._arrowHelper) return;

        let sourceWorkspace = this._getWorkspace(this._sourceFile3d);
        let targetWorkspace = this._getWorkspace(this._targetFile3d);

        const sourceMinimized =
            sourceWorkspace && isMinimized(calc, sourceWorkspace.bot);
        const targetMinimized =
            targetWorkspace && isMinimized(calc, targetWorkspace.bot);

        if (sourceMinimized && targetMinimized) {
            // The workspace of both the source bot and target bot are minimized. Hide arrow and do nothing else.
            this._arrowHelper.visible = false;
        } else {
            this._arrowHelper.visible = true;

            // Update arrow origin.
            if (sourceWorkspace instanceof BuilderGroup3D && sourceMinimized) {
                let miniHexSphere =
                    sourceWorkspace.surface.miniHex.boundingSphere;
                this.setOrigin(miniHexSphere.center, true);
            } else {
                let sourceSphere = this._sourceFile3d.boundingSphere;
                this.setOrigin(sourceSphere.center, true);
            }

            // Update arrow direction and length.
            let targetSphere: Sphere;

            // Lets get the bounding sphere of the target.
            // This could be either the sphere of the bot itself or the sphere of the minimized workspace the bot is on.
            if (targetWorkspace instanceof BuilderGroup3D && targetMinimized) {
                targetSphere = targetWorkspace.surface.miniHex.boundingSphere;
            } else {
                targetSphere = this._targetFile3d.boundingSphere;
            }

            let targetCenterLocal = this.worldToLocal(
                targetSphere.center.clone()
            );
            let dir = targetCenterLocal.clone().sub(this._arrowHelper.position);

            if (!this._hasArrowTip) {
                this._arrowHelper.cone.visible = false;
                dir.setLength(dir.length() + 0.2);
            } else {
                this._arrowHelper.cone.visible = true;
                // Decrease length of direction vector so that it only goes
                // as far as the hull of the target bounding sphere.
                dir.setLength(dir.length() - targetSphere.radius);
            }

            let length = dir.length();

            this._arrowHelper.setDirection(dir.normalize());
            this.setLength(length);
        }

        this.updateMatrixWorld(true);
    }

    public dispose() {
        this.remove(this._arrowHelper);
        this._arrowHelper.line.geometry.dispose();
        disposeMaterial(this._arrowHelper.line.material);
        this._arrowHelper.cone.geometry.dispose();
        disposeMaterial(this._arrowHelper.cone.material);
        this._arrowHelper = null;

        this._sourceFile3d = null;
        this._targetFile3d = null;
    }

    private _getWorkspace(file3d: AuxBot3D): ContextGroup3D {
        return file3d.contextGroup;
    }
}
