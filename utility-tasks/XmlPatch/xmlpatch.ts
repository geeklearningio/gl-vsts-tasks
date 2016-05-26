import path = require('path');
import fs = require('fs-extra');
import tl = require('vsts-task-lib/task');
import micromatch = require('micromatch');
import xpath = require('xpath');
import xmldom = require('xmldom');

interface IPatch{
    op: string;
    path: string;
    value: any;
}


export function applyPatch(namespaces:{[key:string]: string}, jsonPatches:string[], source: string): string {
    var patches = jsonPatches.map(p=> <IPatch>JSON.parse(p));
    var xml = new xmldom.DOMParser().parseFromString(source);
    var select = xpath.useNamespaces(namespaces);
    for (var index = 0; index < patches.length; index++) {
        var patch = patches[index];
        if (patch.op == 'replace'){
            var pathElements = patch.path.split('/')
            console.log(patch.path);
            var basePath = pathElements.slice(0,-1);
            var endPath = pathElements[pathElements.length-1];
            var node = <SVGSVGElement>select('/' + basePath.join('/'), xml, true);
            if (node){
                var childNode = <SVGSVGElement>select(endPath, node, true);
                if (childNode){
                    childNode.textContent = String(patch.value);
                    console.log('setting node content');
                } else {
                    node.setAttribute(endPath, String(patch.value));
                    console.log('setting node attribute');
                }
                // var attribute = <SVGSVGElement>xpath.select('@' + endPath , node, true);
                // if (attribute){
                // }
            } else {
                console.log('not found');
            }
        }
    }
    return new xmldom.XMLSerializer().serializeToString(xml);
}


var targetPath = tl.getPathInput("JsonWorkingDir");
var namespaces = JSON.parse(tl.getInput("Namespaces"));
var patchContent = tl.getInput("JsonPatchContent");
var customPatchSyntax = tl.getBoolInput("CustomPatchSyntax");

var patterns: any = tl.getInput("JsonTargetFilters").split("\n").map((pattern) => path.join(targetPath, pattern));
var allFiles = tl.find(targetPath).map(file => path.resolve(file));

var files = allFiles.filter(micromatch.filter(patterns, { nodupes: true }));

var varRegex = /\$\((.*)\)/g;
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
      
        var patchLines = patchContent.split('\n');

        //var patches = patchLines.map(line => JSON.parse(line));

        // var prevalidate = jsonPatch.validate(patches, json);

        // if (prevalidate && prevalidate.length > 0) {

        // }

        var result = applyPatch(namespaces, patchLines, fileContent);
        console.log('>>>> : patched file');
        console.log(result);
        if (result) {
            var newFileContent = result;
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
