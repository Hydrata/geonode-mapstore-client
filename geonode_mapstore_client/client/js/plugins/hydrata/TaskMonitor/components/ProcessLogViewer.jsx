import React from 'react';
const PropTypes = require('prop-types');

class ProcessLogViewer extends React.Component {
    static propTypes = {
        log: PropTypes.string
    };

    constructor(props) {
        super(props);
        this.logRef = React.createRef();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.log !== this.props.log && this.logRef.current) {
            this.logRef.current.scrollTop = this.logRef.current.scrollHeight;
        }
    }

    render() {
        return (
            <pre
                ref={this.logRef}
                className="tm-log-viewer"
            >
                {this.props.log || '(no log output)'}
            </pre>
        );
    }
}

export default ProcessLogViewer;
