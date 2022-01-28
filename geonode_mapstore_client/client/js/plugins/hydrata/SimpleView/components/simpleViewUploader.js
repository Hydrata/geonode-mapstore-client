import React from 'react';
import { connect } from 'react-redux';
const PropTypes = require('prop-types');
import Spinner from 'react-spinkit';
import { Glyphicon, ProgressBar, Table, Alert, Button } from 'react-bootstrap';
import Dropzone from 'react-dropzone';
import {
    setVisibleUploaderPanel
} from "../actionsSimpleView";
import {DateFormat, Message} from "../../../../../MapStore2/web/client/components/I18N/I18N";
import axios from "../../../../../MapStore2/web/client/libs/ajax";
// import FileUploader from "mapstore/web/client/components/file/FileUploader";

class simpleViewUploaderPanel extends React.Component {
    static propTypes = {
        setVisibleUploaderPanel: PropTypes.func,
        updateUploaderFile: PropTypes.func,
        setUploaderFiles: PropTypes.func,
        uploaderFiles: PropTypes.object,
        visibleUploaderPanel: PropTypes.bool,
        serverUrl: PropTypes.string,
        projectId: PropTypes.number
    };

    constructor(props) {
        super(props);
        this.state = {
            uploaderFiles: []
        };
    }

    componentDidMount() {
    }

    render() {
        return this.props.visibleUploaderPanel ?
            <div className={'simple-view-panel uploader-panel'}>
                <div className={"row h4 legend-heading"}>
                    Upload File
                    <span
                        className={"btn glyphicon glyphicon-remove legend-close"}
                        onClick={() => this.props.setVisibleUploaderPanel(false)}
                    />
                </div>
                {this.state.uploaderFiles.length > 0 ?
                    <Table bordered condensed hover>
                        <thead>
                            <tr>
                                <th key="hname">Filename</th>
                                <th key="hsize">Filesize</th>
                                <th key="htype">Filetype</th>
                                <th key="hlast">Last Modified</th>
                                <th key="hstatus">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {this.state.uploaderFiles && this.state.uploaderFiles.map((file, index) =>
                                (<tr key={"row_" + index}>
                                    <td key="name">{file.name}</td>
                                    <td key="size">{this.humanFileSize(file.size)}</td>
                                    <td key="type">{file.type}</td>
                                    <td key="last"><DateFormat value={file.lastModifiedDate} /></td>
                                    <td key="status">
                                        {
                                            file.status === "begin" ?
                                                <Button
                                                    onClick={() => this.uploadFile(file)}
                                                    bsSize={'small'}
                                                    bsStyle={'success'}
                                                >
                                                    Begin
                                                </Button> :
                                                <span>Complete</span>
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
                            uploaderFiles: files.map((file) => {
                                Object.defineProperty(file, 'status', {
                                    value: "begin",
                                    writable: true
                                });
                                return file;
                            })
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

    humanFileSize = (size) => {
        const i = Math.floor( Math.log(size) / Math.log(1024) );
        return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
    };
    uploadFile = (file) => {
        console.log('uploadFile started', file);
        this.setState(prevState => ({
            itemList: prevState.uploaderFiles.map(
                fileToCheck => (fileToCheck.preview === file.preview ? Object.assign(fileToCheck, { status: "uploading" }) : fileToCheck)
            )
        }));
        const data = new FormData();
        data.append('elevation', file);
        axios
            .put(`${this.props.serverUrl}anuga/api/${this.props.projectId}/elevation/upload/`, data, this.uploadConfig)
            .then(response => {
                console.log('res.statusText', response);
                console.log('res.data', response);
                this.setState(prevState => ({
                    itemList: prevState.uploaderFiles.map(
                        fileToCheck => (fileToCheck.preview === file.preview ? Object.assign(fileToCheck, { status: "complete" }) : fileToCheck)
                    )
                }));
            });
    };
    uploadConfig = {
        onUploadProgress: (progressEvent) => {
            console.log('progressEvent: ', progressEvent);
            return Math.round( (progressEvent.loaded * 100) / progressEvent.total );
        }
    };
}

const mapStateToProps = (state) => {
    return {
        visibleUploaderPanel: state?.simpleView?.visibleUploaderPanel,
        serverUrl: state?.gnsettings?.geonodeUrl,
        // serverUrl: 'http://localhost:8081/',
        projectId: state?.anuga?.project?.id
    };
};

const mapDispatchToProps = ( dispatch ) => {
    return {
        setVisibleUploaderPanel: (visible) => dispatch(setVisibleUploaderPanel(visible))
    };
};

export const UploaderPanel = connect(mapStateToProps, mapDispatchToProps)(simpleViewUploaderPanel);
