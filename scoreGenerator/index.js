// Import what we need from the config file.
const { scoring: { updatePeriod } } = require("../config");


// Import our database module.
const db = require("../db");


// Import our scoring module.
const score = require("../scoring");


// Control variable for the periodic task.
var continueTask = false;


// Future location of the periodic task which fetches
// data from LLL, computes our AQI scores, and pushes
// the results of the calculcations back to LLL.
async function periodicScoreUpdater() {

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
