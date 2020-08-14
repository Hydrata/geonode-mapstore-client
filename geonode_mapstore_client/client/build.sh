#!/bin/bash
set -e

# npx rimraf package-lock.json npm-shrinkwrap.json node_modules
npm update
npm install
npm run compile
npm run lint
