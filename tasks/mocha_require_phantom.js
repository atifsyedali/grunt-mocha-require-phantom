/*
 * grunt-mocha-require-phantom
 * https://github.com/accordionpeas/grunt-mocha-require-phantom
 *
 */

module.exports = function(grunt) {

	'use strict';

	var fs = require('fs'),
		path = require('path'),
		colors = require('colors'),
		express = require('express'),
		server = express(),
		phantomjs = require('grunt-lib-phantomjs').init(grunt);

	grunt.registerMultiTask('mocha_require_phantom', 'Grunt plugin for testing requireJS code using mocha in phantomJS and regular browsers', function() {

		colors.setTheme({
			title: 'white',
			info: 'green',
			data: 'grey',
			error: 'red',
			warn: 'yellow',
			log: 'cyan'
		});

		var options = this.options({
				base: '',
				main: 'test-bootstrap',
				setup: '',
				requireLib: 'require.js',
                files: [],
				port: 3000,
				keepAlive: false,
			}),
			tempDirectory = 'tmp',
			done = this.async(),
			files = [],
			count = 0,
			errorCount = 0,
			passCount = 0,
			suiteLevel = 0;

		var cmdOptFiles = grunt.option('files');

		if(cmdOptFiles){
			cmdOptFiles = cmdOptFiles.split(',');
			for(var i=0; i<cmdOptFiles.length; i++){
				files.push(options.base + '/' + cmdOptFiles[i]);
			}
		}
		else{
			files = grunt.file.expand(options.base + '/' + options.files);
		}

		var basePath = options.base,
			main = basePath + '/' + options.main,
			requireLib = basePath + '/' + options.requireLib,
			setup = basePath + '/' + options.setup,
			scriptRef = '<scr'+'ipt data-main="/' + main + '" src="/' + requireLib + '"></scr'+'ipt>' + '<scr'+'ipt src="/' + setup + '"></scr'+'ipt>';
		
		function launchServer(){
			server.use(express.static(path.resolve('.')));
			server.get('/**', function(req, res){
				
				var file = options.basePathForTests + req.url;
				fs.exists(file, function(exists) {						
					if (exists) {
						res.end(grunt.file.read(file, {
							encoding: 'utf8'
						}));
					} else {
						if (req.url.indexOf(options.basePathForTests) >= 0) {
							var url = req.url;
							if (req.url.lastIndexOf('.') < req.url.lastIndexOf('/')) {
								url += '.js';
							}
							
							if (url.charAt(0) === '/') {
								url = url.substring(1, url.length);
							}
							
							fs.exists(url, function(exists) {						
								if (exists) {
									res.end(grunt.file.read(url, {
										encoding: 'utf8'
									}));
								} else {
									res.status(404).end();
								}
							});
						} else if(req.url.indexOf('.') === -1 || req.url.lastIndexOf('.') < req.url.lastIndexOf('/')){
							// the second condition takes care of relative paths like ../test.js vs ../test
							
							file = req.url;
							if (file.indexOf(options.basePathForTests) == -1) {
								file = options.basePathForTests + file + '.js';
							}
							
							fs.exists(file, function(exists) {						
								if (exists) {
									copyFiles(function() {
										writeBootstrap(file, function() {
											res.end(grunt.file.read(tempDirectory + '/index.html', {
												encoding: 'utf8'
											}));
										});				
									});
								} else {
									res.status(404).end();
								}
							});
						} else {
							res.status(404).end();
						}
					}
				});
					
				
			});

			server.listen(options.port);
			
			if (options.keepAlive) {
				grunt.log.writeln('\n\nGo to http://localhost:' + options.port + '/{pathToTest} to debug your test in the web browser. For example, go to http://localhost:' + options.port + '/example/example1');
			}
		}

		function writeBootstrap(file, success){
			var scriptInc = 'var testPathname = "/' + file + '";';
			fs.writeFile(tempDirectory + '/include.js', scriptInc + '\ndocument.write(\'' + scriptRef + '\');', {
				encoding: 'utf8'
			}, success);
		}

		function spawn(){
			var file = files[count];

			grunt.log.writeln('\n\nTesting: ' + file);

			writeBootstrap(file, function() {

				phantomjs.spawn('http://localhost:' + options.port + '/' + tempDirectory + '/index.html', {
					options: {},
					done: function(err) {
						count++;

						if(count === files.length){
							if(errorCount > 0){
								grunt.fail.warn(errorCount + ' tests failed');
							}
							clean();

							//will keep server running forever - good times!
							if(!options.keepAlive){
								done(err || errorCount === 0);
							}
						}
						else{
							spawn();
						}
					}
				});
			});

		}

		function bindPhantomListeners(){
			phantomjs.on('mocha.*', function(msg){

				var name, fullTitle, slow, err,
				evt = this.event.replace('mocha.', '');

				if(evt === 'suite'){
					var title = msg.title;
					if(title){
						writeIndented(title, suiteLevel);
						suiteLevel++;
					}
					passCount = 0;
				}
				else if(evt === 'fail'){
					writeIndented(msg.title.error, suiteLevel);
					writeIndented(msg.err.message.warn, suiteLevel);
					errorCount++;
				}
				else if(evt === 'pass'){
					writeIndented(msg.title.data, suiteLevel);
					passCount++;
				}
				else if(evt === 'suite end'){
					if(msg.title){
						writeIndented(passCount + ' passed'.info, --suiteLevel);
					}
				}
				else if (evt === 'end'){
					phantomjs.halt();
				}

			});

			phantomjs.on('log', function(msg){
				console.log(msg.log);
			});
			
			phantomjs.on('error', function(msg){
				grunt.fail.warn(msg);
			});

			// Built-in error handlers.
			phantomjs.on('fail.load', function(url) {
				phantomjs.halt();
				grunt.warn('PhantomJS unable to load URL.');
			});

			phantomjs.on('fail.timeout', function() {
				phantomjs.halt();
				grunt.warn('PhantomJS timed out.');
			});
		}

		function clean(){
			grunt.file.delete(tempDirectory);
		}

		function writeIndented(msg, tabLevel){
			var tab = '';
			for(var i=0; i<tabLevel; i++){
				tab += '  ';
			}
			grunt.log.writeln(tab + msg);
		}

		function copyFiles(success){			
			var writeBridgeJs = function(err, data) {
				if (err) throw err;
				fs.writeFile(tempDirectory + '/bridge.js', data, success);
			};
			
			var readBridge = function() {
				fs.readFile(__dirname + '/../lib/bridge.js', writeBridgeJs);
			};
			
			var writeMochaJs = function(err, data) {
				if (err) throw err;
				fs.writeFile(tempDirectory + '/mocha.js', data, readBridge);
			};
			
			var readMochaJs = function() {
				fs.readFile(__dirname + '/../node_modules/mocha/mocha.js', writeMochaJs);
			};
			
			var writeMochaCss = function(err, data) {
				if (err) throw err;
				fs.writeFile(tempDirectory + '/mocha.css', data, readMochaJs);
			};
			
			var readMochaCss = function() {
				fs.readFile(__dirname + '/../node_modules/mocha/mocha.css', writeMochaCss);
			};
			
			var writeIndex = function(err, data) {
				if (err) throw err;
				fs.writeFile(tempDirectory + '/index.html', data, readMochaCss);
			};
			
			var readIndex = function() {
				fs.readFile(__dirname + '/../lib/index.html', writeIndex);
			};
			
			var createDir = function() {
				fs.mkdir(tempDirectory, readIndex);
			};
			
			fs.rmdir(tempDirectory, createDir);
		}

		if(files.length){
			if(!options.keepAlive){
				launchServer();
				copyFiles(function() {
					bindPhantomListeners();
					spawn();
				});
			} else {
				launchServer();
			}
		}
		else{
			//no files to test.
			done();
		}
	});

};
