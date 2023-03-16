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

import '../simpleView.css';
import {Countdown} from "./simpleViewCountdown";
import {DateFormat} from "../../../../../MapStore2/web/client/components/I18N/I18N";
import axios from "../../../../../MapStore2/web/client/libs/ajax";

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
        importerConfigKey: PropTypes.string,
        importerTargetObjectId: PropTypes.number
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
        console.log('simpleViewUploader state: ', this.state);
        return this.props.visibleUploaderPanel ?
            <div className={'simple-view-panel uploader-panel'}>
                <div className={"row h4 legend-heading"}>
                    Upload {this.props?.config?.title} File ({this.props?.config?.filetype})
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => this.props.setVisibleUploaderPanel(false)}
                    />
                </div>
                {this.state.uploaderFiles.length > 0 ?
                    <Table bordered condensed hover ref={this.beginTooltip} style={{'tableLayout': 'fixed'}}>
                        <thead>
                            <tr>
                                <th width="160px" key="hname">Title</th>
                                <th width="200px" key="hname">Filename</th>
                                <th width="80px" key="hsize">Filesize</th>
                                <th width="80px" key="hlast">Modified</th>
                                <th width="80px" key="hstatus">Status</th>
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
                                                        onClick={() => this.uploadFile(this.state.uploaderFiles, this.props.fileType || 'file')}
                                                        style={{'borderRadius': '3px'}}
                                                        bsSize={'small'}
                                                        bsStyle={'success'}
                                                    >
                                                        Begin
                                                    </Button> :
                                                    <span>
                                                        <ProgressBar active bsStyle={'success'} now={parseInt(this.props.uploadStatus, 10)}/>
                                                        {parseInt(this.props.uploadStatus, 10) === 100 ? <span>importing: <Countdown/></span> : this.props.uploadStatus}
                                                        {isNaN(parseInt(this.props.uploadStatus, 10)) || parseInt(this.props.uploadStatus, 10) === 100 ? '' : '%'}
                                                    </span> :
                                                null
                                        }
                                    </td>
                                </tr>) )
                            }
                        </tbody>
                    </Table> :
                    <Dropzone
                        key="dropzone"
                        rejectClassName="alert-danger"
                        className="alert alert-info"
                        onDrop={(files) => this.setState({
                            uploaderFiles: this.prepareFiles(files),
                            newTitle: files?.[0]?.name.split('.').slice(0)[0]
                        })}
                        style={this.props.dropZoneStyle}
                        activeStyle={this.props.dropZoneActiveStyle}>
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            width: "100%",
                            height: "100%",
                            justifyContent: "center"
                        }}>
                            <span style={{
                                width: "100px",
                                height: "100px",
                                textAlign: "center"
                            }}>
                                <Glyphicon glyph="upload"/><br/>
                                Drag files or<br/>click here
                            </span>
                        </div>
                    </Dropzone>
                }
            </div> :
            null;
    }

        isBaseFile = file => ["shp", "tif"].includes(file.extension);

        prepareFiles = (files) => {
            console.log("files1: ", files);
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
            const baseFileIndex = files.findIndex(file => file.extension === "shp");
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
            axios
                .put(`${host}${this.props?.config?.app_name}/api/${this.props.projectId}/${this.props.importerConfigKey}/${this.props.importerTargetObjectId}/importer-config/`, formData, this.uploadManager)
                .then(response => {
                    this.setState(prevState => ({
                        itemList: prevState.uploaderFiles.map(
                            fileToCheck => (fileToCheck.preview === baseFile.preview ? Object.assign(fileToCheck, { status: "complete" }) : fileToCheck)
                        )
                    }));
                    this.props.setVisibleSimpleViewAttributeForm(true);
                    this.props.createSimpleViewAttributeForm(response?.data?.form, response?.data?.importer_session_id);
                });
        } else {
            axios
                .put(`${host}${this.props?.config?.app_name}/api/${this.props.projectId}/${this.props.importerConfigKey}/importer-create/`, formData, this.uploadManager)
                .then(response => {
                    this.setState(prevState => ({
                        itemList: prevState.uploaderFiles.map(
                            fileToCheck => (fileToCheck.preview === baseFile.preview ? Object.assign(fileToCheck, { status: "complete" }) : fileToCheck)
                        )
                    }));
                    this.props.setVisibleSimpleViewAttributeForm(true);
                    this.props.createSimpleViewAttributeForm(response?.data?.form, response?.data?.importer_session_id);
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

const mapStateToProps = (state) => {
    return {
        visibleUploaderPanel: state?.simpleView?.visibleUploaderPanel,
        importerConfigKey: state?.simpleView?.importerConfigKey,
        config: state?.simpleView?.config?.importer_config?.[state?.simpleView?.importerConfigKey],
        serverUrl: state?.gnsettings?.geonodeUrl,
        projectId: state?.simpleView?.config?.project_id,
        uploadStatus: state?.simpleView?.uploadStatus || 0,
        importerTargetObjectId: state?.simpleView?.importerTargetObjectId
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleUploaderPanel: (visible, importerConfigKey, importerTargetObjectId) => dispatch(setVisibleUploaderPanel(visible, importerConfigKey, importerTargetObjectId)),
        updateUploadStatus: (status) => dispatch(updateUploadStatus(status)),
        setVisibleSimpleViewAttributeForm: (visible) => dispatch(setVisibleSimpleViewAttributeForm(visible)),
        createSimpleViewAttributeForm: (form, simpleViewImporterSessionId) => dispatch(createSimpleViewAttributeForm(form, simpleViewImporterSessionId))
    };
};

export const UploaderPanel = connect(mapStateToProps, mapDispatchToProps)(simpleViewUploaderPanel);
