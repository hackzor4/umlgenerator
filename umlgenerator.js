var exec = require('child_process').exec;
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
            BIM.files[file1] = [];
        }

        BIM.files[file1].push(func1);
        displayAllBIM();
    });
}

function displayAllBIM() {
    console.log(JSON.stringify(BIM, null, 4));
}

function generateResults(){
    
}

function main (){
    if (process.argv.length <= 2) {
        console.log("Please enter the path");
        process.exit(-1);
    }
    var param = process.argv[2];
    BIM.path = param;
    getAllFilesAndFunctions();
    displayAllBIM();
}

function getAllFilesAndFunctions() {
    console.log("Checking functions in %s", BIM.path);
    exec("find " + BIM.path + " -type f -name \"*.js\" | xargs grep -i \"^function \"", storeAllFilesAndFunctions);

}

main();










