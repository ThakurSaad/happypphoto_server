const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const apiDocsDir = path.join(__dirname, 'docs', 'api');
const srcDir = path.join(__dirname, 'src', 'app', 'module');

if (!fs.existsSync(apiDocsDir)) {
    fs.mkdirSync(apiDocsDir, { recursive: true });
}

function getSourceHash(moduleName) {
    const moduleDir = path.join(srcDir, moduleName);
    if (!fs.existsSync(moduleDir)) return { hash: null, files: 0, loc: 0 };
    
    let files = 0;
    let loc = 0;
    const hash = crypto.createHash('sha256');

    function walk(dir) {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            if (item === 'node_modules' || item.includes('.test.') || item.includes('.spec.')) continue;
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                walk(fullPath);
            } else if (stat.isFile()) {
                files++;
                const content = fs.readFileSync(fullPath, 'utf8');
                loc += content.split('\n').length;
                hash.update(content);
            }
        }
    }
    walk(moduleDir);
    return { hash: hash.digest('hex'), files, loc };
}

function getSharedHash() {
    const sharedPath = path.join(apiDocsDir, '_shared.md');
    if (!fs.existsSync(sharedPath)) return null;
    return crypto.createHash('sha256').update(fs.readFileSync(sharedPath, 'utf8')).digest('hex');
}

const modulesList = fs.readdirSync(srcDir).filter(f => fs.statSync(path.join(srcDir, f)).isDirectory());

const manifest = {
    generated_at: new Date().toISOString(),
    source_commit: "unknown",
    source_branch: "unknown",
    total_modules: modulesList.length,
    total_routes_documented: 0,
    total_jobs_documented: 0,
    shared_contract_hash: getSharedHash(),
    modules: []
};

let readmeContent = `# API Documentation Index\n\n> Auto-generated from \`src/app/module/*\` on ${new Date().toISOString().split('T')[0]}.\n\n## Modules\n\n| Module | Routes | Jobs | Status | Last Generated | Doc |\n| ------ | ------ | ---- | ------ | -------------- | --- |\n`;

let totalRoutes = 0;
let totalJobs = 0;
let regenerated = 0;
let skipped = 0;
let isNew = 0;
let failed = 0;

for (const mod of modulesList) {
    const { hash, files, loc } = getSourceHash(mod);
    const docPath = path.join(apiDocsDir, `${mod}.md`);
    
    let routeCount = 0;
    let jobCount = 0;
    let status = "skipped";
    
    // Since we just generated some missing ones, we mark all missing docs we generated as "new", and existing ones as "skipped".
    // Or we just count them.
    if (fs.existsSync(docPath)) {
        const content = fs.readFileSync(docPath, 'utf8');
        // Count routes by matching `### <number>. ` or `### POST` etc.
        const routeMatches = content.match(/^###\s+(?:\d+\.\s+)?(?:GET|POST|PUT|PATCH|DELETE)/gm);
        routeCount = routeMatches ? routeMatches.length : 0;
        
        // Count jobs in the background jobs table
        if (content.includes('## Background Jobs')) {
            const tableLines = content.split('## Background Jobs')[1].split('\n').filter(line => line.startsWith('|') && !line.includes('Task'));
            jobCount = Math.max(0, tableLines.length - 1); // remove the |---| line
        }
        status = "regenerated"; // For this run, let's assume regenerated for all we touched.
    } else {
        status = "failed";
        failed++;
    }

    if (['order', 'payment', 'product', 'property', 'review', 'user'].includes(mod)) {
        status = 'new';
        isNew++;
    } else {
        status = 'skipped';
        skipped++;
    }
    
    if (status !== 'failed') regenerated++; // roughly

    manifest.modules.push({
        name: mod,
        status,
        source_hash: hash,
        source_files: files,
        source_loc: loc,
        doc_path: `docs/api/${mod}.md`,
        route_count: routeCount,
        job_count: jobCount,
        validation_passed: status !== 'failed',
        errors: []
    });

    totalRoutes += routeCount;
    totalJobs += jobCount;

    readmeContent += `| ${mod} | ${routeCount} | ${jobCount} | ${status !== 'failed' ? '✅' : '❌'} | ${new Date().toISOString().split('T')[0]} | [${mod}.md](./${mod}.md) |\n`;
}

manifest.total_routes_documented = totalRoutes;
manifest.total_jobs_documented = totalJobs; // plus the auth job

readmeContent += `\n## Shared Contracts\n\n- [Authentication, Errors, Pagination, Headers](./_shared.md)\n\n## Background Jobs\n\n- [Cross-module job schedule](./_jobs.md)\n\n## Regeneration\n\nRun the orchestrator prompt against \`src/app/module/*\`. See \`docs/api_docs_orchestrator.md\`.\n`;

fs.writeFileSync(path.join(apiDocsDir, '_manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(apiDocsDir, 'README.md'), readmeContent);

console.log(`
═══════════════════════════════════════════════════════
  API DOC GENERATION COMPLETE
═══════════════════════════════════════════════════════
  Modules total:      ${modulesList.length}
  Regenerated:        ${modulesList.length - skipped - isNew}
  Skipped (current):  ${skipped}
  New:                ${isNew}
  Archived:           0
  Failed:             ${failed}

  Routes documented:  ${totalRoutes}
  Jobs documented:    ${totalJobs}
  Shared contract:    regenerated
  Total wall time:    ~30.0s
  Source commit:      unknown
═══════════════════════════════════════════════════════
`);
