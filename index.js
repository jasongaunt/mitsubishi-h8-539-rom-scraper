// Activate console timestamp logging
require('console-stamp')(console, '[HH:MM:ss.l]');

// Shared constants across all functions
const fs = require('fs');
const printf = require('printf');
const hueSeparator = (2 * Math.PI) / 3;
const hueOffset = Math.PI / 2;
const mutAddress = 0x1FAD0;
const memAddressMin = 0xEE00;
const memAddressMax =  0xFEFF;

// Shared variables across all functions
var romFile;
var scalingTables = [];
var outputWidth = process.stdout.columns;

// Common functions
function usage(errorMessage) {
	console.log(errorMessage);
	console.log("Usage: " + process.argv[0] + " " + process.argv[1] + " /path/to/rom-file [optional output width]");
	process.exit(1);
}
function escapeRegExp(text) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}
function hexToColorHex(val, prefix, width, min, max, inverted) {
	if (width == null) { width = 1; }
	let format = "%0" + (width * 2) + "X";
	let hue = ((val - min) / (max - min)) * 255;
	hue = (hue / 255) * Math.PI * 2 * 0.825;
	if (hue > 255) { hue /= 256; }
	let red   = Math.sin(hueOffset + hue) * 255; if (red < 0) { red = 0; }
	let green = Math.sin(hueOffset + hue + hueSeparator + hueSeparator) * 255; if (green < 0) { green = 0; }
	let blue  = Math.sin(hueOffset + hue + hueSeparator) * 255; if (blue < 0) { blue = 0; }
	while (
		(red < 255) &&
		(green < 255) &&
		(blue < 255)
	) { 
		red *= 1.01;
		green *= 1.01;
		blue *= 1.01;
	}
	if (red > 255) { red = 255; }
	if (green > 255) { green = 255; }
	if (blue > 255) { blue = 255; }
	let escapeSequence = "";
	if (inverted == true) {
		escapeSequence = prefix + "\x1b[30m\x1b[48;2;" + parseInt(red) + ";" + parseInt(green) + ";" + parseInt(blue) + "m";
	} else {
		escapeSequence = prefix + "\x1b[38;2;" + parseInt(red) + ";" + parseInt(green) + ";" + parseInt(blue) + "m";
	}
	let resetSequence = "\x1b[0m";
	process.stdout.write(
		printf(escapeSequence + format + resetSequence, val)
	);
}
function colorHexSample(string, index, length, maxWidth, min, max, skipAfterSample) {
	if (length < 6) { process.stdout.write("\t"); } 
	for (let i = index - 8; i < index; i+=2) {
		hexToColorHex(((string.charCodeAt(i) << 8)) + string.charCodeAt(i+1), "\x1b[0m", 2, min, max, true);
	}
	process.stdout.write(" | ");
	for (let i = index; i < index + length; i+=2) {
		if ( (index + length) - i > 1 ) {
			hexToColorHex(((string.charCodeAt(i) << 8)) + string.charCodeAt(i+1), "\x1b[0m", 2, min, max, true);
		} else {
			hexToColorHex(string.charCodeAt(i), "\x1b[0m", 1, memAddressMin, memAddressMax, true);
		}
	}
	if (length < 6) { process.stdout.write("      "); } 
	process.stdout.write(" | ");
	if (skipAfterSample == true) { return; }
	let termSpareWidth = (outputWidth - (56 + ((Math.ceil(length / 2) * 2) * 2))) / 2;
	if (length < 6) { termSpareWidth -= 5; }
	if (maxWidth == null) { maxWidth = termSpareWidth; }
	else { maxWidth = Math.min(maxWidth, termSpareWidth); }
	for (let i = index + length; i < index + length + maxWidth; i+=2) {
		hexToColorHex(((string.charCodeAt(i) << 8)) + string.charCodeAt(i+1), "\x1b[0m", 2, min, max, true);
	}
}

// Main program starts here
console.log("------------------------------------------------");
console.log("Mitsubishi H8/539 ROM Parser - Written by JGaunt");
console.log("Attempts to find tables in the supplied ROM file");
console.log("------------------------------------------------");

