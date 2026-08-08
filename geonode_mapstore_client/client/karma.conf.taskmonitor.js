/**
 * Scoped karma config for the TASKMONITOR suite (TASK-2674, epic 2662 W2.4).
 * Mirrors karma.conf.scenarios.js exactly — inherits all Hydrata performance
 * overrides from karma.conf.single-run.js and only swaps the test entry.
 *
 * Run: npx karma start karma.conf.taskmonitor.js --colors
 * The wave gate is still the FULL `npm run test`; this exists so a red-first
 * cycle on the task-manager truth path costs a minute instead of an hour.
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
const testWebpackPath = path.join(appDirectory, 'tests-taskmonitor-scoped.webpack.js');

module.exports = function karmaConfig(config) {
    const code = [projectJSPath, frameworkPath];

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

    testConfig.webpack.cache = {
        type: 'filesystem',
        cacheDirectory: path.join(appDirectory, 'node_modules', '.cache', 'karma-webpack'),
        buildDependencies: { config: [__filename] }
    };
    testConfig.webpack.output = testConfig.webpack.output || {};
    testConfig.webpack.output.hashFunction = 'sha256';

    testConfig.reporters = testConfig.reporters.filter(r => r !== 'coverage');

    testConfig.customLaunchers = {
        ChromeHeadlessCI: {
            base: 'ChromeHeadless',
            flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
        }
    };
    testConfig.browsers = ['ChromeHeadlessCI'];
    testConfig.browserNoActivityTimeout = 120000;
    testConfig.captureTimeout = 120000;
    testConfig.browserDisconnectTolerance = 2;

    testConfig.plugins = testConfig.plugins.filter(p => {
        if (typeof p === 'string') {
            return !['karma-coveralls', 'karma-junit-reporter', 'karma-firefox-launcher'].includes(p);
        }
        return true;
    });

    testConfig.reportSlowerThan = 500;
    testConfig.webpack.devtool = 'eval-cheap-module-source-map';

    const jsRule = testConfig.webpack.module.rules.find(
        r => r && r.test && r.test.toString() === '/\\.jsx?$/'
    );
    if (jsRule && jsRule.use && jsRule.use[0]) {
        jsRule.use[0].options = Object.assign({}, jsRule.use[0].options, {
            cacheDirectory: true,
            cacheCompression: false,
            targets: { chrome: '120' }
        });
    }

    const webpack = require('webpack');
    testConfig.webpack.plugins = (testConfig.webpack.plugins || []).concat([
        new webpack.IgnorePlugin({ resourceRegExp: /^\.\/locale$/, contextRegExp: /moment$/ }),
        new webpack.IgnorePlugin({ resourceRegExp: /MapStore2[\\/]web[\\/]client[\\/]test-resources[\\/]/ })
    ]);

    config.set(testConfig);
};
