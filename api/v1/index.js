// Import the generic reponse templates.
const response = require("./responses");


// Import the database query interface.
const db = require("../../db");
const { http200 } = require("./responses");


// Function to check if a mac address looks
// like an Awair mac address.
function isAwairMac(address) {
    return /^70886B[\dA-Z]{6}$/i.test(address);
}


// Simple endpoint to prove the API is
// currently functioning nominally.
async function healthCheck(undefined, res) {
    res.respond(new response.http200({
        message: "successful response"
    }));
}


// Get default Awair scores for a
// sensor across the last x minutes.
async function originalAwairScoreInLastMinutes(req, res) {
    try {
        const minutes = parseInt(req.params.minutes);
        if(isNaN(minutes)) {
            res.respond(new response.http400({
                message: "Unable to parse a number out of the `minutes` path parameter. Did you provide a number?"
            }));
            return;
        }

        if(!isAwairMac(req.params.macAddress)) {
            res.respond(new response.http400({
                message: "The provided MAC address does not match the expected format of Awair device MAC addresses: `70886B......`"
            }));
            return;
        }

        const queryStr = `SELECT time, value FROM "awair_score" WHERE awair_mac_address='${req.params.macAddress}' AND time > now() - ${minutes}m`;
        const dbResult = await db.query(queryStr);

        if(!dbResult.success) {
            console.error("unexpected database error:\n%s", dbResult.error);
            res.respond(new response.http500({
                message: "failed to execute database query"
            }));
            return;
        }

        res.respond(new response.http200({
            data: dbResult.result.map(record => ({
                time: record.time,
                scores: record.value
            }))
        }));

    } catch(err) {
        console.error("unexpected error:\n%s", err);
        res.respond(new response.http500({
            message: "The server could not process the request."
        }));
        return;
    }
}


// Get last x number of default
// Awair scores for a sensor.
async function originalAwairScoreLastX(req, res) {
    try {
        const x = parseInt(req.params.x);
        if(isNaN(x)) {
            res.respond(new response.http400({
                message: "Unable to parse a number out of the `x` path parameter. Did you provide a number?"
            }));
            return;
        }

        if(!isAwairMac(req.params.macAddress)) {
            res.respond(new response.http400({
                message: "The provided MAC address does not match the expected format of Awair device MAC addresses: `70886B......`"
            }));
            return;
        }

        const queryStr = `SELECT time, value FROM "awair_score" WHERE awair_mac_address='${req.params.macAddress}' LIMIT ${x}`;
        const dbResult = await db.query(queryStr);

        if(!dbResult.success) {
            console.error("unexpected database error:\n%s", dbResult.error);
            res.respond(new response.http500({
                message: "failed to execute database query"
            }));
            return;
        }

        res.respond(new response.http200({
            data: dbResult.result.map(record => ({
                time: record.time,
                scores: record.value
            }))
        }));

    } catch(err) {
        console.error("unexpected error:\n%s", err);
        res.respond(new response.http500({
            message: "The server could not process the request."
        }));
        return;
    }
}


// Get the AVERAGE default Awair
// score over the last x minutes.
async function originalAwairScoreTimeAggregationMinutes(req, res) {
    try {
        const minutes = parseInt(req.params.minutes);
        if(isNaN(minutes)) {
            res.respond(new response.http400({
                message: "Unable to parse a number out of the `minutes` path parameter. Did you provide a number?"
            }));
            return;
        }

        if(!isAwairMac(req.params.macAddress)) {
            res.respond(new response.http400({
                message: "The provided MAC address does not match the expected format of Awair device MAC addresses: `70886B......`"
            }));
            return;
        }

        const queryStr = `SELECT MEAN(value) FROM "awair_score" WHERE awair_mac_address='${req.params.macAddress}' AND time > now() - ${minutes}m`;
        const dbResult = await db.query(queryStr);

        if(!dbResult.success) {
            console.error("unexpected database error:\n%s", dbResult.error);
            res.respond(new response.http500({
                message: "failed to execute database query"
            }));
            return;
        }

        if(dbResult.result.length === 0) {
            res.respond(new response.http404({
                message: "no data in the specified time range"
            }));
            return;
        }

        res.respond(new response.http200({
            averageScore: dbResult.result[0].mean
        }));

    } catch(err) {
        console.error("unexpected error:\n%s", err);
        res.respond(new response.http500({
            message: "The server could not process the request."
        }));
        return;
    }
}


// Assign the endpoint implementations
// to their actual respective URLs.
module.exports = function(server, prefix) {
    server.get(prefix + "/", healthCheck);
    server.get(prefix + "/score/:macAddress/minutes/:minutes", originalAwairScoreInLastMinutes);
    server.get(prefix + "/score/:macAddress/last/:x", originalAwairScoreLastX);
    server.get(prefix + "/score/:macAddress/average/minutes/:minutes", originalAwairScoreTimeAggregationMinutes);
}
