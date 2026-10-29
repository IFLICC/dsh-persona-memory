import test from 'node:test'
import assert from 'node:assert/strict'
import { compareSemver, isNewerVersion } from '../lib/version.js'

test('compares version numbers', () => {
  assert.equal(compareSemver('0.6.1', '0.6.0'), 1)
  assert.equal(compareSemver('0.6.0', '0.6.1'), -1)
  assert.equal(compareSemver('0.10.0', '0.9.9'), 1)
  assert.equal(compareSemver('v0.6.0', '0.6.0'), 0)
  assert.equal(compareSemver('1.0.0', '1.0.0'), 0)
})

test('stable releases sort above prereleases', () => {
  assert.equal(compareSemver('1.0.0', '1.0.0-rc.1'), 1)
  assert.equal(compareSemver('1.0.0-rc.2', '1.0.0-rc.1'), 1)
  assert.equal(compareSemver('1.0.0-rc.1', '1.0.0'), -1)
})

test('isNewerVersion only reports genuinely newer versions', () => {
  assert.equal(isNewerVersion('0.6.1', '0.6.0'), true)
  assert.equal(isNewerVersion('0.6.0', '0.6.0'), false)
  assert.equal(isNewerVersion('0.5.9', '0.6.0'), false)
})
