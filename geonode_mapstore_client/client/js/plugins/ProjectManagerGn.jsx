import React from 'react';
import { connect } from 'react-redux';
import { createPlugin } from '../../MapStore2/web/client/utils/PluginsUtils';
import projectManagerGn from "../reducers/projectManagerGn";
import fetchProjectManagerConfig from "../actions/projectManagerGn";

class Component extends React.Component {
    constructor(props) {
        super(props);
        this.state = {date: new Date()};
    }

    render() {
        return (
            <div>
                <h1>Hello, world!</h1>
                <h2>It is {this.state.date.toLocaleTimeString()}.</h2>
            </div>
        );
    }
}

const ConnectedComponent = connect((state) => ({
    // active: state.controls && state.controls.drawer && state.controls.drawer.active,
    // disabled: state.controls && state.controls.drawer && state.controls.drawer.disabled
}), {
    // toggleMenu: fetchProjectManagerConfig.bind(null, 'drawer', null)
})(Component);

export default createPlugin('ProjectManagerGn', {
    component: ConnectedComponent,
    reducers: {
        projectManagerGn
    }
});
