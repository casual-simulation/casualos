import { Mesh, Group, Sprite } from 'three';
import { AuxBot3D } from '../AuxBot3D';
import { Event, ArgEvent } from '@casual-simulation/aux-common/Events';

export interface IMeshDecorator {
    bot3D: AuxBot3D;
    container: Group;
    mesh: Mesh | Sprite;

    /**
     * Event that gets fired when the mesh is updated.
     */
    onMeshUpdated: ArgEvent<IMeshDecorator>;
}
