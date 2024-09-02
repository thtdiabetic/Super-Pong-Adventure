// Game variables
const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');
let playerScore = 0;
let computerScore = 0;
let stains = [];
let obstacles = [];
let serving = false;
let serveAngle = 0;
let particles = [];
let screenShake = 0;
let lastPlayerPaddleY = 0;
let playerPaddleSpeed = 0;
let combo = 0;
let comboTimer = 0;
let computerPaddleBleed = 0;
let bloodDrops = [];
let gameOver = false;
let winner = null;
let isPaused = false;
const pauseMenu = document.getElementById('pauseMenu');
const resumeButton = document.getElementById('resumeButton');
const restartButton = document.getElementById('restartButton');
const pauseButton = document.getElementById('pauseButton');

// Ball properties
let ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    speed: 5,
    dx: 5,
    dy: 5,
    spin: 0 // Add this new property for lateral movement
};

// Paddle properties
const paddleHeight = 100;
const paddleWidth = 10;
let playerPaddle = { x: 0, y: canvas.height / 2 - paddleHeight / 2, flash: 0, angle: 0, broken: false, fallSpeed: 0 };
let computerPaddle = { x: canvas.width - paddleWidth - 50, y: canvas.height / 2 - paddleHeight / 2, flash: 0, angle: 0, broken: false, fallSpeed: 0 };

// Audio elements
const backgroundMusic = document.getElementById('backgroundMusic');
const playerScoreSound = document.getElementById('playerScoreSound');
const computerScoreSound = document.getElementById('computerScoreSound');
const hitSound = document.getElementById('hitSound');

// Start background music
backgroundMusic.play();

// Add these variables at the top of your file with other game variables
let lastHitTime = 0;
const comboCooldown = 200; // milliseconds

// Game loop
function gameLoop() {
    if (!isPaused) {
        if (!gameOver) {
            updateGame();
        } else {
            updateGameOver();
        }
        drawGame();
    }
    requestAnimationFrame(gameLoop);
}

