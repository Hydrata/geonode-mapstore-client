import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');
import { Glyphicon, Table, Button, ProgressBar, OverlayTrigger, Tooltip } from 'react-bootstrap';
import Dropzone from 'react-dropzone';
import {
    setVisibleUploaderPanel,
    updateUploadStatus,
    setVisibleSimpleViewAttributeForm,
    createSimpleViewAttributeForm
} from "../actionsSimpleView";
import {toggleTaskMonitorPanel} from "../../TaskMonitor/actionsTaskMonitor";

import '../simpleView.css';
import {Countdown} from "./simpleViewCountdown";
import {DateFormat} from "../../../../../MapStore2/web/client/components/I18N/I18N";
import {show} from '../../../../../MapStore2/web/client/actions/notifications';
import axios from "../../../../../MapStore2/web/client/libs/ajax";
import {trackEvent} from "@js/utils/analytics";
import Message from '@mapstore/framework/components/I18N/Message';

class simpleViewUploaderPanel extends React.Component {
    static propTypes = {
        setVisibleUploaderPanel: PropTypes.func,
        updateUploaderFile: PropTypes.func,
        setUploaderFiles: PropTypes.func,
        uploaderFiles: PropTypes.object,
        updateUploadStatus: PropTypes.func,
        uploadStatus: PropTypes.string,
        visibleUploaderPanel: PropTypes.bool,
        serverUrl: PropTypes.string,
        projectId: PropTypes.number,
        newTitle: PropTypes.string,
        dataTypeTitle: PropTypes.string,
        suggestedFileType: PropTypes.string,
        uploadUrl: PropTypes.string,
        fileType: PropTypes.string,
        config: PropTypes.object,
        setVisibleSimpleViewAttributeForm: PropTypes.func,
        createSimpleViewAttributeForm: PropTypes.func,
        show: PropTypes.func,
        importerConfigKey: PropTypes.string,
        importerTargetObjectId: PropTypes.number,
        toggleTaskMonitorPanel: PropTypes.func
    };

    constructor(props) {
        super(props);
        this.state = {
            uploaderFiles: [],
            newTitle: null
        };
        this.beginTooltip = React.createRef();
    }

