import path from 'path';

describe('Metro monorepo configuration', () => {
  const monorepoRoot = path.resolve(__dirname, '../../..');
  const projectRoot = path.resolve(monorepoRoot, 'apps/mobile');
  const config = require('../metro.config.js');

  it('uses the workspace root for entry and HMR resolution', () => {
    expect(config.projectRoot).toBe(projectRoot);
    expect(config.server.unstable_serverRoot).toBe(monorepoRoot);
    expect(config.resolver.nodeModulesPaths).toContain(
      path.resolve(monorepoRoot, 'node_modules'),
    );

    expect(require.resolve('expo-router/entry', { paths: [projectRoot] })).toBe(
      path.resolve(monorepoRoot, 'node_modules/expo-router/entry.js'),
    );
  });

  it('rewrites Expo virtual entry requests relative to the workspace root', () => {
    const rewritten = config.server
      .rewriteRequestUrl(
        '/.expo/.virtual-metro-entry.bundle?platform=android&dev=true&hot=true',
      )
      .replaceAll('\\', '/');

    expect(rewritten).toMatch(/^\/node_modules\/expo-router\/entry\.bundle\?/);
    expect(rewritten).not.toContain('../');
  });
});
