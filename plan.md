# Plan: Node.js Backend for Google Sheet Appending

- [x] Initialize Node.js project (`npm init -y`)
- [x] Install dependencies (`npm install express googleapis`)
- [ ] Set up Google Cloud Project & Service Account Credentials
    - [ ] Go to Google Cloud Console: [https://console.cloud.google.com/](https://console.cloud.google.com/)
    - [ ] Create a new project (or select an existing one).
    - [ ] Enable the "Google Sheets API".
    - [ ] Go to "Credentials" -> "Create Credentials" -> "Service account".
    - [ ] Fill in the details, grant "Editor" role (or more specific if needed).
    - [ ] Create a key for the service account (JSON format) and download it. Save it securely as `credentials.json` in the project root (add it to `.gitignore` later).
    - [ ] Share the target Google Sheet with the service account's email address (found in the service account details).
- [x] Create `server.js` with basic Express setup.
- [x] Create `.gitignore` file.
- [x] Implement Google Sheets authentication logic in `server.js`.
- [x] Implement data appending logic in `server.js`.
- [x] Create a POST API endpoint (e.g., `/append`) in `server.js`.
- [x] Add error handling.
- [x] Add instructions to this file on how to:
    - [ ] **Configuration:**
        - Edit `server.js`:
            - Replace `'YOUR_SPREADSHEET_ID_HERE'` with your actual Google Sheet ID.
            - Replace `'Sheet1!A1'` with the correct sheet name and starting cell for appending (e.g., `'MyDataSheet!A1'`). The API appends after the last row found within this specified sheet.
        - Ensure `credentials.json` is in the project root and contains your valid service account key.
        - Ensure the Google Sheet is shared with the service account email address (found in `credentials.json` or Google Cloud Console) with "Editor" permissions.
    - [ ] **Run the Server:**
        - Open your terminal in the project directory (`/Users/logictrixinfotech/Documents/Project/google-sheet-append`).
        - Run the command: `node server.js`
        - You should see output like: `Server listening at http://localhost:3000` and `Successfully authenticated with Google Sheets API.` (if credentials are correct).
    - [ ] **Use the API:**
        - Send a POST request to `http://localhost:3000/append`.
        - The request body must be JSON and have the following structure:
          ```json
          {
            "values": [
              ["Value for Column A", "Value for Column B", "Value for Column C"],
              ["Another Row Value A", "Another Row Value B", "Another Row Value C"]
            ]
          }
          ```
          *Note: `values` must be an array of arrays, where each inner array represents a row.*
        - **Example using `curl`:**
          ```bash
          curl -X POST http://localhost:3000/append \
          -H "Content-Type: application/json" \
          -d '{
            "values": [
              ["Data 1", "Data 2", 123],
              ["More Data", "Test", 456]
            ]
          }'
          ```
        - **Example using Postman/Insomnia:**
            - Set the request type to POST.
            - Set the URL to `http://localhost:3000/append`.
            - Go to the "Body" tab, select "raw", and choose "JSON" from the dropdown.
            - Paste the JSON data (like the example above) into the body field.
            - Send the request.
        - A successful response will be JSON like: `{"success":true,"message":"Data appended successfully!","updates":{...}}`
        - An error response will be JSON like: `{"success":false,"error":"Failed to append data..."}`
- [ ] Test the API endpoint (using the methods above).