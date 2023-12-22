declare class AbsoluteOrientationSensor extends EventTarget {
    quaternion: [number, number, number, number];
    start(): void;
    stop(): void;

    constructor(options?: any);
}

declare class RelativeOrientationSensor extends EventTarget {
    quaternion: [number, number, number, number];
    start(): void;
    stop(): void;

    constructor(options?: any);
}
