/** This script is (c) Wolfgang Schwarz 2002, wolfgang@umsu.de. **/

/**
 * AN INTERFACE BETWEEN READABLE STRINGS AND FORMULA OBJECTS (SEE FORMULA.JS)
 *    needs formulas.js
 *
 * SYNOPSIS:
 *		An object parser is created, which has the following methods.
 *    parser.getString(formula)   - returns the string corresponding to a formula object.
 *		parser.parseTeX(string)     - returns the formula corresponding to a TeX string.
 * 
 * EXAMPLE:
 *    str = "\\forall x ((Px \\vee Qxa) \\rightarrow Fxx)";
 *    fla = parser.parseTeX(str);
 *    if (fla) {
 *       alert("the scope of the quantifier is " + parser.getString(fla.subFormula));
 *    }
 * 
 * CONFIGURATION:
 *    The symbols recognized as predicates and terms in parseString are specified in the 
 *    regular expressions at the beginning of the function definition. (There is no 
 *    distinction between variables and constants here, as no such distinction is used 
 *    in tree.js.)
 *       The format for logical symbols used by getString is determined by the constants right
 *    below this comment. A bit further down is the list of symbols used in output for 
 *    non-logical symbols that did not occur in the input.
 *       If there is a parse error, the method parseTeX will return null (or undefined) and
 *    an error message will be stored in parser.error. In any case a log of the parse process
 *    is available in parser.parseLog. If parseTeX is used several times without a reload of
 *    the script, you have to call parser.reset() in bewteen.
 *
 **/

parser = new Object();

// Logical symbols used in getString:

parser[tc.NEGATION] = "<img src='neg.gif' alt=' not ' align='top'>";
parser[tc.CONJUNCTION] = "<img src='wedge.gif' alt=' and ' align='top'>";
parser[tc.DISJUNCTION] = "<img src='vee.gif' alt=' or ' align='top'>";
parser[tc.IMPLICATION] = "<img src='to.gif' alt=' then ' align='top'>";
parser[tc.BIIMPLICATION] = "<img src='leftrightarrow.gif' alt=' iff ' align='top'>";
parser[tc.UNIVERSAL] = "<img src='forall.gif' alt=' for all ' align='top'>";
parser[tc.EXISTENTIAL] = "<img src='exists.gif' alt=' exists ' align='top'>";

/*
parser[tc.NEGATION] = "!";
parser[tc.CONJUNCTION] = "&";
parser[tc.DISJUNCTION] = "v";
parser[tc.IMPLICATION] = "--";
parser[tc.BIIMPLICATION] = "----";
parser[tc.UNIVERSAL] = "A";
parser[tc.EXISTENTIAL] = "E";
*/

tc.register("CONSTANT");
tc.register("VARIABLE");
tc.register("PREDICATE");

// Internally, predicates, constants, and variables are represented by integers:
// 100-999     are predicates,
// 1000-9999   are variables,
// 10000-99999 are constants.
// In output, the integers are translated back into the original symbol, if there is one.
// If not, the following symbols (plus indices) are used:

parser[tc.VARIABLE] = ["x","y","z","w","v","u"];
parser[tc.CONSTANT] = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t"];
parser[tc.PREDICATE] = ["P","Q","R","S","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","T","U","V","W","X","Y","Z"];

Array.prototype.contains = function(element){
	for (var i=0; i<this.length; i++) {
		if (this[i] == element) return true;
	}
	return false;
}
if (!Array.push) {  // IE5/Mac doesn't dupport advanced Array methods
   Array.prototype.push = function(element){
      this[this.length] = element;
   }
   Array.prototype.pop = function(){
      var last = this[this.length-1];
      this[this.length-1] = null;
      this.length = this.length-1;
      return last;
   }
   Array.prototype.splice = function(index, howMany){
      var i,arr = [];
      for (i=2; i<arguments.length; i++) arr[arr.length] = arguments[i];
      for (i=index+howMany; i<this.length; i++) arr[arr.length] = this[i];
      for (i=0; i<arr.length; i++) this[index+i] = arr[i];
      for (var j=index+i; j<this.length; j++) this[j] = null;
      this.length = index+i;
   }
}

parser.parseLog = ""; // Each step of the parsing procedure is logged in this string
parser.error = ""; // The error message when a string could not be parsed

// This function is called in case of a parse error:
parser.exit = function(str) {
	if (this.error) return; // ignore Folgefehler
	this.error = str.replace(/%/g,"\\");
}

parser.reset = function() {
	this.error = this.parseLog = "";
}

