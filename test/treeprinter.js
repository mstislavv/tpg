/** This script is (c) Wolfgang Schwarz 2002, wolfgang@umsu.de. **/

/**
 * API ZUM MALEN VON BAEUMEN
 *
 * SYNOPSIS:
 *    Knoten(html)                - Konstruktor zum Erzeugen des Wurzel-Elements
 *    [Knoten].appendChild(html)  - haengt an einen Knoten einen neuen an, liefert den Kind-Knoten zurueck
 *    [Knoten].setBgColor("#rgb") - setzt die Hintergrundfarbe eines Knotens
 *    reflowTree(wurzelKnoten)    - malt/aktualisiert den Baum
 *
 * BEISPIEL:
 *    onload = function() {
 *       wurzel = new Knoten("<b>Wurzel</b>");
 *       kinder = new Array();
 *       kinder[0] = wurzel.appendChild("erstes Kind");
 *       kinder[1] = wurzel.appendChild("zweites Kind");
 *       kinder[2] = wurzel.appendChild("drittes Kind");
 *       reflowTree(wurzel);
 *    }
 *    function kindersex(kindNr, html) {
 *       kinder[kinder.length] = kinder[kindNr].appendChild(html);
 *       reflowTree(wurzel);
 *    }
 * 
 * EINSTELLUNGEN:
 *    Das Aussehen der Knoten und Verbindungslinien wird durch die CSS-Klassen
 *    .knoten und .linie bestimmt, die etwa so beschaffen sein sollten:
 *       .knoten { position:absolute; left:-100px; top:0; white-space:pre; color:#000000; }
 *       .linie { position:absolute; left:0; top:0; background-color:#660000; width:1px; height:1px; clip:rect(0px 1px 1px 0px); }
 *    Das Aussehen des ganzen Baums kann ausserdem durch die Konstanten direkt unter 
 *    dieser Einleitung bestimmt werden. 
 *
 * BUGS UND PROBLEME:
 *    - Die Knoten werden mit proprietaeren DOM-Erweiterungen wie Layern, innerHTML, offsetWidth
 *      erzeugt. Das funktioniert weder mit reinen DOM-Browsern noch mit IE4.
 *    - Die Linien werden pixelweise gemalt, sind deshalb sehr rechenintensiv. Bei 
 *      grossen Baeumen koennen Abstuerze die Folge sein.
 *    - Der globale Namensraum wird vollgemuellt durch die untenstehenden Konstanten
 *      sowie die Objekte Knoten, XElement, reflowTree, machPixel, linie, _pixels, 
 *      _pixelsBenutzt.
 *
 **/

ZEILENABSTAND       = 2;      // Abstand zwischen untereinander stehenden Knoten
ZEILENABSTAND_V     = 10;     // Abstand zwischen einem Knoten und den darunterstehenden bei Verzweigungen
ASTABSTAND          = 30;     // Mindest-Abstand zwischen nebeneinander stehenden �sten
URSPRUNG_X          = 370;    // X-Koordinate des Wurzel-Knotens
URSPRUNG_Y          = 190;    // Y-Koordinate des Wurzel-Knotens
URSPRUNG_VARIABEL   = true;   // Wenn der Baum links aus dem Fenster waechst, Ursprung nach rechts verschieben?
VERTIKALE_LINIEN    = false;  // Linien zwischen untereinander stehenden Knoten?
VERZWEIGUNGS_LINIEN = true;   // Linien von einem Knoten zu den Nachfolgenden bei Verzweigungen?
LINIENPIXELABSTAND  = 6;      // Jeder wievielte Pixel der Linie gemalt wird: 1=durchgezogen.


// bei NN4 erzeugen wir einen Layer fuer jeden Knoten und Linien-Pixel, dessen
// Inhalt ein DIV mit class="knoten" bzw. "linie" ist. Dieser Inhalt sollte
// nicht selbst wieder positioniert sein, deshalb loeschen wir die Position
// aus den Style-Angaben:
if (document.layers) {
	document.classes.knoten.all.position = "";
	document.classes.linie.all.position = "";
}

// XElement-Objekte vertreten die einzelnen DOM-Elemente, um den
// X-Browser-Zugriff zu vereinfachen. Sie werden nur intern benoetigt.
function XElement(domElement) {
	this.el = domElement;
	this.css = document.layers? this.el : this.el.style;
	this.unit = document.layers? "" : "px";
}
XElement.prototype = {
	getX : function() {
		return document.layers? this.el.left : this.el.scrollLeft || this.el.offsetLeft;
	},
	getY : function() {
		return document.layers? this.el.top : this.el.scrollTop || this.el.offsetTop;
	},
	getWidth : function() {
      void(this.el.offsetWidth); // bugfix for weird IE5/Mac bug: Removing this will result in undefined offsetWidth
		return document.layers? this.el.clip.width : this.el.scrollWidth || this.el.offsetWidth;
	},
	getHeight : function() {
		return document.layers? this.el.clip.height : this.el.scrollHeight || this.el.offsetHeight;
	},
	setX : function(v) {
		this.css.left = v + this.unit;
	},
	setY : function(v) {
		this.css.top = v + this.unit;
	},
	setBg : function(c) {
		if (this.el.style) this.css.backgroundColor = c;
		else this.el.bgColor = c;
	}
}

