/*
 * Copyright 2024, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import isNil from 'lodash/isNil';

import tooltip from '@mapstore/framework/components/misc/enhancers/tooltip';
import FaIcon from '@js/components/FaIcon/FaIcon';

const Icon = (props) => {
    return (<div {...props} className="gn-unadvertised"><FaIcon name="eye-slash" /></div> );
};

const IconWithTooltip = tooltip(Icon);

const Unadvertised = ({resource}) => {
    if (isNil(resource.advertised) || resource.advertised) {
        return null;
    }
    return (
        <IconWithTooltip
            tooltipId={"gnviewer.unadvertised"}
            className={'gn-unadvertised'}
        />
    );
};

export default Unadvertised;
