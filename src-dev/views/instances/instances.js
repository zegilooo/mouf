/**
 * The object if charge of managing all instances.
 */
var MoufInstanceManager = (function() {
	var _instances = {};
	var _classes = {};
	// List of JS files containing renderers that have been loaded so far
	var _jsrenderers = {};
	// List of CSS files containing renderers that have been loaded so far
	var _cssrenderers = {};
	// The number of files waiting to be loaded
	var _nbFilesToLoad = 0;
	// The list of callbacks to be called when all the files will be loaded
	// Note: some callback might wait longer that they need, this is slightly
	// suboptimal to wait for all the files to be loaded.
	var _callbackWhenFilesLoaded = []

	/**
	 * Event handler triggered each time a property of an instance is changed
	 */
	var _propertyChangedEventHandler = new Mouf.Observer();

	/**
	 * Event handler triggered each time a new instance is created
	 */
	var _newInstanceEventHandler = new Mouf.Observer();

	/**
	 * Event handler triggered each time an instance is renamed
	 */
	var _renameEventHandler = new Mouf.Observer();

	/**
	 * Event handler triggered each time an instance is deleted
	 */
	var _deleteEventHandler = new Mouf.Observer();

	var triggerAllCallbacksWhenFilesLoaded = function() {
		// La condition semble changer la valeur de la variable,c 'est
		// complétement nimp!!!!
		if (_nbFilesToLoad == 0) {
			for ( var i = 0; i < _callbackWhenFilesLoaded.length; i++) {
				var mycallback = _callbackWhenFilesLoaded[i];
				mycallback();
			}
			_callbackWhenFilesLoaded = [];
		}
	}

	/**
	 * All Ajax calls return the same response (an array containing classes and
	 * instances descriptions). This function is in charge of analyzing this
	 * result.
	 */
	var handleUniversalResponse = function(json, callback) {

		var returnedInstances = {};

		if (json.classes) {
			for ( var className in json.classes) {
				var myClass = new MoufClass(json.classes[className]);
				_classes[className] = myClass;
			}

			// Now, that all class are loaded, let's make a second loop to load
			// renderers
			for ( var className in json.classes) {
				// Let's check if there are any renderers. If yes, let's load
				// them.
				var myClass = _classes[className];
				var annotations = myClass.getAnnotations();
				// Note: a class can have no annotation (if this is a parent
				// class of a component)
				if (annotations) {
					var renderers = annotations['Renderer'];
					if (renderers) {
						for ( var i = 0; i < renderers.length; i++) {
							var renderer = renderers[i];
							try {
								var jsonRenderer = jQuery.parseJSON(renderer);
							} catch (e) {
								throw "Invalid @Renderer annotation sent. The @Renderer must have a JSON object attached.\nAnnotation found: @Renderer "
										+ renderer + "\nError detected:" + e;
							}
							// Let's load JS files for the renderer
							var jsFiles;
							if (jsonRenderer['jsFiles']) {
								jsFiles = jsonRenderer['jsFiles'];
							} else {
								jsFiles = [];
							}
							if (jsonRenderer['jsFile']) {
								jsFiles.push(jsonRenderer['jsFile']);
							}
							for ( var i = 0; i < jsFiles.length; i++) {
								var jsFile = jsFiles[i];
								if (_jsrenderers[jsFile]) {
									continue;
								}

								var fileUrl;
								if (jsFile.indexOf("http://") == 0
										|| jsFile.indexOf("https://") == 0) {
									fileUrl = jsFile;
								} else {
									fileUrl = MoufInstanceManager.rootUrl
											+ '../' + jsFile;
								}

								_nbFilesToLoad++;

								var thisClass = myClass;
								var thisClassName = myClass.getName();
								var thisRendererName = jsonRenderer['object'];

								jQuery
										.getScript(fileUrl)
										.done(
												function() {
													// Note: if wa don't put the
													// content of the callback
													// in a setTimeout, there is
													// this completely wierd
													// behaviour of Firefox that
													// will stop the current
													// Javascript function
													// executed to execute the
													// script loaded,
													// and then start over. Very
													// disturbing. It's a bit
													// like a multithreaded
													// behaviour that would not
													// be
													// wanted.
													setTimeout(
															function() {
																_nbFilesToLoad--;

																// Let's add the
																// renderer to
																// the possible
																// renderer of
																// this class.
																MoufInstanceManager
																		.getLocalClass(thisClassName).renderers
																		.push(window[thisRendererName]);
																// thisClass.renderers.push(window[thisRendererName]);

																// Let's trigger
																// the callbacks
																// if all files
																// are loaded.
																triggerAllCallbacksWhenFilesLoaded();
															}, 0)

												})
										.fail(
												function(jqxhr, settings,
														exception) {
													alert("Error while loading script: "
															+ exception);
												});

								/*
								 * var scriptElem =
								 * document.createElement('script');
								 * scriptElem.type = 'text/javascript';
								 * scriptElem.async = true; scriptElem.src =
								 * fileUrl;
								 * 
								 * _nbFilesToLoad++;
								 * 
								 * var onScriptLoaded = function() {
								 * _nbFilesToLoad--;
								 *  // Let's add the renderer to the possible
								 * renderer of this class.
								 * thisClass.renderers.push(window[thisRendererName]);
								 *  // Let's trigger the callbacks if all files
								 * are loaded.
								 * triggerAllCallbacksWhenFilesLoaded(); }
								 *  // Now, let's make sure we call the callback
								 * when everything is loaded. if
								 * (scriptElem.readyState){ //IE var thisClass =
								 * myClass; var thisRendererName =
								 * jsonRenderer['object'];
								 * scriptElem.onreadystatechange = function(){
								 * if (scriptElem.readyState == "loaded" ||
								 * scriptElem.readyState == "complete"){
								 * scriptElem.onreadystatechange = null;
								 * 
								 * onScriptLoaded(); } }; } else { //Others var
								 * thisClass = myClass; var thisRendererName =
								 * jsonRenderer['object']; scriptElem.onload =
								 * function(){ onScriptLoaded(); }; }
								 * 
								 * //var s =
								 * document.getElementsByTagName('script')[0];
								 * s.parentNode.insertBefore(scriptElem, s);
								 * document.getElementsByTagName("head")[0].appendChild(scriptElem);
								 */
								_jsrenderers[jsFile] = true;
							}

							// Let's load CSS files for the renderer
							var cssFiles;
							if (jsonRenderer['cssFiles']) {
								cssFiles = jsonRenderer['cssFiles'];
							} else {
								cssFiles = [];
							}
							if (jsonRenderer['cssFile']) {
								cssFiles.push(jsonRenderer['cssFile']);
							}
							for ( var i = 0; i < cssFiles.length; i++) {
								var cssFile = cssFiles[i];
								if (_cssrenderers[cssFile]) {
									continue;
								}
								var fileref = document.createElement("link");
								fileref.setAttribute("rel", "stylesheet")
								fileref.setAttribute("type", "text/css")
								var fileUrl;
								if (cssFile.indexOf("http://") == 0
										|| cssFile.indexOf("https://") == 0) {
									fileUrl = cssFile;
								} else {
									fileUrl = MoufInstanceManager.rootUrl
											+ '../' + cssFile;
								}
								fileref.setAttribute("href", fileUrl)
								document.getElementsByTagName("head")[0]
										.appendChild(fileref);
								_cssrenderers[cssFile] = true;
							}

						}
					}
				}
			}
		}
		if (json.instances) {
			for ( var instanceName in json.instances) {
				var instance = new MoufInstance(json.instances[instanceName]);
				_instances[instanceName] = instance;
				returnedInstances[instanceName] = instance;
			}
		}

		/*
		 * if (_nbFilesToLoad == 0) { callback(returnedInstances); }
		 */

		var mycallback = callback;
		// Let's add the callback to the list of stuff to do when all files are
		// loaded.
		_callbackWhenFilesLoaded.push(function() {
			mycallback(returnedInstances);
		})
		// Let's trigger the callbacks if all files are loaded.
		triggerAllCallbacksWhenFilesLoaded();
	}

	// Let's return the public object
	return {

		rootUrl : "/mouf/mouf/",
		/**
		 * Adds an array of instances, defined as json object.
		 * 
		 * e.g.: instances = { "instanceName": { "class": className,
		 * "fieldProperties": [ ... ] ... SEE MoufManager documentation for
		 * more, this is the array stored there. }, "notFullyLoadedInstance": {
		 * "class": className, "incomplete": true } }
		 */
		addInstances : function(instances) {
			for ( var key in instances) {
				_instances[key] = new MoufInstance(instances[key]);
			}
		},

		/**
		 * Returns the details of an instance, asynchronously using a promise.
		 * 
		 * @return Mouf.Promise
		 */
		getInstance : function(instanceName) {
			var promise = new Mouf.Promise();

			if (_instances[instanceName]
					&& !_instances[instanceName].incomplete) {
				promise.triggerSuccess(window, _instances[instanceName]);
			} else {
				jQuery.ajax(
						this.rootUrl + "src/direct/get_instance_details.php", {
							data : {
								name : instanceName,
								selfedit : this.selfEdit ? "true" : "false",
								encode : "json"
							}
						}).fail(
						function(e) {
							var msg = e;
							if (e.responseText) {
								msg = "Status code: " + e.status + " - "
										+ e.statusText + "\n" + e.responseText;
							}
							promise.triggerError(window, msg);
						}).done(
						function(result) {
							/*
							 * try { var json = jQuery.parseJSON(result); }
							 * catch (e) { promise.triggerError(window, result); }
							 * handleUniversalResponse(json);
							 */
							if (typeof (result) == "string") {
								promise.triggerError(window, result);
								return;
							}
							try {
								handleUniversalResponse(result, function() {
									promise.triggerSuccess(window,
											_instances[instanceName]);
								});
							} catch (e) {
								promise.triggerError(window, e);
								throw e;
							}
						});
			}
			return promise;
		},

		getClass : function(className) {
			var promise = new Mouf.Promise();

			if (_classes[className] 
					&& !_classes[className].incomplete
					&& _classes[className].getExportMode() == "all") {
				promise.triggerSuccess(window, _classes[className]);
			} else {
				jQuery.ajax(this.rootUrl + "src/direct/get_class.php", {
					data : {
						"class" : className,
						encode : "json",
						selfedit : this.selfEdit ? "true" : "false"
					}
				}).fail(
						function(e) {
							var msg = e;
							if (e.responseText) {
								msg = "Status code: " + e.status + " - "
										+ e.statusText + "\n" + e.responseText;
							}
							promise.triggerError(window, msg);
						}).done(
						function(result) {
							try {
								var json = jQuery.parseJSON(result);
							} catch (e) {
								promise.triggerError(window, result);
								return;
							}
							try {
								handleUniversalResponse(json, function() {
									promise.triggerSuccess(window,
											_classes[className]);
								});
							} catch (e) {
								promise.triggerError(window, e);
								throw e;
							}

						});
			}
			return promise;
		},

		/**
		 * Returns the list of all classes defined as
		 * 
		 * @Component, in a promise.
		 * 
		 * @return Mouf.Promise
		 */
		getComponents : function() {
			var promise = new Mouf.Promise();

			jQuery.ajax(this.rootUrl + "src/direct/get_all_classes.php", {
				data : {
					encode : "json",
					selfedit : this.selfEdit ? "true" : "false",
					export_mode : "tiny"
				}
			}).fail(
					function(e) {
						var msg = e;
						if (e.responseText || e.statusText) {
							msg = "Status code: " + e.status + " - "
									+ e.statusText + "\n" + e.responseText;
						}
						promise.triggerError(window, msg);
					}).done(function(result) {
				if (typeof (result) == "string") {
					promise.triggerError(window, result);
					return;
				}
				try {
					handleUniversalResponse(result, function() {
						/*
						 * var componentsList = _.filter(_classes,
						 * function(classDescriptor) { var annotations =
						 * classDescriptor.getAnnotations(); if (annotations &&
						 * annotations["Component"]) { return true; } else {
						 * return false; } })
						 */
						var componentsList = _classes;
						promise.triggerSuccess(window, componentsList);
					});
				} catch (e) {
					promise.triggerError(window, e);
					throw e;
				}
			});

			return promise;
		},

		/**
		 * Returns the details of all instances implementing the type passed in
		 * parameter (it can be a class name or an interface name),
		 * asynchronously using a promise. It will also return the list of all
		 * classes that are subclass of the type passed in parameter. The
		 * promise can be implented this way:
		 * 
		 * MoufInstanceManager.getInstanceListByType("MyInterface").then(function(arrayofMoufInstances,
		 * arrayofMoufClasses) {
		 * 
		 * });
		 * 
		 * @param type string
		 * @return Mouf.Promise
		 */
		getInstanceListByType : function(type) {
			var promise = new Mouf.Promise();

			jQuery
					.ajax(
							this.rootUrl
									+ "src/direct/get_instances_with_details.php",
							{
								data : {
									"class" : type,
									encode : "json",
									selfedit : this.selfEdit ? "true" : "false"
								}
							})
					.fail(
							function(e) {
								var msg = e;
								if (e.responseText) {
									msg = "Status code: " + e.status + " - "
											+ e.statusText + "\n"
											+ e.responseText;
								}
								promise.triggerError(window, msg);
							})
					.done(
							function(result) {
								if (typeof (result) == "string") {
									promise.triggerError(window, result);
									return;
								}
								try {
									handleUniversalResponse(
											result,
											function(instancesList) {
												// Let's have a look at the
												// children classes list
												// returned.
												// This is too specific to be
												// managed by
												// handleUniversalResponse
												var childrenClasses = {};
												for ( var i = 0; i < result.childrenClasses.length; i++) {
													var childClassName = result.childrenClasses[i];
													childrenClasses[childClassName] = _classes[childClassName];
												}
												promise.triggerSuccess(window,
														instancesList,
														childrenClasses);
											});
								} catch (e) {
									promise.triggerError(window, e);
									throw e;
								}
							});
			return promise;
		},

		/**
		 * Returns the class passed in parameter. This class must have
		 * previously been loaded (through getClass or getInstance), otherwise,
		 * an exception will be triggered.
		 */
		getLocalClass : function(className) {
			if (_classes[className]) {
				return _classes[className];
			} else {
				throw "Unable to find class '"
						+ className
						+ "' locally. It should have been loaded first (through getClass or getInstance)";
			}
		},

		/**
		 * Creates a new instance of class className whose name is instanceName.
		 * You can set if the instance is anonymous or not using the isAnonymous
		 * parameter.
		 * 
		 * Note: if the instance is declared anonymous, it must IMMEDIATELY be
		 * bound to another instance. Otherwise, the garbage collector for "weak
		 * instances" will delete the instance immediately.
		 * 
		 * @return MoufInstance
		 */
		newInstance : function(classDescriptor, instanceName, isAnonymous) {

			if (classDescriptor.getExportMode() == 'tiny') {
				throw 'Class descriptor not fully loaded. Cannot create new instance.';
			}
			
			var constructorArguments = {};
			_.each(classDescriptor.getInjectableConstructorArguments(), function(
					property) {
				var types = property.getTypes();
				var type = (types.getTypes().length > 0)?types.getTypes()[0].toJson():null;
				
				if (property.hasDefault()) {
					constructorArguments[property.getName()] = {
						value : property.getDefault(),
						origin : "string",
						metadata : [],
						isset: true,
						type: type
					};
				} else {
					constructorArguments[property.getName()] = {
						value : null,
						origin : null,
						metadata : [],
						isset: false,
						type: type
					};
				}
			});
			
			var properties = {};
			_.each(classDescriptor.getInjectablePublicProperties(), function(
					property) {
				var types = property.getTypes();
				var type = (types.getTypes().length > 0)?types.getTypes()[0].toJson():null;
				
				if (property.hasDefault()) {
					properties[property.getName()] = {
						value : property.getDefault(),
						origin : "string",
						metadata : [],
						isset: true,
						type: type
					};
				} else {
					properties[property.getName()] = {
						value : null,
						origin : null,
						metadata : [],
						isset: false,
						type: type
					};
				}
			});
			
			var setters = {};
			_.each(classDescriptor.getInjectableSetters(), function(
					property) {
				var types = property.getTypes();
				var type = (types.getTypes().length > 0)?types.getTypes()[0].toJson():null;
				
				var parameters = property.getParameters();
				if (parameters.length > 0) {
					var parameter = parameters[0];
					if (parameter.hasDefault()) {
						setters[property.getName()] = {
							value : parameter.getDefault(),
							origin : "string",
							metadata : [],
							isset: true,
							type: type
						};
					} else {
						setters[property.getName()] = {
							value : null,
							origin : null,
							metadata : [],
							isset: false,
							type: type
						};
					}
				}
			});

			var instance = new MoufInstance({
				"name" : instanceName,
				"class" : classDescriptor.getName(),
				"anonymous" : isAnonymous,
				"constructorArguments" : constructorArguments,
				"properties" : properties,
				"setters" : setters
			});
			_instances[instanceName] = instance;

			_newInstanceEventHandler.fire(instance, instance);
			return instance;
		},

		/**
		 * Deletes the instance passed in parameter. The second instance is a
		 * callback called when the delete has been propagated.
		 */
		deleteInstance : function(instance, callback) {
			delete _instances[instance.getName()];

			// Let's trigger listeners
			_deleteEventHandler.fire(instance, instance, callback);
		},

		/**
		 * Registers a callback called when the the newInstance method is
		 * called. If scope is not passed, the default scope (this) is the new
		 * instance object. The first argument of the callback is also the new
		 * instance object.
		 */
		onNewInstance : function(callback, scope) {
			_newInstanceEventHandler.subscribe(callback, scope);
		},

		/**
		 * Registers a callback called when the MoufInstanceProperty::setValue
		 * method is called. If scope is not passed, the default scope (this) is
		 * the moufInstanceProperty object. The first argument of the callback
		 * is also the moufInstanceProperty object.
		 */
		onPropertyChange : function(callback, scope) {
			_propertyChangedEventHandler.subscribe(callback, scope);
		},

		firePropertyChange : function(moufInstanceProperty) {
			_propertyChangedEventHandler.fire(moufInstanceProperty,
					moufInstanceProperty);
		},

		/**
		 * Registers a callback called when the MoufInstance::rename method is
		 * called. If scope is not passed, the default scope (this) is the
		 * moufInstanceProperty object. The first argument of the callback is
		 * also the moufInstance object and the second is the previous name of
		 * the instance. The third optional parameter is a callback called when
		 * the rename has been performed.
		 */
		onRenameInstance : function(callback, scope) {
			_renameEventHandler.subscribe(callback, scope);
		},

		fireRename : function(moufInstance, oldName, callback) {
			_renameEventHandler.fire(moufInstance, moufInstance, oldName,
					callback);
		},

		/**
		 * Registers a callback called when the
		 * MoufInstanceManager::deleteInstance method is called. If scope is not
		 * passed, the default scope (this) is the moufInstanceProperty object.
		 * The first argument of the callback is also the moufInstance
		 * object.The second optional parameter is a callback called when the
		 * rename has been performed.
		 */
		onDeleteInstance : function(callback, scope) {
			_deleteEventHandler.subscribe(callback, scope);
		},

		/**
		 * _renameInstance must not be directly called. It is used by
		 * instance.rename internally.
		 */
		_renameInstance : function(oldname, newname) {
			_instances[newname] = _instances[oldname];
			delete _instances[oldname];
		}

	};
})();

