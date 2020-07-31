# GPIO

A library that contains operations needed to control the input and output of GPIO pins.

## Usage

## Notes

# Creating a new Module for AUX

Clone AUX to your computer
Create a new branch off of master
Add a new folder of stuff you want to Add
Required Files:
README.md
LICENSE.txt
index.js
package.json

Navigate to your AUX repo in Terminal
run `npm run bootstrap`

Modify the Jenkinsfile to build your branch (use the GPIO branch Jenkinsfile as an example)
Commit and push that branch
Create a new Jenkins Job (Clone from the AUX-GPIO Job)
Point the Job to your branch
Build the Job
`ssh pi@raspberrypi.local`
`sudo nano docker-compose.yaml`
change the arm-32 tag from 'latest' to 'yourbranchname'
go to your aux website and you should have whatever you added available
