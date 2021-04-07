declare class AbsoluteOrientationSensor extends EventTarget {
    quaternion: [number, number, number, number];
    start(): void;
    stop(): void;

    constructor(options?: any);
}
