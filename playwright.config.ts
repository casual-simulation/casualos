// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
    // Look for test files in the "tests" directory, relative to this configuration file
    testDir: 'playwright',
    timeout: !process.env.CI ? 60 * 1000 : 10 * 1000,

    // forbit test.only() on CI
    forbidOnly: !!process.env.CI,

    // Retry tests twice on CI
    retries: !process.env.CI ? 1 : 2,

    webServer: {
        command: 'npx http-server ./src/aux-server/aux-web/dist --port 2999',
        url: 'http://localhost:2999/playwright.html',
        timeout: 60 * 1000,
        reuseExistingServer: !process.env.CI,
    },

    use: {
        baseURL: 'http://localhost:2999/playwright.html',
        actionTimeout: 0,
        trace: !process.env.CI ? 'on-first-retry' : 'off',
    },
};

export default config;
