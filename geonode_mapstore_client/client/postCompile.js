
const fs = require('fs');
const childProcess = require('child_process');

const packageJSONPath = './package.json';
const rootPackageJSONPath = '../../package.json';

// copy dependencies to root package

const packageJSON = require(packageJSONPath);
const rootPackageJSON = require(rootPackageJSONPath);

const mapStoreCommit = childProcess
    .execSync('git rev-parse @:./MapStore2')
    .toString().trim();

const mapStorePackage = `git+https://github.com/geosolutions-it/MapStore2.git#${mapStoreCommit}`;

rootPackageJSON.dependencies = JSON.parse(JSON.stringify(packageJSON.dependencies));
rootPackageJSON.dependencies.mapstore = mapStorePackage;

fs.writeFileSync(rootPackageJSONPath, JSON.stringify(rootPackageJSON, null, 2), 'utf8');
