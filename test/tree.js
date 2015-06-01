/** This script is (c) Wolfgang Schwarz 2002, wolfgang@umsu.de. **/

/**
 * CONSTRUCTOR FOR NODES IN A PROOF TREES
 *    needs formulas.js
 *
 * TreeNode(formula, truthValue)    - creates a new TreeNode with the given truth value
 *   .ticked                        - boolean, false if the node can still be developed
 *   .closed                        - boolean, whether the branch closes at that node
 *   .branchClosed                  - boolean, whether all subbranches are closed
 *   .type                          - tc.CONJUNCTION or tc.NCONJUNCTION or ...
 *   .developedFrom                 - TreeNode, the node from which this one was developed
 *   .parent                        - TreeNode, the node immediately above this one
 *   .children                      - TreeNode[], inverse of parent
 *   .contradictory                 - defined and true iff this is a part of a contradictory pair
 *   .append(node, [developedFrom]) - appends node to this node, and marks developedFrom of node
 *   .remove()                      - removes this node from the tree
 *   .develop([termToUse])          - develops this node, using the given term (for quantified nodes)
 *   .getEndNodes()                 - returns all open endnodes below this node
 *   .getAllEndNodes()              - returns all open or closed endnodes below this node
 *   .checkClosed()                 - marks the last node on any contradictory subbranch as closed
 *   .getFormula()                  - returns the node's formula (negated if truthValue is false)
 *   .tree.num   	                  - int, number of nodes in the entire tree
 *   .tree.undeveloped              - TreeNode[], all unticked nodes on open branches in the entire tree
 *   .tree.terms                    - int[], all terms used in the entire tree
 *   .tree.numOpen                  - int, number of open branches in the entire tree
 **/

tc.register("NATOMIC");
tc.register("NNEGATION");
tc.register("NCONJUNCTION");
tc.register("NDISJUNCTION");
tc.register("NIMPLICATION");
tc.register("NBIIMPLICATION");
tc.register("NUNIVERSAL");
tc.register("NEXISTENTIAL");

function TreeNode(formula, truthValue) {
	this.tree.num++;
	this.ticked = false;
	this.closed = false;
	this.children = new Array();
   this.parent = null;
	this.developedFrom = null;
	this.formula = formula;
	this.truthValue = truthValue;
	if (truthValue == true && formula.operator == tc.NEGATION) {
		this.formula = formula.subFormulas[0];
		this.truthValue = !truthValue;
	}
	this.type = 
		(this.formula.type == tc.ATOMIC) ? tc.ATOMIC :
		(this.formula.type == tc.QUANTIFIED) ? this.formula.quantifier :
		(this.formula.type == tc.COMPLEX) ? this.formula.operator :
		null;
	if (this.type == tc.ATOMIC) this.ticked = true;
	else this.tree.undeveloped.push(this);
	if (!this.truthValue) this.type = tc["N"+tc.getName(this.type)];
}

