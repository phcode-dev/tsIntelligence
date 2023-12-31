// goto this link for all available GitHub rest api functions. https://octokit.github.io/rest.js/v18#repos-update

console.log("Hello");

let github, context, org, repoName;

async function createIssue(title, body){
    await github.rest.issues.create({
        owner: org,
        repo: repoName,
        title: title,
        body: body
    });
}

async function setupRepositoryDefaults(){
    // send a message to code guardian action repo eventually to enable auto setup https://github.com/aicore/Code-Guardian-Actions
}

function _isValidRepoInitEvent(){
    if(context.eventName !== 'create'){
        return false;
    }
    if(!context.ref.endsWith(`/${context.payload.master_branch}`)){
        return false;
    }
    return true;
}

async function initRepo(details){
    github = details.github;
    context = details.context;
    org = details.org;
    repoName = details.repoName;
    if(!_isValidRepoInitEvent()){
        console.log("Not a valid repo creation event. This task is only meant to be executed at repo creation. Exiting!");
        return;
    }
    await createIssue("Update package.json with your app defaults", _getPackageJsonComment());
    await createIssue("Verify Build actions on pull requests.", _getVerifyBuildActionComment());
    await createIssue("Enable Github Wikis for API docs", _getEnableWikiComment());
    await createIssue("Enable Sonar Cloud Code Checks", _getSonarSetupComment());
    await createIssue("Setup Repository settings", _setupRepoComment());
}

function _setupRepoComment(){
    return `
## Setup repository settings
Setup your repository default settings. Goto this url https://github.com/${org}/${repoName}/settings

- [ ] In \`Settings> General> Pull Requests\` uncheck/disable \`Allow merge commits \`
- [ ] In \`Settings> General> Pull Requests\` uncheck/disable \`Allow auto-merge \`. This is to prevent GitHub secrets leak after malicious pull request auto merges.
- [ ] In \`Settings> General> Pull Requests\` check/enable \`Automatically delete head branches \`
- [ ] Delete the file \`.github/workflows/setup_repository.yml\ and \`.github/workflows/js/setupRepository.cjs\`
`;
}


function _getSonarSetupComment(){
    return `
## Enable Sonar Cloud Code Scan for this repo
Sonar cloud does code scanning for core.ai repos. Ensure that sonar cloud is enabled for this repo.

Usually available in this URL: https://sonarcloud.io/project/overview?id=${org}_${repoName}
![image](https://user-images.githubusercontent.com/5336369/148695840-65585d04-5e59-450b-8794-54ca3c62b9fe.png)

- [ ] Contact an core.ai org administrator to enable sonar scan for this repo.
- [ ] Verified that soncar scan code checks are available in your pull requests.
- [ ] Get you sonar cloud ID for the repo. It will usually look like \`${org}_${repoName}\` for ${org} repos.
- [ ] Update \`readme.md\` with sonar badges by replacing all \`aicore_template-nodejs-ts\` with the id you got above. See this link for a sample pull request : https://github.com/aicore/libcache/pull/13
- [ ] Update \`readme.md\` build verification badge by replacing this line \`[![<app> build verification](https://github.com/aicore/template-nodejs/actions/workflows/build_verify.yml/badge.svg)](https://github.com/aicore/template-nodejs/actions/workflows/build_verify.yml)\`
with \`[![<app> build verification](https://github.com/${org}/${repoName}/actions/workflows/build_verify.yml/badge.svg)](https://github.com/${org}/${repoName}/actions/workflows/build_verify.yml)\`
`;
}

function _getEnableWikiComment(){
    return `
## Enable Github Wikis for API docs
API Docs are autogenerated with core.ai repos. Got to the below wiki url and create a home page in wiki to start generating API docs.
https://github.com/${org}/${repoName}/wiki
- [ ] Created a home wiki page
- [ ] Verified that api docs are generated after a push to main branch is done.
`;
}

function _getVerifyBuildActionComment(){
    return `
## Verify that build actions 
We use GitHub actions extensively. Verify that Github Actions are being executed with the following url 
https://github.com/${org}/${repoName}/actions
- [ ] All Build actions functioning as expected
`;
}

function _getPackageJsonComment(){
    return `
## Update package.json with your app defaults
- [ ] update package name to \`@aicore/${repoName}\`
- [ ] update description
- [ ] update keywords
- [ ] update author
- [ ] update bugs url
- [ ] update homepage url
`;
}

module.exports.initRepo = initRepo;
