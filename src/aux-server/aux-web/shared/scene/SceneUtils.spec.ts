import {
    createBot,
    createCalculationContext,
} from '@casual-simulation/aux-common';
import { calculateScale } from './SceneUtils';

describe('SceneUtils', () => {
    describe('calculateScale()', () => {
        it('should swap the Y and Z values', () => {
            const bot = createBot('bot', {
                auxScaleX: 2,
                auxScaleY: 3,
                auxScaleZ: 4,
            });
            const calc = createCalculationContext([bot]);

            const scale = calculateScale(calc, bot, 2);
            expect(scale.x).toEqual(4);
            expect(scale.y).toEqual(8);
            expect(scale.z).toEqual(6);
        });
    });
});
