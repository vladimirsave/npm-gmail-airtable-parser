## About
This is a NodeJS application which uses Google OAuth and Airtable to authenticate users and fetches attachments from their Gmail account based on the search query. The attachments are downloaded on the server and the unique attachment id is stored in the MongoDB database. We can then download the attachment by providing the attachment id.

## Prerequisites
### Setting up MongoDB Project
- Create a new cluster in [MongoDB](https://www.mongodb.com/) to store user and email data. Copy the connection string and add the `MONGO_URI` to the `.env` file

### Setting up project in Google Cloud
- Go to [Google Cloud Console](https://console.cloud.google.com) and create a new project
- Enabling Google API
    - In sidemenu options, select `APIs and Services` -> `Library` -> Search for `Gmail API` and enable it
- Setting up the OAuth Screen
    - Inside `APIs and Services` -> `OAuth Consent Screen` -> Select `User Type` (Select `External` for testing) and click on `Create`
    - Now enter all the application details and click `Save and Continue`
    - Inside `Scopes` section -> `Add Scopes` -> Seach for `Gmail API` and select the `/auth/gmail.readonly` scope. This gives our app access to read the user's emails -> `Save and Continue`
    - If your application is still in `Testing` phase and you selected `External` user type in Step 1, you'll have to provide email ids of all the users who can access your app -> `Save and Continue`
    - Check the app summary and click `Save`
- Generating Credentials
    - Again in `APIs and Services`, select `Credentials` -> `Create Credentials` -> `oAuth Client ID`
    - Select `Application Type` (Web Application), add authorized origin (Use `http://localhost:3000` if you don't have a Domain) and a callback URL where Google will send the response after OAuth (`http://localhost:3000/auth/google/callback` in our case). Also add this as `CALLBACK_URL` in the `.env` file
    - Save you client id and secret as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the `.env` file

### Setting up project in AirTable
Take constants from Airtable to .env file: AIRTABLE_BASE_ID=, CLIENT_ID_AIRTABLE=.
Setup OAutg redirect URL http://localhost:4000/airtable-oauth
Register an integration at https://airtable.com/create/oauth
Scopes:
data.records:read
data.records:write
data.recordComments:read
data.recordComments:write
schema.bases:read
schema.bases:write

### Setting up project in PDF.CO
Take constants from PDF.CO to .env file: API_KEY_PDFCO=
https://app.pdf.co/

## Setup
- Clone the github repo
- Open terminal, go to the directory and run `npm i`
- Make sure followed all the above steps and added all the variable as specified in the `.sample.env` inside the `.env` file
- Run `npm run dev` which will start a Nodejs server at `localhost:3000`

## Specification
Objective:
The objective of this project is to automate the process of extracting multiple values from PDF documents received via email, and then load the extracted data into Airtable. 

Requirements:
Email Monitoring:
The system should monitor the designated email inbox for incoming messages.
The system should periodically check for new emails and trigger the automation process when an email with the specified name is detected.

Document Identification:
The automation system should be capable of identifying the specific subject of the email that contains the PDF document to be processed.
A rule or condition should be set up to trigger the extraction process based on the identified email.

PDF Data Extraction:
Utilize a PDF parsing library to extract the relevant information(Date, Fund, Class, Share Value) from the PDF documents.
Define the specific numbers to be extracted based on their location, formatting, or any other identifiable pattern within the document.

Data Manipulation and Excel Integration:
(If necessary) perform any necessary cleaning or formatting on the extracted numbers.
Define the structure of the Excel table, including specific columns, where the extracted numbers will be inserted.
Write the extracted data into the designated cells of the Excel spreadsheet.

Airtable Integration:
Connect to the Airtable API using the required authentication credentials.
Define the specific Airtable base and table where the data should be loaded.
Utilize the Airtable API to update records in the designated table.

Security Considerations:
Ensure the system handles sensitive data securely and follows best practices for data protection, encryption, and access control.
Use secure methods to authenticate with the email server and Airtable API.
Implement appropriate error handling and logging mechanisms to capture and handle any potential issues or exceptions during the automation process.

Deliverables:
Detailed documentation on how to set up and configure the system.
Instructions on how to install any required dependencies or libraries.
Guidance on how to schedule and monitor the automation process.
Security recommendations and considerations for handling sensitive data.


 

