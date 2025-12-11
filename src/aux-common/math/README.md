# Math

Comprehensive mathematical utilities for 3D graphics and spatial computations in CasualOS. This folder contains vector, quaternion, and rotation classes for representing positions, directions, and orientations in 2D and 3D space.

## Overview

The `math` module provides:

-   **Vector2**: 2D vector class with arithmetic and geometric operations
-   **Vector3**: 3D vector class with cross product, dot product, and spatial operations
-   **Quaternion**: Mathematical representation of 3D rotations
-   **Rotation**: High-level rotation interface with multiple construction methods
-   **Immutable Design**: All operations return new instances for safe functional programming
-   **Type Safety**: Full TypeScript support with extensive documentation

## Main Exports

### Vector2 (`Vector2.ts`)

2D vector class for representing positions and directions (351 lines):

```typescript
import { Vector2 } from '@casual-simulation/aux-common/math';

// Create vectors
const v1 = new Vector2(3, 4);
const v2 = new Vector2(1, 2);

// Create normalized vector
const normalized = Vector2.createNormalized(1, 2);

// Arithmetic operations
const sum = v1.add(v2); // (4, 6)
const diff = v1.subtract(v2); // (2, 2)
const scaled = v1.multiplyScalar(2); // (6, 8)
const multiplied = v1.multiply(v2); // (3, 8)

// Geometric operations
const dot = v1.dot(v2); // 11
const length = v1.length(); // 5
const squareLength = v1.squareLength(); // 25
const normalized = v1.normalize(); // (0.6, 0.8)
const negated = v1.negate(); // (-3, -4)

// Static methods
const angle = Vector2.angleBetween(v1, v2);
const distance = Vector2.distanceBetween(v1, v2);
const halfway = Vector2.interpolatePosition(v1, v2, 0.5);
const direction = Vector2.interpolateDirection(v1, v2, 0.5);

// Comparison
const equal = v1.equals(v2); // false

// String representation
const str = v1.toString(); // "Vector2(3, 4)"
```

**Key Methods**:

-   `add()`, `subtract()`, `multiply()`, `multiplyScalar()`: Vector arithmetic
-   `dot()`: Dot product (projection)
-   `length()`, `squareLength()`: Magnitude calculations
-   `normalize()`: Unit vector (length = 1)
-   `negate()`: Flip direction
-   `equals()`: Equality comparison
-   **Static**: `angleBetween()`, `distanceBetween()`, `interpolatePosition()`, `interpolateDirection()`

### Vector3 (`Vector3.ts`)

3D vector class with additional cross product operations (466 lines):

```typescript
import {
    Vector3,
    FORWARD,
    BACK,
    RIGHT,
    LEFT,
    UP,
    DOWN,
    ZERO,
    ONE,
} from '@casual-simulation/aux-common/math';

// Create vectors
const v1 = new Vector3(1, 2, 3);
const v2 = new Vector3(4, 5, 6);

// Create normalized vector
const normalized = Vector3.createNormalized(1, 2, 3);

// Access 2D components
const xy = v1.xy; // Vector2(1, 2)
const xz = v1.xz; // Vector2(1, 3)
const yz = v1.yz; // Vector2(2, 3)

// Arithmetic operations (same as Vector2)
const sum = v1.add(v2); // (5, 7, 9)
const diff = v1.subtract(v2); // (-3, -3, -3)
const scaled = v1.multiplyScalar(2); // (2, 4, 6)
const multiplied = v1.multiply(v2); // (4, 10, 18)

// 3D geometric operations
const dot = v1.dot(v2); // 32
const cross = v1.cross(v2); // (-3, 6, -3)
const length = v1.length(); // ~3.742
const normalized = v1.normalize(); // Unit vector
const negated = v1.negate(); // (-1, -2, -3)

// Static methods
const angle = Vector3.angleBetween(v1, v2);
const distance = Vector3.distanceBetween(v1, v2);
const halfway = Vector3.interpolatePosition(v1, v2, 0.5);
const direction = Vector3.interpolateDirection(v1, v2, 0.5);

// Predefined constants
const forward = FORWARD; // (0, 1, 0)
const back = BACK; // (0, -1, 0)
const right = RIGHT; // (1, 0, 0)
const left = LEFT; // (-1, 0, 0)
const up = UP; // (0, 0, 1)
const down = DOWN; // (0, 0, -1)
const zero = ZERO; // (0, 0, 0)
const one = ONE; // (1, 1, 1)

// Comparison
const equal = v1.equals(v2);

// String representation
const str = v1.toString(); // "Vector3(1, 2, 3)"
```

