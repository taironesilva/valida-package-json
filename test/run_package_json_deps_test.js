const fs = require('fs');
const path = require('path');

const dependencyVersionRegex = /^(?:\*|(?:(?:\^|>=)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)))$/;

const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('package.json não encontrado no diretório atual');
  process.exit(2);
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const depTypes = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

let invalid = [];
for (const dt of depTypes) {
  const deps = pkg[dt] || {};
  for (const [name, ver] of Object.entries(deps)) {
    const value = String(ver);
    const ok = dependencyVersionRegex.test(value);
    console.log(`${ok ? 'OK  ' : 'FAIL'} | ${dt} | ${name} -> ${value}`);
    if (!ok) invalid.push(`${dt}: ${name} -> ${value}`);
  }
}

if (invalid.length > 0) {
  console.error('\nDependências inválidas:', invalid.join('; '));
  process.exit(1);
} else {
  console.log('\nTodas as dependências são válidas.');
  process.exit(0);
}
