import React from 'react';

const DataRow = ({ label, value, fallback }) => (
    <tr>
        <td className="hgeval-label">{label}</td>
        <td className="hgeval-value">{value || fallback || 'Data not available'}</td>
    </tr>
);

const HGevalReportDisplay = ({
    coordinates, form, reportData, rasterValues, warnings,
    savedReport, onSave, onNewReport
}) => {
    const admin1 = reportData['geonode:admin_level_1'];
    const admin2 = reportData['geonode:admin_level_2'];
    const gwPotential = reportData['geonode:groundwater_potential_01'];
    const permeability = reportData['geonode:permeability_03'];
    const hydroEnv = reportData['geonode:hydrogeological_environments_01'];
    const landform = reportData['geonode:landform_01'];
    const geology = reportData['geonode:master_geology_01'];
    const island = reportData['geonode:islands_01'];

    return (
        <div className="hgeval-report">
            <h4>Hydrogeological Evaluation Report</h4>
            <p className="hgeval-project-name"><strong>{form?.name}</strong></p>

            <section className="hgeval-section">
                <h5>Location</h5>
                <table className="table table-condensed">
                    <tbody>
                        <DataRow label="Latitude" value={coordinates?.lat?.toFixed(6) + '\u00B0'} />
                        <DataRow label="Longitude" value={coordinates?.lon?.toFixed(6) + '\u00B0'} />
                        <DataRow label="Department" value={admin1?.name} />
                        <DataRow label="Municipality" value={admin2?.name} />
                        <DataRow label="Elevation" value={
                            rasterValues?.elevation != null
                                ? `${rasterValues.elevation} m`
                                : null
                        } />
                        {island?.OBJECTID != null && (
                            <DataRow label="Island" value={island?.ISLAND || 'Yes'} />
                        )}
                    </tbody>
                </table>
            </section>

            <section className="hgeval-section">
                <h5>Groundwater Assessment</h5>
                <table className="table table-condensed">
                    <tbody>
                        <DataRow label="Groundwater Potential" value={gwPotential?.EN_GW_Desc} />
                        <DataRow label="Permeability" value={permeability?.EN_Per_Des} />
                        <DataRow label="Hydrogeological Environment" value={hydroEnv?.EN_HGE_Des} />
                        <DataRow label="Landform" value={landform?.EN_Lnd_Des} />
                        <DataRow label="Geology" value={geology?.EN_Geo_Des} />
                        <DataRow label="Aquifer Type" value={geology?.EN_Aqu_Des} />
                    </tbody>
                </table>
            </section>

            <section className="hgeval-section">
                <h5>Rainfall</h5>
                <table className="table table-condensed">
                    <tbody>
                        <DataRow label="Annual Precipitation" value={
                            rasterValues?.precip_annual != null
                                ? `${rasterValues.precip_annual} mm`
                                : null
                        } />
                        <DataRow label="Driest Quarter Precipitation" value={
                            rasterValues?.precip_driest_quarter != null
                                ? `${rasterValues.precip_driest_quarter} mm`
                                : null
                        } />
                    </tbody>
                </table>
            </section>

            {warnings.length > 0 && (
                <section className="hgeval-section hgeval-warnings">
                    <h5>Warnings ({warnings.length})</h5>
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
                <h5>Disclaimer</h5>
                <p>
                    This report is generated from automated spatial analysis and should be considered
                    preliminary. The data presented is derived from regional-scale datasets and may not
                    reflect local conditions. A professional hydrogeological assessment is recommended
                    before making investment decisions based on this information.
                </p>
            </section>

            <div className="hgeval-actions">
                <button className="btn btn-default" onClick={onNewReport}>
                    New Evaluation
                </button>
                {!savedReport ? (
                    <button className="btn btn-primary" onClick={onSave}>
                        Save Report
                    </button>
                ) : (
                    <span className="text-success">
                        <span className="glyphicon glyphicon-ok" /> Report saved
                    </span>
                )}
            </div>
        </div>
    );
};

export default HGevalReportDisplay;
