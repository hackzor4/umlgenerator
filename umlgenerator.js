var Promise = require('bluebird');
var exec = require('child-process-promise').exec;
var fs = require('fs');
var _ = require('underscore');

var date = new Date();
var hours = date.getHours();
var year = date.getFullYear();
var month = date.getMonth() +1;
var day = date.getDate();
var minutes = date.getMinutes();
var resultsDate = year + "_" + month + "_" + day + "_" + hours + "_" + minutes;
var folder_name = resultsDate.toString();

var BIM = { files : {},
};

function addNewFileModule(file, type) {
	console.log("Add new file module: %s", file);
    if (!BIM.files.hasOwnProperty(file)) {
        BIM.files[file] =
        {
            "all_functions" : [],
            "all_requires" : [],
            "all_exports" : [],
            "properties" : {
            "file_type" : type
        }
        };
    };
}

function storeAllFilesAndFunctions(stdout) {
    stdout.split("\n").slice(0, -1).forEach(function(element) {
        // console.log("Line: %s", element);
        var array = element.split(':'),
            file = array[0], func = array[1];
        file1 = file.replace(/\//gi,"_").replace(/^\.\./gi, "").replace(/\.js$/gi, "").replace(/^_/,"");
        func1 = func.slice(0, func.indexOf("(")).replace(/^function /, "");

        addNewFileModule(file1, "internal");

        BIM.files[file1].all_functions.push(func1);
    });
};


function storeAllFilesAndExports(stdout) {

    // example lines:
    // ../TSR/racoam/src/5g/5gController.js:module.exports.initialize = initialize;
    // ../TSR/racoam/src/5g/5gController.js:module.exports.teardown = teardown;
    // ../TSR/racoam/src/5g/5gController.js:module.exports.blockCell = blockCell;
    // ../TSR/racoam/src/5g/5gController.js:module.exports.unblockCell = unblockCell;
    // ../TSR/racoam/src/5g/5gController.js:module.exports.handleLinkStatus = handleLinkStatus;
    // ../TSR/racoam/src/ChecksumError.js:module.exports = ChecksumError;

    stdout.split("\n").slice(0, -1).forEach(function(element) {
            var element_array = element.split(':'),
                file = element_array[0],
                func = element_array[1];
            file_name = file.replace(/\//gi, "_").replace(/^\.\./gi, "").replace(/\.js$/gi, "").replace(/^_/, "");
            function_name = func.split('exports');
            aux = function_name[1].split('=');
            export_name = aux[0].replace(/\s/g, '').replace(/\./gi, "");


            addNewFileModule(file_name, "internal");

            BIM.files[file_name].all_exports.push(export_name);
    });
};


function storeAllFilesAndRequires(stdout) {

    stdout.split("\n").slice(0, -1).forEach(function(element) {
        console.log("Line: %s", element);
        var array = element.split(':');

        file = array[0];
        nameOfRequire = array[1] + ((array[2]===undefined)?"":array[2]);
        file1 = file.replace(/\//gi,"_").replace(/^\.\./gi, "").replace(/\.js$/gi, "").replace(/^_/,"");

        //example lines:
        //var btsUri = require("@rcp/bts-uri-utils");
        //var child_process = Promise.promisifyAll(require("child_process"));
        //"l2PsDebugLogCtrl": require("./laOperationHandlers/l2DebugLogHandler")
        //promisifyAll(require("node-json-rpc"));

        //console.log(">>>>nameOfRequire: \"%s\", index: %d, length: %d!", nameOfRequire, nameOfRequire.indexOf("require(\""), nameOfRequire.length);
        nameOfRequire1 = nameOfRequire.slice(nameOfRequire.indexOf("require(\"") + 9, nameOfRequire.length);
        nameOfRequire2 = nameOfRequire1.slice(0, nameOfRequire1.indexOf("\""));
        //console.log("File is: %s, require is: 0: %s. 1: %s, 2:%s!", file1, nameOfRequire, nameOfRequire1, nameOfRequire2);

        addNewFileModule(file1, "internal");

        var nameOfVarRequire = "?undefined?";
        if (nameOfRequire.indexOf("var ") > -1) {
            nameOfVarRequire = nameOfRequire.slice(nameOfRequire.indexOf("var ") + 4, nameOfRequire.indexOf(" = "));
        } else {
            //to do other cases
        }

        var obj = {} ;
        obj["require"] = nameOfRequire2;
        obj["nameOfVariable"] = nameOfVarRequire;
        var newName = getModuleCompleteName(nameOfRequire2);
        obj["absoluteNameOfRequire"] = newName;
        obj["absoluteNameOfRequirwrw"] = "trilii";
	//console.log("new name is: %s for %s", newName, nameOfRequire2 );

        BIM.files[file1].all_requires.push(obj);

        //check if module require is from current code (file_type = internal) or not - will be added as file_type=external
        verifyAndAddRequireModule(nameOfRequire2, newName);

    });
}

function extendName(module) {
	return BIM.path2 + module;
}

function verifyAndAddRequireModule(module, moduleCompleteName) {
    //console.log("Checking if module is new: %s", module);

    if (module.indexOf("@") > -1) {
        //project nokia external module
        console.log("Found nokia external module: %s", module);
        addNewFileModule(module, "external");
    } else {
        // solve path to module as it could be something like:
        // "./cm/localCellQueryApi" or
        // "../../src/rcpServices/manager")
        if (module.lastIndexOf("\.") > -1) {
            //project local module name
            console.log("Found local module name: %s", module);
            var moduleCompleteName = getModuleCompleteName(module);
		console.log("123 Add new file: %s", moduleCompleteName);
		if(moduleCompleteName.indexOf(BIM.path2) === 0 ){
			moduleCompleteName = extendName(moduleCompleteName);
			console.log("456 Add new file: %s", moduleCompleteName);
		}
            addNewFileModule(moduleCompleteName, "internal");
        } else { //simple name - so node standard module
            console.log("Found node external module: %s", module);
            addNewFileModule(module, "node_external");
        }
    }
}

function transformRelativeNameToAbsoluteName(name) {
    //file.replace(/\//gi,"_").replace(/^\.\./gi, "").replace(/\.js$/gi, "").replace(/^_/,"");
    return name.slice(name.lastIndexOf("\.") + 1, name.length).replace(/\//gi, "_");
}

function getModuleCompleteName(module) {

    //tranform module name by replacing "/" with "_" and delete all .. or . before name
    // Example: "../common/networkPlanUtil" is transformed into "common_networkPlanUtil"
    // or "./util/waitFor" is transformed into "util_waitFor"
    //the name obtained like this should match at least one of the already existing BIM files/modules
    var newName = transformRelativeNameToAbsoluteName(module);
    console.log ("getModuleCompleteName for %s is %s", module, newName);
    var toReturn = newName;

    Object.keys(BIM.files).some(function(el) {
        //console.log("Checking if: %s can be found in: %s!", newName, el);
	if (el.indexOf(newName)>-1) {
		toReturn = el;
		return true;
	} else {
		return false;
	}
    }); 
    return toReturn;
}

function displayAllBIM() {
    console.log(">>>>>>>>>>> The BIM: \n", JSON.stringify(BIM, null, 4));
    return BIM;
}

function generateResults(){
    var afunc, pufunc,pvfunc;
    var index = 0;

    Object.keys(BIM.files).filter(function(element){
        return BIM.files[element].properties.file_type.indexOf('internal') == 0;
    }).forEach(function(module_name,i){
        console.log("Generating results for %s", module_name);
        index = i;

        var public_functions = [];
        var private_functions = [];


        afunc = BIM.files[module_name].all_functions;

        pufunc = BIM.files[module_name].all_exports;
        pufunc.forEach(function(element){public_functions.push("\xa0\xa0\xa0\xa0["+element+"]\n");});
        pvfunc = _.difference(afunc, pufunc).forEach(function(element){private_functions.push("\xa0\xa0\xa0\xa0["+element+"]\n");});


        var puml_code =
            "@startuml\n" +
            "\n" +
            "package \"" + module_name + "\" {\n" +
            "    package \" all_functions \" {\n" +
            // afunctions.toString().replace(/,+/g, '')+
            "    \n" +
            "    package \" public_functions \" {\n" +
            public_functions.toString().replace(/,+/g, '')+
            "    }\n" +
            "    package \" private_functions \" {\n" +
            private_functions.toString().replace(/,+/g, '')+
            "    }\n" +
            "}\n" +
            "}\n" +
            "@enduml\n";

        fs.writeFile("./result_" + folder_name + "/"+ module_name +".puml", puml_code, function(err) {
            if(err) {
                return console.log(err);
            }
        });
    });
    console.log("Generated %s files.",index);
}


function main (){
    if (process.argv.length <= 2) {
        console.log("Please enter the path");
        process.exit(-1);
    }
    var param = process.argv[2];
    BIM.path = param;
    BIM.path2 = BIM.path.replace(/\//gi, "_").replace(/^\./gi, "").replace(/^\./gi, "").replace(/_$/gi, "");

    exec("find " + BIM.path + " -type f -name \"*.js\" | xargs grep -i \"^function \"")
        .then(function (result) {
            var stdout = result.stdout;
            // console.log(stdout);
            storeAllFilesAndFunctions(stdout);
        })
        .then(function () {
            return exec("find " + BIM.path + " -type f -name \"*.js\" | xargs grep -i \"require(\"");
        })
        .then(function (result) {
            var stdout = result.stdout;
            // console.log(stdout);
            storeAllFilesAndRequires(stdout);
            return exec("find " + BIM.path + " -type f -name \"*.js\" | xargs grep -i \"module.exports.\" | grep -iv \"forTests\"");
        })
        .then(function(result){
            var stdout = result.stdout;
            storeAllFilesAndExports(stdout);
        })
        .then(displayAllBIM)
        .then(function(){
            return exec("mkdir result_" + folder_name);
        })
        .then(generateResults)
        .catch(function (err) {
            console.error('ERROR: ', err);
        });
}

main();











