const fs = require("fs");
const path = require("path");

const routeMapPath = path.join(__dirname, "route_map.json");
const ledgerPath = path.join(
  __dirname,
  "docs",
  "reports",
  "audit_progress_ledger.json",
);

const routeMap = JSON.parse(fs.readFileSync(routeMapPath, "utf8"));

const ledger = routeMap.map((route) => ({
  method: route.method,
  path: route.path,
  tier1: "pending",
  tier2: "pending",
  tier3: "pending",
  state_consistency: "pending",
}));

fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
console.log(`Generated ledger with ${ledger.length} routes.`);
