import React, { useState } from 'react';

const HGevalLocationSelector = ({ coordinates, validationError, onSetCoordinates, onConfirm, onCancel }) => {
    const [manualLon, setManualLon] = useState(coordinates?.lon?.toString() || '');
    const [manualLat, setManualLat] = useState(coordinates?.lat?.toString() || '');

    const handleManualEntry = () => {
        let lon = parseFloat(manualLon);
        const lat = parseFloat(manualLat);
        if (isNaN(lon) || isNaN(lat)) return;
        // Nicaragua safety: force negative longitude
        if (lon > 0) lon = -lon;
        onSetCoordinates(lon, lat);
    };

    const handleConfirm = () => {
        if (coordinates) {
            onConfirm();
        }
    };

    return (
        <div className="hgeval-location-selector">
            <p className="hgeval-instruction">
                Enter the coordinates of the location you would like to evaluate.
            </p>
            <div className="hgeval-manual-entry">
                <h4>Manual Coordinate Entry (Decimal Degrees)</h4>
                <div className="hgeval-coord-inputs">
                    <div className="form-group">
                        <label>Longitude</label>
                        <input
                            type="number"
                            className="form-control"
                            placeholder="-86.27"
                            step="0.0001"
                            value={manualLon}
                            onChange={(e) => setManualLon(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Latitude</label>
                        <input
                            type="number"
                            className="form-control"
                            placeholder="12.13"
                            step="0.0001"
                            value={manualLat}
                            onChange={(e) => setManualLat(e.target.value)}
                        />
                    </div>
                    <button className="btn btn-default" onClick={handleManualEntry}>
                        Set Location
                    </button>
                </div>
            </div>
            {coordinates && (
                <div className="hgeval-selected-coords">
                    <strong>Selected: </strong>
                    {coordinates.lat.toFixed(4)}&deg;N, {Math.abs(coordinates.lon).toFixed(4)}&deg;W
                </div>
            )}
            {validationError && (
                <div className="alert alert-danger hgeval-validation-error">
                    {validationError}
                </div>
            )}
            <div className="hgeval-actions">
                <button className="btn btn-default" onClick={onCancel}>Cancel</button>
                <button
                    className="btn btn-primary"
                    onClick={handleConfirm}
                    disabled={!coordinates}
                >
                    Continue
                </button>
            </div>
        </div>
    );
};

export default HGevalLocationSelector;
