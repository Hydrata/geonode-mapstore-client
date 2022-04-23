echo "Building geonode-mapstore-client"
npm run compile --prefix ./geonode_mapstore_client/client/
git add ./geonode_mapstore_client/static/
git commit -m "compile client" ./
git push
