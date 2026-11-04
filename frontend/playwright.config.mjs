import { defineConfig } from '@playwright/test';
export default defineConfig({ timeout: 60000, testDir: './tests/browser', use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', channel: 'chromium', launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] }, viewport: { width: 1487, height: 1058 }, deviceScaleFactor: 1 }, workers: 1, reporter: 'list' });
