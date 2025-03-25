import type { CameraRig } from '../scene/CameraRigFactory';
import type { CameraControls } from './CameraControls';

export interface CameraRigControls {
    rig: CameraRig;
    controls: CameraControls;
}
