const express = require('express');
const { google } = require('googleapis');

const app = express();
const port = process.env.PORT || 3000; // Use environment variable or default to 3000

// Middleware to parse JSON bodies
app.use(express.json());

// --- Configuration ---
// !! REPLACE WITH YOUR ACTUAL SPREADSHEET ID !!
const SPREADSHEET_ID = '1hBzdJnRQDNjxkp4n65dpbagD1j6ndR6MScDx2IsRbKA';
// !! REPLACE WITH THE SHEET NAME AND RANGE (e.g., 'Sheet1!A1') !!
// This range is where the new data will start being appended.
// The API appends after the last row with data in this range.
const RANGE = 'Sheet1!A1';
const CREDENTIALS_PATH = './credentials.json'; // Path to your service account key file
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']; // Scope for Sheets API

// --- Google Sheets Authentication ---
async function getAuthClient() {
    console.log(`Attempting to authenticate using key file: ${CREDENTIALS_PATH}`);
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: CREDENTIALS_PATH,
            scopes: SCOPES,
        });
        const client = await auth.getClient();
        console.log('Successfully obtained Google Auth client.');
        return client;
    } catch (error) {
        console.error(`Error getting auth client: ${error.message}`, error.stack);
        throw error; // Re-throw the error to be caught later
    }
}

async function getSheetsClient() {
    console.log('Attempting to get Sheets API client...');
    const authClient = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    console.log('Successfully obtained Sheets API client.');
    return sheets;
}

// --- Basic Route ---
app.get('/', (req, res) => {
    res.send('Google Sheet Append API is running!');
});

// --- API Endpoint ---
app.post('/append', async (req, res) => {
    console.log('Received request body:', req.body); // Log received data

    // Basic validation: Check if data exists and is an array
    if (!req.body || !req.body.values || !Array.isArray(req.body.values)) {
        return res.status(400).json({ error: 'Invalid request body. Expected { "values": [...] }' });
    }
    // Ensure values is an array of arrays, as required by the API
    if (!Array.isArray(req.body.values[0])) {
         return res.status(400).json({ error: 'Invalid request body format. "values" should be an array of arrays, e.g., { "values": [["value1", "value2"]] }' });
    }

    const valuesToAppend = req.body.values; // e.g., [["valueA1", "valueB1"], ["valueA2", "valueB2"]]

    try {
        const sheets = await getSheetsClient();
        const request = {
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE, // The range where to search for the last row and append after it
            valueInputOption: 'USER_ENTERED', // How the input data should be interpreted (USER_ENTERED treats it like user typing)
            insertDataOption: 'INSERT_ROWS', // Insert new rows for the data
            resource: {
                values: valuesToAppend,
            },
        };

        console.log('Sending append request to Google Sheets API with:', JSON.stringify(request, null, 2));
        const response = await sheets.spreadsheets.values.append(request);

        console.log('Append response:', response.data);
        res.status(200).json({ success: true, message: 'Data appended successfully!', updates: response.data.updates });

    } catch (err) {
        console.error('Error during Google Sheet append operation:', err); // Log the full error object
        let errorMessage = 'Failed to append data to Google Sheet.';
        let googleErrorDetails = null;

        if (err.response && err.response.data) {
            console.error('Google API Error Response:', JSON.stringify(err.response.data, null, 2));
            googleErrorDetails = err.response.data.error; // Extract error details if available
            if (googleErrorDetails && googleErrorDetails.message) {
                 errorMessage += ` Google API Error (${googleErrorDetails.code || 'Unknown Code'} - ${googleErrorDetails.status || 'Unknown Status'}): ${googleErrorDetails.message}`;
            } else {
                 errorMessage += ` Google API returned an error structure: ${JSON.stringify(err.response.data)}`;
            }
        } else {
             errorMessage += ` Error: ${err.message}`;
        }
        res.status(500).json({ success: false, error: errorMessage });
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    // Verify auth on startup (optional, good for debugging)
    getSheetsClient().then(() => {
        console.log('Successfully authenticated with Google Sheets API.');
    }).catch(err => {
        console.error('Error authenticating with Google Sheets API:', err.message);
        console.error('Ensure credentials.json exists and the Sheets API is enabled.');
        console.error('Also ensure the sheet is shared with the service account email.');
    });
});