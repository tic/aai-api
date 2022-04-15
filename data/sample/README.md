# Sample data
This data is purely for demonstration purposes. It contains a sample output from the data download script. The time range of the data presented here is approximately 0330-1530 EST on 04/04/2022.

The data was generated by running the following command:
`node downloader/download.js --interior 70886b123735 --exterior 70886b1235d7,70886b125971`

## Usage
In general, the command above should be modified as follows:
`node downloader/download.js --interior d0 --exterior d1,d2,d3`
... where d0 is the device_id of the interior device, and d1,...,dN are a comma-separated list of the ids of exterior devices.