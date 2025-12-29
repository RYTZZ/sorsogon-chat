# 🚀 Quick Start Guide - Sorsogon Chat

Get your chat app running in 5 minutes!

## Step 1: Install Node.js

Download and install Node.js from [nodejs.org](https://nodejs.org/)

Verify installation:
```bash
node --version
npm --version
```

## Step 2: Create Project

```bash
# Create folder
mkdir sorsogon-chat
cd sorsogon-chat

# Create public folder
mkdir public
```

## Step 3: Add Files

Create these files with the provided code:

```
sorsogon-chat/
├── public/
│   ├── index.html      ← Save HTML code here
│   └── script.js       ← Save client JavaScript here
├── server.js           ← Save server code here
├── package.json        ← Save package.json here
└── .gitignore         ← Save .gitignore here
```

### File: `package.json` (root folder)
```json
{
  "name": "sorsogon-chat",
  "version": "1.0.0",
  "description": "Anonymous stranger chat application",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### File: `public/index.html`
Copy the entire HTML code provided in the `index.html` artifact.

### File: `public/script.js`
Copy the entire JavaScript code provided in the `script.js` artifact.

### File: `server.js` (root folder)
Copy the entire server code provided in the `server.js` artifact.

### File: `.gitignore` (root folder)
Copy the content from the `.gitignore` artifact.

## Step 4: Install Dependencies

```bash
npm install
```

Wait for installation to complete...

## Step 5: Start Server

```bash
npm start
```

You should see:
```
Server is running on port 3000
Visit http://localhost:3000 to use the app
```

## Step 6: Open Browser

Open your browser and go to:
```
http://localhost:3000
```

## 🎉 That's It!

You're now running Sorsogon Chat locally!

## Testing with Multiple Users

**Option 1: Multiple Browser Windows**
1. Open Chrome (Window 1)
2. Open Chrome Incognito (Window 2)
3. Enter different usernames in each
4. Click "Start Chatting" in both
5. They should connect!

**Option 2: Multiple Devices**
1. Find your computer's IP address
   - Windows: `ipconfig` → look for IPv4 Address
   - Mac/Linux: `ifconfig` → look for inet
2. On another device (phone/tablet), open browser
3. Go to: `http://YOUR_IP:3000`
4. Both devices can now chat!

Example: `http://192.168.1.100:3000`

## Common Issues

### ❌ "Port 3000 already in use"

**Solution:**
```bash
# Use a different port
PORT=8080 npm start
```

Then visit: `http://localhost:8080`

### ❌ "Cannot find module"

**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

### ❌ "Socket.IO connection failed"

**Solution:**
- Make sure server is running
- Check if you're on `http://localhost:3000`
- Try restarting the server
- Check browser console for errors (F12)

## Development Mode

For auto-restart on file changes:
```bash
npm run dev
```

This uses `nodemon` which watches for file changes.

## Stopping the Server

Press `Ctrl + C` in the terminal

## Next Steps

1. ✅ Customize municipalities (edit `index.html`)
2. ✅ Customize interests (edit `index.html`)
3. ✅ Change colors (edit CSS in `index.html`)
4. ✅ Deploy to internet (see README.md)

## Quick Test Checklist
