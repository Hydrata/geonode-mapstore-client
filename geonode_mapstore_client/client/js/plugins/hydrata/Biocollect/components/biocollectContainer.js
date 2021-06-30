import React from 'react';
import { connect } from 'react-redux';


class BiocollectContainer extends React.Component {
    static propTypes = {
    };

    static defaultProps = {
    };

    constructor(props) {
        super(props);
    }

    render() {
        console.log('Biocollect');
        return (
            <div id={"biocollect-container"}>
                HelloWorld
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    console.log('state for Biocollect:', state);
    return {};
};

const mapDispatchToProps = ( dispatch ) => {
    return {
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(BiocollectContainer);
