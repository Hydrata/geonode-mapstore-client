import React from 'react';
import { connect } from 'react-redux';


class SimpleViewContainer extends React.Component {
    static propTypes = {
    };

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    render() {
        console.log('SimpleView');
        return (
            <div id={"simple-view-container"}>
                HelloWorld
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    console.log('state for SimpleView:', state);
    return {};
};

const mapDispatchToProps = ( dispatch ) => {
    return {
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(SimpleViewContainer);
