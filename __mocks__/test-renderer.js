/**
 * Pass-through to the real test-renderer package.
 *
 * test-renderer@1.2.0 exports { createRoot } which is exactly what
 * @testing-library/react-native@14 expects. No bridging needed.
 * Resolving via the CJS build avoids ESM issues in Jest's CommonJS module
 * system.
 */
module.exports = require('../node_modules/test-renderer/dist/index.cjs');
