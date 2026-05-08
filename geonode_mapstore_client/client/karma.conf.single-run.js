/**
 * Custom Karma config for Hydrata geonode-mapstore-client.
 *
 * Wraps the upstream @mapstore/project config with two performance fixes:
 *   1. Webpack filesystem cache — cuts repeat-run compilation from ~3-5 min to ~30-60s
 *   2. hashFunction: sha256 — required for Node >= 17
 *
 * Used by `npm test` (see package.json override).
 * Upstream Karma config: node_modules/@mapstore/project/types/standard/config/karma.conf.single-run.js
 */
const path = require('path');
const fs = require('fs');
const appDirectory = fs.realpathSync(process.cwd());
const mapStorePath = fs.realpathSync(path.join(appDirectory, 'node_modules', 'mapstore'));

const getTestConfig = require(
    path.join(appDirectory, 'node_modules', '@mapstore', 'project', 'types', 'standard', 'config', 'testConfig.js')
);

const frameworkPath = path.join(mapStorePath, 'web', 'client');
const projectJSPath = path.join(appDirectory, 'js');
const testWebpackPath = path.join(
    appDirectory, 'node_modules', '@mapstore', 'project', 'types', 'standard', 'config', 'tests-travis.webpack.js'
);

module.exports = function karmaConfig(config) {
    const code = [projectJSPath, frameworkPath];
    // Coverage instrumentation is opt-in: BABEL_ENV='test' triggers the
    // env.test.plugins=['istanbul'] block in MapStore2/build/babel.config.js.
    // Default `npm test` skips it (-25 to -45% runtime, no ~18MB coverage HTML).
    //
    // CONTRACT: depends on MapStore2/build/babel.config.js exposing
    // env.test.plugins=['istanbul']. If that block moves upstream, this gate
    // becomes a silent no-op — the assert in step 3 below will catch it
    // when COVERAGE=1 is set.
    if (process.env.COVERAGE === '1') {
        process.env.BABEL_ENV = 'test';
    }

    const testConfig = getTestConfig({
        files: [testWebpackPath],
        path: code,
        basePath: appDirectory,
        testFile: testWebpackPath,
        singleRun: true,
        alias: {
            '@js': projectJSPath,
            '@mapstore/framework': frameworkPath
        }
    });

    // --- Hydrata performance overrides ---

    // 1. Webpack filesystem cache: persist compiled modules between runs.
    //    First run is the same speed; subsequent runs skip unchanged modules (~60-70% faster).
    testConfig.webpack.cache = {
        type: 'filesystem',
        cacheDirectory: path.join(appDirectory, 'node_modules', '.cache', 'karma-webpack'),
        buildDependencies: {
            config: [__filename]
        }
    };

    // 2. Ensure sha256 hash function (required for Node >= 17).
    testConfig.webpack.output = testConfig.webpack.output || {};
    testConfig.webpack.output.hashFunction = 'sha256';

    // 3. Drop the 'coverage' reporter when not running with COVERAGE=1.
    if (process.env.COVERAGE !== '1') {
        testConfig.reporters = testConfig.reporters.filter(r => r !== 'coverage');
    }

    // 3a. Tripwire: if COVERAGE=1 was requested but the upstream config no
    //     longer ships a 'coverage' reporter, fail loud rather than silently
    //     producing zero-coverage output. Catches future drift in the
    //     @mapstore/project testConfig contract.
    if (process.env.COVERAGE === '1' && !testConfig.reporters.includes('coverage')) {
        throw new Error("COVERAGE=1 set but 'coverage' reporter missing from testConfig — check @mapstore/project testConfig.js and MapStore2/build/babel.config.js env.test.plugins.");
    }

    config.set(testConfig);
};
