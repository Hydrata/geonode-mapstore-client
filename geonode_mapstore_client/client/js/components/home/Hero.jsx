/*
 * Copyright 2020, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Jumbotron } from 'react-bootstrap-v1';
import HTML from '@mapstore/framework/components/I18N/HTML';

const Hero = forwardRef(({
    style,
    jumbotronStyle,
    children
}, ref) => {

    return (
        <div
            ref={ref}
            className="gn-hero"
            style={style}
        >
            <Jumbotron style={jumbotronStyle}>
                <div className="gn-hero-description">
                    <HTML msgId="gnhome.description"/>
                </div>
                <p className="gn-hero-tools">
                    {children}
                </p>
            </Jumbotron>
        </div>
    );
});

Hero.propTypes = {
    style: PropTypes.object
};

Hero.defaultProps = {};

export default Hero;