// Das Knoten-Objekt repraesentiert einen Knoten. Direkt erzeugt werden muss
// lediglich der Ursprungsknoten, ab dann sollte nur noch [knoten].appendChild(html) 
// aufgerufen werden. Diese Methode liefert den neu erzeugten Knoten zurueck.
function Knoten(html) {
	// Element erzeugen:
	if (document.layers) {
		var nl = new Layer(50, self);
		nl.position = "absolute";
		nl.top = -50;
		nl.visibility = "visible";
		nl.document.write('<div class="knoten">' + html + '</div>');
		nl.document.close();
		this.element = new XElement(nl);
		this.element.text = html;
	}
	else {
		var div = document.createElement("div");
		div.innerHTML = html;
		div.className = "knoten";
		document.body.appendChild(div);
		this.element = new XElement(div);
		this.element.text = html;
	}
	this.x = 0;           // die x-Koordinate der _Mitte_ des Knotens
	this.y = 0;           // die y-Koordinate des oberen Knotenrands
	this.parent = null;
	this.kinder = new Array();
}
Knoten.prototype = {
	appendChild : function(elem) {
		var kind = new Knoten(elem);
		kind.parent = this;
		this.kinder[this.kinder.length] = kind;
		return kind;
	},
	breiteSubBaum : function(inclThis) {
		var thisBreite = inclThis? this.element.getWidth() : 0;
      var kinderBreite = 0;
		for (var i=0; i<this.kinder.length; i++) {
			kinderBreite += this.kinder[i].breiteSubBaum(true);
			if (i>0) kinderBreite += ASTABSTAND;
		}
		return Math.max(thisBreite, kinderBreite);
	},
	positioniere : function(x, y) {
		this.x = x;
		this.y = y;
		this.element.setY(y);
      this.element.setX(x - this.element.getWidth()/2);
      
		if (this.parent &&
			((VERTIKALE_LINIEN && this.x == this.parent.x) ||
			(VERZWEIGUNGS_LINIEN && this.x != this.parent.x)))	{
			linie(this.x, this.y, this.parent.x, this.parent.y + this.parent.element.getHeight());
		}
	},
	setBgColor : function(c) {
		this.element.setBg(c);
	},
	reflowKinder : function() {
		if (this.kinder.length == 0) return;
		var linksErsterSubBaum = this.x - this.breiteSubBaum(false)/2;
		var y = this.y + this.element.getHeight() + (this.kinder.length==1? ZEILENABSTAND : ZEILENABSTAND_V);
		var breiteLinkeNachbarn = 0;
		for (var i=0; i<this.kinder.length; i++) {
			var links = linksErsterSubBaum + breiteLinkeNachbarn;
			var breite = this.kinder[i].breiteSubBaum(true);
			var x = links + breite/2;
			this.kinder[i].positioniere(x,y);
			breiteLinkeNachbarn += breite + ASTABSTAND;
			this.kinder[i].reflowKinder();
		}
	}
}

// Diese Funktion malt den am uebergebenen Knoten haengenden Baum.
function reflowTree(wurzel) {
   _pixelsBenutzt = 0;
   var x = URSPRUNG_VARIABEL? Math.max(URSPRUNG_X, wurzel.breiteSubBaum(true)/2) : URSPRUNG_X;
   var y = URSPRUNG_Y;
	wurzel.positioniere(x,y);
	wurzel.reflowKinder();
	if (document.layers) {
		document.width = Math.max(document.width, wurzel.breiteSubBaum(true));
		document.height = 5000; // DUMMY!!!
	}
}

// Die naechsten beiden Funktionen werden gebraucht um Linien zu malen.
function machPixel() {
	if (document.layers) {
		var nl = new Layer(10, self);
		nl.position = "absolute";
		nl.clip.width = 1;
		nl.clip.height = 1;
		nl.visibility = "visible";
		nl.document.write('<div class="linie">&nbsp;</div>');
		nl.document.close();
		var elem = new XElement(nl);
		return elem;
	}
	else {
		var div = document.createElement("div");
		div.className = "linie";
		document.body.appendChild(div);
		var elem = new XElement(div);
		return elem;
	}
}

_pixels = new Array();
_pixelsBenutzt = 0;
function linie(x1, y1, x2, y2) {
	var distX = x2 - x1;
	var distY = y2 - y1;
	var dist = Math.sqrt(distX*distX + distY*distY);
	var pxX = distX/dist;
	var pxY = distY/dist;
	// ein "Pixel" auf der Linie von x1/y1 ausgehend liegt bei x1+pxX / y1+pxY.
	// wir gehen "Pixel" fuer "Pixel" auf der Diagonale und malen dabei, wenn's was zu malen gibt:
	var gemalt = 1;
	var punktX = x1;
	var punktY = y1;
	while (gemalt < dist) {
		if ((punktX != Math.round(x1 + gemalt*pxX) || punktY != Math.round(y1 + gemalt*pxY))
			&& gemalt%LINIENPIXELABSTAND == 0) {
			punktX = Math.round(x1 + gemalt*pxX);
			punktY = Math.round(y1 + gemalt*pxY);
			if (!_pixels[_pixelsBenutzt]) _pixels[_pixelsBenutzt] = machPixel();
			_pixels[_pixelsBenutzt].setX(punktX);
			_pixels[_pixelsBenutzt].setY(punktY);
			_pixelsBenutzt++;
		}
		gemalt++;
	}
}