**Additional 3D Methods**:

-   `cross()`: Cross product (perpendicular vector)
-   `xy`, `xz`, `yz`: Get 2D components

**Predefined Vectors**:

-   `ZERO`, `ONE`: Origin and unit cube corner
-   `FORWARD`, `BACK`, `RIGHT`, `LEFT`, `UP`, `DOWN`: Direction vectors

### Quaternion (`Quaternion.ts`)

Low-level quaternion class for representing rotations:

```typescript
import { Quaternion, IDENTITY } from '@casual-simulation/aux-common/math';

// Create quaternion
const q1 = new Quaternion(0, 0, 0.707, 0.707); // ~90° around Z axis
const q2 = new Quaternion(0, 0.707, 0, 0.707); // ~90° around Y axis

// Quaternion operations
const combined = q1.multiply(q2); // Combine rotations
const inverse = q1.invert(); // Inverse rotation
const length = q1.length(); // Magnitude
const squareLength = q1.squareLength(); // Length squared
const normalized = q1.normalize(); // Unit quaternion

// Identity quaternion
const identity = IDENTITY; // (0, 0, 0, 1)

// Comparison
const equal = q1.equals(q2);

// String representation
const str = q1.toString(); // "Quaternion(0, 0, 0.707, 0.707)"
```

**Properties**:

-   `x`, `y`, `z`, `w`: Quaternion components

**Methods**:

-   `multiply()`: Combine quaternions (order-dependent!)
-   `invert()`: Conjugate/inverse
-   `length()`, `squareLength()`: Magnitude
-   `normalize()`: Unit quaternion
-   `equals()`: Equality

**Important**: Quaternions are **immutable** (frozen after construction).

### Rotation (`Rotation.ts`)

High-level rotation class with multiple construction methods (648 lines):

```typescript
import {
    Rotation,
    AUX_ROTATION_TO_THREEJS,
} from '@casual-simulation/aux-common/math';
import { Vector3 } from '@casual-simulation/aux-common/math';

// 1. Axis and angle
const rot1 = new Rotation({
    axis: new Vector3(0, 0, 1),
    angle: Math.PI / 2, // 90 degrees around Z
});

// 2. From/to rotation
const rot2 = new Rotation({
    from: new Vector3(1, 0, 0),
    to: new Vector3(0, 1, 0),
});

// 3. Quaternion
const rot3 = new Rotation({
    quaternion: { x: 0, y: 0, z: 0.707, w: 0.707 },
});

// Or directly from Quaternion instance
const rot4 = new Rotation(new Quaternion(0, 0, 0.707, 0.707));

// 4. Sequence of rotations
const rot5 = new Rotation({
    sequence: [rot1, rot2, rot3],
});

// 5. Euler angles
const rot6 = new Rotation({
    euler: {
        x: Math.PI / 4, // 45° around X
        y: Math.PI / 6, // 30° around Y
        z: Math.PI / 3, // 60° around Z
        order: 'XYZ', // Optional: rotation order
        extrinsic: false, // Optional: intrinsic (false) or extrinsic (true)
    },
});

// 6. Look rotation
const rot7 = new Rotation({
    direction: new Vector3(1, 1, 0), // Look direction
    upwards: new Vector3(0, 0, 1), // Up vector
    errorHandling: 'nudge', // 'error' or 'nudge'
});

// Apply rotations to vectors
const point = new Vector3(1, 0, 0);
const rotated3D = rot1.rotateVector3(point);

const point2D = new Vector2(1, 0);
const rotated2D = rot1.rotateVector2(point2D); // Returns Vector3

// Combine rotations
const combined = rot1.combineWith(rot2);

// Inverse rotation
const inverse = rot1.invert();

// Get axis and angle
const { axis, angle } = rot1.axisAndAngle();

// Static methods
const angleBetween = Rotation.angleBetween(rot1, rot2);
const interpolated = Rotation.interpolate(rot1, rot2, 0.5); // SLERP

// Comparison
const equal = rot1.equals(rot2);

// String representation
const str = rot1.toString(); // "Rotation(axis: ..., angle: ...)"

// Convert from AUX to Three.js coordinates
const threeJsRotation = AUX_ROTATION_TO_THREEJS.combineWith(auxRotation);
```

