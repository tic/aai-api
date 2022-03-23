// Import what we need from the config file.
const { scoring: { precision: scorePrecision } } = require("../config");
const exponent = 10 ** scorePrecision;

// Contains functions which compute scores given
// component air quality metrics (temp, voc, etc).
const subscore = require("./subscores");


// Helper function to do rounding
function precision(value) {
    return parseInt(value * exponent) / exponent;
}


// Averages all component subscores for
// a somewhat blended sort of AQI.
function balancedAQI(temperatureC, humidityPct, co2Ppm, vocPpb, pm25UgL) {
    const rawScore = (
        subscore.getTemperatureSubscore(temperatureC)
        + subscore.getHumiditySubscore(humidityPct)
        + subscore.getCo2Subscore(co2Ppm)
        + subscore.getVocSubscore(vocPpb)
        + subscore.getPm25Subscore(pm25UgL)
    ) / 5;
    
    return precision(rawScore);
}


// Todo
function occupationalAQI() {

    return 0;
}


// Todo
function environmentalAQI() {

    return 0;
}


// 
// =============================================================================
// 


// Organize the score functions.
const scoreFunctions = {
    balanced: {
        v0: balancedAQI
    },
    occupational: {
        v0: occupationalAQI
    },
    environmental: {
        v0: environmentalAQI
    }
}


// Report usable scoring functions 
// and their versions to the console
console.log(
    "loaded %d scoring functions: \n%s", 
    Object.keys(scoreFunctions).length,
    ...Object.keys(scoreFunctions)
        .map(scoreType => 
            `\t"${scoreType}" with versions: ${Object.keys(scoreFunctions[scoreType])}\n`
        )
);


// The master scoring function.
function score(name, version, params) {
    const func = scoreFunctions[name]?.[version];
    if(func === undefined) {
        throw new Error(`unknown scoring function/version combination: "${name} ${version}". see console for known scoring functions and versions`);
    } else {
        return func(...params);
    }
}


// Export the scoring function.
module.exports = score;
