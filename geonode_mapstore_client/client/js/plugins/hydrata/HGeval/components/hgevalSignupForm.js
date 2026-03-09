import React, { useState } from 'react';

const HGevalSignupForm = ({ signupErrors, signingUp, onSignupAndSave }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [localErrors, setLocalErrors] = useState({});

    const validate = () => {
        const errs = {};
        if (!email.trim()) errs.email = 'Email is required.';
        else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email address.';
        if (!password) errs.password = 'Password is required.';
        else if (password.length < 8) errs.password = 'Password must be at least 8 characters.';
        return errs;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const errs = validate();
        setLocalErrors(errs);
        if (Object.keys(errs).length > 0) return;
        onSignupAndSave({
            email: email.trim(),
            password,
            first_name: firstName.trim(),
            last_name: lastName.trim()
        });
    };

    const errors = { ...localErrors };
    if (signupErrors) {
        Object.keys(signupErrors).forEach(k => {
            errors[k] = signupErrors[k];
        });
    }

    return (
        <div className="hgeval-signup-form">
            <p className="hgeval-signup-title">Create an account to save and download your report</p>
            <form onSubmit={handleSubmit}>
                <div className="hgeval-name-row">
                    <div className={'form-group' + (errors.first_name ? ' has-error' : '')}>
                        <input
                            type="text"
                            className="form-control input-sm"
                            placeholder="First name"
                            value={firstName}
                            onChange={e => setFirstName(e.target.value)}
                        />
                    </div>
                    <div className={'form-group' + (errors.last_name ? ' has-error' : '')}>
                        <input
                            type="text"
                            className="form-control input-sm"
                            placeholder="Last name"
                            value={lastName}
                            onChange={e => setLastName(e.target.value)}
                        />
                    </div>
                </div>
                <div className={'form-group' + (errors.email ? ' has-error' : '')}>
                    <input
                        type="email"
                        className="form-control input-sm"
                        placeholder="Email *"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                    {errors.email && <span className="help-block hgeval-field-error">{errors.email}</span>}
                </div>
                <div className={'form-group' + (errors.password ? ' has-error' : '')}>
                    <input
                        type="password"
                        className="form-control input-sm"
                        placeholder="Password * (min 8 characters)"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                    {errors.password && <span className="help-block hgeval-field-error">{errors.password}</span>}
                </div>
                {errors.detail && (
                    <div className="alert alert-danger hgeval-alert-sm">{errors.detail}</div>
                )}
                <button
                    type="submit"
                    className="btn btn-primary btn-sm btn-block"
                    disabled={signingUp}
                >
                    {signingUp
                        ? <span><span className="glyphicon glyphicon-refresh hgeval-spin" /> Creating account...</span>
                        : <span><span className="glyphicon glyphicon-download-alt" /> Create Account & Save Report</span>
                    }
                </button>
            </form>
            <p className="hgeval-login-link">
                Already have an account?{' '}
                <a href={'/account/login/?next=' + encodeURIComponent(window.location.pathname + window.location.hash)}>
                    Log in
                </a>
            </p>
        </div>
    );
};

export default HGevalSignupForm;