    render() {
        return this.props.visibleUploaderPanel ?
            <div className={'simple-view-panel uploader-panel'}>
                <div className={"row h4 legend-heading"}>
                    Upload {this.props?.config?.title} File ({this.props?.config?.filetype})
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => {
                            this.props.setVisibleUploaderPanel(false);
                            trackEvent('button', `click`, `simpleview-uploader-close`);
                        }}
                    />
                </div>
                {this.state.uploaderFiles.length > 0 ?
                    <Table bordered condensed hover ref={this.beginTooltip} style={{'tableLayout': 'fixed'}}>
                        <thead>
                            <tr>
                                <th width="160px" key="hname"><Message msgId="hydrata.simpleView.title" /></th>
                                <th width="200px" key="hname"><Message msgId="hydrata.simpleView.filename" /></th>
                                <th width="80px" key="hsize"><Message msgId="hydrata.simpleView.filesize" /></th>
                                <th width="80px" key="hlast"><Message msgId="hydrata.simpleView.modified" /></th>
                                <th width="80px" key="hstatus"><Message msgId="hydrata.simpleView.status" /></th>
                            </tr>
                        </thead>
                        <tbody>
                            {this.state.uploaderFiles && this.state.uploaderFiles.map((file, index) =>
                                (<tr key={"row_" + index}>
                                    <td key="title">
                                        { this.isBaseFile(file) ?
                                            <input
                                                id={'newTitle'}
                                                key={'newTitle'}
                                                className={'data-title-input'}
                                                type={'text'}
                                                value={this.state.newTitle || file.name.split('.').slice(0)[0]}
                                                onChange={(e) => this.setState({newTitle: e.target.value})}
                                            /> : ""
                                        }
                                    </td>
                                    <td key="name">{file.name}</td>
                                    <td key="size">{this.humanFileSize(file.size)}</td>
                                    <td key="last"><DateFormat value={file.lastModifiedDate} /></td>
                                    <td key="status">
                                        {
                                            this.isBaseFile(file) ?
                                                file.status === "begin" ?
                                                    <Button
                                                        onClick={() => {
                                                            this.uploadFile(this.state.uploaderFiles, this.props.fileType || 'file');
                                                            trackEvent('button', `click`, `simpleview-uploader-begin`);
                                                        }}
                                                        style={{'borderRadius': '3px'}}
                                                        bsSize={'small'}
                                                        bsStyle={'success'}
                                                    >
                                                        <Message msgId="hydrata.simpleView.begin" />
                                                    </Button> :
                                                    <span>
                                                        <ProgressBar active bsStyle={'success'} now={parseInt(this.props.uploadStatus, 10)}/>
                                                        {parseInt(this.props.uploadStatus, 10) === 100 ? <span><Message msgId="hydrata.simpleView.importing" /> <Countdown/></span> : this.props.uploadStatus}
                                                        {isNaN(parseInt(this.props.uploadStatus, 10)) || parseInt(this.props.uploadStatus, 10) === 100 ? '' : '%'}
                                                    </span> :
                                                null
                                        }
                                    </td>
                                </tr>) )
                            }
                        </tbody>
                    </Table>:
                    <Dropzone
                        key="dropzone"
                        rejectClassName="alert-danger"
                        className="alert alert-info"
                        onDrop={(files) => this.setState({
                            uploaderFiles: this.prepareFiles(files),
                            newTitle: files?.[0]?.name.split('.').slice(0)[0]
                        })}
                        style={this.props.dropZoneStyle}
                        activeStyle={this.props.dropZoneActiveStyle}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                width: "100%",
                                height: "100%",
                                justifyContent: "center"
                            }}
                        >
                            <span
                                style={{
                                    width: "100px",
                                    height: "100px",
                                    textAlign: "center"
                                }}
                            >
                                <Glyphicon glyph="upload"/>
                                <br/>
                                <Message msgId="hydrata.simpleView.dragFilesOrClick" />
                            </span>
                        </div>
                    </Dropzone>
                }
                <div className={"simple-view-panel-footer"}>
                    <Button
                        bsStyle="danger"
                        onClick={() => {
                            this.props.setVisibleUploaderPanel(false);
                            trackEvent('button', `click`, `simpleview-uploader-close-footer`);
                        }}
                    >
                        <Message msgId="hydrata.simpleView.close" />
                    </Button>
                </div>
            </div> :
            null;
    }

        isBaseFile = file => ["shp", "tif", "zip"].includes(file.extension);

        prepareFiles = (files) => {
            files
                .map((file) => {
                    Object.defineProperty(file, 'status', {
                        value: "begin",
                        writable: true
                    });
                    Object.defineProperty(file, 'extension', {
                        value: file.name.split('.').slice(-1)[0],
                        writable: true
                    });
                    return file;
                });
            const baseFileIndex = files.findIndex(file => (file.extension === "shp" || file.extension === "tif"));
            const theBaseFile = files.splice(baseFileIndex, 1)[0];
            files.unshift(theBaseFile);
            return files;
        };

    humanFileSize = (size) => {
        // if (size > 200000000) {
        //     return "Too big: 200MB max";
        // }
        const i = Math.floor( Math.log(size) / Math.log(1024) );
        return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
    };

    uploadFile = (files) => {
        const formData = new FormData();
        files.map(file => {
            formData.append(file.extension, file);
        });
        const baseFile = files[0];
        formData.append('title', this.state.newTitle);
        formData.append('importerTargetObjectId', this.props?.importerTargetObjectId);
        this.setState(prevState => ({
            itemList: prevState.uploaderFiles.map(
                fileToCheck => (fileToCheck.preview === baseFile.preview ? Object.assign(fileToCheck, { status: "uploading" }) : fileToCheck)
            )
        }));
        let host;
        if (this.props.serverUrl.includes('localhost')) {
            host = 'http://localhost:8081/';
        } else {
            host = this.props.serverUrl;
        }
        if (this.props.importerTargetObjectId) {
            const url = `${host}${this.props?.config?.app_name}/api/${this.props.projectId}/${this.props.importerConfigKey}/${this.props.importerTargetObjectId}/importer-config/`;
            axios
                .put(url, formData, this.uploadManager)
                .then(response => {
                    this.setState(prevState => ({
                        itemList: prevState.uploaderFiles.map(
                            fileToCheck => (fileToCheck.preview === baseFile.preview ? Object.assign(fileToCheck, { status: "complete" }) : fileToCheck)
                        )
                    }));
                    this.props.setVisibleSimpleViewAttributeForm(true);
                    this.props.createSimpleViewAttributeForm(response?.data);
                    trackEvent('process', `complete`, `simpleview-uploader-complete`);
                })
                .catch(error => {
                    this.props.updateUploadStatus(0);
                    this.props.show({
                        "message": "hydrata.simpleView.importFailed",
                        "title": "hydrata.simpleView.error",
                        "uid": 1001,
                        "position": "tc",
                        "autoDismiss": 10,
                        "level": "error"
                    });
                    trackEvent('process', `error`, `simpleview-uploader-error`);
                });
        } else {
            const url = `${host}${this.props?.config?.app_name}/api/${this.props.projectId}/${this.props.importerConfigKey}/importer-create/`;
            axios
                .put(url, formData, this.uploadManager)
                .then(response => {
                    this.setState(prevState => ({
                        itemList: prevState.uploaderFiles.map(
                            fileToCheck => (fileToCheck.preview === baseFile.preview ? Object.assign(fileToCheck, { status: "complete" }) : fileToCheck)
                        )
                    }));
                    if (response?.data?.form) {
                        this.props.setVisibleSimpleViewAttributeForm(true);
                        this.props.createSimpleViewAttributeForm(response?.data);
                        trackEvent('process', `complete`, `simpleview-uploader-complete`);
                    } else {
                        this.props.show({
                            "message": "hydrata.simpleView.importProcessingMessage",
                            "title": "hydrata.simpleView.processingStarted",
                            "uid": 1000,
                            "position": "tc"
                        });
                        this.setState({uploaderFiles: [], newTitle: null});
                        this.props.setVisibleUploaderPanel(false);
                        this.props.toggleTaskMonitorPanel(true);
                        trackEvent('process', `handoff`, `simpleview-uploader-celery-handoff`);
                    }
                })
                .catch(error => {
                    this.props.updateUploadStatus(0);
                    this.props.show({
                        "message": "hydrata.simpleView.importFailed",
                        "title": "hydrata.simpleView.error",
                        "uid": 1001,
                        "position": "tc",
                        "autoDismiss": 10,
                        "level": "error"
                    });
                    trackEvent('process', `error`, `simpleview-uploader-error`);
                });
        }
    };
    uploadManager = {
        onUploadProgress: (progressEvent) => {
            let status = Math.round( (progressEvent.loaded * 100) / progressEvent.total);
            this.props.updateUploadStatus(status);
        }
    };
}

