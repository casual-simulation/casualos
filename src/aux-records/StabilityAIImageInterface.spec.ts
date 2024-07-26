import { getStableImageAspectRatio } from './StabilityAIImageInterface';

describe('getStableImageAspectRatio()', () => {
    const cases = [
        [1024, 1024, '1:1'] as const,
        [1920, 1080, '16:9'] as const,
        [3840, 2160, '16:9'] as const,
        [3840, 3840, '1:1'] as const,

        // 21:9
        [2560, 1080, '21:9'] as const,
        [3440, 1440, '21:9'] as const,
        [5120, 2160, '21:9'] as const,

        // 2:3
        [800, 1200, '2:3'] as const,
        [1200, 1800, '2:3'] as const,
        [2400, 3600, '2:3'] as const,

        // 3:2
        [1200, 800, '3:2'] as const,
        [1800, 1200, '3:2'] as const,
        [3600, 2400, '3:2'] as const,

        // 4:5
        [800, 1000, '4:5'] as const,
        [1200, 1500, '4:5'] as const,
        [2400, 3000, '4:5'] as const,

        // 5:4
        [1000, 800, '5:4'] as const,
        [1500, 1200, '5:4'] as const,
        [3000, 2400, '5:4'] as const,

        // 9:16
        [1080, 1920, '9:16'] as const,
        [1440, 2560, '9:16'] as const,
        [2160, 3840, '9:16'] as const,

        // 9:21
        [1080, 2560, '9:21'] as const,
        [1440, 3440, '9:21'] as const,
        [2160, 5120, '9:21'] as const,
    ];

    it.each(cases)('should map %s x %s to %s', (width, height, ratio) => {
        expect(getStableImageAspectRatio(width, height)).toBe(ratio);
    });
});
