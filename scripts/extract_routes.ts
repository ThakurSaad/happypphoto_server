import fs from "fs";
import app = require("../src/app");
import listEndpoints = require("express-list-endpoints");

const endpoints = listEndpoints(app as any);

const routeMap = endpoints.map((endpoint) => ({
  path: endpoint.path,
  methods: endpoint.methods,
  middlewares: endpoint.middlewares,
}));

fs.writeFileSync("route_map.json", JSON.stringify(routeMap, null, 2));
console.log("route_map.json generated successfully. Found", endpoints.length, "endpoints.");
