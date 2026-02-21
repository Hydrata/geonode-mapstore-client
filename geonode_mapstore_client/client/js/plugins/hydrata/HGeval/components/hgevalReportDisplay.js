import React from 'react';
import Message from '@mapstore/framework/components/I18N/Message';

const DataRow = ({ label, value, fallback }) => (
    <tr>
        <td className="hgeval-label">{label}</td>
        <td className="hgeval-value">{value || fallback || <Message msgId="hydrata.hgeval.dataNotAvailable" />}</td>
    </tr>
);

function downloadReport(coordinates, form, reportData, rasterValues, warnings) {
    const admin1 = reportData['geonode:admin_level_1'];
    const admin2 = reportData['geonode:admin_level_2'];
    const gwPotential = reportData['geonode:groundwater_potential_01'];
    const permeability = reportData['geonode:permeability_03'];
    const hydroEnv = reportData['geonode:hydrogeological_environments_01'];
    const landform = reportData['geonode:landform_01'];
    const geology = reportData['geonode:master_geology_01'];
    const island = reportData['geonode:islands_01'];

    const val = (v) => v || 'Data not available';
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const warningsHtml = warnings.length > 0
        ? '<h2>Warnings (' + warnings.length + ')</h2>' + warnings.map(w => '<div class="warning">\u26A0 ' + w + '</div>').join('')
        : '';

    const html = '<!DOCTYPE html>\n<html><head>\n<meta charset="utf-8">\n'
        + '<title>HGeval Report - ' + (form?.name || 'Untitled') + '</title>\n'
        + '<style>\n'
        + 'body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }\n'
        + 'h1 { color: #2c3e50; border-bottom: 3px solid #337ab7; padding-bottom: 10px; }\n'
        + 'h2 { color: #337ab7; margin-top: 28px; border-bottom: 1px solid #337ab7; padding-bottom: 4px; }\n'
        + 'table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }\n'
        + 'td { padding: 8px 12px; border-bottom: 1px solid #eee; vertical-align: top; }\n'
        + 'td:first-child { font-weight: bold; width: 40%; color: #555; }\n'
        + '.warning { background: #fcf8e3; border-left: 4px solid #f0ad4e; padding: 10px 14px; margin-bottom: 8px; border-radius: 0 4px 4px 0; }\n'
        + '.disclaimer { background: #f5f5f5; padding: 16px; border-radius: 4px; margin-top: 28px; }\n'
        + '.disclaimer h2 { color: #999; border-color: #ddd; }\n'
        + '.disclaimer p { color: #777; font-style: italic; line-height: 1.5; }\n'
        + '.meta { color: #999; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 8px; }\n'
        + '@media print { body { padding: 0; } .warning { break-inside: avoid; } }\n'
        + '</style>\n</head><body>\n'
        + '<h1>Hydrogeological Evaluation Report</h1>\n'
        + '<p><strong>Project:</strong> ' + (form?.name || 'Untitled') + '</p>\n'
        + '<p><strong>Description:</strong> ' + (form?.description || '') + '</p>\n'
        + '<p><strong>Sector:</strong> ' + (form?.sector || '') + '</p>\n'
        + '<h2>Location</h2>\n<table>\n'
        + '<tr><td>Latitude</td><td>' + (coordinates?.lat?.toFixed(6) || '') + '\u00B0</td></tr>\n'
        + '<tr><td>Longitude</td><td>' + (coordinates?.lon?.toFixed(6) || '') + '\u00B0</td></tr>\n'
        + '<tr><td>Department</td><td>' + val(admin1?.NAME_1) + '</td></tr>\n'
        + '<tr><td>Municipality</td><td>' + val(admin2?.NAME_2) + '</td></tr>\n'
        + '<tr><td>Elevation</td><td>' + (rasterValues?.elevation != null ? rasterValues.elevation + ' m' : 'Data not available') + '</td></tr>\n'
        + (island?.OBJECTID != null ? '<tr><td>Island</td><td>' + (island?.name || 'Yes') + '</td></tr>\n' : '')
        + '</table>\n'
        + '<h2>Groundwater Assessment</h2>\n<table>\n'
        + '<tr><td>Groundwater Potential</td><td>' + val(gwPotential?.EN_GWpot_D) + '</td></tr>\n'
        + '<tr><td>Permeability</td><td>' + val(permeability?.EN_PrmDesc) + '</td></tr>\n'
        + '<tr><td>Hydrogeological Environment</td><td>' + val(hydroEnv?.EN_Hyd_Env) + '</td></tr>\n'
        + '<tr><td>Landform</td><td>' + val(landform?.Lnd_Desc) + '</td></tr>\n'
        + '<tr><td>Geology</td><td>' + val(geology?.EN_Desc) + '</td></tr>\n'
        + '<tr><td>Aquifer Type</td><td>' + val(geology?.EN_Hyd_Env) + '</td></tr>\n'
        + '</table>\n'
        + '<h2>Rainfall</h2>\n<table>\n'
        + '<tr><td>Annual Precipitation</td><td>' + (rasterValues?.precip_annual != null ? rasterValues.precip_annual + ' mm' : 'Data not available') + '</td></tr>\n'
        + '<tr><td>Driest Quarter Precipitation</td><td>' + (rasterValues?.precip_driest_quarter != null ? rasterValues.precip_driest_quarter + ' mm' : 'Data not available') + '</td></tr>\n'
        + '</table>\n'
        + warningsHtml
        + '<div class="disclaimer">\n<h2>Disclaimer</h2>\n'
        + '<p>This report is generated from automated spatial analysis and should be considered '
        + 'preliminary. The data presented is derived from regional-scale datasets and may not '
        + 'reflect local conditions. A professional hydrogeological assessment is recommended '
        + 'before making investment decisions based on this information.</p>\n</div>\n'
        + '<div class="meta">Generated ' + date + ' by HGeval &mdash; nicaraguahydroportal.com</div>\n'
        + '</body></html>';

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'HGeval-Report-' + (form?.name || 'Untitled').replace(/[^a-zA-Z0-9]/g, '-') + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

const HGevalReportDisplay = ({
    coordinates, form, reportData, rasterValues, warnings,
    savedReport, onSave, onNewReport, onUpdateForm
}) => {
    const admin1 = reportData['geonode:admin_level_1'];
    const admin2 = reportData['geonode:admin_level_2'];
    const gwPotential = reportData['geonode:groundwater_potential_01'];
    const permeability = reportData['geonode:permeability_03'];
    const hydroEnv = reportData['geonode:hydrogeological_environments_01'];
    const landform = reportData['geonode:landform_01'];
    const geology = reportData['geonode:master_geology_01'];
    const island = reportData['geonode:islands_01'];

    const hasContact = !!(form?.contact_email || form?.contact_phone_number);

    const handleSaveAndDownload = () => {
        onSave();
        downloadReport(coordinates, form, reportData, rasterValues, warnings);
    };

    const handleDownload = () => {
        downloadReport(coordinates, form, reportData, rasterValues, warnings);
    };

    return (
        <div className="hgeval-report">
            <h4><Message msgId="hydrata.hgeval.evaluationReport" /></h4>
            <p className="hgeval-project-name"><strong>{form?.name}</strong></p>

            <section className="hgeval-section">
                <h5><Message msgId="hydrata.hgeval.locationSection" /></h5>
                <table className="table table-condensed">
                    <tbody>
                        <DataRow label={<Message msgId="hydrata.hgeval.latitude" />} value={coordinates?.lat?.toFixed(6) + '\u00B0'} />
                        <DataRow label={<Message msgId="hydrata.hgeval.longitude" />} value={coordinates?.lon?.toFixed(6) + '\u00B0'} />
                        <DataRow label={<Message msgId="hydrata.hgeval.department" />} value={admin1?.NAME_1} />
                        <DataRow label={<Message msgId="hydrata.hgeval.municipality" />} value={admin2?.NAME_2} />
                        <DataRow label={<Message msgId="hydrata.hgeval.elevation" />} value={
                            rasterValues?.elevation != null
                                ? `${rasterValues.elevation} m`
                                : null
                        } />
                        {island?.OBJECTID != null && (
                            <DataRow label={<Message msgId="hydrata.hgeval.island" />} value={island?.name || 'Yes'} />
                        )}
                    </tbody>
                </table>
            </section>

            <section className="hgeval-section">
                <h5><Message msgId="hydrata.hgeval.groundwaterAssessment" /></h5>
                <table className="table table-condensed">
                    <tbody>
                        <DataRow label={<Message msgId="hydrata.hgeval.groundwaterPotential" />} value={gwPotential?.EN_GWpot_D} />
                        <DataRow label={<Message msgId="hydrata.hgeval.permeability" />} value={permeability?.EN_PrmDesc} />
                        <DataRow label={<Message msgId="hydrata.hgeval.hydrogeologicalEnvironment" />} value={hydroEnv?.EN_Hyd_Env} />
                        <DataRow label={<Message msgId="hydrata.hgeval.landform" />} value={landform?.Lnd_Desc} />
                        <DataRow label={<Message msgId="hydrata.hgeval.geology" />} value={geology?.EN_Desc} />
                        <DataRow label={<Message msgId="hydrata.hgeval.aquiferType" />} value={geology?.EN_Hyd_Env} />
                    </tbody>
                </table>
            </section>

            <section className="hgeval-section">
                <h5><Message msgId="hydrata.hgeval.rainfall" /></h5>
                <table className="table table-condensed">
                    <tbody>
                        <DataRow label={<Message msgId="hydrata.hgeval.annualPrecipitation" />} value={
                            rasterValues?.precip_annual != null
                                ? `${rasterValues.precip_annual} mm`
                                : null
                        } />
                        <DataRow label={<Message msgId="hydrata.hgeval.driestQuarterPrecipitation" />} value={
                            rasterValues?.precip_driest_quarter != null
                                ? `${rasterValues.precip_driest_quarter} mm`
                                : null
                        } />
                    </tbody>
                </table>
            </section>

            {warnings.length > 0 && (
                <section className="hgeval-section hgeval-warnings">
                    <h5><Message msgId="hydrata.hgeval.warnings" /> ({warnings.length})</h5>
                    <ul className="list-group">
                        {warnings.map((w, i) => (
                            <li key={i} className="list-group-item list-group-item-warning">
                                <span className="glyphicon glyphicon-alert" /> {w}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="hgeval-section hgeval-disclaimer">
                <h5><Message msgId="hydrata.hgeval.disclaimer" /></h5>
                <p>
                    <Message msgId="hydrata.hgeval.disclaimerText" />
                </p>
            </section>

            {!hasContact && (
                <div className="hgeval-contact-prompt">
                    <p><Message msgId="hydrata.hgeval.enterContactToDownload" /></p>
                    <div className="hgeval-contact-row">
                        <input
                            type="email"
                            className="form-control input-sm"
                            placeholder="Email"
                            value={form?.contact_email || ''}
                            onChange={(e) => onUpdateForm('contact_email', e.target.value)}
                        />
                        <span className="hgeval-contact-or"><Message msgId="hydrata.hgeval.or" /></span>
                        <input
                            type="tel"
                            className="form-control input-sm"
                            placeholder="Phone"
                            value={form?.contact_phone_number || ''}
                            onChange={(e) => onUpdateForm('contact_phone_number', e.target.value)}
                        />
                    </div>
                </div>
            )}

            <div className="hgeval-actions">
                <button className="btn btn-default btn-sm" onClick={onNewReport}>
                    <Message msgId="hydrata.hgeval.newEvaluation" />
                </button>
                {!savedReport ? (
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveAndDownload}
                        disabled={!hasContact}
                        title={hasContact ? '' : 'Enter email or phone to enable'}
                    >
                        <span className="glyphicon glyphicon-download-alt" /> <Message msgId="hydrata.hgeval.saveAndDownload" />
                    </button>
                ) : (
                    <div className="hgeval-saved-actions">
                        <span className="text-success">
                            <span className="glyphicon glyphicon-ok" /> <Message msgId="hydrata.hgeval.saved" />
                        </span>
                        <button className="btn btn-default btn-sm" onClick={handleDownload}>
                            <span className="glyphicon glyphicon-download-alt" /> <Message msgId="hydrata.hgeval.download" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HGevalReportDisplay;
