# Data
This folder contains some of the data which has been collected from the Rice 130 sensor deployment.

## Data acquisition
It is possible to acquire the all existing data from the deployment by running the following command from the repository base:

`$ node downloader\download.js --exterior 70886b12600d,70886b125400,70886b12621c,70886b1259c5 --interior 70886b125db1 --start 1649806800000`

This will run the download script with the wall-mounted sensors marked as exterior and the centrally located one as the interior device. The starting timestamp, 1649806800000, is when the deployment came fully online.

## Gaps in the data
As of writing, there are at least three sizable gaps in data. This is when at least one device was offline (usually because an occupant unplugged it). The download script will only download data points when each device has a measurement. For example, the above command has no data points between 1649903100000 and 1649942400000.
