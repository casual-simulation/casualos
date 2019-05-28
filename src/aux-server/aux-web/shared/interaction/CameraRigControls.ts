import { CameraRig } from '../scene/CameraRigFactory';
import { CameraControls } from './CameraControls';

export interface CameraRigControls {
    rig: CameraRig;
    controls: CameraControls;
}
