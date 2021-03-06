// Dependencies
import React, { Component } from 'react';
import ProtoController from './ProtoController';
import Card from './Card';
import FileCard from './FileCard';
import StatusView from './StatusView';
import PNGEncoder from './PNGEncoder';
import MarkdownPreviewer from './MarkdownPreviewer';
import get from '../../utils/get';

class AdminController extends ProtoController {

    constructor(...args) {
        super(...args);
        this.listFiles = this.listFiles.bind(this);
        this.handleUpload = this.handleUpload.bind(this);
        this.handleDeleteVersion = this.handleDeleteVersion.bind(this);

        this.state = Object.assign({}, this.state, {
            title: 'Admin',
            navigation: [
                ['admin', 'Admin'],
                ['pngencoder', 'PNGEncoder'],
                ['markdown', 'Markdown'],
            ],
            files: [],
            status: false,
            needsAuthentication: true,
        });
    }

    appGotAuthenticated() {
        this.listFiles();
    }

    listFiles() {
        get('/documents', 'GET', {}, (err, response) => {
            response = JSON.parse(response);
            if (!response.error) {
                this.setState({
                    files: response,
                });
            }
        });
    }

    handleUpload(event) {
        event.preventDefault();

        // Clear any error message that has happened before
        this.setState({
            status: false,
        });

        // Construct the payload
        const payload = new FormData();
        payload.append('file', event.target[0].files[0]); // file
        payload.append('destination', event.target[1].value); // location selector

        // Upload the file
        get('/documents', 'POST', {
            payload,
            noJSON: true,
            onprogress: (event) => {
                this.setState({
                    status: {
                        text: parseInt((100 / event.total) * event.loaded, 10) + '% uploaded...',
                        type: 'progress',
                    },
                });
            },
        }, (err, response) => {

            if (err) return console.log(err);
            response = JSON.parse(response);

            // Error handling
            if (response.error) {
                return this.setState({
                    status: {
                        text: response.error,
                        type: 'error',
                    },
                });
            }

            // Clear the form and rerender the document list
            this.refs.uploadForm.reset();
            this.setState({
                status: {
                    text: 'Successfully uploaded file!',
                    type: 'success',
                },
            });
            this.listFiles();
        });
    }

    handleDeleteVersion(file, version, event) {
        event.preventDefault();

        const timestamp = file.versions[version].time;
        get('/documents/' + file.filename + '/' + timestamp, 'DELETE', {}, (err, response) => {
            this.listFiles();
        });
    }

    content(navItems, routerParams, routerPath) {
        switch (routerPath.path.slice(1)) {
        case 'admin': {
            return (
                <div>
                    <Card>
                        # Upload File
                        <StatusView status={this.state.status}></StatusView>
                        <form onSubmit={this.handleUpload} ref="uploadForm">
                            <input type="file" name="file"></input>
                            <select>
                                <option value="versioned_documents">Versioned Documents</option>
                                <option value="public_documents">Public Documents</option>
                                <option value="dist_folder">Dist Folder</option>
                            </select>
                            <button type="submit">Upload</button>
                        </form>
                        <a href="/resources/documents">Public documents</a>
                    </Card>
                    {this.state.files.map((file, index) => (
                        <FileCard
                            key={index}
                            file={file}
                            deleteVersion={this.handleDeleteVersion.bind(this, file)}></FileCard>
                    ))}
                </div>
            );
        }
        case 'pngencoder': {
            return (
                <div>
                    <Card>
                        # PNGEncoder
                        <PNGEncoder></PNGEncoder>
                    </Card>
                </div>
            );
        }
        case 'markdown': {
            return (
                <div>
                    <MarkdownPreviewer></MarkdownPreviewer>
                </div>
            );
        }
        }
    }
}

export default AdminController;
