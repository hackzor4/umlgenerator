var exec = require('child_process').exec;

var date = new Date();
var hours = date.getHours();
var year = date.getFullYear();
var month = date.getMonth() +1;
var day = date.getDate();
var minutes = date.getMinutes();
var resultsDate = year + "_" + month + "_" + day + "_" + hours + "_" + minutes;
var BIM = { files : {}};


function storeAllFilesAndFunctions(error, stdout, stderr) {
    console.log("Error: %s\nStderr: %s\nStdout: %s\n", error, stderr, stdout);
    stdout.split("\n").slice(0, -1).forEach(function(element) {
        console.log("Line: %s", element);
        var array = element.split(':'),
            file = array[0], func = array[1];
        file1 = file.replace(/\//gi,"_").replace(/^\.\./gi, "").replace(/\.js$/gi, "").replace(/^_/,"");
        func1 = func.slice(0, func.indexOf("(")).replace(/^function /, "");


        if (!BIM.files.hasOwnProperty(file1)) {
            BIM.files[file1] = { "all_functions" : [],
                                 "all_requires" : []
                                };

        }

        BIM.files[file1].all_functions.push(func1);
        displayAllBIM();
        generateResults();
    });
    return "done";
}

function storeAllFilesAndRequires(error, stdout, stderr) {
    console.log("Error: %s\nStderr: %s\nStdout: %s\n", error, stderr, stdout);
    stdout.split("\n").slice(0, -1).forEach(function(element) {
        console.log("Line: %s", element);
        var array = element.split(':'),
            file = array[0], func = array[1];
        file1 = file.replace(/\//gi,"_").replace(/^\.\./gi, "").replace(/\.js$/gi, "").replace(/^_/,"");
        func1 = func.slice(0, func.indexOf("(")).replace(/^function /, "");


        if (!BIM.files.hasOwnProperty(file1)) {
            //console.log("ERROR: strange, the file %s should already exist in the list", file1);
            BIM.files[file1] = [];
        }

        BIM.files[file1].push(func1);
    });
    return "done";
}

function displayAllBIM() {
    console.log(JSON.stringify(BIM, null, 4));
}

function generateResults(){
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

    return new Promise(function(resolve, reject){
            resolve('Success');
            return getAllFilesAndFunctions();
    })
        // .then(storeAllFilesAndFunctions)
        .then(displayAllBIM())
        .then(generateResults());

    //getAllFilesAndRequires();
}

function getAllFilesAndFunctions() {
    console.log("Checking functions in %s", BIM.path);
    return exec("find " + BIM.path + " -type f -name \"*.js\" | xargs grep -i \"^function \"", storeAllFilesAndFunctions);

}

function getAllFilesAndRequires() {
    console.log("Checking functions in %s", BIM.path);
    return exec("find " + BIM.path + " -type f -name \"*.js\" | xargs grep -i \"require(\"", storeAllFilesAndRequires);

}

main();










