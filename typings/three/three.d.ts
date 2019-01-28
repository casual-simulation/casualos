import { Object3D, Box3, Color } from "three";

declare module 'three' {
    class Box3Helper extends Object3D {
        constructor(box: Box3, color: Color);
    }
  }