TreeNode.prototype = {
	
	tree : { // Object, because primitive types are copied for each instance
		num : 0,
		numOpen : 1,
		terms : new Array(),
		undeveloped : new Array()
	}, 
				
	removeFromUndeveloped : function() {
		for (var i=0; i<this.tree.undeveloped.length; i++) {
			if (this.tree.undeveloped[i] == this) {
				this.tree.undeveloped.splice(i,1);
				break;
			}
		}
	},
	
	getFormula : function() {
		if (this.truthValue == true) return this.formula;
		else {
			var formula = new ComplexFormula();
			formula.operator = tc.NEGATION;
			formula.subFormulas[0] = this.formula;
			return formula;
		}
	},
	
	toString : function() {
		if (self.parser) return parser.getString(this.getFormula());
		else return this.getFormula();
	},
	
	appendNode : function(node, developedFrom) {
		this.children.push(node);
		node.parent = this;
		node.developedFrom = developedFrom;
   },

	remove : function() {
		if (!parent) return; // you can't remove the root node
		// we also have to remove all nodes that were developed from this one; moreover, 
		// if this is a branching rule, one of the branches has to be removed completely.
		if (this.formula.type != tc.ATOMIC) {
			var endNodes = this.getAllEndNodes();
			var doomedBranches = new Array(); // here we'll store the right one of every two nodes immediately after a branching where this node was developed:
			var doomedNodes = new Array(); // and this takes the corresponding left ones - or all nodes developed from this one if it isn't branching
			for (var i=0; i<endNodes.length; i++) {
				var node = endNodes[i];
				do {
					if (node.developedFrom == this) {
						//	alert("removing node "+parser.getString(node.getFormula())+"\nwhich depends on "+parser.getString(this.getFormula()));
						if (node.parent.children[1] && !doomedBranches.contains(node.parent.children[1])) doomedBranches.push(node.parent.children[1]);
						if (!doomedNodes.contains(node)) doomedNodes.push(node);
						break;
					}
				} while ((node = node.parent) && node != this)
			}
			// destroy the doomed branches:
			for (var i=0; i<doomedBranches.length; i++) {
				doomedBranches[i].parent.children.pop();
				doomedBranches[i].removeBranchBelow();
			}
			// remove the doomed nodes:
			for (var i=0; i<doomedNodes.length; i++) {
				doomedNodes[i].remove();
			}
		}
		// finally, take this node out of the tree:
		var newParentChildren = new Array();
		for (var i=0; i<this.parent.children.length; i++) {
			if (this.parent.children[i] == this) {
				for (var j=0; j<this.children.length; j++) {
					this.children[j].parent = this.parent;
					newParentChildren.push(this.children[j]);
				}
			}
			else newParentChildren.push(this.parent.children[i]);
		}
		this.parent.children = newParentChildren;
		this.tree.num--;
	},

	removeBranchBelow : function() {
		for (var i=0; i<this.children.length; i++) this.children[i].removeBranchBelow();
		this.closedBranch = true; // hack to keep getEndNodes working after removal
		this.children = new Array();
		this.tree.num--;
	},
	
	getEndNodes : function() {
		if (!this.previousEndNodes) this.previousEndNodes = [this];
		var endNodes = new Array();
		for (var i=0; i<this.previousEndNodes.length; i++) {
			this.previousEndNodes[i].getEndNodesReally(endNodes);
		}
		return this.previousEndNodes = endNodes;
	},

	getEndNodesReally : function(endNodes) {
		if (this.branchClosed) return;
		if (this.children.length == 0) endNodes.push(this);
		for (var i=0; i<this.children.length; i++) {
			this.children[i].getEndNodesReally(endNodes);
		}
	},

	getAllEndNodes : function() {
		var endNodes = arguments[0] || new Array();
		if (this.children.length == 0) endNodes.push(this);
		else for (var i=0; i<this.children.length; i++) {
			this.children[i].getAllEndNodes(endNodes);
		}
		return endNodes;
	},

	checkClosed : function() {
		var endNodes = this.getEndNodes();
		var node1, node2;
		for (var i=0; i<endNodes.length; i++) {
			if (endNodes[i].alreadyCompared) continue;
			node1 = endNodes[i];
			compareNodes: 
			do {
				node2 = node1;
				while (node2 = node2.parent) {
					if (node1.truthValue != node2.truthValue && node1.formula.equals(node2.formula)) {
					// This does not recognize branches that close because of a doubly negated formula!
					// A slower condition which takes care of those too is this one:
					// if ((node1.truthValue ? node1.formula : node1.formula.negate()).equals(node2.truthValue ? node2.formula.negate() : node2.formula)) {
						node1.contradictory = true;
						node2.contradictory = true;
						this.markClosed(endNodes[i]);
						break compareNodes;
					}
				}
				node1.alreadyCompared = true; // prevent us from checking what has already been checked
			} while ((node1 = node1.parent) && !node1.alreadyCompared);
		}
	},

	markClosed : function(node) {
		node.closed = true;
		node.tree.numOpen--;
		do {
			node.branchClosed = true;
			if (!node.ticked) node.removeFromUndeveloped();
			if (node.parent && node.parent.children.length > 1) {
				var openSiblings = false;
				for (var i=0; i<node.parent.children.length; i++) {
					if (!node.parent.children[i].branchClosed) openSiblings = true;
				}
				if (openSiblings) break;
			}
		} while (node = node.parent);
	},
	
	tick : function(numNewBranches) {
		this.ticked = true;
		this.removeFromUndeveloped();
		if (numNewBranches) this.tree.numOpen += numNewBranches;
	},
	
	develop : function(termToUse) { // termToUse is only meaningful for quantified formulas
		if (this.ticked) return false;
		var endNodes = this.getEndNodes();
		if (endNodes.length == 0) return false;
		this[this.type](endNodes, termToUse); // the prototype is used as an Array of applyRule functions (see below)
		this.checkClosed();
		return true;
	}
	
}