// parse a first-order sentence in TeX encoding, returns a 
// formula object representing the sentence (see formula.js).
parser.parseTeX = function(str) {
	parser.parseLog += "parsing '"+str+"';\n";
	var predicate = /[ABCDFGHIJLMNOPQRSTVWXYZ]\d*/ig;                  predicate.lastIndex = 0;
	var term = /[a-z]\d*/g;                                            term.lastIndex = 0;
	var connective = /%neg|%vee|%wedge|%rightarrow|%leftrightarrow/g;  connective.lastIndex = 0;
	var quantifier = /(%forall|%exists)([a-z]\d*)/g;                   quantifier.lastIndex = 0;
	var reTest;
	
	str = str.replace(/[{}]/g, ""); // remove curly brackets
	str = str.replace(/\\ /g, ""); // remove final backslashes
	str = str.replace(/ /g, ""); // remove whitespace
	str = str.replace(/\\/g, "%"); // replace backslash by % (backslashes cause trouble)
	str = str.replace(/%to/g, "%rightarrow"); // normalize alternative TeX notations...
	str = str.replace(/%lor/g, "%vee");
	str = str.replace(/%land/g, "%wedge");	
	str = str.replace(/%lnot/g, "%neg");	

	reTest = connective.test(str);
	if (reTest) {
		// this is a complex formula or a quantified formula with complex scope.
		// first we replace every substring in brackets by "_0_", "_1_", etc.:
		var subStringsInBrackets = new Array(); 
		var bracketDepth = 0;
		var storingAtIndex = -1;
		var nstr = "";
		for (var i=0; i<str.length; i++) {
			if (str.charAt(i) == "(") {
				bracketDepth++;
				if (bracketDepth == 1) {
					storingAtIndex = subStringsInBrackets.length;
					subStringsInBrackets[storingAtIndex] = "";
					nstr += "_"+storingAtIndex+"_";
				}
			}
			if (storingAtIndex == -1) nstr += str.charAt(i);
			else subStringsInBrackets[storingAtIndex] += str.charAt(i);
			if (str.charAt(i) == ")") {
				bracketDepth--;
				if (bracketDepth == 0) storingAtIndex = -1;
			}
		}
		parser.parseLog += "   nstr = '"+nstr+"';\n";
		if (subStringsInBrackets.length > 2) return this.exit("no main connective in subformula "+str);
		// done. Now let's see if there is still a connective in the modified string:
		connective.lastIndex = 0;
		reTest = connective.test(nstr);
		if (reTest) { 
			// yes. so it is a complex formula, or a formula of type "\forall x \neg Fx".
			reTest = nstr.match(/%leftrightarrow/) ||
				nstr.match(/%rightarrow/) ||
				nstr.match(/%vee/) ||
				nstr.match(/%wedge/) ||
				nstr.match(/%neg/);
			if (reTest[0] != "%neg" || nstr.indexOf("%neg") == 0) {
				// It is not of type "\forall x \neg Fx". Split it into main connective 
				// and subformulas:
				parser.parseLog += "   string is complex;\n";
				var formula = new ComplexFormula();
				switch(reTest[0]) {
					case "%leftrightarrow" : formula.operator = tc.BIIMPLICATION; break;
					case "%rightarrow" : formula.operator = tc.IMPLICATION; break;
					case "%vee" : formula.operator = tc.DISJUNCTION; break;
					case "%wedge" : formula.operator = tc.CONJUNCTION; break;
					case "%neg" : formula.operator = tc.NEGATION; break;
				}
				parser.parseLog += "   main connective: "+reTest[0]+";\n";
				nstr = nstr.replace(reTest[0], "-split-");
				for (var i=0; i<subStringsInBrackets.length; i++) {
					nstr = nstr.replace("_"+i+"_", subStringsInBrackets[i]); // restore removed substrings
				}
				var subFormulas = nstr.split("-split-");
				if (!subFormulas[1] || (!subFormulas[0] && formula.operator!=tc.NEGATION)) {
					return this.exit("argument missing for operator "+reTest[0]+" in "+str);
				}
				if (formula.operator==tc.NEGATION) {
					subFormulas[0] = subFormulas[1];
					subFormulas[1] = null;
				}	
				parser.parseLog += "   subformulas: "+subFormulas[0]+", "+subFormulas[1]+";\n";
				formula.subFormulas[0] = this.parseTeX(subFormulas[0]);
				if (subFormulas[1]) formula.subFormulas[1] = this.parseTeX(subFormulas[1]);
				return this.error? null : formula;
			}
		}
	}
	
	reTest = quantifier.exec(str);
	if (reTest && reTest.index == 0) {
		// this is a quantified formula.
		parser.parseLog += "   string is quantified (quantifier = '"+reTest[0]+"');\n";
		var formula = new QuantifiedFormula();
		formula.quantifier = (reTest[0].indexOf("forall") > -1) ? tc.UNIVERSAL : tc.EXISTENTIAL;
		formula.boundVariable = this.getInternal(reTest[2], tc.VARIABLE);
		if (!str.substr(reTest[0].length)) return this.exit("There is nothing in the scope of "+str);
		formula.subFormula = this.parseTeX(str.substr(reTest[0].length));
		return this.error? null : formula;
	}

	reTest = predicate.exec(str);
	if (reTest && reTest.index == 0) {
		// this is an atomic formula.
		parser.parseLog += "   string is atomic (predicate = '"+reTest[0]+"');\n";
		var formula = new AtomicFormula();
		formula.predicate = this.getInternal(reTest[0], tc.PREDICATE);
		var terms = new Array();
		var nstr = str.substr(reTest.length);
		// while (reTest = term.exec(nstr)) {
		//		formula.terms.push(this.getInternal(reTest[0], tc.VARIABLE)); // we treat constants as variables here; no harm
		// }
		nstr = nstr.replace(/^\((.*)\)$/, "$1"); // remove brackets around arguments
		var ch, pos = 0;
		while (ch = nstr.charAt(pos++)) {
			if (ch == ",") continue;
			if (ch.search(term)<0) return this.exit("I expected a term where I found '" + ch + "' in " + str);
			formula.terms.push(this.getInternal(ch, tc.VARIABLE)); // we treat constants as variables here; no harm
		}
		return this.error? null : formula;
	}

	parser.parseLog += "   string could not be identified as anything;\n";
	if (str.match(/^\((.*)\)$/)) {
		parser.parseLog += "   trying again without outer brackets;\n";
		return this.parseTeX(str.replace(/^\((.*)\)$/, "$1")); // remove outer brackets
	}

	this.exit("I can't make sense of this: "+str);
}		