/**
 * Let's define the MoufInstance class. The constructor takes a JSON object that
 * comes straight from MoufManager inner representation. SEE MoufManager
 * documentation for more, this is the array stored there.
 * 
 * @class
 */
var MoufInstance = function(json) {
	this.json = json;
	this.constructorArguments = {};
	this.publicProperties = {};
	this.setters = {};
	var jsonConstructorArguments = this.json["constructorArguments"];
	for ( var propertyName in jsonConstructorArguments) {
		this.constructorArguments[propertyName] = new MoufInstanceProperty(
				"constructor", propertyName,
				jsonConstructorArguments[propertyName], this);
	}
	var jsonProperties = this.json["properties"];
	for ( var propertyName in jsonProperties) {
		this.publicProperties[propertyName] = new MoufInstanceProperty(
				"property", propertyName, jsonProperties[propertyName], this);
	}
	var jsonSetters = this.json["setters"];
	for ( var propertyName in jsonSetters) {
		this.setters[propertyName] = new MoufInstanceProperty("setter",
				propertyName, jsonSetters[propertyName], this);
	}
}

MoufInstance.prototype.getClassName = function() {
	return this.json["class"];
}

/**
 * Returns the MoufClass representing the instance... as a promise!!!
 */
MoufInstance.prototype.getClass = function() {
	return MoufInstanceManager.getClass(this.getClassName());
}

