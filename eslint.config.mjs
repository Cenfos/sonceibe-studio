import nextVitals from 'eslint-config-next/core-web-vitals';

export default [
  ...nextVitals,
  { ignores: ['.next/**', 'tests/.generated/**', 'test-results/**', 'next-env.d.ts'] },
];
