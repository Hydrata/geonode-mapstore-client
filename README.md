# GeoNode MapStore Client

![Build Status](https://github.com/GeoNode/geonode-mapstore-client/actions/workflows/build.yml/badge.svg)

![Build Status](https://github.com/GeoNode/geonode-mapstore-client/actions/workflows/test.yml/badge.svg)

GeoNode MapStore Client is a frontend application that interacts with the GeoNode API V2 to allows users to navigate and discover GeoNode resources. The client application provided by this repository is a MapStore downstream project an Open Source WebGIS framework based on ReactJS. 

## Tools tested versions

- node 20.13.1
- npm 10.5.2

## localConfig.json

`geonode_mapstore_client/static/mapstore/configs/localConfig.json` is a **working copy** for localhost dev — gitignored, free to edit. The committed seed is `localConfig.example.json` (e.g. for switching between site profiles or testing plugin changes); `start-dev.sh` copies it on first run if the working copy is absent. Per-site production configs live in [`Hydrata/deploy`](https://github.com/Hydrata/deploy) at `ansible/playbooks/roles/ansible-geonode/files/<site>.json` and overwrite the working copy on every Ansible deploy.
