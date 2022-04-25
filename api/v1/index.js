// Import the generic reponse templates.
const response = require("./responses");


// Import the database query interface.
const db = require("../../db");
const res = require("express/lib/response");


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

        const queryStr = `SELECT time, value FROM "awair_score" WHERE device_id='${req.params.device_id}' AND time > now() - ${minutes}m`;
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
                score: record.value
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

        const queryStr = `SELECT time, value FROM "awair_score" WHERE device_id='${req.params.device_id}' LIMIT ${x}`;
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
                score: record.value
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

        const queryStr = `SELECT MEAN(value) FROM "awair_score" WHERE device_id='${req.params.device_id}' AND time > now() - ${minutes}m GROUP BY location_specific, details, description`;
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
            averageScore: dbResult.result[0].mean,
            location: dbResult.result[0].location_specific,
            description: dbResult.result[0].description,
            details: dbResult.result[0].details
        }));

    } catch(err) {
        console.error("unexpected error:\n%s", err);
        res.respond(new response.http500({
            message: "The server could not process the request."
        }));
        return;
    }
}


// Get AVERAGE custom scores over
// over the last x minutes (min. 5)
async function customScoresLastX(req, res) {
    try {
        let parsedMin = parseInt(req.params.minutes);

        // The minimum window size is 5 minutes. If
        // a smaller window is requested, there might
        // not be any custom scores available...
        const minutes = parsedMin < 5 ? 5: parsedMin;
        if(isNaN(minutes)) {
            res.respond(new response.http400({
                message: "Unable to parse a number out of the `minutes` path parameter. Did you provide a number?"
            }));
            return;
        }

        const queryStr = `SELECT MEAN(*) FROM "awair_informed" WHERE device_id='${req.params.device_id}' AND time > now() - ${minutes}m GROUP BY location_specific, details, description`;
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

        const { location_specific, description, details } = dbResult.result[0];
        delete dbResult.result[0].location_specific;
        delete dbResult.result[0].description;
        delete dbResult.result[0].details
        const transformedData = 
            Object
            .entries(dbResult.result[0])
            .map(([key, value]) => {
                if(key === "time") {
                    return null;
                }
                const [, scoreType, version] = key.split("_");
                return {
                    algorithm: {
                        name: scoreType,
                        version: parseInt(version.substring(1))
                    },
                    value
                };
            })
            .filter(r => r !== null);

        res.respond(new response.http200({
            data: transformedData,
            location: location_specific,
            description,
            details
        }));

    } catch(err) {
        console.error("unexpected error:\n%s", err);
        res.respond(new response.http500({
            message: "The server could not process the request."
        }));
        return;
    }
}


// Get a list of devices, formatted like:

async function getDevices(req, res) {
    try {
        const queryStr = `SELECT value, device_id, location_specific, details, description FROM "awair_score" WHERE location_general = 'UVA' GROUP BY device_id ORDER BY time desc LIMIT 1`;
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
                message: "found no devices"
            }));
            return;
        }

        // const { location_specific, description, details } = dbResult.result[0];
        // delete dbResult.result[0].location_specific;
        // delete dbResult.result[0].description;
        // delete dbResult.result[0].details
        const deviceList = dbResult.result.map(device => ({
            device_id: device.device_id,
            location: device.location_specific,
            description: device.description,
            details: device.details
        }));

        res.respond(new response.http200({
            devices: deviceList
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
    // Set up the basic version housekeeping items
    server.get(prefix + "/", healthCheck);
    
    const docs = require("./openapi.json");
    server.get(
        prefix + "/docs",
        (_, res) => res.respond(new response.http200(docs))
    );

    // These are probably not very useful
    server.get(
        prefix + "/awair-score/:device_id/minutes/:minutes",
        originalAwairScoreInLastMinutes
    );
    server.get(
        prefix + "/awair-score/:device_id/last/:x",
        originalAwairScoreLastX
    );

    // These are pretty useful
    server.get(
        prefix + "/awair-score/:device_id/average/minutes/:minutes",
        originalAwairScoreTimeAggregationMinutes
    );
    server.get(
        prefix + "/custom-score/:device_id/average/minutes/:minutes",
        customScoresLastX
    );

    // Endpoints to retrieve sensor listings
    server.get(
        prefix + "/devices",
        getDevices
    );
}
