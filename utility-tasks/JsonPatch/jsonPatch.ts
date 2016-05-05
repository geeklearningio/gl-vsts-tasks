import path = require('path');
import fs = require('fs-extra');
import tl = require('vsts-task-lib/task');
import micromatch = require('micromatch');

var jsonPatch = require('fast-json-patch');

var targetPath = tl.getPathInput("JsonWorkingDir");
var patchContent = tl.getInput("JsonPatchContent");
var customPaychSyntax = tl.getBoolInput("CustomPatchSyntax");

var patterns: any = tl.getInput("JsonTargetFilters").split("\n").map((pattern) => path.join(targetPath, pattern));
var allFiles = tl.find(targetPath).map(file => path.resolve(file));

var files = allFiles.filter(micromatch.filter(patterns, { nodupes: true }));

var varRegex = /\$\((.*)\)/g;
var bomRegex = /^\uFEFF/;


try {

    patchContent = patchContent.replace(varRegex, (match, varName, offset, atring) => tl.getVariable(varName));

    for (var index = 0; index < files.length; index++) {
        var file = files[index];
        var fileContent = fs.readFileSync(file, { encoding: 'utf8' });

        var hasBOM = fileContent.match(bomRegex).length > 0;

        if (hasBOM) {
            console.log("file has bom");
            fileContent = fileContent.replace(bomRegex, '');
        }
        var json = JSON.parse(fileContent);

        var patchLines = patchContent.split('\n');

        var patches = [];

        if (customPaychSyntax) {
            patches = patchLines.map(line => {
                if (line[0] = '?') {
                    var patch = JSON.parse(line);
                    patch.ext_optional = true;
                    return patch;
                }
                return JSON.parse(line);
            });

            var validationResult = jsonPatch.validate(patches, json);
            if (validationResult && validationResult.length > 0) {
                patches = patches.filter((patch, index) => {
                    var patchValidation = validationResult[index];
                    if (patchValidation) {
                        if (patch.ext_optional) {
                            console.log('dropping optional patch ' + JSON.stringify(patch));
                            return false;
                        } else {
                            throw new Error('a patch is not optional but its validation failed');
                        }
                    } else {
                        return true;
                    }
                });
            }
        } else {
            patches = patchLines.map(line => JSON.parse(line));
        }

        var patchedJson = jsonPatch.apply(patches, json, true);
        var newFileContent = JSON.stringify(patchedJson);
        if (hasBOM){
            newFileContent = '\uFEFF' + newFileContent;
        }
        fs.writeFileSync(file, newFileContent, { encoding: 'utf8' });
    }

    tl.setResult(tl.TaskResult.Succeeded, "File Patched");
} catch (err) {
    console.error(String(err));
    tl.setResult(tl.TaskResult.Failed, String(err));
}