/**
 * Returns the MoufClass representing the instance directly. It must have been
 * loaded first! If not, use getClass instead.
 */
MoufInstance.prototype.getLocalClass = function() {
	return MoufInstanceManager.getLocalClass(this.getClassName());
}

MoufInstance.prototype.getName = function() {
	return this.json["name"];
}

/**
 * Returns true if the instance is anonymous. False otherwise.
 */
MoufInstance.prototype.isAnonymous = function() {
	return this.json["anonymous"];
}

/**
 * Returns an array of objects of type MoufInstanceProperty that represents the
 * property of this instance.
 */
MoufInstance.prototype.getPublicProperties = function() {
	return this.publicProperties;
}

/**
 * Returns an object of type MoufInstanceProperty that represents the property
 * of this instance.
 */
MoufInstance.prototype.getPublicProperty = function(propertyName) {
	var publicProperty = this.publicProperties[propertyName]; 
	if (publicProperty == null) {
		throw "Error! The public property '"+propertyName+"' does not exist in instance '"+this.getName()+"' of class '"+this.getClassName()+"'";
	}
	return publicProperty;
}

/**
 * Returns an array of objects of type MoufInstanceProperty that represents a
 * constructor arguments of this instance.
 */
MoufInstance.prototype.getConstructorArguments = function() {
	return this.constructorArguments;
}

/**
 * Returns an object of type MoufInstanceProperty that represents the
 * constructor arguments of this instance.
 */
MoufInstance.prototype.getConstructorArgument = function(propertyName) {
	var property = this.constructorArguments[propertyName]; 
	if (property == null) {
		throw "Error! The constructor argument '"+propertyName+"' does not exist in instance '"+this.getName()+"' of class '"+this.getClassName()+"'";
	}
	return property;
}

/**
 * Returns an array of objects of type MoufInstanceProperty that represents the
 * setters of this instance.
 */
