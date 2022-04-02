// Import what we need from the config file.
const { 
    scoring: { updatePeriod }, 
    scoreTask: { measurement: influxMeasurementName } 
} = require("../config");


// Import our database module.
const db = require("../db");


// Import our scoring module.
const score = require("../scoring");


// Control variable for the periodic task.
var continueTask = false;


// Helper function to log metric data
function logMetricData(mac, metricValues) {
    console.log(
        "%s: %s °C, \t%s\%, \t%s ppm, \t%s ppb, \t%s μg/m3",
        mac,
        ...metricValues.map(mv => (parseInt(mv * 1000) / 1000).toPrecision(6)),
    );
}

// Helper function to generate influx points
function dataToInfluxPoint(data) {
    return {
        measurement: influxMeasurementName,
        tags: {
            // device_id is lower case by convention in gateway-generic
            device_id: data.device_id.toLowerCase()
        },
        fields: data.fields
    };
}


// Future location of the periodic task which fetches
// data from LLL, computes our AQI scores, and pushes
// the results of the calculcations back to LLL.
async function periodicScoreUpdater() {
    try {
        console.log("task iteration started");

        // Query for the metrics for each category
        const metrics = await Promise.all(
            ["Temperature_°C", "Humidity_%", "co2_ppm", "voc_ppb", "pm2.5_μg/m3"].map(async metric => {
                const dbResult = await db.query(`
                SELECT
                    MEAN(value)
                FROM "${metric}"
                WHERE
                    time > now() - ${parseInt(updatePeriod / 1000)}s 
                GROUP BY device_id
                `);
                const deviceIdMap = {};
                for(const { mean, device_id } of dbResult.result) {
                    deviceIdMap[device_id] = mean;
                }
                return deviceIdMap;
            })
        );

        // This takes the results from the first set
        // of queries and manipulates them into a
        // more useful data structure.
        const groupedMetrics = 
            Object.keys(metrics[0])
            .map(device_id => [
                device_id,
                ...metrics.map(metricList => metricList[device_id])
            ])
            .filter(([device_id, ...metricTuple]) => {
                if(metricTuple.indexOf(undefined) > -1) {
                    console.log("missing metric data for device %s", device_id);
                    return false;
                }
                return true;
            });

        // For each mac address, compute and store our scores.
        const influxPointsRaw = await Promise.all(
            groupedMetrics.map(([device_id, ...metricValues]) => {
                // Log the received data
                logMetricData(device_id, metricValues);

                // Compute our new scores
                const reportedScores = [
                    ["balanced", "v0"],
                    ["occupational", "v0"],
                    ["environmental", "v0"],
                ].map(args => [args.join("_"), score(args[0], args[1], metricValues)]);

                // Create an influx point with the data
                return dataToInfluxPoint({
                    device_id,
                    fields: reportedScores.reduce((acc, [seriesName, score]) => {
                        acc[seriesName] = score;
                        return acc;
                    }, {})
                });
            })
        );
        
        // Send the results to influx
        const result = await db.write(
            influxPointsRaw.filter(p => p !== false)
        );
        console.log(result);
    } catch(err) {
        console.error(err);
    }
}


// Function which spawns the periodic task.
// Issues a promise which does not return
// until stopPeriodicTask is called.
async function runPeriodicTask() {
    if(continueTask === true) {
        throw new Error(
            "function runPeriodicTask() was called while it was already running"
        );
    }

    continueTask = true;
    while(continueTask) {
        // Invoke the periodic updater.
        await periodicScoreUpdater();
        // Once the task is complete, wait for the required time.
        await new Promise((res,) => setTimeout(res, updatePeriod));
    }
    return true;
}


// Stops the periodic task. If given the promise
// which resolves when the task is finished, it
// will not return until the task has been stopped.
async function stopPeriodicTask(task) {
    continueTask = false;

    if(!(task instanceof Promise)) {
        return;
    }
    return await task;
}


// Export the periodic task control
// functions with shorter names.
module.exports = {
    init: runPeriodicTask,
    stop: stopPeriodicTask
}
