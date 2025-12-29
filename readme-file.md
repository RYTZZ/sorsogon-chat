# Sorsogon Chat - Anonymous Stranger Matching App

A real-time web application that connects strangers anonymously based on municipality or shared interests in Sorsogon, Philippines.

## Features

✅ **Anonymous Chat** - No login, no passwords, just a username  
✅ **Smart Matching** - Connects users by municipality or shared interests  
✅ **Random Mode** - Option to connect with any stranger  
✅ **Real-time Messaging** - Instant message delivery using Socket.IO  
✅ **Responsive Design** - Works on desktop, tablet, and mobile  
✅ **TikTalk-Style UI** - Modern, clean interface with ocean-inspired colors  
✅ **No Data Storage** - Complete privacy, no chat history saved  

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.IO
- **No Database** - All session-based, no data persistence

## Project Structure

```
sorsogon-chat/
│
├── public/
│   ├── index.html          # Main HTML file
│   └── script.js           # Client-side JavaScript
│
├── server.js               # Backend server with Socket.IO
├── package.json            # Dependencies
└── README.md              # This file
```

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Setup Steps

1. **Create project directory**
```bash
mkdir sorsogon-chat
cd sorsogon-chat
```

2. **Create the folder structure**
```bash
mkdir public
```

3. **Save the files**
   - Save `index.html` in the `public/` folder
   - Save `script.js` in the `public/` folder
   - Save `server.js` in the root directory
   - Save `package.json` in the root directory

4. **Install dependencies**
```bash
npm install
```

5. **Start the server**
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

6. **Open your browser**
```
http://localhost:3000
```

## Usage

### For Users

1. **Enter Username** - Create a temporary username (no account needed)
2. **Select Municipality** (Optional) - Choose your municipality in Sorsogon
3. **Pick Interests** (Optional) - Select up to 3 interests
4. **Random Mode** (Optional) - Enable to connect with anyone
5. **Start Chatting** - Click the button to find a stranger
6. **Chat** - Send messages in real-time
7. **Stop/New Match** - End chat or find a new stranger

### Matching Algorithm

The app matches users based on:

1. **Municipality Match** - Users from the same municipality
2. **Interest Match** - Users with at least one shared interest
3. **Random Match** - If no specific match found or random mode enabled

## Configuration

### Change Server Port

Edit `server.js`:
```javascript
const PORT = process.env.PORT || 3000;
```

Or set environment variable:
```bash
PORT=8080 npm start
```

### Customize Municipalities

Edit the `MUNICIPALITIES` array in `index.html`:
```html
<option value="YourTown">Your Town</option>
```

### Customize Interests

Edit the interests section in `index.html`:
```html
<div class="interest-chip" data-interest="YourInterest">Your Interest</div>
```

## API Endpoints

### HTTP Endpoints

- `GET /` - Serve the main application
- `GET /health` - Health check endpoint
  ```json
  {
    "status": "ok",
    "activeChats": 5,
    "waitingUsers": 2,
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
  ```

### Socket.IO Events

**Client → Server:**
- `start-search` - User wants to find a chat partner
- `send-message` - Send a message to partner
- `typing` - User is typing
- `stop-typing` - User stopped typing
- `stop-chat` - User wants to end the chat

**Server → Client:**
- `searching` - Searching for a match
- `match-found` - Match found, includes partner info
- `receive-message` - Receive message from partner
- `partner-disconnected` - Partner left the chat
- `partner-typing` - Partner is typing
- `partner-stop-typing` - Partner stopped typing

## Deployment

### Deploy to Heroku

1. Install Heroku CLI
2. Create a Heroku app:
```bash
heroku create your-app-name
```

3. Deploy:
```bash
git init
git add .
git commit -m "Initial commit"
git push heroku main
```

### Deploy to Railway

1. Install Railway CLI
2. Initialize:
```bash
railway init
```

3. Deploy:
```bash
railway up
```

### Deploy to Render

1. Connect your GitHub repository
2. Set build command: `npm install`
3. Set start command: `npm start`

## Environment Variables

No environment variables required for basic setup. Optional:

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Security Considerations

- No personal data is stored
- Messages are not logged or saved
- Users can disconnect anytime
- No authentication required
- Session-based only

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Performance

- Handles 100+ concurrent users
- Real-time message delivery
- Efficient matching algorithm
- Low latency communication

## Troubleshooting

### Port already in use
```bash
# Kill process on port 3000
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### Socket.IO connection failed
- Check if server is running
- Verify firewall settings
- Check CORS configuration

### Messages not sending
- Ensure both users are connected
- Check browser console for errors
- Verify Socket.IO connection

## Future Enhancements

- [ ] Add image/file sharing
- [ ] Implement language translation
- [ ] Add emoji support
- [ ] Video/voice chat capability
- [ ] Report and block features
- [ ] Admin dashboard
- [ ] Chat statistics
- [ ] Mobile app (React Native)

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - Feel free to use this project for personal or commercial purposes.

## Support

For issues or questions:
- Open an issue on GitHub
- Contact: your-email@example.com

## Credits

Created for the Sorsogon community to connect people anonymously and safely.

---

**Made with ❤️ for Sorsogon**