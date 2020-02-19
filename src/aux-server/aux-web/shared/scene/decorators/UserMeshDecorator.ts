import { Group, Mesh, Math as ThreeMath, MeshToonMaterial, Color } from 'three';
import {
    BotCalculationContext,
    isUserActive,
    calculateBooleanTagValue,
    DEFAULT_PLAYER_USER_COLOR,
} from '@casual-simulation/aux-common';
import { disposeMesh, createUserCone } from '../SceneUtils';
import { AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import { IMeshDecorator } from './IMeshDecorator';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
/**
 * Defines a class that represents a mesh for an "user" bot.
 */
export class UserMeshDecorator extends AuxBot3DDecoratorBase
    implements IMeshDecorator {
    /**
     * The mesh that acts as the visual representation of the user.
     */
    mesh: Mesh;

    /**
     * The container for the meshes.
     */
    container: Group;

    get allowModifications() {
        return true;
    }

    onMeshUpdated: ArgEvent<IMeshDecorator> = new ArgEvent<IMeshDecorator>();

    constructor(bot3D: AuxBot3D) {
        super(bot3D);

        // Container
        this.container = new Group();
        this.bot3D.display.add(this.container);

        // User Mesh
        this.mesh = createUserCone();
        this.container.add(this.mesh);
        this.mesh.rotation.x = ThreeMath.degToRad(90.0);
        this.mesh.rotation.y = ThreeMath.degToRad(45.0);

        this.onMeshUpdated.invoke(this);
    }

    botUpdated(calc: BotCalculationContext): void {
        this._updateColor(calc);
        this.bot3D.display.updateMatrixWorld(false);
    }

    frameUpdate(calc: BotCalculationContext) {
        // visible if not destroyed, and was active in the last minute
        this.container.visible = this._isActive(calc);
    }

    dispose() {
        this.bot3D.display.remove(this.container);

        this.mesh.geometry.dispose();
        disposeMesh(this.mesh);

        this.mesh = null;
        this.container = null;
    }

    private _isActive(calc: BotCalculationContext): boolean {
        let userVisible = calculateBooleanTagValue(
            calc,
            this.bot3D.dimensionGroup.bot,
            'auxDimensionDevicesVisible',
            true
        );

        return isUserActive(calc, this.bot3D.bot) && userVisible;
    }

    private _updateColor(calc: BotCalculationContext) {
        if (this.bot3D.dimensionGroup === null) {
            return;
        }

        const color = DEFAULT_PLAYER_USER_COLOR;
        const material: MeshToonMaterial = <MeshToonMaterial>this.mesh.material;
        material.color.set(new Color(color));

        this.container.visible = this._isActive(calc);
    }
}
