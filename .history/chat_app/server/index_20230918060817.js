require("dotenv").config();
const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const harperSaveMessage = require('./services/harper-save-message');
const harperGetMessages = require('./services/harper-get-messages'); // Add this
const leaveRoom = require("./utils/leave-room");
app.use(cors()); // Add cors middleware

const server = http.createServer(app);

app.get("/", (req, res) => {
  res.send("Hello world");
});

// Create an io server and allow for CORS from http://localhost:3000 with GET and POST methods
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const CHAT_BOT = "ChatBot";

let chatRoom = ""; // E.g. javascript, node,...
let allUsers = [];

// Listen for when the client connects via socket.io-client
io.on("connection", (socket) => {
  console.log(`User connected, socket id = ${socket.id}`);

  socket.on("join_room", (data) => {
    const { username, room } = data;
    socket.join(room);

    let __createdtime__ = Date.now(); // Current timestamp
    // Send message to all users currently in the room, apart from the user that just joined
    socket.to(room).emit("receive_message", {
      message: `${username} has joined the chat room`,
      username: CHAT_BOT,
      __createdtime__,
    });

    socket.emit("receive_message", {
      message: `Welcome ${username}`,
      username: CHAT_BOT,
      __createdtime__,
    });

    // Save the new user to the room
    chatRoom = room;
    allUsers.push({ id: socket.id, username, room });
    chatRoomUsers = allUsers.filter((user) => user.room === room);
    socket.to(room).emit("chatroom_users", chatRoomUsers);
    socket.emit("chatroom_users", chatRoomUsers);
  });

  socket.on("send_message", (data) => {
    const { message, username, room, __createdtime__ } = data;

    // Send to all users in room, including sender
      io.in(room).emit("receive_message", data);
      
    // Save message in db
    harperSaveMessage(message, username, room, __createdtime__)
      .then((response) => console.log(response))
      .catch((err) => console.log(err));

    // Get last 100 messages sent in the chat room
    harperGetMessages(room)
      .then((last100Messages) => {
        console.log("latest messages", last100Messages);
        socket.emit("last_100_messages", last100Messages);
      })
      .catch((err) => console.log(err));
  });
    

   socket.on("leave_room", (data) => {
     const { username, room } = data;
     socket.leave(room);
     const __createdtime__ = Date.now();
     // Remove user from memory
     allUsers = leaveRoom(socket.id, allUsers);
     socket.to(room).emit("chatroom_users", allUsers);
     socket.to(room).emit("receive_message", {
       username: CHAT_BOT,
       message: `${username} has left the chat`,
       __createdtime__,
     });
     console.log(`${username} has left the chat`);
   });

});

server.listen(4000, () => "Server is running on port 4000");
