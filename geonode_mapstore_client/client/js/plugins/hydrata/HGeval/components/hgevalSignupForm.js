import React, { useState } from 'react';
import Message from '@mapstore/framework/components/I18N/Message';

const HGevalSignupForm = ({
    signupErrors, signingUp, loginErrors, loggingIn,
    onSignupAndSave, onLoginAndSave
}) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [localErrors, setLocalErrors] = useState({});
    const [mode, setMode] = useState('signup'); // 'signup' or 'login'

    const isLogin = mode === 'login';
    const busy = isLogin ? loggingIn : signingUp;

    const validate = () => {
        const errs = {};
        if (!email.trim()) errs.email = 'Email is required.';
        else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email address.';
        if (!password) errs.password = 'Password is required.';
        else if (!isLogin && password.length < 8) errs.password = 'Password must be at least 8 characters.';
        return errs;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const errs = validate();
        setLocalErrors(errs);
        if (Object.keys(errs).length > 0) return;

        if (isLogin) {
            onLoginAndSave({ email: email.trim(), password });
        } else {
            onSignupAndSave({
                email: email.trim(),
                password,
                first_name: firstName.trim(),
                last_name: lastName.trim()
            });
        }
    };

    const serverErrors = isLogin ? loginErrors : signupErrors;
    const errors = { ...localErrors };
    if (serverErrors) {
        Object.keys(serverErrors).forEach(k => {
            errors[k] = serverErrors[k];
        });
    }

    const toggleMode = (e) => {
        e.preventDefault();
        setMode(isLogin ? 'signup' : 'login');
        setLocalErrors({});
    };

    return (
        <div className="hgeval-signup-form">
            <p className="hgeval-signup-title">
                {isLogin
                    ? <Message msgId="hydrata.hgeval.logInToSave" />
                    : <Message msgId="hydrata.hgeval.createAccountToSave" />
                }
            </p>
            <form onSubmit={handleSubmit}>
                {!isLogin && (
                    <div className="hgeval-name-row">
                        <div className="form-group">
                            <input
                                type="text"
                                className="form-control input-sm"
                                placeholder="First name"
                                value={firstName}
                                onChange={e => setFirstName(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <input
                                type="text"
                                className="form-control input-sm"
                                placeholder="Last name"
                                value={lastName}
                                onChange={e => setLastName(e.target.value)}
                            />
                        </div>
                    </div>
                )}
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
                        placeholder={isLogin ? "Password *" : "Password * (min 8 characters)"}
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
                    disabled={busy}
                >
                    {busy
                        ? <span>
                            <span className="glyphicon glyphicon-refresh hgeval-spin" />{' '}
                            {isLogin
                                ? <Message msgId="hydrata.hgeval.loggingIn" />
                                : <Message msgId="hydrata.hgeval.creatingAccount" />
                            }
                          </span>
                        : <span>
                            <span className="glyphicon glyphicon-download-alt" />{' '}
                            {isLogin
                                ? <Message msgId="hydrata.hgeval.logInAndSave" />
                                : <Message msgId="hydrata.hgeval.createAccountAndSave" />
                            }
                          </span>
                    }
                </button>
            </form>
            <p className="hgeval-login-link">
                <a href="#" onClick={toggleMode}>
                    {isLogin
                        ? <Message msgId="hydrata.hgeval.needAnAccount" />
                        : <Message msgId="hydrata.hgeval.alreadyHaveAccount" />
                    }
                </a>
            </p>
        </div>
    );
};

export default HGevalSignupForm;
