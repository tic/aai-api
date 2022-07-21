//////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////
// Extract command line arguments

const yargs = require("yargs");

const { argv } = yargs(process.argv.slice(2))
    .demandOption("start", "Start of the time range containing data to be scored")
    .default("stop", Math.floor((new Date().getTime() - 600000) / 300000) * 300000, "most recent 5m interval (ms)");

const rangeStart = parseFloat(argv.start) * 1000000;
const rangeEnd = parseFloat(argv.stop) * 1000000;

if(rangeEnd < rangeStart) {
    throw new Error("The end of the time range must be after the start.");
}

console.log("Using time range [%d --> %d]", rangeStart / 1000000, rangeEnd / 1000000);

//////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////


// Import our database module.
const db = require("../db");


// Import our scoring module.
const score = require("../scoring");


// Import what we need from the config file.
const {
    scoreTask: { measurement: influxMeasurementName },
    scoring: { updatePeriod, rollingInterval, scoreTesting }
} = require("../config");


// Helper function to generate influx points
function dataToInfluxPoint(data) {
    const datapoint = {
        timestamp: data.timestamp,
        measurement: influxMeasurementName,
        tags: {
            // device_id is lower case by convention in gateway-generic
            device_id: data.device_id.toLowerCase(),
        },
        fields: data.fields
    };
    
    // Add the filter tag when developing new
    // scoring techniques to make plotting the
    // results in Grafana :)
    if(scoreTesting === true) {
        datapoint.tags.filter = "7";
    }

    return datapoint;
}


// 
const measurements = ["Temperature_°C", "Humidity_%", "co2_ppm", "voc_ppb", "pm2.5_μg/m3"];
const trackedScores = [
    // ["balanced", "v0"],
    // ["occupational", "v0"],
    // ["environmental", "v0"],
    // ["occupational", "v1"],
    // ["environmental", "v1"],
    // ["deviance", "v1"],
    ["occupational", "v3"] // Currently under development
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

// Computes the gradient for the given score version,
// uniquely represented as an Influx "measurement".
// Since at least two data points are required, we
// ask influx for the most recent pair of data points
// recorded before the end of the current window.
async function getScoreGradients(scoreType, windowEnd) {
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

// Use an anonymous async function
// to wrap the scoring script.
(async function() {
    let windowStart = rangeStart;
    let windowEnd;
    while(windowStart < rangeEnd) {
        windowEnd = windowStart + (updatePeriod * 1000000);

        // Pull the readings from the current window
        const rawMetrics = await Promise.all(
            measurements.map(async measurement => {
                const dbResult = await db.query(`
                    SELECT
                        MEAN(value)
                    FROM "${measurement}"
                    WHERE
                        time > ${windowStart} AND
                        time < ${windowEnd}
                    GROUP BY device_id
                `);
                
                return dbResult.result.reduce(
                    (acc, {device_id, mean}) => {
                        acc[device_id] = mean;
                        return acc;
                    },
                    {}
                );
            })
        );

        // Pull rolling averages
        // NOTE: there is a *slight* difference between
        // this historical scoring script and the real-
        // time scoring task. In real time, the task
        // refreshes the rolling metrics every 15m, but
        // in this script we refresh for every new window.
        // This probably isn't the biggest of deals, but
        // it is probably worth noting here in case
        // someone else discovers this discrepancy and
        // goes searching for why it exists.
        const rollingMetrics = await Promise.all(
            measurements.map(async measurement => {
                const dbResult = await db.query(`
                    SELECT
                        MEDIAN(value)
                    FROM "${measurement}"
                    WHERE
                        time > ${windowEnd - (rollingInterval * 1000 * 1000000)} AND
                        time < ${windowEnd}
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

        // Compute the score gradients. We compute
        // gradients for all score classes (e.g. 
        // environmental, occupational, deviance, 
        // etc.), even though some of them may not
        // end up being used. This is done so that
        // if we end up using them in the future,
        // such an addition will "just work" and not
        // require us to go back and change anything.
        const gradients = (await Promise.all(
            gradientTypes.map(gradientType => getScoreGradients(gradientType, windowEnd))
        )).reduce(
            (acc, cur, index) => {
                acc[gradientTypes[index]] = cur;
                return acc;
            },
            {}
        );
        
        // Conduct scoring operations
        const influxPointsRaw = Object.keys(rawMetrics[0]).map(device_id => {
            // Pull out the metrics for the
            // sensor we are calculating for.
            const args1 = rawMetrics.map(obj => obj[device_id]);
            
            // If a metric is missing, this point
            // just needs to be skipped. The filter
            // at the end of this block will remove
            // entries which returned false.
            if(args1.indexOf(undefined) > -1) {
                return false;
            }

            // Build the list of arguments for
            // the scoring functions.
            const args = [
                ...args1,
                ...rollingMetrics.map(obj => obj[device_id])
            ];
    
            // Compute our new scores, appending
            // the properly computed gradients to
            // the existing list of functio args.
            const reportedScores = trackedScores.map(
                funcArgs => [
                    funcArgs.join("_"),
                    score(
                        funcArgs[0],
                        funcArgs[1],
                        [...args, gradients[funcArgs[0]][device_id]]
                    )
                ]
            );
            
            const baseData = {
                timestamp: windowStart,
                device_id,
            };
            
            if(scoreTesting === true) {
                baseData.fields = {
                    testscores_v0: reportedScores[0][1]
                };
            } else {
                baseData.fields = reportedScores.reduce(
                    (acc, [seriesName, score]) => {
                        acc[seriesName] = score;
                        return acc;
                    },
                    {}
                );
            }

            return dataToInfluxPoint(baseData);
        });

        // Send valid points to influx
        await db.write(
            influxPointsRaw.filter(p => p !== false)
        );
        // console.log(influxPointsRaw.filter(p => p !== false));
        // console.log(
        //     influxPointsRaw.filter(item => item !== false && ["70886b1234a0", "70886b123b81"].includes(item.tags.device_id))
        //     .map(item => item.fields.testscores_v0)
        // );

        // Log our progress
        const datestr = /.* (.*) [AP]M/.exec(new Date(windowEnd / 1000000).toLocaleString())[1]
        console.log("> processed up to %d (%s)", windowEnd / 1000000, datestr);
        
        // Advance the window
        windowStart += (updatePeriod * 1000000);
    }
})();
