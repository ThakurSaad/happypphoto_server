const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/app/module');
const routeMap = [];

const routePattern = /\.(get|post|patch|put|delete)\(\s*(["'][^"']+["'])/g;

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (file.endsWith('.routes.ts')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const moduleName = file.replace('.routes.ts', '');
            let match;
            while ((match = routePattern.exec(content)) !== null) {
                const method = match[1].toUpperCase();
                const routePath = match[2].replace(/['"]/g, '');
                const fullRoutePath = `/${moduleName}${routePath === '/' ? '' : routePath}`;
                routeMap.push({
                    method,
                    path: fullRoutePath,
                    file: fullPath
                });
            }
        }
    }
}

walkDir(routesDir);

fs.writeFileSync(path.join(__dirname, '../route_map.json'), JSON.stringify(routeMap, null, 2), 'utf8');
console.log(`Generated route_map.json with ${routeMap.length} endpoints.`);
