export class GeoXML3Parser extends google.maps.MVCObject {

    // Private variables
    private parserOptions = new geoXML3.parserOptions(options);
    private docs = [];  // Individual KML documents
    private docsByUrl = {};  // Same docs as an hash by cleanURL
    private kmzMetaData = {};  // Extra files from KMZ data
    private styles = {};  // Global list of styles
    private lastPlacemark;
    private parserName;

    private nodeValue = geoXML3.nodeValue;
    private getBooleanValue = geoXML3.getBooleanValue;
    private getElementsByTagNameNS = geoXML3.getElementsByTagNameNS;
    private getElementsByTagName = geoXML3.getElementsByTagName;

    constructor() {
        super();
        if (!this.parserOptions.infoWindow && this.parserOptions.singleInfoWindow) {
            this.parserOptions.infoWindow = new google.maps.InfoWindow();
        }
    }
    public parseKmlString(kmlString, docSet) {
        // Internal values for the set of documents as a whole
        const internals = {
            parser: this,
            docSet: docSet || [],
            remaining: 1,
            parseOnly: !(this.parserOptions.afterParse || this.parserOptions.processStyles)
        };
        const thisDoc = new Object();
        thisDoc.internals = internals;
        internals.docSet.push(thisDoc);
        render(geoXML3.xmlParse(kmlString), thisDoc);
    }
    private parse(urls, docSet) {
        // Process one or more KML documents
        if (!this.parserName) {
            this.parserName = 'geoXML3.instances[' + (geoXML3.instances.push(this) - 1) + ']';
        }
        if (typeof urls === 'string') {
            // Single KML document
            urls = [urls];
        }
        // Internal values for the set of documents as a whole
        const internals = {
            parser: this,
            docSet: docSet || [],
            remaining: urls.length,
            parseOnly: !(this.parserOptions.afterParse || this.parserOptions.processStyles)
        };
        let thisDoc, j;
        for (let i = 0; i < urls.length; i++) {
            const baseUrl = cleanURL(defileURL(location.pathname), urls[i]);
            if (this.docsByUrl[baseUrl]) {
                // Reloading an existing document
                thisDoc = this.docsByUrl[baseUrl];
                thisDoc.reload = true;
            }
            else {
                thisDoc = new Object();
                thisDoc.baseUrl = baseUrl;
                internals.docSet.push(thisDoc);
            }
            thisDoc.url = urls[i];
            thisDoc.internals = internals;
            this.fetchDoc(thisDoc.url, thisDoc);
        }
    }
    private fetchDoc(url, doc, resFunc?) {
        resFunc = resFunc || function (responseXML) { render(responseXML, doc); };

        if (typeof ZipFile === 'function' && typeof JSIO === 'object' && typeof JSIO.guessFileType === 'function') {  // KMZ support requires these modules loaded
            // if url is a data URI scheme, do not guess type based on extension.
            if (/^data:[^,]*(kmz)/.test(doc.baseUrl)) {
                contentType = JSIO.FileType.Binary;
            } else if (/^data:[^,]*(kml|xml)/.test(doc.baseUrl)) {
                contentType = JSIO.FileType.XML;
            } else if (/^data:/.test(doc.baseUrl)) {
                contentType = JSIO.FileType.Unknown;
            } else if (parserOptions.forceZip) {
                contentType = JSIO.FileType.Binary;
            } else {
                contentType = JSIO.guessFileType(doc.baseUrl);
            }
            if (contentType == JSIO.FileType.Binary || contentType == JSIO.FileType.Unknown) {
                doc.isCompressed = true;
                doc.baseDir = doc.baseUrl + '/';
                geoXML3.fetchZIP(url, resFunc, doc.internals.parser);
                return;
            }
        }
        doc.isCompressed = false;
        doc.baseDir = defileURL(doc.baseUrl);
        geoXML3.fetchXML(url, resFunc);
    }

    private hideDocument(doc) {
        if (!doc) {
            doc = this.docs[0];
        }
        // Hide the map objects associated with a document
        let i;
        if (!!doc.markers) {
            for (i = 0; i < doc.markers.length; i++) {
                if (!!doc.markers[i].infoWindow) {
                    doc.markers[i].infoWindow.close();
                }
                doc.markers[i].setVisible(false);
            }
        }
        if (!!doc.ggroundoverlays) {
            for (i = 0; i < doc.ggroundoverlays.length; i++) {
                doc.ggroundoverlays[i].setOpacity(0);
            }
        }
        if (!!doc.gpolylines) {
            for (i = 0; i < doc.gpolylines.length; i++) {
                if (!!doc.gpolylines[i].infoWindow) {
                    doc.gpolylines[i].infoWindow.close();
                }
                doc.gpolylines[i].setMap(null);
            }
        }
        if (!!doc.gpolygons) {
            for (i = 0; i < doc.gpolygons.length; i++) {
                if (!!doc.gpolygons[i].infoWindow) {
                    doc.gpolygons[i].infoWindow.close();
                }
                doc.gpolygons[i].setMap(null);
            }
        }
    }

    private showDocument(doc) {
        if (!doc) {
            doc = this.docs[0];
        }
        // Show the map objects associated with a document
        let i;
        if (!!doc.markers) {
            for (i = 0; i < doc.markers.length; i++) {
                doc.markers[i].setVisible(true);
            }
        }
        if (!!doc.ggroundoverlays) {
            for (i = 0; i < doc.ggroundoverlays.length; i++) {
                doc.ggroundoverlays[i].setOpacity(doc.ggroundoverlays[i].percentOpacity_);
            }
        }
        if (!!doc.gpolylines) {
            for (i = 0; i < doc.gpolylines.length; i++) {
                doc.gpolylines[i].setMap(this.parserOptions.map);
            }
        }
        if (!!doc.gpolygons) {
            for (i = 0; i < doc.gpolygons.length; i++) {
                doc.gpolygons[i].setMap(this.parserOptions.map);
            }
        }
    }

    private processStyleUrl(node) {
        const styleUrlStr = nodeValue(getElementsByTagName(node, 'styleUrl')[0]);
        let styleUrl;
        if (!!styleUrlStr && styleUrlStr.indexOf('#') !== -1) {
            styleUrl = styleUrlStr.split('#');
        }
        else {
            styleUrl = ['', ''];
        }
        return styleUrl;
    }