// returns the readable string corresponding to a formula:
parser.getString = function(formula) {
	var str = "";
	if (formula.type == tc.ATOMIC) {
		str += this.getReadable(formula.predicate);
		for (var i=0; i<formula.terms.length; i++) str += this.getReadable(formula.terms[i]);
		return str;
	}
	else if (formula.type == tc.QUANTIFIED) {
		str += this[formula.quantifier];
		str += this.getReadable(formula.boundVariable);
		str += this.getString(formula.subFormula);
		return str;
	}
	else if (formula.type == tc.COMPLEX) {
		if (formula.operator == tc.NEGATION) {
			str += this[formula.operator];
			str += this.getString(formula.subFormulas[0]);
		}
		else {
			str += "(";
			str += this.getString(formula.subFormulas[0]);
			str += this[formula.operator];
			str += this.getString(formula.subFormulas[1]);
			str += ")";
		}
		return str;
	}
}


// the rest is for internal translations...

// return readable counterpart of internal symbol:
parser.getReadable = function(internal) {
	if (parser.internal2readable[internal]) return parser.internal2readable[internal];
	// find new readable symbol:
	var type = this.getType(internal);
	var readable = this.getNewSymbol(type);
	parser.readable2internal[readable] = internal;
	parser.internal2readable[internal] = readable;
	return readable;
}

// returns internal counterpart of readable symbol:
parser.getInternal = function(readable, type) {
	if (parser.readable2internal[readable]) return parser.readable2internal[readable];
	// find new internal symbol:
	// var type = this.getType(readable);
	var base = (type == tc.PREDICATE) ?  100 : 
		(type == tc.VARIABLE) ? 1000 : 
		(type == tc.CONSTANT) ? 10000 :
		this.exit("unknown type: "+type);
	var internal = base;
	while (parser.internal2readable[internal]) internal++;
	parser.readable2internal[readable] = internal;
	parser.internal2readable[internal] = readable;
	return internal;
}

// returns a new (readable) symbol of a given type
parser.getNewSymbol = function(type) {
	for (var i=0; i<this[type].length; i++) {
		if (!this.readable2internal[this[type][i]]) return this[type][i];
	}
	var i=2;
	while (this.readable2internal[this[type][0]+i]) i++;
	return this[type][0]+i;
}

parser.readable2internal = new Object();
parser.internal2readable = new Object();
parser.getType = function(symbol) {
	/*
	if (isNaN(symbol)) {
		return (this[tc.CONSTANT].contains(symbol)) ? tc.CONSTANT :
			(this[tc.VARIABLE].contains(symbol)) ? tc.VARIABLE :
			(this[tc.PREDICATE].contains(symbol)) ? tc.PREDICATE :
			this.exit("unrecognized readable symbol: "+symbol);
	}
	else {
	*/
		return (symbol < 1000) ? tc.PREDICATE : (symbol < 10000) ? tc.VARIABLE : tc.CONSTANT;
}
