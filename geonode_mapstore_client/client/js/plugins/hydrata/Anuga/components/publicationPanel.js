import React from "react";
import {connect} from "react-redux";
const PropTypes = require('prop-types');
import {Table, Button, OverlayTrigger, Tooltip} from "react-bootstrap";
import {setOpenMenuGroupId} from "../../SimpleView/actionsSimpleView";
import '../anuga.css';
import '../../SimpleView/simpleView.css';
import {
    createFigure,
    setPublicationPanel
} from "../actionsAnuga";

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
            <div id={'publication-panel'} className={'simple-view-panel'} style={{top: "70px"}}>
                <div className={'menu-rows-container'}>
                    <div className={"row"} style={{height: "20px", textAlign: "left", fontSize: "large"}}>
                        <span
                            className={"btn glyphicon glyphicon-remove legend-close"}
                            onClick={
                                () => {
                                    this.props.setPublicationPanel(false);
                                }
                            }
                        />
                    </div>
                    {
                        this.props.publications?.map(publication =>
                            <div className={"row menu-row-header"} style={{height: "40px", textAlign: "left", fontSize: "large"}}>
                                <span style={{lineHeight: "40px"}}>Publish: {publication?.geostory?.title}</span>
                                <Button
                                    bsStyle={'success'}
                                    bsSize={'xlarge'}
                                    style={{marginTop: "4px", borderRadius: "2px", "float": "right", display: "inlineBlock"}}
                                    onClick={() => {
                                        window.open(publication?.geostory?.detail_url, '_blank');
                                    }}
                                >
                                    Edit Publication
                                </Button>
                                <h3 style={{display: "inlineBlock"}}>
                                    Figures
                                </h3>
                                {
                                    publication?.figures?.map(figure =>
                                        <Button
                                            bsStyle={'success'}
                                            bsSize={'xsmall'}
                                            style={{borderRadius: "2px", marginTop: "5px", display: "block", width: "375px", textAlign: "left"}}
                                            onClick={() => {
                                                window.open(figure?.detail_url, '_blank');
                                            }}
                                        >
                                            {figure?.title}
                                        </Button>
                                    )
                                }
                                <div style={{borderTop: "2px solid #ffffffad", paddingTop: "15px", marginTop: "5px", marginBottom: "10px"}}>
                                    <input
                                        id={'figure-input'}
                                        key={'figure-input'}
                                        className={'data-title-input'}
                                        style={{width: "375px", marginTop: "3px", marginRight: "5px", "float": "left"}}
                                        type={'text'}
                                        value={this.state.figureTitle}
                                        onChange={(e) => this.setState({figureTitle: e.target.value})}
                                    />
                                    <Button
                                        bsStyle={'success'}
                                        bsSize={'xsmall'}
                                        style={{margin: "2px", borderRadius: "2px", "float": "left"}}
                                        onClick={() => {
                                            this.props.createFigure(this.state.figureTitle, publication.id);
                                            this.setState({networkTitle: ''});
                                        }}
                                    >
                                        Create Figure
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
        publications: state?.anuga?.publications || [],
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