    private processStyle(thisNode, baseUrl, styleID, baseDir) {
        const style = (baseUrl === '{inline}') ? clone(defaultStyle) : (styles[baseUrl][styleID] = styles[baseUrl][styleID] || clone(defaultStyle));

        let styleNodes = getElementsByTagName(thisNode, 'BalloonStyle');
        if (!!styleNodes && styleNodes.length > 0) {
            style.balloon.bgColor = nodeValue(getElementsByTagName(styleNodes[0], 'bgColor')[0], style.balloon.bgColor);
            style.balloon.textColor = nodeValue(getElementsByTagName(styleNodes[0], 'textColor')[0], style.balloon.textColor);
            style.balloon.text = nodeValue(getElementsByTagName(styleNodes[0], 'text')[0], style.balloon.text);
            style.balloon.displayMode = nodeValue(getElementsByTagName(styleNodes[0], 'displayMode')[0], style.balloon.displayMode);
        }

        // style.list = (unsupported; doesn't make sense in Google Maps)

        styleNodes = getElementsByTagName(thisNode, 'IconStyle');
        if (!!styleNodes && styleNodes.length > 0) {
            const icon = style.icon;

            icon.scale = parseFloat(nodeValue(getElementsByTagName(styleNodes[0], 'scale')[0], icon.scale));
            // style.icon.heading   = (unsupported; not supported in API)
            // style.icon.color     = (unsupported; not supported in API)
            // style.icon.colorMode = (unsupported; not supported in API)

            styleNodes = getElementsByTagName(styleNodes[0], 'hotSpot');
            if (!!styleNodes && styleNodes.length > 0) {
                icon.hotSpot = {
                    x: styleNodes[0].getAttribute('x'),
                    y: styleNodes[0].getAttribute('y'),
                    xunits: styleNodes[0].getAttribute('xunits'),
                    yunits: styleNodes[0].getAttribute('yunits')
                };
            }

            styleNodes = getElementsByTagName(thisNode, 'Icon');
            if (!!styleNodes && styleNodes.length > 0) {
                icon.href = nodeValue(getElementsByTagName(styleNodes[0], 'href')[0]);
                icon.url = cleanURL(baseDir, icon.href);
                // Detect images buried in KMZ files (and use a base64 encoded URL)
                if (kmzMetaData[icon.url]) {
                    icon.url = kmzMetaData[icon.url].dataUrl;
                }

                // Support for icon palettes and exact size dimensions
                icon.dim = {
                    x: parseInt(nodeValue(getElementsByTagNameNS(styleNodes[0], gxNS, 'x')[0], icon.dim.x)),
                    y: parseInt(nodeValue(getElementsByTagNameNS(styleNodes[0], gxNS, 'y')[0], icon.dim.y)),
                    w: parseInt(nodeValue(getElementsByTagNameNS(styleNodes[0], gxNS, 'w')[0], icon.dim.w)),
                    h: parseInt(nodeValue(getElementsByTagNameNS(styleNodes[0], gxNS, 'h')[0], icon.dim.h))
                };

                // certain occasions where we need the pixel size of the image (like the default settings...)
                // (NOTE: Scale is applied to entire image, not just the section of the icon palette.  So,
                //  if we need scaling, we'll need the img dimensions no matter what.)
                if (true /* (icon.dim.w < 0 || icon.dim.h < 0) && (icon.xunits != 'pixels' || icon.yunits == 'fraction') || icon.scale != 1.0 */) {
                    // (hopefully, this will load by the time we need it...)
                    icon.img = new Image();
                    icon.img.onload = function () {
                        if (icon.dim.w < 0 || icon.dim.h < 0) {
                            icon.dim.w = this.width;
                            icon.dim.h = this.height;
                        } else {
                            icon.dim.th = this.height;
                        }
                    };
                    icon.img.src = icon.url;

                    // sometimes the file is already cached and it never calls onLoad
                    if (icon.img.width > 0) {
                        if (icon.dim.w < 0 || icon.dim.h < 0) {
                            icon.dim.w = icon.img.width;
                            icon.dim.h = icon.img.height;
                        } else {
                            icon.dim.th = icon.img.height;
                        }
                    }
                }
            }
        }

        // style.label = (unsupported; may be possible but not with API)

        styleNodes = getElementsByTagName(thisNode, 'LineStyle');
        if (!!styleNodes && styleNodes.length > 0) {
            style.line.color = nodeValue(getElementsByTagName(styleNodes[0], 'color')[0], style.line.color);
            style.line.colorMode = nodeValue(getElementsByTagName(styleNodes[0], 'colorMode')[0], style.line.colorMode);
            style.line.width = nodeValue(getElementsByTagName(styleNodes[0], 'width')[0], style.line.width);
            // style.line.outerColor      = (unsupported; not supported in API)
            // style.line.outerWidth      = (unsupported; not supported in API)
            // style.line.physicalWidth   = (unsupported; unneccesary in Google Maps)
            // style.line.labelVisibility = (unsupported; possible to implement)
        }

        styleNodes = getElementsByTagName(thisNode, 'PolyStyle');
        if (!!styleNodes && styleNodes.length > 0) {
            style.poly.color = nodeValue(getElementsByTagName(styleNodes[0], 'color')[0], style.poly.color);
            style.poly.colorMode = nodeValue(getElementsByTagName(styleNodes[0], 'colorMode')[0], style.poly.colorMode);
            style.poly.outline = getBooleanValue(getElementsByTagName(styleNodes[0], 'outline')[0], style.poly.outline);
            style.poly.fill = getBooleanValue(getElementsByTagName(styleNodes[0], 'fill')[0], style.poly.fill);
        }
        return style;
    }

