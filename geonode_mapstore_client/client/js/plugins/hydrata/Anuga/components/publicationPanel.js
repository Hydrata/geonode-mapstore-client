import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Button} from "react-bootstrap";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    createFigure,
    setPublicationPanel
} from "../actionsAnuga";
import {trackEvent} from "@js/utils/analytics";
import Message from '@mapstore/framework/components/I18N/Message';

class PublicationPanelClass extends React.Component {
    static propTypes = {
        publications: PropTypes.array,
        setPublicationPanel: PropTypes.func,
        createFigure: PropTypes.func,
        geonodeUrl: PropTypes.string,
        figureTitle: PropTypes.string
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {
            figureTitle: ''
        };
    }

    render() {
        // console.log('this.state:', this.state)
        return (
            <div id={'publication-panel'} className={'simple-view-panel anuga-panel'}>
                <div className={'menu-rows-container'}>
                    <div className={"row publication-close-row"}>
                        <span
                            className={"btn glyphicon glyphicon-remove legend-close"}
                            onClick={
                                () => {
                                    this.props.setPublicationPanel(false);
                                    trackEvent('button', `click`, `anuga-publication-menu-close`);
                                }
                            }
                        />
                    </div>
                    {
                        this.props.publications?.map(publication =>
                            <div className={"row menu-row-header publication-row"}>
                                <span className="publication-title"><Message msgId="hydrata.anuga.publishPrefix" /> {publication?.geostory?.title}</span>
                                <Button
                                    bsStyle={'success'}
                                    bsSize={'xlarge'}
                                    className="publication-edit-btn"
                                    onClick={() => {
                                        window.open(publication?.geostory?.detail_url, '_blank');
                                        trackEvent('button', `click`, `anuga-publication-menu-open-geostory-${publication?.geostory?.title}`);
                                    }}
                                >
                                    <Message msgId="hydrata.anuga.editPublication" />
                                </Button>
                                <h3 className="publication-figures-heading">
                                    <Message msgId="hydrata.anuga.figures" />
                                </h3>
                                {
                                    publication?.figures?.map(figure =>
                                        <Button
                                            bsStyle={'success'}
                                            bsSize={'xsmall'}
                                            className="publication-figure-btn"
                                            onClick={() => {
                                                window.open(figure?.detail_url, '_blank');
                                                trackEvent('button', `click`, `anuga-publication-menu-open-figure-${figure?.title}`);
                                            }}
                                        >
                                            {figure?.title}
                                        </Button>
                                    )
                                }
                                <div className="publication-create-figure">
                                    <input
                                        id={'figure-input'}
                                        key={'figure-input'}
                                        className={'data-title-input publication-figure-input'}
                                        type={'text'}
                                        value={this.state.figureTitle}
                                        onChange={(e) => this.setState({figureTitle: e.target.value})}
                                    />
                                    <Button
                                        bsStyle={'success'}
                                        bsSize={'xsmall'}
                                        className="publication-create-btn"
                                        onClick={() => {
                                            this.props.createFigure(this.state.figureTitle, publication.id);
                                            this.setState({figureTitle: ''});
                                            trackEvent('button', `click`, `anuga-publication-menu-create-figure`);
                                        }}
                                    >
                                        <Message msgId="hydrata.anuga.createFigure" />
                                    </Button>
                                </div>
                            </div>
                        )
                    }
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        publications: state?.anuga?.resources?.publications || [],
        geonodeUrl: state?.gnsettings?.geonodeUrl
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setOpenMenuGroupId: (menuGroup) => dispatch(setOpenMenuGroupId(menuGroup)),
        setPublicationPanel: (visible) => dispatch(setPublicationPanel(visible)),
        createFigure: (figureTitle, publicationId) => dispatch(createFigure(figureTitle, publicationId))
    };
};

const PublicationPanel = connect(mapStateToProps, mapDispatchToProps)(PublicationPanelClass);


export {
    PublicationPanel
};
