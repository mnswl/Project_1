# Socket.IO Configuration Guide for Gig Worker Finder

This guide explains how to properly configure Socket.IO for real-time messaging in the Gig Worker Finder application.

## Server-Side Configuration

1. **Ensure the server is running with Socket.IO enabled**

   The Socket.IO server is already configured in `server/app.js`. Make sure your server is running:

   ```bash
   cd server
   npm run dev
   ```

2. **Verify environment variables**

   Make sure your `.env` file in the server directory contains:

   ```
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   PORT=5000
   ```

3. **Check Socket.IO server initialization**

   The Socket.IO server is initialized in `server/app.js` with CORS enabled:

   ```javascript
   const io = new SocketIOServer(server, {
     cors: {
       origin: "*", // In production, specify your frontend domain
       methods: ["GET", "POST"]
     }
   });
   ```

## Client-Side Configuration

1. **Socket.IO client initialization**

   The Socket.IO client is initialized in `gig-worker-frontend/main.js` in the `initializeSocket()` function:

   ```javascript
   function initializeSocket() {
     if (token) {
       socket = io('http://localhost:5000', {
         auth: {
           token: token
         }
       });
       
       // Event listeners...
     }
   }
   ```

2. **Ensure the Socket.IO client library is loaded**

   The Socket.IO client library is loaded in both HTML files:

   ```html
   <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.js"></script>
   ```

## Troubleshooting

If you're experiencing issues with Socket.IO:

1. **Check browser console for errors**
   - Look for connection errors or other Socket.IO related messages

2. **Verify the server is running**
   - Make sure the Express server is running on port 5000

3. **Check authentication**
   - Ensure you have a valid JWT token in localStorage
   - The token is sent with the Socket.IO connection for authentication

4. **Test connection manually**
   - In the browser console, you can test:
     ```javascript
     const token = localStorage.getItem('token');
     const socket = io('http://localhost:5000', { auth: { token } });
     socket.on('connect', () => console.log('Connected!'));
     socket.on('connect_error', (err) => console.error('Connection error:', err.message));
     ```

5. **Check CORS settings**
   - If you're getting CORS errors, ensure the Socket.IO server's CORS settings allow your frontend origin

## Common Issues and Solutions

1. **"Failed to connect to Socket.IO server"**
   - Ensure the server is running
   - Check that the URL is correct (http://localhost:5000)
   - Verify network connectivity

2. **"Authentication error"**
   - Make sure you have a valid token in localStorage
   - Check that the JWT_SECRET on the server matches what was used to create the token

3. **Messages not being received**
   - Ensure you've joined the correct chat room
   - Check that the message event handlers are properly set up
   - Verify the message is being sent to the correct recipient

4. **Typing indicators not working**
   - Make sure the typing event is being emitted correctly
   - Check that the typing event handler is properly implemented

## Advanced Configuration

For production deployment:

1. **Update CORS settings**
   ```javascript
   const io = new SocketIOServer(server, {
     cors: {
       origin: "https://your-production-domain.com",
       methods: ["GET", "POST"]
     }
   });
   ```

2. **Update client connection URL**
   ```javascript
   socket = io('https://your-production-api-domain.com', {
     auth: { token }
   });
   ```

3. **Enable secure WebSocket (WSS)**
   - Ensure your production server uses HTTPS
   - Socket.IO will automatically use WSS when the page is served over HTTPS