    // from http://stackoverflow.com/questions/122102/what-is-the-most-efficient-way-to-clone-a-javascript-object
    // http://keithdevens.com/weblog/archive/2007/Jun/07/javascript.clone
    private clone(obj) {
        if (obj == null || typeof (obj) != 'object') {
            return obj;
        }
        if (obj.cloneNode) {
            return obj.cloneNode(true);
        }
        const temp = new obj.constructor();
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                temp[key] = this.clone(obj[key]);
            }
        }
        return temp;
    }
    private processStyleMap(thisNode, baseUrl, styleID, baseDir) {
        const pairs = getElementsByTagName(thisNode, 'Pair');
        const map = new Object();

        // add each key to the map
        for (const pr = 0; pr < pairs.length; pr++) {
            const pairKey = nodeValue(getElementsByTagName(pairs[pr], 'key')[0]);
            const pairStyle = nodeValue(getElementsByTagName(pairs[pr], 'Style')[0]);
            const pairStyleUrl = processStyleUrl(pairs[pr]);
            const pairStyleBaseUrl = pairStyleUrl[0] ? cleanURL(baseDir, pairStyleUrl[0]) : baseUrl;
            const pairStyleID = pairStyleUrl[1];

            if (!!pairStyle) {
                map[pairKey] = processStyle(pairStyle, pairStyleBaseUrl, pairStyleID);
            } else if (!!pairStyleID && !!styles[pairStyleBaseUrl][pairStyleID]) {
                map[pairKey] = clone(styles[pairStyleBaseUrl][pairStyleID]);
            }
        }
        if (!!map["normal"]) {
            styles[baseUrl][styleID] = clone(map["normal"]);
        } else {
            styles[baseUrl][styleID] = clone(defaultStyle);
        }
        if (!!map["highlight"] && !!parserOptions.processStyles) {
            processStyleID(map["highlight"]);
        }
        styles[baseUrl][styleID].map = clone(map);
    }

    private processPlacemarkCoords(node, tag) {
        const parent = getElementsByTagName(node, tag);
        const coordListA = [];
        for (let i = 0; i < parent.length; i++) {
            const coordNodes = getElementsByTagName(parent[i], 'coordinates');
            if (!coordNodes) {
                if (coordListA.length > 0) {
                    break;
                } else {
                    return [{ coordinates: [] }];
                }
            }

            for (const j = 0; j < coordNodes.length; j++) {
                const coords = nodeValue(coordNodes[j]).trim();
                coords = coords.replace(/,\s+/g, ',');
                const path = coords.split(/\s+/g);
                const pathLength = path.length;
                const coordList = [];
                for (const k = 0; k < pathLength; k++) {
                    coords = path[k].split(',');
                    if (!isNaN(coords[0]) && !isNaN(coords[1])) {
                        coordList.push({
                            lat: parseFloat(coords[1]),
                            lng: parseFloat(coords[0]),
                            alt: parseFloat(coords[2])
                        });
                    }
                }
                coordListA.push({ coordinates: coordList });
            }
        }
        return coordListA;
    }

    private render(responseXML, doc) {
        // Callback for retrieving a KML document: parse the KML and display it on the map
        if (!responseXML || responseXML === 'failed parse') {
            // Error retrieving the data
            geoXML3.log('Unable to retrieve ' + doc.url);
            if (this.parserOptions.failedParse) {
                this.parserOptions.failedParse(doc);
            }
            doc.failed = true;
            return;
        } else if (responseXML.parseError && responseXML.parseError.errorCode !== 0) {
            // IE parse error
            const err = responseXML.parseError;
            const msg = `Parse error in line ${err.line}, col ${err.linePos} (error code:${err.errorCode}) Error Reason: ${err.reason} Error Line: ${err.srcText}`;
            geoXML3.log(`Unable to retrieve ${doc.url} ${msg}`);
            if (this.parserOptions.failedParse) {
                this.parserOptions.failedParse(doc);
            }
            doc.failed = true;
            return;
        } else if (responseXML.documentElement && responseXML.documentElement.nodeName === 'parsererror') {
            // Firefox parse error
            geoXML3.log(`Unable to retrieve ${doc.url} : ${responseXML.documentElement.childNodes[0].nodeValue}`);
            if (this.parserOptions.failedParse) {
                this.parserOptions.failedParse(doc);
            }
            doc.failed = true;
            return;
        } else if (!doc) {
            throw new Error('geoXML3 internal error: render called with null document');
        } else {
            // no errors
            doc.placemarks = [];
            doc.groundoverlays = [];
            doc.ggroundoverlays = [];
            doc.networkLinks = [];
            doc.gpolygons = [];
            doc.gpolylines = [];

            // Check for dependent KML files
            const nodes = getElementsByTagName(responseXML, 'styleUrl');
            const docSet = doc.internals.docSet;

            for (let i = 0; i < nodes.length; i++) {
                const url = nodeValue(nodes[i]).split('#')[0];
                if (!url) {
                    continue;  // #id (inside doc)
                }
                const rUrl = cleanURL(doc.baseDir, url);
                if (rUrl === doc.baseUrl) {
                    continue;  // self
                }
                if (this.docsByUrl[rUrl]) {
                    continue;  // already loaded
                }

                let thisDoc;
                let j = docSet.indexOfObjWithItem('baseUrl', rUrl);
                if (j !== -1) {
                    // Already listed to be loaded, but probably in the wrong order.
                    // Load it right away to immediately resolve dependency.
                    thisDoc = docSet[j];
                    if (thisDoc.failed) {
                        continue;  // failed to load last time; don't retry it again
                    }
                }
                else {
                    // Not listed at all; add it in
                    thisDoc = new Object();
                    thisDoc.url = rUrl;  // url can't be trusted inside KMZ files, since it may .. outside of the archive
                    thisDoc.baseUrl = rUrl;
                    thisDoc.internals = doc.internals;

                    doc.internals.docSet.push(thisDoc);
                    doc.internals.remaining++;
                }

                // render dependent KML first then re-run renderer
                this.fetchDoc(rUrl, thisDoc, function (thisResXML) {
                    this.render(thisResXML, thisDoc);
                    this.render(responseXML, doc);
                });

                // to prevent cross-dependency issues, just load the one
                // file first and re-check the rest later
                return;
            }

            // Parse styles
            doc.styles = this.styles[doc.baseUrl] = this.styles[doc.baseUrl] || {};
            let styleID, styleNodes;
            nodes = getElementsByTagName(responseXML, 'Style');
            nodeCount = nodes.length;
            for (i = 0; i < nodeCount; i++) {
                thisNode = nodes[i];
                var styleID = thisNode.getAttribute('id');
                if (!!styleID) processStyle(thisNode, doc.baseUrl, styleID, doc.baseDir);
            }
            // Parse StyleMap nodes
            nodes = getElementsByTagName(responseXML, 'StyleMap');
            for (i = 0; i < nodes.length; i++) {
                thisNode = nodes[i];
                var styleID = thisNode.getAttribute('id');
                if (!!styleID) processStyleMap(thisNode, doc.baseUrl, styleID, doc.baseDir);
            }

            if (!!parserOptions.processStyles || !parserOptions.createMarker) {
                // Convert parsed styles into GMaps equivalents
                processStyles(doc);
            }

            // Parse placemarks
            if (!!doc.reload && !!doc.markers) {
                for (i = 0; i < doc.markers.length; i++) {
                    doc.markers[i].active = false;
                }
            }
            var placemark, node, coords, path, marker, poly;
            var pathLength, marker, polygonNodes, coordList;
            var placemarkNodes = getElementsByTagName(responseXML, 'Placemark');
            for (pm = 0; pm < placemarkNodes.length; pm++) {
                // Init the placemark object
                node = placemarkNodes[pm];
                var styleUrl = processStyleUrl(node);
                placemark = {
                    name: nodeValue(getElementsByTagName(node, 'name')[0]),
                    description: nodeValue(getElementsByTagName(node, 'description')[0]),
                    styleUrl: styleUrl.join('#'),
                    styleBaseUrl: styleUrl[0] ? cleanURL(doc.baseDir, styleUrl[0]) : doc.baseUrl,
                    styleID: styleUrl[1],
                    visibility: getBooleanValue(getElementsByTagName(node, 'visibility')[0], true),
                    balloonVisibility: getBooleanValue(getElementsByTagNameNS(node, gxNS, 'balloonVisibility')[0], !parserOptions.suppressInfoWindows),
                    id: node.getAttribute('id')
                };
                placemark.style = (styles[placemark.styleBaseUrl] && styles[placemark.styleBaseUrl][placemark.styleID]) || clone(defaultStyle);
                // inline style overrides shared style
                var inlineStyles = getElementsByTagName(node, 'Style');
                if (inlineStyles && (inlineStyles.length > 0)) {
                    var style = processStyle(node, '{inline}', '{inline}');
                    processStyleID(style);
                    if (style) placemark.style = style;
                }

                if (/^https?:\/\//.test(placemark.description)) {
                    placemark.description = ['<a href="', placemark.description, '">', placemark.description, '</a>'].join('');
                }

                // record list of variables for substitution
                placemark.vars = {
                    display: {
                        name: 'Name',
                        description: 'Description',
                        address: 'Street Address',
                        id: 'ID',
                        Snippet: 'Snippet',
                        geDirections: 'Directions'
                    },
                    val: {
                        name: placemark.name || '',
                        description: placemark.description || '',
                        address: nodeValue(getElementsByTagName(node, 'address')[0], ''),
                        id: node.getAttribute('id') || '',
                        Snippet: nodeValue(getElementsByTagName(node, 'Snippet')[0], '')
                    },
                    directions: [
                        'f=d',
                        'source=GeoXML3'
                    ]
                };

                // add extended data to variables
                var extDataNodes = getElementsByTagName(node, 'ExtendedData');
                if (!!extDataNodes && extDataNodes.length > 0) {
                    var dataNodes = getElementsByTagName(extDataNodes[0], 'Data');
                    for (var d = 0; d < dataNodes.length; d++) {
                        var dn = dataNodes[d];
                        var name = dn.getAttribute('name');
                        if (!name) continue;
                        var dName = nodeValue(getElementsByTagName(dn, 'displayName')[0], name);
                        var val = nodeValue(getElementsByTagName(dn, 'value')[0]);

                        placemark.vars.val[name] = val;
                        placemark.vars.display[name] = dName;
                    }
                }

                // process MultiGeometry
                var GeometryNodes = getElementsByTagName(node, 'coordinates');
                var Geometry = null;
                if (!!GeometryNodes && (GeometryNodes.length > 0)) {
                    for (var gn = 0; gn < GeometryNodes.length; gn++) {
                        if (GeometryNodes[gn].parentNode &&
                            GeometryNodes[gn].parentNode.nodeName) {
                            var GeometryPN = GeometryNodes[gn].parentNode;
                            Geometry = GeometryPN.nodeName;

                            // Extract the coordinates
                            // What sort of placemark?
                            switch (Geometry) {
                                case "Point":
                                    placemark.Point = processPlacemarkCoords(node, "Point")[0];
                                    placemark.latlng = new google.maps.LatLng(placemark.Point.coordinates[0].lat, placemark.Point.coordinates[0].lng);
                                    pathLength = 1;
                                    break;
                                case "LinearRing":
                                    // Polygon/line
                                    polygonNodes = getElementsByTagName(node, 'Polygon');
                                    // Polygon
                                    if (!placemark.Polygon)
                                        placemark.Polygon = [{
                                            outerBoundaryIs: { coordinates: [] },
                                            innerBoundaryIs: [{ coordinates: [] }]
                                        }];
                                    for (var pg = 0; pg < polygonNodes.length; pg++) {
                                        placemark.Polygon[pg] = {
                                            outerBoundaryIs: { coordinates: [] },
                                            innerBoundaryIs: [{ coordinates: [] }]
                                        }
                                        placemark.Polygon[pg].outerBoundaryIs = processPlacemarkCoords(polygonNodes[pg], "outerBoundaryIs");
                                        placemark.Polygon[pg].innerBoundaryIs = processPlacemarkCoords(polygonNodes[pg], "innerBoundaryIs");
                                    }
                                    coordList = placemark.Polygon[0].outerBoundaryIs;
                                    break;

                                case "LineString":
                                    pathLength = 0;
                                    placemark.LineString = processPlacemarkCoords(node, "LineString");
                                    break;

                                default:
                                    break;
                            }
                        }
                    }
                }

                // parse MultiTrack/Track
                var TrackNodes = getElementsByTagNameNS(node, gxNS, "Track");
                var coordListA = [];
                if (TrackNodes.length > 0) {
                    for (var i = 0; i < TrackNodes.length; i++) {
                        var coordNodes = getElementsByTagNameNS(TrackNodes[i], gxNS, "coord");
                        var coordList = [];
                        for (var j = 0; j < coordNodes.length; j++) {
                            var coords = geoXML3.nodeValue(coordNodes[j]).trim();
                            coords = coords.split(/\s+/g);
                            if (!isNaN(coords[0]) && !isNaN(coords[1])) {
                                coordList.push({
                                    lat: parseFloat(coords[1]),
                                    lng: parseFloat(coords[0]),
                                    alt: parseFloat(coords[2])
                                });
                            }
                        }
                        coordListA.push({ coordinates: coordList });
                    }
                    placemark.Track = coordListA;
                }

                // call the custom placemark parse function if it is defined
                if (!!parserOptions.pmParseFn) parserOptions.pmParseFn(node, placemark);
                doc.placemarks.push(placemark);

                // single marker
                if (placemark.Point) {
                    if (!!google.maps) {
                        doc.bounds = doc.bounds || new google.maps.LatLngBounds();
                        doc.bounds.extend(placemark.latlng);
                    }

                    // Potential user-defined marker handler
                    var pointCreateFunc = parserOptions.createMarker || createMarker;
                    var found = false;
                    if (!parserOptions.createMarker) {
                        // Check to see if this marker was created on a previous load of this document
                        if (!!doc) {
                            doc.markers = doc.markers || [];
                            if (doc.reload) {
                                for (var j = 0; j < doc.markers.length; j++) {
                                    if ((doc.markers[j].id == placemark.id) ||
                                        // if no id, check position
                                        (!doc.markers[j].id &&
                                            (doc.markers[j].getPosition().equals(placemark.latlng)))) {
                                        found = doc.markers[j].active = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (!found) {
                        // Call the marker creator
                        var marker = pointCreateFunc(placemark, doc);
                        if (marker) {
                            marker.active = placemark.visibility;
                            marker.id = placemark.id;
                        }
                    }
                }
                // polygon/line
                var poly, line;
                if (!!doc) {
                    if (placemark.Polygon) doc.gpolygons = doc.gpolygons || [];
                    if (placemark.LineString) doc.gpolylines = doc.gpolylines || [];
                    if (placemark.Track) doc.gpolylines = doc.gpolylines || [];
                }

                var polyCreateFunc = parserOptions.createPolygon || createPolygon;
                var lineCreateFunc = parserOptions.createLineString || createPolyline;
                if (placemark.Polygon) {
                    poly = polyCreateFunc(placemark, doc);
                    if (poly) poly.active = placemark.visibility;
                }
                if (placemark.LineString) {
                    line = lineCreateFunc(placemark, doc);
                    if (line) line.active = placemark.visibility;
                }
                if (placemark.Track) { // gx:Track polyline
                    line = lineCreateFunc(placemark, doc);
                    if (line) line.active = placemark.visibility;
                }
                if (!!google.maps) {
                    doc.bounds = doc.bounds || new google.maps.LatLngBounds();
                    if (poly) doc.bounds.union(poly.bounds);
                    if (line) doc.bounds.union(line.bounds);
                }

            } // placemark loop

            if (!!doc.reload && !!doc.markers) {
                for (i = doc.markers.length - 1; i >= 0; i--) {
                    if (!doc.markers[i].active) {
                        if (!!doc.markers[i].infoWindow) {
                            doc.markers[i].infoWindow.close();
                        }
                        doc.markers[i].setMap(null);
                        doc.markers.splice(i, 1);
                    }
                }
            }

            var overlayCreateFunc = parserOptions.createOverlay || createOverlay;
            // Parse ground overlays
            if (!!doc.reload && !!doc.groundoverlays) {
                for (i = 0; i < doc.groundoverlays.length; i++) {
                    doc.groundoverlays[i].active = false;
                }
            }

            if (!!doc) {
                doc.groundoverlays = doc.groundoverlays || [];
            }
            // doc.groundoverlays =[];
            var groundOverlay, color, transparency, overlay;
            var groundNodes = getElementsByTagName(responseXML, 'GroundOverlay');
            for (i = 0; i < groundNodes.length; i++) {
                node = groundNodes[i];

                // Detect images buried in KMZ files (and use a base64 encoded URL)
                var gnUrl = cleanURL(doc.baseDir, nodeValue(getElementsByTagName(node, 'href')[0]));
                if (kmzMetaData[gnUrl]) gnUrl = kmzMetaData[gnUrl].dataUrl;

                // Init the ground overlay object
                groundOverlay = {
                    name: nodeValue(getElementsByTagName(node, 'name')[0]),
                    description: nodeValue(getElementsByTagName(node, 'description')[0]),
                    icon: { href: gnUrl },
                    latLonBox: {
                        north: parseFloat(nodeValue(getElementsByTagName(node, 'north')[0])),
                        east: parseFloat(nodeValue(getElementsByTagName(node, 'east')[0])),
                        south: parseFloat(nodeValue(getElementsByTagName(node, 'south')[0])),
                        west: parseFloat(nodeValue(getElementsByTagName(node, 'west')[0]))
                    },
                    rotation: -1 * parseFloat(nodeValue(getElementsByTagName(node, 'rotation')[0]))
                };
                if (!!google.maps) {
                    doc.bounds = doc.bounds || new google.maps.LatLngBounds();
                    doc.bounds.union(new google.maps.LatLngBounds(
                        new google.maps.LatLng(groundOverlay.latLonBox.south, groundOverlay.latLonBox.west),
                        new google.maps.LatLng(groundOverlay.latLonBox.north, groundOverlay.latLonBox.east)
                    ));
                }

                // Opacity is encoded in the color node
                var colorNode = getElementsByTagName(node, 'color');
                if (colorNode && colorNode.length > 0) {
                    groundOverlay.opacity = geoXML3.getOpacity(nodeValue(colorNode[0]));
                } else {
                    groundOverlay.opacity = 1.0;  // KML default
                }

                doc.groundoverlays.push(groundOverlay);
                // Check to see if this overlay was created on a previous load of this document
                var found = false;
                if (!!doc) {
                    doc.groundoverlays = doc.groundoverlays || [];
                    if (doc.reload) {
                        overlayBounds = new google.maps.LatLngBounds(
                            new google.maps.LatLng(groundOverlay.latLonBox.south, groundOverlay.latLonBox.west),
                            new google.maps.LatLng(groundOverlay.latLonBox.north, groundOverlay.latLonBox.east)
                        );
                        var overlays = doc.groundoverlays;
                        for (i = overlays.length; i--;) {
                            if ((overlays[i].bounds().equals(overlayBounds)) &&
                                (overlays.url_ === groundOverlay.icon.href)) {
                                found = overlays[i].active = true;
                                break;
                            }
                        }
                    }

                    if (!found) {
                        overlay = overlayCreateFunc(groundOverlay, doc);
                        overlay.active = true;
                    }
                }
                if (!!doc.reload && !!doc.groundoverlays && !!doc.groundoverlays.length) {
                    var overlays = doc.groundoverlays;
                    for (i = overlays.length; i--;) {
                        if (!overlays[i].active) {
                            overlays[i].remove();
                            overlays.splice(i, 1);
                        }
                    }
                    doc.groundoverlays = overlays;
                }
            }

            // Parse network links
            var networkLink;
            var docPath = document.location.pathname.split('/');
            docPath = docPath.splice(0, docPath.length - 1).join('/');
            var linkNodes = getElementsByTagName(responseXML, 'NetworkLink');
            for (i = 0; i < linkNodes.length; i++) {
                node = linkNodes[i];

                // Init the network link object
                networkLink = {
                    name: nodeValue(getElementsByTagName(node, 'name')[0]),
                    link: {
                        href: nodeValue(getElementsByTagName(node, 'href')[0]),
                        refreshMode: nodeValue(getElementsByTagName(node, 'refreshMode')[0])
                    }
                };

                // Establish the specific refresh mode
                if (!networkLink.link.refreshMode) {
                    networkLink.link.refreshMode = 'onChange';
                }
                if (networkLink.link.refreshMode === 'onInterval') {
                    networkLink.link.refreshInterval = parseFloat(nodeValue(getElementsByTagName(node, 'refreshInterval')[0]));
                    if (isNaN(networkLink.link.refreshInterval)) {
                        networkLink.link.refreshInterval = 0;
                    }
                } else if (networkLink.link.refreshMode === 'onChange') {
                    networkLink.link.viewRefreshMode = nodeValue(getElementsByTagName(node, 'viewRefreshMode')[0]);
                    if (!networkLink.link.viewRefreshMode) {
                        networkLink.link.viewRefreshMode = 'never';
                    }
                    if (networkLink.link.viewRefreshMode === 'onStop') {
                        networkLink.link.viewRefreshTime = nodeValue(getElementsByTagName(node, 'refreshMode')[0]);
                        networkLink.link.viewFormat = nodeValue(getElementsByTagName(node, 'refreshMode')[0]);
                        if (!networkLink.link.viewFormat) {
                            networkLink.link.viewFormat = 'BBOX=[bboxWest],[bboxSouth],[bboxEast],[bboxNorth]';
                        }
                    }
                }

                if (!/^[\/|http]/.test(networkLink.link.href)) {
                    // Fully-qualify the HREF
                    networkLink.link.href = docPath + '/' + networkLink.link.href;
                }

                // Apply the link
                if ((networkLink.link.refreshMode === 'onInterval') &&
                    (networkLink.link.refreshInterval > 0)) {
                    // Reload at regular intervals
                    setInterval(parserName + '.parse("' + networkLink.link.href + '")',
                        1000 * networkLink.link.refreshInterval);
                } else if (networkLink.link.refreshMode === 'onChange') {
                    if (networkLink.link.viewRefreshMode === 'never') {
                        // Load the link just once
                        doc.internals.parser.parse(networkLink.link.href, doc.internals.docSet);
                    } else if (networkLink.link.viewRefreshMode === 'onStop') {
                        // Reload when the map view changes

                    }
                }
            }
        }

        if (!!doc.bounds) {
            doc.internals.bounds = doc.internals.bounds || new google.maps.LatLngBounds();
            doc.internals.bounds.union(doc.bounds);
        }
        if (!!doc.markers || !!doc.groundoverlays || !!doc.gpolylines || !!doc.gpolygons) {
            doc.internals.parseOnly = false;
        }

        if (!doc.internals.parseOnly) {
            // geoXML3 is not being used only as a real-time parser, so keep the processed documents around
            if (doc.baseUrl) { // handle case from parseKmlString (no doc.baseUrl)
                if (!docsByUrl[doc.baseUrl]) {
                    docs.push(doc);
                    docsByUrl[doc.baseUrl] = doc;
                } else {
                    // internal replacement, which keeps the same memory ref loc in docs and docsByUrl
                    for (var i in docsByUrl[doc.baseUrl]) {
                        docsByUrl[doc.baseUrl][i] = doc[i];
                    }
                }
            }
        }

        doc.internals.remaining--;
        if (doc.internals.remaining === 0) {
            // We're done processing this set of KML documents
            // Options that get invoked after parsing completes
            if (parserOptions.zoom && !!doc.internals.bounds &&
                !doc.internals.bounds.isEmpty() && !!parserOptions.map) {
                parserOptions.map.fitBounds(doc.internals.bounds);
            }
            if (parserOptions.afterParse) {
                parserOptions.afterParse(doc.internals.docSet);
            }
            google.maps.event.trigger(doc.internals.parser, 'parsed');
        }
    }

    public parser(options) {
        var kmlColor = function (kmlIn, colorMode) {
            var kmlColor = {};
            kmlIn = kmlIn || 'ffffffff';  // white (KML 2.2 default)

            var aa = kmlIn.substr(0, 2);
            var bb = kmlIn.substr(2, 2);
            var gg = kmlIn.substr(4, 2);
            var rr = kmlIn.substr(6, 2);

            kmlColor.opacity = parseInt(aa, 16) / 256;
            kmlColor.color = (colorMode === 'random') ? randomColor(rr, gg, bb) : '#' + rr + gg + bb;
            return kmlColor;
        };

        // Implemented per KML 2.2 <ColorStyle> specs
        var randomColor = function (rr, gg, bb) {
            var col = { rr: rr, gg: gg, bb: bb };
            for (var k in col) {
                var v = col[k];
                if (v == null) v = 'ff';

                // RGB values are limiters for random numbers (ie: 7f would be a random value between 0 and 7f)
                v = Math.round(Math.random() * parseInt(rr, 16)).toString(16);
                if (v.length === 1) v = '0' + v;
                col[k] = v;
            }

            return '#' + col.rr + col.gg + col.bb;
        };

        var processStyleID = function (style) {
            var icon = style.icon;
            if (!icon || !icon.href) return;

            if (icon.img && !icon.img.complete && (icon.dim.w < 0) && (icon.dim.h < 0)) {
                // we're still waiting on the image loading (probably because we've been blocking since the declaration)
                // so, let's queue this function on the onload stack
                icon.markerBacklog = [];
                icon.img.onload = function () {
                    if (icon.dim.w < 0 || icon.dim.h < 0) {
                        icon.dim.w = this.width;
                        icon.dim.h = this.height;
                    } else {
                        icon.dim.th = this.height;
                    }
                    processStyleID(style);

                    // we will undoubtedly get some createMarker queuing, so set this up in advance
                    for (var i = 0; i < icon.markerBacklog.length; i++) {
                        var p = icon.markerBacklog[i][0];
                        var d = icon.markerBacklog[i][1];
                        createMarker(p, d);
                        if (p.marker) p.marker.active = true;
                    }
                    delete icon.markerBacklog;
                };
                return;
            }
            else { //if (icon.dim.w < 0 || icon.dim.h < 0) {
                if (icon.img && icon.img.complete) {
                    // sometimes the file is already cached and it never calls onLoad
                    if (icon.dim.w < 0 || icon.dim.h < 0) {
                        icon.dim.w = icon.img.width;
                        icon.dim.h = icon.img.height;
                    } else {
                        icon.dim.th = icon.img.height;
                    }
                }
                else {
                    // settle for a default of 32x32
                    icon.dim.whGuess = true;
                    icon.dim.w = 32;
                    icon.dim.h = 32;
                    icon.dim.th = 32;
                }
            }

            // pre-scaled variables
            var rnd = Math.round;
            var y = icon.dim.y;
            if (typeof icon.dim.th !== 'undefined' && icon.dim.th != icon.dim.h) { // palette - reverse kml y for maps
                y = Math.abs(y - (icon.dim.th - icon.dim.h));
            }

            var scaled = {
                x: icon.dim.x * icon.scale,
                y: y * icon.scale,
                w: icon.dim.w * icon.scale,
                h: icon.dim.h * icon.scale,
                aX: icon.hotSpot.x * icon.scale,
                aY: icon.hotSpot.y * icon.scale,
                iW: (icon.img ? icon.img.width : icon.dim.w) * icon.scale,
                iH: (icon.img ? icon.img.height : icon.dim.h) * icon.scale
            };

            // Figure out the anchor spot
            // Origins, anchor positions and coordinates of the marker increase in the X direction to the right and in
            // the Y direction down.
            var aX, aY;
            switch (icon.hotSpot.xunits) {
                case 'fraction': aX = rnd(scaled.aX * icon.dim.w); break;
                case 'insetPixels': aX = rnd(icon.dim.w * icon.scale - scaled.aX); break;
                default: aX = rnd(scaled.aX); break; // already pixels
            }
            switch (icon.hotSpot.yunits) {
                case 'fraction': aY = scaled.h - rnd(icon.dim.h * scaled.aY); break;
                case 'insetPixels': aY = rnd(scaled.aY); break;
                default: aY = rnd(icon.dim.h * icon.scale - scaled.aY); break;
            }
            var iconAnchor = new google.maps.Point(aX, aY);

            // Sizes
            // (NOTE: Scale is applied to entire image, not just the section of the icon palette.)
            var iconSize = icon.dim.whGuess ? null : new google.maps.Size(rnd(scaled.w), rnd(scaled.h));
            var iconScale = icon.scale == 1.0 ? null :
                icon.dim.whGuess ? new google.maps.Size(rnd(scaled.w), rnd(scaled.h))
                    : new google.maps.Size(rnd(scaled.iW), rnd(scaled.iH));
            var iconOrigin = new google.maps.Point(rnd(scaled.x), rnd(scaled.y));

            // Detect images buried in KMZ files (and use a base64 encoded URL)
            if (kmzMetaData[icon.url]) icon.url = kmzMetaData[icon.url].dataUrl;

            // Init the style object with the KML icon
            icon.marker = {
                url: icon.url,        // url
                size: iconSize,       // size
                origin: iconOrigin,   // origin
                anchor: iconAnchor,   // anchor
                scaledSize: iconScale // scaledSize
            };

            // Look for a predictable shadow
            var stdRegEx = /\/(red|blue|green|yellow|lightblue|purple|pink|orange)(-dot)?\.png/;
            var shadowSize = new google.maps.Size(59, 32);
            var shadowPoint = new google.maps.Point(16, 32);
            if (stdRegEx.test(icon.href)) {
                // A standard GMap-style marker icon
                icon.shadow = {
                    url: 'http://maps.google.com/mapfiles/ms/micons/msmarker.shadow.png', // url
                    size: shadowSize,    // size
                    origin: null,        // origin
                    anchor: shadowPoint, // anchor
                    scaledSize: shadowSize // scaledSize
                };
            } else if (icon.href.indexOf('-pushpin.png') > -1) {
                // Pushpin marker icon
                icon.shadow = {
                    url: 'http://maps.google.com/mapfiles/ms/micons/pushpin_shadow.png',  // url
                    size: shadowSize,    // size
                    origin: null,        // origin
                    anchor: shadowPoint, // anchor
                    scaledSize: shadowSize // scaledSize
                };
            } /* else {
            // Other MyMaps KML standard icon
            icon.shadow = new google.maps.MarkerImage(
              icon.href.replace('.png', '.shadow.png'),                        // url
              shadowSize,                                                      // size
              null,                                                            // origin
              anchorPoint,                                                     // anchor
              shadowSize                                                       // scaledSize
            );
          } */
        }

        var processStyles = function (doc) {
            for (var styleID in doc.styles) {
                processStyleID(doc.styles[styleID]);
            }
        };

        var createMarker = function (placemark, doc) {
            // create a Marker to the map from a placemark KML object
            var icon = placemark.style.icon;

            if (!icon.marker && icon.img) {
                // yay, single point of failure is holding up multiple markers...
                icon.markerBacklog = icon.markerBacklog || [];
                icon.markerBacklog.push([placemark, doc]);
                return;
            }

            // Load basic marker properties
            var markerOptions = geoXML3.combineOptions(parserOptions.markerOptions, {
                map: parserOptions.map,
                position: new google.maps.LatLng(placemark.Point.coordinates[0].lat, placemark.Point.coordinates[0].lng),
                title: placemark.name,
                zIndex: Math.round(placemark.Point.coordinates[0].lat * -100000) << 5,
                icon: icon.marker,
                shadow: icon.shadow,
                flat: !icon.shadow,
                visible: placemark.visibility
            });

            // Create the marker on the map
            var marker = new google.maps.Marker(markerOptions);
            if (!!doc) doc.markers.push(marker);

            // Set up and create the infowindow if it is not suppressed
            createInfoWindow(placemark, doc, marker);
            placemark.marker = marker;
            return marker;
        };

        var createOverlay = function (groundOverlay, doc) {
            // Add a ProjectedOverlay to the map from a groundOverlay KML object

            if (!window.ProjectedOverlay) {
                throw 'geoXML3 error: ProjectedOverlay not found while rendering GroundOverlay from KML';
            }

            var bounds = new google.maps.LatLngBounds(
                new google.maps.LatLng(groundOverlay.latLonBox.south, groundOverlay.latLonBox.west),
                new google.maps.LatLng(groundOverlay.latLonBox.north, groundOverlay.latLonBox.east)
            );
            var overlayOptions = geoXML3.combineOptions(parserOptions.overlayOptions, {
                percentOpacity: groundOverlay.opacity * 100,
                rotation: groundOverlay.rotation
            });
            var overlay = new ProjectedOverlay(parserOptions.map, groundOverlay.icon.href, bounds, overlayOptions);

            if (!!doc) {
                doc.ggroundoverlays = doc.ggroundoverlays || [];
                doc.ggroundoverlays.push(overlay);
            }

            return overlay;
        };

        // Create Polyline
        var createPolyline = function (placemark, doc) {
            var paths = [];
            var bounds = new google.maps.LatLngBounds();
            if (placemark.LineString) {
                for (var j = 0; j < placemark.LineString.length; j++) {
                    var path = [];
                    var coords = placemark.LineString[j].coordinates;
                    for (var i = 0; i < coords.length; i++) {
                        var pt = new google.maps.LatLng(coords[i].lat, coords[i].lng);
                        path.push(pt);
                        bounds.extend(pt);
                    }
                    paths.push(path);
                }
            } else if (placemark.Track) {
                for (var j = 0; j < placemark.Track.length; j++) {
                    var path = [];
                    var coords = placemark.Track[j].coordinates;
                    for (var i = 0; i < coords.length; i++) {
                        var pt = new google.maps.LatLng(coords[i].lat, coords[i].lng);
                        path.push(pt);
                        bounds.extend(pt);
                    }
                    paths.push(path);
                }
            }
            // point to open the infowindow if triggered
            var point = paths[0][Math.floor(path.length / 2)];
            // Load basic polyline properties
            var kmlStrokeColor = kmlColor(placemark.style.line.color, placemark.style.line.colorMode);
            var polyOptions = geoXML3.combineOptions(parserOptions.polylineOptions, {
                map: parserOptions.map,
                path: path,
                strokeColor: kmlStrokeColor.color,
                strokeWeight: placemark.style.line.width,
                strokeOpacity: kmlStrokeColor.opacity,
                title: placemark.name,
                visible: placemark.visibility
            });
            if (paths.length > 1) {
                polyOptions.paths = paths;
                var p = new MultiGeometry(polyOptions);
            } else {
                polyOptions.path = paths[0];
                var p = new google.maps.Polyline(polyOptions);
            }
            p.bounds = bounds;

            // setup and create the infoWindow if it is not suppressed
            createInfoWindow(placemark, doc, p);
            if (!!doc) doc.gpolylines.push(p);
            placemark.polyline = p;
            return p;
        }

        // Create Polygon
        var createPolygon = function (placemark, doc) {
            var bounds = new google.maps.LatLngBounds();
            var pathsLength = 0;
            var paths = [];
            for (var polygonPart = 0; polygonPart < placemark.Polygon.length; polygonPart++) {
                for (var j = 0; j < placemark.Polygon[polygonPart].outerBoundaryIs.length; j++) {
                    var coords = placemark.Polygon[polygonPart].outerBoundaryIs[j].coordinates;
                    var path = [];
                    for (var i = 0; i < coords.length; i++) {
                        var pt = new google.maps.LatLng(coords[i].lat, coords[i].lng);
                        path.push(pt);
                        bounds.extend(pt);
                    }
                    paths.push(path);
                    pathsLength += path.length;
                }
                for (var j = 0; j < placemark.Polygon[polygonPart].innerBoundaryIs.length; j++) {
                    var coords = placemark.Polygon[polygonPart].innerBoundaryIs[j].coordinates;
                    var path = [];
                    for (var i = 0; i < coords.length; i++) {
                        var pt = new google.maps.LatLng(coords[i].lat, coords[i].lng);
                        path.push(pt);
                        bounds.extend(pt);
                    }
                    paths.push(path);
                    pathsLength += path.length;
                }
            }

            // Load basic polygon properties
            var kmlStrokeColor = kmlColor(placemark.style.line.color, placemark.style.line.colorMode);
            var kmlFillColor = kmlColor(placemark.style.poly.color, placemark.style.poly.colorMode);
            if (!placemark.style.poly.fill) kmlFillColor.opacity = 0.0;
            var strokeWeight = placemark.style.line.width;
            if (!placemark.style.poly.outline) {
                strokeWeight = 0;
                kmlStrokeColor.opacity = 0.0;
            }
            var polyOptions = geoXML3.combineOptions(parserOptions.polygonOptions, {
                map: parserOptions.map,
                paths: paths,
                title: placemark.name,
                strokeColor: kmlStrokeColor.color,
                strokeWeight: strokeWeight,
                strokeOpacity: kmlStrokeColor.opacity,
                fillColor: kmlFillColor.color,
                fillOpacity: kmlFillColor.opacity,
                visible: placemark.visibility
            });
            var p = new google.maps.Polygon(polyOptions);
            p.bounds = bounds;

            createInfoWindow(placemark, doc, p);
            if (!!doc) doc.gpolygons.push(p);
            placemark.polygon = p;
            return p;
        }

        var createInfoWindow = function (placemark, doc, gObj) {
            var bStyle = placemark.style.balloon;
            var vars = placemark.vars;

            if (!placemark.balloonVisibility || bStyle.displayMode === 'hide') return;

            // define geDirections 
            if (placemark.latlng &&
                (!parserOptions.suppressDirections || !parserOptions.suppressDirections)) {
                vars.directions.push('sll=' + placemark.latlng.toUrlValue());

                var url = 'http://maps.google.com/maps?' + vars.directions.join('&');
                var address = encodeURIComponent(vars.val.address || placemark.latlng.toUrlValue()).replace(/\%20/g, '+');

                vars.val.geDirections = '<a href="' + url + '&daddr=' + address + '" target=_blank>To Here</a> - <a href="' + url + '&saddr=' + address + '" target=_blank>From Here</a>';
            }
            else vars.val.geDirections = '';

            // add in the variables
            var iwText = bStyle.text.replace(/\$\[(\w+(\/displayName)?)\]/g, function (txt, n, dn) { return dn ? vars.display[n] : vars.val[n]; });
            var classTxt = 'geoxml3_infowindow geoxml3_style_' + placemark.styleID;

            // color styles
            var styleArr = [];
            if (bStyle.bgColor != 'ffffffff') styleArr.push('background: ' + kmlColor(bStyle.bgColor).color + ';');
            if (bStyle.textColor != 'ff000000') styleArr.push('color: ' + kmlColor(bStyle.textColor).color + ';');
            var styleProp = styleArr.length ? ' style="' + styleArr.join(' ') + '"' : '';

            var infoWindowOptions = geoXML3.combineOptions(parserOptions.infoWindowOptions, {
                content: '<div class="' + classTxt + '"' + styleProp + '>' + iwText + '</div>',
                pixelOffset: new google.maps.Size(0, 2)
            });

            gObj.infoWindow = parserOptions.infoWindow || new google.maps.InfoWindow(infoWindowOptions);
            gObj.infoWindowOptions = infoWindowOptions;

            // Info Window-opening event handler
            google.maps.event.addListener(gObj, 'click', function (e) {
                var iW = this.infoWindow;
                iW.close();
                iW.setOptions(this.infoWindowOptions);

                if (e && e.latLng) iW.setPosition(e.latLng);
                else if (this.bounds) iW.setPosition(this.bounds.getCenter());

                iW.setContent("<div id='geoxml3_infowindow'>" + iW.getContent() + "</div>");
                google.maps.event.addListenerOnce(iW, "domready", function () {
                    var node = document.getElementById('geoxml3_infowindow');
                    var imgArray = node.getElementsByTagName('img');
                    for (var i = 0; i < imgArray.length; i++) {
                        var imgUrlIE = imgArray[i].getAttribute("src");
                        var imgUrl = cleanURL(doc.baseDir, imgUrlIE);

                        if (kmzMetaData[imgUrl]) {
                            imgArray[i].src = kmzMetaData[imgUrl].dataUrl;
                        } else if (kmzMetaData[imgUrlIE]) {
                            imgArray[i].src = kmzMetaData[imgUrlIE].dataUrl;
                        }
                    }
                });
                iW.open(this.map, this.bounds ? null : this);
            });

        }

        return {
            // Expose some properties and methods

            options: parserOptions,
            docs: docs,
            docsByUrl: docsByUrl,
            kmzMetaData: kmzMetaData,

            parse: parse,
            render: render,
            parseKmlString: parseKmlString,
            hideDocument: hideDocument,
            showDocument: showDocument,
            processStyles: processStyles,
            createMarker: createMarker,
            createOverlay: createOverlay,
            createPolyline: createPolyline,
            createPolygon: createPolygon
        };
    }
}