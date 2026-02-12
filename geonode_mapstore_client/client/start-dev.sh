#!/bin/bash
export NODE_OPTIONS="--openssl-legacy-provider"
cd /opt/geonode-mapstore-client/geonode_mapstore_client/client
exec npm start
