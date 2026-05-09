import React from 'react';

const FormField = ({ field, value, onChange }) => {
    const handleChange = (e) => {
        let val = e.target.value;
        if (field.type === 'number') {
            val = val === '' ? '' : parseFloat(val);
        } else if (field.type === 'checkbox') {
            val = e.target.checked;
        }
        onChange(field.name, val);
    };

    switch (field.type) {
    case 'select':
        // TASK-784 polish: explicit border + light background + dark text so
        // the dropdown is visible against the popup's white panel chrome
        // (the previous default-styled <select> rendered white-on-white in
        // some browsers because the bootstrap form-control class was not
        // applied here).
        return (
            <div className="simple-view-panel-item-row">
                <label>{field.label}:</label>
                <select
                    value={value ?? ''}
                    onChange={handleChange}
                    style={{
                        flex: 1,
                        marginLeft: 8,
                        padding: '4px 8px',
                        border: '1px solid #ccc',
                        borderRadius: 3,
                        backgroundColor: '#fff',
                        color: '#333',
                        height: 28,
                        cursor: 'pointer'
                    }}
                >
                    {(field.options || []).map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            </div>
        );
    case 'number':
        return (
            <div className="simple-view-panel-item-row">
                <label>{field.label}:</label>
                <input
                    type="number"
                    value={value ?? ''}
                    onChange={handleChange}
                    min={field.min}
                    max={field.max}
                    step={field.step || 'any'}
                    style={{flex: 1, marginLeft: 8, maxWidth: 120}}
                />
            </div>
        );
    case 'checkbox':
        return (
            <div className="simple-view-panel-item-row">
                <label>
                    <input
                        type="checkbox"
                        checked={!!value}
                        onChange={handleChange}
                        style={{marginRight: 8}}
                    />
                    {field.label}
                </label>
            </div>
        );
    case 'text':
    default:
        return (
            <div className="simple-view-panel-item-row">
                <label>{field.label}:</label>
                <input
                    type="text"
                    value={value ?? ''}
                    onChange={handleChange}
                    style={{flex: 1, marginLeft: 8}}
                />
            </div>
        );
    }
};

export default FormField;