MoufInstance.prototype.getSetters = function() {
	return this.setters;
}

/**
 * Returns an object of type MoufInstanceProperty that represents a setter of
 * this instance.
 */
MoufInstance.prototype.getSetter = function(propertyName) {
	var property = this.setters[propertyName]; 
	if (property == null) {
		throw "Error! The setter '"+propertyName+"' does not exist in instance '"+this.getName()+"' of class '"+this.getClassName()+"'";
	}
	return property;
}

/**
 * Renames the instance. newName is the new name for the instance, or empty if
 * it becomes anonymous. callback is an optionnal callback called when the save
 * is performed.
 */
MoufInstance.prototype.rename = function(newName, callback) {
	var oldName = this.json['name'];

	if (newName == "" || newName == null) {
		this.json["anonymous"] = true;

		var timestamp = new Date();
		newName = "__anonymous_" + timestamp.getTime();
	} else {
		this.json["anonymous"] = false;
	}

	this.json['name'] = newName;

	MoufInstanceManager._renameInstance(oldName, newName);

	// Let's trigger listeners
	MoufInstanceManager.fireRename(this, oldName, callback);
}

/**
 * Renders the instance to the display, and returns that object as an in-memory
 * jQuery object.
 */
MoufInstance.prototype.render = function(/* target, */rendererName) {
	if (!rendererName) {
		rendererName = 'small';
	}

	var classDescriptor = MoufInstanceManager
			.getLocalClass(this.getClassName());
	var renderers = classDescriptor.getRenderers();
	var renderer = renderers[0];
	if (renderer == null) {
		renderer = MoufDefaultRenderer;
	}
	var callback = renderer.getRenderers()[rendererName].renderer;
	return callback(this);
}

/**
 * Let's define the MoufInstanceProperty class, that defines the value of a
 * property/method/constructor argument. The source can be one of "constructor",
 * "property" or "setter".
 */
var MoufInstanceProperty = function(source, propertyName, json, parent) {
	this.name = propertyName;
	this.json = json;
	this.parent = parent;
	this.source = source;
	// This current type
	if (json['type']) {
		this.type = new MoufType(json['type']);
	}
	
	//var moufProperty = this.getMoufProperty();
	
	var value = this.getValue();
	if (typeof(value) == 'object') {
		var values = value;
	//if (moufProperty.isArray()) {
		// In case of arrays, let's completely drop the value and replace it
		// with an array of MoufInstanceSubProperties
		this.moufInstanceSubProperties = [];
		
		if (this.type == null) {
			// Let's avoid any catastroph if the type is not completely set, let's just not display anything
			// TODO: improve error reporting here.
			return;
		}
		
		// Arrays (even associative PHP arrays) are stored as list of {key:"",
		// value:""} objects in order
		// to preserve the PHP order of keys (that is not guaranteed to be
		// preserved in JS)
		if (values != null) {
			for ( var i = 0; i < values.length; i++) {
				this.moufInstanceSubProperties
						.push(new MoufInstanceSubProperty(this, values[i].key,
								values[i].value, this.type.getSubType()));
			}
		}
	}
}

/**
 * Returns the name for this property.
 */
MoufInstanceProperty.prototype.getName = function() {
	return this.name;
}

/**
 * Returns the source for this property. Can be one of "constructor", "property"
 * or "setter".
 */
MoufInstanceProperty.prototype.getSource = function() {
	return this.source;
}

/**
 * Returns the type for this current value.
 * Call MoufProperty.getTypes for the list of all possible types.
 */
MoufInstanceProperty.prototype.getType = function() {
	return this.type;
}

/**
 * Sets the type for this instance property.
 * This will also reset the value to "undefined".
 */
MoufInstanceProperty.prototype.setType = function(moufType) {
	this.type = moufType;
	this.unSet();
}


/**
 * Returns the value for this property. If the value is a primitive type, the
 * value of the primitive type is returned. If the value is a pointer to an
 * instance, the MoufInstance object is returned. If the value is an array, DO
 * NOT USE getValue. Instead, use "forEachElementArray" function to go through
 * the elements.
 */
MoufInstanceProperty.prototype.getValue = function() {

	// FIXME: add a manage system for primitive types.
	// Maybe using: "registerPrimitiveType" function?
	return this.json['value'];
}

/**
 * Sets the value for this property. Note: do not call this method for setting
 * arrays. It won't work. Use method to manipulate arrays instead!
 */
MoufInstanceProperty.prototype.setValue = function(value, origin) {
	if (origin) {
		this.json['origin'] = origin;
	} else {
		this.json['origin'] = 'string';
	}

	this.json['value'] = value;
	this.json['isset'] = true;

	//var moufProperty = this.getMoufProperty();
	if (this.type.isArray()) {
		if (value === null) {
			// Let's empty all the elements:
			this.moufInstanceSubProperties = [];
		} else {
			throw "You cannot call setValue on an array (except to set it to 'null')";
		}
	}

	// Let's trigger listeners
	MoufInstanceManager.firePropertyChange(this);
}

/**
 * Returns true if the value is set in the DI container. False otherwise. If no
 * value is set, the default value is used instead.
 */
MoufInstanceProperty.prototype.isSet = function() {
	return this.json['isset'];
}

/**
 * Returns true if the value is set in the DI container. False otherwise. If no
 * value is set, the default value is used instead.
 */
MoufInstanceProperty.prototype.unSet = function() {
	this.json['isset'] = false;
	this.json['origin'] = 'string';

	this.json['value'] = null;
	this.moufInstanceSubProperties = [];
	
	MoufInstanceManager.firePropertyChange(this);
}

/**
 * Returns the origin for this property.
 */
MoufInstanceProperty.prototype.getOrigin = function() {
	return this.json['origin'];
}

/**
 * Returns the metadata for this property.
 */
MoufInstanceProperty.prototype.getMetaData = function() {
	return this.json['metadata'];
}

/**
 * Returns a MoufProperty or a MoufMethod object or a MoufParameter object
 * representing the property.
 * 
 * @returns MoufProperty
 */
MoufInstanceProperty.prototype.getMoufProperty = function() {
	var classDescriptor = MoufInstanceManager.getLocalClass(this.parent
			.getClassName());
	var constructor = classDescriptor.getConstructor();
	if (this.source == "constructor"
			&& constructor.getParameter(this.name) != null) {
		return classDescriptor.getConstructor().getParameter(this.name);
	} else if (this.source == "property"
			&& classDescriptor.getProperty(this.name) != null) {
		return classDescriptor.getProperty(this.name);
	} else if (this.source == "setter"
			&& classDescriptor.getMethod(this.name) != null) {
		return classDescriptor.getMethod(this.name);
	} else {
		throw "Error, unknown mouf property " + this.name;
	}
}

/**
 * Returns the instance this property is part of.
 */
MoufInstanceProperty.prototype.getInstance = function() {
	return this.parent;
}

/**
 * Add a new subInstanceProperty to this instanceProperty. SubInstanceProperties
 * are used when the property represents a class. In this case, the added
 * subInstanceProperty represents a new key/value pair for the array.
 * 
 * @return MoufInstanceSubProperty
 */
