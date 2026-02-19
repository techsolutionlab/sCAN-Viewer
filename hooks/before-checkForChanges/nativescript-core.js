/**
 * Adapter for @nativescript/core v9 which changed this hook from CommonJS
 * (.js) to an ES module (.mjs).  Dynamic import() bridges the gap because
 * CommonJS cannot synchronously require() an ES module.
 */
module.exports = async function ($staticConfig, hookArgs) {
  const { default: hook } = await import('@nativescript/core/cli-hooks/before-checkForChanges.mjs');
  return hook($staticConfig, hookArgs);
};
