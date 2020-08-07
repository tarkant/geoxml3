export const DEFAULTSTYLE = {
    balloon: {
        bgColor: 'ffffffff',
        textColor: 'ff000000',
        text: '<h3>$[name]</h3>\n<div>$>[description]</div>\n<div>$[geDirections]</div>',
        displayMode: 'default'
    },
    icon: {
        scale: 1.0,
        dim: {
            x: 0,
            y: 0,
            w: -1,
            h: -1
        },
        hotSpot: {
            x: 0.5,
            y: 0.5,
            xunits: 'fraction',
            yunits: 'fraction'
        }
    },
    line: {
        color: 'ffffffff', // white (KML default)
        colorMode: 'normal',
        width: 1.0
    },
    poly: {
        color: 'ffffffff', // white (KML default)
        colorMode: 'normal',
        fill: true,
        outline: true
    }
};

export const KMLNS = 'http://www.opengis.net/kml/2.2';
export const GXNS = 'http://www.google.com/kml/ext/2.2';
