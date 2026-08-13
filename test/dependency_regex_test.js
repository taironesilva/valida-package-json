// Testes simples para dependencyVersionRegex
const dependencyVersionRegex = /^(?:\*|(?:(?:\^|>=)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)))$/;

function check(input) {
  return dependencyVersionRegex.test(input);
}

const tests = [
  { v: '*', ok: true },
  { v: '^1.2.3', ok: true },
  { v: '>=1.2.3', ok: true },
  { v: '~1.2.3', ok: false },
  { v: 'latest', ok: false },
  { v: '1.2.3', ok: true },
  { v: '1.2', ok: false },
  { v: '1.2.3-alpha.1', ok: false }
];

let failed = 0;
for (const t of tests) {
  const res = check(t.v);
  const pass = res === t.ok;
  console.log(`${pass ? 'OK ' : 'FAIL'} | ${t.v} -> ${res}`);
  if (!pass) failed++;
}

if (failed > 0) {
  console.error(`\n${failed} test(es) falharam.`);
  process.exit(1);
} else {
  console.log('\nTodos os testes passaram.');
}
