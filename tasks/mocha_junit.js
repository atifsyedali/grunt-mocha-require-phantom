/**
 * Mocha to JUnit test result xml integration
 */

var fs= require("fs");
var XMLBuilder= require("./xml_builder");

module.exports = MochaJUnit;

function MochaJUnit() {
	'use strict';
	this._testRun= { testResult: { suites: [] } };
	this._currentSuite= null;
	this._currentTest= null;
	this._stack= null;
	this._outNum= 0;
}

MochaJUnit.prototype.bind= function(phantomjs) {

	phantomjs.on('mocha.start', _bind(function(msg) {
		this._currentSuite= null;
		this._currentTest= null;
		this._stack= [];
	}, this));
	
	phantomjs.on('mocha.suite', _bind(function(msg) {
		this._currentSuite= { name: msg.title, tests: [], failures: 0, start: Date.now() };
		this._stack.push(this._currentSuite);
		this._testRun.testResult.suites.push(this._currentSuite);
	}, this));

	phantomjs.on('mocha.test', _bind(function(msg) {
		this._currentTest= { name: msg.title, passed: true, start: Date.now() }
		this._currentSuite.tests.push(this._currentTest);
	}, this));
	
	phantomjs.on('mocha.fail', _bind(function(msg) {
		this._currentTest.passed= false;
		this._currentTest.error= msg.err.stack || msg.err.message;
		this._currentTest.expected= msg.err.expected;
		this._currentTest.actual= msg.err.actual;
		this._currentSuite.failures++;
	}, this));

	phantomjs.on('error', _bind(function(msg) {
		this._fail();
		this._currentTest.passed= false;
		this._currentTest.error= msg;
		this._currentSuite.failures++;
	}, this));

	phantomjs.on('fail.load', _bind(function(msg) {
		this._fail();
		this._currentTest.passed= false;
		this._currentTest.error= msg;
		this._currentSuite.failures++;
	}, this));

	phantomjs.on('fail.timeout', _bind(function(msg) {
		this._fail();
		this._currentTest.passed= false;
		this._currentTest.error= "PhantomJS timed out.";
		this._currentSuite.failures++;
	}, this));

	phantomjs.on('mocha.pass', function(msg) {});

	phantomjs.on('mocha.test end', _bind(function(msg) {
		this._currentTest.end= Date.now();
		this._currentTest.time= (this._currentTest.end - this._currentTest.start) / 1000;
		this._currentTest= null;
	}, this));

	phantomjs.on('mocha.suite end', _bind(function(msg) {
		this._currentSuite.end= Date.now();
		this._currentSuite.time= (this._currentSuite.end - this._currentSuite.start) / 1000;
		this._currentSuite= this._stack.pop();
	}, this));

	phantomjs.on('mocha.end', function(msg) {});
}

MochaJUnit.prototype.save= function(folder) {
	if (!fs.existsSync(folder)) {
		fs.mkdirSync(folder);
	}
	fs.writeFileSync(folder + "/test_" + (this._outNum++) + ".xml", this._serialize(this._testRun));
}

MochaJUnit.prototype._fail= function() {
	if (this._currentSuite == null || this._currentSuite.name == null || this._currentSuite.name == "") {
		this._currentSuite= { name: "Unknown Suite", tests: [], failures: 0, start: Date.now(), end: Date.now(), time: 0 };
		this._testRun.testResult.suites.push(this._currentSuite);	
	}
	this._currentTest= { name: "Runtime Error", passed: false, start: Date.now(), end: Date.now(), time: 0}
	this._currentSuite.tests.push(this._currentTest);
}

MochaJUnit.prototype._serialize= function(testRun) {
	var xml= new XMLBuilder();
	var testRun= this._testRun;
	xml.tag("testsuites", null, function() {
		for(var i= 0; i < testRun.testResult.suites.length; i++) {
			var suite= testRun.testResult.suites[i];
			if (suite.tests.length == 0) {
				continue;
			}
			xml.tag("testsuite", {name: suite.name, tests: suite.tests.length, failures: suite.failures, time: suite.time}, function() {
				for (var j= 0; j < suite.tests.length; j++) {
					var test= suite.tests[j];
					xml.tag("testcase", {name: test.name, status: (test.passed ? "Passed" : "Failed"), time: test.time}, function() {
						if (!test.passed) {
							xml.tag("failure", null, function() {
								if (test.expected != null) {
									xml.tag("expected", null, function() {xml.text(test.expected)}, true);
								}
								if (test.actual != null) {
									xml.tag("actual", null, function() {xml.text(test.actual)}, true);
								}
								xml.text(test.error);
							}, true);
						}
					});
				};
			});
		}
	});
	
	return xml.toString();
}

var _bind= function(func, self) {
	return function() {
		return func.apply(self, Array.prototype.slice.call(arguments, 0));
	}
}
