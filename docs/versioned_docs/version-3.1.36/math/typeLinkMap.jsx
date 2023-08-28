import { setLinkMap } from '@site/util/doc';

const RotationsClasses = [
    'Rotation',
    'AxisAndAngle',
    'FromToRotation',
    'SequenceRotation',
    'EulerAnglesRotation',
    'Quaternion',
];

/**
 * A map of class names to page IDs.
 */
export const ClassPageMap = {
    'Vector2': 'math/vectors',
    'Vector3': 'math/vectors',
};

for(let rotation of RotationsClasses) {
    ClassPageMap[rotation] = 'math/rotations';
}

setLinkMap(ClassPageMap);