function updateGame() {
    // Calculate paddle speed
    playerPaddleSpeed = playerPaddle.y - lastPlayerPaddleY;
    lastPlayerPaddleY = playerPaddle.y;

    // Update combo timer
    if (comboTimer > 0) {
        comboTimer--;
    } else if (combo > 0) {
        combo = 0;
    }

    // Update computer paddle bleed
    if (computerPaddleBleed > 0) {
        computerPaddleBleed--;
        if (computerPaddleBleed % 5 === 0) { // Create a new blood drop every 5 frames
            bloodDrops.push({
                x: computerPaddle.x + Math.random() * paddleWidth,
                y: computerPaddle.y + paddleHeight,
                speed: Math.random() * 2 + 1
            });
        }
    }

    // Update blood drops
    bloodDrops.forEach((drop, index) => {
        drop.y += drop.speed;
        if (drop.y > canvas.height) {
            bloodDrops.splice(index, 1);
        }
    });

    if (serving) {
        // Update serve angle
        serveAngle = Math.atan2(ball.y - playerPaddle.y, ball.x - playerPaddle.x);
        return;
    }

    // Move the ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Apply spin effect
    ball.x += ball.spin;

    // Apply very subtle friction
    ball.dx *= 0.9999;
    ball.dy *= 0.9999;

    // Ball collision with top and bottom walls
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        ball.dy *= -1;
        createHitEffect(ball.x, ball.y);
    }

    // Ball collision with paddles
    if (checkPaddleCollision(ball, playerPaddle)) {
        handlePaddleHit(playerPaddle, playerPaddleSpeed);
    }
    if (checkPaddleCollision(ball, computerPaddle)) {
        handlePaddleHit(computerPaddle, 0);
    }

    // Update particles
    particles.forEach((particle, index) => {
        particle.x += particle.dx;
        particle.y += particle.dy;
        particle.life--;
        if (particle.life <= 0) {
            particles.splice(index, 1);
        }
    });

    // Check collision with obstacles
    obstacles.forEach(obstacle => {
        if (checkCollision(ball, obstacle)) {
            // Reflect ball off obstacle
            let dx = ball.x - obstacle.x;
            let dy = ball.y - obstacle.y;
            let angle = Math.atan2(dy, dx);
            let speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
            ball.dx = Math.cos(angle) * speed;
            ball.dy = Math.sin(angle) * speed;
        }
    });

    // Ball scoring
    if (ball.x - ball.radius < 0) {
        // Computer scores
        computerScore++;
        computerScoreSound.play();
        createParticles(ball.x, ball.y, 'red');
        createStains(ball.x, ball.y, 'red');
        animateScore('computerScore');
        checkGameOver();
        resetBall();
    } else if (ball.x + ball.radius > canvas.width) {
        // Player scores
        playerScore++;
        playerScoreSound.play();
        createParticles(ball.x, ball.y, 'blue');
        createStains(ball.x, ball.y, 'blue');
        animateScore('playerScore');
        checkGameOver();
        resetBall();
    }

    // Computer paddle movement (improved AI)
    const paddleCenter = computerPaddle.y + paddleHeight / 2;
    const ballFutureX = ball.x + ball.dx * 30; // Predict ball position 30 frames ahead
    const ballFutureY = ball.y + ball.dy * 30;
    let targetY = paddleCenter;

    // Only move if the ball is moving towards the computer's side
    if (ball.dx > 0) {
        // Calculate where the ball will intersect with the paddle's x position
        const intersectY = ball.y + (ball.dy / ball.dx) * (computerPaddle.x - ball.x);
        targetY = intersectY;
    }

    // Vertical movement
    const verticalSpeed = 5;
    if (paddleCenter < targetY - 10) {
        computerPaddle.y += verticalSpeed;
    } else if (paddleCenter > targetY + 10) {
        computerPaddle.y -= verticalSpeed;
    }

    // Horizontal movement
    const horizontalSpeed = 3;
    const midPoint = canvas.width / 2;
    const maxDistance = canvas.width / 4; // Maximum distance from the right edge

    // Move horizontally based on ball position and prediction
    if (ballFutureX > midPoint) {
        if (computerPaddle.x > canvas.width - maxDistance) {
            computerPaddle.x -= horizontalSpeed;
        }
    } else {
        if (computerPaddle.x < canvas.width - paddleWidth - 20) {
            computerPaddle.x += horizontalSpeed;
        }
    }

    // Ensure the computer paddle stays within bounds
    computerPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, computerPaddle.y));
    computerPaddle.x = Math.max(midPoint, Math.min(canvas.width - paddleWidth, computerPaddle.x));

    // Update screen shake
    if (screenShake > 0) {
        screenShake--;
    }

    // Update paddle flash timers
    if (playerPaddle.flash > 0) {
        playerPaddle.flash--;
    }
    if (computerPaddle.flash > 0) {
        computerPaddle.flash--;
    }
}

