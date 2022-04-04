
const yargs = require("yargs");

const argv = yargs(process.argv.slice(2))
    .default("start", new Date().getTime() - 1200000) // default range start is 20m ago
    .default("stop", new Date().getTime() - 300000) // default range end is 5m ago
    .demandOption("interior", "Provide interior sensor as a device_id")
    .demandOption("exterior", "Provide exterior sensors as a comma-separated list of device_ids")
    .argv;

const interiorDevice = argv.interior;
const exteriorDevices = argv.exterior.split(",");
const rangeStart = argv.start * 1000000;
const rangeEnd = argv.stop * 1000000;

console.log("Interior device: %s", interiorDevice);
console.log("Exterior device(s): %s", exteriorDevices);

console.log("Start time: %d", rangeStart / 1000000);
console.log("End time: %d", rangeEnd / 1000000);

const db = require("../db");
const fs = require("fs");
const path = require("path");

(async function() {
    const filename = metric => path.join("data", `aai_data.${metric}.${rangeStart}-${rangeEnd}.csv`);
    const header = "timestamp_ms," + exteriorDevices.reduce(
        (acc, cur) => `${acc},${cur}`
    ) + "," + interiorDevice + "\n";

    const rangeSize = rangeEnd - rangeStart;

    // Download files for each metric
    for(const metric of ["Temperature_°C", "Humidity_%", "co2_ppm", "voc_ppb", "pm2.5_μg/m3", "awair_score"]) {
        console.log("Downloading data for metric '%s'...", metric);
        const fname = filename(metric.replace("/", "_"));
        fs.writeFileSync(fname, header, { flag: "w+" });

        let windowStart = rangeStart;
        let windowEnd = rangeStart + 300000000000;
        while(windowStart < rangeEnd) {
            const data = await Promise.all(
                [...exteriorDevices, interiorDevice]
                .map(async device_id => {
                    const data = await db.query(`
                            SELECT MEAN(value)
                            FROM "${metric}"
                            WHERE
                                device_id = '${device_id}' AND
                                time > ${windowStart} AND
                                time < ${windowEnd}
                        `);
                        try {
                            return parseInt(data.result[0].mean * 1000) / 1000;
                        } catch(err) {
                            return null;
                        }
                    })
                );
                
            if(data.indexOf(null) === -1) {
                // Only record the data row if all devices
                // had data within the current search window.
                const rowStr = [windowStart / 1000000, ...data].toString();
                // console.log("%s", rowStr);
                
                fs.writeFileSync(fname, rowStr + "\n", { flag: "a"});
            }
            
            // Slide the window forwards
            windowStart += 300000000000; // increment the search by 5m
            windowEnd += 300000000000;
            process.stdout.write("Progress: " + parseInt((windowStart - rangeStart) * 10000 / rangeSize) / 100 + "%   \r");
        }

        console.log("\n");
    }
})();
