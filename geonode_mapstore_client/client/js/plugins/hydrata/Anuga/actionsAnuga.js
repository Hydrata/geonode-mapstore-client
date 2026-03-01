// Barrel re-export (CommonJS) — all action constants and creators
module.exports = Object.assign({},
    require('./actions/uiActions'),
    require('./actions/dataActions'),
    require('./actions/scenarioActions'),
    require('./actions/pollingActions'),
    require('./actions/comparisonActions')
);
