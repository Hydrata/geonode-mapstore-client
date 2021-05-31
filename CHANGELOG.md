# Change Log

## 2.1.4 [2020-04-14]

<li> Wed Apr 14 13:11:43 2021 +0200: afabiani <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/895e60af6903fc4e6dfd3a4d8a87f4e255569efc target=blank>[Fixes #130] REST API v2 endpoint for GeoStories throws an exception</a></li>

## 2.1.3 [2020-04-12]

- **Deprecated** `django-mapstore-adapter`; this library has been now merged into `django-geonode-mapstore-client`
- You don't have to change anything on your `settings.py` but you will have to **remove** `django-mapstore-adapter` from `requirements.txt` and `setup.cfg`

### Setup
- Install `pip install django-geonode-mapstore-client==2.1.3` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/2.1.3/)
- Based on [MapStore2 - v2021.01.01](https://github.com/geosolutions-it/MapStore2/releases/tag/v2021.01.01)

### Commits

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/2.1.2...2.1.3)

<li> Fri Apr 9 11:49:43 2021 +0200: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/caff82202d8055396907a4c9135a70951360f591 target=blank>#118: Unable to edit symbol of css style (#124)</a></li>
<li> Thu Apr 8 18:45:15 2021 +0200: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/b5051e76b2b962f57b2272f099fd78af76b9b7fb target=blank>#117: Widgets on map are not saved (#120)</a></li>
<li> Thu Apr 8 11:53:06 2021 -0400: NAGGINDA MARTHA <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/e36a60095468c6280f36a529a53657b09885d3a1 target=blank>add style to capability in layer_params (#116)</a></li>
<li> Tue Apr 6 17:05:47 2021 +0200: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/9f7e6a5816ea24b4c23a51e94e76735adfad74e0 target=blank>Missing search config reducer (#113)</a></li>
<li> Tue Apr 6 11:32:10 2021 +0200: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/228339859e9a8cdb8cd382c19b30c94b3487f007 target=blank>Update MapStore submodule to include fix for video with autoplay and audio enabled in geostory (#111)</a></li>
<li> Fri Apr 2 17:50:29 2021 +0200: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/ee8e009ad747884d984929d24a3ad6367ef25df8 target=blank>Update customization section of readme (#107)</a></li>
<li> Wed Mar 31 17:29:04 2021 +0200: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/be93cf0f714ba944c5581aeb2f60f5000c3cece1 target=blank>Update readme related to template and configuration refactor (#105)</a></li>
<li> Tue Mar 30 19:40:36 2021 +0200: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/9fb69b33d2d1ae09e4c27fb9533e9263cbb33d27 target=blank>[Backport 2.1.x] Fix loading of app templates (#102)</a></li>
<li> Tue Mar 30 15:42:59 2021 +0200: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/6ccf563063ec8b29cf434a8adcf7c3370e510f0a target=blank>Backport 2.1.x - refactor of templates and js entry points (#100)</a></li>
<li> Tue Mar 30 10:59:22 2021 +0300: NAGGINDA MARTHA <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/89ff104541bc75202a5ff5df239ea92c80e711b0 target=blank>modify resource check (#95)</a></li>

## 2.1.2 [2020-03-22]

### Breaking Changes

- **Deprecated** `django-mapstore-adapter`; this library has been now merged into `django-geonode-mapstore-client`
- You don't have to change anything on your `settings.py` but you will have to **remove** `django-mapstore-adapter` from `requirements.txt` and `setup.cfg`

### Setup
- Install `pip install django-geonode-mapstore-client==2.1.2` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/2.1.2/)
- Based on [MapStore2 - v2021.01.01](https://github.com/geosolutions-it/MapStore2/releases/tag/v2021.01.01)

### Commits

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/2.1.0...2.1.2)

<li> Fri Mar 19 12:35:25 2021 +0100: bieganowski <57660086+bieganowski@users.noreply.github.com> <a href="https://github.com/GeoNode/geonode-mapstore-client/commit/20da4d134b799fb305918505ec1896b49e5c89a8" target=blank>[Fixes #90] Uploaded thumbnail race hazard (#91)</a></li>

## 2.1.1 [2020-03-08]

### Breaking Changes

- **Deprecated** `django-mapstore-adapter`; this library has been now merged into `django-geonode-mapstore-client`
- You don't have to change anything on your `settings.py` but you will have to **remove** `django-mapstore-adapter` from `requirements.txt` and `setup.cfg`

### Setup
- Install `pip install django-geonode-mapstore-client==2.1.1` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/2.1.1/)
- Based on [MapStore2 - v2021.01.01](https://github.com/geosolutions-it/MapStore2/releases/tag/v2021.01.01)

### Commits

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/2.0.9...2.1.0)

<li> Mon Mar 8 12:35:25 2021 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/42d4a93962cb13e3a6e24eaa72e327ca32da0aff target=blank>Fix Home page and preview panel still show the HTML tags for abstract (#88)</a></li>
<li> Fri Mar 5 17:39:51 2021 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/55c145de9c36ed5f4ad99f06bf05d48456fa4fb8 target=blank>Allow extensibility of localConfig.json via patch for geonode project (#87)</a></li>
<li> Fri Mar 5 14:44:07 2021 +0100: giohappy <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/d9f08603e66782516e62cb388bdbba152c9cafa7 target=blank>let the client override index.html</a></li>
<li> Fri Mar 5 11:52:54 2021 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/53b9be17a61f5ec2fe979923d52f5f310eef382e target=blank>remove SearchServicesConfig plugin (#84)</a></li>
<li> Fri Mar 5 11:06:41 2021 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/27a8c2de2012f7ba5788a0ed853ca64875f83e9f target=blank>Update MapStore submodule to include fix related to widget resizing (#83)</a></li>
<li> Thu Mar 4 17:41:50 2021 +0100: afabiani <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/b78555f06794d29603ddc84cb851c85d814bc9ea target=blank> - GeoNode plugin: read all the possible layer parameters from the MapStore blob</a></li>
<li> Thu Feb 25 10:11:20 2021 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/2b2325a37c6d863f3bf6614f8dfe0a26b5775d77 target=blank>Abstract and thumbnail of documents is not displayed correctly in a GeoStory (#81)</a></li>
<li> Tue Feb 23 11:25:03 2021 +0100: Alessio Fabiani <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/b08a8f3f2dc4d7b311c0b2146e2c629522ddffa2 target=blank> - merging mapstore adapter (#80)</a></li>
<li> Wed Feb 17 12:36:58 2021 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/2702accb2d82ae7201cfdfee1aba45b8943c8926 target=blank>Enable layer preview in the new homepage (#79)</a></li>
<li> Tue Feb 9 10:24:23 2021 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/8fef01f61941dd660dbc3e16a1d355e5fd21685d target=blank>Update MapStore2 submodule to latest master (#77)</a></li>
<li> Wed Dec 23 11:22:24 2020 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/ad1a95d325827147361b1e041416a843d8b73f89 target=blank>Homepage theme and configuration improvements (#76)</a></li>
<li> Fri Dec 18 12:07:14 2020 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/b2cb925288e25866c9bd051aab5a8441f5ceb229 target=blank>Activate MapStore WPS plugin (Layer Download) (#75)</a></li>
<li> Tue Dec 15 18:41:44 2020 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/56b2b015edc595edb8d3da7a1fff1bc823c7b5ee target=blank>enable add group plugin in the map editor (#74)</a></li>
<li> Fri Dec 11 14:55:34 2020 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/5cfa963051b054439f750cb15eea9fb4656d6e97 target=blank>Improve detail panel layout on medium screen (#73)</a></li>
<li> Thu Dec 10 17:08:14 2020 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/5677e350dcc096ae48bf510195609836c0c04b5c target=blank>Improve mobile layout for homepage (#72)</a></li>
<li> Fri Dec 4 20:33:23 2020 +0100: afabiani <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/20c1ca043d577f9935992258fdd6e0e7935dff90 target=blank> - Bump to version 2.0.10</a></li>
<li> Fri Dec 4 19:24:27 2020 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/9759db1d28bb70814f8214a2c0a6e4789ec2a7b1 target=blank>Update README.md files (#70)</a></li>
<li> Thu Dec 3 16:27:40 2020 +0100: afabiani <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/d5bd40d44913b5ce8cd493c7f29381bb3ae60469 target=blank> - Updating build.build.sh and .*ignore files</a></li>
<li> Thu Dec 3 16:23:59 2020 +0100: Alessio Fabiani <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/70ef6f88efcc57bcd9b3bd934f87e569db88b590 target=blank>Merge pull request #69 from allyoucanmap/gn-master</a></li>
<li> Thu Dec 3 16:21:30 2020 +0100: stefano bovio <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/bea18482e4364c149ca6cb13df806df5f8df896b target=blank>add missing files of spa homepage</a></li>
<li> Thu Dec 3 11:21:06 2020 +0100: afabiani <a href=https://github.com/GeoNode/geonode-mapstore-client/commit/be6c15d8d1c94f9aaefc61fda78dd7fb4514b7a0 target=blank> - Merge with "rest_api_v2_geonode_spa_homepage" branch</a></li>

## 2.0.9 [2020-12-01]

- Install `pip install django-mapstore-adapter>=2.0.6` instructions [Here](https://pypi.org/project/django-mapstore-adapter/)
- Install `pip install django-geonode-mapstore-client==2.0.9` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/2.0.9/)
- Based on [GeoNode MapStore Adapter v2.0.6+](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/2.0.6)
- Based on [MapStore2 - v2020.02.00](https://github.com/geosolutions-it/MapStore2/releases/tag/v2020.02.00)

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/2.0.8...2.0.9)

<li> 2020-11-24: allyoucanmap <a href="https://github.com/GeoNode/geonode-mapstore-client/commit/664563298e92d6c4272deb86b97fc70080893e3c" target="blank"> update client bundle</a></li> 
<li> 2020-11-24: allyoucanmap <a href="https://github.com/GeoNode/geonode-mapstore-client/commit/a12cc619be19fbaef6397de8a2d018ae155805be" target="blank"> replace require with import and export and update mapstore submodule</a></li> 
<li> 2020-11-11: allyoucanmap <a href="https://github.com/GeoNode/geonode-mapstore-client/commit/bd21a9847cb757bad4705c758000da4c6806ff87" target="blank"> restore version</a></li> 
<li> 2020-11-11: allyoucanmap <a href="https://github.com/GeoNode/geonode-mapstore-client/commit/b8e1ea99f64b4c9f04216d6fc0956f56a907594c" target="blank"> update client bundle</a></li> 
<li> 2020-11-11: allyoucanmap <a href="https://github.com/GeoNode/geonode-mapstore-client/commit/7f4ae17bfa48ab86f16e32374df2f936d74a7f24" target="blank"> add project extensibility, map swipe and locate plugins</a></li> 
<li> 2020-11-03: allyoucanmap <a href="https://github.com/GeoNode/geonode-mapstore-client/commit/0eee341416e742bb5d858a75a85322e9d8ce075b" target="blank"> update mapstore submodule</a></li> 
<li> 2020-11-03: allyoucanmap <a href="https://github.com/GeoNode/geonode-mapstore-client/commit/5e931f529cad9dd2ceb662a7dcd9b28b22af2f29" target="blank"> hide background selector controls</a></li> 
<li> 2020-11-03: allyoucanmap <a href="https://github.com/GeoNode/geonode-mapstore-client/commit/e6e40f93d9a600a2d6e49562c898fe8a194cd4be" target="blank"> add custom save and save as plugins</a></li> 
<li> 2020-10-14: allyoucanmap <a href="https://github.com/GeoNode/geonode-mapstore-client/commit/cd41b162a5c7784a5dd9d6c2240a1035552358eb" target="blank"> update client bundle</a></li> 
<li> 2020-10-14: allyoucanmap <a href="https://github.com/GeoNode/geonode-mapstore-client/commit/f93bdb29ffb2a1e1972666948ae6c8499c046ab4" target="blank"> replace save and saveAs plugin with custom ones to improve the saving workflow</a></li> 
<li> 2020-08-03: afabiani <a href="https://github.com/GeoNode/geonode-mapstore-client/commit/50dc57e4f79a623463f03fddbc3caa90621a8471" target="blank">  - Bump to version 2.0.8.1</a></li>

## 2.0.8 [2020-07-31]

### Main features

- Install `pip install django-mapstore-adapter>=2.0.4` instructions [Here](https://pypi.org/project/django-mapstore-adapter/)
- Install `pip install django-geonode-mapstore-client==2.0.8` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/2.0.8/)
- Based on [GeoNode MapStore Adapter v2.0.4+](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/2.0.4)
- Based on [MapStore2 - v2020.02.00](https://github.com/geosolutions-it/MapStore2/releases/tag/v2020.02.00)

    ### Main Features
    - **Story Map**: build your fascinating stories using MapStore contents and more.  You are invited to discover this new interesting functionality by looking at the online documentation [here](https://mapstore.readthedocs.io/en/latest/user-guide/exploring-stories/). Special thanks to the MapStore team for this.
    - **Application Contexts**:  as administrator you can now build and configure your own map viewer, share it and create maps on it, learn more looking at the online documentation [here](https://mapstore.readthedocs.io/en/latest/user-guide/managing-contexts/). Special thanks to the MapStore team for this.

    ### Other Improvements

    - **Attribute Table**: the features selection by clicking on map now available, the online docomentation [here](https://mapstore.readthedocs.io/en/latest/user-guide/filtering-layers/#quick-filter-by-clicked-point)
    - **Measurements**:  more advanced improvements have been provided, look at the online documentation  [here](https://mapstore.readthedocs.io/en/latest/user-guide/measure/) to learn more
    - **Import/Export**: the WMC format is now available, the online documentation [here](https://mapstore.readthedocs.io/en/latest/user-guide/import/)
    - **Catalog Tool**: new source types are available like TMS and WFS, the online documentation [here](https://mapstore.readthedocs.io/en/latest/user-guide/catalog/#catalog-types)
    - **Identify Tool**: some new entries like the identify popup mode and the posibility to switch in edit mode by opening the attribute table, the online documentation [here](https://mapstore.readthedocs.io/en/latest/user-guide/side-bar/#identify-tool)
    - **Layer Settings**: you can now edit the legend size, look at the online documentation [here](https://mapstore.readthedocs.io/en/latest/user-guide/layer-settings/#display)


    ### Links

    - **[Full Changelog](https://github.com/geosolutions-it/MapStore2/compare/v2020.01.01...v2020.02.00)**

    - **[Implemented enhancements](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+milestone%3A%222020.02.00%22+is%3Aclosed+label%3Aenhancement)**

    - **[Fixed bugs](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+milestone%3A%222020.02.00%22+is%3Aclosed+label%3Abug)**

    - **[Closed issues](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+milestone%3A%222020.02.00%22+is%3Aclosed)**

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/2.0.7...2.0.8)

<li> 2020-07-31: afabiani <a href="https://github.com/GeoNode/geonode-mapstore-client/commit/be8de8268c9667bc8e9bd4bad0feec9cb463525b" target="blank">  - Bump MapStore2 to v2020.02.00 (https://github.com/geosolutions-it/MapStore2/releases/tag/v2020.02.00)</a></li> 

## 2.0.7 [2020-07-14]

 - <a href="https://github.com/GeoNode/geonode-mapstore-client/issues/62">Print Button not showing up anymore with latest updates</a>

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/2.0.6...2.0.7)

## 2.0.6 [2020-07-10]

 - <a href="https://github.com/GeoNode/geonode-mapstore-client/issues/61">Visual style editor</a>

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/2.0.5...2.0.6)

## 2.0.5 [2020-05-05]

 - Updated MapStore2 to <a href="https://github.com/geosolutions-it/MapStore2/commit/8d8f455e4e9c8fccba7f102d7c6bfbb9d2243be9">2020.02.00</a>

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/2.0.3...2.0.5)

## 2.0.3 [2020-04-20]

### Main features

- Install `pip install django-mapstore-adapter>=2.0.2` instructions [Here](https://pypi.org/project/django-mapstore-adapter/)
- Install `pip install django-geonode-mapstore-client==2.0.4` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/2.0.4/)
- Based on [GeoNode MapStore Adapter v2.0.3](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/2.0.3)
- Based on [MapStore2 - v2020.02.00](https://github.com/geosolutions-it/MapStore2/releases/tag/v2020.02.00)

[GeoNode MapStore Client](https://github.com/GeoNode/geonode-mapstore-client/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2.0.4) the list of issues solved.

[MapStore2](https://github.com/geosolutions-it/MapStore2/milestone/23?closed=1) the list of MapStore2 issues solved.

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/2.0.3...2.0.4)

<li> 2020-04-17: Lorenzo Natali <a href="http://github.com/GeoNode/geonode-mapstore-client/commit/84674d5f533268f8ff99e866df12a1e54a1301d1" target="blank"> fixed style of dialogs</a></li> 
<li> 2020-04-17: Lorenzo Natali <a href="http://github.com/GeoNode/geonode-mapstore-client/commit/f579244ee8b849074a73caec08aa78375c66cc3d" target="blank"> updated to latest master</a></li> 
<li> 2020-04-17: Lorenzo Natali <a href="http://github.com/GeoNode/geonode-mapstore-client/commit/9bd2608df6428f0ec9228a761cb71edfa66ac8ef" target="blank"> Updated Configurations for new plugins</a></li> 
<li> 2020-04-17: Lorenzo Natali <a href="http://github.com/GeoNode/geonode-mapstore-client/commit/78b2370ecd67b0f86136787dece3b9c975d3a838" target="blank"> Updated plugins</a></li> 
<li> 2020-04-17: afabiani <a href="http://github.com/GeoNode/geonode-mapstore-client/commit/53586daaf93ccddc93054bd147e4c4aaa0865fa6" target="blank"> Update MapStore2 to v. 2020.01.02</a></li> 
<li> 2020-04-02: afabiani <a href="http://github.com/GeoNode/geonode-mapstore-client/commit/c71cc9fe0790af2d20a0291eed47252b7a9af8bf" target="blank">  - Bump to version 2.0.3</a></li> 
<li> 2020-04-02: afabiani <a href="http://github.com/GeoNode/geonode-mapstore-client/commit/ee05425320590750ab15c3dde55cebdf2afbf139" target="blank">  - Bump to version 2.0.3</a></li> 

## 2.0.3 [2020-04-02]

### Main features

- Install `pip install django-mapstore-adapter==2.0.2` instructions [Here](https://pypi.org/project/django-mapstore-adapter/)
- Install `pip install django-geonode-mapstore-client==2.0.3` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/2.0.2/)
- Based on [GeoNode MapStore Adapter v2.0.2](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/2.0.2)
- Based on [MapStore2 - v2020.01.01](https://github.com/geosolutions-it/MapStore2/releases/tag/v2020.01.01)

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/2.0.2...2.0.3)

<li> 2020-04-02: afabiani <a href="http://github.com/GeoNode/geonode-mapstore-client/commit/499fd6ad3fc06bc1a052bf7198916d47c252fba9" target="blank"> - Update MapStore to stable release v2020.01.01</a></li> 
<li> 2020-04-02: afabiani <a href="http://github.com/GeoNode/geonode-mapstore-client/commit/0c7f832b723a8c5f7779609e6276d46835698f09" target="blank"> - Allow templates to inherit all properties form "defaultConfig"</a></li> 

## 2.0.2 [2020-03-09]

### Main features

- Install `pip install django-mapstore-adapter==2.0.2` instructions [Here](https://pypi.org/project/django-mapstore-adapter/)
- Install `pip install django-geonode-mapstore-client==2.0.2` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/2.0.2/)
- Based on [GeoNode MapStore Adapter v2.0.2](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/2.0.2)
- Based on [MapStore2 - v2020.01.00](https://github.com/geosolutions-it/MapStore2/releases/tag/v2020.01.00)

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/2.0.1...2.0.2)

<li> 2020-03-10: allyoucanmap <a href="http://github.com/GeoNode/geonode-mapstore-client/commit/b51ed3d4879224750c748b7a35ad93ae09fec1fe" target="blank"> update requires of plugins</a></li> 
<li> 2020-03-10: allyoucanmap <a href="http://github.com/GeoNode/geonode-mapstore-client/commit/f124e78cbf548a740cd869765ccc076af48dc210" target="blank"> format files</a></li> 
<li> 2020-03-10: allyoucanmap <a href="http://github.com/GeoNode/geonode-mapstore-client/commit/8b129431317b66b884a31b77c6f07c60be6fc5b1" target="blank"> update MapStore version to v2020.01.00</a></li> 
<li> 2020-03-09: afabiani <a href="http://github.com/GeoNode/geonode-mapstore-client/commit/e0e3424ee02fb4760931f060a6f94fdfbcceee32" target="blank"> ref. https://github.com/GeoNode/geonode/issues/5614 Remove Geo-EXT and Print custom GeoServer plugin wrapper from GeoNode</a></li> 

## 2.0.1 [2020-02-27]

### Main features

- Install `pip install django-mapstore-adapter==2.0.1` instructions [Here](https://pypi.org/project/django-mapstore-adapter/)
- Install `pip install django-geonode-mapstore-client==2.0.1` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/2.0.1/)
- Based on [GeoNode MapStore Adapter v2.0.1](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/2.0.1)
- Based on [MapStore2 - v2019.02.xx](https://github.com/GeoNode/MapStore2/tree/2019.02.xx)
- [MapStore2 Main Features](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.xx+label%3Aenhancement)

[GeoNode MapStore Client](https://github.com/GeoNode/geonode-mapstore-client/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2.0.1) the list of issues solved.

[MapStore2](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.xx) the list of MapStore2 issues solved.

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/1.4.8...2.0.1)

<li> 2020-02-26: allyoucanmap <a href="https://github.com/GeoNode/django-mapstore-adapter/commit/61082239d4d3f2ead699f07bc29444e646f6229e" target="blank"> change dev server host to develop without a local geonode</a></li> 
<li> 2020-02-26: allyoucanmap <a href="https://github.com/GeoNode/django-mapstore-adapter/commit/7179aea25d82c57d67f9875625f52ff8b4d0fd95" target="blank"> remove duplicated style</a></li> 
<li> 2020-02-26: allyoucanmap <a href="https://github.com/GeoNode/django-mapstore-adapter/commit/d9f3bc42d2ab4c8728d7b3905f674a049c30b7f0" target="blank"> add comment on style</a></li> 
<li> 2020-02-26: allyoucanmap <a href="https://github.com/GeoNode/django-mapstore-adapter/commit/e26be9a64c14f11764726c99170322d6064b9237" target="blank"> fix position of print dialog inside map/layer preview</a></li> 

## 2.0.0 [2020-01-16]

<li>2020-01-16: Python 3 / Django 2 Compatibility</li>

## [1.4.8](https://github.com/GeoNode/geonode-mapstore-client/releases/tag/1.4.8) (2019-12-20)

### Main features

- Install `pip install django-mapstore-adapter>=1.0.12` instructions [Here](https://pypi.org/project/django-mapstore-adapter/)
- Install `pip install django-geonode-mapstore-client==1.4.8` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/1.4.8/)
- Based on [GeoNode MapStore Adapter v1.0.15](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/1.0.15)
- Based on [MapStore2 - v2019.02.xx](https://github.com/GeoNode/MapStore2/tree/2019.02.xx)
- [MapStore2 Main Features](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.xx+label%3Aenhancement)

[GeoNode MapStore Client](https://github.com/GeoNode/geonode-mapstore-client/issues?q=is%3Aissue+is%3Aclosed+milestone%3A1.4.8) the list of issues solved.

[MapStore2](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.xx) the list of MapStore2 issues solved.

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/1.4.7...1.4.8)

## [1.4.7](https://github.com/GeoNode/geonode-mapstore-client/releases/tag/1.4.7) (2019-12-18)

### Main features

- Install `pip install django-mapstore-adapter>=1.0.12` instructions [Here](https://pypi.org/project/django-mapstore-adapter/)
- Install `pip install django-geonode-mapstore-client==1.4.7` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/1.4.7/)
- Based on [GeoNode MapStore Adapter v1.0.15](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/1.0.15)
- Based on [MapStore2 - v2019.02.xx](https://github.com/GeoNode/MapStore2/tree/2019.02.xx)
- [MapStore2 Main Features](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.xx+label%3Aenhancement)

[GeoNode MapStore Client](https://github.com/GeoNode/geonode-mapstore-client/issues?q=is%3Aissue+is%3Aclosed+milestone%3A1.4.7) the list of issues solved.

[MapStore2](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.xx) the list of MapStore2 issues solved.

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/1.4.6...1.4.7)

## [1.4.6](https://github.com/GeoNode/geonode-mapstore-client/releases/tag/1.4.6) (2019-11-11)

### Main features

- Install `pip install django-mapstore-adapter>=1.0.12` instructions [Here](https://pypi.org/project/django-mapstore-adapter/)
- Install `pip install django-geonode-mapstore-client==1.4.6` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/1.4.6/)
- Based on [GeoNode MapStore Adapter v1.0.12](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/v1.0.12)
- Based on [MapStore2 - v2019.02.xx](https://github.com/GeoNode/MapStore2/tree/2019.02.xx)
- [MapStore2 Main Features](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.xx+label%3Aenhancement)

[GeoNode MapStore Client](https://github.com/GeoNode/geonode-mapstore-client/issues?q=is%3Aissue+is%3Aclosed+milestone%3A1.4.6) the list of issues solved.

[MapStore2](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.xx) the list of MapStore2 issues solved.

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/1.4.5...1.4.6)

## [1.4.5](https://github.com/GeoNode/geonode-mapstore-client/releases/tag/1.4.5) (2019-11-08)

### Main features

- Install `pip install django-mapstore-adapter>=1.0.9` instructions [Here](https://pypi.org/project/django-mapstore-adapter/)
- Install `pip install django-geonode-mapstore-client==1.4.5` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/1.4.5/)
- Based on [GeoNode MapStore Adapter v1.0.9](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/v1.0.9)
- Based on [MapStore2 - v2019.02.xx](https://github.com/GeoNode/MapStore2/tree/2019.02.xx)
- [MapStore2 Main Features](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.xx+label%3Aenhancement)

[GeoNode MapStore Client](https://github.com/GeoNode/geonode-mapstore-client/issues?q=is%3Aissue+is%3Aclosed+milestone%3A1.4.5) the list of issues solved.

[MapStore2](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.xx) the list of MapStore2 issues solved.

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/1.4.4...1.4.5)

## [1.4.4](https://github.com/GeoNode/geonode-mapstore-client/releases/tag/1.4.4) (2019-10-09)

### Main features

- Install `pip install django-mapstore-adapter>=1.0.9` instructions [Here](https://pypi.org/project/django-mapstore-adapter/)
- Install `pip install django-geonode-mapstore-client==1.4.4` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/1.4.4/)
- Based on [GeoNode MapStore Adapter v1.0.9](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/v1.0.9)
- Based on [MapStore2 - v2019.02.xx](https://github.com/GeoNode/MapStore2/tree/2019.02.xx)
- [MapStore2 Main Features](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.01+label%3Aenhancement)

[GeoNode MapStore Client](https://github.com/GeoNode/geonode-mapstore-client/issues?q=is%3Aissue+is%3Aclosed+milestone%3A1.4.4) the list of issues solved.

[MapStore2](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.01) the list of MapStore2 issues solved.

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/1.4.3...1.4.4)

## [1.4.3](https://github.com/GeoNode/geonode-mapstore-client/releases/tag/v1.4.3) (2019-10-07)

### Main features

- Install `pip install django-mapstore-adapter==1.0.9` instructions [Here](https://pypi.org/project/django-mapstore-adapter/1.0.9/)
- Install `pip install django-geonode-mapstore-client==1.4.3` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/1.4.3/)
- Based on [GeoNode MapStore Adapter v1.0.9](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/v1.0.9)
- Based on [MapStore2 - v2019.02.xx](https://github.com/GeoNode/MapStore2/tree/2019.02.xx)
- [MapStore2 Main Features](https://github.com/GeoNode/MapStore2/releases/tag/v2019.02.00) included

[GeoNode MapStore Client](https://github.com/GeoNode/geonode-mapstore-client/issues?q=is%3Aissue+is%3Aclosed+milestone%3A1.4.3) the list of issues solved.

[MapStore2](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.01) the list of MapStore2 issues solved.

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/v1.4.2...v1.4.3)

## [1.4.2](https://github.com/GeoNode/geonode-mapstore-client/releases/tag/v1.4.2) (2019-09-19)

### Main features

- Install `pip install django-mapstore-adapter==1.0.8` instructions [Here](https://pypi.org/project/django-mapstore-adapter/1.0.8/)
- Install `pip install django-geonode-mapstore-client==1.4.2` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/1.4.2/)
- Based on [GeoNode MapStore Adapter v1.0.8](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/v1.0.8)
- Based on [MapStore2 - v2019.02.xx](https://github.com/GeoNode/MapStore2/tree/2019.02.xx)
- [MapStore2 Main Features](https://github.com/GeoNode/MapStore2/releases/tag/v2019.02.00) included

[GeoNode MapStore Client](https://github.com/GeoNode/geonode-mapstore-client/issues?q=is%3Aissue+is%3Aclosed+milestone%3A1.4.2) the list of issues solved.

[MapStore2](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.01) the list of MapStore2 issues solved.

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/v1.4.1...v1.4.2)

## [1.4.1](https://github.com/GeoNode/geonode-mapstore-client/releases/tag/v1.4.1) (2019-09-11)

### Main features

- Install `pip install django-mapstore-adapter==1.0.7` instructions [Here](https://pypi.org/project/django-mapstore-adapter/1.0.7/)
- Install `pip install django-geonode-mapstore-client==1.4.1` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/1.4.1/)
- Based on [GeoNode MapStore Adapter v1.0.7](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/v1.0.7)
- Based on [MapStore2 - v2019.02.xx](https://github.com/GeoNode/MapStore2/tree/2019.02.xx)
- [MapStore2 Main Features](https://github.com/GeoNode/MapStore2/releases/tag/v2019.02.00) included

[GeoNode MapStore Client](https://github.com/GeoNode/geonode-mapstore-client/issues?q=is%3Aissue+is%3Aclosed+milestone%3A1.4.1) the list of issues solved.

[MapStore2](https://github.com/geosolutions-it/MapStore2/issues?q=is%3Aissue+is%3Aclosed+milestone%3A2019.02.01) the list of MapStore2 issues solved.

[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/v1.4.0...v1.4.1)

## [1.4.0](https://github.com/GeoNode/geonode-mapstore-client/releases/tag/v1.4.0) (2019-08-14)

### Main features

- Install `pip install django-mapstore-adapter==1.0.4` instructions [Here](https://pypi.org/project/django-mapstore-adapter/1.4.0/)
- Install `pip install django-geonode-mapstore-client==1.4.0` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/1.4.0/)
- Based on [GeoNode MapStore Adapter v1.0.4](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/v1.0.4)
- Based on [MapStore2 - v2019.02.00](https://github.com/GeoNode/MapStore2/releases/tag/v2019.02.00)
- [MapStore2 Main Features](https://www.geo-solutions.it/blog/mapstore-release-2019_01_01-2/) included

[GeoNode MapStore Client](https://github.com/GeoNode/geonode-mapstore-client/issues?q=is%3Aissue+is%3Aclosed+milestone%3A1.4) the list of issues solved.

[MapStore2](https://github.com/GeoNode/MapStore2/issues?q=is%3Aissue+milestone%3A2019.02.00+is%3Aclosed) the list of MapStore2 issues solved.

## [1.3.1](https://github.com/GeoNode/geonode-mapstore-client/releases/tag/v1.3.1) (2019-06-18)

### Main features

- Install `pip install django-geonode-mapstore-client==1.3.1` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/)
- Release of GeoNode MapStore client v1.1
- Based on [Django MapStore Adapter 1.0.3](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/1.0.3)

[GeoNode MapStore Client](https://github.com/GeoNode/geonode-mapstore-client/issues?q=is%3Aissue+milestone%3A%221.3.1%22) the list of issues solved.

[MapStore2](https://github.com/GeoNode/MapStore2/issues?utf8=%E2%9C%93&q=+is%3Aissue+milestone%3A2019.01.01) the list of MapStore2 issues solved.

## [1.3.0](https://github.com/GeoNode/geonode-mapstore-client/releases/tag/v1.3) (2019-06-18)

### Main features

- Install `pip install django-geonode-mapstore-client==1.3` instructions [Here](https://pypi.org/project/django-geonode-mapstore-client/)
- Release of GeoNode MapStore client v1.1
- Based on [Django MapStore Adapter 1.0.3](https://github.com/GeoNode/django-mapstore-adapter/releases/tag/1.0.3)

[GeoNode MapStore Client](https://github.com/GeoNode/geonode-mapstore-client/issues?q=is%3Aissue+milestone%3A%221.2%22) the list of issues solved.

[MapStore2](https://github.com/GeoNode/MapStore2/issues?utf8=%E2%9C%93&q=+is%3Aissue+milestone%3A2019.01.01) the list of MapStore2 issues solved.

## [1.1](https://github.com/GeoNode/geonode-mapstore-client/tree/v1.1) (2019-06-14)

 - **[MapStore2 Tag](https://github.com/GeoNode/MapStore2/releases/tag/v2019.01.01)**

 - **[Full Changelog](https://github.com/GeoNode/geonode-mapstore-client/compare/v1.0...v1.1)**

 - **[Implemented enhancements](https://github.com/GeoNode/geonode-mapstore-client/issues?utf8=%E2%9C%93&q=is%3Aissue+is%3Aclosed+label%3Aenhancement+milestone%3A%221.1%22+)**

 - **[Fixed bugs](https://github.com/GeoNode/geonode-mapstore-client/issues?utf8=%E2%9C%93&q=is%3Aissue+is%3Aclosed+label%3Abug+milestone%3A%221.1%22+)**

 - **[Closed issues](https://github.com/GeoNode/geonode-mapstore-client/issues?utf8=%E2%9C%93&q=is%3Aissue+is%3Aclosed+milestone%3A%221.1%22+)**
