import { Box3, Vector3, Color, Ray } from '@casual-simulation/three';
import { Time } from '../Time';
import { DebugObjectManager } from './DebugObjectManager';

var _box = new Box3(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
var _boxScalar = 1;
var _boxScaleTweenForward = true;
var _boxScaleTweenSpeed = 4;

var _ray = new Ray(new Vector3(4, 0, 0), new Vector3(0, 0, 3));
var _rayTweenForward = true;
var _rayTweenSpeed = 4;

var _letterOnColor = new Color('#0ff');
var _letterOffColor = new Color('#000');
var _letter: number = 0;
var _letterChangeTime: number = 0;

export function drawExamples(time: Time): void {
    // Apply some ping-pong scale tweening to the box.
    if (_boxScaleTweenForward) {
        _boxScalar += _boxScaleTweenSpeed * time.deltaTime;
        _boxScaleTweenForward = _boxScalar < 3;
    } else {
        _boxScalar -= _boxScaleTweenSpeed * time.deltaTime;
        _boxScaleTweenForward = _boxScalar <= 1;
    }

    _box.max.copy(new Vector3(1, 1, 1).multiplyScalar(_boxScalar));

    // Draw red line from box min to box max.
    DebugObjectManager.drawLine(_box.min, _box.max, new Color('#ff0000'));

    // Draw box.
    DebugObjectManager.drawBox3(_box, null);

    // Draw all corner points of the box.
    const boxCorners = [
        new Vector3(_box.min.x, _box.min.y, _box.min.z),
        new Vector3(_box.min.x, _box.min.y, _box.max.z),
        new Vector3(_box.min.x, _box.max.y, _box.max.z),
        new Vector3(_box.max.x, _box.max.y, _box.min.z),
        new Vector3(_box.max.x, _box.max.y, _box.min.z),
        new Vector3(_box.max.x, _box.min.y, _box.min.z),
        new Vector3(_box.max.x, _box.min.y, _box.max.z),
        new Vector3(_box.min.x, _box.max.y, _box.min.z),
    ];

    boxCorners.forEach((point) => {
        DebugObjectManager.drawPoint(point, 0.5, new Color('white'));
    });

    // Apply some ping-pong scale tweening to the ray.
    if (_rayTweenForward) {
        _ray.direction.setZ(_ray.direction.z + _rayTweenSpeed * time.deltaTime);
        _rayTweenForward = _ray.direction.z < 6;
    } else {
        _ray.direction.setZ(_ray.direction.z - _rayTweenSpeed * time.deltaTime);
        _rayTweenForward = _ray.direction.z < -6;
    }

    // Draw ray as yellow arrow.
    DebugObjectManager.drawArrow(
        _ray.origin,
        _ray.direction,
        new Color('yellow')
    );

    // Draw the text 'AUX' using lines.
    const xOffset = 6;
    const scale = 1;
    const letters = [
        // A:
        [
            { start: new Vector3(0, 0, 0), end: new Vector3(0, 2, 0) },
            { start: new Vector3(0, 2, 0), end: new Vector3(2, 4, 0) },
            { start: new Vector3(2, 4, 0), end: new Vector3(4, 2, 0) },
            { start: new Vector3(4, 2, 0), end: new Vector3(4, 0, 0) },
            { start: new Vector3(0, 2, 0), end: new Vector3(4, 2, 0) },
        ],
        // U:
        [
            { start: new Vector3(6, 4, 0), end: new Vector3(6, 1, 0) },
            { start: new Vector3(6, 1, 0), end: new Vector3(7, 0, 0) },
            { start: new Vector3(7, 0, 0), end: new Vector3(9, 0, 0) },
            { start: new Vector3(9, 0, 0), end: new Vector3(10, 1, 0) },
            { start: new Vector3(10, 1, 0), end: new Vector3(10, 4, 0) },
        ],
        // X:
        [
            { start: new Vector3(12, 4, 0), end: new Vector3(16, 0, 0) },
            { start: new Vector3(12, 0, 0), end: new Vector3(16, 4, 0) },
        ],
    ];
    // Apply letter point transformations

    letters.forEach((letter, letterIndex) => {
        letter.forEach((line) => {
            // Apply line point transformations.
            line.start.x += xOffset;
            line.start.multiplyScalar(scale);
            line.end.x += xOffset;
            line.end.multiplyScalar(scale);

            // Get color of line.
            const color =
                _letter === letterIndex ? _letterOnColor : _letterOffColor;
            DebugObjectManager.drawLine(line.start, line.end, color);
        });
    });

    // Update active letter color.
    if (_letterChangeTime <= time.timeSinceStart) {
        _letterChangeTime = time.timeSinceStart + 0.5;

        _letter++;
        if (_letter >= 3) {
            _letter = 0;
        }
    }
}
