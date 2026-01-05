# Remote Desktop Feature

Low-latency remote desktop streaming using WebRTC, similar to Parsec.

## Architecture

The remote desktop feature uses WebRTC for peer-to-peer video streaming:

1. **Client (ircommander_client)**: Acts as the host, captures screen and streams via WebRTC
2. **Web App (ircommander)**: Acts as the viewer, displays the stream in the browser
3. **API Server**: Handles WebRTC signaling (offer/answer exchange)

## Components

### Client Side (`ircommander_client`)

- **`core/remote_desktop.py`**: WebRTC server implementation
  - `ScreenCaptureTrack`: Captures screen using `mss` library
  - `RemoteDesktopServer`: Manages WebRTC peer connections
  - Handles WebRTC offers and generates answers

- **`service.py`**: Integration with main service
  - Automatically starts remote desktop server when service starts
  - Handles `webrtc_offer` commands from API
  - Processes WebRTC offers and returns answers

### Web App (`ircommander`)

- **`components/remote-desktop-viewer.tsx`**: React component for viewing stream
  - Creates WebRTC peer connection
  - Handles offer/answer exchange
  - Displays video stream

- **`app/devices/[deviceId]/remote-desktop/page.tsx`**: Remote desktop page
  - Full-page viewer interface
  - Connection controls

- **API Endpoints**:
  - `POST /api/v1/devices/{deviceId}/remote-desktop`: Initiate connection
  - `GET /api/v1/devices/{deviceId}/remote-desktop?session_id=...`: Poll for answer
  - `POST /api/v1/devices/{deviceId}/remote-desktop/ice-candidate`: Send ICE candidates

## Setup

### 1. Install Dependencies

On the client machine (`ircommander_client`):

```bash
cd ircommander_client
pip install -r requirements.txt
```

This installs:
- `aiortc`: WebRTC library for Python
- `opencv-python`: Image processing
- `mss`: Fast screen capture
- `numpy`: Array operations
- `aiohttp`: Async HTTP

### 2. Start the Service

The remote desktop server starts automatically when the iRCommander service starts:

```bash
python main.py
# or
python main.py --headless
```

### 3. Access Remote Desktop

1. Navigate to a device page: `/devices/{deviceId}`
2. Click "Remote Desktop" in the Quick Actions sidebar
3. Click "Connect" to start streaming

## How It Works

### Connection Flow

1. **Web App Creates Offer**
   - User clicks "Connect"
   - Browser creates WebRTC offer
   - Offer sent to API: `POST /api/v1/devices/{deviceId}/remote-desktop`

2. **API Forwards to Device**
   - API creates a `webrtc_offer` command
   - Device polls for commands (existing command system)

3. **Device Processes Offer**
   - Device receives command
   - Remote desktop server creates WebRTC answer
   - Answer stored in command result

4. **Web App Receives Answer**
   - Web app polls: `GET /api/v1/devices/{deviceId}/remote-desktop?session_id=...`
   - When answer is ready, sets remote description
   - WebRTC connection established

5. **Streaming**
   - Device captures screen at 30 FPS
   - Streams via WebRTC to browser
   - Browser displays in `<video>` element

### Screen Capture

- Uses `mss` library for fast screen capture on Windows
- Captures primary monitor
- Resizes to max 1920x1080 for performance
- Streams at 30 FPS

### Performance

- **Latency**: Typically 50-200ms (depends on network)
- **Frame Rate**: 30 FPS
- **Resolution**: Up to 1920x1080 (scaled from source)
- **Bandwidth**: ~5-15 Mbps (depends on content)

## Limitations

1. **Signaling**: Currently uses HTTP polling. For production, consider WebSockets for real-time signaling.

2. **ICE Candidates**: ICE candidate exchange is basic. For better NAT traversal, consider TURN servers.

3. **Input Forwarding**: Currently only video streaming. Mouse/keyboard input forwarding not yet implemented.

4. **Multiple Monitors**: Only captures primary monitor. Multi-monitor support can be added.

5. **Audio**: Audio streaming not implemented (can be added).

## Future Improvements

- [ ] WebSocket-based signaling for lower latency
- [ ] Mouse/keyboard input forwarding
- [ ] Multi-monitor support
- [ ] Audio streaming
- [ ] TURN server for better NAT traversal
- [ ] Quality/bitrate controls
- [ ] Connection quality indicators

## Troubleshooting

### "Remote desktop not available"

- Check that WebRTC dependencies are installed: `pip install aiortc opencv-python mss numpy aiohttp`
- Check service logs for import errors
- Restart the service

### "Connection timeout"

- Device may not be online
- Device may not have processed the command yet
- Check device status in device details page

### "WebRTC negotiation failed"

- Check device logs for errors
- Ensure device has internet connection
- Firewall may be blocking WebRTC traffic

### Poor Performance

- Check network connection quality
- Reduce screen resolution on device
- Close unnecessary applications on device
- Consider using wired network connection

## Security Considerations

- Remote desktop requires device authentication (X-Device-Key)
- Web app requires user authentication
- WebRTC uses encrypted connections (DTLS)
- Screen content is only visible to authenticated users with device access
