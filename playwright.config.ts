// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
    // Look for test files in the "tests" directory, relative to this configuration file
    testDir: 'playwright',
    timeout: 60 * 1000,

    webServer: {
        command: 'npm run start',
        url: 'http://localhost:2999/playwright.html',
        timeout: 60 * 1000,
        reuseExistingServer: !process.env.CI,
    },

    use: {
        baseURL: 'http://localhost:2999/playwright.html',
        actionTimeout: 0,
    },
};

export default config;