MoufInstanceProperty.prototype.addArrayElement = function(key, value) {
	this.json['isset'] = true;

	// Just to be sure it's not empty, some functions rely on that.
	this.json['value'] = [];

	//var moufProperty = this.getMoufProperty();
	if (this.type.isAssociativeArray()) {
		var instanceSubProperty = new MoufInstanceSubProperty(this, key, value, this.type.getSubType());
		this.moufInstanceSubProperties.push(instanceSubProperty);

		// Let's trigger listeners
		MoufInstanceManager.firePropertyChange(this);

		return instanceSubProperty;
	} else if (this.type.isArray()) {
		var instanceSubProperty = new MoufInstanceSubProperty(this, null, value, this.type.getSubType());
		this.moufInstanceSubProperties.push(instanceSubProperty);

		// Let's trigger listeners
		MoufInstanceManager.firePropertyChange(this);

		return instanceSubProperty;
	} else {
		throw "Unable to add an array element to a property that is not an array";
	}
	MoufInstanceManager.firePropertyChange(this);
}

/**
 * Returns the size of the array
 * 
 * @return int
 */
MoufInstanceProperty.prototype.arraySize = function() {
	return this.moufInstanceSubProperties.length;
}

/**
 * This will loop through each element in the array (respecting the PHP key
 * order) and will call the "callback" function, passing in parameter a
 * MoufInstanceSubProperty object that represent the key/value pair.
 */
MoufInstanceProperty.prototype.forEachArrayElement = function(callback) {
	//var moufProperty = this.getMoufProperty();
	if (!this.type.isArray()) {
		throw "Error, the '" + moufProperty.getName()
				+ "' property is not an array.";
	}

	for ( var i = 0; i < this.moufInstanceSubProperties.length; i++) {
		callback(this.moufInstanceSubProperties[i]);
	}
}

/**
 * If the property is an array, this will put the element in position i at the
 * position j. This will trigger a remote save on the server.
 */
MoufInstanceProperty.prototype.reorderArrayElement = function(i, j) {
	if (i == j) {
		return;
	}

	if (!this.type.isArray()) {
		var moufProperty = this.getMoufProperty();
		throw "Error, the '" + moufProperty.getName()
				+ "' property is not an array.";
	}

	// var values = this.getValue();

	// var elemToMove = values[i];
	var instanceSubPropertyToMove = this.moufInstanceSubProperties[i];

	// var newValues = [];
	var newMoufInstanceProperties = [];

	var m = 0;
	for ( var k = 0; k < this.moufInstanceSubProperties.length; k++) {
		if (m == j) {
			// newValues[m] = elemToMove;
			newMoufInstanceProperties[m] = instanceSubPropertyToMove;
			m++;
		}

		if (i != k) {
			// newValues[m] = values[k];
			newMoufInstanceProperties[m] = this.moufInstanceSubProperties[k];
			m++;
		}
	}
	if (this.moufInstanceSubProperties.length != newMoufInstanceProperties.length) {
		// newValues[m] = elemToMove;
		newMoufInstanceProperties[m] = instanceSubPropertyToMove;
	}

	this.moufInstanceSubProperties = newMoufInstanceProperties;
	// this.setValue(newValues);
	MoufInstanceManager.firePropertyChange(this);

}

/**
 * If the property is an array, this will remove the element in position i. This
 * will trigger a remote save on the server.
 */
MoufInstanceProperty.prototype.removeArrayElement = function(i) {
	if (!this.type.isArray()) {
		var moufProperty = this.getMoufProperty();
		throw "Error, the '" + moufProperty.getName()
				+ "' property is not an array.";
	}

	// var values = this.getValue();

	// var newValues = [];
	var newMoufInstanceProperties = [];

	var m = 0;
	for ( var k = 0; k < this.moufInstanceSubProperties.length; k++) {
		if (k == i) {
			continue;
		}

		// newValues[m] = values[k];
		newMoufInstanceProperties[m] = this.moufInstanceSubProperties[k];
		m++;
	}

	this.moufInstanceSubProperties = newMoufInstanceProperties;
	// this.setValue(newValues);
	MoufInstanceManager.firePropertyChange(this);

}

/**
 * Returns a warning message for this instance property, if any
 */
MoufInstanceProperty.prototype.getWarningMessage = function() {
	return this.json['warning'];
}


/**
 * Let's define the MoufClass class, that defines a PHP class.
 */
var MoufClass = function(json) {
	this.json = json;

	this.properties = [];
	this.propertiesByName = {};

	if (this.getExportMode() != 'tiny') {
		var jsonProperties = this.json["properties"];
		for ( var i = 0; i < jsonProperties.length; i++) {
			var moufProperty = new MoufProperty(jsonProperties[i]);
			this.properties.push(moufProperty);
			this.propertiesByName[moufProperty.getName()] = moufProperty;
		}

		this.methods = [];
		this.methodsByName = {};
		var jsonMethods = this.json["methods"];
		for ( var i = 0; i < jsonMethods.length; i++) {
			var moufMethod = new MoufMethod(jsonMethods[i]);
			this.methods.push(moufMethod);
			this.methodsByName[moufMethod.getName()] = moufMethod;
		}
	}

	this.subclassOf = null;

	this.renderers = [];
}

/**
 * Returns the name of the class.
 */
MoufClass.prototype.getName = function() {
	return this.json['name'];
}

/**
 * Returns the export mode of the class (tiny|properties|all)
 */
MoufClass.prototype.getExportMode = function() {
	return this.json['exportmode'];
}

/**
 * Returns the name of the parent class.
 */
MoufClass.prototype.getParentClassName = function() {
	return this.json['extend'];
}

/**
 * Returns the parent class.
 */
MoufClass.prototype.getParentClass = function() {
	var parentClassName = this.getParentClassName();
	if (parentClassName != null) {
		return MoufInstanceManager.getLocalClass(parentClassName);
	} else {
		return null;
	}
}

/**
 * Returns the comments of the class.
 */
MoufClass.prototype.getComment = function() {
	return this.json['comment']['comment'];
}

/**
 * Returns the annotations of the class, as a JSON object, excluding the parent
 * classes: { "annotationName", [param1, param2....] } There are as many params
 * as there are annotations
 */
MoufClass.prototype.getLocalAnnotations = function() {
	return this.json['comment']['annotations'];
}

/**
 * Returns whether this class can be instantiated or not (abstract,
 * interface...)
 */
MoufClass.prototype.isInstantiable = function() {
	return this.json['isinstantiable'];
}

/**
 * Retrieves the annotations of the class, as a JSON object, including the
 * parent classes, and pass those to a callback: { "annotationName", [param1,
 * param2....] } There are as many params as there are annotations
 */
MoufClass.prototype.getAnnotations = function() {
	var annotations = this.json['comment']['annotations'];
	if (annotations == null) {
		annotations = {};
	}

	var thisClass = this;
	do {
		var parentClass = thisClass.getParentClass()
		if (parentClass == null) {
			break;
		}
		var parentAnnotations = parentClass.getAnnotations();
		for ( var key in parentAnnotations) {
			if (annotations[key] == null) {
				annotations[key] = [];
			}
			annotations[key].concat(parentAnnotations[key]);
		}

		thisClass = parentClass;
	} while (true);

	return annotations;
}

/**
 * Returns the list of all injectable properties (constructor parameters,
 * properties and setters)
 */
MoufClass.prototype.getAllInjectableProperties = function() {
	var moufProperties = this.getInjectableConstructorArguments().concat(
			this.getInjectableSetters(), this.getInjectablePublicProperties());

	return moufProperties;
}

/**
 * Returns the list of all setter properties
 */
MoufClass.prototype.getInjectableSetters = function() {
	var moufProperties = [];

	var methods = this.getMethods();
	for ( var i = 0; i < methods.length; i++) {
		var method = methods[i];
		// if (method.hasPropertyAnnotation()) {
		var methodName = method.getName();
		if (methodName.indexOf("set") == 0 && methodName.length > 3) {
			var parameters = method.getParameters();

			if (parameters.length >= 1) {
				var ko = false;
				for ( var j = 1; j < parameters.length; j++) {
					if (!parameters[j].hasDefault()) {
						ko = true;
						break;
					}
				}
				if (!ko) {
					moufProperties.push(method);
				}
			}
		}
		// }
	}
	return moufProperties;
}

