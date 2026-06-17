import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Message from '@mapstore/framework/components/I18N/Message';
import { getMessageById } from '@mapstore/framework/utils/LocaleUtils';
import { ErrorStrip, FormRow, Card } from '../../SimpleView/components/primitives';

const SECTOR_OPTIONS = [
    { value: '', msgId: 'hydrata.hgeval.sectorSelectPrompt' },
    { value: 'private_home', msgId: 'hydrata.hgeval.sectorPrivateHome' },
    { value: 'construction', msgId: 'hydrata.hgeval.sectorConstruction' },
    { value: 'development', msgId: 'hydrata.hgeval.sectorDevelopment' },
    { value: 'real_estate', msgId: 'hydrata.hgeval.sectorRealEstate' },
    { value: 'government', msgId: 'hydrata.hgeval.sectorGovernment' },
    { value: 'ngo', msgId: 'hydrata.hgeval.sectorNgo' },
    { value: 'community', msgId: 'hydrata.hgeval.sectorCommunity' },
    { value: 'missionary', msgId: 'hydrata.hgeval.sectorMissionary' },
    { value: 'other', msgId: 'hydrata.hgeval.sectorOther' }
];

const HGevalInputPanel = ({
    coordinates, form, validationError, error,
    onSetCoordinates, onUpdateForm, onStartReport, onCancel
}, context) => {
    const [lonStr, setLonStr] = useState(coordinates ? Math.abs(coordinates.lon).toString() : '');
    const [latStr, setLatStr] = useState(coordinates?.lat?.toString() || '');

    // Sync coordinates from map clicks into local input state
    useEffect(() => {
        // eslint-disable-next-line no-eq-null, eqeqeq -- null-or-undefined idiom
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
        <div className="sv-hgeval-input-panel" style={{ textAlign: 'left' }}>
            <p className="sv-hgeval-hint">
                <span className="glyphicon glyphicon-map-marker" /> <Message msgId="hydrata.hgeval.clickMapOrEnterCoordinates" />
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <FormRow label={<Message msgId="hydrata.hgeval.longitudeRequired" />} layout="stacked">
                        <input
                            type="number"
                            className="form-control input-sm"
                            placeholder="-86.27"
                            step="0.0001"
                            value={lonStr}
                            onChange={(e) => setLonStr(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </FormRow>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <FormRow label={<Message msgId="hydrata.hgeval.latitudeRequired" />} layout="stacked">
                        <input
                            type="number"
                            className="form-control input-sm"
                            placeholder="12.13"
                            step="0.0001"
                            value={latStr}
                            onChange={(e) => setLatStr(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </FormRow>
                </div>
            </div>
            {coordsValid && (
                <Card variant="info" extraClassName="sv-hgeval-selected-coords">
                    {parsedLat.toFixed(4)}&deg;N, {Math.abs(parsedLon).toFixed(4)}&deg;W
                </Card>
            )}
            <FormRow label={<Message msgId="hydrata.hgeval.projectNameRequired" />} layout="stacked">
                <input
                    type="text"
                    className="form-control input-sm"
                    placeholder={getMessageById(context.messages, 'hydrata.hgeval.placeholderName')}
                    value={form.name}
                    onChange={(e) => onUpdateForm('name', e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </FormRow>
            <FormRow label={<Message msgId="hydrata.hgeval.descriptionRequired" />} layout="stacked">
                <textarea
                    className="form-control input-sm"
                    rows="2"
                    placeholder={getMessageById(context.messages, 'hydrata.hgeval.placeholderDescription')}
                    value={form.description}
                    onChange={(e) => onUpdateForm('description', e.target.value)}
                />
            </FormRow>
            <FormRow label={<Message msgId="hydrata.hgeval.sectorRequired" />} layout="stacked">
                <select
                    className="form-control input-sm"
                    value={form.sector}
                    onChange={(e) => onUpdateForm('sector', e.target.value)}
                >
                    {SECTOR_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{getMessageById(context.messages, opt.msgId)}</option>
                    ))}
                </select>
            </FormRow>
            {/* Native <details>/<summary> disclosure has no chassis-primitive equivalent
                (no Section variant renders a collapsible). Kept as-is, themed via --sv-* tokens.
                Flagged as a primitive gap (TASK-1762 gaps_flagged). Inner fields use FormRow. */}
            <details className="sv-hgeval-optional-fields" open>
                <summary><Message msgId="hydrata.hgeval.contactDetails" /></summary>
                <FormRow label={<Message msgId="hydrata.hgeval.email" />} layout="stacked">
                    <input
                        type="email"
                        className="form-control input-sm"
                        placeholder="you@example.com"
                        value={form.contact_email || ''}
                        onChange={(e) => onUpdateForm('contact_email', e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </FormRow>
                <FormRow label={<Message msgId="hydrata.hgeval.phoneNumber" />} layout="stacked">
                    <input
                        type="tel"
                        className="form-control input-sm"
                        placeholder="+505..."
                        value={form.contact_phone_number}
                        onChange={(e) => onUpdateForm('contact_phone_number', e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </FormRow>
            </details>
            <ErrorStrip message={validationError} />
            <ErrorStrip message={error} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid var(--sv-section-border, rgba(255, 255, 255, 0.6))', marginTop: '4px' }}>
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

HGevalInputPanel.contextTypes = {
    messages: PropTypes.object
};

export default HGevalInputPanel;
