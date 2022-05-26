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
    scoring: { updatePeriod, rollingInterval }
} = require("../config");


// Helper function to generate influx points
function dataToInfluxPoint(data) {
    return {
        timestamp: data.timestamp,
        measurement: influxMeasurementName,
        tags: {
            // device_id is lower case by convention in gateway-generic
            device_id: data.device_id.toLowerCase()
        },
        fields: data.fields
    };
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
    ["occupational", "v2"]
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
async function getScoreGradients(scoreType) {
    const measurement = scoreType + "_v1";
    const dbResult = await db.query(`
        SELECT
            ${measurement}
        FROM "awair_informed"
        WHERE
            time > now() - ${(updatePeriod / 1000) * 3}s
        GROUP BY device_id
        ORDER BY time desc
        LIMIT 2
    `);

    return Object.entries(dbResult.result.reduce(
        (acc, cur) => {
            // Compute the gradient for the score on each device
            if(acc[cur.device_id] !== undefined) {
                const rawGradient = acc[cur.device_id][1] - cur[measurement];
                const adjGradient = rawGradient * (60000 / updatePeriod);
                acc[cur.device_id] = [true, adjGradient];
            } else {
                acc[cur.device_id] = [false, cur[measurement]];
            }
            return acc;
        },
        {}
    )).filter(entry => entry[1][0] === true)
    .reduce(
        (acc, [device_id, [_, gradient]]) => {
            acc[device_id] = gradient;
            return acc;
        },
        {}
    );
}

// 
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

        const gradients = (await Promise.all(
            gradientTypes.map(gradientType => getScoreGradients(gradientType))
        )).reduce(
            (acc, cur, index) => {
                acc[gradientTypes[index]] = cur;
                return acc;
            },
            {}
        );
        
        // Conduct scoring operations
        const influxPointsRaw = Object.keys(rawMetrics[0]).map(device_id => {
            const args1 = rawMetrics.map(obj => obj[device_id]);
    
            if(args1.indexOf(undefined) > -1) {
                return false;
            }

            const args = [
                ...args1,
                ...rollingMetrics.map(obj => obj[device_id])
            ];
    
            // Compute our new scores
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

            return dataToInfluxPoint({
                timestamp: windowStart,
                device_id,
                fields: reportedScores.reduce(
                    (acc, [seriesName, score]) => {
                        acc[seriesName] = score;
                        return acc;
                    },
                    {}
                )
            });
        });

        await db.write(
            influxPointsRaw.filter(p => p !== false)
        );
        
        console.log("> processed up to %d", windowEnd / 1000000);
        windowStart += (updatePeriod * 1000000);
    }
})();