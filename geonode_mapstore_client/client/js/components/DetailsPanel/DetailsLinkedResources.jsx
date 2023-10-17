/*
 * Copyright 2023, GeoSolutions Sas.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import PropTypes from 'prop-types';

import FaIcon from '@js/components/FaIcon';

const DetailsLinkedResources = ({
    fields,
    resourceTypesInfo
}) => {
    return (
        fields.map((field, key) => {
            const {icon} = resourceTypesInfo[field.resource_type] ?? {};
            return (
                <div key={key} className="gn-details-info-fields">
                    <div className="gn-details-info-row linked-resources">
                        <FaIcon name={icon}/>
                        <a key={field.pk} href={field.detail_url}>
                            {field.title}
                        </a>
                    </div>
                </div>
            );
        })
    );
};

DetailsLinkedResources.propTypes = {
    fields: PropTypes.array,
    resourceTypesInfo: PropTypes.object
};

DetailsLinkedResources.defaultProps = {
    fields: [],
    resourceTypesInfo: {}
};

export default DetailsLinkedResources;