// Parse args
var myArgs = process.argv.slice(2);
if (myArgs[0] == null) {
	usage("Error: No filename supplied.");
} else if (!fs.existsSync(myArgs[0])) {
	usage("Error - File not found: " + myArgs[0]);
}
if (myArgs[1] != null) {
	outputWidth = parseInt(myArgs[1]);
}

// Try and read file
try { romFile = fs.readFileSync(myArgs[0], 'latin1'); }
catch (e) { usage(e); }

// Check length is exactly 128 KB
if (romFile.length != 131072) {
	usage("Error: Supplied file length was " + romFile.length + " bytes, expected 131072 (128 KB)");
}

// Grab MUT table
var mutTableRaw = romFile.substring(mutAddress, mutAddress + (256 * 2));
var mutTable = [];
for (let i = 0; i < mutTableRaw.length; i += 2) {
	mutTable.push(
		(mutTableRaw.substring(i, i+1).charCodeAt(0) << 8) + mutTableRaw.substring(i+1, i+2).charCodeAt(0)
	);
}
mutTableRaw = null;
console.log("Parsed MUT table - " + mutTable.length + " entries found:");
process.stdout.write("\n-----------------------------------------------------------------------------------------------------------------\n");

let i = 0;
for (const val in mutTable) {
	process.stdout.write("| ");
	hexToColorHex(mutTable[val], "", 2, memAddressMin, memAddressMax, false);
	process.stdout.write(" ");
	i++;
	if (i > 15) {
		i = 0;
		process.stdout.write("|\n");
	}
}
process.stdout.write("-----------------------------------------------------------------------------------------------------------------\n");
process.stdout.write("\n");

// Start pattern matching through file to locate tables
console.log("Searching for potential scaling tables...");
process.stdout.write("\n");
process.stdout.write("Address    Header               Hexadecimal sample (8 chars before, max terminal width chars after)\n");
process.stdout.write("-------    ------               -------------------------------------------------------------------\n");

// Attempt to find scaling tables first up to the address of the MUT table 
for (let i = 0; i < mutAddress; i++) {
	let sample = romFile.substring(i, i+6+0x90);
	if (
		(sample.charCodeAt(0) >= 0xF0) &&
		(sample.charCodeAt(0) < 0xF8) &&
		(sample.charCodeAt(2) >= 0xE0) &&
		(sample.charCodeAt(2) < 0xFF) &&
		(sample.charCodeAt(4) == 0x0) &&
		(sample.charCodeAt(5) >= 0x02) &&
		(sample.charCodeAt(5) <= 0x90)
	) {
		// Check the first 8 chars (4 words) after the above sample and reject if they differ by more than +/-0x100
		let bogus_table = false;
		let starting_value = (sample.charCodeAt(6) << 8) + sample.charCodeAt(7);
		for (let j = 0; j < 6; j+=2) {
			let next_value = (sample.charCodeAt(6 + j) << 8) + sample.charCodeAt(7 + j);
			if (Math.abs(next_value - starting_value) > 0x1000) { bogus_table = true; }
			starting_value = next_value;
		}
		if (bogus_table) { continue; }
		// Grab our min and max values
		let min = 0xFFFF;
		let max = 0x0000;
		for (let j = 0; j < sample.charCodeAt(5) * 2; j+=2) {
			let currentVal = (sample.charCodeAt(6 + j) << 8) + sample.charCodeAt(7 + j);
			if (currentVal < min) { min = currentVal };
			if (currentVal > max) { max = currentVal };
		}
		// Add table to our known list and then print it out
		scalingTables.push(
			(sample.charCodeAt(0) << 8) + sample.charCodeAt(1)
		);
		process.stdout.write(
			printf(
				"0x%05X    %02X %02X %02X %02X %02X %02X",
				i,
				sample.charCodeAt(0),
				sample.charCodeAt(1),
				sample.charCodeAt(2),
				sample.charCodeAt(3),
				sample.charCodeAt(4),
				sample.charCodeAt(5)
			) + " ".repeat(4)
		);
		colorHexSample(romFile, i, 6, sample.charCodeAt(5) * 2, min, max);
		process.stdout.write("\n");
	}
}
// process.exit(1);

