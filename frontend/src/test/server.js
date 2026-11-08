import { setupServer } from "msw/node";

/** 各測試用 server.use(api.get(...)) 加上自己需要的 handler */
export const server = setupServer();
