import React from 'react';
import { createPlugin } from '../../MapStore2/web/client/utils/PluginsUtils';
import projectManager from "../../MapStore2/web/client/reducers/projectManager";

const Component = (props) => {
    return (
        <div>
            yo
        </div>
    );
};

export default createPlugin('ProjectManagerGn', {
    component: Component,
    reducers: {
        projectManager
    }
});
