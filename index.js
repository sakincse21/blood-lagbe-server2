const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
// const firebase=require('./firebase');
const admin = require('firebase-admin');
const { jwtDecode } = require('jwt-decode');

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
const port = 3001;


admin.initializeApp({
    credential: admin.credential.cert({
        type: process.env.FIREBASE_TYPE,
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: process.env.FIREBASE_AUTH_URI,
        token_uri: process.env.FIREBASE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL,
        client_x509_cert_url: process.env.FIREBASE_CERT_URL,
        universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN
    })
});

async function verifyToken(idToken) {
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log("Decoded Token:", decodedToken);
        return decodedToken;
    } catch (error) {
        console.error("Error verifying ID token:", error);
        throw error;
    }
}

function dateCalculation(pastdate, newdate) {
    // Parse the string date '2024-10-02'
    const pastDate = new Date(pastdate);
    // Get the current date
    const newDate = new Date(newdate);

    // Calculate the time difference in milliseconds
    const timeDifference = newDate - pastDate;

    // Convert the difference from milliseconds to days
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    const daysDifference = Math.floor(timeDifference / millisecondsPerDay);



    // Output the difference
    return daysDifference;

}


// MongoDB connection URL and database name
const uri = process.env.URI;
const dbName = 'blood-lagbe'; // Replace with your database name


let db;


// Connecting to MongoDB
MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(client => {
        console.log('Connected to MongoDB');
        db = client.db(dbName);
    })
    .catch(error => console.error(error));


// JWT secret (you should store this in environment variables for security)
//const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';


// Route to search for donors
app.get('/donors', async (req, res) => {
    try {
        const { area, bloodGroup } = req.query;


        // Build the search query
        const query = {};
        if (area) query.area = new RegExp(area, 'i');
        if (bloodGroup) query.bloodGroup = bloodGroup;


        // Access the 'donors' collection and search with the query
        const donors = await db.collection('donors').find(query).toArray();
        res.send(donors);
    } catch (error) {
        console.error('Error fetching donors:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Route to become a donor
app.post('/beadonor', async (req, res) => {
    const user = req.body;
    try {
        const query = { mobile: user.mobile };
        const checkUser = await db.collection('donors').find(query).toArray();


        if (checkUser.length) {
            res.send(checkUser[0]);
        } else {
            const donors = db.collection('donors');
            const result = await donors.insertOne(user);
            res.send(user);
        }
    } catch (error) {
        console.error('Error inserting user document:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Route to update lastDonation
app.patch('/update', async (req, res) => {
    const { name, age, area, mobile, token, email, lastDonation } = req.body;
    // console.log(req.body);

    // Verify and decode the JWT token
    // idToken comes from the client app

    const decodedToken = jwtDecode(token);
    const authEmail = decodedToken.email;

    // console.log(decodedToken);

    console.log(lastDonation);




    // Check if the provided email matches the email in the token
    if (email !== authEmail) {
        return res.status(403).json({ message: 'Email does not match token' });
    }


    try {
        // Find the user by email and update their lastDonation array
        const query = { email };
        const checkUser = await db.collection('donors').find(query).toArray();
        const date = checkUser[0].date;
        const prevDate=date[0];
        date.reverse();
        console.log(dateCalculation(date[0], lastDonation));
        
        // const next = checkUser[0].date;
        if (dateCalculation(date[0], lastDonation) >= 90) {
            date.push(lastDonation);
        }
        date.reverse();
        // console.log(checkUser[0].date);
        // checkUser[0].date.push(lastDonation);
        console.log(date);



        const filter = { email: `${email}` };
        const update = { $set: { date, name, age, mobile, area } };

        await db.collection('donors').updateOne(filter, update);


        res.status(200).json({ message: 'Donation date updated successfully', user: checkUser[0].name });
    } catch (error) {
        console.error('Error updating donation date:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Route to check if a user is a donor
app.get('/isdonor', async (req, res) => {

    const email = req.query.email;

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];  // Extract token from "Bearer <token>"
  
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const query = { email };
        const checkUser = await db.collection('donors').find(query).toArray();


        if (checkUser.length) {
            res.send(checkUser[0]);
        } else {
            res.send({ isDonor: false });
        }
    } catch (error) {
        console.error('Error checking donor:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Basic hello route
app.get('/', (req, res) => {
    res.send('Hello user');
});


// Start the server
app.listen(port, () => {
    console.log(`App started on port ${port}`);
});
