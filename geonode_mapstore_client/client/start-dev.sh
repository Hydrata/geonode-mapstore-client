#!/bin/bash
export NODE_OPTIONS="--openssl-legacy-provider"
cd /opt/geonode-mapstore-client/geonode_mapstore_client/client

# Bootstrap localConfig.json from the committed .example.json on first run.
# localConfig.json is gitignored (working copy for localhost dev); Ansible
# overwrites it on every prod deploy from the deploy-repo per-site files.
CONFIG_DIR="../static/mapstore/configs"
if [ ! -f "$CONFIG_DIR/localConfig.json" ] && [ -f "$CONFIG_DIR/localConfig.example.json" ]; then
    cp "$CONFIG_DIR/localConfig.example.json" "$CONFIG_DIR/localConfig.json"
fi

exec npm start