/**
 * Returns the list of all constructor argument properties
 */
MoufClass.prototype.getInjectableConstructorArguments = function() {
	var moufProperties = [];

	var constructor = this.getConstructor();
	if (constructor) {
		var parameters = constructor.getParameters();
		/*
		 * for (var i=0; i<parameters.length; i++) {
		 * moufProperties.push(parameters[i]); }
		 */
		moufProperties = parameters;
	}

	return moufProperties;
}

/**
 * Returns the list of all public properties
 */
MoufClass.prototype.getInjectablePublicProperties = function() {
	/*
	 * var moufProperties = [];
	 * 
	 * var properties = this.getProperties(); for (var i=0; i<properties.length;
	 * i++) { var property = properties[i]; //if
	 * (property.hasPropertyAnnotation()) { moufProperties.push(property); //} }
	 * 
	 * return moufProperties;
	 */
	return this.getProperties();
}

/**
 * Returns true if "className" is a parent class or interface implement by this
 * class.
 */
MoufClass.prototype.isSubclassOf = function(className) {
	// Let's initiate the array containing all classes and all interfaces
	// extended/implemented by this class.
	if (this.subclassOf == null) {
		this.subclassOf = this.json["implements"];
		var parent = this;
		do {
			this.subclassOf.push(parent.getName());
			parent = parent.getParentClass();
		} while (parent);
	}
	// Now let's see if there is the className we are looking for in the list.
	for ( var i = 0; i < this.subclassOf; i++) {
		if (this.subclassOf[i] == className) {
			return true;
		}
	}
	return false;
}

/**
 * Returns a list of renderer objects for the instances (warning, these are
 * renderer OBJECTS, not renderer annotations).
 */
MoufClass.prototype.getRenderers = function() {
	return this.renderers;
}

/**
 * Renders the class to the display and returns the result as a jQuery element.
 */
MoufClass.prototype.render = function() {
	var renderers = this.getRenderers();
	var renderer = renderers[0];
	if (renderer == null) {
		renderer = MoufDefaultRenderer;
	}
	return renderer.renderClass(this);
}

/**
 * Returns an array of objects of type MoufProperty that represents the property
 * of this class.
 */
MoufClass.prototype.getProperties = function() {
	return this.properties;
}

/**
 * Returns an object of type MoufProperty that represents the property of this
 * class.
 */
MoufClass.prototype.getProperty = function(propertyName) {
	return this.propertiesByName[propertyName];
}

/**
 * Returns an array of objects of type MoufMethod that represent the methods of
 * this class.
 */
MoufClass.prototype.getMethods = function() {
	return this.methods;
}

/**
 * Returns an object of type MoufMethod that represents a method of this class.
 */
MoufClass.prototype.getMethod = function(methodName) {
	return this.methodsByName[methodName];
}

/**
 * Returns an object of type MoufMethod that represents the constructor of this
 * class.
 */
MoufClass.prototype.getConstructor = function() {
	for ( var i = 0; i < this.methods.length; i++) {
		var method = this.methods[i];
		if (method.isConstructor()) {
			return method;
		}
	}
	return null;
}

/**
 * Returns the list of interfaces implemented by this class (and its parent
 * classes).
 */
MoufClass.prototype.getImplementedInterfaces = function() {
	return this.json["implements"];
}

/**
 * Let's define the MoufProperty class, that defines a PHP field in a class
 * (does not have to have the @Property annotation)
 */
var MoufProperty = function(json) {
	this.json = json;
	this.types = new MoufTypes(json['types']);
}

/**
 * Returns the name of the property.
 */
MoufProperty.prototype.getName = function() {
	return this.json['name'];
}

/**
 * Returns the comment of the property.
 */
MoufProperty.prototype.getComment = function() {
	return this.json['comment']['comment'];
}

/**
 * Retrieves the annotations of the property, as a JSON object: {
 * "annotationName", [param1, param2....] } There are as many params as there
 * are annotations
 */
MoufProperty.prototype.getAnnotations = function() {
	return this.json['comment']['annotations'];
}

/**
 * Returns true if the property has a default value.
 */
MoufProperty.prototype.hasDefault = function() {
	return typeof (this.json['default']) != "undefined";
}

/**
 * Returns the default value of the property.
 */
MoufProperty.prototype.getDefault = function() {
	return this.json['default'];
}

/**
 * Returns true if this property has the
 * 
 * @Property annotation.
 */
MoufProperty.prototype.hasPropertyAnnotation = function() {
	return this.json['moufProperty'];
}

/**
 * Returns the name of the property (if this method has a
 * 
 * @Property annotation).
 */
MoufProperty.prototype.getPropertyName = function() {
	return this.json['name'];
}

/**
 * Returns the type of the property (as defined in the
 * 
 * @var annotation).
 */
MoufProperty.prototype.getTypes = function() {
	return this.types;
}

/**
 * Returns the type of the array's value if the type of the annotation is an
 * array (as defined in the
 * 
 * @var annotation).
 */
/*MoufProperty.prototype.getSubType = function() {
	return this.json['subtype'];
}*/

/**
 * Returns the type of the array's key if the type of the annotation is an
 * associative array (as defined in the
 * 
 * @var annotation).
 */
/*MoufProperty.prototype.getKeyType = function() {
	return this.json['keytype'];
}*/

/**
 * Returns true if the type of the property is an array.
 */
/*MoufProperty.prototype.isArray = function() {
	return this.json['type'] == 'array';
}*/

/**
 * Returns true if the type of the property is an associative array.
 */
MoufProperty.prototype.isAssociativeArray = function() {
	return (this.json['type'] == 'array' && this.json['keytype']);
}

/**
 * Returns null (a property has no parent, only sub-properties have parents).
 */
MoufProperty.prototype.getParent = function() {
	return null;
}

/**
 * Returns the MoufInstanceProperty of a property for the instance passed in
 * parameter (available if this property has a @Property annotation)
 */
MoufProperty.prototype.getMoufInstanceProperty = function(instance) {
	return instance.getPublicProperty(this.json['name']);
}

/**
 * Returns the value of a property for the instance passed in parameter
 * (available if this property has a
 * 
 * @Property annotation)
 */
MoufProperty.prototype.getValueForInstance = function(instance) {
	return instance.getPublicProperty(this.json['name']).getValue();
}

/**
 * Let's define the MoufMethod class, that defines a PHP method in a class (does
 * not have to have the
 * 
 * @Property annotation)
 */
var MoufMethod = function(json) {
	this.json = json;
	this.parameters = [];
	this.parametersByName = {};
	this.types = new MoufTypes(json['types']);
	var jsonParameters = this.json["parameters"];
	for ( var i = 0; i < jsonParameters.length; i++) {
		var parameter = new MoufParameter(jsonParameters[i], this);
		this.parameters.push(parameter);
		this.parametersByName[parameter.getName()] = parameter;
	}
}

/**
 * Returns the name of the method.
 */
MoufMethod.prototype.getName = function() {
	return this.json['name'];
}

/**
 * Returns the modifier of the method (can be public, protected, private)
 */
MoufMethod.prototype.getModifier = function() {
	return this.json['modifier'];
}

/**
 * Returns whether the method is static or not
 */
MoufMethod.prototype.isStatic = function() {
	return this.json['static'];
}

/**
 * Returns whether the method is abstract or not
 */
MoufMethod.prototype.isAbstract = function() {
	return this.json['abstract'];
}

/**
 * Returns whether the method is a constructor or not
 */
