import https from "https";
import fs from "fs";
import request from "request";
import dotenv from "dotenv";
import  ListTables  from "../airtable/do-table-send-data_FT2.js";
import path from "path";
dotenv.config();
const { API_KEY_PDFCO } = process.env;

async function ProcessPdfToXls(SourceFile, Password, Pages, DestinationFile) {
  try {
    // 1. RETRIEVE PRESIGNED URL TO UPLOAD FILE.
    const [uploadUrl, uploadedFileUrl] = await getPresignedUrl(API_KEY_PDFCO, SourceFile);

    // 2. UPLOAD THE FILE TO CLOUD.
    await uploadFile(API_KEY_PDFCO, SourceFile, uploadUrl);

    // 3. CONVERT UPLOADED PDF FILE TO XLS
    await convertPdfToXls(API_KEY_PDFCO, uploadedFileUrl, Password, Pages, DestinationFile);

    // 4. CALL ListTables FUNCTION AFTER PDF TO XLS CONVERSION IS COMPLETED
    console.log('Start ListT', DestinationFile)
    await ListTables(DestinationFile);

    console.log('PDF to XLS conversion and ListTables completed successfully.');

  } catch (error) {
    console.log(error);
  }
}

async function getPresignedUrl(apiKey, localFile) {
  return new Promise(resolve => {
    // Prepare request to `Get Presigned URL` API endpoint
    const queryPath = `/v1/file/upload/get-presigned-url?contenttype=application/octet-stream&name=${path.basename(localFile)}`;
    const reqOptions = {
      host: "api.pdf.co",
      path: encodeURI(queryPath),
      headers: { "x-api-key": apiKey }
    };
    // Send request
    https.get(reqOptions, (response) => {
      response.on("data", (d) => {
        const data = JSON.parse(d);
        if (data.error === false) {
          // Return presigned url we received
          resolve([data.presignedUrl, data.url]);
        } else {
          // Service reported error
          console.log("getPresignedUrl(): " + data.message);
        }
      });
    })
      .on("error", (e) => {
        // Request error
        console.log("getPresignedUrl(): " + e);
      });
  });
}

async function uploadFile(apiKey, localFile, uploadUrl) {
  return new Promise((resolve, reject) => {
    fs.readFile(localFile, (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      request({
        method: "PUT",
        url: uploadUrl,
        body: data,
        headers: {
          "Content-Type": "application/octet-stream"
        }
      }, (err, res, body) => {
        if (!err) {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  });
}

async function convertPdfToXls(apiKey, uploadedFileUrl, password, pages, destinationFile) {
  return new Promise((resolve, reject) => {
    // Prepare request to `PDF To XLS` API endpoint
    const queryPath = `/v1/pdf/convert/to/xls`;

    // JSON payload for api request
    const jsonPayload = JSON.stringify({
      name: path.basename(destinationFile), password: password, pages: pages, url: uploadedFileUrl
    });

    const reqOptions = {
      host: "api.pdf.co",
      method: "POST",
      path: queryPath,
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(jsonPayload, 'utf8')
      }
    };
    // Send request
    const postRequest = https.request(reqOptions, (response) => {
      response.on("data", (d) => {
        response.setEncoding("utf8");
        // Parse JSON response
        const data = JSON.parse(d);
        if (data.error === false) {
          // Download XLS file
          const file = fs.createWriteStream(destinationFile);
          https.get(data.url, (response2) => {
            response2.pipe(file)
              .on("close", () => {
                resolve();
              });
          });
        } else {
          // Service reported error
          reject("convertPdfToXls(): " + data.message);
        }
      });
    })
      .on("error", (e) => {
        // Request error
        reject("convertPdfToXls(): " + e);
      });

    // Write request data
    postRequest.write(jsonPayload);
    postRequest.end();
  });
}

export default ProcessPdfToXls;
