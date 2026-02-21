import React, { useState, useEffect } from 'react';
import Message from '@mapstore/framework/components/I18N/Message';

const SECTOR_OPTIONS = [
    { value: '', label: 'Select sector...' },
    { value: 'private_home', label: 'Private Home' },
    { value: 'construction', label: 'Construction' },
    { value: 'development', label: 'Development' },
    { value: 'real_estate', label: 'Real Estate' },
    { value: 'government', label: 'Government' },
    { value: 'ngo', label: 'NGO' },
    { value: 'community', label: 'Community Development' },
    { value: 'missionary', label: 'Missionary' },
    { value: 'other', label: 'Other' }
];

const HGevalInputPanel = ({
    coordinates, form, validationError, error,
    onSetCoordinates, onUpdateForm, onStartReport, onCancel
}) => {
    const [lonStr, setLonStr] = useState(coordinates ? Math.abs(coordinates.lon).toString() : '');
    const [latStr, setLatStr] = useState(coordinates?.lat?.toString() || '');

    // Sync coordinates from map clicks into local input state
    useEffect(() => {
        if (coordinates?.lon != null && coordinates?.lat != null) {
            setLonStr(Math.abs(coordinates.lon).toFixed(6));
            setLatStr(coordinates.lat.toFixed(6));
        }
    }, [coordinates?.lon, coordinates?.lat]);

    const parsedLon = parseFloat(lonStr);
    const parsedLat = parseFloat(latStr);
    const coordsValid = lonStr !== '' && latStr !== '' && !isNaN(parsedLon) && !isNaN(parsedLat);
    const formValid = coordsValid && form.name && form.description && form.sector;

    const handleGenerate = () => {
        if (!formValid) return;
        let lon = parsedLon;
        if (lon > 0) lon = -lon;
        onSetCoordinates(lon, parsedLat);
        onStartReport();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && formValid) {
            handleGenerate();
        }
    };

    return (
        <div className="hgeval-input-panel">
            <p className="hgeval-hint">
                <span className="glyphicon glyphicon-map-marker" /> <Message msgId="hydrata.hgeval.clickMapOrEnterCoordinates" />
            </p>
            <div className="hgeval-coord-row">
                <div className="form-group">
                    <label><Message msgId="hydrata.hgeval.longitudeRequired" /></label>
                    <input
                        type="number"
                        className="form-control input-sm"
                        placeholder="-86.27"
                        step="0.0001"
                        value={lonStr}
                        onChange={(e) => setLonStr(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
                <div className="form-group">
                    <label><Message msgId="hydrata.hgeval.latitudeRequired" /></label>
                    <input
                        type="number"
                        className="form-control input-sm"
                        placeholder="12.13"
                        step="0.0001"
                        value={latStr}
                        onChange={(e) => setLatStr(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
            </div>
            {coordsValid && (
                <div className="hgeval-selected-coords">
                    {parsedLat.toFixed(4)}&deg;N, {Math.abs(parsedLon).toFixed(4)}&deg;W
                </div>
            )}
            <div className="form-group">
                <label><Message msgId="hydrata.hgeval.projectNameRequired" /></label>
                <input
                    type="text"
                    className="form-control input-sm"
                    placeholder="Name for this evaluation"
                    value={form.name}
                    onChange={(e) => onUpdateForm('name', e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </div>
            <div className="form-group">
                <label><Message msgId="hydrata.hgeval.descriptionRequired" /></label>
                <textarea
                    className="form-control input-sm"
                    rows="2"
                    placeholder="Brief description of your project"
                    value={form.description}
                    onChange={(e) => onUpdateForm('description', e.target.value)}
                />
            </div>
            <div className="form-group">
                <label><Message msgId="hydrata.hgeval.sectorRequired" /></label>
                <select
                    className="form-control input-sm"
                    value={form.sector}
                    onChange={(e) => onUpdateForm('sector', e.target.value)}
                >
                    {SECTOR_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
            <details className="hgeval-optional-fields" open>
                <summary><Message msgId="hydrata.hgeval.contactDetails" /></summary>
                <div className="form-group">
                    <label><Message msgId="hydrata.hgeval.email" /></label>
                    <input
                        type="email"
                        className="form-control input-sm"
                        placeholder="you@example.com"
                        value={form.contact_email || ''}
                        onChange={(e) => onUpdateForm('contact_email', e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
                <div className="form-group">
                    <label><Message msgId="hydrata.hgeval.phoneNumber" /></label>
                    <input
                        type="tel"
                        className="form-control input-sm"
                        placeholder="+505..."
                        value={form.contact_phone_number}
                        onChange={(e) => onUpdateForm('contact_phone_number', e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
            </details>
            {validationError && <div className="alert alert-danger hgeval-alert-sm">{validationError}</div>}
            {error && <div className="alert alert-danger hgeval-alert-sm">{error}</div>}
            <div className="hgeval-actions">
                <button className="btn btn-default btn-sm" onClick={onCancel}><Message msgId="hydrata.hgeval.cancel" /></button>
                <button
                    className="btn btn-primary btn-sm"
                    onClick={handleGenerate}
                    disabled={!formValid}
                >
                    <Message msgId="hydrata.hgeval.generateReport" />
                </button>
            </div>
        </div>
    );
};

export default HGevalInputPanel;