**Construction Methods**:

1. **Axis and Angle**: Rotate around an axis by a specific angle

    ```typescript
    { axis: Vector3, angle: number }
    ```

2. **From/To**: Rotation that transforms one direction to another

    ```typescript
    { from: Vector3, to: Vector3 }
    ```

3. **Quaternion**: Direct quaternion specification

    ```typescript
    {
        quaternion: {
            x, y, z, w;
        }
    }
    ```

4. **Sequence**: Chain multiple rotations

    ```typescript
    { sequence: Rotation[] }
    ```

5. **Euler Angles**: Rotate around X, Y, Z axes in order

    ```typescript
    { euler: { x, y, z, order?: string, extrinsic?: boolean } }
    ```

6. **Look Rotation**: Look in a direction with specific up vector
    ```typescript
    { direction: Vector3, upwards: Vector3, errorHandling: 'error' | 'nudge' }
    ```

**Key Methods**:

-   `rotateVector3()`, `rotateVector2()`: Apply rotation to vectors
-   `combineWith()`: Combine rotations
-   `invert()`: Inverse rotation
-   `axisAndAngle()`: Extract axis and angle
-   **Static**: `angleBetween()`, `interpolate()` (SLERP)

**Important Interfaces**:

-   `AxisAndAngle`: `{ axis: Vector3, angle: number }`
-   `FromToRotation`: `{ from: Vector3, to: Vector3 }`
-   `EulerAnglesRotation`: `{ euler: { x, y, z, order?, extrinsic? } }`
-   `SequenceRotation`: `{ sequence: Rotation[] }`
-   `QuaternionRotation`: `{ quaternion: { x, y, z, w } }`
-   `LookRotation`: `{ direction: Vector3, upwards: Vector3, errorHandling }`

## Usage Examples

### 2D Vector Operations

```typescript
import { Vector2 } from '@casual-simulation/aux-common/math';

// Create player position
const playerPos = new Vector2(10, 20);

// Calculate direction to target
const targetPos = new Vector2(30, 50);
const direction = targetPos.subtract(playerPos).normalize();

// Move towards target
const speed = 5;
const newPos = playerPos.add(direction.multiplyScalar(speed));

// Check if close enough
const distance = Vector2.distanceBetween(playerPos, targetPos);
if (distance < 1) {
    console.log('Reached target!');
}

// Interpolate between positions
const halfway = Vector2.interpolatePosition(playerPos, targetPos, 0.5);
```

### 3D Vector Operations

```typescript
import { Vector3, UP, FORWARD } from '@casual-simulation/aux-common/math';

// Create 3D position
const position = new Vector3(5, 10, 15);

// Calculate surface normal
const v1 = new Vector3(1, 0, 0);
const v2 = new Vector3(0, 1, 0);
const normal = v1.cross(v2); // (0, 0, 1) = UP

// Check if vectors are perpendicular
const dot = v1.dot(v2);
if (dot === 0) {
    console.log('Perpendicular!');
}

// Find angle between vectors
const angle = Vector3.angleBetween(v1, FORWARD);

// Interpolate positions
const start = new Vector3(0, 0, 0);
const end = new Vector3(10, 10, 10);
const midpoint = Vector3.interpolatePosition(start, end, 0.5);

// Use predefined directions
const up = UP; // (0, 0, 1)
const forward = FORWARD; // (0, 1, 0)
```

### Rotation Applications

