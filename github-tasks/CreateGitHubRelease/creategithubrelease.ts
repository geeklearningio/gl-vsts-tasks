import tl = require("vsts-task-lib/task");
var GitHubApi = require("github");
var gh = require("github-url-to-object");
var semver = require("semver");

try {
    console.log("Entering CreateGitHubRelease");
    
    var buildRepositoryProvider = tl.getVariable("BUILD_REPOSITORY_PROVIDER");
    if (buildRepositoryProvider !== "GitHub"){
        throw new Error("This task cannot create a release on a non-GitHub repository.");
    }
    
    var buildRepositoryUri = tl.getVariable("BUILD_REPOSITORY_URI");
    var buildSourceVersion = tl.getVariable("BUILD_SOURCEVERSION");    
    var endpointAuth = tl.getEndpointAuthorization(buildRepositoryUri, false);

    var repositoryInfo = gh(buildRepositoryUri);    
    
    var github = new GitHubApi({
        protocol: "https",
        host: "api.github.com",
        headers: {
            "user-agent": "create-github-release-task"
        },
        Promise: require("bluebird"),
        followRedirects: false,
        timeout: 5000
    });
    
    github.authenticate({
        type: "basic",
        username: endpointAuth.parameters["Username"],
        password: endpointAuth.parameters["Password"]
    });

    var tagName = tl.getInput("tagName", true);
    var prereleaseMode = tl.getInput("prereleaseMode", true);
    var prerelease = false;
    switch (prereleaseMode)
    {
        case "1":
            prerelease = true;
            break;
        case "3":
            var prereleaseComponents = semver.prerelease(tagName);
            prerelease = (prereleaseComponents !== null);
            break;
        case "2":
        default:
            prerelease = false;
            break;
    }

    github.repos.createRelease({
        user:repositoryInfo.user,
        repo: repositoryInfo.repo,
        tag_name: tagName,
        target_commitish: buildSourceVersion,
        name: tl.getInput("releaseName", false),
        body: tl.getInput("releaseBody", false),
        draft: tl.getBoolInput("draft", true),
        prerelease: prerelease,
    }, function(err, res) {
        if (err) {
            tl.setResult(tl.TaskResult.Failed, String(err));
            return;
        }
               
        console.log("GitHub Release created successfully!");
        console.log(JSON.stringify(res, null, 4));
        
        tl.setVariable("GitHubRelease.Id", res.id);        
        tl.setVariable("GitHubRelease.Url", res.url);
        tl.setVariable("GitHubRelease.HtmlUrl", res.html_url);
    });

    console.log("Leaving CreateGitHubRelease");
    
} catch (err) {
    tl.setResult(tl.TaskResult.Failed, String(err));
}