function updateGameOver() {
    if (winner === 'player') {
        playerPaddle.angle += 10; // Spin around
        if (computerPaddle.broken) {
            computerPaddle.fallSpeed += 0.5; // Increase fall speed
            computerPaddle.y += computerPaddle.fallSpeed; // Fall down
        }
    } else if (winner === 'computer') {
        computerPaddle.angle += 10; // Spin around
        if (playerPaddle.broken) {
            playerPaddle.fallSpeed += 0.5; // Increase fall speed
            playerPaddle.y += playerPaddle.fallSpeed; // Fall down
        }
    }

    // Check if the losing paddle has fallen off the screen
    if (playerPaddle.y > canvas.height || computerPaddle.y > canvas.height) {
        // Show restart button
        togglePause();
    }
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw serve line
    if (serving) {
        ctx.beginPath();
        ctx.moveTo(playerPaddle.x + paddleWidth / 2, playerPaddle.y + paddleHeight / 2);
        ctx.lineTo(playerPaddle.x + paddleWidth / 2 + Math.cos(serveAngle) * 50, 
                   playerPaddle.y + paddleHeight / 2 + Math.sin(serveAngle) * 50);
        ctx.strokeStyle = 'red';
        ctx.stroke();
    }

    // Draw paddles with glow effect
    ctx.shadowBlur = 40; // Increase shadow blur for brighter glow
    ctx.shadowColor = '#00bfff';
    ctx.fillStyle = playerPaddle.flash > 0 ? '#00ffff' : '#00bfff'; // Flash effect
    drawPaddle(playerPaddle);
    ctx.fillStyle = computerPaddle.flash > 0 ? '#00ffff' : '#00bfff'; // Flash effect
    drawPaddle(computerPaddle);
    ctx.shadowBlur = 0;

    // Draw blood drops
    ctx.fillStyle = 'red';
    bloodDrops.forEach(drop => {
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, 2, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw blood pool at the bottom
    let gradient = ctx.createLinearGradient(0, canvas.height - 10, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(255, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0.5)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

    // Draw ball with glow effect
    ctx.shadowBlur = 40; // Increase shadow blur for brighter glow
    ctx.shadowColor = '#00bfff';
    ctx.fillStyle = '#00bfff';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
    ctx.shadowBlur = 0;

    // Draw combo
    if (combo > 0) {
        ctx.font = `${20 + combo * 2}px Arial`;
        ctx.fillStyle = `rgba(0, 191, 255, ${comboTimer / 120})`;
        ctx.textAlign = 'center';
        ctx.fillText(`Combo x${combo}!`, canvas.width / 2, canvas.height / 2);
    }

    // Update score display
    document.getElementById('playerScore').textContent = playerScore;
    document.getElementById('computerScore').textContent = computerScore;

    if (screenShake > 0) {
        ctx.restore(); // Restore the canvas state after screen shake
    }
}

function drawPaddle(paddle) {
    if (paddle.broken) {
        // Draw broken paddle
        ctx.save();
        ctx.translate(paddle.x + paddleWidth / 2, paddle.y + paddleHeight / 2);
        ctx.rotate(paddle.angle * Math.PI / 180);
        ctx.fillRect(-paddleWidth / 2, -paddleHeight / 2, paddleWidth, paddleHeight / 2);
        ctx.restore();
        ctx.save();
        ctx.translate(paddle.x + paddleWidth / 2, paddle.y + paddleHeight / 2 + paddleHeight / 2);
        ctx.rotate(-paddle.angle * Math.PI / 180);
        ctx.fillRect(-paddleWidth / 2, -paddleHeight / 2, paddleWidth, paddleHeight / 2);
        ctx.restore();
    } else {
        // Draw normal paddle
        ctx.save();
        ctx.translate(paddle.x + paddleWidth / 2, paddle.y + paddleHeight / 2);
        ctx.rotate(paddle.angle * Math.PI / 180);
        ctx.fillRect(-paddleWidth / 2, -paddleHeight / 2, paddleWidth, paddleHeight);
        ctx.restore();
    }
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.dx = 0;
    ball.dy = 0;
    ball.spin = 0;
    serving = true;
    // Reset combo when ball is reset
    combo = 0;
    comboTimer = 0;
}

function serve() {
    serving = false;
    let speed = 5;
    ball.dx = Math.cos(serveAngle) * speed;
    ball.dy = Math.sin(serveAngle) * speed;
}

function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.radius &&
           obj1.x + obj1.radius > obj2.x &&
           obj1.y < obj2.y + obj2.radius &&
           obj1.y + obj2.radius > obj2.y;
}

function createHitEffect(x, y) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x,
            y: y,
            radius: Math.random() * 3 + 1,
            dx: (Math.random() - 0.5) * 4,
            dy: (Math.random() - 0.5) * 4,
            life: 20
        });
    }
    hitSound.play();
}

function createParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x,
            y: y,
            radius: Math.random() * 3 + 1,
            dx: (Math.random() - 0.5) * 4,
            dy: (Math.random() - 0.5) * 4,
            life: 20,
            color: color
        });
    }
}

function createStains(x, y, color) {
    stains.push({
        x: x,
        y: y,
        radius: Math.random() * 20 + 10,
        color: color
    });
}

