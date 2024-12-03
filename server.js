require('dotenv').config(); // For environment variables
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');

const path = require('path');



// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgresql_doublek_user',
    host: process.env.DB_HOST || 'dpg-ct71tm88fa8c73cml2j0-a.oregon-postgres.render.com',
    database: process.env.DB_NAME || 'postgresql_doublek',
    password: process.env.DB_PASSWORD || 'XASXnQAAuEdjzJ6LlUEyHcsbObGQYHRW',
    port: 5432,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000, // Timeout after 5 seconds
});

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Create tables if they don't exist
const createTables = async () => {
    const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
        user_id VARCHAR(50) PRIMARY KEY,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        dob DATE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(15) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`;

    const horsesTable = `
    CREATE TABLE IF NOT EXISTS horses (
        horse_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        image_url TEXT,
        location VARCHAR(100) NOT NULL,
        health_status VARCHAR(100) NOT NULL,
        temperament VARCHAR(100),
        training_level VARCHAR(100),
        age INT NOT NULL,
        breed VARCHAR(100),
        performance_history TEXT,
        maintenance_cost DECIMAL(10, 2),
        price DECIMAL(10, 2) NOT NULL,
        purchased BOOLEAN DEFAULT FALSE,
        auction_start_date TIMESTAMP,
        auction_end_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`;

    const purchasesTable = `
    CREATE TABLE IF NOT EXISTS purchases (
        purchase_id SERIAL PRIMARY KEY,
        horse_id INT NOT NULL REFERENCES horses(horse_id),
        horse_name VARCHAR(100) NOT NULL,
        buyer_name VARCHAR(100) NOT NULL,
        buyer_email VARCHAR(100) NOT NULL,
        buyer_phone VARCHAR(15) NOT NULL,
        card_number VARCHAR(16),
        billing_address TEXT NOT NULL,
        city VARCHAR(50) NOT NULL,
        postal_code VARCHAR(10) NOT NULL,
        country VARCHAR(50) NOT NULL,
        purchase_price DECIMAL(10, 2) NOT NULL,
        purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`;
    const auctionsTable = `
    CREATE TABLE IF NOT EXISTS auctions (
        auction_id SERIAL PRIMARY KEY,
        seller_name VARCHAR(100) NOT NULL,
        auction_date DATE NOT NULL,
        horse_name VARCHAR(100) NOT NULL,
        breed VARCHAR(50) NOT NULL,
        location VARCHAR(100) NOT NULL,
        age INT NOT NULL,
        health VARCHAR(50) NOT NULL
    );
`;

    

    try {
        await pool.query(usersTable);
        await pool.query(horsesTable);
        await pool.query(purchasesTable);
        await pool.query(auctionsTable);
        console.log('Tables created successfully!');
    } catch (err) {
        console.error('Error creating tables:', err);
        throw err;
    }
};


// Call table creation on server start
createTables();
// Serve static files (like CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// Root route to serve the login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route to serve the signup page
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

// Endpoint: Sign up a new user
app.post('/api/signup', async (req, res) => {
    const { firstName, lastName, dob, email, phone, password } = req.body;

    try {
        // Check if the email or phone already exists
        const userExists = await pool.query(
            'SELECT * FROM users WHERE email = $1 OR phone = $2',
            [email, phone]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'Email or phone number already exists.' });
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, 10);

        // Generate a unique user ID
        const userId = `DBLK-${email.split('@')[0]}-${new Date(dob).getFullYear()}-${phone.slice(-4)}`;

        // Insert the user into the database
        await pool.query(
            'INSERT INTO users (user_id, first_name, last_name, dob, email, phone, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [userId, firstName, lastName, dob, email, phone, passwordHash]
        );

        // Respond with the user ID
        res.status(201).json({ message: 'User registered successfully.', userId });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Endpoint: Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if the user exists
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Incorrect email or password.' });
        }

        const user = result.rows[0];

        // Validate the password
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect email or password.' });
        }

        // Respond with a success message or token
        return res.status(200).json({ message: 'Login successful.', userId: user.user_id , user});
    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ message: 'Unexpected error occurred.' });
    }
});

// Endpoint: Fetch all horses
app.get('/api/horses', async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 4; // Number of horses per page
    const offset = (page - 1) * limit;

    try {
        const { rows: horses } = await pool.query('SELECT * FROM horses LIMIT $1 OFFSET $2', [limit, offset]);
        res.json(horses);
    } catch (error) {
        console.error('Error fetching horses:', error);
        res.status(500).send('Error fetching horses');
    }
});

// Endpoint: Fetch horse details by ID
app.get('/horses/:id', async (req, res) => {
    const horseId = req.params.id;

    try {
        const result = await pool.query('SELECT * FROM horses WHERE horse_id = $1', [horseId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Horse not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching horse details:', err);
        res.status(500).json({ error: 'Failed to fetch horse details' });
    }
});

// Endpoint: Complete purchase
// Endpoint: Handle horse purchase


app.post('/purchase', async (req, res) => {
    const {
        horseId,
        buyerName,
        buyerEmail,
        buyerPhone,
        cardNumber,
        address,
        city,
        postalCode,
        country,
        purchasePrice,
    } = req.body;

    if (
        !horseId ||
        !buyerName ||
        !buyerEmail ||
        !buyerPhone ||
        !address ||
        !city ||
        !postalCode ||
        !country ||
        !purchasePrice
    ) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const client = await pool.connect(); // Start a transaction

    try {
        await client.query('BEGIN');

        // Check if the horse exists and is not purchased
        const horseResult = await client.query('SELECT * FROM horses WHERE horse_id = $1 AND purchased = FALSE', [
            horseId,
        ]);

        if (horseResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Horse not found or already purchased.' });
        }

        const horse = horseResult.rows[0];

        // Insert into purchases table
        await client.query(
            'INSERT INTO purchases (horse_id, horse_name, buyer_name, buyer_email, buyer_phone, card_number, billing_address, city, postal_code, country, purchase_price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
            [
                horseId,
                horse.name,
                buyerName,
                buyerEmail,
                buyerPhone,
                cardNumber.slice(-4), // Only store the last 4 digits
                address,
                city,
                postalCode,
                country,
                purchasePrice,
            ]
        );

        // Update horse's purchased status
        await client.query('UPDATE horses SET purchased = TRUE WHERE horse_id = $1', [horseId]);

        await client.query('COMMIT'); // Commit the transaction

        res.json({ message: 'Purchase successful!', horseName: horse.name });
    } catch (err) {
        await client.query('ROLLBACK'); // Rollback the transaction on error
        console.error('Error processing purchase:', err);
        res.status(500).json({ error: 'Error completing purchase.' });
    } finally {
        client.release(); // Release the client back to the pool
    }
});

// Fetching upcoming auctions
app.get('/upcoming-auctions', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM auctions ORDER BY auction_date ASC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching auctions:', err);
        res.status(500).json({ error: 'Failed to fetch auctions.' });
    }
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
