/* Offline static integrity checks; all assets must be bundled for KaiOS. */
const fs = require('fs');
const assert = require('assert');
const vm = require('vm');
const manifest = JSON.parse(fs.readFileSync('manifest.webapp', 'utf8'));
assert.equal(manifest.launch_path, '/index.html');
assert.equal(manifest.type, 'web');
assert.equal(manifest.fullscreen, true);
assert(fs.existsSync('index.html'));
assert(fs.existsSync('style.css'));
assert(fs.existsSync('icons/icon.svg'));
const source = fs.readFileSync('src/game.js', 'utf8');
new vm.Script(source, { filename: 'game.js' });
for (const s of ['localStorage.setItem','bf_slot_','function start(','function mine(','function place(','function craft(','function updateMobs(','function saveSoon(']) assert(source.includes(s), 'Missing: '+s);
assert(!source.includes('fetch('), 'Offline game must not fetch network data');
assert(fs.statSync('src/game.js').size < 100 * 1024, 'Script is too large for target');
console.log('Passed KaiOS manifest and offline game integrity checks');
