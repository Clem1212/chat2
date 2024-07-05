const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 8000;

// In-memory storage (replace with a database in a real application)
const users = new Map();
const friendRequests = new Map();
const friendships = new Map();

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('New client connected');

  // User registration
  socket.on('register', (username) => {
    if (users.has(username)) {
      socket.emit('registration_error', 'Username already taken');
    } else {
      users.set(username, socket.id);
      socket.username = username;
      socket.emit('registration_success', username);
      io.emit('user_list', Array.from(users.keys()));
    }
  });

  // Friend request
  socket.on('friend_request', (recipient) => {
    const sender = socket.username;
    if (!users.has(recipient)) {
      socket.emit('friend_request_error', 'User not found');
      return;
    }
    if (!friendRequests.has(recipient)) {
      friendRequests.set(recipient, new Set());
    }
    friendRequests.get(recipient).add(sender);
    io.to(users.get(recipient)).emit('new_friend_request', { from: sender });
  });

  // Accept friend request
  socket.on('accept_friend', (sender) => {
    const recipient = socket.username;
    if (friendRequests.has(recipient) && friendRequests.get(recipient).has(sender)) {
      friendRequests.get(recipient).delete(sender);
      if (!friendships.has(recipient)) {
        friendships.set(recipient, new Set());
      }
      if (!friendships.has(sender)) {
        friendships.set(sender, new Set());
      }
      friendships.get(recipient).add(sender);
      friendships.get(sender).add(recipient);
      io.to(users.get(sender)).emit('friend_accepted', recipient);
      socket.emit('friend_accepted', sender);
    }
  });

  // Private message
  socket.on('private_message', ({ recipient, message }) => {
    const sender = socket.username;
    if (friendships.has(sender) && friendships.get(sender).has(recipient)) {
      io.to(users.get(recipient)).emit('new_private_message', { sender, message });
    } else {
      socket.emit('message_error', 'You can only send messages to friends');
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.username) {
      users.delete(socket.username);
      io.emit('user_list', Array.from(users.keys()));
    }
    console.log('Client disconnected');
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
