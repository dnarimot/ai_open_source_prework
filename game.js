class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.myPlayerId = null;
        this.players = {};
        this.avatars = {};
        this.websocket = null;
        
        // Viewport system
        this.viewportX = 0;
        this.viewportY = 0;
        
        // Avatar rendering
        this.avatarSize = 48;
        this.loadedAvatarImages = {};
        
        // Movement controls
        this.keysPressed = {};
        this.movementIntervals = {};
        this.movementDirections = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };
        
        this.setupCanvas();
        this.setupKeyboardControls();
        this.loadWorldMap();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.updateViewport();
        });
    }
    
    setupKeyboardControls() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
    }
    
    handleKeyDown(event) {
        // Only handle arrow keys
        if (!this.movementDirections[event.code]) return;
        
        // Prevent default browser behavior (scrolling)
        event.preventDefault();
        
        // If key is already pressed, don't start another interval
        if (this.keysPressed[event.code]) return;
        
        this.keysPressed[event.code] = true;
        const direction = this.movementDirections[event.code];
        
        // Send initial move command
        this.sendMoveCommand(direction);
        
        // Set up interval to send continuous move commands
        this.movementIntervals[event.code] = setInterval(() => {
            this.sendMoveCommand(direction);
        }, 50); // Send move command every 50ms
    }
    
    handleKeyUp(event) {
        // Only handle arrow keys
        if (!this.movementDirections[event.code]) return;
        
        // Prevent default browser behavior
        event.preventDefault();
        
        this.keysPressed[event.code] = false;
        
        // Clear the movement interval
        if (this.movementIntervals[event.code]) {
            clearInterval(this.movementIntervals[event.code]);
            delete this.movementIntervals[event.code];
        }
        
        this.sendStopCommand();
    }
    
    sendMoveCommand(direction) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
        
        const moveMessage = {
            action: 'move',
            direction: direction
        };
        
        this.websocket.send(JSON.stringify(moveMessage));
        console.log('Sent move command:', direction);
    }
    
    sendStopCommand() {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) return;
        
        const stopMessage = {
            action: 'stop'
        };
        
        this.websocket.send(JSON.stringify(stopMessage));
        console.log('Sent stop command');
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.drawWorld();
        };
        this.worldImage.onerror = () => {
            console.error('Failed to load world map image');
        };
        this.worldImage.src = 'world.jpg';
    }
    
    connectToServer() {
        this.websocket = new WebSocket('wss://codepath-mmorg.onrender.com');
        
        this.websocket.onopen = () => {
            console.log('Connected to game server');
            this.joinGame();
        };
        
        this.websocket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleServerMessage(message);
            } catch (error) {
                console.error('Failed to parse server message:', error);
            }
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        this.websocket.onclose = () => {
            console.log('Disconnected from game server');
        };
    }
    
    joinGame() {
        const joinMessage = {
            action: 'join_game',
            username: 'DNari'
        };
        
        this.websocket.send(JSON.stringify(joinMessage));
        console.log('Sent join_game message');
    }
    
    handleServerMessage(message) {
        console.log('Received message:', message);
        
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.myPlayerId = message.playerId;
                    this.players = message.players;
                    this.avatars = message.avatars;
                    this.loadAvatarImages();
                    this.updateViewport();
                    this.startGameLoop();
                } else {
                    console.error('Failed to join game:', message.error);
                }
                break;
                
            case 'player_joined':
                this.players[message.player.id] = message.player;
                this.avatars[message.avatar.name] = message.avatar;
                this.loadAvatarImage(message.avatar);
                break;
                
            case 'players_moved':
                Object.assign(this.players, message.players);
                this.updateViewport();
                break;
                
            case 'player_left':
                delete this.players[message.playerId];
                break;
                
            default:
                console.log('Unknown message type:', message.action);
        }
    }
    
    loadAvatarImages() {
        for (const avatarName in this.avatars) {
            this.loadAvatarImage(this.avatars[avatarName]);
        }
    }
    
    loadAvatarImage(avatar) {
        const avatarKey = avatar.name;
        this.loadedAvatarImages[avatarKey] = {};
        
        // Load all frames for each direction
        for (const direction in avatar.frames) {
            this.loadedAvatarImages[avatarKey][direction] = [];
            
            avatar.frames[direction].forEach((base64Data, index) => {
                const img = new Image();
                img.onload = () => {
                    this.loadedAvatarImages[avatarKey][direction][index] = img;
                };
                img.src = base64Data;
            });
        }
    }
    
    updateViewport() {
        if (!this.myPlayerId || !this.players[this.myPlayerId]) return;
        
        const myPlayer = this.players[this.myPlayerId];
        
        // Center viewport on my avatar
        this.viewportX = Math.max(0, Math.min(
            myPlayer.x - this.canvas.width / 2,
            this.worldWidth - this.canvas.width
        ));
        this.viewportY = Math.max(0, Math.min(
            myPlayer.y - this.canvas.height / 2,
            this.worldHeight - this.canvas.height
        ));
    }
    
    startGameLoop() {
        const gameLoop = () => {
            this.render();
            requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }
    
    drawWorld() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the world map with viewport offset
        this.ctx.drawImage(
            this.worldImage,
            this.viewportX, this.viewportY, this.canvas.width, this.canvas.height,
            0, 0, this.canvas.width, this.canvas.height
        );
    }
    
    render() {
        this.drawWorld();
        this.drawPlayers();
    }
    
    drawPlayers() {
        for (const playerId in this.players) {
            const player = this.players[playerId];
            this.drawPlayer(player);
        }
    }
    
    drawPlayer(player) {
        // Convert world coordinates to screen coordinates
        const screenX = player.x - this.viewportX;
        const screenY = player.y - this.viewportY;
        
        // Skip if player is outside viewport
        if (screenX < -this.avatarSize || screenX > this.canvas.width + this.avatarSize ||
            screenY < -this.avatarSize || screenY > this.canvas.height + this.avatarSize) {
            return;
        }
        
        // Get avatar image
        const avatar = this.avatars[player.avatar];
        if (!avatar || !this.loadedAvatarImages[player.avatar]) return;
        
        const direction = player.facing;
        const frameIndex = player.animationFrame || 0;
        const avatarImages = this.loadedAvatarImages[player.avatar][direction];
        
        if (!avatarImages || !avatarImages[frameIndex]) return;
        
        const img = avatarImages[frameIndex];
        
        // Calculate avatar position (center the avatar on the player position)
        const avatarX = screenX - this.avatarSize / 2;
        const avatarY = screenY - this.avatarSize;
        
        // Draw avatar with proper scaling to maintain aspect ratio
        const aspectRatio = img.width / img.height;
        let drawWidth = this.avatarSize;
        let drawHeight = this.avatarSize;
        
        if (aspectRatio > 1) {
            drawHeight = this.avatarSize / aspectRatio;
        } else {
            drawWidth = this.avatarSize * aspectRatio;
        }
        
        const drawX = avatarX + (this.avatarSize - drawWidth) / 2;
        const drawY = avatarY + (this.avatarSize - drawHeight);
        
        this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        
        // Draw username label
        this.drawUsernameLabel(player.username, screenX, avatarY - 5);
    }
    
    drawUsernameLabel(username, x, y) {
        // Set text style
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        
        // Measure text for centering
        const textMetrics = this.ctx.measureText(username);
        const textWidth = textMetrics.width;
        const textX = x - textWidth / 2;
        
        // Draw text with outline
        this.ctx.strokeText(username, textX, y);
        this.ctx.fillText(username, textX, y);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
