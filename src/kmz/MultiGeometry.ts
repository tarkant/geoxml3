/**
 * A MultiGeometry object that will allow multiple polylines in a MultiGeometry
 * containing LineStrings to be treated as a single object
 *
 * @param {MutiGeometryOptions} anonymous object.  Available properties:
 * map: The map on which to attach the MultiGeometry
 * paths: the individual polylines
 * polylineOptions: options to use when constructing all the polylines
 *
 * @constructor
 */

export class MultiGeometry extends google.maps.MVCObject {

    private polylines;
    private paths: Array<any>;

    constructor(multiGeometryOptions: {
        map: google.maps.Map;
        paths: Array<any>;
        polylineOptions: any;
        path: any;
    }) {
        super();
        if (!!window.google && !!google.maps) {
            this.setValues(multiGeometryOptions);
            this.polylines = [];

            for (let i = 0; i < this.paths.length; i++) {
                const polylineOptions = multiGeometryOptions;
                polylineOptions.path = this.paths[i];
                const polyline = this.createPolyline(polylineOptions);
                // Bind the polyline properties to the MultiGeometry properties
                this.polylines.push(polyline);
            }
        } else {
            console.error('[Err. GeoXML3] Couldn\'t find window.google && google.map instances. Did you load google maps?');
        }
    }

    public setMap(map: string): void {
        this.set('map', map);
    }

    public getMap() {
        return this.get('map');
    }

    public changed(key) {
        if (this.polylines) {
            for (let i = 0; i < this.polylines.length; i++) {
                this.polylines[i].set(key, this.get(key));
            }
        }
    }

    private createPolyline(polylineOptions) {
        const polyline = new google.maps.Polyline(polylineOptions);
        google.maps.event.addListener(polyline, 'click', function (evt) { google.maps.event.trigger(this, 'click', evt); });
        google.maps.event.addListener(polyline, 'dblclick', function (evt) { google.maps.event.trigger(this, 'dblclick', evt); });
        google.maps.event.addListener(polyline, 'mousedown', function (evt) { google.maps.event.trigger(this, 'mousedown', evt); });
        google.maps.event.addListener(polyline, 'mousemove', function (evt) { google.maps.event.trigger(this, 'mousemove', evt); });
        google.maps.event.addListener(polyline, 'mouseout', function (evt) { google.maps.event.trigger(this, 'mouseout', evt); });
        google.maps.event.addListener(polyline, 'mouseover', function (evt) { google.maps.event.trigger(this, 'mouseover', evt); });
        google.maps.event.addListener(polyline, 'mouseup', function (evt) { google.maps.event.trigger(this, 'mouseup', evt); });
        google.maps.event.addListener(polyline, 'rightclick', function (evt) { google.maps.event.trigger(this, 'rightclick', evt); });
        return polyline;
    }
}
