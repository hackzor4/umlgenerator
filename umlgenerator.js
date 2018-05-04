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
function cleanPath(file) {
     return file.replace(/\//gi,"_").replace(/\.\._/gi, "").replace(/\.js$/gi, "").replace(/^_/,"");
}


function addNewFileModule(file, type) {
    console.log("Add new file module: %s %s", file, type);
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
        file1 = cleanPath(file);
        func1 = func.slice(0, func.indexOf("(")).replace(/^function /, "");

        //addNewFileModule(file1, "internal");
        var name = verifyAndAddRequireModule(file1);

        BIM.files[name].all_functions.push(func1);

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
        file_name = cleanPath(file);
        function_name = func.split('exports');
        aux = function_name[1].split('=');
        export_name = aux[0].replace(/\s/g, '').replace(/\./gi, "");


        // addNewFileModule(file_name, "internal");
        var name = verifyAndAddRequireModule(file1);

        BIM.files[name].all_exports.push(export_name);

    });
};


function storeAllFilesAndRequires(stdout) {

    stdout.split("\n").slice(0, -1).forEach(function(element) {
        console.log("Line: %s", element);
        var array = element.split(':');

        file = array[0];
        nameOfRequire = array[1] + ((array[2]===undefined)?"":array[2]);
        file1 = cleanPath(file);

        //example lines:
        //var btsUri = require("@rcp/bts-uri-utils");
        //var child_process = Promise.promisifyAll(require("child_process"));
        //"l2PsDebugLogCtrl": require("./laOperationHandlers/l2DebugLogHandler")
        //promisifyAll(require("node-json-rpc"));

        //console.log(">>>>nameOfRequire: \"%s\", index: %d, length: %d!", nameOfRequire, nameOfRequire.indexOf("require(\""), nameOfRequire.length);
        nameOfRequire1 = nameOfRequire.slice(nameOfRequire.indexOf("require(\"") + 9, nameOfRequire.length);
        nameOfRequire2 = nameOfRequire1.slice(0, nameOfRequire1.indexOf("\""));
        nameOfRequire2 = nameOfRequire2.replace(/\.js/, "");
        //nameOfRequire2 = cleanPath(nameOfRequire2);
        //console.log("File is: %s, require is: 0: %s. 1: %s, 2:%s!", file1, nameOfRequire, nameOfRequire1, nameOfRequire2);

        //addNewFileModule(file1, "internal");
        var fileName = verifyAndAddRequireModule(file1);

        var nameOfVarRequire = "?undefined?";
        if (nameOfRequire.indexOf("var ") > -1) {
            nameOfVarRequire = nameOfRequire.slice(nameOfRequire.indexOf("var ") + 4, nameOfRequire.indexOf(" = "));
        } else {
            //to do other cases
        }

        var obj = {} ;
        obj["require"] = nameOfRequire2;
        obj["nameOfVariable"] = nameOfVarRequire;
        var completeName = verifyAndAddRequireModule(nameOfRequire2);
        obj["absoluteNameOfRequire"] = completeName;


        BIM.files[fileName].all_requires.push(obj);

    });
}

function extendName(module) {
    return BIM.path2 + module;
}

