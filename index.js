// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bwipjs = require('bwip-js');
const PDFDocument = require('pdfkit');

/**
 * Initialize Express application
 */
const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Session Configuration
 * - secret: Used to sign the session ID cookie (use a strong secret in production)
 * - resave: Forces the session to be saved back to the session store
 * - saveUninitialized: Forces a session that is "uninitialized" to be saved to the store
 * - proxy: Trust the reverse proxy (needed for secure cookies in production)
 * - cookie.secure: Ensures cookies are only sent over HTTPS in production
 * - cookie.sameSite: 'lax' for CSRF protection
 */
app.set('trust proxy', 1); // Trust first proxy
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

/**
 * Middleware Setup
 * - Parse URL-encoded bodies (as sent by HTML forms)
 * - Parse JSON bodies (as sent by API clients)
 * - Serve static files from the 'public' directory
 * - Set up EJS as the view engine
 * - Set the views directory
 */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/**
 * In-memory user store
 * Note: In a production environment, use a proper database
 */
const users = [];

/**
 * Creates a default user on application startup
 * - Hashes the password using bcrypt with salt round 10
 * - Adds the user to the in-memory store
 */
async function createDefaultUser() {
    const username = 'test';
    const password = 'test123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    users.push({
        id: 1,
        username,
        password: hashedPassword
    });
    
    console.log('Default user created:', username);
}

/**
 * Authentication Middleware
 * Protects routes that require authentication
 * - Checks if user is logged in via session
 * - Redirects to login page if not authenticated
 */
const requireAuth = (req, res, next) => {
    if (req.session.loggedIn) {
        return next();
    }
    res.redirect('/');
};

/**
 * Cleans up the barcode directory on application startup
 * - Removes any leftover barcode images from previous sessions
 */
function cleanupBarcodeDirectory() {
    const barcodeDir = path.join(__dirname, 'public', 'barcodes');
    if (fs.existsSync(barcodeDir)) {
        const files = fs.readdirSync(barcodeDir);
        files.forEach(file => {
            fs.unlinkSync(path.join(barcodeDir, file));
        });
        console.log('Cleaned up barcode directory');
    }
}

/**
 * Route: GET /
 * Renders the login page if user is not authenticated
 * Redirects to dashboard if user is already logged in
 */
app.get('/', (req, res) => {
    if (req.session.loggedIn) {
        return res.redirect('/dashboard');
    }
    res.render('login', { error: null });
});

/**
 * Route: POST /login
 * Handles user authentication
 * - Validates username and password
 * - Sets up session on successful authentication
 * - Returns error for invalid credentials
 */
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    
    if (user && await bcrypt.compare(password, user.password)) {
        req.session.loggedIn = true;
        req.session.userId = user.id;
        return res.redirect('/dashboard');
    }
    
    res.render('login', { error: 'Invalid username or password' });
});

/**
 * Route: GET /dashboard
 * Protected route that renders the dashboard
 * - Requires authentication
 * - Displays the delivery label generation form
 */
app.get('/dashboard', requireAuth, (req, res) => {
    res.render('dashboard');
});

/**
 * Route: POST /generate-label
 * Protected route that generates a delivery label PDF
 * - Validates form data
 * - Generates a unique delivery ID
 * - Creates a barcode image
 * - Generates a PDF with sender/receiver info and barcode
 * - Streams the PDF to the client
 * - Cleans up temporary barcode image
 */
app.post('/generate-label', requireAuth, async (req, res) => {
    try {
        const { senderName, senderAddress, receiverName, receiverAddress } = req.body;
        // Generate a unique delivery ID using Node's built-in crypto module
        const deliveryId = crypto.randomUUID();
        const barcodePath = path.join('public', 'barcodes', `${deliveryId}.png`);
        
        // Generate barcode
        await new Promise((resolve, reject) => {
            bwipjs.toBuffer({
                bcid: 'code128',
                text: deliveryId,
                scale: 2,
                height: 10,
                includetext: true,
                textxalign: 'center',
            }, (err, png) => {
                if (err) return reject(err);
                fs.writeFileSync(barcodePath, png);
                resolve();
            });
        });
        
        // Create PDF
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="delivery-label-${deliveryId}.pdf"`);
        
        doc.pipe(res);
        
        // Add content to PDF
        doc.fontSize(20).text('DELIVERY LABEL', { align: 'center' });
        doc.moveDown();
        
        // Sender info
        doc.fontSize(14).text('From:', { underline: true });
        doc.fontSize(12).text(senderName);
        doc.text(senderAddress);
        doc.moveDown();
        
        // Receiver info
        doc.fontSize(14).text('To:', { underline: true });
        doc.fontSize(12).text(receiverName);
        doc.text(receiverAddress);
        doc.moveDown();
        
        // Delivery ID and barcode
        doc.fontSize(12).text(`Delivery ID: ${deliveryId}`);
        doc.image(barcodePath, { fit: [300, 100], align: 'center' });
        
        // Finalize PDF and clean up
        doc.end(() => {
            // Delete the temporary barcode file after the PDF is sent
            fs.unlink(barcodePath, (err) => {
                if (err) console.error('Error deleting barcode file:', err);
            });
        });
        
    } catch (error) {
        console.error('Error generating label:', error);
        res.status(500).send('Error generating label');
    }
});

/**
 * Route: POST /logout
 * Handles user logout
 * - Destroys the current session
 * - Redirects to the home page
 */
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('Error destroying session:', err);
        res.redirect('/');
    });
});

/**
 * Server Initialization
 * - Creates default user
 * - Cleans up barcode directory
 * - Starts the Express server
 */
async function startServer() {
    try {
        await createDefaultUser();
        cleanupBarcodeDirectory();
        
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log('Default credentials:');
            console.log('  Username: test');
            console.log('  Password: test123');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer();