TreeNode.prototype[tc.NNEGATION] = function(endNodes, termToUse) {
	for (var i=0; i<endNodes.length; i++) {
		var node = new TreeNode(this.formula.subFormulas[0], true);
		endNodes[i].appendNode(node, this);
	}
	this.tick();
}
TreeNode.prototype[tc.CONJUNCTION] = function(endNodes, termToUse) {
	for (var i=0; i<endNodes.length; i++) {
		var node = new TreeNode(this.formula.subFormulas[0], true);
		var node2 = new TreeNode(this.formula.subFormulas[1], true);
		node.appendNode(node2, this);
		endNodes[i].appendNode(node, this);
	}
	this.tick();
}
TreeNode.prototype[tc.NCONJUNCTION] = function(endNodes, termToUse) {
	for (var i=0; i<endNodes.length; i++) {
		var node = new TreeNode(this.formula.subFormulas[0], false);
		var node2 = new TreeNode(this.formula.subFormulas[1], false);
		endNodes[i].appendNode(node, this);
		endNodes[i].appendNode(node2, this);
	}
	this.tick(endNodes.length);
}
TreeNode.prototype[tc.DISJUNCTION] = function(endNodes, termToUse) {
	for (var i=0; i<endNodes.length; i++) {
		var node = new TreeNode(this.formula.subFormulas[0], true);
		var node2 = new TreeNode(this.formula.subFormulas[1], true);
		endNodes[i].appendNode(node, this);
		endNodes[i].appendNode(node2, this);
	}
	this.tick(endNodes.length);
}
TreeNode.prototype[tc.NDISJUNCTION] = function(endNodes, termToUse) {
	for (var i=0; i<endNodes.length; i++) {
		var node = new TreeNode(this.formula.subFormulas[0], false);
		var node2 = new TreeNode(this.formula.subFormulas[1], false);
		node.appendNode(node2, this);
		endNodes[i].appendNode(node, this);
	}
	this.tick();
}
TreeNode.prototype[tc.IMPLICATION] = function(endNodes, termToUse) {
	for (var i=0; i<endNodes.length; i++) {
		var node = new TreeNode(this.formula.subFormulas[0], false);
		var node2 = new TreeNode(this.formula.subFormulas[1], true);
		endNodes[i].appendNode(node, this);
		endNodes[i].appendNode(node2, this);
	}
	this.tick(endNodes.length);
}
TreeNode.prototype[tc.NIMPLICATION] = function(endNodes, termToUse) {
	for (var i=0; i<endNodes.length; i++) {
		var node = new TreeNode(this.formula.subFormulas[0], true);
		var node2 = new TreeNode(this.formula.subFormulas[1], false);
		node.appendNode(node2, this);
		endNodes[i].appendNode(node, this);
	}
	this.tick();
}
TreeNode.prototype[tc.BIIMPLICATION] = function(endNodes, termToUse) {
	for (var i=0; i<endNodes.length; i++) {
		var node = new TreeNode(this.formula.subFormulas[0], true);
		var node2 = new TreeNode(this.formula.subFormulas[1], true);
		var node3 = new TreeNode(this.formula.subFormulas[0], false);
		var node4 = new TreeNode(this.formula.subFormulas[1], false);
		node.appendNode(node2, this);
		node3.appendNode(node4);
		endNodes[i].appendNode(node, this);
		endNodes[i].appendNode(node3);
	}
	this.tick(endNodes.length);
}
TreeNode.prototype[tc.NBIIMPLICATION] = function(endNodes, termToUse) {
	for (var i=0; i<endNodes.length; i++) {
		var node = new TreeNode(this.formula.subFormulas[0], true);
		var node2 = new TreeNode(this.formula.subFormulas[1], false);
		var node3 = new TreeNode(this.formula.subFormulas[0], false);
		var node4 = new TreeNode(this.formula.subFormulas[1], true);
		node.appendNode(node2, this);
		node3.appendNode(node4);
		endNodes[i].appendNode(node, this);
		endNodes[i].appendNode(node3);
	}
	this.tick(endNodes.length);
}
TreeNode.prototype[tc.UNIVERSAL] = function(endNodes, termToUse) {
	var term = this.findTerm(termToUse);
	for (var i=0; i<endNodes.length; i++) {
		var node = new TreeNode(this.formula.subFormula.substitute(this.formula.boundVariable, term), true);
		endNodes[i].appendNode(node, this);
	}
}
TreeNode.prototype[tc.NUNIVERSAL] = function(endNodes, termToUse) {
	var term = this.findTerm(termToUse);
	for (var i=0; i<endNodes.length; i++) {
		var node = new TreeNode(this.formula.subFormula.substitute(this.formula.boundVariable, term), false);
		endNodes[i].appendNode(node, this);
	}
	this.tick();
}
TreeNode.prototype[tc.EXISTENTIAL] = function(endNodes, termToUse) {
	var term = this.findTerm(termToUse);
	for (var i=0; i<endNodes.length; i++) {
		var node = new TreeNode(this.formula.subFormula.substitute(this.formula.boundVariable, term), true);
		endNodes[i].appendNode(node, this);
	}
	this.tick();
}
TreeNode.prototype[tc.NEXISTENTIAL] = function(endNodes, termToUse) {
	var term = this.findTerm(termToUse);
	for (var i=0; i<endNodes.length; i++) {
		var node = new TreeNode(this.formula.subFormula.substitute(this.formula.boundVariable, term), false);
		endNodes[i].appendNode(node, this);
	}
}

TreeNode.prototype.findTerm = function(termToUse) {
	// this.usedTerms stores all terms with which this formula has already been developed.
	if (!this.usedTerms) this.usedTerms = new Array();
	if (termToUse) {
		if (!this.tree.terms.contains(termToUse)) this.terms.push(termToUse);
		this.usedTerms.push(termToUse);
		return termToUse;
	}
	if (this.type == tc.NEXISTENTIAL || this.type == tc.UNIVERSAL) {
		for (var i=0; i<this.tree.terms.length; i++) {
			if (!this.usedTerms.contains(this.tree.terms[i])) {
				this.usedTerms.push(this.tree.terms[i]);
				return this.tree.terms[i];
			}
		}
	}
	var t = 10000;
	while (this.tree.terms.contains(t)) t++;
	this.tree.terms.push(t);
	this.usedTerms.push(t);
	return t;
}