```typescript
import { Rotation, Vector3 } from '@casual-simulation/aux-common/math';

// Rotate a point around Z axis by 90°
const rotation = new Rotation({
    axis: new Vector3(0, 0, 1),
    angle: Math.PI / 2,
});

const point = new Vector3(1, 0, 0);
const rotated = rotation.rotateVector3(point); // (0, 1, 0)

// Create a look-at rotation
const lookRotation = new Rotation({
    direction: new Vector3(1, 1, 0).normalize(),
    upwards: new Vector3(0, 0, 1),
    errorHandling: 'nudge',
});

// Combine rotations (order matters!)
const rot1 = new Rotation({ axis: new Vector3(1, 0, 0), angle: Math.PI / 4 });
const rot2 = new Rotation({ axis: new Vector3(0, 0, 1), angle: Math.PI / 2 });
const combined = rot1.combineWith(rot2); // Apply rot1, then rot2

// Interpolate between rotations (SLERP)
const start = new Rotation({ axis: new Vector3(0, 0, 1), angle: 0 });
const end = new Rotation({ axis: new Vector3(0, 0, 1), angle: Math.PI });
const halfway = Rotation.interpolate(start, end, 0.5);

// Convert rotation from one direction to another
const fromToRotation = new Rotation({
    from: new Vector3(1, 0, 0), // X axis
    to: new Vector3(0, 1, 0), // Y axis
});
```

### Euler Angles

```typescript
import { Rotation, Vector3 } from '@casual-simulation/aux-common/math';

// Create rotation from Euler angles
const rotation = new Rotation({
    euler: {
        x: Math.PI / 4, // 45° pitch
        y: Math.PI / 6, // 30° yaw
        z: Math.PI / 3, // 60° roll
        order: 'YXZ', // Apply Y, then X, then Z
        extrinsic: false, // Intrinsic rotations (default)
    },
});

// Extrinsic vs Intrinsic:
// - Intrinsic: Each rotation is in the local coordinate system
// - Extrinsic: Each rotation is in the world coordinate system

// Common rotation orders:
// - 'XYZ': Standard Euler angles
// - 'YXZ': Common for games (yaw, pitch, roll)
// - 'ZYX': Tait-Bryan angles
```

### Working with Quaternions

```typescript
import {
    Quaternion,
    Rotation,
    Vector3,
} from '@casual-simulation/aux-common/math';

// Create quaternion from axis-angle
const axis = new Vector3(0, 0, 1).normalize();
const angle = Math.PI / 2;
const sin = Math.sin(angle / 2);
const cos = Math.cos(angle / 2);
const q = new Quaternion(axis.x * sin, axis.y * sin, axis.z * sin, cos);

// Use quaternion in rotation
const rotation = new Rotation(q);

// Access underlying quaternion
const quat = rotation.quaternion;
console.log(quat.x, quat.y, quat.z, quat.w);

// Combine quaternions (order matters!)
const q1 = new Quaternion(0, 0, 0.707, 0.707);
const q2 = new Quaternion(0, 0.707, 0, 0.707);
const combined = q1.multiply(q2);

// Invert quaternion
const inverse = q1.invert();
const identity = q1.multiply(inverse); // Should be ~(0, 0, 0, 1)
```

### Practical Game Example

