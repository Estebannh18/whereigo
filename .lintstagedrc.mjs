// .lintstagedrc.mjs
// Fase Código: antes de cada commit se revisa solo lo que cambió en los dos
// microservicios del ciclo de vida. ESLint corre dentro de su servicio (allí está
// su config); Prettier y Ruff buscan su config junto a cada archivo.
const quoted = (files) => files.map((file) => JSON.stringify(file)).join(' ');

export default {
  'services/auth-service/src/**/*.ts': (files) => [
    `node services/auth-service/node_modules/prettier/bin/prettier.cjs --write ${quoted(files)}`,
    'npm --prefix services/auth-service run lint',
  ],
  'services/ai-service/**/*.py': (files) => `ruff check ${quoted(files)}`,
  'ops/nagios/**/*.py': (files) => `ruff check ${quoted(files)}`,
};
