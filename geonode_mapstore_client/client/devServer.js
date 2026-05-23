const path = require('path');
const fs = require('fs');
const envConfig = fs.existsSync(path.join(__dirname, '.env'))
    ? require('dotenv').config().parsed
    : {};

module.exports = (devServerDefault, projectConfig) => {

    const appDirectory = projectConfig.appDirectory;
    const devServerHost = envConfig.DEV_SERVER_HOSTNAME || 'localhost';
    const devServerPort = envConfig.DEV_SERVER_PORT || 8081;
    const proxyTargetHost = envConfig.DEV_TARGET_GEONODE_HOST || 'localhost:8000';
    const protocol = envConfig.DEV_SERVER_PROTOCOL || 'http';

    const proxyTargetURL = `${protocol}://${proxyTargetHost}`;

    return {
        clientLogLevel: 'debug',
        https: protocol === 'https' ? true : false,
        host: devServerHost,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        contentBase: [
            path.join(appDirectory),
            path.join(appDirectory, '..')
        ],
        before: function(app) {
            const hashRegex = /\.[a-zA-Z0-9]{1,}\.js/;
            app.use(function(req, res, next) {
                // remove hash from requests to use the local js
                const appsName = [
                    ...(projectConfig.apps || [])
                ]
                    .find(name => req.url.indexOf('/' + name) !== -1 );
                if (appsName) {
                    req.url = req.url.replace(hashRegex, '.js');
                    req.path = req.path.replace(hashRegex, '.js');
                    req.originalUrl = req.originalUrl.replace(hashRegex, '.js');
                }
                if (req.url.matches(proxyTargetURL)) {
                    req.url = req.url.replace(proxyTargetURL, '');
                    req.path = req.path.replace(proxyTargetURL, '');
                    req.originalUrl = req.originalUrl.replace(proxyTargetURL, '');
                }
                next();
            });
        },
        proxy: [
            {
                context: ['/geoserver/**'],
                target: 'http://localhost:8080',
                secure: false,
                changeOrigin: true,
                // 600 s aligns with prod nginx; was hitting http-proxy-middleware's 60 s default and 504-ing slow async callbacks (e.g. /anuga/api/.../process-result/)
                proxyTimeout: 600000
            },
            {
                context: [
                    '**',
                    '!**/geoserver/**',
                    '!**/static/mapstore/configs/**',
                    '!**/static/mapstore/dist/**',
                    '!**/static/mapstore/gn-translations/**',
                    '!**/static/mapstore/img/**',
                    '!**/static/mapstore/ms-translations/**',
                    '!**/static/mapstore/symbols/**',
                    '!**/static/mapstore/version.txt',
                    '!**/MapStore2/**',
                    '!**/node_modules/**',
                    '!**/docs/**'
                ],
                target: proxyTargetURL,
                headers: {
                    Host: proxyTargetHost,
                    Referer: `${proxyTargetURL}/`
                },
                // 600 s aligns with prod nginx; was hitting http-proxy-middleware's 60 s default and 504-ing slow async callbacks (e.g. /anuga/api/.../process-result/)
                proxyTimeout: 600000
            },
            {
                context: [
                    '/static/mapstore/ms-translations/**',
                    '/docs/**',
                    '/static/mapstore/dist/js/web-ifc/**'
                ],
                target: `${protocol}://${devServerHost}:${devServerPort}`,
                secure: false,
                changeOrigin: true,
                pathRewrite: {
                    '/static/mapstore/ms-translations': '/node_modules/mapstore/web/client/translations',
                    '/static/mapstore/dist/js/web-ifc': '/node_modules/web-ifc'
                }
            }
        ]
    };
};
