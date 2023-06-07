const { mkdir, writeFile } = require('fs/promises')
const path = require('path')

const packageJson = () => `
{
  "name": "appblock-emulator",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "author": "",
  "license": "ISC",
  "dependencies": {
    "express": "^4.17.2",
    "http": "0.0.1-security",
    "cors": "^2.8.5"
  }
}`

const emulatorCode = (port) =>
  `
  import express from "express";
  import http from "http";
  import cors from "cors";
  import executeMiddleware from "./middlewareHandler.js";
  import { getBlock } from "./utils.js";
  
  const appHandler = async (req, res, next) => {
    try {
      let url = req.params[0];
  
      if (url.includes("health")) {
        req.params.health = "health";
        url = url.split("/")[0]
      }
  
      const { block, route } = getBlock(url);
      if (!block) {
        console.log("No block found for url ", url);
        res.send("requested function not registered in app.").status(404);
        res.end();
        return;
      }
  
      console.log("\\nRequest to block ", block.name);

      // Execute middleware functions
      await executeMiddleware(block.middlewares, { req, res, next });
  
      const isDev = process.env.NODE_ENV === "development";
      const importPath = isDev ? route + "?update=" + Date.now() : route;
      const handler = await import(importPath);
  
      console.log("handler: ", handler);
      await handler.default({ req, res, next });
    } catch (err) {
      console.error(err);
      res.send("Something went wrong. Please check function log").status(500);
    }
  };
  
  const app = express();
  app.use(cors());
  app.all("/*", appHandler);
  
  const server = http.createServer(app);
  server.listen(${port});
  console.log("Functions emulated on port ${port}");
  
`.trim()

const generateMiddlewareHandler = () =>
  `
import { getMiddlewareBlock } from "./utils.js";

const executeMiddleware = async (middlewareList, event) => {
  for (const middlewareName of middlewareList) {
    const isDev = process.env.NODE_ENV === "development";
    const { block, route } = getMiddlewareBlock(middlewareName);
    if (!block) {
      console.log("No block found for ", middlewareName);
      continue;
    }

    const importPath = isDev ? route + "?update=" + Date.now() : route;

    const middlewareHandler = await import(importPath);
    await middlewareHandler.default(event);
  }
};

export default executeMiddleware;

`.trim()

const generateUtils = (blockList, middlewareBlockList) =>
  `
import path from "path";

const getBlock = (url) => {
  const blocks = ${JSON.stringify(blockList, null, 2)};

  const block = blocks[url];
  const route = block && path.join(block.directory, "index.js");

  return { route, block };
};

const getMiddlewareBlock = (url) => {
  const blocks = ${JSON.stringify(middlewareBlockList, null, 2)};

  const block = blocks[url];
  const route = block && path.join(block.directory, "index.js");

  return { route, block };
};

export { getBlock, getMiddlewareBlock };

`.trim()

/**
 *
 * @param {import('fs').PathLike} emPath Emulator directory path
 * @returns
 */
async function generateEmFolder(emPath, blockList, port, middlewareBlockList) {
  const res = { err: false, data: '' }
  try {
    await mkdir(emPath, { recursive: true })
    await writeFile(path.join(emPath, '.gitignore'), '._ab_em/*')
    await writeFile(path.join(emPath, 'index.js'), emulatorCode(port))
    await writeFile(path.join(emPath, 'package.json'), packageJson())
    await writeFile(path.join(emPath, 'middlewareHandler.js'), generateMiddlewareHandler())
    await writeFile(path.join(emPath, 'utils.js'), generateUtils(blockList, middlewareBlockList))
    res.data = 'completed'
  } catch (err) {
    res.err = true
    res.data = err.message
  }
  return res
}

module.exports = {
  generateEmFolder,
}
