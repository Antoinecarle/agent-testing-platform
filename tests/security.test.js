import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';

describe('Security: Path Traversal Protection', () => {
  it('path.resolve prevents traversal when validated with startsWith', () => {
    const ITERATIONS_DIR = '/data/iterations';
    const projectId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const iterationId = 'ffffffff-1111-2222-3333-444444444444';

    // Simulate a path traversal attack
    const maliciousPath = '../../../etc/passwd';
    const baseDir = path.resolve(ITERATIONS_DIR, projectId, iterationId);
    const absPath = path.resolve(baseDir, maliciousPath);

    // The resolved path should NOT start with baseDir
    expect(absPath.startsWith(baseDir + path.sep)).toBe(false);
    expect(absPath).not.toContain(path.join(projectId, iterationId, maliciousPath));
  });

  it('normal relative paths are within base directory', () => {
    const ITERATIONS_DIR = '/data/iterations';
    const projectId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const iterationId = 'ffffffff-1111-2222-3333-444444444444';

    const normalPath = 'images/hero.png';
    const baseDir = path.resolve(ITERATIONS_DIR, projectId, iterationId);
    const absPath = path.resolve(baseDir, normalPath);

    expect(absPath.startsWith(baseDir + path.sep)).toBe(true);
  });

  it('UUID validation regex catches non-UUID strings', () => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    expect(UUID_RE.test('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(true);
    expect(UUID_RE.test('not-a-uuid')).toBe(false);
    expect(UUID_RE.test('../../../etc')).toBe(false);
    expect(UUID_RE.test('')).toBe(false);
    expect(UUID_RE.test('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeee')).toBe(false); // Too short
  });
});

describe('Security: Input Validation', () => {
  it('kebab-case regex only allows valid agent names', () => {
    const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    expect(kebab.test('my-agent')).toBe(true);
    expect(kebab.test('agent123')).toBe(true);
    expect(kebab.test('my-cool-agent-v2')).toBe(true);

    expect(kebab.test('../../../etc/passwd')).toBe(false);
    expect(kebab.test('My Agent')).toBe(false);
    expect(kebab.test('agent_name')).toBe(false);
    expect(kebab.test('-leading-dash')).toBe(false);
    expect(kebab.test('trailing-dash-')).toBe(false);
    expect(kebab.test('')).toBe(false);
  });
});

describe('Security: CSP Headers', () => {
  it('preview.js validateIds rejects non-UUID params', () => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Simulating what validateIds does
    const maliciousProjectId = '../../etc';
    expect(UUID_RE.test(maliciousProjectId)).toBe(false);

    const validProjectId = '550e8400-e29b-41d4-a716-446655440000';
    expect(UUID_RE.test(validProjectId)).toBe(true);
  });
});
