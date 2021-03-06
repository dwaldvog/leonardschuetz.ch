// Dependencies
import React, { Component } from 'react';
import Card from './Card';

class FileCard extends Component {
    render() {
        return (
            <Card>
                {'# ' + this.props.file.filename}
                Available versions of this file:
                <ul>
                    {this.props.file.versions.map((version, index) => {
                        const link = '/documents/' + this.props.file.filename + '/' + version.time;

                        return (
                            <li key={index}>
                                <a href={link}>{version.htime}</a>
                                - {version.size / 1000}KB
                                - <button
                                    className="inline"
                                    onClick={this.props.deleteVersion.bind(this, index)}>
                                Delete version</button>
                            </li>
                        );
                    })}
                </ul>
                <a href={'/documents/' + this.props.file.filename} download>Download newest version</a>
            </Card>
        );
    }
}

FileCard.defaultProps = {
    file: {
        filename: 'Loading',
        versions: [],
        time: 0,
    },
    deleteVersion: (version, file) => {},
};

export default FileCard;
