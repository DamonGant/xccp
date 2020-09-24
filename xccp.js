"use strict"

const fs = require('fs');

function XcomCharacterPoolDecoder(b) {
	this.offset = 0;
	this.buffer = b;

	this.hexOffset = function hexOffset() {
		return "0x" + this.offset.toString(16);
	}

	this.readByte = function readByte() {
		var num = this.buffer.readUIntLE(this.offset, 1);
		this.offset += 1;
		return num;
	}

	this.readPrefixedString = function readPrefixedString() {
		var sLen = this.readInt();
		return this.readString(sLen);
	}

	this.readString = function readString(sLen) {
		var s = this.buffer.toString("utf-8", this.offset, this.offset+sLen-1);
		this.offset += sLen;
		return s;
	}

	this.readInt = function readInt() {
		var num = this.buffer.readUInt32LE(this.offset);
		this.offset += 4;
		return num;
	}

	this.skipPadding = function skipPadding() {
		var pad = this.buffer.readUInt32LE(this.offset);
		if (pad !== 0) {
			throw new Error("expected padding, got something else at offset " + this.hexOffset());
		}
		this.offset += 4;
	}

	this.decodeProperty = function() {
		var p = {};
		p.name = this.readPrefixedString();
		if (p.name === "None") {
			this.skipPadding();
		} else {
			this.skipPadding();
			p.type = this.readPrefixedString();
			this.skipPadding();
			switch (p.type) {
				case "ArrayProperty":
				case "IntProperty":
					var propLen = this.readInt();
					this.skipPadding();
					p.value = this.readInt();
					break;
				case "StrProperty":
					var sLen = this.readInt();
					this.skipPadding();
					p.value = this.readPrefixedString();
					break;
				case "NameProperty":
					var sLen = this.readInt();
					this.skipPadding();
					p.value = this.readPrefixedString();
					p.mysteryInt = this.readInt();
					break;
				case "BoolProperty":
					var sLen = this.readInt();
					this.skipPadding();
					var boolVal = this.readByte();
					p.value = (boolVal === 1 ? true : false);
					break;
				case "StructProperty":
					var sLen = this.readInt();
					this.skipPadding();
					p.value = this.readPrefixedString();
					this.skipPadding();
					var subbuffer = this.buffer.slice(this.offset, this.offset + sLen);
					var subDecoder = new XcomCharacterPoolDecoder(subbuffer);
					this.offset += sLen;
					var structData = []
					while (subDecoder.offset < subbuffer.length) {
						var sProperty = subDecoder.decodeProperty();
						if (sProperty.name !== "None")
							structData.push(sProperty)
					}
					p.data = structData;
					break;
				default:
				  throw new Error("Hell if I know what a " + p.type + " is!");
			}
		}
		return p;
	}

	this.checkMagic = function checkMagic() {
		var magic = this.buffer.readUInt32LE(this.offset);
		this.offset += 4;

		if (magic !== 4294967295) {
			throw new Error("Magic mismatch.")
		}
	}
}

var testfile = fs.readFileSync("test.bin");

var cpd = new XcomCharacterPoolDecoder(testfile);

cpd.checkMagic();

var flag = false;
var currentChar = {};
var characters = [];

while (cpd.offset < cpd.buffer.length) {
	var p = cpd.decodeProperty()
	if (p.name === "None" && !flag) {
		flag = true;
		var numChars = cpd.readInt(cpd.offset);
		console.log("we got " + numChars + " chars");
	}
	else if (flag && p.name === "None") {
		characters.push(currentChar);
		currentChar = {};
	}
	else if (flag) {
		currentChar[p.name] = p;
	}
}

process.stdout.write(JSON.stringify(characters));