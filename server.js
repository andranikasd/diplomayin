const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./src/database/connection');
const chatRoutes = require('./src/routes/chat');
const dataRoutes = require('./src/routes/data');
const authRoutes = require('./src/routes/auth');
const { authMiddleware } = require('./src/middleware/auth');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false // Allow inline scripts for development
}));
app.use(compression());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Static files
app.use(express.static('public'));

// Public auth routes (no token required)
app.use('/api/auth', authRoutes);

// Protected API routes (require valid JWT)
const sqlRoutes = require('./src/routes/sql');
app.use('/api/chat', authMiddleware, chatRoutes);
app.use('/api/data', authMiddleware, dataRoutes);
app.use('/api/sql', authMiddleware, sqlRoutes);

// Health check endpoint (public)
app.get('/api/health', async (req, res) => {
    const dbHealthy = await db.healthCheck();

    res.json({
        status: dbHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        database: dbHealthy ? 'connected' : 'disconnected'
    });
});

// Serve login page for unauthenticated root requests
app.get('/login', (_req, res) => {
    res.sendFile('login.html', { root: 'public' });
});

// WebSocket for real-time chat
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('chat-message', async (_data) => {
        try {
            socket.emit('message-received', { received: true });
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Error handling middleware
app.use((err, _req, res, _next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Start server
async function startServer() {
    try {
        const dbHealthy = await db.healthCheck();
        if (!dbHealthy) {
            console.warn('⚠️  Database connection failed, but starting server anyway...');
        }

        server.listen(PORT, () => {
            console.log(`\n🚀 Armenian OSINT Analytics Server`);
            console.log(`📡 Server running on http://localhost:${PORT}`);
            console.log(`💾 Database: ${dbHealthy ? '✅ Connected' : '❌ Disconnected'}`);
            console.log(`🔐 Auth: JWT enabled`);
            console.log(`🔌 WebSocket: Enabled`);
            console.log(`\n📝 Available endpoints:`);
            console.log(`   POST /api/auth/register`);
            console.log(`   POST /api/auth/login`);
            console.log(`   GET  /api/auth/me`);
            console.log(`   GET  /api/health`);
            console.log(`   GET  /api/data/summary      (protected)`);
            console.log(`   POST /api/chat              (protected)`);
            console.log(`\n Press Ctrl+C to stop\n`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

module.exports = { app, server, io };