MoufMethod.prototype.isConstructor = function() {
	return this.json['constructor'];
}

/**
 * Returns whether the method is final or not
 */
MoufMethod.prototype.isFinal = function() {
	return this.json['final'];
}

/**
 * Returns the method comments
 */
MoufMethod.prototype.getComment = function() {
	return this.json['comment']['comment'];
}

/**
 * Retrieves the annotations of the method, as a JSON object: {
 * "annotationName", [param1, param2....] } There are as many params as there
 * are annotations
 */
MoufMethod.prototype.getAnnotations = function() {
	return this.json['comment']['annotations'];
}

/**
 * Returns true if this property has the
 * 
 * @Property annotation.
 */
MoufMethod.prototype.hasPropertyAnnotation = function() {
	return this.json['moufProperty'];
}

/**
 * Returns the type of the property (as defined in the @var annotation).
 */
MoufMethod.prototype.getTypes = function() {
	return this.types;
}

/**
 * Returns null (a method has no parent, only sub-properties have parents).
 */
MoufMethod.prototype.getParent = function() {
	return null;
}

/**
 * Returns the name of the property (if this method has a
 * 
 * @Property annotation).
 */
MoufMethod.prototype.getPropertyName = function() {
	var methodName = this.json['name'];
	if (methodName.indexOf("set") !== 0) {
		throw "Error while creating MoufPropertyDescriptor. A @Property annotation must be set to methods that start with 'set'. For instance: setName, and setPhone are valid @Property setters. "
				+ methodName + " is not a valid setter name.";
	}
	propName1 = methodName.substr(3);
	if (propName1 == "") {
		throw "Error while creating MoufPropertyDescriptor. A @Property annotation cannot be put on a method named 'set'. It must be put on a method whose name starts with 'set'. For instance: setName, and setPhone are valid @Property setters.";
	}
	propName2 = propName1.substr(0, 1).toLowerCase() + propName1.substr(1);
	return propName2;
}

/**
 * Returns the MoufInstanceProperty of a property for the instance passed in
 * parameter (available if this property has a
 * 
 * @Property annotation)
 */
MoufMethod.prototype.getMoufInstanceProperty = function(instance) {
	return instance.getSetter(this.json['name']);
}

/**
 * Returns the value of a property for the instance passed in parameter
 * (available if this method has a
 * 
 * @Property annotation)
 */
MoufMethod.prototype.getValueForInstance = function(instance) {
	return instance.getSetter(this.json['name']).getValue();
}

/**
 * Returns an array of objects of type MoufInstanceProperty that represents the
 * property of this instance.
 */
MoufMethod.prototype.getParameters = function() {
	return this.parameters;
}

/**
 * Returns an object of type MoufInstanceProperty that represents the property
 * of this instance.
 */
MoufMethod.prototype.getParameter = function(propertyName) {
	return this.parametersByName[propertyName];
}

/**
 * Let's define the MoufParameter class, that defines a PHP parameter in a
 * method.
 */
var MoufParameter = function(json, parentMethod) {
	this.json = json;
	this.types = new MoufTypes(json['types']);
	this.parentMethod = parentMethod;
}

/**
 * Returns the name of the parameter.
 */
MoufParameter.prototype.getName = function() {
	return this.json['name'];
}

/**
 * Returns whether the parameter has a default value.
 */
MoufParameter.prototype.hasDefault = function() {
	return this.json['hasDefault'];
}

/**
 * Returns the default value.
 */
MoufParameter.prototype.getDefault = function() {
	return this.json['default'];
}

/**
 * Returns whether the parameter is typed as an array.
 */
/*MoufParameter.prototype.isArray = function() {
	return (this.json['type'] == 'array');
}*/

/**
 * Returns true if the type of the property is an associative array.
 */
/*MoufParameter.prototype.isAssociativeArray = function() {
	return (this.json['type'] == 'array' && this.json['keytype']);
}*/

/**
 * Returns the class name of the parameter, if any.
 */
MoufParameter.prototype.getClassName = function() {
	return this.json['class'];
}

/**
 * Returns the name of the parameter.
 */
MoufParameter.prototype.getPropertyName = function() {
	return this.getName();
}

/**
 * Returns the type of the parameter (the class, if any)
 */
MoufParameter.prototype.getTypes = function() {
	return this.types;
}

/**
 * Returns the type of the array's value if the type of the parameter is an
 * array (as defined in the
 * 
 * @var annotation).
 */
/*MoufParameter.prototype.getSubType = function() {
	return this.json['subtype'];
}*/

/**
 * Returns the type of the array's key if the type of the parameter is an
 * associative array (as defined in the
 * 
 * @var annotation).
 */
/*MoufParameter.prototype.getKeyType = function() {
	return this.json['keytype'];
}*/

/**
 * Returns the MoufInstanceProperty of a property for the instance passed in
 * parameter (available if this property has a
 * 
 * @Property annotation)
 */
MoufParameter.prototype.getMoufInstanceProperty = function(instance) {
	return instance.getConstructorArgument(this.json['name']);
}

/**
 * Returns null (a parameter has no parent, only sub-properties have parents).
 */
MoufParameter.prototype.getParent = function() {
	return null;
}

/**
 * Returns the value of a property for the instance passed in parameter
 * (available if this property has a
 * 
 * @Property annotation)
 */
MoufParameter.prototype.getValueForInstance = function(instance) {
	return instance.getConstructorArgument(this.json['name']).getValue();
}

/**
 * A parameter cannot have a set of annotations, but we return the annotations
 * of the method it belongs to: { "annotationName", [param1, param2....] } There
 * are as many params as there are annotations
 */
MoufParameter.prototype.getAnnotations = function() {
	return this.parentMethod.getAnnotations();
}

/**
 * Returns the param comments
 */
MoufParameter.prototype.getComment = function() {
	return this.json["comment"];
}

/**
 * The MoufInstanceSubProperty is an object designed to allow easy usage of
 * field renderers in an array. An array has its own field renderer. The array
 * field renderer itself calls field renderers for each value to renderer,
 * passing the MoufInstanceSubProperty object (instead of the
 * MoufInstanceProperty object)
 */
var MoufInstanceSubProperty = function(moufInstanceProperty, key, value, subType) {
	this.subProperty = true;
	this.parentMoufInstanceProperty = moufInstanceProperty;
	this.key = key;
	this.value = value;
	this.type = subType;
	this.moufSubProperty = new MoufSubProperty(this.parentMoufInstanceProperty
			.getMoufProperty(), this.key, this);
}

/**
 * Returns the parent MoufInstanceSubProperty.
 */
MoufInstanceSubProperty.prototype.getParent = function() {
	return this.parentMoufInstanceProperty;
}

/**
 * Returns the key for this sub property.
 */
MoufInstanceSubProperty.prototype.getKey = function() {
	return this.key;
}

/**
 * Returns the current MoufType for this sub property.
 */
MoufInstanceSubProperty.prototype.getType = function() {
	return this.type;
}

/**
 * Sets the key for this sub property, and triggers a save.
 */
MoufInstanceSubProperty.prototype.setKey = function(key) {
	this.key = key;
	// Let's trigger listeners
	// MoufInstanceManager.firePropertyChange(this.getInstance().getProperty(this.getName()));
	MoufInstanceManager.firePropertyChange(this.parentMoufInstanceProperty);
}

/**
 * Returns the name for this property.
 */
MoufInstanceSubProperty.prototype.getName = function() {
	return this.parentMoufInstanceProperty.getName();
}

/**
 * Returns the value for this property.
 */
MoufInstanceSubProperty.prototype.getValue = function() {
	return this.value;
}

/**
 * Returns the origin for this property.
 */
