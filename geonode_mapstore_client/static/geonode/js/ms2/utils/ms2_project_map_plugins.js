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
			"name": "Identify",
			"cfg": {
				"showFullscreen": false,
				"dock": true,
				"position": "right",
				"size": 0.4,
				"fluid": true,
				"viewerOptions": {
					"container": "{context.ReactSwipe}"
				}
			},
			"override": {
				"Toolbar": {
					"position": 11,
					"alwaysVisible": false
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
		"Expander",
		"Undo",
		"Redo",
		"MapFooter",
		"Measure",
		{
			"name": "Print",
			"cfg": {
				"useFixedScales": true,
				"mapWidth": 256
			}
		},
		{
			"name": "ZoomAll",
			"override": {
				"Toolbar": {
					"alwaysVisible": false
				}
			}
		},
		{
			"name": "ZoomIn",
			"override": {
				"Toolbar": {
					"alwaysVisible": true
				}
			}
		},
		{
			"name": "ZoomOut",
			"override": {
				"Toolbar": {
					"alwaysVisible": true
				}
			}
		},
		{
			"name": "Timeline",
			"cfg": {
				"style": {
					"marginBottom": 30,
					"marginLeft": 80,
					"marginRight": 45
				},
				"compact": true
			}
		},
		"BurgerMenu",
		"ProjectManager",
	]
}