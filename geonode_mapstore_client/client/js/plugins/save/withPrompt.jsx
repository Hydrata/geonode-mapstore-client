import React from 'react';
import PropTypes from 'prop-types';

export default (Component) => {
    const PromptComponent = (props) => {
        return props.enabled
            ? <Component {...props}/>
            : null
        ;
    };

    PromptComponent.contextTypes = {
        messages: PropTypes.object
    };
    return PromptComponent;
};