process.stdout.write("\n");

// Start pattern matching through file to locate tables
console.log("Searching for potential value tables...");
process.stdout.write("\n");
process.stdout.write("Address    Header               Hexadecimal sample (8 chars before, max terminal width chars after)\n");
process.stdout.write("-------    ------               -------------------------------------------------------------------\n");

for (let i = 0; i < mutAddress; i++) {
	let sample = romFile.substring(i, i+7+0x1FF);
	let j = 0;
	let min = 0xFFFF;
	let max = 0x0000;
	if ( // 3D table
		(sample.charCodeAt(0) == 0x3) &&
		(sample.charCodeAt(2) >= 0xE0) &&
		(sample.charCodeAt(2) < 0xFF) &&
		(sample.charCodeAt(4) >= 0xE0) &&
		(sample.charCodeAt(4) < 0xFF)
	) {
		// if (
		// 	(
		// 		(mutTable.includes((sample.charCodeAt(2) << 8) + sample.charCodeAt(3))) &&
		// 		(mutTable.includes((sample.charCodeAt(4) << 8) + sample.charCodeAt(5)))
		// 	) ||
		// 	(
		// 		(scalingTables.includes((sample.charCodeAt(2) << 8) + sample.charCodeAt(3))) &&
		// 		(mutTable.includes((sample.charCodeAt(4) << 8) + sample.charCodeAt(5)))
		// 	) ||
		// 	(
		// 		(mutTable.includes((sample.charCodeAt(2) << 8) + sample.charCodeAt(3))) &&
		// 		(scalingTables.includes((sample.charCodeAt(4) << 8) + sample.charCodeAt(5)))
		// 	) ||
		// 	(
		// 		(scalingTables.includes((sample.charCodeAt(2) << 8) + sample.charCodeAt(3))) &&
		// 		(scalingTables.includes((sample.charCodeAt(4) << 8) + sample.charCodeAt(5)))
		// 	)
		// ) {
			// Check the first 8 chars (4 words) after the above sample and reject if they differ by more than +/-0x100
			let bogus_table = false;
			let starting_value = (sample.charCodeAt(7) << 8) + sample.charCodeAt(8);
			for (j = 0; j < 6; j+=2) {
				let next_value = (sample.charCodeAt(7 + j) << 8) + sample.charCodeAt(8 + j);
				if (Math.abs(next_value - starting_value) > 0x4000) { bogus_table = true; }
				starting_value = next_value;
			}
			if (bogus_table) { continue; }
			// Read forward until we find a value that differs by more than 0x100
			starting_value = (sample.charCodeAt(7) << 8) + sample.charCodeAt(8);
			for (j = 0; j < 0x1FF; j+= 2) {
				let next_value = (sample.charCodeAt(7 + j) << 8) + sample.charCodeAt(8 + j);
				if (Math.abs(next_value - starting_value) > 0x4000) { break; }
			}
			// console.log(j);
			process.stdout.write(
				printf(
					"0x%05X    %02X %02X %02X %02X %02X %02X %02X",
					i,
					sample.charCodeAt(0),
					sample.charCodeAt(1),
					sample.charCodeAt(2),
					sample.charCodeAt(3),
					sample.charCodeAt(4),
					sample.charCodeAt(5),
					sample.charCodeAt(6)
				) + " ".repeat(1)
			);
			colorHexSample(romFile, i, 7, j, 0x0, 0xFFFF, true);
			let tableHeight = sample.charCodeAt(6) - 1;
			if (tableHeight < 1) { bogus_table = true; continue; }
			let tableWidth = j / tableHeight;
			let tableLines = new Array(tableHeight);
			for (let k = 0; k < j; k++) {
				for (let l = 0; l < tableHeight; l++) {
					if (tableLines[l] === undefined) { tableLines[l] = new Array(); }
					tableLines[l].push(sample.charCodeAt(7 + k));
					if (sample.charCodeAt(7 + k) < min) { min = sample.charCodeAt(7 + k) };
					if (sample.charCodeAt(7 + k) > max) { max = sample.charCodeAt(7 + k) };
					k++;
				}
			}
			for (let l = 0; l < tableHeight; l++) {
				tableLines[l].forEach(function(entry) {
					hexToColorHex(entry, "\x1b[0m", 1, min, max, true);
				});
				process.stdout.write("\n" + " ".repeat(49) + "|" + " ".repeat(16) + "| ");
			}
			// process.exit(0);
			process.stdout.write("\n");
			i += 7 + j;
		// }
	} else if ( // 2D table
		(sample.charCodeAt(0) == 0x2) &&
		(sample.charCodeAt(2) >= 0xE0) &&
		(sample.charCodeAt(2) < 0xFF)
	) {
		// if (
		// 	(
		// 		(mutTable.includes((sample.charCodeAt(2) << 8) + sample.charCodeAt(3)))
		// 	) ||
		// 	(
		// 		(scalingTables.includes((sample.charCodeAt(2) << 8) + sample.charCodeAt(3)))
		// 	) ||
		// 	(
		// 		(mutTable.includes((sample.charCodeAt(2) << 8) + sample.charCodeAt(3)))
		// 	) ||
		// 	(
		// 		(scalingTables.includes((sample.charCodeAt(2) << 8) + sample.charCodeAt(3)))
		// 	)
		// ) {
			// Check the first 8 chars (4 words) after the above sample and reject if they differ by more than +/-0x100
			let bogus_table = false;
			let starting_value = (sample.charCodeAt(4) << 8) + sample.charCodeAt(5);
			for (j = 0; j < 6; j+=2) {
				let next_value = (sample.charCodeAt(4 + j) << 8) + sample.charCodeAt(5 + j);
				if (Math.abs(next_value - starting_value) > 0x4000) { bogus_table = true; }
				starting_value = next_value;
			}
			// Read forward until we find a value that differs by more than 0x100
			starting_value = (sample.charCodeAt(4) << 8) + sample.charCodeAt(5);
			for (j = 0; j < 0x1FF; j+= 2) {
				let next_value = (sample.charCodeAt(4 + j) << 8) + sample.charCodeAt(5 + j);
				if (Math.abs(next_value - starting_value) > 0x4000) { break; }
			}
			if (bogus_table) { continue; }
			process.stdout.write(
				printf(
					"0x%05X    %02X %02X %02X %02X ",
					i,
					sample.charCodeAt(0),
					sample.charCodeAt(1),
					sample.charCodeAt(2),
					sample.charCodeAt(3)
				) + " ".repeat(8)
			);
			colorHexSample(romFile, i, 4, j, 0x0, 0xFFFF, true);
			for (let k = 0; k < j; k++) {
				if (sample.charCodeAt(4 + k) < min) { min = sample.charCodeAt(4 + k) };
				if (sample.charCodeAt(4 + k) > max) { max = sample.charCodeAt(4 + k) };
			}
			for (let k = 0; k < j; k++) {
				hexToColorHex(sample.charCodeAt(4 + k), "\x1b[0m", 1, min, max, true);
			}
		// }
			process.stdout.write("\n" + " ".repeat(49) + "|" + " ".repeat(16) + "| \n");
			i += 4 + j;
	}
}

// for (let x = 0; x < mutTable.length; x++) {
// 	for (let y = 0; y < mutTable.length; y++) {

// 		for (let i = 0; i < romFile.length; i++) {
// 			let sample = romFile.substring(i, i+7);
// 			if (
// 				(sample.charCodeAt(0) == 0x3) &&
// 				(sample.charCodeAt(2) == String.fromCharCode((mutTable[x] >> 8) & 0xFF).charCodeAt(0)) &&
// 				(sample.charCodeAt(3) == String.fromCharCode((mutTable[x] >> 0) & 0xFF).charCodeAt(0)) &&
// 				(sample.charCodeAt(4) == String.fromCharCode((mutTable[y] >> 8) & 0xFF).charCodeAt(0)) &&
// 				(sample.charCodeAt(5) == String.fromCharCode((mutTable[y] >> 0) & 0xFF).charCodeAt(0))
// 			) {
// 				console.log("Found table at " + parseInt(i, 16));
// 			}
// 		}
// 		process.exit(0);
// 	}
// }
