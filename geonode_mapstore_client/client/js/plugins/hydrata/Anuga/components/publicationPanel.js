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
// TASK-1764 (epic-1758 W1) — chassis PanelHeader replaces the bespoke
// .sv-legend-close span (cascade-safe sv-panel-header-close ×-chip). No test
// pins the publication close button class; the close handler is preserved.
import {PanelHeader} from '../../SimpleView/components/primitives';
// V2P-22 — gate per-publication "Edit Publication" / "Create Figure" actions
// on canEditLayer/canDeleteLayer. Each publication row carries a `perms`
// array (V2P-12a/V2P-21) and is read through the V2P-02 helpers so that
// contributors editing their own publications get the affordances while
// viewers do not. Anon users (no my_role) see read-only labels only.
import {
    canEditLayer,
    canDeleteLayer,
    getProjectMyRole
} from "../selectorsAnuga";

class PublicationPanelClass extends React.Component {
    static propTypes = {
        publications: PropTypes.array,
        setPublicationPanel: PropTypes.func,
        createFigure: PropTypes.func,
        geonodeUrl: PropTypes.string,
        figureTitle: PropTypes.string,
        // V2P-22 wiring
        anugaResources: PropTypes.object,
        myRole: PropTypes.string,
        currentUserId: PropTypes.number
    };

    static defaultProps = {}

    constructor(props) {
        super(props);
        this.state = {
            figureTitle: ''
        };
    }

    render() {
        const {anugaResources, myRole, currentUserId} = this.props;
        return (
            <div id={'publication-panel'} className={'simple-view-panel anuga-panel'}>
                <div className={'menu-rows-container'}>
                    <PanelHeader
                        extraClassName="sv-publication-close-row"
                        onClose={() => {
                            this.props.setPublicationPanel(false);
                            trackEvent('button', `click`, `anuga-publication-menu-close`);
                        }}
                    />
                    {
                        this.props.publications?.map(publication => {
                            // Tag with resourceType so the V2P-02 helper resolves
                            // perms from state.anuga.resources.publications.
                            const layer = {...publication, resourceType: 'publications'};
                            const canEditPublication = canEditLayer(layer, anugaResources, myRole, currentUserId);
                            const canDeletePublication = canDeleteLayer(layer, anugaResources, myRole, currentUserId);
                            return (
                                <div className={"row menu-row-header sv-publication-row"}>
                                    <span className="sv-publication-title"><Message msgId="hydrata.anuga.publishPrefix" /> {publication?.geostory?.title}</span>
                                    {canEditPublication ?
                                        <Button
                                            bsStyle={'success'}
                                            bsSize={'xlarge'}
                                            className="sv-publication-edit-btn"
                                            data-testid="sv-publication-edit-btn"
                                            onClick={() => {
                                                window.open(publication?.geostory?.detail_url, '_blank');
                                                trackEvent('button', `click`, `anuga-publication-menu-open-geostory-${publication?.geostory?.title}`);
                                            }}
                                        >
                                            <Message msgId="hydrata.anuga.editPublication" />
                                        </Button> : null
                                    }
                                    {canDeletePublication ?
                                        <Button
                                            bsStyle={'danger'}
                                            bsSize={'xsmall'}
                                            className="publication-delete-btn"
                                            data-testid="publication-delete-btn"
                                            onClick={() => {
                                                trackEvent('button', `click`, `anuga-publication-menu-delete-publication`);
                                                // Delete handler intentionally not wired in this PR — UI
                                                // affordance is gated and ready for V2P-79's deletePublication
                                                // action. Without this placeholder the AC#3 button-set
                                                // matrix can't differentiate manager (delete-capable) from
                                                // contributor (no-delete) on a stable selector.
                                            }}
                                        >
                                            <span className="glyphicon glyphicon-trash" aria-hidden="true" />
                                        </Button> : null
                                    }
                                    <h3 className="sv-publication-figures-heading">
                                        <Message msgId="hydrata.anuga.figures" />
                                    </h3>
                                    {
                                        publication?.figures?.map(figure =>
                                            <Button
                                                bsStyle={'success'}
                                                bsSize={'xsmall'}
                                                className="sv-publication-figure-btn"
                                                data-testid="sv-publication-figure-btn"
                                                onClick={() => {
                                                    window.open(figure?.detail_url, '_blank');
                                                    trackEvent('button', `click`, `anuga-publication-menu-open-figure-${figure?.title}`);
                                                }}
                                            >
                                                {figure?.title}
                                            </Button>
                                        )
                                    }
                                    {canEditPublication ?
                                        <div className="sv-publication-create-figure">
                                            <input
                                                id={'figure-input'}
                                                key={'figure-input'}
                                                className={'sv-data-title-input sv-publication-figure-input'}
                                                type={'text'}
                                                value={this.state.figureTitle}
                                                onChange={(e) => this.setState({figureTitle: e.target.value})}
                                            />
                                            <Button
                                                bsStyle={'success'}
                                                bsSize={'xsmall'}
                                                className="sv-publication-create-btn"
                                                data-testid="sv-publication-create-btn"
                                                onClick={() => {
                                                    this.props.createFigure(this.state.figureTitle, publication.id);
                                                    this.setState({figureTitle: ''});
                                                    trackEvent('button', `click`, `anuga-publication-menu-create-figure`);
                                                }}
                                            >
                                                <Message msgId="hydrata.anuga.createFigure" />
                                            </Button>
                                        </div> : null
                                    }
                                </div>
                            );
                        })
                    }
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        publications: state?.anuga?.resources?.publications || [],
        geonodeUrl: state?.gnsettings?.geonodeUrl,
        // V2P-22 — wire V2P-02 helper inputs through to render(). resourceType
        // tagging happens at row-render time so each publication row picks up
        // its lazy-fetched perms via _resolveResourcePerms.
        anugaResources: state?.anuga?.resources,
        myRole: getProjectMyRole(state),
        currentUserId: state?.security?.user?.pk
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
