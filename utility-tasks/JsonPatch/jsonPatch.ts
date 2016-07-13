import path = require('path');
import fs = require('fs-extra');
import tl = require('vsts-task-lib/task');
import micromatch = require('micromatch');

var jsonPatch = require('fast-json-patch');

var targetPath = tl.getPathInput("JsonWorkingDir");
var patchContent = tl.getInput("JsonPatchContent");
var customPatchSyntax = tl.getBoolInput("CustomPatchSyntax");

var patterns: any = tl.getInput("JsonTargetFilters").split("\n").map((pattern) => path.join(targetPath, pattern));
var allFiles = tl.find(targetPath).map(file => path.resolve(file));

var files = allFiles.filter(micromatch.filter(patterns, { nodupes: true }));

var varRegex = /\$\((.*?)\)/g;
var bomRegex = /^\uFEFF/;
var optRegex = /^\?/;


try {

    patchContent = patchContent.replace(varRegex, (match, varName, offset, string) => tl.getVariable(varName));

    for (var index = 0; index < files.length; index++) {
        var file = files[index];
        console.log('Patching file :' + file);

        var fileContent = fs.readFileSync(file, { encoding: 'utf8' });

        var hasBOMMatch = fileContent.match(bomRegex);
        var hasBOM = hasBOMMatch && hasBOMMatch.length > 0;

        if (hasBOM) {
            console.log("file has bom");
            fileContent = fileContent.replace(bomRegex, '');
        }
        var json = JSON.parse(fileContent);

        var patchLines = patchContent.split('\n');

        var patches = [];

        if (customPatchSyntax) {
            console.log("handling optional patches");

            patches = patchLines.map(line => {
                if (line.match(optRegex)) {
                    var patch = JSON.parse(line.substr(1));
                    patch.ext_optional = true;
                    return patch;
                }
                return JSON.parse(line);
            });

            console.log(JSON.stringify(patches));

            var validationResult = jsonPatch.validate(patches, json);
            if (validationResult && validationResult.length > 0) {
                patches = patches.filter((patch, patchIndex) => {
                    var patchValidation = validationResult[patchIndex];
                    if (patchValidation) {
                        if (patch.ext_optional) {
                            console.log('dropping optional patch :' + JSON.stringify(patch));
                            return false;
                        } else {
                            throw new Error('a patch is not optional but its validation failed');
                        }
                    } else {
                        console.log('keeping optional patch :' + JSON.stringify(patch));
                        return true;
                    }
                });
            }
        } else {
            patches = patchLines.map(line => JSON.parse(line));
        }

        var prevalidate = jsonPatch.validate(patches, json);

        if (prevalidate && prevalidate.length > 0) {

        }

        var result = jsonPatch.apply(json, patches, false);
        if (result) {
            var newFileContent = JSON.stringify(json);
            if (hasBOM) {
                newFileContent = '\uFEFF' + newFileContent;
            }
            fs.writeFileSync(file, newFileContent, { encoding: 'utf8' });
            console.log('patch applied successfully');
        } else {
            throw new Error('Failed to apply patch')
        }
    }

    tl.setResult(tl.TaskResult.Succeeded, "File Patched");
} catch (err) {
    console.error(String(err));
    tl.setResult(tl.TaskResult.Failed, String(err));
}
