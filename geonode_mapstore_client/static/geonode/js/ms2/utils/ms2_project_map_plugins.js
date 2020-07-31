var MS2_PROJECT_MAP_PLUGINS = {
	"desktop": [
	  {
			"name": "Map",
			"cfg": {
				"tools": [],
				"mapOptions": {
					"openlayers": {
						"attribution": {
							"container": "#footer-attribution-container"
						},
						"interactions": {
							"pinchRotate": false,
							"altShiftDragRotate": false
						}
					}
				}
			}
		},
		{
			"name": "BackgroundSelector",
			"cfg": {
				"style": {
					"bottom": 0,
					"marginBottom": 25
				},
				"dimensions": {
					"side": 65,
					"sidePreview": 65,
					"frame": 3,
					"margin": 5,
					"label": false,
					"vertical": true,
				}
			}
		},
		{
			"name": "Settings",
			"cfg": {
				"wrap": true
			}
		},
    {
			"name": "Toolbar",
			"id": "NavigationBar",
			"cfg": {
				"id": "navigationBar",
				"layout": "horizontal"
			}
		},
    {
			"name": "MapLoading",
			"override": {
				"Toolbar": {
					"alwaysVisible": true
				}
			}
		},
		"Cookie",
	]
}