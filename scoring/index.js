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
        subscore.getTemperatureSubscore(temperatureC) +
        subscore.getHumiditySubscore(humidityPct) +
        subscore.getCo2Subscore(co2Ppm) +
        subscore.getVocSubscore(vocPpb) +
        subscore.getPm25Subscore(pm25UgL)
    ) / 5;
    return precision(rawScore);
}


// This is the occupational AQI distribution we
// did in the final project for S&HB in Fall 2021.
function occupationalAQIF21(temperatureC, humidityPct, co2Ppm, vocPpb, pm25UgL) {
    const rawScore = (
        0.050 * subscore.getTemperatureSubscore(temperatureC) +
        0.150 * subscore.getHumiditySubscore(humidityPct) +
        0.325 * subscore.getCo2Subscore(co2Ppm) +
        0.325 * subscore.getVocSubscore(vocPpb) +
        0.150 * subscore.getPm25Subscore(pm25UgL)
    );
    return precision(rawScore);
}


// This is the environmental AQI distribution we
// did in the final project for S&HB in Fall 2021.
function environmentalAQIF21(temperatureC, humidityPct, co2Ppm, vocPpb, pm25UgL) {
    const rawScore = (
      0.250 * subscore.getTemperatureSubscore(temperatureC) +
      0.300 * subscore.getHumiditySubscore(humidityPct) +
      0.050 * subscore.getCo2Subscore(co2Ppm) +
      0.100 * subscore.getVocSubscore(vocPpb) +
      0.300 * subscore.getPm25Subscore(pm25UgL)
  );
  return precision(rawScore);
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
        v0: occupationalAQIF21
    },
    environmental: {
        v0: environmentalAQIF21
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
