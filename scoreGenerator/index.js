// Import what we need from the config file.
const { 
    scoring: { updatePeriod, rollingInterval }, 
    scoreTask: { measurement: influxMeasurementName } 
} = require("../config");


// Some constants that regulate
// the script's behavior.
const measurements = ["Temperature_°C", "Humidity_%", "co2_ppm", "voc_ppb", "pm2.5_μg/m3"];
const trackedScores = [
    ["balanced", "v0"],
    ["occupational", "v0"],
    ["environmental", "v0"],
    ["occupational", "v1"],
    ["environmental", "v1"],
    ["deviance", "v1"],
    ["occupational", "v3"]
];
const gradientTypes = trackedScores.reduce(
    (acc, [cur, _]) => {
        if(acc.indexOf(cur) === -1) {
            acc.push(cur);
        }
        return acc;
    },
    []
);


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


// Helper function which retrieves rolling metrics
// when the cached values become stale. Values are
// elligible for usage for 15 minutes and are then
// refreshed with new rolling averages.
var rollingMetricUpdateTime = 0;
var rollingMetrics = [];
async function getRollingMetrics() {
    const now = new Date().getTime();
    if(now - rollingMetricUpdateTime > rollingInterval * 1000) {
        console.log("===== updating rolling metrics =====");
        rollingMetrics = await Promise.all(
            measurements.map(async measurement => {
                const dbResult = await db.query(`
                    SELECT
                        MEDIAN(value)
                    FROM "${measurement}"
                    WHERE
                        time > now() - ${rollingInterval}s
                    GROUP BY device_id
                `);
                
                return dbResult.result.reduce(
                    (acc, {device_id, median}) => {
                        acc[device_id] = median;
                        return acc;
                    },
                    {}
                );
            })
        );
        rollingMetricUpdateTime = now;
        console.log("=====     update complete!     =====");
    }
    return rollingMetrics;
}


// Computes the gradient for the given score version,
// uniquely represented as an Influx "measurement".
async function getScoreGradients(scoreType) {
    const measurement = scoreType + "_v1";
    const aggregateSize = 6;
    const dbResult = await db.query(`
        SELECT
            ${measurement}
        FROM "awair_informed"
        WHERE
            time < ${windowEnd}
        GROUP BY device_id
        ORDER BY time desc
        LIMIT ${aggregateSize}
    `);

    const scoresByDeviceId = dbResult.result.reduce(
        (acc, cur) => {
            if(acc[cur.device_id] === undefined) {
                acc[cur.device_id] = [[cur[measurement], cur.time.getTime()]];
            } else {
                acc[cur.device_id].push([cur[measurement], cur.time.getTime()]);
            }
            return acc;
        },
        {}
    );

    return Object.entries(scoresByDeviceId).reduce(
        (acc, [deviceId, scores]) => {
            const seenTimestamps = {};
            scores = scores.filter(score => {
              if (seenTimestamps[score[1]] === undefined) {
                seenTimestamps[score[1]] = true;
                return true;
              }
              return false;
            })
            if(scores.length < 2) {
                return 0;
            }
            const gradients = [];
            for (let i = 1; i < scores.length; i++) {
              const valueDifference = scores[i][0] - scores[i - 1][0];
              const timeDifference = scores[i][1] - scores[i - 1][1];
              gradients.push(60000 * valueDifference / timeDifference);
            }
            const averageGradient = gradients.reduce((gradientSum, gradient) => gradientSum + gradient, 0) / gradients.length;
            // console.log(scores, '|', gradients, '|', averageGradient);
            acc[deviceId] = averageGradient;
            return acc;
        },
        {}
    );
}


// Future location of the periodic task which fetches
// data from LLL, computes our AQI scores, and pushes
// the results of the calculcations back to LLL.
async function periodicScoreUpdater() {
    try {
        console.log("task iteration started");

        // Query for the metrics for each category
        const metrics = await Promise.all(
            measurements.map(async metric => {
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

        const gradients = (await Promise.all(
            gradientTypes.map(gradientType => getScoreGradients(gradientType))
        )).reduce(
            (acc, cur, index) => {
                acc[gradientTypes[index]] = cur;
                return acc;
            },
            {}
        );

        // Pull rolling averages
        const rollingMetrics = await getRollingMetrics();

        // This takes the results from the two
        // queries and manipulates them into a
        // more useful data structure.
        const groupedMetrics = 
            Object.keys(metrics[0])
            .map(device_id => [
                device_id,
                ...metrics.map(metricList => metricList[device_id]),
                ...rollingMetrics.map(metricList => metricList[device_id]),
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
                const reportedScores = trackedScores.map(
                    args => [
                        args.join("_"),
                        score(
                            args[0],
                            args[1],
                            [...metricValues, gradients[args[0]][device_id]]
                        )
                    ]
                );

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