```typescript
import { Vector3, Rotation, Vector2 } from '@casual-simulation/aux-common/math';

class GameObject {
    position: Vector3;
    rotation: Rotation;

    constructor(x: number, y: number, z: number) {
        this.position = new Vector3(x, y, z);
        this.rotation = new Rotation(); // Identity
    }

    // Move forward in local space
    moveForward(distance: number) {
        const forward = new Vector3(0, 1, 0);
        const worldForward = this.rotation.rotateVector3(forward);
        this.position = this.position.add(
            worldForward.multiplyScalar(distance)
        );
    }

    // Rotate to look at target
    lookAt(target: Vector3) {
        const direction = target.subtract(this.position).normalize();
        this.rotation = new Rotation({
            direction: direction,
            upwards: new Vector3(0, 0, 1),
            errorHandling: 'nudge',
        });
    }

    // Get distance to target
    distanceTo(target: Vector3): number {
        return Vector3.distanceBetween(this.position, target);
    }

    // Interpolate to target position
    moveTo(target: Vector3, amount: number) {
        this.position = Vector3.interpolatePosition(
            this.position,
            target,
            amount
        );
    }

    // Interpolate to target rotation
    rotateTo(targetRotation: Rotation, amount: number) {
        this.rotation = Rotation.interpolate(
            this.rotation,
            targetRotation,
            amount
        );
    }
}
```

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                    Math Module                         │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │             Vector2                          │    │
│  │  - x, y components                           │    │
│  │  - Arithmetic: add, subtract, multiply       │    │
│  │  - Geometric: dot, length, normalize         │    │
│  │  - Static: angle, distance, interpolate      │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │             Vector3                          │    │
│  │  - x, y, z components                        │    │
│  │  - All Vector2 operations                    │    │
│  │  - Additional: cross product                 │    │
│  │  - 2D projections: xy, xz, yz                │    │
│  │  - Constants: FORWARD, UP, RIGHT, etc.       │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │           Quaternion                         │    │
│  │  - x, y, z, w components                     │    │
│  │  - multiply (combine rotations)              │    │
│  │  - invert (reverse rotation)                 │    │
│  │  - normalize (unit quaternion)               │    │
│  │  - IMMUTABLE (Object.freeze)                 │    │
│  └──────────────────────────────────────────────┘    │
│                     ▲                                  │
│                     │                                  │
│  ┌──────────────────┴───────────────────────────┐    │
│  │             Rotation                         │    │
│  │  Multiple construction methods:              │    │
│  │  - Axis/Angle                                │    │
│  │  - From/To vectors                           │    │
│  │  - Quaternion                                │    │
│  │  - Euler angles                              │    │
│  │  - Sequence                                  │    │
│  │  - Look rotation                             │    │
│  │                                              │    │
│  │  Operations:                                 │    │
│  │  - rotateVector3, rotateVector2             │    │
│  │  - combineWith (composition)                 │    │
│  │  - invert                                    │    │
│  │  - interpolate (SLERP)                       │    │
│  │  - angleBetween                              │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

## Key Concepts

### Immutability

All math operations return **new instances** rather than modifying existing ones:

```typescript
const v1 = new Vector3(1, 2, 3);
const v2 = v1.add(new Vector3(1, 1, 1));
// v1 is unchanged: (1, 2, 3)
// v2 is new: (2, 3, 4)
```

This ensures safe functional programming and prevents accidental mutations.

### Normalization

Normalized vectors have length 1 and represent pure direction:

```typescript
const v = new Vector3(3, 4, 0);
const length = v.length(); // 5
const normalized = v.normalize(); // (0.6, 0.8, 0)
const newLength = normalized.length(); // 1
```

### Dot Product

Measures how much two vectors point in the same direction:

-   **Positive**: Same general direction
-   **Zero**: Perpendicular (90°)
-   **Negative**: Opposite directions

### Cross Product (3D only)

Produces a vector perpendicular to both input vectors:

-   **Order matters**: `a.cross(b) !== b.cross(a)`
-   Used for calculating surface normals
-   Magnitude equals area of parallelogram formed by vectors

### Quaternions vs Rotation

-   **Quaternion**: Low-level mathematical representation (x, y, z, w)
-   **Rotation**: High-level interface with multiple construction methods
-   Most users should use `Rotation` class
-   Direct quaternion manipulation is for advanced use cases

### Euler Angles

Three rotations around X, Y, Z axes:

-   **Order matters**: XYZ ≠ ZYX
-   **Intrinsic**: Each rotation in local coordinates (default)
-   **Extrinsic**: Each rotation in world coordinates
-   **Gimbal lock**: Can occur at certain angles

### SLERP (Spherical Linear Interpolation)

Smooth interpolation between rotations:

```typescript
const start = new Rotation({ axis: UP, angle: 0 });
const end = new Rotation({ axis: UP, angle: Math.PI });
const halfway = Rotation.interpolate(start, end, 0.5);
```

## Dependencies

This module depends on:

-   `@casual-simulation/js-interpreter`: UNCOPIABLE marker
-   `@casual-simulation/aux-common/utils`: `clamp()` utility

## Integration Points

The math module integrates with:

-   **aux-runtime**: Bot positioning and orientation
-   **aux-web**: 3D rendering with Three.js
-   **aux-common/bots**: Bot tag values for position/rotation
-   **casualos-cli**: Spatial calculations

## Related Packages

-   `@casual-simulation/aux-common/bots`: Uses math types for bot positions
-   `@casual-simulation/aux-web`: Renders using these math primitives
-   `three`: Three.js uses similar math structures (compatible conversion needed)
