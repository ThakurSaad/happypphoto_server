import os
import re
import json

routes_dir = 'src/app/module'
route_map = []

# regex to find route definitions like: .get("/path", middleware1, middleware2, controller.method)
route_pattern = re.compile(r'\.(get|post|patch|put|delete)\(\s*(["\'][^"\']+["\'])')

for root, _, files in os.walk(routes_dir):
    for file in files:
        if file.endswith('.routes.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                matches = route_pattern.findall(content)
                module_name = file.replace('.routes.ts', '')
                for method, route_path in matches:
                    route_path = route_path.strip('\'"')
                    full_path = f"/{module_name}{route_path}"
                    route_map.append({
                        "method": method.upper(),
                        "path": full_path,
                        "file": path
                    })

with open('route_map.json', 'w', encoding='utf-8') as f:
    json.dump(route_map, f, indent=2)

print(f"Generated route_map.json with {len(route_map)} endpoints.")
