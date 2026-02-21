import React from 'react';
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

const CONTACT_OPTIONS = [
    { value: '', label: 'Select...' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' }
];

const HGevalProjectForm = ({ form, coordinates, error, validationError, onUpdateForm, onBack, onSubmit }) => {
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
                    placeholder="Enter a name for this evaluation"
                    value={form.name}
                    onChange={(e) => onUpdateForm('name', e.target.value)}
                />
            </div>
            <div className="form-group">
                <label><Message msgId="hydrata.hgeval.description" /></label>
                <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Brief description of your project"
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
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
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

export default HGevalProjectForm;
