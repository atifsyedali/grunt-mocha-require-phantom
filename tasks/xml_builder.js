/**
 * Very simple XML Builder
 */
module.exports = XMLBuilder;

/**
 * Create a new XML Builder instance
 */
function XMLBuilder() {
	this.out= '<?xml version="1.0" encoding="UTF-8"?>\n';
	this.curIndex= 0;
}

/**
 * Add an xml tag to the current output. If provided, the contentsFunc will be called before the xml tag is closed
 * 
 * @param {String} elementName - the element name of this object
 * @param {Array} attributes - the property names to serialize. If the value is undefined or null, the property will be left out
 * @param {Function} contentsFunc - provide this function if you want to serialize children
 */
XMLBuilder.prototype.tag= function(elementName, attributes, contentsFunc, noIndent) {
	var indent= !noIndent;
	var newLine= indent ? "\n" : "";
	var indent= indent ? repeat('\t', this.curIndex) : "";
	
	this.out+= indent;
	this.out+= "<";
	
	this.out+= elementName;
	this.out+= attr(attributes);
	if (contentsFunc != null) {
		this.out+=">" + newLine;
		this.curIndex++;
		contentsFunc();
		this.curIndex--;
		this.out+= indent;
		this.out+= "</" + elementName + ">"+newLine;
	} else {
		this.out+="/>" + newLine;
	}
}

/**
 * Add plain text to the current node
 */
XMLBuilder.prototype.text= function(contents) {
	this.out+= escapeXML(contents);
}

/**
 * Creates the xml in String format. Throws an Error if the xml is not yet finished (e.g. there are unclosed tags)
 */
XMLBuilder.prototype.toString= function() {
	return this.out;
}

function attr(attributes) {
	var out= "";
	if (attributes != null) {
		for (i in attributes) {
			if (attributes[i] != null) {
				out+= " " + i + '="' + escapeXML(attributes[i]) + '"';
			}
		}
	}
	return out;
}

function escapeXML(text) {
	if (text == null) {
		return "";
	}
	return text.toString().replace(/[\u00A0-\u9999<>\&"']/gim, function(i) {
		return '&#'+i.charCodeAt(0)+';';
	});
}

function repeat(char, times) {
	return new Array(times + 1).join(char);
}