MoufInstanceSubProperty.prototype.getOrigin = function() {
	return this.parentMoufInstanceProperty.getOrigin();
}

/**
 * Returns the metadata for this property.
 */
MoufInstanceSubProperty.prototype.getMetaData = function() {
	return this.parentMoufInstanceProperty.getMetaData();
}

/**
 * Returns a MoufProperty or a MoufMethod object representing the class
 * property/method that holds the
 * 
 * @Property annotation.
 */
MoufInstanceSubProperty.prototype.getMoufProperty = function() {
	return this.moufSubProperty;
}

/**
 * Returns the instance this property is part of.
 */
MoufInstanceSubProperty.prototype.getInstance = function() {
	return this.parentMoufInstanceProperty.getInstance();
}

/**
 * Saves the value for this sub property, and triggers a change
 */
MoufInstanceSubProperty.prototype.setValue = function(value) {
	this.value = value;
	// Let's trigger listeners
	// MoufInstanceManager.firePropertyChange(this.getInstance().getProperty(this.getName()));
	MoufInstanceManager.firePropertyChange(this.parentMoufInstanceProperty);

}

/**
 * The MoufSubProperty is an object designed to allow easy usage of field
 * renderers in an array. An array has its own field renderer. The array field
 * renderer itself calls field renderers for each value to renderer, passing the
 * MoufSubProperty object (instead of the MoufProperty object)
 * 
 * @param moufProperty
 * @param key
 * @returns
 */
var MoufSubProperty = function(moufProperty, key, moufInstanceSubProperty) {
	this.subProperty = true;
	this.parentMoufProperty = moufProperty;
	this.key = key;
	this.moufInstanceSubProperty = moufInstanceSubProperty;
}

/**
 * Returns the name of the property.
 */
MoufSubProperty.prototype.getName = function() {
	return this.parentMoufProperty.getName();
}

/**
 * Returns the comment of the property.
 */
MoufSubProperty.prototype.getComment = function() {
	return this.parentMoufProperty.getComment();
}

/**
 * Retrieves the annotations of the property, as a JSON object: {
 * "annotationName", [param1, param2....] } There are as many params as there
 * are annotations
 */
MoufSubProperty.prototype.getAnnotations = function() {
	return this.parentMoufProperty.getAnnotations();
}

/**
 * Returns true if the property has a default value.
 */
MoufSubProperty.prototype.hasDefault = function() {
	return this.parentMoufProperty.hasDefault();
}

/**
 * Returns the default value of the property.
 */
MoufSubProperty.prototype.getDefault = function() {
	return this.parentMoufProperty.getDefault();
}

/**
 * Returns true if this property has the
 * 
 * @Property annotation.
 */
MoufSubProperty.prototype.hasPropertyAnnotation = function() {
	return this.parentMoufProperty.hasPropertyAnnotation();
}

/**
 * Returns the name of the property (if this method has a
 * 
 * @Property annotation).
 */
MoufSubProperty.prototype.getPropertyName = function() {
	return this.parentMoufProperty.getPropertyName();
}

/**
 * Returns the type of the property (as defined in the
 * 
 * @var annotation).
 */
MoufSubProperty.prototype.getType = function() {
	return this.parentMoufProperty.getSubType();
}

/**
 * Returns the type of the array's value if the type of the annotation is an
 * array (as defined in the
 * 
 * @var annotation).
 */
MoufSubProperty.prototype.getSubType = function() {
	return null;
}

/**
 * Returns the type of the array's key if the type of the annotation is an
 * associative array (as defined in the
 * 
 * @var annotation).
 */
MoufSubProperty.prototype.getKeyType = function() {
	return null;
}

/**
 * Returns true if the type of the property is an array.
 */
MoufSubProperty.prototype.isArray = function() {
	return this.getType() == 'array';
}

/**
 * Returns true if the type of the property is an associative array.
 */
MoufSubProperty.prototype.isAssociativeArray = function() {
	return false;
}

/**
 * Returns the parent property of this sub-property.
 */
MoufSubProperty.prototype.getParent = function() {
	return this.parentMoufProperty;
}

/**
 * Returns the MoufInstanceSubProperty of a property for the instance passed in
 * parameter (available if this property has a
 * 
 * @Property annotation)
 */
MoufSubProperty.prototype.getMoufInstanceProperty = function(instance) {
	return this.moufInstanceSubProperty;
}

/**
 * Returns the value of a property for the instance passed in parameter
 * (available if this property has a
 * 
 * @Property annotation)
 */
MoufSubProperty.prototype.getValueForInstance = function(instance) {
	// FIXME: does not work anymore!
	var values = this.parentMoufProperty.getValueForInstance(instance);
	return values[this.key];
}

/**
 * Let's define the MoufTypes class, that defines the list of
 * types a property can have.
 */
var MoufTypes = function(json) {
	this.json = json;
	var types = [];
	if (json) {
	_.each(json['types'], function(
			jsonType) {
		types.push(new MoufType(jsonType));
	});
	}
	this.types = types;
}

/**
 * Returns the list of allowed types.
 */
MoufTypes.prototype.getTypes = function() {
	return this.types;
}

/**
 * Returns a warning message, if any.
 */
MoufTypes.prototype.getWarningMessage = function() {
	return this.json['warning'];
}

/**
 * Find a type and returns the type
 * @param MoufType
 */
MoufTypes.prototype.findType = function(type) {
	var found = null;
	_.each(this.types, function(elem) {
		if (elem.equals(type)) {
			found = elem;
		}
	})
	return found;
}

/**
 * Converts this MoufTypes into its json representation.
 * @return Object
 */
MoufTypes.prototype.toJson = function() {
	// Since MoufTypes is immutable, we can directly return the json that was used to create it.
	return this.json;
}

/**
 * Let's define one type for a property.
 */
var MoufType = function(json) {
	this.json = json;
	if (this.json['subType']) {
		this.subType = new MoufType(this.json['subType']);
	} else {
		this.subType = null;
	}
}

/**
 * Returns the main type of this type as a string.
 */
MoufType.prototype.getType = function() {
	return this.json['type'];
}

/**
 * Returns the key type of this type as a string.
 */
MoufType.prototype.getKeyType = function() {
	return this.json['keyType'];
}

/**
 * Returns the key type of this type as a string.
 */
MoufType.prototype.getSubType = function() {
	return this.subType;
}

/**
 * Returns true if the type of the property is an array.
 */
MoufType.prototype.isArray = function() {
	return this.json['type'] == 'array';
}

/**
 * Returns true if the type is an associative array.
 */
MoufType.prototype.isAssociativeArray = function() {
	return (this.json['type'] == 'array' && this.json['keyType']);
}

/**
 * Returns true if this type and passed type are equals.
 */
MoufType.prototype.equals = function(type) {
	if (type == null) {
		return false;
	}
	if (this.getType() != type.getType()) {
		return false;
	}
	if (this.getKeyType() != type.getKeyType()) {
		return false;
	}
	if (this.getSubType() == null && type.getSubType() == null) {
		return true;
	}
	return this.getSubType().equals(type.getSubType());
}

/**
 * Returns the string representation of this type.
 */
MoufType.prototype.toString = function() {
	var typeText = this.getType();
	if (this.getSubType()) {
		typeText += "<";
		if (this.getKeyType()) {
			typeText += this.getKeyType() + ",";
		}
		typeText += this.getSubType().toString() + ">";
	}
	return typeText;
}

/**
 * Converts this MoufType into its json representation.
 * @return Object
 */
MoufType.prototype.toJson = function() {
	// Since MoufTypes is immutable, we can directly return the json that was used to create it.
	return this.json;
}