function handlePaddleHit(paddle, paddleSpeed) {
    const currentTime = Date.now();

    // Only change direction if the ball is moving away from the center
    if ((paddle === playerPaddle && ball.dx < 0) || (paddle === computerPaddle && ball.dx > 0)) {
        ball.dx *= -1.05; // Slight speed increase on each hit
    }

    // Calculate hit position relative to the paddle center
    const hitPos = (ball.y - (paddle.y + paddleHeight / 2)) / (paddleHeight / 2);

    // Adjust vertical speed based on where the ball hit the paddle
    ball.dy = hitPos * 7;

    // Add some of the paddle's vertical speed to the ball
    ball.dy += paddleSpeed * 0.2;

    // Limit maximum vertical speed
    ball.dy = Math.max(Math.min(ball.dy, 10), -10);

    // Add spin effect
    ball.spin = paddleSpeed * 0.1;

    // Visual feedback
    createHitEffect(ball.x, ball.y);
    paddle.flash = 10; // Flash paddle for 10 frames

    // Audio feedback
    hitSound.currentTime = 0; // Reset sound to start
    hitSound.play();

    // Screen shake effect
    screenShake = 5;

    // Increment combo with cooldown
    if (currentTime - lastHitTime > comboCooldown) {
        combo++;
        comboTimer = 120;
        lastHitTime = currentTime;
    }
}

function checkPaddleCollision(ball, paddle) {
    return ball.x - ball.radius <= paddle.x + paddleWidth &&
           ball.x + ball.radius >= paddle.x &&
           ball.y >= paddle.y &&
           ball.y <= paddle.y + paddleHeight;
}

// Update the paddle position based on mouse movement
canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    playerPaddle.y = event.clientY - rect.top - paddleHeight / 2;
    playerPaddle.x = event.clientX - rect.left - paddleWidth / 2; // Allow horizontal movement
    // Ensure the paddle stays within the canvas
    playerPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, playerPaddle.y));
    playerPaddle.x = Math.max(0, Math.min(canvas.width - paddleWidth, playerPaddle.x));
});

canvas.addEventListener('click', () => {
    if (serving) {
        serve();
    }
});

function animateScore(scoreId) {
    const scoreElement = document.getElementById(scoreId);
    scoreElement.classList.add('flash');
    setTimeout(() => {
        scoreElement.classList.remove('flash');
    }, 500);
}

function checkGameOver() {
    if (playerScore >= 5 || computerScore >= 5) {
        gameOver = true;
        winner = playerScore >= 5 ? 'player' : 'computer';
        togglePause(); // Show pause menu when game is over
    }
}

function togglePause() {
    isPaused = !isPaused;
    console.log('Toggling pause. isPaused:', isPaused);
    if (isPaused) {
        pauseMenu.style.display = 'block';
        pauseButton.textContent = '▶';
        console.log('Showing pause menu');
    } else {
        pauseMenu.style.display = 'none';
        pauseButton.textContent = '| |';
        console.log('Hiding pause menu');
    }
}

function restartGame() {
    playerScore = 0;
    computerScore = 0;
    gameOver = false;
    winner = null;
    playerPaddle = { x: 0, y: canvas.height / 2 - paddleHeight / 2, flash: 0, angle: 0, broken: false, fallSpeed: 0 };
    computerPaddle = { x: canvas.width - paddleWidth - 50, y: canvas.height / 2 - paddleHeight / 2, flash: 0, angle: 0, broken: false, fallSpeed: 0 };
    resetBall();
    togglePause();
}

// Event listeners
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        togglePause();
    }
});

pauseButton.addEventListener('click', togglePause);
resumeButton.addEventListener('click', togglePause);
restartButton.addEventListener('click', restartGame);

document.addEventListener('DOMContentLoaded', (event) => {
    const pauseMenu = document.getElementById('pauseMenu');
    const resumeButton = document.getElementById('resumeButton');
    const restartButton = document.getElementById('restartButton');

    if (!pauseMenu) console.error('Pause menu not found');
    if (!resumeButton) console.error('Resume button not found');
    if (!restartButton) console.error('Restart button not found');

    resetBall();
    gameLoop();
});