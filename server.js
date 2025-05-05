const express = require('express');
const { google } = require('googleapis');
const cors = require('cors'); // Add this line

const app = express();
const port = process.env.PORT || 3000; // Use environment variable or default to 3000

// Middleware to parse JSON bodies
app.use(express.json());

// --- Configuration ---
// !! REPLACE WITH YOUR ACTUAL SPREADSHEET ID !!
const SPREADSHEET_ID = '1nFtISFMyL6nVlg3R3J6l11wpZGMkemukr7Lf-YqZKqA';
// !! REPLACE WITH THE SHEET NAME AND RANGE (e.g., 'Sheet1!A1') !!
// This range is where the new data will start being appended.
// The API appends after the last row with data in this range.
//const RANGE = 'DailyProductionEntry!A2';
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
// Enable CORS for all routes
app.use(cors());

// Or enable for specific origin
app.use(cors({
  origin: 'http://localhost:5173'
}));

// --- Basic Route ---
app.get('/', (req, res) => {
    res.send('Google Sheet Append API is running!');
});

// --- API Endpoint for append ---
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
        const RANGE = `${req.body.sheetName}!A2`;
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

// --- API Endpoint for Update ---
app.post('/update', async (req, res) => {
    console.log('Received request body for multiple row updates:', req.body);

    // Basic validation: Check if data exists and contains required fields
    if (!req.body || !req.body.rows || !Array.isArray(req.body.rows) || req.body.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid request body. Expected { "sheetName": "Sheet1", "rows": [ { "conditions": [...], "values": {...} }, ... ] }' });
    }

    const { sheetName, rows } = req.body; // Extract sheet name and rows from the request body

    try {
        const RANGE = `${sheetName}`; // Adjust range as needed
        const sheets = await getSheetsClient();

        // Fetch existing data to find the rows to update
        const getRequest = {
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
        };

        console.log('Fetching data from Google Sheets...');
        const getResponse = await sheets.spreadsheets.values.get(getRequest);
        const allRows = getResponse.data.values;

        if (!allRows || allRows.length === 0) {
            return res.status(404).json({ error: 'No data found in the sheet.' });
        }

        const headerRow = allRows[0]; // Assuming the first row is the header
        const updates = [];
        console.log('Header Row:', headerRow[0]);
        console.log('sheets data Rows count:', allRows.length);
        console.log('sheets data Rows count:', allRows[0].length);
        //console.log('sheets data Rows:', allRows[1][0]);
        // Process each row update request
        for (const rowUpdate of rows) {
            const { conditions, values } = rowUpdate;
            console.log('Processing row update:', rowUpdate);
            if (!Array.isArray(conditions) || conditions.length === 0 || typeof values !== 'object') {
                return res.status(400).json({ error: 'Invalid row update format. Each row must have "conditions" (array) and "values" (object).' });
            }

            // Find the row index based on the conditions
            const rowIndex = allRows.findIndex((row, index) => {
                //if (index === 0) return false; // Skip the header row

                return conditions.every(({ column, value }) => {
                    const columnIndex = headerRow.indexOf(column);
                    if (columnIndex === -1) {
                        console.log(`Column "${column}" not found in header row: ${headerRow}`);
                        return false; // Column not found
                    }

                    const cellValue = row[columnIndex]?.trim(); // Trim whitespace from cell value
                    const conditionValue = String(value).trim(); // Ensure condition value is a string

                    console.log(`Comparing cell value: "${cellValue}" with condition value: "${conditionValue}"`);

                    // Compare as numbers
                    if(Number(cellValue) === Number(conditionValue)){
                        return true;
                    }
                   // return Number(cellValue) === Number(conditionValue);
                });
            });

            if (rowIndex === -1) {
                console.log(`No row found matching conditions: ${JSON.stringify(conditions)}`);
                continue; // Skip if no matching row is found
            }

            // Merge existing row data with the new values
            const existingRow = allRows[rowIndex];
            const updatedRow = [...existingRow]; // Clone the existing row

            for (const [key, newValue] of Object.entries(values)) {
                const updateColumnIndex = headerRow.indexOf(key);
                if (updateColumnIndex === -1) {
                    return res.status(400).json({ error: `Column "${key}" not found in the sheet.` });
                }
                updatedRow[updateColumnIndex] = newValue; // Update the specific column
            }

            // Prepare the update request for this row
            updatedRow[1]= `'${existingRow[1]}`; // Ensure the first column is treated as text
            const updateRange = `${sheetName}!A${rowIndex + 1}:Z${rowIndex + 1}`;
            updates.push({
                range: updateRange,
                values: [updatedRow],
            });
        }

        // Execute all updates
        for (const update of updates) {
            const updateRequest = {
                spreadsheetId: SPREADSHEET_ID,
                range: update.range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: update.values,
                },
            };

            console.log(`Updating row at range ${update.range} with data:`, update.values);
            await sheets.spreadsheets.values.update(updateRequest);
        }

        res.status(200).json({ success: true, message: `${updates.length} rows updated successfully!` });

    } catch (err) {
        console.error('Error during Google Sheet multiple row update operation:', err);
        let errorMessage = 'Failed to update data in Google Sheet.';
        let googleErrorDetails = null;

        if (err.response && err.response.data) {
            console.error('Google API Error Response:', JSON.stringify(err.response.data, null, 2));
            googleErrorDetails = err.response.data.error;
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