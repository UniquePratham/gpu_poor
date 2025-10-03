#!/usr/bin/env node
// Wrapper to start react-scripts and filter known dev-server deprecation warnings
const { spawn } = require('child_process');

function filterLines(chunk) {
    const str = chunk.toString();
    return str
        .split(/\r?\n/)
        .filter(line => !/onAfterSetupMiddleware|onBeforeSetupMiddleware/.test(line))
        .join('\n');
}

let reactStartPath;
try {
    // Resolve the installed react-scripts start script directly
    reactStartPath = require.resolve('react-scripts/scripts/start.js');
} catch (err) {
    console.error('react-scripts not found. Please run npm install.');
    process.exit(1);
}

const child = spawn(process.execPath, [reactStartPath], { stdio: ['inherit', 'pipe', 'pipe'], cwd: process.cwd() });

child.stdout.on('data', (chunk) => {
    const out = filterLines(chunk);
    if (out) process.stdout.write(out + '\n');
});

child.stderr.on('data', (chunk) => {
    const out = filterLines(chunk);
    if (out) process.stderr.write(out + '\n');
});

child.on('close', (code) => {
    process.exit(code);
});
