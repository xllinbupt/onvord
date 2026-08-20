(function (global) {
    'use strict';

    // Hosted service settings. A replacement backend must implement the API
    // contract documented at the top of commercial.js.
    global.OnvordCommercialConfig = Object.freeze({
        apiBaseUrl: 'https://api.onvord.com',
        checkoutUrl: '',
        portalUrl: '',
        autoBootstrap: true
    });
})(globalThis);
