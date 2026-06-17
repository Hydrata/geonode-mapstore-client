import React from 'react';
import PropTypes from 'prop-types';
import Message from '@mapstore/framework/components/I18N/Message';
import { getMessageById } from '@mapstore/framework/utils/LocaleUtils';
import { Section, Table, Card } from '../../SimpleView/components/primitives';
import HGevalSignupForm from './hgevalSignupForm';

const DataRow = ({ label, value, fallback }) => (
    <tr>
        <td className="sv-hgeval-label" style={{ fontWeight: 'bold', width: '45%', padding: '3px 6px', color: 'var(--sv-text-dim, rgba(255, 255, 255, 0.68))', borderBottom: '1px solid var(--sv-section-border, rgba(255, 255, 255, 0.6))' }}>{label}</td>
        <td className="sv-hgeval-value" style={{ padding: '3px 6px', color: 'var(--sv-text, rgba(255, 255, 255, 0.85))', borderBottom: '1px solid var(--sv-section-border, rgba(255, 255, 255, 0.6))' }}>{value || fallback || <Message msgId="hydrata.hgeval.dataNotAvailable" />}</td>
    </tr>
);

export function downloadReport(coordinates, form, reportData, rasterValues, warnings, mapImageDataUrl) {
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
        + '.map-image { width: 100%; max-width: 600px; border: 1px solid #ddd; border-radius: 4px; margin: 8px 0 16px; display: block; }\n'
        + '.map-caption { font-size: 11px; color: #999; margin: -12px 0 16px; }\n'
        + '.meta { color: #999; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 8px; }\n'
        + '@media print { body { padding: 0; } .warning { break-inside: avoid; } }\n'
        + '</style>\n</head><body>\n'
        + '<h1>Hydrogeological Evaluation Report</h1>\n'
        + '<p><strong>Project:</strong> ' + (form?.name || 'Untitled') + '</p>\n'
        + '<p><strong>Description:</strong> ' + (form?.description || '') + '</p>\n'
        + '<p><strong>Sector:</strong> ' + (form?.sector || '') + '</p>\n'
        + '<h2>Location</h2>\n'
        + (mapImageDataUrl
            ? '<img class="map-image" src="' + mapImageDataUrl + '" alt="Location map" />\n'
              + '<p class="map-caption">Map data &copy; MapTiler / OpenStreetMap contributors</p>\n'
            : '')
        + '<table>\n'
        + '<tr><td>Latitude</td><td>' + (coordinates?.lat?.toFixed(6) || '') + '\u00B0</td></tr>\n'
        + '<tr><td>Longitude</td><td>' + (coordinates?.lon?.toFixed(6) || '') + '\u00B0</td></tr>\n'
        + '<tr><td>Department</td><td>' + val(admin1?.NAME_1) + '</td></tr>\n'
        + '<tr><td>Municipality</td><td>' + val(admin2?.NAME_2) + '</td></tr>\n'
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        + '<tr><td>Elevation</td><td>' + (rasterValues?.elevation != null ? rasterValues.elevation + ' m' : 'Data not available') + '</td></tr>\n'
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
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
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
        + '<tr><td>Annual Precipitation</td><td>' + (rasterValues?.precip_annual != null ? rasterValues.precip_annual + ' mm' : 'Data not available') + '</td></tr>\n'
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
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
    savedReport, isLoggedIn, signupErrors, signingUp,
    loginErrors, loggingIn, mapImageDataUrl: _mapImageDataUrl,
    onSave, onSignupAndSave, onLoginAndSave, onNewReport, onUpdateForm
}, context) => {
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
        // PDF will be available after save via savedReport.id
    };

    const handleDownloadPdf = () => {
        if (savedReport?.id) {
            window.open(`/nicp/print/${savedReport.id}/download/`, '_blank');
        }
    };

    return (
        <div className="sv-hgeval-report" style={{ textAlign: 'left' }}>
            <h4 style={{ fontSize: '14px', color: 'var(--sv-text, rgba(255, 255, 255, 0.85))', marginBottom: '2px' }}>
                <Message msgId="hydrata.hgeval.evaluationReport" />
            </h4>
            <p className="sv-hgeval-project-name" style={{ fontSize: '13px', marginBottom: '10px', color: 'var(--sv-text-dim, rgba(255, 255, 255, 0.68))' }}><strong>{form?.name}</strong></p>

            <Section title={<Message msgId="hydrata.hgeval.locationSection" />}>
                <Table surface="dark">
                    <tbody>
                        <DataRow label={<Message msgId="hydrata.hgeval.latitude" />} value={coordinates?.lat?.toFixed(6) + '\u00B0'} />
                        <DataRow label={<Message msgId="hydrata.hgeval.longitude" />} value={coordinates?.lon?.toFixed(6) + '\u00B0'} />
                        <DataRow label={<Message msgId="hydrata.hgeval.department" />} value={admin1?.NAME_1} />
                        <DataRow label={<Message msgId="hydrata.hgeval.municipality" />} value={admin2?.NAME_2} />
                        <DataRow label={<Message msgId="hydrata.hgeval.elevation" />} value={
                            // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
                            rasterValues?.elevation != null
                                ? `${rasterValues.elevation} m`
                                : null
                        } />
                        {/* eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom */}
                        {island?.OBJECTID != null && (
                            <DataRow label={<Message msgId="hydrata.hgeval.island" />} value={island?.name || 'Yes'} />
                        )}
                    </tbody>
                </Table>
            </Section>

            <Section title={<Message msgId="hydrata.hgeval.groundwaterAssessment" />}>
                <Table surface="dark">
                    <tbody>
                        <DataRow label={<Message msgId="hydrata.hgeval.groundwaterPotential" />} value={gwPotential?.EN_GWpot_D} />
                        <DataRow label={<Message msgId="hydrata.hgeval.permeability" />} value={permeability?.EN_PrmDesc} />
                        <DataRow label={<Message msgId="hydrata.hgeval.hydrogeologicalEnvironment" />} value={hydroEnv?.EN_Hyd_Env} />
                        <DataRow label={<Message msgId="hydrata.hgeval.landform" />} value={landform?.Lnd_Desc} />
                        <DataRow label={<Message msgId="hydrata.hgeval.geology" />} value={geology?.EN_Desc} />
                        <DataRow label={<Message msgId="hydrata.hgeval.aquiferType" />} value={geology?.EN_Hyd_Env} />
                    </tbody>
                </Table>
            </Section>

            <Section title={<Message msgId="hydrata.hgeval.rainfall" />}>
                <Table surface="dark">
                    <tbody>
                        <DataRow label={<Message msgId="hydrata.hgeval.annualPrecipitation" />} value={
                            // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
                            rasterValues?.precip_annual != null
                                ? `${rasterValues.precip_annual} mm`
                                : null
                        } />
                        <DataRow label={<Message msgId="hydrata.hgeval.driestQuarterPrecipitation" />} value={
                            // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
                            rasterValues?.precip_driest_quarter != null
                                ? `${rasterValues.precip_driest_quarter} mm`
                                : null
                        } />
                    </tbody>
                </Table>
            </Section>

            {warnings.length > 0 && (
                <Section title={<span><Message msgId="hydrata.hgeval.warnings" /> ({warnings.length})</span>} extraClassName="sv-hgeval-warnings">
                    {/* Icon-prefixed warning list has no chassis-primitive equivalent
                        (ErrorStrip is a single-message strip). Kept as bespoke list markup,
                        themed via --sv-* tokens. Flagged as a primitive gap (TASK-1762). */}
                    <ul className="list-group">
                        {warnings.map((w, i) => (
                            <li key={i} className="list-group-item list-group-item-warning">
                                <span className="glyphicon glyphicon-alert" /> {w}
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            <Card extraClassName="sv-hgeval-disclaimer">
                <h5 style={{ color: 'var(--sv-text-dim, rgba(255, 255, 255, 0.68))', borderBottom: '2px solid var(--sv-section-border, rgba(255, 255, 255, 0.6))', paddingBottom: '3px', marginBottom: '6px', fontSize: '13px' }}>
                    <Message msgId="hydrata.hgeval.disclaimer" />
                </h5>
                <p style={{ color: 'var(--sv-text-dim, rgba(255, 255, 255, 0.68))', fontSize: '11px', fontStyle: 'italic', margin: 0 }}>
                    <Message msgId="hydrata.hgeval.disclaimerText" />
                </p>
            </Card>

            {isLoggedIn && !hasContact && !savedReport && (
                <Card variant="info" extraClassName="sv-hgeval-contact-prompt">
                    <p style={{ fontSize: '12px', color: 'var(--sv-text, rgba(255, 255, 255, 0.85))', margin: '0 0 6px 0', fontWeight: 600 }}><Message msgId="hydrata.hgeval.enterContactToDownload" /></p>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input
                            type="email"
                            className="form-control input-sm"
                            style={{ flex: 1 }}
                            placeholder={getMessageById(context.messages, 'hydrata.hgeval.email')}
                            value={form?.contact_email || ''}
                            onChange={(e) => onUpdateForm('contact_email', e.target.value)}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--sv-text-dim, rgba(255, 255, 255, 0.68))', flexShrink: 0 }}><Message msgId="hydrata.hgeval.or" /></span>
                        <input
                            type="tel"
                            className="form-control input-sm"
                            style={{ flex: 1 }}
                            placeholder={getMessageById(context.messages, 'hydrata.hgeval.phoneNumber')}
                            value={form?.contact_phone_number || ''}
                            onChange={(e) => onUpdateForm('contact_phone_number', e.target.value)}
                        />
                    </div>
                </Card>
            )}

            {!isLoggedIn && !savedReport && (
                <HGevalSignupForm
                    signupErrors={signupErrors}
                    signingUp={signingUp}
                    loginErrors={loginErrors}
                    loggingIn={loggingIn}
                    onSignupAndSave={onSignupAndSave}
                    onLoginAndSave={onLoginAndSave}
                />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--sv-section-border, rgba(255, 255, 255, 0.6))', marginTop: '4px' }}>
                <button className="btn btn-default btn-sm" onClick={onNewReport}>
                    <Message msgId="hydrata.hgeval.newEvaluation" />
                </button>
                {isLoggedIn && !savedReport && (
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={handleSaveAndDownload}
                        disabled={!hasContact}
                        title={hasContact ? '' : 'Enter email or phone to enable'}
                    >
                        <span className="glyphicon glyphicon-download-alt" /> <Message msgId="hydrata.hgeval.saveAndDownload" />
                    </button>
                )}
                {savedReport && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="text-success" style={{ color: 'var(--sv-text-ok, #7ee787)' }}>
                            <span className="glyphicon glyphicon-ok" /> <Message msgId="hydrata.hgeval.saved" />
                        </span>
                        <button className="btn btn-default btn-sm" onClick={handleDownloadPdf}>
                            <span className="glyphicon glyphicon-download-alt" /> <Message msgId="hydrata.hgeval.download" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

HGevalReportDisplay.contextTypes = {
    messages: PropTypes.object
};

export default HGevalReportDisplay;
