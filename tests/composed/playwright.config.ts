import { createAppPlaywrightConfig } from "../shared/playwright-app.config";

export default createAppPlaywrightConfig({ port: 4180, timeout: 240_000 });
