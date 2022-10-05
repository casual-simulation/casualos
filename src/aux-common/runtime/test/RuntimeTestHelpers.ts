import { DateTime } from 'luxon';
import { Vector2 } from '../../math/Vector2';
import { Vector3 } from '../../math/Vector3';
import { Rotation } from '../../math/Rotation';

export const customDataTypeCases = [
    [
        'DateTime',
        DateTime.utc(1999, 11, 19, 5, 42, 8),
        '📅1999-11-19T05:42:08Z',
    ] as const,
    ['Vector2', new Vector2(1, 2), '➡️1,2'] as const,
    ['Vector3', new Vector3(1, 2, 3), '➡️1,2,3'] as const,
    ['Rotation', new Rotation(), '🔁0,0,0,1'] as const,
];
