function isInt(value) {
    return !isNaN(value) && (function(x) { return (x | 0) === x; })(parseFloat(value));
}

function formatMoney(amount, decimalCount = 2, decimal = ".", thousands = ",") {
    try {
        decimalCount = Math.abs(decimalCount);
        decimalCount = isNaN(decimalCount) ? 2 : decimalCount;

        const negativeSign = amount < 0 ? "-" : "";

        let i = parseInt(amount = Math.abs(Number(amount) || 0).toFixed(decimalCount)).toString();
        let j = (i.length > 3) ? i.length % 3 : 0;

        return negativeSign + (j ? i.substr(0, j) + thousands : '') + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thousands) + (decimalCount ? decimal + Math.abs(amount - i).toFixed(decimalCount).slice(2) : "");
    } catch (e) {
        console.error(e);
    }
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function exportSummaryCSV(speedDialData) {
    const rows = [
        ['Metric', 'Phosphorus', 'Nitrogen', 'Sediment', 'Units'],
        ['Current total untreated pollutant volume', speedDialData.currentPhosphorusLoad, speedDialData.currentNitrogenLoad, speedDialData.currentSedimentLoad, 'units/year'],
        ['Selected target reduction percentage', (speedDialData.percentPhosphorusReductionTarget * 100).toFixed(0), (speedDialData.percentNitrogenReductionTarget * 100).toFixed(0), (speedDialData.percentSedimentReductionTarget * 100).toFixed(0), '% of total'],
        ['Selected target load reduction required', speedDialData.targetPhosphorusLoadReductionRequired, speedDialData.targetNitrogenLoadReductionRequired, speedDialData.targetSedimentLoadReductionRequired, 'units/year'],
        ['Actual pollutant reduction from BMPs', speedDialData.totalBmpPhosphorusReduction, speedDialData.totalBmpNitrogenReduction, speedDialData.totalBmpSedimentReduction, 'units/year'],
        ['Percentage of target achieved', speedDialData.percentPhosphorusTarget?.[0]?.value || 0, speedDialData.percentNitrogenTarget?.[0]?.value || 0, speedDialData.percentSedimentTarget?.[0]?.value || 0, '%']
    ];
    return rows.map(r => r.join(',')).join('\n');
}

function formatCurrency(value) {
    return value ? '$' + formatMoney(value, 0) : '\u2014';
}

export {
    isInt,
    formatMoney,
    capitalizeFirstLetter,
    exportSummaryCSV,
    formatCurrency
};
