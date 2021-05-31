/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, Button } from 'react-bootstrap-v1';
import Message from '@mapstore/framework/components/I18N/Message';
import { getSupportedLocales } from '@mapstore/framework/utils/LocaleUtils';

const LanguageSelector = forwardRef(({
    style,
    value,
    onSelect,
    inline
}, ref) => {

    const supportedLocales = getSupportedLocales();
    const supportedLocalesKeys = supportedLocales ? Object.keys(supportedLocales) : [];
    const options = supportedLocalesKeys.map(key => ({
        key,
        value: supportedLocales[key].code,
        label: supportedLocales[key].description
    }));
    const selectedKey = supportedLocalesKeys.find(key => supportedLocales[key].code === value);
    const selected = supportedLocales?.[selectedKey] || {};

    return (
        <div
            ref={ref}
            className="gn-language-selector"
            style={style}
        >
            {inline
                ? options.map((option) => {
                    return (
                        <Button
                            active={option.value === value}
                            key={option.key}
                            variant="default"
                            onClick={() => onSelect(option.value)}
                        >
                            {option.key}
                        </Button>
                    );
                })
                : <Dropdown alignRight>
                    <Dropdown.Toggle
                        id="language-selector"
                        variant="default"
                        size="sm"
                    >
                        {selected.description || <Message msgId="gnhome.language" />}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                        {options.map((option) => {
                            return (
                                <Dropdown.Item
                                    active={option.value === value}
                                    key={option.key}
                                    onClick={() => onSelect(option.value)}
                                >
                                    {option.label}
                                </Dropdown.Item>
                            );
                        })}
                    </Dropdown.Menu>
                </Dropdown>}
        </div>
    );
});

LanguageSelector.propTypes = {
    style: PropTypes.object,
    value: PropTypes.string,
    inline: PropTypes.bool
};

LanguageSelector.defaultProps = {
    value: '',
    inline: false
};

export default LanguageSelector;
