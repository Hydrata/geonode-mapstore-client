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
    process.env.BABEL_ENV = 'test';

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

    config.set(testConfig);
};
