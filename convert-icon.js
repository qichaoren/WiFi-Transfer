const fs = require('fs');
const path = require('path');
const png2icons = require('png2icons');

const inputFile = path.join(__dirname, 'src', 'assets', 'ico.png');
const outputFile = path.join(__dirname, 'src', 'assets', 'ico.ico');

const input = fs.readFileSync(inputFile);
const output = png2icons.createICO(input, png2icons.HERMITE, 0, false);

if (output) {
    fs.writeFileSync(outputFile, output);
    console.log('Converted ico.png to ico.ico');
} else {
    console.error('Conversion failed');
}