function verifyAndAddRequireModule(module) {
    moduleCompleteName = getModuleCompleteName(module);
    console.log("Checking if module is new: %s with completeNm %s", module, moduleCompleteName);

    if (module.indexOf("@") > -1) {
        //project nokia external module

        console.log("Found nokia external module: %s", module);
        module = module.replace(/\//g, "_");
        addNewFileModule(module, "external");

    } else {
        // solve path to module as it could be something like:
        // "./cm/localCellQueryApi" or
        // "../../src/rcpServices/manager")

        if (moduleCompleteName.indexOf(BIM.path2) > -1) {
            //project local module name

            console.log("Found local module name: %s", module);
            addNewFileModule(moduleCompleteName, "internal_ext");

        } else { //simple name - so node standard module

            console.log("Found node external module: %s", module);
            addNewFileModule(module, "node_external");
        }
    }
    return moduleCompleteName;
}

function transformRelativeNameToAbsoluteName(name) {
    console.log("9999 %s", name);
    console.log("998 %s %s", name, name.slice(name.lastIndexOf("\.") + 1, name.length).replace(/\//gi, "_"));
    //name = name.replace(/\.js/, "");
    return name.slice(name.lastIndexOf("\.") + 1, name.length).replace(/\//gi, "_");
}

function getModuleCompleteName(module) {

    //tranform module name by replacing "/" with "_" and delete all .. or . before name
    // Example: "../common/networkPlanUtil" is transformed into "common_networkPlanUtil"
    // or "./util/waitFor" is transformed into "util_waitFor"
    //the name obtained like this should match at least one of the already existing BIM files/modules

    var newName = transformRelativeNameToAbsoluteName(module);
    //console.log ("111 getModuleCompleteName for %s is %s", module, newName);
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

    if (toReturn.indexOf("\_") === 0) {

        console.log ("200 getModuleCompleteName for %s is %s", module, toReturn);

        if(toReturn.indexOf(BIM.path2) === -1 ){
            toReturn = extendName(toReturn);
            console.log ("220 getModuleCompleteName for %s is %s", module, toReturn);
        }
    }

    console.log ("223 getModuleCompleteName for %s is %s", module, toReturn);

    return toReturn;
}

function displayAllBIM() {
    console.log(">>>>>>>>>>> The BIM: \n", JSON.stringify(BIM, null, 4));
    return BIM;
}

function generateResults_oneAllRequiresUmlFile() {
    var uml_file = "allRequires.puml";


    var puml_code = "@startuml\n" + "\n";

    puml_code = puml_code + "package Internal_modules \{\n"

    Object.keys(BIM.files).filter(function(element){
        return BIM.files[element].properties.file_type.indexOf('internal') == 0;
    }).forEach(function(module_name){
        puml_code = puml_code + "\[" + module_name + "\]" + "\n";
    });
    puml_code = puml_code + "\}\n\n";

    puml_code = puml_code + "package Node_external_module \{\n"
    Object.keys(BIM.files).filter(function(element){
        return BIM.files[element].properties.file_type.indexOf('node_external') == 0;
    }).forEach(function(module_name){
        puml_code = puml_code + "\[" + module_name + "\]" + "\n";
    });
    puml_code = puml_code + "\}\n\n";

    puml_code = puml_code + "package External_module \{\n"
    Object.keys(BIM.files).filter(function(element){
        return BIM.files[element].properties.file_type.indexOf('external') == 0;
    }).forEach(function(module_name){
        puml_code = puml_code + "\[" + module_name + "\]" + "\n";
    });
    puml_code = puml_code + "\}\n\n";

    Object.keys(BIM.files).filter(function(element){
        return BIM.files[element].properties.file_type.indexOf('internal') == 0;
    }).forEach(function(module_name){
        //	console.log("111 Found for module %s %j", module_name,  BIM.files[module_name].all_requires);
        BIM.files[module_name].all_requires.forEach(function(req) {
            if (linkToModuleAllowedToDisplay(req.absoluteNameOfRequire) >= 0) {
                puml_code = puml_code + "\[" + module_name + "\]-->\[" + req.absoluteNameOfRequire + "\]\n";
            }
        });
    });

    puml_code = puml_code + "@enduml\n";


    fs.writeFile("./result_" + folder_name + "/"+ uml_file, puml_code, function(err) {
        if(err) {
            return console.log(err);
        }
    });
    console.log("Generated one uml requires %s file.", uml_file);
}

function generateResults_oneAllRequiresUmlFile_with_functions() {
    var uml_file = "allRequires_with_functions.puml";
    var puml_code = "@startuml\n" + "\n";

    //  Insert code below  //

    Object.keys(BIM.files).filter(function(element){
        return BIM.files[element].properties.file_type.indexOf('internal') == 0;
    }).forEach(function(module_name){
        puml_code = puml_code  + module_name + ":" + "" +"\n";
    });
    
    // ^^^^^^^^^^^^^^^^^ //
    puml_code = puml_code + "@enduml\n";
    
    fs.writeFile("./result_" + folder_name + "/"+ uml_file, puml_code, function(err) {
        if(err) {
            return console.log(err);
        }
    });
    console.log("Generated one uml requires %s file.", uml_file);
}

function linkToModuleAllowedToDisplay(module) {
    return (BIM.display_link_to_node_external_modules.indexOf("yes") === 0 && BIM.files[module].properties.file_type.indexOf("node_external") === 0)
        ||
        (BIM.display_link_to_external_modules.indexOf("yes") ===0 && BIM.files[module].properties.file_type.indexOf("external") === 0)
        ||
        (BIM.files[module].properties.file_type.indexOf("internal"));
}

function generateResults(){
    var afunc, pufunc,pvfunc;
    var index = 0;

    Object.keys(BIM.files).filter(function(element){
        return BIM.files[element].properties.file_type.indexOf('internal_init') == 0;
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

function display_help() {
    console.log("\n\n\nThis script will generate PlantUml compatible files based on the source code given as argument");
    console.log("Possible options: ");
    console.log("\t--path <path> : mandatory");
    console.log("\t--display_link_to_node_external_modules <yes/no> : will display link between internal modules and node external modules. Default: no");
    console.log("\t--display_link_to_external_modules <yes/no> : will display link between internal modules and external modules. Default: no");
    console.log("\t--display_reduced_path <yes/no> : will display the reduced module name. Default: yes");
    console.log("\t--help : display this help\n\n\n");
}

function readArguments(argv) {
    console.log("ARGS received: %s", JSON.stringify(argv));
    if (argv.length <= 3) {
        display_help();
        process.exit(-1);
    }


    _.map(argv, function (el, idx) {
        if (el.indexOf("--path") === 0) {
            BIM.path = argv[idx+1];
            BIM.path2 = cleanPath(BIM.path);
        }
        if (el.indexOf("--display_link_to_node_external_modules") === 0) {
            BIM.display_link_to_node_external_modules = argv[idx+1];
        }
        if (el.indexOf("--display_link_to_external_modules") === 0) {
            BIM.display_link_to_external_modules = argv[idx+1];
        }
        if (el.indexOf("--display_reduced_path") === 0) {
            BIM.display_reduced_path = argv[idx+1];
        }
    });
}

function setInitialDefaultConfig(){
    BIM.display_link_to_node_external_modules = "no";
    BIM.display_link_to_external_modules = "no";
    BIM.display_reduced_path = "yes";
}

function main (){
    setInitialDefaultConfig();
    readArguments(process.argv);

    exec("find " + BIM.path + " -type f -name \"*.js\" | xargs grep -i \"^function \"", {maxBuffer: 1024 * 1024 *500})
        .then(function (result) {
            var stdout = result.stdout;
            storeAllFilesAndFunctions(stdout);
        })
        .then(function () {
            return exec("find " + BIM.path + " -type f -name \"*.js\" | xargs grep -i \"require(\" | grep -iv \"return require\"", {maxBuffer: 1024 * 1024 *500});
        })
        .then(function (result) {
            var stdout = result.stdout;
            // console.log(stdout);
            storeAllFilesAndRequires(stdout);
            return exec("find " + BIM.path + " -type f -name \"*.js\" | xargs grep -i \"module.exports.\" | grep -iv \"forTests\"", {maxBuffer: 1024 * 1024 *500});
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
        .then(generateResults_oneAllRequiresUmlFile)
        .then(function(result){
            console.log("Inside our then");
            generateResults_oneAllRequiresUmlFile_with_functions();
        })
        .catch(function (err) {
            console.error('ERROR: ', err);
        });
}

main();











