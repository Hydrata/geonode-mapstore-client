import React from 'react';
import PropTypes from 'prop-types';
import Message from '@mapstore/framework/components/I18N/Message';
import { getMessageById } from '@mapstore/framework/utils/LocaleUtils';

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

const CONTACT_OPTIONS = [
    { value: '', msgId: 'hydrata.hgeval.contactSelectPrompt' },
    { value: 'email', msgId: 'hydrata.hgeval.contactEmail' },
    { value: 'phone', msgId: 'hydrata.hgeval.contactPhone' }
];

const HGevalProjectForm = ({ form, coordinates, error, validationError, onUpdateForm, onBack, onSubmit }, context) => {
    return (
        <div className="hgeval-project-form">
            <div className="hgeval-selected-coords">
                <strong><Message msgId="hydrata.hgeval.location" /> </strong>
                {coordinates?.lat?.toFixed(4)}&deg;N, {Math.abs(coordinates?.lon)?.toFixed(4)}&deg;W
            </div>
            <div className="form-group">
                <label><Message msgId="hydrata.hgeval.projectNameRequired" /></label>
                <input
                    type="text"
                    className="form-control"
                    placeholder={getMessageById(context.messages, 'hydrata.hgeval.placeholderName')}
                    value={form.name}
                    onChange={(e) => onUpdateForm('name', e.target.value)}
                />
            </div>
            <div className="form-group">
                <label><Message msgId="hydrata.hgeval.description" /></label>
                <textarea
                    className="form-control"
                    rows="3"
                    placeholder={getMessageById(context.messages, 'hydrata.hgeval.placeholderDescription')}
                    value={form.description}
                    onChange={(e) => onUpdateForm('description', e.target.value)}
                />
            </div>
            <div className="form-group">
                <label><Message msgId="hydrata.hgeval.sector" /></label>
                <select
                    className="form-control"
                    value={form.sector}
                    onChange={(e) => onUpdateForm('sector', e.target.value)}
                >
                    {SECTOR_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{getMessageById(context.messages, opt.msgId)}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label><Message msgId="hydrata.hgeval.preferredContact" /></label>
                <select
                    className="form-control"
                    value={form.preferred_contact}
                    onChange={(e) => onUpdateForm('preferred_contact', e.target.value)}
                >
                    {CONTACT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{getMessageById(context.messages, opt.msgId)}</option>
                    ))}
                </select>
            </div>
            {form.preferred_contact === 'phone' && (
                <div className="form-group">
                    <label><Message msgId="hydrata.hgeval.phoneNumber" /></label>
                    <input
                        type="tel"
                        className="form-control"
                        placeholder="+505..."
                        value={form.contact_phone_number}
                        onChange={(e) => onUpdateForm('contact_phone_number', e.target.value)}
                    />
                </div>
            )}
            {error && (
                <div className="alert alert-danger">{error}</div>
            )}
            {validationError && (
                <div className="alert alert-danger">{validationError}</div>
            )}
            <div className="hgeval-actions">
                <button className="btn btn-default" onClick={onBack}><Message msgId="hydrata.hgeval.back" /></button>
                <button
                    className="btn btn-primary"
                    onClick={onSubmit}
                    disabled={!form.name}
                >
                    <Message msgId="hydrata.hgeval.generateReport" />
                </button>
            </div>
        </div>
    );
};

HGevalProjectForm.contextTypes = {
    messages: PropTypes.object
};

export default HGevalProjectForm;
