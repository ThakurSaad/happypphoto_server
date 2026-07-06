const app = require("../src/app");
import fs from "fs";
import path from "path";

const getRoutes = () => {
  const routes: any[] = [];

  const print = (pathStr: string, layer: any) => {
    if (layer.route) {
      layer.route.stack.forEach(print.bind(null, pathStr.concat(split(layer.route.path))));
    } else if (layer.name === "router" && layer.handle.stack) {
      layer.handle.stack.forEach(print.bind(null, pathStr.concat(split(layer.regexp))));
    } else if (layer.method) {
      routes.push({
        method: layer.method.toUpperCase(),
        path: pathStr,
        middlewares: layer.name
      });
    }
  };

  const split = (thing: any) => {
    if (!thing) return "";
    if (typeof thing === "string") {
      return thing;
    } else if (thing.fast_slash) {
      return "";
    } else {
      let match = thing.toString()
        .replace("\\/?", "")
        .replace("(?=\\/|$)", "")
        .match(/^\/\^((?:\\[.*+?^${}()|[\]\\\/]|[^.*+?^${}()|[\]\\\/])*)\$\//);
      return match
        ? match[1].replace(/\\(.)/g, "$1").split("/")
        : "<complex:" + thing.toString() + ">";
    }
  };

  const router = app.router || app._router;
  router.stack.forEach(print.bind(null, "" as any));
  
  // Format paths better
  const formattedRoutes = routes.map(r => {
    let p = typeof r.path === 'string' ? r.path : (Array.isArray(r.path) ? r.path.join('/') : r.path);
    p = p.replace(/\/+/g, '/');
    return {
      method: r.method,
      path: p,
      handler: r.middlewares
    };
  });

  return formattedRoutes;
};

const run = () => {
  const routes = getRoutes();
  const dir = path.join(__dirname, "../docs/reports");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const date = new Date().toISOString().split("T")[0];
  const file = path.join(dir, `route_map_${date}.json`);
  fs.writeFileSync(file, JSON.stringify(routes, null, 2));
  console.log(`Route map saved to ${file}. Discovered ${routes.length} routes.`);
};

run();
