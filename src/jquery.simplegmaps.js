/*
 *  Project: simplegmaps
 *	Version: 0.3.1
 *  Description: Google Maps made simple
 *  Author: Andreas Norman <an@andreasnorman.se>
 *  License: MIT
 */
(function ($, window, document, undefined) {

	var pluginName = 'simplegmaps',
		// the name of using in .data()
		dataPlugin = 'plugin_' + pluginName,
		TravelModes = ['DRIVING', 'WALKING', 'BICYCLING'],
		// default options
		defaults = {
			debug: false,
			GeoLocation: false,
			MapOptions: {
				draggable: true,
				scrollwheel: false,
				streetViewControl: false,
				panControl: true,
				zoomControl: true,
				zoomControlOptions: {
					style: 'DEFAULT'
				}
			},
			AppleMapLink: 'http://maps.apple.com/',
			AndroidMapLink: 'http://maps.google.com/maps',
			GenericMapLink: 'http://www.google.com/maps',
			getRouteButton: '#simplegmaps-getroute',
			getTravelMode: '#simplegmaps-travelmode',
			routeDirections: '#simplegmaps-directions',
			externalLink: '#simplegmaps-external',
			getFromAddress: '#simplegmaps-fromaddress',
			defaultTravelMode: 'DRIVING'

		};

	// Zooms map enough to fit all markers. But not too much. Just enough to be perfect!
	// 
	// Array: markers
	var zoomToFitBounds = function (map, markers) {
		var bounds = new google.maps.LatLngBounds();
		for (var i = 0; i < markers.length; ++i) {
			bounds.extend(markers[i].getPosition());
		}
		if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
			var extendPoint1 = new google.maps.LatLng(bounds.getNorthEast().lat() + 0.002, bounds.getNorthEast().lng() + 0.002);
			var extendPoint2 = new google.maps.LatLng(bounds.getNorthEast().lat() - 0.002, bounds.getNorthEast().lng() - 0.002);
			bounds.extend(extendPoint1);
			bounds.extend(extendPoint2);
		}
		try {
			map.fitBounds(bounds);
			map.setCenter(bounds.getCenter());
		} catch (e) {} // Let's catch this possible error and do nothing about it. Noone will ever know.
	};

	// Takes a string with latlng in this format "55.5897407,13.012268899999981" and makes it into a latlng object
	var parseLatLng = function (latlngString) {
		var bits = latlngString.split(/,\s*/);
		$latlng = new google.maps.LatLng(parseFloat(bits[0]), parseFloat(bits[1]));
		return $latlng;
	};

	var bindMapLinkButton = function (instance) {
		if ($(instance.options.externalLink).length > 0) {
			var markerPosition = instance.Map.markers[0].position.toString();
			var query = '?q=' + markerPosition;

			if (navigator.userAgent.toLowerCase().indexOf('android') > -1) {
				$(instance.options.externalLink).attr('href', instance.options.AndroidMapLink + query);
			} else if ((navigator.userAgent.match(/iPhone/i)) || (navigator.userAgent.match(/iPod/i))) {
				$(instance.options.externalLink).attr('href', instance.options.AppleMapLink + query);
			} else {
				$(instance.options.externalLink).attr('href', instance.options.GenericMapLink + query);
			}
		}
	};

	var drawMap = function (instance, mapEl) {
		var infoWindow = new google.maps.InfoWindow();
		var geocoder = new google.maps.Geocoder();
		var markers = [];
		var mapInData = mapEl.clone();
		var map = new google.maps.Map(mapEl[0], instance.options.MapOptions); // We need [0] to get the html element instead of jQery object 

		mapInData.find('div.map-marker').each(function (i) {
			if ($(this).attr('data-latlng')) {
				var marker = new google.maps.Marker({
					map: map,
					title: $(this).data('title'),
					position: parseLatLng($(this).data('latlng'))
				});
				if ($(this).has('div.map-infowindow').length > 0) {
					var infowindow = new google.maps.InfoWindow({
						content: $(this).find('div.map-infowindow').parent().html()
					});
					google.maps.event.addListener(marker, 'click', function () {
						infowindow.open(map, marker);
					});
				}

				markers.push(marker);
			} else if ($(this).attr('data-address')) {
				var currentMarkerData = $(this);
				geocoder.geocode({
					'address': $(this).data('address')
				}, function (results, status) {
					if (status === google.maps.GeocoderStatus.OK) {
						var marker = new google.maps.Marker({
							map: map,
							title: currentMarkerData.data('title'),
							position: results[0].geometry.location
						});
						if (currentMarkerData.has('div.map-infowindow').length > 0) {
							var infowindow = new google.maps.InfoWindow({
								content: currentMarkerData.find('div.map-infowindow').parent().html()
							});
							google.maps.event.addListener(marker, 'click', function () {
								infowindow.open(map, marker);
							});
						}

						markers.push(marker);
					}
				});
			}

		});

		// We need to wait for Google to locate and place all markers
		google.maps.event.addListenerOnce(map, 'idle', function () {
			if (markers.length > 0) {
				zoomToFitBounds(map, markers);
			}

			//Register map and its markers to class variable
			instance.Map = {
				map: map,
				markers: markers
			};
			bindMapLinkButton(instance);
			if (instance.options.GeoLocation) {
				geoLocation(instance.Map.map);
			}

		});
	};

	var drawRoute = function (instance, from) {
		var markers = instance.Map.markers;

		instance.directionsDisplay.setMap(instance.Map.map);
		console.log(instance.options.routeDirections);
		instance.directionsDisplay.setPanel($(instance.options.routeDirections)[0]);

		var request = {
			origin: from,
			destination: markers[0].position,
			travelMode: google.maps.TravelMode[instance.currentTravelmode]
		};
		instance.directionsService.route(request, function (response, status) {
			if (status === google.maps.DirectionsStatus.OK) {
				instance.directionsDisplay.setDirections(response);
			}
		});
	};

	var setTravelMode = function (instance, travelmode) {
		var length = instance.TravelModes.length;
		instance.currentTravelmode = instance.options.defaultTravelMode;
		for (var i = 0; i < length; i++) {
			if (instance.TravelModes[i] === travelmode) {
				instance.currentTravelmode = travelmode;
			}
		}
	};

	var setupRouting = function (instance) {
		instance.directionsService = new google.maps.DirectionsService();
		instance.directionsDisplay = new google.maps.DirectionsRenderer({
			draggable: true
		});

		$(instance.options.getRouteButton).on('click', function (e) {
			e.preventDefault();

			// Only accept DRIVING, WALKING or BICYCLING
			var travelmode = $(instance.options.getTravelMode).val();

			setTravelMode(instance, travelmode);

			if ($(instance.options.getFromAddress).val().length > 0) {
				drawRoute(instance, $(instance.options.getFromAddress).val());
			}

		});
	};

	var geoLocation = function (map) {
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(function (position) {
				var pos = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
				map.setCenter(pos);
			}, function () {
				handleNoGeolocation(map, true);
			});
		} else {
			// Browser doesn't support Geolocation
			handleNoGeolocation(map, false);
		}
	};

	var toggleTrafficLayer = function (instance) {
		if ((instance.trafficLayer) && (instance.trafficLayer.map !== null)) {
			instance.trafficLayer.setMap(null);
		} else {
			instance.trafficLayer = new google.maps.TrafficLayer();
			instance.trafficLayer.setMap(instance.Map.map);
		}
	};

	var toggleWeatherLayer = function (instance) {
		if (((instance.weatherLayer) && (instance.weatherLayer.map !== null)) || ((instance.instancecloudLayer) && (instance.instancecloudLayer.map !== null))) {
			instance.cloudLayer.setMap(null);
			instance.weatherLayer.setMap(null);
		} else {
			instance.weatherLayer = new google.maps.weather.WeatherLayer({
				temperatureUnits: google.maps.weather.TemperatureUnit.FAHRENHEIT
			});
			instance.weatherLayer.setMap(instance.Map.map);

			instance.cloudLayer = new google.maps.weather.CloudLayer();
			instance.cloudLayer.setMap(instance.Map.map);
		}
	};

	var handleNoGeolocation = function (map, errorFlag) {
		var content;
		if (errorFlag) {
			content = 'Error: The Geolocation service failed.';
		} else {
			content = 'Error: Your browser doesn\'t support geolocation.';
		}

		var options = {
			map: map,
			position: new google.maps.LatLng(60, 105),
			content: content
		};

		var infowindow = new google.maps.InfoWindow(options);
		instance.Map.setCenter(options.position);
	};

	// The actual plugin constructor
	var Plugin = function (element) {
		/*
		 * Plugin instantiation
		 */
		this.options = $.extend({}, defaults);
		this.TravelModes = $.extend([], TravelModes);
	};

	Plugin.prototype = {
		init: function (options) {
			// extend options ( http://api.jquery.com/jQuery.extend/ )
			$.extend(this.options, options);

			// Draw map and set markers
			drawMap(this, this.element);

			if (($(this.options.getRouteButton).length > 0) && ($(this.options.getTravelMode).length > 0)) {
				setupRouting(this);
			}

			if ($(this.options.geoLocationButton).length > 0) {
				var instance = this;
				$(this.options.geoLocationButton).on('click', function (e) {
					e.preventDefault();
					geoLocation(this);
				}.bind(this));
			}
		},

		// TODO
		getMarkers: function () {
			return this.Map.map;
		},

		// TODO
		getMap: function () {
			return this.Map.map;
		},

		toggleWeatherLayer: function () {
			toggleWeatherLayer(this);
		},

		toggleTrafficLayer: function () {
			toggleTrafficLayer(this);
		},

		// TODO
		getPosition: function () {

		},

		setGeoLocation: function () {
			geoLocation(this.Map.map);
		},

		addMethod: function (newMethod) {
			//$.tooltip.methods = $.extend($.tooltip.methods, newMethods); 
			this.extensions = $.extend(this.extensions, newMethod);
		},


		destroy: function () {
			// unset Plugin data instance
			this.element.data(dataPlugin, null);
		}
	};

	/*
	 * Plugin wrapper, preventing against multiple instantiations and
	 * allowing any public function to be called via the jQuery plugin,
	 * e.g. $(element).pluginName('functionName', arg1, arg2, ...)
	 */
	$.fn[pluginName] = function (arg) {
		var args, instance;

		// only allow the plugin to be instantiated once
		if (!(this.data(dataPlugin) instanceof Plugin)) {

			// if no instance, create one
			this.data(dataPlugin, new Plugin(this));
		}

		instance = this.data(dataPlugin);

		instance.element = this;

		// Is the first parameter an object (arg), or was omitted,
		// call Plugin.init( arg )
		if (typeof arg === 'undefined' || typeof arg === 'object') {

			if (typeof instance.init === 'function') {
				instance.init(arg);
			}

			// checks that the requested public method exists
		} else if (typeof arg === 'string' && typeof instance[arg] === 'function') {

			// copy arguments & remove function name
			args = Array.prototype.slice.call(arguments, 1);

			// call the method
			return instance[arg].apply(instance, args);

		} else {

			$.error('Method ' + arg + ' does not exist on jQuery.' + pluginName);

		}
	};

}(jQuery, window, document));