import { Mesh, Group, Sprite, LineSegments } from '@casual-simulation/three';
import { AuxBot3D } from '../AuxBot3D';
import { Event, ArgEvent } from '@casual-simulation/aux-common/Events';

export interface IMeshDecorator {
    bot3D: AuxBot3D;
    container: Group;
    mesh: Mesh | Sprite | LineSegments;

    /**
     * Whether additional modifications to the mesh
     * are allowed.
     */
    allowModifications: boolean;

    /**
     * Whether to allow modifications to the mesh material.
     */
    allowMaterialModifications: boolean;

    /**
     * Event that gets fired when the mesh is updated.
     */
    onMeshUpdated: ArgEvent<IMeshDecorator>;
}
