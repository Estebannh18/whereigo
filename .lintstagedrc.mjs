// .lintstagedrc.mjs
// Fase Código: antes de cada commit se revisa solo lo que cambió en los dos
// microservicios del ciclo de vida. Las funciones ignoran la lista de archivos
// porque cada herramienta debe correr dentro de su servicio (allí está su config).
export default {
  'services/auth-service/**/*.ts': () => 'npm --prefix services/auth-service run lint',
  'services/ai-service/**/*.py': (files) => `ruff check ${files.map((file) => JSON.stringify(file)).join(' ')}`,
  'ops/nagios/**/*.py': (files) => `ruff check ${files.map((file) => JSON.stringify(file)).join(' ')}`,
};
