const actions   = new (require('./actions.js'))();
const fs        = require('fs');
const path      = require('path');

// Livechat api
const LiveChat = function() {

    // Some props
    this.rooms = {};
    this.users = [];
    this.expressWs = undefined;
    this.mountPath = undefined;
    this.messageLimit = 30;

    // Parse a instruction
    this.parseInstruction = function(instructionBlock) {

        // Destructure some properties
        const type = instructionBlock.instruction.type;
        const time = instructionBlock.time;
        const instruction = instructionBlock.instruction;

        // In case the user get's removed before the broadcast can happen, save him here
        let savedUser = this.userForIdentifier(instruction.websocketKey);

        // Handle actions
        switch (type) {
        case 'joinRequest': {
            const addUserSuccess = this.addUser(instruction.room, instruction);
            if (addUserSuccess) {
                instruction.websocket.send(actions.createWebsocketInstruction('joinAccept', {
                    room: instruction.room,
                }));
            } else {
                instruction.websocket.send(actions.createWebsocketInstruction('cancelRequest'));
            }

            if (addUserSuccess) {
                // Update the savedUser set previously
                savedUser = this.userForIdentifier(instruction.websocketKey);
            }
            break;
        }
        case 'removeUser': {
            this.removeUser(instruction.websocketKey);
            break;
        }
        case 'addMessage': {
            this.addMessage(
                this.userForIdentifier(instruction.websocketKey).room,
                instruction.message,
                this.userForIdentifier(instruction.websocketKey),
                instructionBlock.time
            );
            break;
        }
        case 'addFile': {
            this.addFile(
                this.userForIdentifier(instruction.websocketKey).room,
                {
                    apiResponse: instruction.apiResponse,
                    file: instruction.file,
                },
                this.userForIdentifier(instruction.websocketKey),
                instructionBlock.time
            );
            break;
        }
        case 'clearChat': {
            if (this.ownsRoom(
                savedUser.room,
                savedUser.identifier
            )) {
                this.clearChat(savedUser.room);
            }
            break;
        }
        }

        // If the actions requires a broadcast, do so
        if (savedUser) {
            if (actions.requiresBroadcast(type)) {
                this.broadcastStatusForRoom(
                    savedUser.room
                );
            }
        }
    };

    // Check if a specific room exists
    this.roomExists = function(roomName) {
        return this.rooms.hasOwnProperty(roomName);
    };

    // Add a room to the livechat
    this.addRoom = function(roomName, user) {
        if (!this.roomExists(roomName)) {
            this.rooms[roomName] = {
                messages: [],
                owner: Object.assign({}, user),
            };
        }
    };

    // Checks if a specific user owns a chatroom
    this.ownsRoom = function(roomName, userIdentifier) {
        if (this.roomExists(roomName)) {
            if (this.userExists(userIdentifier)) {
                if (this.roomHasUser(roomName, userIdentifier)) {
                    if (this.rooms[roomName].owner.identifier === userIdentifier) {
                        return true;
                    }
                }
            }
        }

        return false;
    };

    // Clears all messages inside a specific room
    this.clearChat = function(roomName) {
        this.rooms[roomName].messages = [];
    };

    // Get all users in a given room
    this.usersInRoom = function(roomName) {
        return this.users.filter((user) => user.room === roomName);
    };

    // Get messages from a specific room
    this.messagesInRoom = function(roomName, limit) {
        if (!this.roomExists(roomName)) {
            return false;
        }

        return this.rooms[roomName].messages;
    };

    // Returns true or false wether a string can be used as a room name
    this.validRoomName = function(roomName) {
        return (
            roomName.length >= 4 &&
            roomName.length <= 15
        );
    };

    // Add a new message to a specific room
    this.addMessage = function(roomName, message, user, time) {
        if (!this.roomExists(roomName) || !this.userExists(user.identifier)) {
            return false;
        }

        message = message.trim();

        // Check if the message isn't empty
        if (message.length === 0) {
            return false;
        }

        // Check if the max-length of the message wasn't crossed
        if (message.length > 500) {
            return false;
        }

        // Append to the messages array of the room
        this.rooms[roomName].messages.push({
            message,
            user,
            time,
        });
    };

    // Add a new message to a specific room
    this.addFile = function(roomName, options, user, time) {
        if (!this.roomExists(roomName) || !this.userExists(user.identifier)) {
            return false;
        }

        this.rooms[roomName].messages.push({
            user,
            time,
            file: options,
        });
    };

    // Check if a specific room has a specific user in it
    this.roomHasUser = function(roomName, userIdentifier) {

        // Check if the user exists
        if (!this.userExists(userIdentifier)) {
            return false;
        }

        return this.userForIdentifier(userIdentifier).room === roomName;
    };

    // Returns the user object for a given identifier
    this.userForIdentifier = function(userIdentifier) {

        if (!this.userExists(userIdentifier)) {
            return false;
        }

        // Search the user
        let indexOfUser = -1;
        this.users.forEach((user, index) => {
            if (indexOfUser === -1) {
                if (user.identifier === userIdentifier) {
                    indexOfUser = index;
                }
            }
        });

        // If the user was not found, return false
        if (indexOfUser === -1) {
            return false;
        }

        return Object.assign({}, this.users[indexOfUser]);
    };

    // Returns the index a user has inside the users array
    this.userIndexForIdentifier = function(userIdentifier) {

        if (!this.userExists(userIdentifier)) {
            return false;
        }

        // Search the user
        let indexOfUser = -1;
        this.users.forEach((user, index) => {
            if (indexOfUser === -1) {
                if (user.identifier === userIdentifier) {
                    indexOfUser = index;
                }
            }
        });

        // If the user was not found, return false
        if (indexOfUser === -1) {
            return false;
        }

        return indexOfUser;
    };

    // Check if a user exists
    this.userExists = function(userIdentifier, userName) {
        return (this.users.filter((user) => (
            user.identifier === userIdentifier ||
            user.username === userName
        )).length > 0);
    };

    // Add a user
    this.addUser = function(roomName, user) {

        user.username = user.username.trim();

        // Check if the username is long enough
        if (user.username.length < 4 || user.username.length > 20) {
            return false;
        }

        // Check if the user already exists
        if (this.userExists(user.websocketKey, user.username)) {
            return false;
        }

        // Add the room if it doesn't exist already
        if (!this.roomExists(roomName) && this.validRoomName(roomName)) {
            this.addRoom(roomName, {
                identifier: user.websocketKey,
                username: user.username,
                room: roomName,
            });
        } else if (!this.roomExists(roomName) && this.validRoomName(roomName)) {
            return false;
        }

        // Add the user to the livechat
        this.users.push({
            identifier: user.websocketKey,
            username: user.username,
            room: roomName,
        });

        return true;
    };

    // Remove a user
    this.removeUser = function(userIdentifier) {

        // Check if the user exists
        if (!this.userExists(userIdentifier)) {
            return false;
        }

        // Remove the user
        this.users.splice(this.userIndexForIdentifier(userIdentifier), 1);
    };

    // Broadcast a status upgrade inside a given room
    this.broadcastStatusForRoom = function(roomName) {

        // Get all messages that will be removed
        const removedMessages = this.rooms[roomName].messages.slice(
            0,
            Math.max(this.rooms[roomName].messages.length - this.messageLimit, 0)
        );

        // If some of them are files, delete the according files from the file system
        removedMessages.forEach((message) => {
            if (message.file) {
                const filepath = message.file.apiResponse.link.split('/')
                .slice(2)
                .join('/');

                fs.unlink(path.resolve(__dirname, filepath), () => {
                    console.log('Deleted file:', filepath);
                });
            }
        });

        // Remove any message older than the message limit
        this.rooms[roomName].messages = this.rooms[roomName].messages
        .slice(0)
        .reverse()
        .slice(0, this.messageLimit)
        .reverse();

        // Get all users in the specified room
        const usersInRoom = this.usersInRoom(roomName);

        // Check if the expressWs was set
        if (!this.expressWs || !this.mountPath) {
            return false;
        }

        // Iterate over all clients
        const clients = this.expressWs.getWss(this.mountPath).clients.filter((client) => (
            this.roomHasUser(roomName, client.upgradeReq.headers['sec-websocket-key'])
        ));

        // Send the current status to all clients
        clients.forEach((client) => {
            client.send(actions.createWebsocketInstruction('status', {
                users: this.usersInRoom(roomName),
                room: roomName,
                messages: this.messagesInRoom(roomName, this.messageLimit),
                ownerOfRoom: this.rooms[roomName].owner.username,
            }));
        });
    };
};

// Export
module.exports = LiveChat;
