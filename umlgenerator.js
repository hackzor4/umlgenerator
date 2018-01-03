var Promise = require('bluebird');
// var shell = require('shelljs');
var exec = require('child-process-promise').exec;

var date = new Date();
var hours = date.getHours();
var year = date.getFullYear();
var month = date.getMonth() +1;
var day = date.getDate();
var minutes = date.getMinutes();
var resultsDate = year + "_" + month + "_" + day + "_" + hours + "_" + minutes;

var BIM = { files : {},
};

function addNewFileModule(file, type) {
    if (!BIM.files.hasOwnProperty(file)) {
        BIM.files[file] =
        {
            "all_functions" : [],
            "all_requires" : [],
            "properties" : {
            "file_type" : type
        }
        };
    };
}

function storeAllFilesAndFunctions(stdout) {
    // console.log("Error: %s\nStderr: %s\nStdout: %s\n", error, stderr, stdout);
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

function storeAllFilesAndRequires(stdout) {
    // console.log("Error: %s\nStderr: %s\nStdout: %s\n", error, stderr, stdout);
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
        var newName = getModuleCompleteName(file1);
        obj["absoluteNameOfRequire"] = newName;
        obj["absoluteNameOfRequirwrw"] = "trilii";

        BIM.files[file1].all_requires.push(obj);

        //check if module require is from current code (file_type = internal) or not - will be added as file_type=external
        verifyAndAddRequireModule(nameOfRequire2, newName);

    });
    //displayAllBIM();
    return "done";
}

function verifyAndAddRequireModule(module, moduleCompleteName) {
    console.log("Checking if module is new: %s", module);

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
            //var moduleCompleteName = getModuleCompleteName(module);
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

    Object.keys(BIM.files).some(function(el) {
        console.log("Checking if: %s can be found in: %s!", newName, el);
        return el.indexOf(newName)>-1;
    })?console.log(">>> FOUND"):console.log("... not FOUND");
}

function displayAllBIM() {
    console.log(">>>>>>>>>>> The BIM: \n", JSON.stringify(BIM, null, 4));
}

function generateResults(){
    console.log("Generating results ....");
    console.log(resultsDate.toString());
    exec("mkdir result_" + resultsDate);
}

function main (){
    if (process.argv.length <= 2) {
        console.log("Please enter the path");
        process.exit(-1);
    }
    var param = process.argv[2];
    BIM.path = param;

    exec("find " + BIM.path + " -type f -name \"*.js\" | xargs grep -i \"^function \"")
        .then(function (result) {
            var stdout = result.stdout;
            // console.log(stdout);
            storeAllFilesAndFunctions(stdout);
        })
        //.then(displayAllBIM)
        .then(function (result) {
            return exec("find " + BIM.path + " -type f -name \"*.js\" | xargs grep -i \"require(\"");
        })
        .then(function (result) {
            var stdout = result.stdout;
            // console.log(stdout);
            storeAllFilesAndRequires(stdout);
        })
        .then(displayAllBIM)
        .catch(function (err) {
            console.error('ERROR: ', err);
        });;

}

main();











