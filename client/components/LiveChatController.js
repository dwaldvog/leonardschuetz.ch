// Dependencies
import React, { Component } from 'react';
import ProtoController from './ProtoController';
import Card from './Card';
import StatusView from './StatusView';
import List from './List';
import Chat from './Chat';
import ChatroomSelector from './ChatroomSelector';

if (WebSocket) {
    WebSocket.prototype.sendJson = function(object) {
        let json;
        try {
            json = JSON.stringify(object);
        } catch (e) {
            throw new Error('Could not parse JSON');
            return;
        }

        this.send(json);
    };
}

class LiveChatController extends ProtoController {

    constructor(...args) {
        super(...args);
        this.joinRoomHandler = this.joinRoomHandler.bind(this);
        this.establishWebsocketConnection = this.establishWebsocketConnection.bind(this);
        this.closeWebsocketConnection = this.closeWebsocketConnection.bind(this);
        this.websocketConnectionEstablished = this.websocketConnectionEstablished.bind(this);
        this.websocketOnMessage = this.websocketOnMessage.bind(this);
        this.messageSendHandler = this.messageSendHandler.bind(this);
        this.filesSendHandler = this.filesSendHandler.bind(this);
        this.clearChatRoom = this.clearChatRoom.bind(this);

        this.state = Object.assign({}, this.state, {
            title: 'Livechat',
            navigation: [
                ['livechat', 'Livechat'],
            ],
            livechat: {
                roomname: '',
                username: '',
                joined: false,
                ownerOfRoom: '',
            },
            status: {
                text: 'Not connected!',
                type: 'error',
            },
            messages: [],
            users: [],
        });

        this.websocket = undefined;
    }

    joinRoomHandler(event) {
        event.preventDefault();
        const roomName = String(event.target[0].value);
        const username = String(event.target[1].value);

        if (roomName.length || roomName) {
            this.setState({
                status: {
                    text: 'Joining room',
                    type: 'success',
                },
                livechat: Object.assign({}, this.state.livechat, {
                    roomname: roomName,
                    username,
                }),
            });

            this.establishWebsocketConnection();
        } else {
            this.setState({
                status: {
                    text: 'Invalid roomname',
                    type: 'error',
                },
            });
        }
    }

    componentWillUnmount() {
        this.closeWebsocketConnection();
    }

    establishWebsocketConnection() {
        if (!this.websocket && window) {

            // Check what protocol should be used
            let protocol = window.location.protocol;
            if (protocol === 'http:') {
                protocol = 'ws://';
            } else {
                protocol = 'wss://';
            }

            // Connect to the endpoint
            this.websocket = new WebSocket(
                protocol +
                window.location.host +
                '/livechatapi'
            );

            // Add event handlers
            this.websocket.onopen = this.websocketConnectionEstablished;
            this.websocket.onclose = this.closeWebsocketConnection;
        }
    }

    websocketConnectionEstablished(event) {
        this.websocket.onmessage = this.websocketOnMessage;
        this.setState({
            status: {
                text: 'Connected!',
                type: 'success',
            },
        });

        // Request to connect to a specific room
        this.websocket.sendJson({
            type: 'joinRequest',
            room: this.state.livechat.roomname.trim(),
            username: this.state.livechat.username.trim(),
        });
    }

    websocketOnMessage(event) {
        let data = event.data;
        data = JSON.parse(data);

        switch (data.type) {
        case 'joinAccept': {
            this.setState({
                title: data.room,
                status: {
                    text: 'Connected to "' + data.room + '" as ' + this.state.livechat.username,
                    type: 'success',
                },
                livechat: Object.assign({}, this.state.livechat, {
                    roomname: data.room,
                    username: this.state.livechat.username,
                    joined: true,
                }),
            });
            break;
        }
        case 'cancelRequest': {
            this.closeWebsocketConnection();
            break;
        }
        case 'status': {
            this.setState({
                users: data.users,
                messages: data.messages,
                livechat: Object.assign({}, this.state.livechat, {
                    ownerOfRoom: data.ownerOfRoom,
                }),
            });
            break;
        }
        }
    }

    closeWebsocketConnection() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = undefined;

            this.setState({
                title: 'Livechat',
                livechat: {
                    room: '',
                    username: '',
                    joined: false,
                    ownerOfRoom: false,
                },
                status: {
                    text: 'Not connected!',
                    type: 'error',
                },
                users: [],
                messages: [],
            });
        }
    }

    messageSendHandler(message) {
        if (this.websocket) {
            this.websocket.sendJson({
                type: 'addMessage',
                message: message.trim(),
            });
        }
    }

    filesSendHandler(files) {

        // Iterate over all files
        files.forEach((file, index) => {

            // Create a FormData object to send the file
            const data = new FormData();
            data.append('file', file, file.name);

            // Upload the file to the temporary file storage
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/livechatapi', true);
            xhr.onload = () => {
                if (xhr.status === 200) {

                    // Parse the response from the api
                    const response = JSON.parse(xhr.responseText);

                    // Check if there was an error
                    if (!response.ok) {
                        return alert('Error: ' + response.message);
                    }

                    // Send the link to the socket
                    if (this.websocket) {
                        this.websocket.sendJson({
                            type: 'addFile',
                            apiResponse: response,
                            file: {
                                lastModified: file.lastModified,
                                name: file.name,
                                size: file.size,
                                type: file.type,
                            },
                        });
                    }
                }
            };
            xhr.send(data);
        });
    }

    clearChatRoom() {
        event.preventDefault();
        if (this.websocket) {
            this.websocket.sendJson({
                type: 'clearChat',
            });
        }
    }

    content(navItems, routerParams, routerPath) {

        // Prompt the user for a roomname
        let headerCard;
        let usersCard;
        let messagesCard;
        let closeButton;
        let clearButton;
        if (!this.state.livechat.joined) {
            headerCard = (
                <ChatroomSelector
                    submitHandler={this.joinRoomHandler}>
                </ChatroomSelector>
            );
        } else {
            usersCard = (
                <Card>
                    # Users
                    <List>
                        {this.state.users.map((user, index) => (
                        user.username + '-' + user.identifier.slice(0, 10)
                        ))}
                    </List>
                </Card>
            );

            messagesCard = (
                <Chat
                    messages={this.state.messages}
                    livechat={this.state.livechat}
                    newMessageHandler={this.messageSendHandler}
                    newFilesHandler={this.filesSendHandler}
                    messageMaxLength={500}>
                </Chat>
            );

            closeButton = (
                <button onClick={this.closeWebsocketConnection}>Exit chatroom</button>
            );

            if (this.state.livechat.ownerOfRoom === this.state.livechat.username) {
                clearButton = (
                    <button onClick={this.clearChatRoom}>Clear chatroom</button>
                );
            }
        }

        return (
            <div>
                {headerCard}
                {messagesCard}
                {usersCard}
                <Card>
                    # Status
                    <StatusView status={this.state.status}></StatusView>
                    {closeButton}
                    {clearButton}
                </Card>
            </div>
        );
    }
}

export default LiveChatController;
