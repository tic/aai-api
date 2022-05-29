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


// Helper function to do spike scoring
// Spike score is a measure of how much
// a subscore is deviating from some rolling
// average. A score of 100 indicates the 
// current score is equal or better than 
// that subscore's rolling average.
// Example: If the current subscore is 86,
//          but the average is 94, then the
//          spike score is 92.
function spike(subscore, averageSubscore) {
    return Math.min(100, 100 + subscore - averageSubscore);
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


// Measures CO2 and VOC spikes to determine an
// occupancy-factors-based air quality score.
function occupationalAQIV1(_, _, co2Ppm, vocPpb, _, _, _, co2Avg, vocAvg, _) {
    const co2Score = subscore.getCo2Subscore(co2Ppm);
    const rollingCo2Score = subscore.getCo2Subscore(co2Avg);
    const vocScore = subscore.getVocSubscore(vocPpb);
    const rollingVocScore = subscore.getVocSubscore(vocAvg);

    const rawScore = (
        0.500 * spike(co2Score, rollingCo2Score) +
        0.500 * spike(vocScore, rollingVocScore)
    );
    return precision(rawScore);
}


// Balances current and trending environmental
// measurements to calculate an environment-factors
// -based air quality score.
function environmentalAQIV1(temperatureC, _, _, _, pm25UgL, _, humidityAvg, co2Avg, vocAvg, _) {
    const rawScore = (
        0.200 * subscore.getTemperatureSubscore(temperatureC) +
        0.200 * subscore.getHumiditySubscore(humidityAvg) +
        0.200 * subscore.getCo2Subscore(co2Avg) +
        0.200 * subscore.getVocSubscore(vocAvg) +
        0.200 * subscore.getPm25Subscore(pm25UgL)
    );
    return precision(rawScore);
}


// The deviance index measures how abnormal the
// current air quality is compared to some rolling
// average of the given space.
function devianceIndexV1(temperatureC, humidityPct, co2Ppm, vocPpb, pm25UgL, temperatureAvg, humidityAvg, co2Avg, vocAvg, pm25Avg) {
    const rawScore = (
        0.200 * spike(
            subscore.getTemperatureSubscore(temperatureC),
            subscore.getTemperatureSubscore(temperatureAvg)
        ) + 
        0.200 * spike(
            subscore.getHumiditySubscore(humidityPct),
            subscore.getHumiditySubscore(humidityAvg)
        ) + 
        0.200 * spike(
            subscore.getCo2Subscore(co2Ppm),
            subscore.getCo2Subscore(co2Avg)
        ) + 
        0.200 * spike(
            subscore.getVocSubscore(vocPpb),
            subscore.getVocSubscore(vocAvg)
        ) + 
        0.200 * spike(
            subscore.getPm25Subscore(pm25UgL),
            subscore.getPm25Subscore(pm25Avg)
        )
    );
    return precision(rawScore);
}


// v2 AQIs add gradient boosting to v1 AQIs
// Gradient units are AQI points per minute
function occupationalAQIV2(_, _, co2Ppm, vocPpb, _, _, _, co2Avg, vocAvg, _, scoreGradientV1) {
    const unboosted = occupationalAQIV1(
        undefined,
        undefined,
        co2Ppm,
        vocPpb,
        undefined,
        undefined,
        undefined,
        co2Avg,
        vocAvg,
        undefined
    );

    // If the gradient is "large" (value determined experimentally),
    // then we need to apply the gradient boosting mechanic.
    if(scoreGradientV1 > 0.2) {
        const boosted = unboosted + scoreGradientV1 * 6;
        return Math.min(boosted, 100);
    }

    // If the gradient is small, we can just
    // pass through the unboosted score as-is.
    return unboosted;
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
        v0: occupationalAQIF21,
        v1: occupationalAQIV1,
        v3: occupationalAQIV2
    },
    environmental: {
        v0: environmentalAQIF21,
        v1: environmentalAQIV1
    },
    deviance: {
        v1: devianceIndexV1
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