// TASK-600: Bind projectId to the *active* project for the current app
// (ANUGA: state.anuga.projects.data.id, SWAMM: state.swamm.projectData.id),
// not state.simpleView.config.project_id which gets stashed at first config
// load and never refreshes when the user navigates between projects. The
// stashed id was causing PUTs against a stale project (e.g. demo project 378)
// even after the user switched to their own project — backend then returns 403.
// Falls back to the legacy stashed value only when no active project is loaded
// (e.g. catalogue page); in that case the upload Begin button is disabled by
// the existing `!this.props?.projectId` guard, so the user cannot
// fire a request to /undefined/.
export const getActiveProjectId = (state) => {
    const config = state?.simpleView?.config?.importer_config?.[state?.simpleView?.importerConfigKey];
    const appName = config?.app_name;
    if (appName === 'anuga') {
        return state?.anuga?.projects?.data?.id || state?.simpleView?.config?.project_id || null;
    }
    if (appName === 'swamm') {
        return state?.swamm?.projectData?.id || state?.simpleView?.config?.project_id || null;
    }
    // Unknown app — fall back to the legacy stashed project id. Cross-app
    // contexts (catalogue, gn admin, etc.) should never reach this branch
    // with a valid app_name set, so we keep behaviour identical to pre-fix.
    return state?.simpleView?.config?.project_id || null;
};

const mapStateToProps = (state) => {
    return {
        visibleUploaderPanel: state?.simpleView?.visibleUploaderPanel,
        importerConfigKey: state?.simpleView?.importerConfigKey,
        config: state?.simpleView?.config?.importer_config?.[state?.simpleView?.importerConfigKey],
        serverUrl: state?.gnsettings?.geonodeUrl,
        projectId: getActiveProjectId(state),
        uploadStatus: state?.simpleView?.uploadStatus || 0,
        importerTargetObjectId: state?.simpleView?.importerTargetObjectId
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleUploaderPanel: (visible, importerConfigKey, importerTargetObjectId) => dispatch(setVisibleUploaderPanel(visible, importerConfigKey, importerTargetObjectId)),
        updateUploadStatus: (status) => dispatch(updateUploadStatus(status)),
        setVisibleSimpleViewAttributeForm: (visible) => dispatch(setVisibleSimpleViewAttributeForm(visible)),
        createSimpleViewAttributeForm: (form, simpleViewImporterSessionId) => dispatch(createSimpleViewAttributeForm(form, simpleViewImporterSessionId)),
        show: (object, level) => dispatch(show(object, level)),
        toggleTaskMonitorPanel: (open) => dispatch(toggleTaskMonitorPanel(open))
    };
};

export const UploaderPanel = connect(mapStateToProps, mapDispatchToProps)(simpleViewUploaderPanel);
