import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { mkdirSync, rmSync } from 'node:fs'

test('CSV and JSON preserve quoted labels, row order, exact numbers and missing values; bad rows are rejected', async () => {
  mkdirSync(new URL('../node_modules/.tmp/', import.meta.url), { recursive: true })
  const compiled = new URL('../node_modules/.tmp/chart-data.mjs', import.meta.url)
  buildSync({ entryPoints: [new URL('../src/WritingChart.tsx', import.meta.url).pathname], outfile: compiled.pathname, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] })
  try {
    const { parseChart } = await import(compiled.href)
    const csv = parseChart('Point,Power,Measured\n"A, first",1.125,\nB,-2.5,3e2\n', 'data.csv')
    assert.deepEqual(csv, { xLabel: 'Point', labels: ['A, first', 'B'], series: [{ name: 'Power', values: [1.125, -2.5] }, { name: 'Measured', values: [null, 300] }] })
    const json = parseChart('[{"Point":"A, first","Power":1.125,"Measured":null},{"Measured":300,"Point":"B","Power":-2.5}]', 'data.json')
    assert.deepEqual(json, csv)
    assert.throws(() => parseChart('Point,Power\nA,12 MW\nB,4', 'data.csv'), /must be a number/)
    assert.throws(() => parseChart('Point,Power\nA,\nB,', 'data.csv'), /at least one value/)
    assert.throws(() => parseChart('Point,Power\nA,12,extra\nB,4', 'data.csv'), /same columns/)
    assert.throws(() => parseChart('[{"Point":"A","Power":2},{"Point":"B","Other":4}]', 'data.json'), /same columns/)
  } finally { rmSync(compiled, { force: true }) }
})
