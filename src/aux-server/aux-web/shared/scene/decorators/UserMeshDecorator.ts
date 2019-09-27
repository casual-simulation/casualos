import {
    Vector3,
    Group,
    Mesh,
    Math as ThreeMath,
    MeshToonMaterial,
    Color,
} from 'three';
import { Text3D } from '../Text3D';
import {
    BotCalculationContext,
    AuxObject,
    getUserBotColor,
    isUserActive,
    calculateBooleanTagValue,
} from '@casual-simulation/aux-common';
import { setLayer, disposeMesh, createUserCone } from '../SceneUtils';
import { AuxFile3DDecorator } from '../AuxFile3DDecorator';
import { AuxFile3D } from '../AuxFile3D';
import { IMeshDecorator } from './IMeshDecorator';
import { Event, ArgEvent } from '@casual-simulation/aux-common/Events';
/**
 * Defines a class that represents a mesh for an "user" bot.
 */
export class UserMeshDecorator extends AuxFile3DDecorator
    implements IMeshDecorator {
    /**
     * The mesh that acts as the visual representation of the user.
     */
    mesh: Mesh;

    /**
     * The container for the meshes.
     */
    container: Group;

    /**
     * The label for the user.
     */
    label: Text3D;

    onMeshUpdated: ArgEvent<IMeshDecorator> = new ArgEvent<IMeshDecorator>();

    constructor(file3D: AuxFile3D) {
        super(file3D);

        // Container
        this.container = new Group();
        this.file3D.display.add(this.container);

        // Label
        this.label = new Text3D();
        this.label.setText(this.file3D.bot.tags['aux._user']);
        this.label.setScale(Text3D.defaultScale * 2);
        this.label.setWorldPosition(new Vector3(0, 0, 0));
        this.label.setRotation(0, 180, 0);
        this.container.add(this.label);
        this.label.position.add(new Vector3(1.55, 0.7, 0)); // This is hardcoded. To lazy to figure out that math.

        // User Mesh
        this.mesh = createUserCone();
        this.container.add(this.mesh);
        this.mesh.rotation.x = ThreeMath.degToRad(90.0);
        this.mesh.rotation.y = ThreeMath.degToRad(45.0);

        this.onMeshUpdated.invoke(this);
    }

    botUpdated(calc: BotCalculationContext): void {
        this._updateColor(calc);
        this.file3D.display.updateMatrixWorld(false);
    }

    frameUpdate(calc: BotCalculationContext) {
        let bot = <AuxObject>this.file3D.bot;

        // visible if not destroyed, and was active in the last minute
        this.container.visible = this._isActive(calc);
    }

    dispose() {
        this.file3D.display.remove(this.container);

        this.mesh.geometry.dispose();
        disposeMesh(this.mesh);

        this.mesh = null;
        this.container = null;
    }

    private _isActive(calc: BotCalculationContext): boolean {
        let userVisible = calculateBooleanTagValue(
            calc,
            this.file3D.contextGroup.bot,
            'aux.context.devices.visible',
            true
        );

        return isUserActive(calc, this.file3D.bot) && userVisible;
    }

    private _updateColor(calc: BotCalculationContext) {
        if (this.file3D.contextGroup === null) {
            return;
        }

        const isInAuxPlayer =
            this.file3D.contextGroup.bot.id !== this.file3D.bot.id;
        const color = getUserBotColor(
            calc,
            this.file3D.bot,
            this.file3D.contextGroup.simulation3D.simulation.helper.globalsFile,
            isInAuxPlayer ? 'player' : 'builder'
        );

        const material: MeshToonMaterial = <MeshToonMaterial>this.mesh.material;
        material.color.set(new Color(color));

        this.container.visible = this._isActive(calc);
    }
}
