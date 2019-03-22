import { PlayerGrid, calculateTileCornerPoints, calculateGridTile, calculateGridTileLocalCenter } from "./PlayerGrid";
import { Vector3, Vector2 } from "three";

describe('PlayerGrid', () => {

    const scaleList = [
        1, 2, 3, 
        -1, -2, -3, 
        0.5, -0.5, 
        -5, 5, 
        100, -100, 
        -1002.3, 1002.3
    ];

    it('should construct with default parameters', () => {
        let grid = new PlayerGrid();
        expect(grid.tileScale).toEqual(1);
    });

    it('should construct with custom parameters', () => {
        let grid = new PlayerGrid(2);
        expect(grid.tileScale).toEqual(2);
    });

    describe('calculateTileCornerPoints()', () => {
        it.each(scaleList)('should get expected local points for tileScale of %d', (scale) => {
            let points = calculateTileCornerPoints(scale);

            // Should have 4 points.
            expect(points.length).toEqual(4);
            // topLeft (-0.5, 0.5)
            expect(points[0]).toEqual(new Vector3(-0.5 * scale, 0, 0.5 * scale));
            // topRight (0.5, 0.5)
            expect(points[1]).toEqual(new Vector3(0.5 * scale, 0, 0.5 * scale));
            // bottomRight (0.5, -0.5)
            expect(points[2]).toEqual(new Vector3(0.5 * scale, 0, -0.5 * scale));
            // bottomLeft (-0.5, -0.5)
            expect(points[3]).toEqual(new Vector3(-0.5 * scale, 0, -0.5 * scale));
        });
    });

    describe('calculateGridTileLocalCenter()', () => {
        it.each(scaleList)('should get expected center position for tiles with scale %d', (scale) => {
            let grid = new PlayerGrid(scale);

            for (let x = 0; x <= 10; x++) {
                for (let y = 0; y <= 10; y++) {
                    let center = calculateGridTileLocalCenter(x, y, grid.tileScale);
                    expect(center).toEqual(new Vector3(x * scale, 0, y * scale));
                }
            }
        });
    });

    describe('calculateGridTile()', () => {
        it.each(scaleList)('should get expected center position and corner points for tiles with scale %d', (scale) => {
            let grid = new PlayerGrid(scale);

            for (let x = 0; x <= 10; x++) {
                for (let y = 0; y <= 10; y++) {
                    let tile = calculateGridTile(x, y, grid.tileScale);
                    expect(tile.center).toEqual(new Vector3(x * scale, 0, y * scale));

                    // 4 Points
                    // topLeft (-0.5, 0.5)
                    expect(tile.points[0]).toEqual(new Vector3(x * (-0.5 * scale), 0, y * (0.5 * scale)));
                    // topRight (0.5, 0.5)
                    expect(tile.points[0]).toEqual(new Vector3(x * (0.5 * scale), 0, y * (0.5 * scale)));
                    // bottomRight (0.5, -0.5)
                    expect(tile.points[0]).toEqual(new Vector3(x * (0.5 * scale), 0, y * (-0.5 * scale)));
                    // bottomLeft (-0.5, -0.5)
                    expect(tile.points[0]).toEqual(new Vector3(x * (-0.5 * scale), 0, y * (-0.5 * scale)));
                }
            }
        });
    });

    it.skip('getTileFromCooridnate should return 0,0,0 for position', () => {
        let grid = new PlayerGrid();

        let tile = grid.getTileFromCoordinate(new Vector2(0,0));
        expect(tile.position).toEqual(new Vector3(0,0,0));
        expect(tile.tileCoordinate).toEqual(new Vector2(0,0));
    });
});