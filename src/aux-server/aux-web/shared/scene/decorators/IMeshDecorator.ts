import { Mesh, Group, Sprite } from 'three';
import { AuxFile3D } from '../AuxFile3D';
import { Event, ArgEvent } from '@casual-simulation/aux-common/Events';

export interface IMeshDecorator {
    file3D: AuxFile3D;
    container: Group;
    mesh: Mesh | Sprite;

    /**
     * Event that gets fired when the mesh is updated.
     */
    onMeshUpdated: ArgEvent<IMeshDecorator>;
}
